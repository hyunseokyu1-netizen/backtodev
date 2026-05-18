---
title: '[JobRadar Part 2] Supabase Schema + Playwright Scraper — Debugging Notes'
date: '2026-04-21'
publish_date: '2026-05-19'
description: JobRadar part 2. From Supabase multi-user schema design to Indeed and Seek Playwright scraper implementation. Glassdoor blocks, ETXTBSY, missing modules — all the pain points documented.
tags:
  - JobRadar
  - Playwright
  - Supabase
  - Scraping
---

While preparing for a job hunt in AU/NZ, I developed a daily routine.

1. Open Indeed → search "React Native developer Sydney"
2. Open Seek → same search
3. Scroll past everything I already saw yesterday
4. Can't remember if I've seen this one before, read it again
5. Don't apply to anything and close the tabs

Doing this every day had efficiency approaching zero. So I thought:

> "Why not automate this?"

The goal was simple: **every morning, top 10 jobs matching my skills arrive in my inbox.** And if Claude API could auto-generate cover letters too, even better.

This post covers the Supabase schema design, the Playwright scraper implementation, and all the pain points I ran into.

---

## Tech Stack

| Area | Tech |
|------|------|
| Framework | Next.js 14 App Router + TypeScript |
| DB | Supabase (PostgreSQL) |
| AI | Claude API (Anthropic) |
| Scraping | Playwright + @sparticuz/chromium |
| Email | Resend |
| Deploy | Vercel + Vercel Cron |

---

## Step 1 — Supabase Schema Design

### Table Structure

```
auth.users (managed by Supabase)
    ↓ 1:1
profiles (user profiles)
    ↓
matches (AI matching results) → jobs (full job listings pool)
    ↓
cover_letters (cover letters)
```

`jobs` is a shared pool of listings for all users. `matches` and `cover_letters` are separated per user.

### profiles Table

```sql
CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id),
  email             TEXT,
  name              TEXT,
  skills            TEXT[],
  desired_positions TEXT[],   -- ['React Native developer', 'Fullstack developer']
  desired_sources   TEXT[] DEFAULT ARRAY['indeed'],
  desired_locations TEXT[] DEFAULT ARRAY['Sydney NSW'],
  career_summary    TEXT,
  story             TEXT,     -- career story for cover letters
  resume_text       TEXT,
  preferences       JSONB
);
```

The key fields are `desired_positions`, `desired_sources`, and `desired_locations`. The scraper reads these to determine what to search for, where, and on which platforms.

### Auto-create Profile on Signup

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### RLS (Row Level Security)

```sql
CREATE POLICY "profiles: own records only" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "jobs: authenticated users can read all" ON jobs
  FOR SELECT TO authenticated USING (true);
```

RLS ensures user A can't see user B's matches or cover letters. This is baseline for any multi-user SaaS.

### Scrapers Need the Service Role Key

With RLS enabled, unauthenticated requests are blocked. The scraper running on Vercel Cron has no user session, so it needs the **service role key**.

```typescript
// src/lib/supabase-admin.ts
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // bypasses RLS
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

---

## Step 2 — Building the Scraper

### Original Plan vs Reality

The original plan was to scrape **Indeed + Glassdoor**.

Reality was different.

```
Attempt to access Glassdoor → "Just a moment..." → 10 min wait → CAPTCHA again
Apply playwright-extra stealth → still blocked
Try API endpoints directly → 403
```

Glassdoor was completely locked down by Cloudflare. I dropped it without hesitation and switched to **Seek.com.au** — Australia and New Zealand's #1 job board, with much more relaxed bot detection.

### Indeed Scraper — Panel Click Approach

Indeed had one gotcha too.

```
// First attempt — blocked
await page.goto(`https://au.indeed.com/viewjob?jk=${jobId}`)
// → "We're sorry, this job is no longer available"
```

Directly navigating to a job URL via extraction gets blocked. The workaround is the **panel click approach**: click a job card from the listing page and extract the JD from the right-side panel that opens.

```typescript
for (const card of jobCards) {
  await card.click()
  await page.waitForTimeout(1500)
  const description = await page.$eval(
    '#jobDescriptionText',
    el => el.textContent?.trim() ?? null
  ).catch(() => null)
}
```

### Seek Scraper — URL Slug Conversion

Seek's URL format:

```
https://www.seek.com.au/react-native-developer-jobs/in-Sydney-NSW?daterange=7
```

Converting `"React Native developer"` → `"react-native-developer"` was needed.

```typescript
function toSeekSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

### Dynamic Targets from Profile

No hardcoding — scrape targets are read directly from user profiles.

```typescript
async function collectScrapeTargets(): Promise<ScrapeTarget[]> {
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('desired_positions, desired_locations, desired_sources')
    .not('desired_positions', 'is', null)
    .contains('desired_sources', ['seek'])

  const seen = new Set<string>()
  const targets: ScrapeTarget[] = []

  for (const profile of profiles ?? []) {
    for (const keyword of profile.desired_positions) {
      for (const location of profile.desired_locations) {
        const key = `${keyword}|${location}`
        if (!seen.has(key)) {
          seen.add(key)
          targets.push({ keyword, location })
        }
      }
    }
  }
  return targets
}
```

---

## Step 3 — Vercel Cron Automation

```json
{
  "crons": [
    {
      "path": "/api/scrape",
      "schedule": "0 22 * * *"
    }
  ]
}
```

22:00 UTC = 08:00 AEST (Sydney). Jobs pile up before the morning commute.

```typescript
// src/app/api/scrape/route.ts
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { scrapeIndeed } = await import('@/lib/scrapers/indeed')
  const { scrapeSeek } = await import('@/lib/scrapers/seek')

  // sequential — concurrent execution causes /tmp/chromium ETXTBSY error
  const indeedResult = await scrapeIndeed().catch(e => ({ error: String(e) }))
  const seekResult = await scrapeSeek().catch(e => ({ error: String(e) }))

  return NextResponse.json({ ok: true, indeed: indeedResult, seek: seekResult })
}
```

---

## Pain Points

### 1. Glassdoor Complete Block

**Symptom**: "Just a moment..." infinite loading even with playwright-extra + stealth  
**Cause**: Cloudflare Enterprise-tier bot protection  
**Fix**: Switched to Seek.com.au

### 2. Indeed viewjob URL Direct Access Blocked

**Symptom**: "Job no longer available" when accessing `viewjob?jk=xxx`  
**Cause**: Direct access without going through the listing page is detected  
**Fix**: Panel click approach from the listing page

### 3. Vercel Lambda — playwright-extra Module Missing

**Symptom**: `Cannot find module 'is-plain-object'`  
**Cause**: Next.js File Tracer doesn't include dynamic require dependencies from playwright-extra  
**Fix**: Removed playwright-extra entirely, using `playwright-core` directly

### 4. ETXTBSY — Chromium Binary Conflict

**Symptom**: `spawn ETXTBSY`  
**Cause**: `/tmp/chromium` conflict when running Indeed and Seek concurrently  
**Fix**: Changed to sequential execution

### 5. Vercel US Servers → AU Job Board Results: 0

**Symptom**: Scraper runs fine, `targets: 12` but `inserted: 0`  
**Cause**: Vercel Hobby plan runs from Washington DC. US IP can produce different results or trigger bot detection on AU job boards  
**Current status**: Infrastructure is complete. Scraping quality improvement is a follow-up task

---

## Troubleshooting Summary

| Error | Cause | Fix |
|-------|-------|-----|
| `Just a moment...` | Cloudflare block | Switch job boards |
| `viewjob blocked` | Direct URL detection | Panel click approach |
| `Cannot find module` | lazy-cache dynamic require | Remove playwright-extra |
| `spawn ETXTBSY` | Concurrent Chromium binary | Sequential execution |
| `inserted: 0` | US server location | Improvement pending |

---

## Summary — The Core Flow

```
Vercel Cron (daily 08:00 AEST)
    ↓
/api/scrape (Bearer auth)
    ↓
Read Supabase profiles (service role)
    → Generate desired_positions × desired_locations combinations
    ↓
Indeed scraper (panel click approach)
    ↓
Seek scraper
    ↓
jobs table upsert (deduplicated by URL)
```

The infrastructure is in place. Now it's time to build the real core: the AI matching engine. Continuing in Part 3.
