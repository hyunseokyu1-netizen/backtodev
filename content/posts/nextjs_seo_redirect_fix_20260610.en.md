---
title: 'Turning Off the Red Warnings in Google Search Console — Fixing Next.js i18n Redirect Errors'
date: '2026-06-10'
publish_date: '2026-06-27'
description: From 404s to redirect errors to duplicate pages — digging through Search Console errors one by one and fixing them with a few lines in next.config.ts
tags:
  - NextJS
  - SEO
  - GoogleSearchConsole
  - next-intl
  - Debugging
---

About two months into running this blog, I opened Google Search Console and found a pile of red warnings.

- 4 Not found (404)
- 1 Redirect error
- 6 Duplicate, Google chose different canonical than user
- 4 Crawled - currently not indexed
- 2 Page with redirect

The numbers look small, but a wrong index accumulating over time gets harder to fix later. I dug through them one by one.

---

## The blog's structure, first

This blog runs Next.js 16 + next-intl, serving Korean (`/ko/`) and English (`/en/`) side by side. The middleware (`proxy.ts`) detects browser language and auto-prefixes the locale.

This structure is the main backdrop for the Search Console errors.

---

## Error 1 — Not found (404)

### Affected URLs

```
https://backtodev.com/posts/hello-world
https://backtodev.com/ko/posts/hello-world
https://backtodev.com/ko/posts/ai-개발시작001-클로드-코드-시작
https://backtodev.com/posts/ai-개발시작001-클로드-코드-시작
```

### Cause

`hello-world` was a slug used early on for testing. It's been deleted, but once Google indexes a URL, it keeps revisiting it.

`ai-개발시작001-클로드-코드-시작` is an old slug left over from renaming the post filename. The actual file has since become `ai_coding_start_001_20260327`.

### Fix

I'd already added redirect rules to `next.config.ts`, but there was a problem: `hello-world`'s `permanent` value was `false` (a 302 temporary redirect).

```ts
// Before: 302 → Google treats it as "temporary," keeps re-crawling
{
  source: "/:locale(ko|en)/posts/hello-world",
  destination: "/:locale/posts",
  permanent: false, // ← the problem
},

// After: 301 → Google treats it as "permanently moved," stops re-crawling
{
  source: "/:locale(ko|en)/posts/hello-world",
  destination: "/:locale/posts",
  permanent: true,
},
```

**A 302 is a signal that "this might come back later."** Google keeps crawling URLs that returned a 302 redirect instead of dropping them from its index. For pages that are permanently gone, you always need a 301.

---

## Error 2 — Redirect error (`backtodev.com/ko/`)

### Symptom

URL: `https://backtodev.com/ko/` (with a trailing slash)
→ Google classified it as a redirect error.

### Root cause analysis

A redirect loop was forming from a conflict between the next-intl middleware and Next.js's trailing-slash handling.

```
/ko/ → intlMiddleware → redirects to /ko (strips trailing slash)
/ko  → intlMiddleware → redirects to /ko/ (re-adds trailing slash?)
     → loop
```

When Google's crawler falls into this loop, it classifies it as a "redirect error."

### Fix

Added a trailing-slash normalization rule to `next.config.ts`'s `redirects()`, so it runs **before** the middleware.

```ts
async redirects() {
  return [
    // trailing slash normalization — handled before the middleware
    { source: "/ko/", destination: "/ko", permanent: true },
    { source: "/en/", destination: "/en", permanent: true },
    // ... remaining rules
  ];
},
```

`next.config.ts`'s `redirects()` runs **before** middleware. So `/ko/` gets 301'd to `/ko` before it ever reaches the middleware. The loop breaks.

---

## Error 3 — Duplicate, Google chose different canonical than user (6 pages)

### Symptom

Mostly URLs shaped like `/ko/posts/slug` classified as "duplicate pages."

### Cause

At the time these posts were first crawled by Google, there was no English translation file. Back then, visiting `/en/posts/slug` triggered a "fallback" that showed the `/ko/` original content as-is. Google saw `/ko/` and `/en/` with identical content and couldn't tell which one was authoritative.

### Direction for the fix

All English translation files have since been added. Once Google re-crawls, it'll confirm `/ko/` and `/en/` now have different content, and the duplicate warning will clear.

At the code level, fallback pages already have `noindex` set.

```ts
// app/[locale]/posts/[slug]/page.tsx
const canonicalUrl = post.isFallback
  ? `${BASE_URL}/ko/posts/${slug}`
  : `${BASE_URL}/${locale}/posts/${slug}`;

return {
  ...(post.isFallback && { robots: { index: false, follow: false } }),
  alternates: {
    canonical: canonicalUrl,
    // ...
  },
};
```

No additional fix needed — just waiting for Google's re-crawl clears this.

---

## Error 4 — Crawled - currently not indexed (4 pages)

| URL | Cause | Handling |
|---|---|---|
| `/en/posts/hello-world` | same as Error 1 | resolved via the 301 redirect |
| `/en/posts/data_inbreeding` | no English translation at crawl time | resolved by adding the translation, waiting for re-crawl |
| `/favicon.ico?...` | Google crawled a static file | can be ignored |
| `/_next/static/media/...woff2` | Google crawled a font file | can be ignored |

`favicon.ico` and `.woff2` are just resource files Google's crawler picked up while crawling the site. Since they're not pages, of course they don't get indexed — no fix needed.

---

## Error 5 — Page with redirect (2 pages)

| URL | Redirect destination | Handling |
|---|---|---|
| `backtodev.com/en/` | `/en` | resolved by fixing Error 2 |
| `backtodev.com/contact` | `/ko/contact` or `/en/contact` | working as intended, no fix needed |

Visiting `/contact` without a locale gets routed by the middleware to `/ko/contact` or `/en/contact` based on browser language. A redirect does happen, but it's intentional. Google flagging it as "a page with a redirect" isn't an error — it's just informational.

---

## Summary

```
Redirect error /ko/  → added /ko/ → /ko 301 to next.config.ts (blocks the middleware loop)
404 hello-world      → permanent: false → true (changed to a 301)
Duplicate pages      → English translations added, waiting for Google re-crawl
Crawled-not indexed  → naturally resolves via the redirect fix + added translations
```

In the end, it was just 5 lines added to `next.config.ts`.

Search Console errors are easy to ignore, but things like redirect loops get more tangled in the index the longer they sit, so it's better to catch them early. It's cleanest to look at these while the numbers are still small.
