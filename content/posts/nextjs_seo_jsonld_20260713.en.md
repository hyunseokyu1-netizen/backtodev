---
title: 'Next.js SEO Beyond robots.txt and sitemap — Filling In canonical and JSON-LD Properly'
date: '2026-07-13'
publish_date: '2026-11-26'
description: Adding canonical URLs and JSON-LD structured data with the Next.js App Router Metadata API, then verifying every bit of it with curl
tags:
  - Next.js
  - SEO
  - JSON-LD
  - Metadata API
---

## robots.txt and sitemap Are Only Half the Job

It's been a while since I put the SEO basics into my side project MatchDa. `robots.ts` splits out where crawlers are blocked and where they're allowed, `sitemap.ts` registers the public pages, and `opengraph-image.tsx` makes the KakaoTalk/Slack share previews work. At this point it's tempting to say "I did SEO" — but really this is just **the bare minimum for getting a crawler onto the site.**

How a crawler that's already in "understands" a page's content is a different problem. Today I filled in the next step — **canonical URLs** and **JSON-LD structured data.** These two are the mechanisms that explicitly tell a search engine "this page is the authoritative one" and "this page is this kind of thing."

## canonical URL — "This Address Is the Real One"

When the same content is reachable through multiple URLs (say, `/pricing` and `/pricing?ref=abc`), search engines can mistake this for duplicate content and split the ranking between them. `<link rel="canonical">` is the tag that pins down "of all these URLs, this one is the representative."

In the Next.js Metadata API, you just add one line to each page's `metadata` export.

```ts
// src/app/about/page.tsx
export const metadata: Metadata = {
  title: '서비스 소개',
  description: '...',
  alternates: { canonical: '/about' },  // 이 한 줄
}
```

If `metadataBase` is set on the root layout, the relative path (`/about`) automatically gets combined into the absolute URL (`https://matchda.com/about`).

```ts
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://matchda.com'),
  alternates: { canonical: '/' },
  // ...
}
```

Pages that require login (dashboard, workspace, etc.) are already blocked from crawling in `robots.ts`, so they don't need a canonical at all. Just adding it to **the 6-7 public pages** is enough.

## JSON-LD — "This Page Is This Kind of Thing"

Search engines read the HTML and guess at the content one way or another, but there's a standard way to help that guess along. If you embed data formatted to the [schema.org](https://schema.org) vocabulary inside a `<script type="application/ld+json">` tag, Google uses it as the basis for rich results (star ratings, pricing, organization logos, and so on).

### Organization + WebSite — Common to Every Page

I added two of these to the root layout. One is for the company itself ("there is an organization called MatchDa"), the other is for the website itself ("this URL is that website").

```tsx
// src/app/layout.tsx
const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MatchDa',
  alternateName: '매치다',
  url: SITE_URL,
  logo: `${SITE_URL}/matchda-mark.png`,
  description: DEFAULT_DESCRIPTION,
}

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MatchDa',
  url: SITE_URL,
  inLanguage: 'ko-KR',
}
```

Rendering just drops the JSON straight in with `dangerouslySetInnerHTML` inside `<body>`.

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
/>
```

Seeing `dangerouslySetInnerHTML` should make you reflexively suspect XSS. Always check **whether what you're serializing is a static constant, or whether even a single grain of user input or DB value has snuck in.** This case is safe because it's entirely hardcoded constants, but if a user nickname or review text ever ended up in there, the story would be completely different.

### What I Left Out — SearchAction

The WebSite schema has a field called `potentialAction: SearchAction` that announces support for site-wide search. Adding it is a nice feature where a search box shows up right under the site name in Google search results. But I didn't add it.

The reason is simple: **my service doesn't have that search.** MatchDa only lets you search job postings from "the company I registered" after logging in, so planting a schema that pretends there's a global search endpoint would be promising a search engine a feature that doesn't actually exist. If a user clicks that search box and doesn't get the result they expected, whatever you gained in SEO you lose right back in UX.

This is actually an extension of a lesson I learned a few days ago while auditing this project's landing page from a new user's perspective. Back then I fixed a landing hero search bar that promised "search job postings worldwide" while actually returning nothing but empty results. **The same principle applies to structured data. Whether it's a promise made to a search engine or to a user, you should only say what's actually true.**

### Product + Offer — Pricing Rich Snippets, and a Sync Problem

I added a `Product`/`Offer` schema announcing pricing to the pricing page. With this in place, a price like "from $7.99" can show up as a snippet in Google search results.

```ts
const PRICING_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'MatchDa 프리미엄',
  offers: [
    { '@type': 'Offer', name: '무료', price: '0', priceCurrency: 'USD' },
    {
      '@type': 'Offer',
      name: '프리미엄',
      price: PREMIUM_PRICE_NUMBER,
      priceCurrency: 'USD',
      priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' },
    },
  ],
}
```

One thing tripped me up here. The price text shown on screen is the **human-readable string** `PREMIUM_PRICE_LABEL = '$7.99 / 월'`, while JSON-LD's `price` needs to be **just a number.** If I hardcode that as a separate new constant, there's a real risk that later when I raise the price, I'll update the display text and forget the JSON-LD. (Picture a $7.99 service whose search results keep showing the old price forever.)

So instead of creating a new numeric constant, I **pulled just the number out of the existing display text with a regex.**

```ts
// PREMIUM_PRICE_LABEL("$7.99 / 월")에서 숫자만 추출 — 표시 가격과 항상 동기화됨
const PREMIUM_PRICE_NUMBER = PREMIUM_PRICE_LABEL.match(/[\d.]+/)?.[0] ?? '7.99'
```

This is a single source of truth approach. I'm aware the `?? '7.99'` fallback carries the risk of silently falling back to the old price if the regex fails to match (say, the text format changes entirely) — not a perfect solution, but I judged it better than creating yet another constant and adding one more sync point.

I also paid attention to currency. On screen, the free plan shows "₩0" and premium shows "$7.99" — different currency symbols (it seems like it shouldn't matter since it's zero either way) — but if `priceCurrency` differs between offers inside the same `Product`'s `offers` array, Google's rich results validator throws a warning. Zero is zero in any currency, so I just set both to `USD`.

### Conditional Fields — Don't Send a Field That Has No Value

Naver Search Advisor ownership verification requires putting a verification code in a meta tag, and that code only gets issued once you register the site with Naver Search Advisor. I don't have it yet. Leaving an empty string in there risks me forgetting to fill it in later, and a tag with no actual code behind it is meaningless to begin with.

```ts
// 값이 있을 때만 verification 필드 자체를 생성 (스프레드 조건부)
...(process.env.NAVER_SITE_VERIFICATION && {
  verification: { other: { 'naver-site-verification': process.env.NAVER_SITE_VERIFICATION } },
}),
```

If there's no value, the `verification` key itself never gets created on the metadata object. Later, just adding `NAVER_SITE_VERIFICATION` to the Vercel environment variables and redeploying brings it to life automatically. **Rather than filling a missing value with an empty string, not creating the field at all** cuts down on future mistakes.

## Verification — Checking Directly with curl

Instead of trusting that the Metadata API would render everything correctly and moving on, I spun up a production build locally and checked the actual responses.

```bash
npx next build && npx next start -p 3457 &

# canonical 태그 확인
curl -s http://localhost:3457/about | grep -o '<link rel="canonical"[^>]*>'
# → <link rel="canonical" href="https://matchda.com/about"/>

# JSON-LD 내용 확인
curl -s http://localhost:3457/ | grep -o '<script type="application/ld+json">[^<]*</script>'
# → Organization, WebSite 스크립트 태그 두 개가 실제로 찍히는지 확인

# 요금제 페이지의 가격 구조화 데이터 확인
curl -s http://localhost:3457/pricing | grep -o '"@type":"[A-Za-z]*"'
# → Product, Offer, Offer, UnitPriceSpecification

# 네이버 인증 태그가 (아직 값이 없으니) 안 뜨는지 확인
curl -s http://localhost:3457/ | grep -o 'naver-site-verification[^/]*'
# → 아무것도 안 나오면 정상
```

A successful build with no type errors is no guarantee the meta tags come out with the values you wanted. Forget to set `metadataBase` and the canonical goes out as a bare relative path; get the inheritance order wrong and a per-page setting commonly gets overwritten by the layout default. **One line of curl to see the actual HTML with your own eyes is the fastest way to check.**

## Wrap-Up — The SEO Basics Checklist

Once robots.txt, sitemap, and OG images are done, this much covers what comes next.

| Item | Role | Next.js implementation |
|---|---|---|
| canonical | Resolving duplicate URLs | `metadata.alternates.canonical` on each page |
| Organization JSON-LD | Brand/logo recognition | A static script tag in the layout |
| WebSite JSON-LD | Site identification | A static script tag in the layout (SearchAction only when the feature actually exists) |
| Product/Offer JSON-LD | Pricing rich snippets | Derived from the displayed price to stay in sync |
| Conditional verification | Per-search-engine ownership confirmation | Field only created when the environment variable exists |

If I keep just one common principle: **structured data is code too.** Don't let hardcoded values drift apart from the display text, don't promise a feature in the schema that doesn't actually exist, and once you've built it, go verify it with your own eyes.
