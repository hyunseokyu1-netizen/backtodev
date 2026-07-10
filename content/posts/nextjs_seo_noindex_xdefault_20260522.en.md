---
title: 'Next.js Multilingual Blog SEO — Why Google Ignores /ko, and Two Fixes'
date: '2026-05-22'
publish_date: '2026-06-11'
description: How a missing x-default hreflang and unhandled isFallback posts caused a Google Search Console duplicate-page error, and how to fix both
tags:
  - Next.js
  - SEO
  - next-intl
  - hreflang
---

Google Search Console flagged this.

> **Duplicate, Google chose different canonical than user**  
> Affected pages: `https://backtodev.com/ko`, `https://backtodev.com/ko/contact`

I had clearly set canonical to `https://backtodev.com/ko`, but Google ignored it and picked the `/en` version as the representative URL instead.

There were two causes.

---

## Cause 1 — missing x-default hreflang

Setting up hreflang on a multilingual site usually looks like this.

```tsx
alternates: {
  canonical: `${BASE_URL}/${locale}`,
  languages: {
    ko: `${BASE_URL}/ko`,
    en: `${BASE_URL}/en`,
  },
},
```

Notice `ko` and `en` are there, but `x-default` is missing.

**`x-default` is the signal telling Google "here's the default URL to use when no language matches."** Without it, Google has to decide for itself which of `/ko` and `/en` is the "true representative" — and that decision might not match your intent.

In fact, this blog's default language is Korean, but with no `x-default`, Google chose `/en` as the canonical, pushing `/ko` down as a "duplicate page."

---

## Cause 2 — insufficient handling of isFallback posts

This blog has `/en/posts/[slug]` URLs even for posts that only exist in Korean. With no English translation, it just shows the Korean content as-is (isFallback).

From Google's perspective, then:
- `https://backtodev.com/ko/posts/some-post` → Korean content
- `https://backtodev.com/en/posts/some-post` → the exact same Korean content

Two URLs, identical content → flagged as a duplicate page.

Locking canonical to `/ko` doesn't stop Google from crawling and attempting to index the `/en` URL itself. A stronger signal is needed.

---

## Fix 1 — add x-default

Added `x-default` to every page's `generateMetadata`.

**Homepage (`app/[locale]/page.tsx`):**

```tsx
alternates: {
  canonical: `${BASE_URL}/${locale}`,
  languages: {
    ko: `${BASE_URL}/ko`,
    en: `${BASE_URL}/en`,
    "x-default": `${BASE_URL}/ko`,  // added
  },
},
```

**Same for the posts list, about, and contact pages:**

```tsx
languages: {
  ko: `${BASE_URL}/ko/posts`,
  en: `${BASE_URL}/en/posts`,
  "x-default": `${BASE_URL}/ko/posts`,  // added
},
```

Once rendered, this produces:

```html
<link rel="alternate" hreflang="ko" href="https://backtodev.com/ko" />
<link rel="alternate" hreflang="en" href="https://backtodev.com/en" />
<link rel="alternate" hreflang="x-default" href="https://backtodev.com/ko" />
```

Now Google clearly understands "the default language is Korean."

---

## Fix 2 — add noindex to isFallback posts

Canonical alone isn't enough. Added `noindex` so Google never indexes the Korean-content `/en` posts at all.

```tsx
// app/[locale]/posts/[slug]/page.tsx
return {
  title: post.title,
  description: post.description,
  ...(post.isFallback && { robots: { index: false, follow: false } }),  // added
  alternates: {
    canonical: canonicalUrl,
    languages: {
      ko: `${BASE_URL}/ko/posts/${slug}`,
      ...(otherPost && !otherPost.isFallback
        ? { en: `${BASE_URL}/en/posts/${slug}`, "x-default": `${BASE_URL}/ko/posts/${slug}` }
        : { "x-default": `${BASE_URL}/ko/posts/${slug}` }),
    },
  },
  // ...
};
```

The tag rendered when isFallback is true:

```html
<meta name="robots" content="noindex, nofollow" />
```

Google sees this tag and excludes that URL from indexing entirely. A stronger signal than canonical.

---

## noindex vs. canonical → /ko — which is better?

| Approach | Pros | Cons |
|------|------|------|
| `canonical → /ko` | simple to implement | Google can ignore it. Also creates a URL contradiction (English URL → Korean canonical) |
| `noindex` | reliably blocks indexing | that URL will never appear in search results at all |

For a page with no English translation, `noindex` is the right call. It's a clear signal: "this page isn't ready yet." Once English content is added later, just remove the `noindex`.

---

## Scope of application, summarized

| Page | x-default | noindex |
|--------|-----------|---------|
| Home (`/[locale]`) | ✅ added | ❌ not needed (has English content) |
| Post list | ✅ added | ❌ not needed |
| about | ✅ added | ❌ not needed |
| contact | ✅ added | ❌ not needed |
| Post detail (isFallback) | ✅ added | ✅ added |
| Post detail (normal) | ✅ added | ❌ not needed |

---

## Summary

```
Google Search Console: /ko duplicate page error
    ↓
Cause 1: missing x-default hreflang
        → Google arbitrarily chose canonical between /ko and /en
Cause 2: isFallback posts had no noindex
        → Korean content on an /en URL → flagged as duplicate
    ↓
Fix:
  All pages → add "x-default": /ko
  isFallback posts → robots: { index: false, follow: false }
    ↓
Request re-inspection in Google Search Console → resolves within days
```

When building a multilingual Next.js blog, `x-default` is an easy thing to forget in your hreflang setup. It's tempting to think just `ko` and `en` are enough, but without `x-default`, Google has no way of knowing which one is actually the default.
