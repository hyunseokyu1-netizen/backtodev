---
title: 'Setting Up SEO Basics in Next.js — robots, sitemap, and OG Images, All in Code'
date: '2026-07-10'
publish_date: '2026-11-03'
description: Scoping SEO work down to the public pages of a login-first app, setting up robots.txt, sitemap.xml, and OG images with Next.js file conventions, and catching a middleware bug that was silently blocking all of them
tags:
  - Next.js
  - SEO
  - App Router
  - Middleware
  - next/og
---

## Why I Needed to Set Up SEO

While auditing the MatchDa service, I realized SEO had barely been touched. There was no `robots.txt`, no `sitemap.xml`, and the root layout's metadata was just two lines — `title` and `description`. There was no `metadataBase` either, and no OG (Open Graph) or Twitter card settings, so **pasting the link into KakaoTalk or Slack showed no preview at all.** Out of 22 total pages, only 4 legal pages — terms of service, privacy policy, and the like — had their own metadata. The landing, pricing, and about pages, the ones that actually needed to get picked up by search, had nothing.

This post is a record of setting all of this up from scratch. Along the way I also caught a bug that looked completely fine on the surface but was actually neutralizing every single SEO file — and that story is really the heart of this post.

## Step 1. Scoping the Work Down First

I didn't need to touch all 22 pages. MatchDa is a login-required service, so there are only a handful of pages that someone who isn't logged in (and a search engine crawler) can actually see content on. The fastest way to confirm this was to look at the public-path whitelist in the auth middleware.

```ts
// src/middleware.ts
const PUBLIC_PATHS = ['/', '/about', '/pricing', '/terms', '/privacy', '/refund', '/support', ...]
```

The 7 paths listed here are the entirety of the SEO work. The rest (dashboard, workspace, settings, etc.) bounce you to `/login` anyway if you're not signed in, so there's no content for a search engine to index even if it crawls them. What I learned here: **for a "log in to use" service, the first step of SEO work isn't the full page list — it's checking the public paths in the middleware.**

## Step 2. robots.txt — One File and Done

In the Next.js App Router, creating a `src/app/robots.ts` file auto-generates `/robots.txt`. No need to write a separate route handler.

```ts
// src/app/robots.ts
import type { MetadataRoute } from 'next'

const SITE_URL = 'https://matchda.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/about', '/pricing', '/terms', '/privacy', '/refund', '/support'],
      disallow: [
        '/dashboard', '/applications', '/discover', '/profile', '/workspace',
        '/settings', '/onboarding', '/login', '/auth', '/api', '/matchda', '/r/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

The key detail is putting `/r/<slug>` (a user-generated public résumé share link) into `disallow`. This feature was built with the intent of "only people who have the link should see it" — it's accessible without logging in, but I don't want it showing up in search. You have to explicitly separate "accessible" from "okay to appear in search."

## Step 3. sitemap.xml — The Same Way

`src/app/sitemap.ts` is also just a file convention. I registered the 7 public pages and gave them different `priority` values based on importance.

```ts
// src/app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    // ...
  ]
}
```

The landing page gets 1.0, about/pricing get 0.8, and the legal pages get 0.2 — pages that rarely change and don't matter much for search get a lower priority.

## Step 4. OG Images — In Code, No Design Tool Needed

It's easy to assume you need a design tool to make a link-sharing preview image, but Next.js lets you **render an image on the server at request time** with `next/og`'s `ImageResponse`. One file, `src/app/opengraph-image.tsx`, is all it takes.

```tsx
// src/app/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  // public 폴더의 로고 파일을 읽어서 base64로 임베드
  const logoData = await readFile(join(process.cwd(), 'public', 'matchda-mark.png'))
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', background: '#F7FBF9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src={logoSrc} alt="" width={84} height={84} style={{ borderRadius: 20 }} />
          <span style={{ fontSize: 64, fontWeight: 700, color: '#0C1A14' }}>MatchDa</span>
        </div>
        <div style={{ marginTop: 32, fontSize: 34, fontWeight: 600, color: '#0B1A12' }}>
          한국어 이력서를 전문가 수준 영어로,
        </div>
        <div style={{ marginTop: 8, fontSize: 34, fontWeight: 600, color: '#046C4E' }}>
          해외 채용 공고에 맞춰 자동으로.
        </div>
      </div>
    ),
    { ...size }
  )
}
```

The JSX that `ImageResponse` accepts isn't regular React — it's a limited subset (only flexbox-based styles are supported) — and to use a local image file, you can't use the `<Image>` component; you have to read it directly with `fs.readFile`, convert it to a base64 data URI, and drop it into a plain `<img>` tag. Just knowing this one pattern lets you build a branded OG image with a logo, purely in code.

Right after building it, I pulled the result as a PNG and looked at it myself. Syntactically correct code is no guarantee the output actually looks good, so actually opening it up matters.

## Step 5. Setting Up the Metadata Inheritance Structure

I added `metadataBase` and a `title` template to the root layout.

```ts
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://matchda.com'),
  title: {
    default: 'MatchDa — 한국 인재를 위한 글로벌 커리어 플랫폼',
    template: '%s — MatchDa',
  },
  description: '...',
  openGraph: {
    // ...
    images: ['/opengraph-image'],  // 하위 페이지가 따로 안 정하면 이걸 상속
  },
}
```

`title.template` is the key part. With this in place, a child page can write just `title: '요금제'` — short — and it automatically completes to `"요금제 — MatchDa"`. The same goes for `openGraph.images`: if a child page doesn't set its own image, it directly inherits the OG image I just built.

## Troubleshooting — Two Bugs Code Review Alone Couldn't Catch

### Bug 1. The title Doubled Up

After adding the `title` template, I went back and looked at the 4 pages that already had their own metadata (terms of service, privacy policy, refund policy, customer support).

```ts
// Before — 이미 "— MatchDa"까지 박아둔 상태
export const metadata = { title: '환불 정책 — MatchDa' }
```

Combine this value with the template (`%s — MatchDa`) and you get `"환불 정책 — MatchDa — MatchDa"`. **The moment you introduce a template, you have to go back and re-check every child page for whether it was already appending its own suffix.** I changed all 4 pages to short titles and added a `description` to the ones that didn't have one.

```ts
// After
export const metadata = {
  title: '환불 정책',
  description: 'MatchDa 프리미엄 구독의 환불 가능 조건, 제한 사유, 요청 방법을 안내합니다.',
}
```

### Bug 2. Even robots.txt Was Being Redirected to the Login Page

This was the real one. After building everything, I went and hit it directly in the browser.

```bash
curl -s http://localhost:3999/robots.txt
# → /login  (?!)
```

`robots.txt` was being redirected to `/login`. Same story for `sitemap.xml`, the `opengraph-image` I'd just built, and even the favicons (`icon.svg`, `apple-icon.png`).

The cause was the `matcher` setting in the auth middleware.

```ts
// Before
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
}
```

This regex means "run every path that's not in this list through the middleware (= check for login)." Things like `_next/static` and `api` were already excluded, but **the newly added Next.js file-convention paths — `robots.txt`, `sitemap.xml`, `opengraph-image` — weren't on the list.** So they got treated like ordinary pages and ran straight into the "not logged in, send to `/login`" logic.

In other words, there's a real chance search engines hadn't even been able to properly read `robots.txt` up until now. No matter how well you write `robots.ts`, if the middleware redirects upstream of it, a crawler ends up receiving the login page's HTML instead of `robots.txt`.

```ts
// After
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|auth/callback|robots.txt|sitemap.xml|opengraph-image|icon.svg|apple-icon.png).*)',
  ],
}
```

The lesson from this bug is clear. **For SEO-related files, syntactically correct code isn't the finish line — you have to actually fire an HTTP request and check the response.** If I'd only reviewed the `robots.ts` code, I'd have walked away thinking "nicely done" — but a completely different layer, the middleware, was quietly blocking all of it. This was the kind of problem code review alone could never catch.

## Verification

After fixing it, I checked again with curl.

```bash
curl -s http://localhost:3999/robots.txt
# User-Agent: *
# Allow: /
# Allow: /about
# ...
# Sitemap: https://matchda.com/sitemap.xml

curl -s -o /dev/null -w "%{content_type} %{size_download}\n" http://localhost:3999/opengraph-image
# image/png 37825
```

And since I'd touched the middleware, I made sure to **re-verify that pages meant to be protected hadn't accidentally been opened up too.**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3999/dashboard
# 307  ← 여전히 로그인으로 리다이렉트됨(정상)
```

I widened the matcher to let the SEO files through, but if that same change accidentally opened up protected paths that need to stay locked down, that's a much bigger problem. It matters not to skip this step of confirming the changed config only opened up "exactly what was intended."

## Summary of Frequently Used Patterns

| Purpose | Method |
|---|---|
| Generating robots.txt | `src/app/robots.ts` (file convention, returns code) |
| Generating sitemap.xml | `src/app/sitemap.ts` (file convention) |
| Dynamic OG image | `src/app/opengraph-image.tsx` + `next/og`'s `ImageResponse` |
| Embedding a local image into an OG image | `fs.readFile` → `base64` data URI → `<img src="data:...">` |
| Auto-completing child page titles | Root `metadata.title = { default, template: "%s — brand name" }` |
| Checking whether middleware is blocking a special route | Request it directly with `curl -s -o /dev/null -w "%{http_code}"` |

## Wrap-Up

```
공개 페이지 범위 확정(미들웨어 화이트리스트 확인, 22개 중 7개만 해당)
  → robots.ts / sitemap.ts (파일 컨벤션으로 자동 생성)
  → opengraph-image.tsx (next/og로 코드에서 PNG 렌더링, 로고는 fs+base64로 임베드)
  → layout.tsx에 metadataBase + title 템플릿 + OG/Twitter 기본값
  → 기존 4개 페이지의 title 중복 수정
  → curl로 실제 응답 확인 → 미들웨어가 SEO 라우트를 로그인 페이지로 막고 있던 버그 발견
  → matcher 수정 → 재검증(SEO 라우트는 열림, 보호 페이지는 여전히 막힘)
```

The biggest impression left from this work is that **SEO setup has to be verified not by "did I write plausible-looking code" but by "what actually comes back when I fire a request at that path."** The `robots.ts`, `sitemap.ts`, and OG image code were all syntactically flawless. The problem was the middleware sitting upstream of them — the kind of bug you'd never have noticed even weeks after deploying, if you hadn't fired off that one curl request.
