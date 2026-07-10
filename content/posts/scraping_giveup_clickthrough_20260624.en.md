---
title: "Knowing When to Give Up on Scraping Is a Skill Too: Landing on a Click-Through Fallback After Fighting Cloudflare + an SPA"
date: '2026-06-24'
publish_date: '2026-07-12'
description: A record of throwing a stealth browser at scraping Canva's careers page, giving up, then finding the real cause through diagnostic logs and wrapping up with a practical fallback
tags:
  - Web Scraping
  - Cloudflare
  - Playwright
  - Vercel
  - Debugging
---

I'm building a side project that automatically collects job postings. Register a company's careers page URL, and it scrapes the listings and scores them against my match with my background. Standard ATS platforms like Greenhouse and Lever were easy since they have public APIs — the problem was **custom-built careers pages.** So I built a generic fallback: "grab the entire HTML and extract the job list with AI (Claude Haiku)."

Most of it worked fine. But one site, **Canva**, kept giving me trouble to the very end. This post is a record of throwing everything I had at cracking that one site, and eventually **giving up and moving to a practical alternative.** It's also about the two **wrong conclusions** I reached along the way, and the **diagnostic logging** that corrected them.

## Round 1: A 403, and a stealth browser

At first, I just used a plain `fetch` to grab the HTML. Canva returned `403 Forbidden`. Classic bot blocking.

My first response was **browser-like headers.** Filling in User-Agent, `Sec-Fetch-*`, `Accept-Language`, and others got sites like Trivago through (403 → 200). But Canva still returned 403. The response headers gave the answer.

```
server: cloudflare
cf-ray: ...
```

**Cloudflare Bot Management.** Header spoofing alone doesn't get through this. So I added a **headless browser (Playwright)** fallback. Rendering the page with a real browser could pass the JS challenge.

Bare Playwright showed an "Attention Required" block page, but adding **`playwright-extra` + `puppeteer-extra-plugin-stealth`** (a plugin that hides automation fingerprints), which was already installed, got through **3 out of 3 attempts locally.** A real, 109KB Canva page came through.

"Got it!" I thought. Deployed it. And then **started guessing wrong, twice in a row.**

## Wrong guess 1: "module not found" (dependency-tracing hell)

After deploying, clicking to collect data produced a new error.

```
Cannot find module 'is-plain-object'
Require stack:
  - .../clone-deep/utils.js
  - .../merge-deep/index.js
  - .../puppeteer-extra-plugin-stealth/index.js
```

This is a trap in the Vercel serverless environment. The stealth plugin internally loads `evasions/*` modules via **dynamic require**, and its dependency tree runs deep, like `merge-deep → clone-deep → is-plain-object`. Next.js's bundler (NFT, node-file-trace) **can't follow dynamic requires**, so it fails to bundle these deep dependencies into the lambda (serverless function).

The fix was to **explicitly list the entire dependency closure** in `next.config.ts`'s `outputFileTracingIncludes`. A single glob pattern didn't cut it at first, so I ended up writing a script to recursively collect the dependency tree, listing all 40 packages.

```ts
// next.config.ts
const STEALTH_DEP_TREE = [
  'playwright-extra', 'puppeteer-extra-plugin-stealth',
  'merge-deep', 'clone-deep', 'is-plain-object', 'kind-of', /* ...40 packages */
]
const BROWSER_TRACE_GLOBS = STEALTH_DEP_TREE.map(p => `./node_modules/${p}/**`)

export default {
  serverExternalPackages: ['playwright-core', 'puppeteer-extra-plugin-stealth', /* ... */],
  outputFileTracingIncludes: {
    '/discover': BROWSER_TRACE_GLOBS,  // the route where the server action runs
  },
}
```

> Key point: a Server Action executes **within the function of the page route that calls it.** So the tracing needed to be attached to `/discover`, not `/api/scrape`.

The module error was gone. But — **still zero results.** No error, just zero postings. That's where the second wrong guess came in.

## Wrong guess 2: "it's a datacenter IP block"

No error, zero results. I concluded this.

> "Stealth hides the automation fingerprint, but **Cloudflare also weighs IP reputation.** A datacenter IP like Vercel's scores low, so even with a perfect fingerprint, it gets a block page. That's why the empty page returns zero. This isn't something code can get through."

Sounded plausible. Passing locally (a residential IP) and blocked on Vercel (a datacenter IP) seemed logically consistent. So I even wrote code to **"detect a block page and mark it as uncollectible."**

That didn't work either. Still just "zero results." After two wrong guesses in a row, I decided to stop guessing.

## Diagnostic logging changed everything

Instead of guessing in my head anymore, I decided to log **what production was actually receiving.** Just one line.

```ts
const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
console.log(`[scrapeGeneric] url=${url} htmlLen=${html.length} title="${title}"`)
```

Deployed it, clicked collect, checked `vercel logs`. The result was shocking.

```
[scrapeGeneric] url=...canva... htmlLen=109427 title="Find your dream job | Canva Careers"
```

**It wasn't a block page.** It was the real, 109KB Canva careers page. Even the title was accurate. In other words, **production's stealth browser was getting through Cloudflare just fine.** My "datacenter IP block" conclusion was completely wrong.

So why zero results? The problem wasn't the collection step — it was **the next step, AI extraction.**

## The real cause: AI can't read an SPA

This time, I reproduced the entire pipeline locally, exactly. Fetched the real Canva HTML via stealth, ran it through the same preprocessing (strip scripts → compress → slice), and fed it to Haiku.

```
htmlLen=109460  strippedLen=69903
href total=116 / within 40000 chars=51
Haiku response: {"jobs": []}   ← 0 results
```

Even with perfectly good HTML containing 51 hrefs, **Haiku said 0 postings.** Canva is a heavy **SPA (client-rendered)**, so postings aren't rendered as meaningful `<a>` tags — they show up as obfuscated divs and hashed class names. Visible to a human eye, but the extracted HTML text gave the AI no clue that "this is a job posting."

On top of that, trying once more locally, this time Cloudflare returned a **5xx error page.** In other words, the stealth pass rate was **inconsistent.** So Canva had:

1. **Cloudflare gets through by chance** (not guaranteed every time)
2. **Even when it gets through, it's an SPA, so AI can't read the postings**

Two layers of walls. Not something code could dig through.

## Decision: give up, and go with a click-through fallback

Here I made an important judgment call. **"Is it worth digging into this further?"**

- Adding a paid scraping API (residential IP + JS rendering) just for Canva is overkill.
- Most custom-built sites (Trivago, etc.) already work fine.
- What the user actually wants is "seeing that company's postings," not "postings landing in my DB."

So I went with the simplest answer. **For sites that fail to collect, clicking the company name opens the original careers page in a new tab.**

```tsx
<a href={s.url} target="_blank" rel="noreferrer"
   className="text-sm font-semibold hover:text-blue-600 hover:underline"
   title="Open careers page">
  {s.name}
</a>
```

A few lines of code. Done. Even if "AI extraction" fails, the user reaches the real page with one click. As a bonus, for other sites where AI extraction was cutting off postings further down the page, I also raised the slice limit from 40k to 100k (Haiku has a 200K context, so there's room).

## Summary: what I learned from this ordeal

Building one feature, I made two wrong guesses in a row and ended up "giving up," but the lessons that remain are clear.

1. **Stop guessing and log it.** I nearly burned two days on the plausible hypothesis "blocked because it's a datacenter IP." One line of `console.log` revealed the truth (not blocking, but AI extraction failure) in 5 minutes. **A log is the cheapest, most powerful debugger.**

2. **No error doesn't mean success.** "No error, zero results" was the most confusing part. Watch out for failures that quietly disguise themselves as success.

3. **Giving up is design too.** Scraping every single site at 100% is impossible. Recognizing the point where effort-to-benefit tapers off, and leaving open **"a path that doesn't block the user when it fails"** (a click-through fallback), makes for a better product.

4. **Watch out for dynamic requires in serverless environments.** Packages that dynamically `require`, like the stealth plugin, can't be followed by the bundler, so you need to manually handle the dependency tree with `outputFileTracingIncludes`.

The biggest lesson is the first one. **When you hit a wall, don't script out a scenario in your head — just log it and check.** A single log line is far more honest than the "plausible story" I built.
