---
title: '335 Pages Invisible to Search Engines — Building SEO Foundations for a Side Project'
date: '2026-07-13'
publish_date: '2026-11-25'
description: When the room list is a client-side fetch, crawlers never find the links — notes from building SEO foundations with Next.js robots.ts/sitemap.ts conventions, noindex for time-limited pages, and JSON-LD
tags:
  - SEO
  - Next.js
  - sitemap
  - JSON-LD
  - Structured Data
---

I'd connected a custom domain, made the OG images look nice — now all that was left was getting found in search. So I checked:

```bash
curl https://nogari.org/robots.txt    # → 404 페이지
curl https://nogari.org/sitemap.xml   # → 404
```

**Neither one existed.** What came next was worse. My side project has 335 rooms (boards) — I'd seeded 300 of them with National Assembly members — and I realized there was **no way at all** for a crawler to reach any of those 335 pages.

## Why Crawlers Can't Find My Content

The room list looks fine on the home screen. But that list is drawn by a client component doing `fetch("/api/topics/...")`. The HTML a crawler actually receives has **no `<a>` tags pointing to any room.**

Search engines basically index pages through two paths:

1. Follow links found in the HTML of pages they already know about
2. Visit URLs listed in the sitemap

Path 1 is blocked (the links only appear after JS runs), and without a sitemap for path 2, the room detail pages are **completely unknown to exist.** And that's a shame, because the room detail pages are SSR'd — even the comments come baked into the HTML — so they'd actually do well if indexed. This is where I learned the hard way that **discoverability** comes before the SEO quality of any individual page.

## Step 1 — robots.ts: One File and Done

In the Next.js App Router, creating `app/robots.ts` auto-generates `/robots.txt`:

```ts
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],   // 관리자·API는 크롤링 제외
    },
    sitemap: "https://nogari.org/sitemap.xml",
  };
}
```

Crawling still works even with no robots.txt at all, but it's the standard channel for pointing to the sitemap location, and it's at least minimal traffic control for keeping crawlers out of places like the admin pages — so it's worth having.

## Step 2 — sitemap.ts: Dynamically Generating URLs from the DB

This is the key part. `app/sitemap.ts` can query the DB and build the sitemap dynamically:

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = "https://nogari.org";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/proposals`, changeFrequency: "daily", priority: 0.6 },
  ];

  const admin = createAdminClient();
  const { data: topics } = await admin
    .from("topics")
    .select("id, last_comment_at, activated_at")
    .eq("status", "ACTIVE")            // 살아있는 방만
    .order("last_comment_at", { ascending: false, nullsFirst: false })
    .limit(5000);

  const topicPages = (topics ?? []).map((t) => ({
    url: `${BASE_URL}/topics/${t.id}`,
    lastModified: t.last_comment_at ?? t.activated_at ?? undefined,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...topicPages];
}
```

Points worth noting:

- I put **the latest comment's timestamp into `lastModified`.** In a community, "when was this page last updated" is basically the same question as "when was the last conversation here." This makes crawlers revisit active rooms more often.
- I only include **ACTIVE rooms.** More on why in Step 3.

Open `/sitemap.xml` after deploying and all 335 URLs are listed, plain and simple. The moment this file exists, every room that had been hiding behind client-side rendering effectively "reports its existence" to search engines.

## Step 3 — noindex for Time-Limited Pages: Preventing Soft 404s

My service has an unusual kind of page: rooms **pending creation, which open if 30 people agree within 72 hours and disappear if they don't.** And expired rooms.

What happens if a page like that gets indexed? Someone clicks through from search results and lands on "This room has expired." Google classifies this as a **soft 404**, and if it builds up it hurts the quality evaluation of the entire site. So I split indexing behavior based on status:

```ts
// app/topics/[id]/page.tsx — generateMetadata
return {
  title,
  description,
  alternates: { canonical: `/topics/${id}` },
  // PENDING(72시간 시한부)·EXPIRED는 곧 사라질 페이지 — 색인 금지
  robots: topic.status === "ACTIVE" ? undefined : { index: false },
};
```

It stays shareable (the OG is unchanged) but not indexed. "A link you send a friend" and "a page that lives in search results" need to have different lifespans.

I also added `canonical`. If you use Vercel like I do, the same page also opens at `your-project-name.vercel.app` — and without a canonical, search engines can treat the two addresses as separate pages and split the ranking signal between them.

## Step 4 — JSON-LD: Telling Search Engines "This Is a Discussion Thread"

Search engines guess "what kind of page is this" just from the HTML, but structured data (JSON-LD) turns that guess into certainty. For community threads, there's a `DiscussionForumPosting` type:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "DiscussionForumPosting",
      headline: `${topic.title} 노가리방`,
      url: `https://nogari.org/topics/${topic.id}`,
      datePublished: topic.activated_at,
      commentCount: comments.length,
      isPartOf: { "@type": "WebSite", name: "노가리", url: "https://nogari.org" },
    }),
  }}
/>
```

Google sometimes surfaces forum and community content in its own dedicated UI (Discussions and forums), so it's well worth adding for any community service. To verify it, just drop the URL into the [Rich Results Test](https://search.google.com/test/rich-results).

## Step 5 — What Code Can't Do: Registering with Search Console

Everything up to here is code's job. The rest is legwork:

| To do | Why |
|---|---|
| Register with [Google Search Console](https://search.google.com/search-console) and submit the sitemap | Waiting without registering delays indexing by weeks. It's also the only place to see indexing status and search query data |
| Register with [Naver Search Advisor](https://searchadvisor.naver.com) | **A must if you're serving Korean users.** Naver carries a lot of weight for searches about people and current events, and it genuinely won't crawl you at all without registration |

Both issue an ownership-verification meta tag, and in Next.js you just drop it into `metadata.verification`:

```ts
export const metadata: Metadata = {
  verification: {
    google: "구글이_준_코드",
    other: { "naver-site-verification": "네이버가_준_코드" },
  },
};
```

## Wrap-Up

1. **Discoverability comes before page quality** — if the list is client-rendered, crawlers can't see the links. The sitemap becomes the only path to indexing
2. **robots.ts / sitemap.ts** — auto-generated from a single file convention; the sitemap can be built dynamically from a DB query
3. **Match lastModified to what "update" means for your service** — for a community, that's the last comment's timestamp
4. **noindex for short-lived pages** — indexing time-limited or expired pages builds up soft 404s
5. **Clean up duplicate addresses with canonical** — especially if you have a vercel.app alias
6. **Declare what a page is with JSON-LD** — DiscussionForumPosting for a community
7. **Registering with Search Console and Naver Search Advisor is mandatory legwork outside of code**

The biggest lesson here: it's easy to think of SEO as meta tags and keywords first, but the real problem on my site was that **the structure made all 335 pages undiscoverable in the first place.** Until I drew the map, those pages might as well not have existed as far as search engines were concerned.
