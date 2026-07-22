---
title: 'Turning a Design Handoff Into a Real Product (4) — Optimizing a Resume Per Job Posting With Claude, and a Bug a Test Caught'
date: '2026-07-01'
publish_date: '2026-07-23'
description: Building an AI feature that analyzes an English resume against a job posting into highlights and an optimization note using Claude, applying anti-hallucination and caching, and catching a note-duplication bug through real testing
tags:
  - Claude API
  - Next.js
  - Supabase
  - AI
---

The last part of the series. The workspace design had one particularly cool element — **highlighting, in green, phrases in the English resume that match the job posting's requirements**, with an **optimization note** below it, something like *"Emphasized your ○○ experience to match this posting's 'distributed systems' requirement."*

In the mockup, this was hardcoded. Part 4 is the story of turning this into a **real AI feature.** Comparing a generic English resume against a specific posting's JD, and **generating the highlights and note with Claude.**

## Prep — a place to cache the result

Calling AI every single time the page opens is slow and expensive. So I decided to cache the analysis result. Conveniently, the `matches` table is already scoped per (user, job posting), so a single JSONB column here was enough.

```sql
-- migration 014
ALTER TABLE matches ADD COLUMN IF NOT EXISTS optimization JSONB;
```

Storage shape: `{ highlights: ["..."], note: { keyword, body }, generated_at }`.

> This is exactly the column behind why I used `select('*')` in Part 2, saying "safe both before and after the migration is applied." Reading doesn't break even before this column exists.

## Step 1. Prompt design — JSON only, substrings only

I give it the English resume's experience sentences and the posting's JD, and get back highlights and a note as JSON. The single most important rule is **"a highlight must be an exact substring that exists as-is in the original resume text"** — otherwise the frontend can't match up the highlight.

```
Format:
{
  "highlights": ["a key phrase from a resume sentence that matches the job posting's requirements"],
  "note": { "keyword": "'the key English keyword'", "body": "a one-sentence Korean explanation" }
}
Rules:
- Each item in highlights must exist as an exact substring inside [the English resume sentences].
- Do not invent new sentences.
```

For the model, I used `claude-haiku-4-5`, same as the existing code (fast, cheap, plenty for classification/extraction).

## Step 2. Preventing hallucination — filtering once more in code

Even with "don't invent things" in the prompt, you only get peace of mind by **actually verifying it in code.** Of the highlights the model returned, I only accepted the ones that **genuinely exist in the original resume text.**

```ts
const haystack = bullets.join('\n')
const highlights = (parsed.highlights ?? [])
  .filter((h) => typeof h === 'string' && h.trim())
  .filter((h) => haystack.includes(h))   // ← discard anything not in the original
  .slice(0, 4)
```

In actual testing, all 4 highlights the model gave were genuine substrings of the original — zero hallucinations. But having this filter in place prevents an accident where an occasionally invented phrase makes it onto the screen.

## Step 3. Caching + a UI trigger

Since analysis costs AI spend, it's run via a **button**, not automatically. The client button calls a server action, and once it's done, `router.refresh()` re-renders from the server.

```tsx
'use client'
async function handleClick() {
  setLoading(true)
  const res = await generateWorkspaceOptimization(jobId)
  if (res.error) { setError(res.error); setLoading(false); return }
  router.refresh()   // the server renders highlights/note from the cached result
}
```

A posting that's already been analyzed reads from the cache and displays instantly, with the button disappearing.

## Troubleshooting — a note-duplication bug caught by testing

This is where the real lesson of this post shows up. Without an environment where I could click through the UI directly, I **ran the button's exact logic against a real posting and a real JD** to verify it. And the rendered note came out like this.

```
Product lifecycle... from the Vp Verbund Pflegehilfe posting
Emphasized your... to match the 'product lifecycle...' requirement from the Vp Verbund Pflegehilfe posting...
```

**The prefix showed up twice.** Here's why.

- The render template: `{company}'s posting's {keyword} {body}`
- But the model was also including `"{company}'s posting's {keyword} ..."` inside `body` → duplication

The fix was two-layered.

1. **Strengthened the prompt** — "never include the company name, keyword, or 'posting's' inside body; write only the description that follows directly"
2. **Defensive code** — strip the leading prefix if it repeats anyway

```ts
if (job.company) {
  body = body.replace(new RegExp(`^${esc(job.company)}\\s*posting's\\s*${esc(keyword)}\\s*`), '')
}
body = body.replace(new RegExp(`^${esc(keyword)}\\s*`), '').trim()
```

Re-verifying, it rendered cleanly, exactly once. **Had I not been able to exercise the logic, this duplication would only have been discovered after shipping.**

As a bonus, a test script that was missing a guard briefly wrote a meaningless value into one row of real data during testing, which I immediately restored to `optimization = null` (real-data testing should always come with a rollback plan built in).

## Summary

How to attach an AI feature "honestly."

1. **Cache the result** — a single JSONB column scoped per (user, job posting) is enough
2. **Instruct via prompt, verify via code** — block hallucination with a substring filter
3. **AI calls via an explicit button** — let the user trigger anything slow and expensive
4. **Tests catch bugs** — if you can't click through the UI, run the logic directly against real data instead
5. **Always pair real-data testing with a rollback plan**

## Wrapping up the series

Starting from a single-HTML-file design handoff, I went through reproduction → wiring up real data → connecting the funnel → AI optimization. Looking back, the same principle held at every stage — **reuse what exists, don't invent what doesn't, and run it directly yourself when in doubt.** Turning a design into code, in the end, was the process of layering honest data and behavior, one layer at a time, onto a pretty mockup.
