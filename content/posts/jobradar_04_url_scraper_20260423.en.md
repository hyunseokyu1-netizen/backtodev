---
title: 'JobRadar Part 4: Why I Ditched Playwright for cheerio — The Day-4 Pivot'
date: '2026-04-23'
publish_date: '2026-05-21'
description: After three days fighting Playwright, I gave up. On day 4, I completely changed direction — from auto-collection to URL-based on-demand scraping, using cheerio + JSON-LD.
tags:
  - JobRadar
  - cheerio
  - Scraping
  - Vercel
---

Three posts' worth of work boils down to this:

> Playwright + Vercel = three days of nothing but errors.

After barely getting deployment to work with `@sparticuz/chromium`, I checked the scraped listings and found bot detection hadn't been fully bypassed. There was also a more fundamental problem.

**Collecting hundreds of listings on a daily Cron — most of them weren't relevant to me anyway.**

On day 4, I changed my thinking.

---

## Why the Change

### Bot Blocking — an Exhausting Fight

Even with headless Chrome and Playwright, Cloudflare and in-house bot detection kept catching me. Change the User-Agent, add manual stealth settings, add delays... eventually I was questioning why I was doing any of this.

### Vercel Lambda — Hostile to Playwright

Just from Part 3, the issues alone were:

| Problem | Details |
|---------|---------|
| Bundle size | Playwright + Chromium is hundreds of MB |
| Execution time | Browser startup + scraping easily exceeds 60s |
| `ETXTBSY` | Chromium binary conflict in Lambda |
| Bot detection | Hard to fully handle without the stealth plugin |

### Conclusion

I decided to let go of the "automated collection" dream.

Think about it — for listings I actually want to apply to, I'm going to look at them myself anyway. Ten listings I handpicked beat a hundred randomly collected ones every time.

```
Before: Cron → Playwright → bulk collection → DB
After:  User pastes URL → fetch + cheerio → single scrape → DB
```

Switching to on-demand. No server load, no Lambda constraints.

---

## Implementation Overview

```
[URL input] → addJobByUrl() → saved to jobs table
                                    ↓
                          /api/scrape-url auto-called
                                    ↓
                   platform detection → run the right scraper
                                    ↓
                          update title, company, description...
```

---

## Step 1 — Platform Auto-Detection Utility

To route to the right scraper, we need to know which site the URL is from.

```typescript
// src/lib/detect-platform.ts
export type Platform = 'seek' | 'indeed' | 'linkedin' | 'other'

const PLATFORM_PATTERNS: { platform: Platform; pattern: RegExp }[] = [
  { platform: 'seek',     pattern: /seek\.com\.au/i },
  { platform: 'indeed',  pattern: /indeed\.com/i },
  { platform: 'linkedin', pattern: /linkedin\.com\/jobs/i },
]

export function detectPlatform(url: string): Platform {
  for (const { platform, pattern } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform
  }
  return 'other'
}

export const PLATFORM_STYLE: Record<Platform, { label: string; className: string }> = {
  seek:     { label: 'Seek',     className: 'bg-blue-100 text-blue-700' },
  indeed:   { label: 'Indeed',   className: 'bg-orange-100 text-orange-700' },
  linkedin: { label: 'LinkedIn', className: 'bg-sky-100 text-sky-700' },
  other:    { label: 'Other',    className: 'bg-zinc-100 text-zinc-500' },
}
```

Badge colors are defined here too. In the UI, just pull `PLATFORM_STYLE[source].className`.

---

## Step 2 — URL Input Form (AddJobForm)

Added a URL input field at the top of the job list. Paste and click Add — that's it.

```tsx
'use client'

export default function AddJobForm() {
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData()
    fd.append('url', url)
    const result = await addJobByUrl(fd)

    if (result.error) {
      setLoading(false)
      return
    }

    // trigger scraping immediately after DB save
    if (result.jobId) {
      await fetch('/api/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: result.jobId }),
      })
    }

    setLoading(false)
    setUrl('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="Paste job URL (Seek, Indeed, LinkedIn...)"
        disabled={loading}
      />
      <button type="submit" disabled={loading || !url}>
        {loading ? 'Adding...' : 'Add'}
      </button>
    </form>
  )
}
```

Saving (`addJobByUrl`) and scraping (`/api/scrape-url`) are intentionally separated: save fast, and if scraping fails it can be retried later.

---

## Step 3 — Seek Scraper: `__NEXT_DATA__` Parsing

Seek is built on Next.js, so there's a `<script id="__NEXT_DATA__">` tag in the page HTML containing the server-side props as JSON. Parsing this is cleaner than DOM selectors.

```typescript
export async function scrapeSeekUrl(url: string): Promise<ScrapedJob> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-AU,en;q=0.9',
    },
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  // Priority 1: parse __NEXT_DATA__ JSON
  const nextDataRaw = $('#__NEXT_DATA__').text()
  if (nextDataRaw) {
    const nextData = JSON.parse(nextDataRaw)
    const job = nextData?.props?.pageProps?.jobDetails?.job
      ?? nextData?.props?.pageProps?.job
      ?? nextData?.props?.pageProps?.jobViewDetails

    if (job) {
      return {
        title:       job.title ?? job.header?.jobTitle ?? '',
        company:     job.advertiser?.description ?? job.companyName ?? '',
        location:    job.location ?? job.locationLabel ?? '',
        description: job.content ?? job.description ?? '',
        posted_at:   job.listingDate ?? null,
      }
    }
  }

  // Priority 2: cheerio fallback
  const title = $('h1[data-automation="job-detail-title"]').text() || $('h1').first().text()
  // ...
}
```

Why so many `??` chains: Seek's JSON structure varies by listing type. The data can live in different paths depending on the job, so you have to check them all.

---

## Step 4 — Indeed Scraper: JSON-LD Structured Data

Indeed puts `JobPosting` schema data into `<script type="application/ld+json">` tags — originally for Google SEO. We get to use it for free.

```typescript
export async function scrapeIndeedUrl(url: string): Promise<ScrapedJob> {
  const $ = cheerio.load(html)

  let ldJob: ScrapedJob | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (ldJob) return
    try {
      const data = JSON.parse($(el).text())
      if (data['@type'] === 'JobPosting') {
        ldJob = {
          title:       data.title ?? '',
          company:     data.hiringOrganization?.name ?? '',
          location:    data.jobLocation?.address?.addressLocality ?? '',
          description: data.description ?? '',
          posted_at:   data.datePosted ?? null,
        }
      }
    } catch { /* continue to next on JSON parse failure */ }
  })
  if (ldJob) return ldJob

  // Priority 2: cheerio fallback
}
```

Structured data tends to stay stable even when the site UI changes, making it more reliable than DOM parsing.

---

## Step 5 — Generic Scraper: Tiered Fallback

LinkedIn and other sites are handled by a single generic scraper. It tries JSON-LD → Open Graph → meta tags in order.

```typescript
export async function scrapeGenericUrl(url: string): Promise<ScrapedJob> {
  const $ = cheerio.load(html)

  // Priority 1: JSON-LD JobPosting
  // ...

  // Priority 2: Open Graph meta tags
  const ogTitle = $('meta[property="og:title"]').attr('content') ?? ''
  const ogDesc  = $('meta[property="og:description"]').attr('content')
    ?? $('meta[name="description"]').attr('content') ?? ''

  // use the longest text block on the page for description
  let description = ogDesc
  if (!description) {
    let maxLen = 0
    $('div, article, section').each((_, el) => {
      const text = $(el).text().trim()
      if (text.length > maxLen) { maxLen = text.length; description = text }
    })
  }

  return {
    title: ogTitle.trim(),
    description: description.slice(0, 5000),
    // ...
  }
}
```

---

## Step 6 — /api/scrape-url API Route

```typescript
export const maxDuration = 30  // down from 300s with Playwright

export async function POST(request: Request) {
  const { jobId } = await request.json()
  const { data: job } = await supabaseAdmin
    .from('jobs').select('id, url, source').eq('id', jobId).single()

  try {
    const source = job.source as Platform
    const scraped =
      source === 'seek'   ? await scrapeSeekUrl(job.url) :
      source === 'indeed' ? await scrapeIndeedUrl(job.url) :
                            await scrapeGenericUrl(job.url)

    await supabaseAdmin.from('jobs').update({
      title:       scraped.title,
      company:     scraped.company,
      description: scraped.description,
      scraped_at:  new Date().toISOString(),
    }).eq('id', job.id)

    return NextResponse.json({ ok: true, title: scraped.title })
  } catch (e) {
    await supabaseAdmin.from('jobs').update({ title: 'Scraping failed' }).eq('id', job.id)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
```

`maxDuration = 30` — fetch + cheerio typically finishes in 3–5 seconds. Compare that to needing 300 seconds and still feeling anxious back in Part 3.

---

## Platform Strategy Summary

| Platform | Primary Strategy | Fallback |
|----------|-----------------|----------|
| Seek | `__NEXT_DATA__` JSON parsing | cheerio DOM selectors |
| Indeed | JSON-LD (`JobPosting` schema) | cheerio DOM selectors |
| LinkedIn / Other | JSON-LD (`JobPosting` schema) | Open Graph / meta tags |

---

## Troubleshooting

**fetch returns 403**

Setting the User-Agent to look like a real browser resolves most cases.

```typescript
headers: {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
  'Accept-Language': 'en-AU,en;q=0.9',
}
```

**`__NEXT_DATA__` path changes**

Seek's JSON structure changes with listing type. Using `??` chains to cover multiple paths is the only option.

**JSON-LD parse failure**

Wrap `JSON.parse` in a `try-catch` and fall through to the next strategy on failure. Even when JSON-LD exists it can be incomplete, so check for required fields after successful parsing.

---

## Summary — The Core Flow

```
User pastes URL
    ↓
detectPlatform(url) → 'seek' | 'indeed' | 'other'
    ↓
Save to DB (returns jobId)
    ↓
POST /api/scrape-url { jobId }
    ↓
Run platform-specific scraper
  Seek:    __NEXT_DATA__ → cheerio
  Indeed:  JSON-LD → cheerio
  Generic: JSON-LD → Open Graph → meta
    ↓
Update DB (title, company, description ...)
```

Three days of fighting Playwright, then a direction change — and the code actually got simpler. No issues on Vercel either.

Automated collection looks more impressive, but sometimes the opposite is more practical. On day 4 I realized ten listings I personally selected are far more useful than a hundred auto-collected ones.

Next step: using Claude API to match the accumulated listings. Continuing in Part 5.
