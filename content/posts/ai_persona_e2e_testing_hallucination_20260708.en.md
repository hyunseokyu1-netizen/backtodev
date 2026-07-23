---
title: 'I Told the AI to "Pretend You''re a Job Seeker and Try It" — It Caught a Real Bug'
date: '2026-07-08'
publish_date: '2026-08-24'
description: Creating a fictional job-seeker persona and driving it through a headless browser from signup all the way to RAG tailored-resume generation, and how I fixed the AI fact-fabrication bug found along the way
tags:
  - Playwright
  - Claude API
  - RAG
  - QA Automation
  - Prompt Engineering
---

## Why I tested it this way

What's the most reliable way to confirm the resume service I built actually works well? Not reading the code, not running unit tests. It's **using it start to finish like a real user would.** This time, I created a fictional persona — "a 5-years-experienced product designer dreaming of working abroad" — and drove the entire flow myself, from signup to the moment AI writes a tailored resume.

I didn't just eyeball it and call it done. I **actually launched a browser,** entered values into forms, clicked buttons, and screenshotted the result screens. In the process, I found a bug that looked perfectly fine on the surface but was actually fabricating facts. This post is the record of that process.

## Prep work — when there's no browser automation tool available

Usually a task like this uses a dedicated browser-automation MCP tool, but that wasn't available in this environment. Instead, I decided to reuse `playwright-core`, which was already installed in the project for scraping. There was existing code where the job-posting scraper rendered pages with a headless browser to bypass bot blocking — I reused the exact same package.

```bash
# playwright-core exists, but the browser executable might not — check the cache
ls ~/Library/Caches/ms-playwright/
# if you see chromium-1228, chromium_headless_shell-1228, etc., it can be reused
```

Since Chromium was already cached locally, I launched the browser by specifying the executable path directly.

```js
const { chromium } = require('/path/to/node_modules/playwright-core')

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/.../ms-playwright/chromium_headless_shell-1228/.../chrome-headless-shell',
})
```

I ran the **dev server in the background and confirmed it was responding via `curl`.** Rather than blindly waiting with something like `sleep 5`, polling to check whether the port is actually open is far more reliable.

```bash
npx next dev -p 3999 &
until curl -sf http://localhost:3999/ >/dev/null; do sleep 1; done
```

## Step 1. Getting past email verification with no human involved

Most services send a confirmation email after signup. An automation script can't open an inbox, so it gets stuck at this step. Fortunately, Supabase can create a user with email verification already marked complete, via the admin API.

```js
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data } = await admin.auth.admin.createUser({
  email: 'haneul.kim.eval@gmail.com',
  password: 'EvalPersona2026!',
  email_confirm: true, // skip the confirmation-email step
})
```

In practice, I first attempted signup through the UI and got the response "we sent a confirmation email," then used the admin API to pinpoint and verify just that one account. **Matching exactly by email and only touching that one account** matters — the service role key ignores RLS, so mistakenly touching the wrong account could contaminate real user data.

## Step 2. Filling out a resume with the persona

I created a person — "Haneul Kim, 5-years-experienced product designer" — and actually entered their details. Fintech app redesign experience, design system-building experience, Figma/user research skills, and so on.

```js
await page.fill('input[placeholder*="Name"]', 'Haneul Kim')
await page.fill('input[placeholder*="Title"]', 'Product Designer')
await page.fill('textarea[placeholder*="Key Experience"]',
  "I'm a product designer with 5 years of experience. I redesigned a fintech app's money-transfer flow and significantly reduced drop-off rates...")
// experience, education, and skills entered in order too
```

After saving and syncing to English, I pasted in and registered a real job posting (Canva Product Designer). The match score came out to **92%.** Seeing the JD's keywords ("design system," "user research," "accessibility") overlap well with the resume's actual experience, the matching logic itself was working reasonably.

## Step 3. Confirming RAG actually works

This service has a RAG (retrieval-augmented generation) feature that writes a resume tailored to a new posting by referencing tailored resumes the user made in the past. To verify this actually works, **at least two postings need to be registered.**

1. Generate a tailored resume for the Canva posting (1 saved)
2. Add an Atlassian "Senior Product Designer, Design Systems" posting
3. Generate a tailored resume again from this posting

The second generation's result showed this banner.

> ✨ We referenced 1 previously written tailored resume to fit this posting.

Looking at the actual generated text, phrasing like "funnel-based decision making" used in the first resume carried over naturally into the second one too. This was the moment I directly confirmed it was working as designed.

## Step 4. What I found reading the output carefully — 3 fabricated facts

If I'd stopped here, I would have moved on thinking "RAG works great" — but I read the full generated resume text from start to finish. Doing so, I found three problems.

| Problem | Actual generated value | Original data |
|---|---|---|
| Email | `haneul.kim@email.com` | `haneul.kim.eval@gmail.com` |
| Location | Listed the posting's work location (Sydney, Remote) as if it were the applicant's residence | Doesn't exist (never entered) |
| Title | Senior Product Designer | Product Designer |

Every single one was the kind of lie that's plausible enough to go unnoticed. The email domain changing from gmail.com to email.com is easy to skim past, and using the posting's work location as the applicant's residence looks contextually natural too. The title inflation is even more dangerous — applying with a seniority level that doesn't exist on the real resume gets found out immediately in an interview.

## Step 5. Pinning down the cause — the prompt never provided the info it asked to fill in

Opening the code, the cause was clear.

```
## Writing requirements
- Structure: name/contact info → PROFESSIONAL SUMMARY → KEY SKILLS → WORK EXPERIENCE → EDUCATION
```

The prompt instructs "include name and contact info," but **the actual contact data was never fed into the prompt in the first place.** From the model's perspective, this reads as "there's name info but no contact info? The resume format requires it, so let's make up something plausible." The title problem came from the instruction to "restructure to match the JD's requirements" being far too broad, letting the model change even the seniority level at its own discretion.

## Step 6. The fix — provide real data, and specify what not to do

```ts
// the applicant's real contact info — provided explicitly so the model can't fabricate it
const realContact = [email, profile.phone, en.links]
  .map(v => v?.trim()).filter(Boolean).join(' · ')
```

```
## Applicant's real contact info (use exactly as written below — do not alter or add to it)
${realContact || '(no contact info — do not output a contact line at all)'}

## Writing requirements
- For contact info (email, phone, links), use only the "real contact info" above, exactly as given.
  Never fabricate an email address, place of residence, or location
  (do not output a location absent from the original — never use the posting's
  work location as if it were the applicant's location)
- Keep the title from the original resume. Never arbitrarily raise it to match the
  posting's seniority level (Senior, etc.)
```

Two things mattered most. **①** Don't just request "this info is needed" — **actually fill that information into the prompt.** **②** A "don't do X" instruction needs to be pinned down with a concrete scenario ("don't use the posting's work location as the applicant's location") — otherwise the model finds an escape route around it.

After the fix, I regenerated with the same posting and directly checked the actual text saved in the DB.

```
Contains a fake email (@email.com): ✓ none
Contains the real email: ✓ haneul.kim.eval@gmail.com
Location fabrication: ✓ none
Title: ✓ Product Designer (original preserved)
```

## A bonus catch — a React hydration warning

While testing, I kept an eye on the browser console log, and even though nothing looked wrong on screen, a hydration mismatch warning was sitting in the console.

```
- aria-describedby="DndDescribedBy-0"
+ aria-describedby="DndDescribedBy-2"
```

When `dnd-kit`'s `DndContext`, used in the kanban board, isn't given a unique `id`, the accessibility attribute (`aria-describedby`) it auto-generates internally ends up numbered differently at server-render time versus client-render time. Giving it a fixed `id` value fixes it.

```tsx
<DndContext id="kanban-board" sensors={sensors} ...>
```

Nothing looked wrong on screen at all — this is a warning I would have missed entirely if I hadn't checked the console.

## Common patterns, summarized

| Purpose | Approach |
|---|---|
| Driving a real flow via headless browser | `playwright-core` + specifying a locally cached Chromium executable path |
| Creating a test account with no email verification | Supabase's `admin.auth.admin.createUser({ email_confirm: true })` |
| Confirming the dev server is up | Poll via `curl` instead of `sleep` |
| Verifying an AI feature | Screenshots + directly querying **the actual value stored in the DB** to cross-check |
| Preventing React hydration warnings | Give a fixed `id` to components whose values can diverge between server and client (DndContext, etc.) |

## Summary

```
Design a persona → drive the entire flow via headless browser, from signup to resume generation
  → verify the result via screenshots + DB values → confirm RAG works correctly
  → read the output carefully, like a human → find 3 fabricated facts
  → cause: the prompt never actually provided the info it required
  → fix: inject real data + specify forbidden scenarios concretely
  → regenerate and re-verify against DB values
```

The biggest impression left by this work is that **there's a wider gap than expected between an AI feature "looking like it works well" and "actually being accurate."** Even with a high match score and smooth-sounding sentences, a quietly fabricated email address can still be mixed in. A human using it start to finish and reading the result letter by letter — I felt once again that this is a verification method that's genuinely hard to replace, even with automated testing.
