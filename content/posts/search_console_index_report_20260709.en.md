---
title: "Search Console's Excluded-From-Index Report — Not Everything Needs Fixing"
date: '2026-07-09'
publish_date: '2026-07-16'
description: Diagnosing 7 exclusion categories on a multilingual Next.js blog's Search Console report, one by one, separating what needs fixing from what should be left alone
tags:
  - Search Console
  - SEO
  - Next.js
  - i18n
---

## I opened the index report and it was all "Failed"

To check my blog's SEO health, I opened Google Search Console's **"Why pages aren't getting indexed"** report. The screen looked concerning.

- Duplicate, Google chose a different canonical than the user — **6 items, Failed**
- Page with redirect — 2 items, Failed
- Crawled, currently not indexed — 8 items, Failed
- Not found (404) — 4 items
- Redirect error — 1 item
- ...

A string of red "Failed" markers made it look like something serious had gone wrong. But picking through them one by one, **most were fine, and there wasn't a single line of code that actually needed fixing.** This post is a record of that diagnostic process. To anyone scared by the same report — I want to show that "red light ≠ bug."

## Premise: my blog's structure

First, the structure of my blog (backtodev), which is the basis for this diagnosis. What counts as "normal" depends on this.

- **Next.js + next-intl multilingual** — every page exists as a `/ko/...`, `/en/...` pair
- Visiting a prefix-less URL (`/posts/foo`) **auto-redirects based on browser language**
- Posts without an English translation fall back to Korean (marked `noindex` in that case)
- A history of creating and deleting a few test posts early in the blog's life

## Diagnosing each category — fix vs. leave alone

Here's how I judged all 7 categories, one by one.

| Category | Count | Verdict | Reason |
|------|------|------|------|
| Page with redirect | 2 | ✅ Normal | intentional automatic locale redirect |
| Duplicate, Google chose a different canonical | 1 | ✅ Normal | Google grouped the fallback page under ko |
| Not found (404) | 4 | ✅ Normal | deleted test posts |
| Discovered - not indexed | 0 | ✅ Ignore | 0 items |
| Crawled - not indexed | 8 | ⏳ Wait | young blog, time solves it |
| Duplicate, Google chose different canonical than user | 6 | 🔍 Investigate | ↓ see the twist below |
| Redirect error | 1 | 🔍 Investigate | just 1, lower priority |

### ✅ "Page with redirect" — structurally expected

A prefix-less URL like `/posts/foo` gets redirected by middleware to `/ko/posts/foo`. From Google's perspective, this URL is "a page with no content that sends you elsewhere," so it's **correct** not to index it. The actual content gets indexed at `/ko/...`, `/en/...`. Showing up here isn't a problem — it's evidence the design is working as intended.

### ✅ "Not found (404)" — check which URLs first

Before getting scared by 404s, the first move is to **click into the row and check the URL list.** In my case, all 4 were test posts like `hello-world`, created and deleted early in the blog's setup. A deleted page returning 404 is **correct behavior**, and Google removes it from the list on its own after a few re-checks.

If a page that **should still be alive** shows up here, that's when it's a genuine problem. The judgment criterion is simple: "should this URL still exist right now?"

### ⏳ "Crawled - currently not indexed" — the domain of patience

This means Google read the page but hasn't indexed it yet. Very common on young sites. As site trust accumulates, it gets indexed gradually. Especially for someone like me who **publishes a burst of posts in a short period** (one post a day via scheduled publishing), it takes Google time to digest them. Nothing to act on. Steadily accumulating content is the only answer.

## The twist: tracking down the culprit behind "6 duplicate pages"

The real problem was **the 6 items under "Duplicate, Google chose different canonical than user."** On a multilingual site, this category is usually interpreted like this.

> The ko/en pages have no marker (hreflang) indicating they're translations of each other, so Google sees them as "similar duplicate documents."

"Ah, I must have skipped hreflang!" — I was about to fix the code right away. But out of habit, **I checked the current code before fixing anything**... and there was a twist.

```ts
// app/[locale]/posts/[slug]/page.tsx — it was already all there
alternates: {
  canonical: canonicalUrl,          // ✅ canonical
  languages: {                      // ✅ hreflang
    ko: `${BASE_URL}/ko/posts/${slug}`,
    en: `${BASE_URL}/en/posts/${slug}`,
    "x-default": `${BASE_URL}/ko/posts/${slug}`,
  },
},
// even noindex on fallback pages     // ✅
...(post.isFallback && { robots: { index: false, follow: false } }),
```

**canonical, hreflang, noindex — all of it was already implemented.** Added a month ago during an SEO fix. So why were 6 items showing up in the report?

The answer is **crawl timing.** Search Console's report isn't real-time. Those 6 items were **leftover records crawled before the fix was deployed.** The "Failed" marker is just a history of a past validation failing — it doesn't mean the current code is wrong.

### So what I actually did: 0 lines of code changed, 1 button click

In the end, what I needed to do wasn't touch the code — just click **"Validate Fix"** in Search Console. Once Google re-crawls and sees the current code (with hreflang/canonical applied), it resolves. If it's still there in 1–2 weeks, that's when it's worth digging in again.

## The diagnostic order I took away from this

Approaching an index report in this order cuts down on wasted effort.

1. **Judge each category by "is this normal given my site's structure" first** — I'm the only one who knows the redirect/locale structure. Google just lists facts.
2. **Check the actual URL list directly** — whether it's a 404 or a duplicate, you need to click the row and see the real URL before you can judge it.
3. **Check the current code before fixing anything** — the report is based on a past crawl. The problem may already be fixed.
4. **If you fixed it (or it was already fixed), click "Validate Fix"** — skip this, and "Failed" just lingers.
5. **Have patience with "Crawled - not indexed"** — a rite of passage for a young site.

## Summary

- Search Console's red "Failed" is **an observational record, not a bug list**
- On a multilingual site, **redirect pages and fallback duplicates** are structurally expected to show up
- For a 404, **check the URL** — it's fine if it's "a page that should be dead"
- The report reflects **a past crawl point in time** — check the current code before fixing anything
- Items already resolved only disappear once you click **"Validate Fix"**

The biggest thing I learned here wasn't SEO knowledge — it was diagnostic attitude. If I'd fixed the code the instant I saw the red light in the report, I would've double-touched a perfectly working hreflang setup and probably tangled it up instead. **"Before fixing, check the current state first"** — the basics of debugging held up exactly the same way in SEO too.
