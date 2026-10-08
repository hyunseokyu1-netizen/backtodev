---
title: "Rejected by AdSense for the 4th Time: Diagnosing My Own 'Low Value Content' Problem Like a Reviewer Would"
date: '2026-07-19'
publish_date: '2026-12-23'
description: Why Google AdSense rejected this 130+ post blog four times in a row for low value content, and the full fix — noindexing 130 auto-translated pages, reclassifying 21 thin posts, and cleaning up redirects and the sitemap
tags:
  - AdSense
  - SEO
  - Next.js
  - noindex
  - Blog Operations
---

## The 4th Rejection Email Arrived

This blog just got rejected by Google AdSense for the 4th time.

The reason was the same every time — **"Low value content."**

Honestly, I felt wronged. Over 130 posts, every single one written from my own actual development experience. Not scraped, not copied from anywhere — how can that have no value?

But after the 4th rejection, I changed my approach. Instead of feeling wronged, I decided to tear the blog apart from scratch, asking: **if I were the AdSense reviewer, how would I see this site?**

Cutting to the conclusion first — looking at it from the reviewer's side, rejecting it made sense. This post is the full record of that diagnosis and the fix that followed.

## Step 1. Actually Reading the Policy Docs Linked From the Rejection

The rejection screen links to 4 reference docs. Normally you just go "yeah, yeah, got it" and move on, but this time I followed every one of them. That's how I ran into this line in Google's spam policy, under "scaled content abuse":

> "Using automated transformations — such as synonym analysis, translation, or other obfuscation techniques — to scrape feeds, search results, or other content and generate a large number of pages that provide little value to users"

Reading that stung. This blog is set up so that writing a post in Korean triggers the DeepL API to auto-generate an English version. No human review. And that was **130 pages**.

## Step 2. Looking at the Site's Real State Through a Reviewer's Eyes

After reading the policy, I checked the site in actual numbers.

### Problem 1 — Half the Site Is Machine Translation

| Item | Count |
|------|------|
| Total post pages | 262 |
| Korean (written by hand) | 132 |
| English (auto-translated, unreviewed) | 130 |

**About 50% of all pages were auto-generated content.** I thought of it as "a blog with 132 posts," but in Google's eyes it was "a site that's half machine translation."

What made it worse was the middleware config. I had it set to auto-redirect to `/en` whenever the browser language wasn't Korean — which meant **a review system accessing from the US in an English browser environment would see nothing but the machine-translated version, from the very first screen onward.** I had effectively put my weakest content on the front door.

### Problem 2 — Thin Posts

I did a full audit of body character counts, excluding frontmatter.

```bash
for f in *.ko.md; do
  chars=$(awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2{print}' "$f" | wc -m)
  echo "$chars $f"
done | sort -n
```

| Metric | Value |
|------|-----|
| Median | ~4,000 characters |
| Average | ~4,200 characters |
| **Under 1,500 characters** | **21 posts** |
| Minimum | 435 characters |

The median wasn't bad, but the tail was the problem. A 400-character post like "hey, free credits!", posts that split the same event into 3 separate 700-character pieces. The odds of a reviewer landing on one of these by randomly clicking something in the post list weren't low.

## Step 3. The Fix

### 3-1. The 130 Auto-Translated English Pages → noindex + Excluded From the Sitemap

I didn't delete the English versions. Visitors can still view them via the EN button. Instead, **I took them out of what Google evaluates.**

In the Next.js App Router, there are three places to fix.

**① noindex in page metadata** (`generateMetadata`):

```tsx
// 영어 페이지는 자동 번역(검수 없음)이라 색인 제외
...(locale !== "ko" && { robots: { index: false, follow: true } }),
```

**② Remove English URLs from the sitemap** (`app/sitemap.ts`):

```tsx
// 사이트맵에는 색인 대상인 한국어 페이지만 노출
const koPosts = await getAllPosts("ko");
const postEntries = koPosts
  .filter((p) => !p.isFallback && !p.noindex)
  .map((post) => ({ url: `${BASE_URL}/ko/posts/${post.slug}`, ... }));
```

**③ Remove hreflang**: I deleted the `en` link from `alternates.languages` on the Korean pages. That tag used to advertise "here's my English version" from the Korean page.

Google itself recommends "exclude it from Search" as the response to this kind of content. noindex is exactly that official method.

### 3-2. The 21 Thin Posts — Classified Instead of Deleted

I read through all 21 posts under 1,500 characters one by one and split them into three buckets.

| Bucket | Count | Criteria | Treatment |
|------|------|------|------|
| noindex | 4 posts | Promotions, past events, non-dev chatter | Kept the post, excluded from indexing only |
| Merged | 9 → 3 posts | Same event/topic split across multiple posts | Combined chronologically into a new post |
| Expanded | 9 posts | Useful info but too short | Expanded with tables, commands, and context |

**noindex was handled via frontmatter.** One line added to the post file:

```yaml
---
title: '...'
noindex: true
---
```

And read in metadata generation:

```tsx
const noindex = post.isFallback || locale !== "ko" || post.noindex;
```

Why I didn't delete them: the early posts (the first post, essays) are part of the blog's identity, and I wanted to keep them. With noindex, they still show up on the site as-is, they're just excluded from review/search signals.

**Example of a merge**: a 3-part story (each 700-1,100 characters) about an AI model getting stuck, then me pushing through to the last day, then the extended aftermath — I merged it into a single post told in chronological 3-act structure. Merging it actually gave it a narrative, and the post got better for it.

**Example of an expansion**: a 468-character post that basically said "lol, turns out Supabase Free only gives you 2 projects" — I turned it into something actually useful by adding a table of free-tier limits, the real constraints you hit first (project count, auto-pause), and tips for running on the free tier long-term.

### 3-3. 308 Redirects for URLs That Disappeared Into Merges

If the 8 original URLs that got merged away all turn into 404s, that's its own quality signal problem. I added redirects to `next.config.ts`.

```tsx
async redirects() {
  return [
    {
      source: "/:locale(ko|en)/posts/myLastDayUsingFable5_20260711",
      destination: "/:locale/posts/fable5_rollercoaster_20260715",
      permanent: true, // 308
    },
    // ... 옛 슬러그 전부
  ];
}
```

## Step 4. Verification — Confirming Against the Actual Rendered Output

After building, I spun up the production server and checked everything with curl.

```bash
# 영어 페이지에 noindex가 실제로 박혔는지
curl -s localhost:3000/en | grep -o '<meta name="robots"[^>]*>'
# → <meta name="robots" content="noindex, follow"/>

# 한국어 일반 글에는 없어야 정상
curl -s localhost:3000/ko/posts/일반글 | grep robots
# → (없음) ✅

# sitemap에 en URL이 0개인지
curl -s localhost:3000/sitemap.xml | grep -c "/en/"   # → 0

# 옛 슬러그가 새 글로 넘어가는지
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
  localhost:3000/ko/posts/myLastDayUsingFable5_20260711
# → 308 -> .../fable5_rollercoaster_20260715
```

A meta tag being fixed in code and actually being live can be two different things, so skipping this verification step isn't an option.

## Wrap-up — What I Learned This Time

1. **"Low value content" isn't a word-count problem.** I got rejected despite 132 posts. Review happens at the site level, and if half your pages are auto-generated, the other half's quality can't cover for it.
2. **Read the policy docs the rejection links to, in the original.** Until I read the phrase "automated transformations (including translation)," I hadn't even considered that the English version was the problem.
3. **An auto-translated multilingual blog is a double-edged sword for AdSense.** Translation itself isn't banned, but unreviewed plus at scale lands squarely in the policy wording. If you can't review it, noindex is the honest choice.
4. **Short posts can be handled by picking from delete/merge/expand/noindex.** You don't have to delete everything. For posts you want to keep as a record, noindex is a middle ground.
5. **Don't rush the re-review.** Request a review right after making changes and Google might review you on the state before it re-crawls. Waiting 1-2 weeks before requesting is safer.

The re-review result isn't in yet. If it passes, I'll write a follow-up. If it fails again... I'll record that too. That's just what this blog is.
