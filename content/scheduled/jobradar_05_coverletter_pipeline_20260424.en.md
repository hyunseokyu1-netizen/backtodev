---
title: 'JobRadar Part 5: Dropping the Automation Fantasy and Building a Practical Pipeline'
date: '2026-04-24'
publish_date: '2026-05-22'
description: After giving up on Playwright auto-scraping, I built an on-demand pipeline — URL paste → JD scraping → AI matching → cover letter generation — over two days.
tags:
  - JobRadar
  - NextJS
  - Playwright
  - cheerio
  - AI
  - SideProject
---

When I first designed JobRadar, the roadmap was simple:

> "Vercel Cron scrapes Indeed/Seek every morning, AI scores them, I get a digest email."

Sounds great. But building it was a different story.

- **Seek/Indeed bot blocking**: User-Agent changes got 403s and 429s right back.
- **Playwright on Vercel Lambda**: Bundle size exploded, timeout at 10 seconds, ETXTBSY errors.
- **Cloudflare blocking**: Glassdoor couldn't even be fetched.

I spent two days in Part 3 trying to make Playwright + Vercel work. The conclusion was clear:

> "If auto-collection is blocked, why not have users paste URLs themselves?"

The pivot turned out to be simpler and more powerful. Only listings the user actually cares about go in, so there's no junk data. On-demand means almost no server costs. This post covers two days of building after that shift.

---

## What Got Built

| Feature | Description |
|---------|-------------|
| URL input UI | URL input field at the top of the job list, platform auto-detection badge |
| JD scrapers | Seek / Indeed / Glassdoor / Generic implementations |
| Instant pipeline | URL add → scraping → AI matching runs automatically in sequence |
| Job list UX | Drag to reorder, delete, re-match |
| Cover letter generation | AI-generated from JD + resume, editable, clipboard copy |
| Resume experience summary | Resume text → Claude Haiku → English summary auto-fill |

---

## Step 1. URL Input and Platform Auto-Detection

The first thing I built was the input field. Paste a URL and the badge shows which site it's from instantly.

```typescript
// src/lib/detect-platform.ts
export type Platform = 'seek' | 'indeed' | 'linkedin' | 'glassdoor' | 'other'

export function detectPlatform(url: string): Platform {
  if (url.includes('seek.com')) return 'seek'
  if (url.includes('indeed.com')) return 'indeed'
  if (url.includes('linkedin.com')) return 'linkedin'
  if (url.includes('glassdoor.com')) return 'glassdoor'
  return 'other'
}

export const PLATFORM_STYLE: Record<Platform, { label: string; className: string }> = {
  seek:      { label: 'Seek',      className: 'bg-blue-100 text-blue-700' },
  indeed:    { label: 'Indeed',    className: 'bg-yellow-100 text-yellow-700' },
  linkedin:  { label: 'LinkedIn',  className: 'bg-sky-100 text-sky-700' },
  glassdoor: { label: 'Glassdoor', className: 'bg-green-100 text-green-700' },
  other:     { label: 'Other',     className: 'bg-zinc-100 text-zinc-500' },
}
```

The badge color changing the moment you type a URL turned out to be surprisingly helpful UX. "Yep, I pasted it right."

---

## Step 2. cheerio-Based JD Scraper

To get JDs without Playwright, it's `fetch` + HTML parsing. The library is **cheerio** — basically jQuery for Node.js, easy to learn, light on the server bundle.

```bash
npm install cheerio
```

Each platform needed a different scraping strategy.

### Seek: `__NEXT_DATA__` JSON Parsing

Seek is built on Next.js, so `<script id="__NEXT_DATA__">` contains the entire job listing as JSON. Much cleaner than parsing the HTML.

```typescript
// src/lib/scrapers/seek-url.ts
const nextDataRaw = $('#__NEXT_DATA__').text()
if (nextDataRaw) {
  const nextData = JSON.parse(nextDataRaw)
  const job = nextData?.props?.pageProps?.jobDetails?.job
    ?? nextData?.props?.pageProps?.job
    ?? nextData?.props?.pageProps?.jobViewDetails

  if (job) {
    return {
      title: job.title ?? job.header?.jobTitle ?? '',
      company: job.advertiser?.description ?? job.companyName ?? '',
      // ...
    }
  }
}

// cheerio fallback if JSON parsing fails
const title = $('h1[data-automation="job-detail-title"]').text()
  || $('h1').first().text()
```

The `__NEXT_DATA__` structure can change when Seek deploys. Multiple paths are covered with `??` chaining, with a cheerio HTML fallback when that fails.

### Indeed: JSON-LD Structured Data

Indeed provides `JobPosting` schema data in `<script type="application/ld+json">` — standard structured data that's easy to parse.

```typescript
// src/lib/scrapers/indeed-url.ts
$('script[type="application/ld+json"]').each((_, el) => {
  const data = JSON.parse($(el).text())
  if (data['@type'] === 'JobPosting') {
    ldJob = {
      title: data.title ?? '',
      company: data.hiringOrganization?.name ?? '',
      location: data.jobLocation?.address?.addressLocality ?? '',
      description: data.description ?? '',
      posted_at: data.datePosted ?? null,
    }
  }
})
```

If no JSON-LD, fall back to `data-testid` selectors via cheerio.

### Generic: 3-Tier Fallback

For non-Seek/Indeed/LinkedIn/Glassdoor sites, try in order:

```
JSON-LD (JobPosting)
  → Open Graph (og:title, og:description)
    → meta tags (description)
```

---

## Step 3. Glassdoor Adventures — Cloudflare Bypass

Glassdoor has Cloudflare bot protection that blocks `fetch` outright. Not even a 403 — the connection just gets dropped.

Tried stealth mode:

```javascript
// test-stealth.js (ultimately discarded)
const browser = await chromium.launch({ headless: false })
// ... still blocked by Cloudflare
```

Then I looked more closely at the URL:

```
/job-listing/group-product-manager-deepl-JV_IC5023222_KO0,49_KE50,55.htm
```

`KO0,49` and `KE50,55`. KO encodes the title range, KE encodes the company name range — as character indices in the slug string.

```typescript
// src/lib/scrapers/glassdoor-url.ts
export function parseGlassdoorUrl(url: string): ScrapedJob {
  const pathname = new URL(url).pathname
  const slugMatch = pathname.match(/\/job-listing\/(.+?)(?:-JV_|-GD_|\.htm)/i)
  const slug = slugMatch?.[1] ?? ''

  const koMatch = pathname.match(/_KO\d+,(\d+)/)   // title end index
  const keMatch = pathname.match(/_KE(\d+),(\d+)/) // company start, end index

  if (koMatch && keMatch) {
    const titleEnd = parseInt(koMatch[1])
    const companyStart = parseInt(keMatch[1])
    const companyEnd = parseInt(keMatch[2])
    title = slug.slice(0, titleEnd).replace(/-/g, ' ')
    company = slug.slice(companyStart, companyEnd).replace(/-/g, ' ')
  }
  // ...
}
```

No fetch needed — extract title and company name purely from the URL. Can't get the full JD, but it's enough for matching. This was the most memorable moment of the whole build.

---

## Step 4. Instant Pipeline After URL Add

The moment a URL is saved, scraping → AI matching runs automatically in sequence. `AddJobForm` shows status at each step.

```typescript
// save → scrape → match sequential execution
const saved = await addJobUrl(formData)           // 1. save to DB
setStatus('Scraping...')
await fetch('/api/scrape-url', {                   // 2. scrape JD
  method: 'POST',
  body: JSON.stringify({ jobId: saved.id, url }),
})
setStatus('AI matching...')
await matchSingleJob(saved.id)                     // 3. AI match
setStatus('Done')
```

From the user's perspective: paste one URL and within 10 seconds the match score appears on the card.

---

## Step 5. Job List UX Improvements

### Drag to Reorder (@dnd-kit)

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

```typescript
// src/components/JobList.tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (over && active.id !== over.id) {
    setItems(prev => arrayMove(prev,
      prev.findIndex(i => i.id === active.id),
      prev.findIndex(i => i.id === over.id),
    ))
  }
}
```

`arrayMove` handles the index swap automatically — simpler than expected. Order is managed in client state only, not persisted to DB (it's MVP).

### Click Match Score to Re-match

Click the score badge and that single listing re-matches.

```typescript
<button
  onClick={() => rematch(job.id)}
  className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200"
>
  {job.match_score ?? 'Unmatched'}
</button>
```

Click "Unmatched" to trigger a single-listing match immediately. No waiting for a batch run.

---

## Step 6. Cover Letter Generation Pipeline

This is the core feature. Click "Cover Letter" on a job card, a modal opens, and Claude writes a cover letter based on the JD + your resume.

```typescript
// src/app/actions.ts - generateCoverLetter
export async function generateCoverLetter(jobId: string) {
  const [job, profile] = await Promise.all([
    getJobById(jobId),
    getMyProfile(),
  ])

  const prompt = `
You are a professional cover letter writer.

[Applicant Profile]
${profile.experience_summary}

[Job Listing]
Company: ${job.company}
Title: ${job.title}
JD: ${job.description}

Please write an English cover letter based on the above.
`

  const message = await claude.messages.create({
    model: 'claude-haiku-20240307',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  await upsertCoverLetter(jobId, content)
  return { content }
}
```

The modal lets you edit the generated content inline and has a clipboard copy button. Regeneration is also available.

```
[Cover Letter Modal]
┌─────────────────────────────────────┐
│ Cover Letter                         │
│ Senior Product Manager · Atlassian  │
├─────────────────────────────────────┤
│                                     │
│  Dear Hiring Manager,               │
│                                     │
│  I am writing to express my...      │
│  [editable textarea]                │
│                                     │
├─────────────────────────────────────┤
│ ↺ Regenerate      [Copy to clipboard] │
└─────────────────────────────────────┘
```

---

## Step 7. AI Auto-fill from Resume

On the profile page, upload your resume and click "AI Auto-fill" to generate an experience summary automatically.

```typescript
// src/app/profile/actions.ts
export async function autoFillExperience() {
  const profile = await getMyProfile()
  if (!profile.resume_text) return { error: 'Please upload your resume first.' }

  const message = await claude.messages.create({
    model: 'claude-haiku-20240307',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Based on the following resume, write a 3-4 sentence English career summary:\n\n${profile.resume_text}`,
    }],
  })

  const summary = message.content[0].type === 'text' ? message.content[0].text : ''
  await updateExperienceSummary(summary)
  return { summary }
}
```

This summary feeds directly into the cover letter generation prompt — so its quality directly determines the cover letter quality.

---

## Troubleshooting

### Glassdoor URL without KO/KE parameters

Some Glassdoor URLs don't have the KO/KE encoding. The fallback estimates the last word of the slug as the company name. Lower accuracy, but better than "can't parse."

```typescript
// fallback when no KO/KE
company = parts[parts.length - 1] ?? ''
title = parts.slice(0, -1).join(' ')
```

### Seek `__NEXT_DATA__` structure change

Seek's `pageProps` subkeys can change between deployments. `??` chains cover multiple paths, then cheerio fallback kicks in if all else fails. Storing the error message in DB and showing it on the card made debugging much easier.

### Vercel serverless function timeout

Sequential scraping + AI matching can exceed 10 seconds. Fix by increasing the API route timeout in `next.config.js` or separating the scrape and match calls.

---

## Full Pipeline at a Glance

```
User pastes URL
        ↓
Platform auto-detect (Seek/Indeed/Glassdoor/Other)
        ↓
Save to DB (title/URL/platform)
        ↓
Call /api/scrape-url
  ├── Seek    → __NEXT_DATA__ JSON → cheerio fallback
  ├── Indeed  → JSON-LD → cheerio fallback
  ├── Glassdoor → URL slug parsing (KO/KE encoding)
  └── Generic → JSON-LD → Open Graph → meta tags
        ↓
AI matching (Claude Sonnet, 0–100 score + reasoning)
        ↓
Score displayed on job card
        ↓
Click "Cover Letter"
        ↓
AI cover letter generated from JD + resume
        ↓
Edit → copy to clipboard
```

---

## Wrap-up

When I was insisting on Playwright automation at the start, I thought "bot blocking is nothing — just change the User-Agent." But Cloudflare doesn't work that way, and Vercel Lambda constraints are real.

Switching to on-demand actually made the code simpler. No batch scheduler, no error retry logic — just "process the request when it comes in." And like the Glassdoor adventure taught me: when you're blocked, find another way. The answer was in the URL slug.

The next post covers the email digest — sending the top-matched listings via Resend every morning.

---

*JobRadar series*
- [Part 1: Next.js + Supabase Project Setup](jobradar_01_setup_20260420.ko.md)
- [Part 2: First JD Scraper Attempt with cheerio](jobradar_02_scraper_20260421.ko.md)
- [Part 3: The Reality of Playwright + Vercel](jobradar_03_vercel_playwright_20260422.ko.md)
- [Part 4: Switching to URL-Based Scraping](jobradar_04_url_scraper_20260423.ko.md)
- **Part 5: On-demand Pipeline Complete (current)**
