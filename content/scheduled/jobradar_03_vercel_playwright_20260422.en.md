---
title: 'JobRadar Part 3: Deploying Playwright to Vercel Blew Up — The @sparticuz/chromium Journey'
date: '2026-04-22'
publish_date: '2026-05-20'
description: Why a scraper that ran fine locally kept exploding on Vercel. From @sparticuz/chromium adoption to ETXTBSY, 60-second timeouts, and everything in between.
tags:
  - JobRadar
  - Playwright
  - Vercel
  - Serverless
---

In Part 2, the Playwright scraper code was done. Ran it locally and Seek listings came through clean. Now I just needed to deploy it to Vercel.

That's what I thought.

> "It only blows up on Vercel."

That one sentence summarizes the entire day.

---

## The Full Pain Timeline

```
Use playwright package
  → Build error (needs dynamic import)
  → Module missing (outputFileTracingIncludes)
  → playwright-extra transitive deps hell
  → ETXTBSY (binary conflict on concurrent execution)
  → playwright-extra completely removed
  → Switch to @sparticuz/chromium + playwright-core
  → Bot detection bypass (manual stealth)
  → 60-second timeout handling (SCRAPE_TARGET_LIMIT)
  → Seek: 38 listings saved successfully
```

---

## Prerequisites

- Next.js 14 App Router project (set up in Part 1)
- Playwright scraper code (implemented in Part 2)
- Vercel deployment environment (Hobby plan)

Final package setup:

```bash
npm install playwright-core @sparticuz/chromium
npm uninstall playwright playwright-extra puppeteer-extra-plugin-stealth
```

---

## Step 1 — First I Just Deployed playwright and Got Build Errors

It worked locally so I deployed it as-is.

**Error 1: Top-level import fails**

Importing heavy server-only modules at the top level in Next.js App Router fails at build time.

```ts
// this doesn't work
import { scrapeSeek } from '@/lib/scrapers/seek'

// this works
const { scrapeSeek } = await import('@/lib/scrapers/seek')
```

**Error 2: serverExternalPackages required**

```ts
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'playwright-core'],
}
```

Without this, Next.js tries to bundle playwright and fails.

---

## Step 2 — Module Missing Hell

The build passed, but runtime threw a flood of "cannot find module" errors.

```
Error: Cannot find module 'lazy-cache'
Error: Cannot find module 'is-plain-object'
```

Vercel only includes files that are actually used in the Lambda package during deployment (File Tracing). Dynamically loaded modules get left out.

Tried manually specifying them with `outputFileTracingIncludes`:

```ts
outputFileTracingIncludes: {
  '/api/scrape': [
    './node_modules/is-plain-object/**',
    './node_modules/clone-deep/**',
    './node_modules/merge-deep/**',
    './node_modules/lazy-cache/**',
    // ...
  ],
},
```

Even with all of that, new missing module errors kept appearing. playwright-extra's plugin system loads dependencies dynamically at runtime — it's a bottomless pit.

> At this point I made a call. **Drop playwright-extra entirely.**

---

## Step 3 — Switch to @sparticuz/chromium + playwright-core

There's a standard approach for running Playwright in Vercel Lambdas. `@sparticuz/chromium` — a Chromium binary optimized for Lambda environments.

```bash
npm install playwright-core @sparticuz/chromium
npm uninstall playwright playwright-extra puppeteer-extra-plugin-stealth
```

`next.config.ts` got dramatically simpler:

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  outputFileTracingIncludes: {
    '/api/scrape': [
      './node_modules/@sparticuz/chromium/**',
      './node_modules/playwright-core/**',
    ],
  },
}
```

The module list went from 7 entries to 2.

In the scraper code, branch based on environment:

```ts
import { chromium } from 'playwright-core'
import chromiumBin from '@sparticuz/chromium'

const isVercel = !!process.env.VERCEL

const browser = await chromium.launch({
  args: isVercel ? chromiumBin.args : [],
  executablePath: isVercel ? await chromiumBin.executablePath() : undefined,
  headless: true,
})
```

- Local: no `executablePath` → playwright-core finds it automatically
- Vercel: use `@sparticuz/chromium`'s binary path and optimized args

---

## Step 4 — Fixing ETXTBSY

Running both scrapers (Indeed + Seek) concurrently with `Promise.allSettled` produced:

```
ETXTBSY: text file busy, open '/tmp/chromium'
```

In the Lambda environment, the Chromium binary gets unpacked to `/tmp`. Two processes trying to write the same file simultaneously causes a conflict.

```ts
// before: concurrent (causes ETXTBSY)
const [indeed, seek] = await Promise.allSettled([scrapeIndeed(), scrapeSeek()])

// after: sequential
const indeedResult = await scrapeIndeed().catch((e: unknown) => ({ error: String(e) }))
const seekResult = await scrapeSeek().catch((e: unknown) => ({ error: String(e) }))
```

Slight performance hit, but there's no choice in a Lambda environment.

---

## Step 5 — Bot Detection Bypass (Manual Stealth)

Dropping playwright-extra meant losing the stealth plugin. Handle it manually:

```ts
args: [
  ...(isVercel ? chromiumBin.args : []),
  '--disable-blink-features=AutomationControlled',
],
```

```ts
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

await page.setExtraHTTPHeaders({ 'User-Agent': UA })

// navigator.webdriver = true is a dead giveaway
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false })
})
```

---

## Step 6 — Handling the 60-Second Timeout

Vercel Hobby plan serverless functions have a 60-second execution limit. Too many scrape targets and it just gets cut off.

Made the target count configurable via environment variable:

```ts
const limit = parseInt(process.env.SCRAPE_TARGET_LIMIT ?? '2')
return targets.slice(0, limit)
```

| Env var | Value | When |
|---------|-------|------|
| `SCRAPE_TARGET_LIMIT` | `2` | Default, safely within 60s |
| `SCRAPE_TARGET_LIMIT` | `5` | When you want more coverage |

---

## Step 7 — Set Vercel Region to Sydney

Scraping Australian job boards from a US region can trigger blocks.

```json
// vercel.json
{
  "regions": ["syd1"],
  "crons": [...]
}
```

---

## Troubleshooting Summary

| Error | Cause | Fix |
|-------|-------|-----|
| Build error | Static top-level import | Dynamic `await import()` |
| `Cannot find module` | File Tracing miss | Remove playwright-extra |
| `ETXTBSY` | Concurrent /tmp binary writes | Sequential execution |
| Bot detection | No stealth plugin | Manual UA + webdriver override |
| 60s timeout | Too many targets | `SCRAPE_TARGET_LIMIT` env var |

---

## Summary — Final Setup at a Glance

```
Packages:
  playwright-core + @sparticuz/chromium

next.config.ts:
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core']
  outputFileTracingIncludes: { '/api/scrape': [...] }

Scraper flow:
  1. Check VERCEL env var
  2. Use @sparticuz/chromium's executablePath + args
  3. Manual stealth (UA headers, webdriver override)
  4. Indeed → Seek sequential execution (prevent ETXTBSY)
  5. SCRAPE_TARGET_LIMIT to control timeout

vercel.json:
  regions: ["syd1"]
```

Switching to `@sparticuz/chromium` actually made the setup simpler. playwright-extra is convenient, but its dependency complexity becomes a liability in Lambda environments.

The result: 38 Seek listings saved to Supabase successfully.

But the excitement was short-lived. `inserted: 38` worked, but checking the actual data — **the content was a mess**. Bot detection wasn't fully bypassed. And even with daily Cron scraping, most listings weren't relevant to me anyway.

How I dealt with that is covered in Part 4.
