---
title: 'Should API Costs Scale with Every New User? Building a Shared Scraping Cache and Multi-File Uploads with Supabase Storage'
date: '2026-07-15'
publish_date: '2026-12-02'
description: "A field report on sharing scraping results across users with a Supabase JSONB cache so costs don't grow per user, plus implementing up-to-5-files-per-job uploads with Supabase Storage and signed URLs"
tags:
  - Supabase
  - Next.js
  - Caching
  - Supabase Storage
  - Server Actions
---

## If 100 Users Click the Same Button, Does the Scraping Also Run 100 Times?

My side project MatchDa has a "collect from a featured company" feature. Click a company chip like
Stripe or Anthropic, and it scrapes job postings from that company's careers page and scores them
against my resume.

Looking closely at this setup, I noticed something odd. **If user A collects Stripe, and 10 minutes later
user B clicks the exact same Stripe chip, the whole thing scrapes from scratch again.** Network requests,
sometimes spinning up a headless browser, and AI extraction for generic pages. The structure was paying
the exact same cost, for the exact same data, once per user.

This wasn't a problem when I was the only user. But imagining "what if 10 users all click a popular
company on launch day?" was unsettling. Today's post is about fixing this with a **shared cache**, plus a
companion piece of work: **multi-file uploads** (Supabase Storage + signed URLs).

## Step 1. Cache Design — What Can Be Shared and What Can't

Before bolting on a cache, there's a question to answer first. **"In this pipeline, which data differs
per user, and which data is the same for everyone?"**

Breaking down the collection pipeline:

| Stage | Cost | Does it differ per user? |
|---|---|---|
| ① Scrape the careers page (job title/URL list) | Network, browser, AI extraction (expensive) | **No** — the same result no matter who scrapes it |
| ② Keyword pre-filtering | Free (code-level) | Yes — based on my own skills |
| ③ AI match scoring | Haiku batch (cheap) | Yes — a score based on my resume |

The answer becomes clear. **Only ① goes into the shared cache; ② and ③ stay per-user as they are.**
There's a temptation to cache the match score too, but "how well I fit this posting" is inherently
unshareable data from the start. A cache isn't a universal tool — it should be applied honestly, only to
the segment where "same input → same output" actually holds.

## Step 2. Implementation — One Table, One Function

No need for heavyweight cache infrastructure (Redis, etc.) — a single table in the Supabase (PostgreSQL)
I was already using was enough.

```sql
CREATE TABLE IF NOT EXISTS discover_scrape_cache (
  source_url   TEXT PRIMARY KEY,                    -- 정규화된 채용페이지 URL
  source_type  TEXT NOT NULL DEFAULT 'generic',
  postings     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 공고 목록 통째로
  scraped_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS를 켜고 정책을 안 만들면 = service role(서버)만 접근 가능
ALTER TABLE discover_scrape_cache ENABLE ROW LEVEL SECURITY;
```

Three points worth calling out:

**1) One JSONB blob per row.** Job postings could be normalized into their own rows, but this cache has
exactly one purpose: "reuse the most recent scrape result." One row per URL, the whole array in the
`postings` column. The code ends up dramatically simpler.

**2) RLS on, no policies = a server-only table.** In Supabase, turning on RLS without adding a single
policy means the anon/authenticated keys can't do anything to the table at all. It's the shortest way to
build an internal table that only the service-role client in a server action can touch.

**3) URL normalization.** If the same page gets cached separately as `https://jobs.lever.co/spotify` and
`https://jobs.lever.co/spotify/`, the cache is only half-working. I applied normalization — lowercasing
the host, stripping the trailing slash — to the key.

The read/write logic got wrapped in a single function:

```ts
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 채용공고는 하루 몇 번 안 바뀐다

export async function getPostingsWithCache(sourceUrl: string, sourceType: AtsType) {
  const key = normalizeSourceUrl(sourceUrl)

  // 1) 신선한 캐시가 있으면 그대로 (스크래핑 생략)
  try {
    const { data: hit } = await supabaseAdmin
      .from('discover_scrape_cache')
      .select('postings, scraped_at')
      .eq('source_url', key)
      .maybeSingle()
    if (hit && Date.now() - new Date(hit.scraped_at).getTime() < CACHE_TTL_MS) {
      return { postings: hit.postings, fromCache: true }
    }
  } catch (e) {
    console.error('캐시 읽기 실패 (직접 스크래핑으로 폴백):', e)
  }

  // 2) 미스/만료 → 실제 스크래핑
  const postings = await scrapeJobSource(sourceUrl, sourceType)

  // 3) 캐시 갱신 (베스트 에포트 — 실패해도 결과는 반환)
  try {
    await supabaseAdmin.from('discover_scrape_cache')
      .upsert({ source_url: key, source_type: sourceType, postings, scraped_at: new Date().toISOString() })
  } catch (e) {
    console.error('캐시 쓰기 실패 (무시):', e)
  }

  return { postings, fromCache: false }
}
```

The single most important design decision here is **swallowing every failure in the cache layer with a
try/catch.** A cache is an optimization, not a feature. Whether the table doesn't exist yet (deployed
before the migration ran), or the DB hiccups momentarily, the user should just experience the behavior
from "before there was a cache" — the feature itself must never break. In fact, the code deployment and
the DB migration ended up out of sync by more than a day this time, and this fallback meant it caused
zero problems.

I surfaced `fromCache` in the UI to show "Found 137 postings · 137 added · **Fast collection**." From the
second user onward, people can literally feel the collection finishing in seconds.

## Step 3. Expanding the Presets — Verify with curl Instead of Guessing

With a cache in place, there was now justification for expanding the list of preset companies (the first
person pays the cost either way). While expanding it from 14 to 36, I kept to one principle: **only add
slugs that I've verified actually respond via the public ATS API.**

Greenhouse, Lever, and Ashby all have public JSON APIs, so this is verifiable with a direct curl:

```bash
# greenhouse: 회사 슬러그가 유효하면 공고 배열이 온다
curl -s "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=false"

# lever
curl -s "https://api.lever.co/v0/postings/spotify?mode=json"

# ashby
curl -s "https://api.ashbyhq.com/posting-api/job-board/openai"
```

Running this actually turned up some interesting results. Slugs I was about to add under the assumption
"of course Canva uses Lever" failed one after another:

- `lever/canva` → nothing. Nothing on greenhouse either. Excluded from the presets — they run their own careers site
- `xero` → nothing on lever, but **73 postings on ashby**
- `airwallex` → 595 postings on ashby

Trained intuition ("this company must use this ATS") is wrong surprisingly often. A 30-second curl check
prevents the worst possible first impression: "I clicked it and got zero postings."

## Step 4. Multi-File Uploads — Storage + JSONB Metadata

Second piece of work. Previously, each job posting could only have one "resume submitted" file attached,
but real applications often need multiple files — a portfolio, a career summary, and so on. I expanded
this to **up to 5 files per job.**

The design is "separate the raw files from the metadata":

- **Raw files**: a private Supabase Storage bucket called `application-docs`, with paths shaped like
  `{userId}/{jobId}/{timestamp}.{extension}`
- **Metadata**: a single new JSONB column on the existing `matches` table

```sql
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS applied_documents JSONB NOT NULL DEFAULT '[]'::jsonb;
-- [{ "name": "포트폴리오.pdf", "path": "...", "size": 1048576, "uploadedAt": "..." }]
```

I could have made a dedicated table just for the file list, but a join table is overkill for a list
capped at "5 per job." A JSONB array means a single lookup and shorter code.

### Ownership Verification — You Can't Just Hand Out Signed URLs to Anyone

Files in a private bucket can only be downloaded via a signed URL, but if a server action takes nothing
but a path and issues a URL for it, it's **wide open to an attack where someone guesses someone else's
file path.** So I put the same check in every action:

```ts
export async function getApplicationDocumentUrl(jobId: string, path: string) {
  // 1) 로그인 유저 확인 → 2) 본인 match 행의 서류 목록 조회
  const docs = await getOwnedMatchDocs(profile.id, jobId)

  // 3) 요청한 path가 "본인 목록"에 있을 때만 발급
  if (docs === null || !docs.some(d => d.path === path)) {
    return { error: '해당 서류를 찾을 수 없습니다.' }
  }
  const { data } = await supabaseAdmin.storage
    .from('application-docs').createSignedUrl(path, 60) // 60초 유효
  return { url: data.signedUrl }
}
```

Another option would be to parse the path string and check whether `{userId}` matches, but checking
"is this a path that's in the DB's record of this user's own files" also blocks path-traversal tricks
(`../`) at the root. Deletion goes through the same check. And if the DB write fails right after an
upload, the just-uploaded file gets deleted so there's no **orphaned file** left behind.

### A Trick for Auto-Creating the Bucket

Instead of pre-creating the bucket from the dashboard, I used the pattern of catching a `Bucket not
found` error on the first upload, creating it, and retrying:

```ts
let { error } = await doUpload()
if (error?.message?.includes('Bucket not found')) {
  await supabaseAdmin.storage.createBucket('application-docs', { public: false })
  ;({ error } = await doUpload())
}
```

This means never having to remember whether the bucket was created in each environment (local,
production).

## Troubleshooting: A 'use server' File Can Only Export async Functions

I wanted the "max 5" limit to show up in a modal UI, so I exported a constant from a server action file:

```ts
// src/app/actions.ts ('use server')
export const MAX_APPLIED_DOCUMENTS = 5  // ❌ 빌드 에러!
```

Next.js's `'use server'` files **can only export async functions.** Everything exported gets turned into
an RPC endpoint callable from the client, so there's no room for a constant or a synchronous function to
sneak in. (For reference, type-only exports like `export interface` are fine, since they get erased at
compile time.)

The fix was splitting it into a shared module:

```ts
// src/lib/applied-documents.ts (일반 모듈)
export interface AppliedDocument { name: string; path: string; size: number; uploadedAt: string }
export const MAX_APPLIED_DOCUMENTS = 5
```

Both the server action and the client component import from this module. This is a constraint you're
bound to run into sooner or later while using server actions, so it's worth keeping in mind.

## Bonus: Three Small UX Fixes That Felt Bigger Than They Were

- **Sort the kanban board by most recent**: Board cards were sorted by score, which meant a job I just
  added could end up buried in the middle, making me think "wait, did it not get added?" Switched to
  sorting by `created_at` descending — whatever I just added now sits at the top.
- **Match the back-navigation path**: The workspace had a "← Dashboard" button. But users actually arrive
  here by clicking a card from the application tracking board. It makes sense to send them back the way
  they came — changed it to "← Applications." Back navigation should mean "back to where I came from,"
  not "back to home."
- **A dropdown sub-view pattern**: Adding "Change application status" to the `⋯` menu, I used a pattern
  where, instead of a nested dropdown, the menu's content switches to a status list and a "← Back" link
  returns it. Nested menus are a disaster on mobile, but this view switch is just a single piece of state
  (`menuView: 'main' | 'status'`).

## Wrap-Up

| Task | Key decision |
|---|---|
| Shared scraping cache | Separate per-user data (scores) from shared data (raw postings), cache only the latter |
| Cache resilience | Every cache failure falls back gracefully — a cache is an optimization, not a feature |
| Preset expansion | Only register slugs verified by curl against the public API, not gut instinct |
| Multi-file upload | Raw files in Storage, metadata in JSONB — a join table is overkill for a 5-item list |
| Download security | Signed URLs only ever get issued for paths that are in the user's own owned list |
| 'use server' constraint | Split constants and types out into a plain module so both sides can import them |

Building a structure where costs don't scale 1:1 with user growth — this is a bit of homework every side
project eventually has to do, right around the point where it crosses over from "a tool I use myself"
into "a service."
