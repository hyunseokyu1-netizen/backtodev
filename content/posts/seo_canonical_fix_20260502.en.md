---
title: 'Why Google Ignored My Blog - 2 Next.js SEO Bug Fixes'
date: '2026-05-02'
publish_date: '2026-05-26'
description: How I discovered a missing index in Google Search Console and fixed the canonical tag and footer 404 links.
tags:
  - Next.js
  - seo
  - canonical
  - i18n
  - Google Search Console
---

After creating my blog, I opened up Google Search Console, which I had forgotten about for a while, and was pretty upset. I realized that the pages I had worked so hard to create were either not indexed at all, or were categorized as "duplicate pages".

When I looked for the cause, I realized there were two problems. Neither of these were immediately obvious bugs in the code, so today I'm going to summarize how I found and fixed them.

---

## For those who don't know what canonical is.

When the same content is accessible from multiple URLs, the canonical tag tells Google "this is the canonical URL for this page" so that the correct URL is indexed without confusion. In Next.js, we set it to `alternates.canonical` in `generateMetadata`.

> The concept of canonical and how to configure it in the next-intl environment is covered in more depth in a [follow-up post](../nextjs_canonical_seo_20260517).

---

## Bug 1: footer links were giving 404s

### Problem

This blog is multilingual, so the URL structure is `/[locale]/page`. For example, `/en/about`, `/en/posts` and so on.

But when I look at the footer code:

```tsx
// before
<a href="/contact">Contact</a>
<a href="/privacy">Privacy Policy</a>
```

It was hardcoded to `/contact`. The actual page is `/en/contact`, but when you go to `/contact`, you get a 404.

If a Google bot clicked on the footer link, it was all 404. It was the worst situation from a crawling perspective.

### Fixed

The layout component was already taking `locale`, so we just needed to dynamically concatenate it.

```tsx
// after
<a href={`/${locale}/contact`}>Contact</a>
<a href={`/${locale}/privacy`}>Privacy Policy</a>
```

It's a simple fix, but without it, a Google bot might think, "Wow, I hit the Contact link and got a 404. Doesn't that mean you don't manage this site?"

---

## Bug 2: canonical in layout was making all pages the "homepage"

### Problem

We had metadata for the entire layout in `app/[locale]/layout.tsx`, and canonical was already set there.

```tsx
// layout.tsx (canonical)
export const metadata: Metadata = {
  alternates: {
    canonical: "https://backtodev.com", // Homepage URL
  },
};
```

Next.js will inherit the metadata from the layout if there is no `generateMetadata` on the child page. So the `about`, `posts`, `contact`, and `privacy` pages were all exporting the homepage URL as canonical instead of their own canonical URLs.

From Google's perspective

| Page URL | Exported canonical |
|---|---|
| `/en/about` | `https://backtodev.com` (homepage!) |
| `/en/posts` | `https://backtodev.com` (homepage!) |
| `/en/contact` | `https://backtodev.com` (homepage!) |

"These pages are all about the same thing as the homepage" - if Google thinks this, they will be deindexed or categorized as duplicate pages.

### Fix

Added `generateMetadata` to each page to specify the correct canonical URL. The reason for using the `generateMetadata` function instead of the `export const metadata` method is that the URL needs to include the locale, so it needs to be generated dynamically.

```tsx
// app/[locale]/about/page.tsx
import type { Metadata } from "next";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `${BASE_URL}/${locale}/about`,
      languages: {
        en: `${BASE_URL}/en/about`,
        en: `${BASE_URL}/en/about`,
      },
    },
  };
}
```

The `languages` field is the `hreflang` setting that tells Google the multilingual alternate URL. It tells Google, "The Korean version is `/ko/about` and the English version is `/en/about`". If you include this, Google will serve the appropriate version for each language in the search results.

I applied the same pattern to the `posts`, `contact`, and `privacy` pages.

---

## Summary of modification results

| Separated | Before Fix | After Fix |
|---|---|---|
| footer Contact link | `/contact` (404) | `/${locale}/contact` |
| footer Privacy link | `/privacy` (404) | `/${locale}/privacy` |
| about page canonical | inherit homepage URL | `/en/about` or `/en/about` |
| posts page canonical | inherits homepage URL | `/en/posts` or `/en/posts` |
| contact page canonical | inherits homepage URL | `/en/contact` or `/en/contact` |
| privacy page canonical | inherits homepage URL | `/en/privacy` or `/en/privacy` |

---

## Troubleshooting - `export const metadata` vs `generateMetadata`

The `export const metadata` is a static object, so you cannot use dynamic values like `locale`. If the URL contains a locale, you must use the `generateMetadata` function. Note that you need to `await` for the locale in `params`. For more information, see [follow-up post](../nextjs_canonical_seo_20260517).

---

## Cleanup

The key to this fix was twofold

1. hardcoded paths are dangerous on multilingual sites - even if a single `/contact` is throwing 404s, it's not easy to spot during development. You should always use locale-aware paths.

2. metadata from the layout is inherited by child pages. If each page doesn't specify its own canonical, it will inherit the canonical from the layout. For proper multilingual SEO in Next.js, it's safer to specify your own canonical with `generateMetadata` for each page.

Google Search Console is much more useful than you might think for finding these SEO issues. If you haven't already done so, I recommend connecting it as soon as you publish your blog.
