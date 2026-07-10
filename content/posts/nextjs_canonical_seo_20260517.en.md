---
title: 'What Happens When You Forget Canonical on a Next.js Multilingual Blog'
date: '2026-05-17'
publish_date: '2026-06-08'
description: Why Google Search Console flagged "Duplicate, Google chose different canonical than user" and how to set up canonical correctly in a next-intl environment
tags:
  - NextJS
  - SEO
  - next-intl
  - GoogleSearchConsole
---

Opening Google Search Console, this message was sitting there.

> **Duplicate, Google chose different canonical than user**

Affected pages: `https://backtodev.com/ko`, `https://backtodev.com/ko/contact`

This means "I tried to set the canonical, but Google picked a different one." Turned out the homepage had no canonical tag at all.

---

## The situation

This blog runs Korean and English separately via `next-intl`. The URL structure looks like this.

```
https://backtodev.com/ko    ← Korean home
https://backtodev.com/en    ← English home
```

Visiting the root `/` gets auto-detected by `next-intl` and redirected to `/ko` or `/en`.

From Google's perspective:
- Crawls `/` → gets redirected to `/ko`
- Also crawls `/ko` separately
- Both have the same content, but with no canonical, it's confused about "which of these is the standard?"

---

## Tracing the cause

Checking which pages had a canonical tag, I found it present on post detail pages, the posts list, about, portfolio — but **missing only on the homepage.**

```
app/
  [locale]/
    page.tsx         ← ❌ no generateMetadata (home)
    contact/
      page.tsx       ← ⚠️ has canonical, but description is hardcoded English
    posts/
      page.tsx       ← ✅ has canonical
    about/
      page.tsx       ← ✅ has canonical
```

In Next.js App Router, a canonical tag is only auto-attached as `<link rel="canonical">` if you set `alternates.canonical` inside `generateMetadata`. Without it, no canonical tag ends up in the HTML at all.

---

## The fix

### Step 1 — Add generateMetadata to the homepage

```tsx
// app/[locale]/page.tsx
import type { Metadata } from "next";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";

  return {
    title: isKo ? "backtodev — 다시 개발자로" : "backtodev — Back to Dev",
    description: isKo
      ? "40대 PM이 다시 개발자로 돌아오는 기록. 실패하고 배우며 성장하는 이야기."
      : "A 40-something PM returning to development. Notes on learning, building, and shipping.",
    alternates: {
      canonical: `${BASE_URL}/${locale}`,   // the key part
      languages: {
        ko: `${BASE_URL}/ko`,
        en: `${BASE_URL}/en`,
      },
    },
  };
}
```

Setting `alternates.canonical` makes Next.js automatically insert these tags into `<head>`.

```html
<link rel="canonical" href="https://backtodev.com/ko" />
<link rel="alternate" hrefLang="ko" href="https://backtodev.com/ko" />
<link rel="alternate" hrefLang="en" href="https://backtodev.com/en" />
```

The `hrefLang` alternates tell Google "here's where the other language version of this page lives." It helps reduce duplicate-content signals on a multilingual site.

### Step 2 — Separate the contact page's description

The contact page had a canonical, but its description was hardcoded to English.

```tsx
// Before
description: "Get in touch with backtodev.",

// After
const isKo = locale === "ko";
description: isKo ? "backtodev에 연락하기" : "Get in touch with backtodev",
```

On a page showing different content per language at the same URL, an identical description on top of that can read as another duplicate signal to Google. It sounds trivial, but these small details add up on a multilingual site.

---

## Verifying after deployment

After building and deploying, you can confirm this in the actual HTML.

```bash
curl -s "https://backtodev.com/ko" | grep -i "canonical\|hrefLang"
```

```html
<link rel="canonical" href="https://backtodev.com/ko"/>
<link rel="alternate" hrefLang="ko" href="https://backtodev.com/ko"/>
<link rel="alternate" hrefLang="en" href="https://backtodev.com/en"/>
```

This output means it's working correctly.

In Search Console, using **URL Inspection → Request Indexing** on the affected URL gets Google to re-crawl faster. It typically takes anywhere from a few days to a few weeks for the error to clear.

---

## Canonical checklist for a next-intl multilingual site

| Page | canonical | hreflang | separate description |
|--------|-----------|----------|-----------------|
| Home (`/[locale]`) | ✅ Required | ✅ Required | ✅ Recommended |
| List (`/[locale]/posts`) | ✅ Required | ✅ Required | ✅ Recommended |
| Detail (`/[locale]/posts/[slug]`) | ✅ Required | ✅ Required | — (automatic per post) |
| Static pages (about, contact) | ✅ Required | ✅ Required | ✅ Recommended |

Worth running through this table once to check nothing's missing.

---

## Troubleshooting

**I added `generateMetadata`, but the canonical tag still doesn't show up**

Check whether you're properly awaiting `locale` from `params`. In App Router, `params` is a Promise, so it needs `await`.

```tsx
// Wrong
export async function generateMetadata({ params }) {
  const locale = params.locale  // ❌ didn't await the Promise
}

// Correct
export async function generateMetadata({ params }) {
  const { locale } = await params  // ✅
}
```

**I'm getting locale via `getLocale()`, but I can't use it in generateMetadata**

`getLocale()` only works inside server components. In `generateMetadata`, you must get the locale from `params`.

---

## Summary

```
Problem: homepage was missing generateMetadata
        ↓
  no canonical tag
        ↓
  Google treats / and /ko as duplicates
        ↓
  "Duplicate, Google chose different canonical than user" error

Fix: add generateMetadata
  → set alternates.canonical
  → handle hreflang at the same time via alternates.languages
```

It's common to focus SEO effort on post detail pages while missing the home or list pages. On a multilingual site especially, every single route needs to be checked without exception.
