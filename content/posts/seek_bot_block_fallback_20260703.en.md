---
title: "Breaking Through Bot-Blocked Job Scraping With a Three-Tier Fallback (Direct Fetch → Stealth Browser → Reader Proxy + AI Extraction)"
date: '2026-07-03'
publish_date: '2026-07-30'
description: How I revived job-posting collection that had been getting nothing but 403s from Seek's Kasada bot protection, using the r.jina.ai reader proxy and Claude Haiku structured extraction — plus a debugging detour where I confused "blocked" with "expired"
tags:
  - Scraping
  - Jina AI
  - Claude API
  - Playwright
  - Next.js
---

> **MatchDa Build Log Series (1/3)**
> A series unpacking four commits from a single day.
> **Part 1: A three-tier fallback for bot-blocked scraping (this post)** · Part 2: Building a React autocomplete chip input from scratch · Part 3: Finding a screen that quietly went missing during the rebranding migration

## Getting a 403 even from a local IP

One day, the feature that collects job postings from **Seek**, the Australian job site, went completely dead. My first thought was "must be blocked because it's a Vercel datacenter IP," but firing curl from my local MacBook returned the exact same **403.**

```bash
curl -I "https://www.seek.com.au/job/12345678"
# HTTP/2 403
```

Seek runs **Kasada**, a commercial bot-blocking solution. This isn't Cloudflare-challenge-level stuff — you have to clear browser fingerprinting plus a JS challenge before it hands over any content. So all of the following were blocked.

| Attempt | Result |
|---|---|
| `fetch` / `curl` (with disguised headers) | 403 |
| Playwright headless | 403 or a blank page |
| playwright-extra + stealth plugin | intermittent success, mostly blocked |

At this point I had two options: pay for a scraping API (a monthly subscription), or find another workaround.

## The workaround: reader proxy + AI extraction

The answer I found was the **r.jina.ai reader proxy.** Just prepend `https://r.jina.ai/` to a URL, and Jina's browser farm renders the page on your behalf and returns the result **converted to markdown.** Instead of me breaking through the bot protection myself, I'm delegating it to infrastructure that's already broken through.

The catch is that what comes back isn't structured JSON — it's the whole page as markdown, navigation, footer, and recommended-jobs sections all mixed in. So I bolted on one more step: **hand the markdown to Claude Haiku and have it extract just the job-posting fields as JSON.**

The final structure is a three-tier fallback.

```
Tier 1: direct fetch (cheapest, fastest)
  └ fails → Tier 2: stealth headless browser
      └ fails → Tier 3: reader proxy (r.jina.ai) + Haiku structured extraction
```

Try the cheap method first, and only reach for the expensive one as a last resort. Most sites succeed at Tier 1, so costs barely move.

## Step 1: The reader proxy fetcher

```ts
// src/lib/scrapers/reader.ts
export async function fetchReaderMarkdown(url: string): Promise<string> {
  const headers: Record<string, string> = { 'X-Return-Format': 'markdown' }
  // having a key significantly raises the rate limit (works without one for low-frequency use)
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`

  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`Reader proxy failed: ${res.status}`)

  const text = await res.text()
  // guard against a blocked/error page having been converted anyway (a real posting's body is longer than this)
  if (text.trim().length < 200) throw new Error('Reader proxy returned empty content.')
  return text
}
```

Three points worth noting:

- `X-Return-Format: markdown` — get markdown back instead of HTML; it's easier to feed to an LLM
- `AbortSignal.timeout(45_000)` — the proxy side's rendering can be slow, so give it a generous timeout
- **A length guard** — even a blocked page comes back as "markdown conversion succeeded," so treat content that's too short as a failure

## Step 2: Structured extraction with Haiku

Pulling fields out of markdown is a losing battle for regex — every site's structure differs, and the reader proxy's output is selector-free plain text. This is exactly where a small model shines.

```ts
const message = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 3000,
  messages: [{
    role: 'user',
    content: `Below is a job posting page converted to markdown. Extract the posting info and respond with JSON only.

Format: {"title": "job title", "company": "company name", "location": "location", "salary": "salary (null if none)", "description": "the full JD body (plain text, keep original language)", "posted_at": "posted date as an ISO date (null if none)"}

Rules:
- Fill description with the JD body as completely as possible (exclude navigation, footer, recommended postings)
- Even without a JD body, if the title/location can be inferred from the "Title:" line at the top of the document, fill in title/location and leave description as ""
- If the page is unrelated to a job posting, output only {"title": ""}

Markdown:
${markdown.slice(0, 40_000)}`,
  }],
})
```

Things I was careful about in the prompt:

1. **"Respond with JSON only"** + regex-matching `{...}` out of the response — parseable even if some chatter sneaks in
2. **The title-line rescue rule** — added because of the expired-posting issue explained below. Even with no body, you can still salvage a job title and location from a page title like `"Senior Engineer Job in Sydney NSW - SEEK"`
3. **`slice(0, 40_000)`** — caps the input cost regardless of how long the markdown gets

## Step 3: Wiring the fallback into the API route

If the existing scraper throws for any reason, control falls through to the reader fallback.

```ts
// src/app/api/scrape-url/route.ts
let scraped
try {
  scraped =
    source === 'seek'   ? await scrapeSeekUrl(job.url) :
    source === 'indeed' ? await scrapeIndeedUrl(job.url) :
                          await scrapeGenericUrl(job.url)
} catch (directError) {
  console.warn(`[scrape-url] Direct collection failed, falling back to reader proxy: ${job.url}`)
  scraped = await scrapeJobViaReader(job.url)
}
```

And one line matters at save time.

```ts
// if the reader fallback only salvaged the title (empty JD), don't wipe out existing/manually-entered JD
description: scraped.description || job.description || null,
```

The fallback can salvage just a title with an empty-string description — saving that as-is would **overwrite a JD the user manually pasted in with an empty value.** Any fallback path always needs to be checked for whether it could overwrite existing data with something worse.

I also raised the Vercel function timeout to account for the fallback's duration.

```ts
export const maxDuration = 90  // accounts for reader proxy (up to 45s) + Haiku extraction
```

## The debugging twist: it wasn't blocked — it was expired

This is where the real lesson of this post shows up.

After building out the whole fallback and testing it, the markdown I got back from the reader proxy had no JD in it. I spent a good while wondering "is the reader proxy getting blocked by Kasada too?" — until I actually read the markdown and found this line.

> This job is no longer advertised

**The posting I'd used for testing had expired.** Seek shows an `expiredJobPage` for expired postings, and both the blocked page and the expired page present the identical symptom of "no JD." But the causes are completely different.

| Symptom | Blocked (403) | Expired (expiredJobPage) |
|---|---|---|
| JD body | absent | absent |
| HTTP status | 403 | **200** |
| Page title | challenge text | **includes job title / location** |

Testing again with a live posting, the reader proxy collected **the full JD text, cleanly.** If I'd read the response body from the start, I'd have saved 30 minutes. Even when the "it's not working" outcome looks the same, a different cause calls for a different response — bypass if it's blocked, but salvage at least the title from the page title and mark the status if it's expired. The "title-line rescue rule" in the prompt above came directly out of this experience.

## Verifying in production

What works locally and what works on Vercel are different things (especially for scraping). After deploying, I registered a real, live Seek posting through the API to check.

- Direct fetch got a 403 → the reader proxy fallback kicked in
- Title, company, location, and **a 4,291-character JD** collected successfully in **13 seconds**
- Saved to the DB correctly, with no overwriting of existing data

## Summary

```
Direct fetch (free, ~1s)
  → on failure, stealth browser (free, ~5s, low success rate)
    → on failure, reader proxy + Haiku (small cost, ~15s, high success rate)
```

- For bot protection, **delegating the rendering** is cheaper to maintain than attacking it head-on
- For unstructured text → structured JSON, a **small LLM (Haiku)** is more robust than regex
- Guard fallback results so they **never overwrite existing data** with something worse
- Verify the actual cause of "it's not working" — **blocked and expired look the same but have different causes**

Next up: the React autocomplete chip input component I built the same day.
