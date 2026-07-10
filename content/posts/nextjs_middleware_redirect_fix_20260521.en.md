---
title: "Next.js + next-intl: A /ko/ Redirect Error and a proxy.ts Conflict Ordeal"
date: '2026-05-21'
publish_date: '2026-06-10'
description: How I hit a build error while trying to fix a Google Search Console redirect error, and what I learned about the proxy.ts structure
tags:
  - Next.js
  - next-intl
  - SEO
  - middleware
---

Looking through Google Search Console, this entry caught my eye.

> **Redirect error** — 1 page affected  
> `https://backtodev.com/ko/`

The site was running fine. Visiting `/ko` showed the home page, posts displayed correctly. But apparently `/ko/` (the trailing-slash version) was throwing a redirect error.

Tracing the cause, I added a `middleware.ts` — and that triggered a build error instead. Turned out `proxy.ts` already existed.

---

## First attempt — adding middleware.ts (a detour)

Looking at the Next.js + next-intl setup, there was no `middleware.ts`. next-intl needs middleware for locale routing. So I added one right away.

```ts
// middleware.ts (newly created)
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/(ko|en)/:path*",
    "/((?!_next|_vercel|api|.*\\..*).*)",
  ],
};
```

Committed and pushed, and the Vercel build blew up.

```
Error: Both middleware file "./middleware.ts" and proxy file "./proxy.ts"
are detected. Please use "./proxy.ts" only.
```

I had no idea `proxy.ts` already existed.

---

## Tracing the cause — proxy.ts was already there

There was a `proxy.ts` file at the project root. In certain Next.js versions, `proxy.ts` is used as the middleware file instead of `middleware.ts`. Having both files at once fails the build.

Checking the contents of `proxy.ts`, **it already included next-intl's middleware.**

```ts
// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { verifyToken } from "./lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth API is always allowed
  if (pathname.startsWith("/api/admin/auth")) return NextResponse.next();

  // Protect /admin pages
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const token = request.cookies.get("admin_token")?.value;
    const valid = token ? await verifyToken(token) : false;
    if (!valid) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Everything else goes through next-intl
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/admin/:path*"],
};
```

The last line, `return intlMiddleware(request)` — every request that isn't an admin route was already being handled by the next-intl middleware. Handling `/ko/` with a trailing slash was already this file's job too.

---

## Understanding the proxy.ts structure

This project's middleware serves two roles at once.

```
Request comes in
    ↓
proxy.ts intercepts
    ├── /api/admin/auth → pass through (login/logout API)
    ├── /admin/login → pass through
    ├── /admin/* → verify token → redirect to /admin/login on failure
    ├── /api/admin/* → verify token → 401 on failure
    └── everything else → handled by createIntlMiddleware
                          ├── / → redirect to /ko
                          ├── /ko/ → normalized to /ko
                          └── /unknown-path → /ko/unknown-path
```

The difference from `middleware.ts` (a typical next-intl setup) is that admin-protection logic is bolted onto the front. It's structured as one combined file, since splitting these into separate files causes the two middlewares to conflict.

---

## Fix — delete middleware.ts

I just deleted the `middleware.ts` I had created. `proxy.ts` was already handling everything.

```bash
rm middleware.ts
git add middleware.ts
git commit -m "fix: remove duplicate middleware.ts — proxy.ts already includes intl middleware"
git push origin main
```

Build succeeded. The `/ko/` redirect was already being handled by `proxy.ts`'s `intlMiddleware` from the start.

---

## What I learned

**Check existing files first.** Before adding a new file in response to an error, I should have looked for whether a file already serving a similar role existed.

**The middleware filename can differ by Next.js version.** It's usually `middleware.ts`, but some projects, like this one, use `proxy.ts` instead. Having both at once fails the build outright.

**next-intl can be merged with other middleware logic.** By directly calling the function `createIntlMiddleware` returns, you can cleanly integrate it into one file alongside custom logic like admin auth.

---

## Summary

```
Google Search Console: /ko/ redirect error
    ↓
assumed middleware.ts was missing → created a new one
    ↓
build error: proxy.ts and middleware.ts can't coexist
    ↓
checked proxy.ts → already included createIntlMiddleware
    ↓
deleted middleware.ts → build succeeded
    ↓
the /ko/ redirect had already been handled by proxy.ts all along
```

The Search Console error naturally clears once Google re-crawls the site.
