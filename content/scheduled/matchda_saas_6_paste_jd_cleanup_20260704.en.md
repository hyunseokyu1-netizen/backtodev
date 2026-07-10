---
title: 'Building a SaaS With an AI Coding Assistant (6): A Logo Mismatch, Managing 171 Postings, and Ctrl+A-Paste Analysis'
date: '2026-07-04'
publish_date: '2026-08-05'
description: Fixing a brand mismatch where the favicon and the in-app logo differed, the management problems that emerged once collected postings ballooned to 171 (edit mode, unscored filter), and AI analysis of a pasted-in full job description for sites where scraping fails
tags:
  - Next.js
  - Claude API
  - SaaS
  - UX
  - AI Coding Assistant
---

## Starting off

Part 5 verified the full Stripe billing cycle end-to-end. This part covers the remaining work that continued the same day. None of it is as dramatic as billing, but it's exactly the kind of problem you're guaranteed to run into once a product is actually being used.

- A **brand mismatch** where the favicon was the final icon, but the logo inside the app was still the old one
- The management problems that emerged once collected postings ballooned to **171**
- **AI analysis of a pasted-in full job description**, for sites where URL scraping fails

All three are less "building a new feature" and more "patching a hole that only showed up once something already built was actually being run."

## Step 1. The favicon and the in-app logo didn't match

The browser tab's favicon was the final, confirmed handshake-M mark, but the logo inside the app — sidebar, footer, header — was still a **hand-drawn approximation SVG** (`HandshakeMark`). The favicon work had been finished first, and the in-app logo — a temporary "similar-looking SVG component" — had just stayed that way. Once you noticed the tab icon and the app logo were subtly different, it kept nagging at you.

The fix was simple (`eb514c6`). Copy the final icon file `icon-512.png` to `public/matchda-mark.png`, and replace all three places drawing the logo with `next/image`.

```diff
// src/components/matchda/dashboard/Sidebar.tsx
-import { HandshakeMark, LayoutDashboard, FileText, Target, Briefcase } from '../ui/icons'
+import Image from 'next/image'
+import { LayoutDashboard, FileText, Target, Briefcase } from '../ui/icons'

-        <div className="h-[30px] w-[30px] overflow-hidden rounded-lg bg-[#046C4E]">
-          <HandshakeMark size={30} className="block text-white" />
-        </div>
+        <Image src="/matchda-mark.png" alt="MatchDa" width={30} height={30} className="rounded-lg" />
```

The now-unused `HandshakeMark` SVG component got deleted. The lesson is simple. **A brand asset should have exactly one source of truth.** When copies of the same mark exist in two forms — "a separate icon file, and a separately hand-drawn SVG" — they will eventually drift apart. Once I switched every location to reference the one actual file (`matchda-mark.png`), it was no surprise the diff skewed heavily toward deletion (-34 lines, +7 lines).

## Step 2. 171 collected postings — once it starts piling up, management becomes a feature

Running the one-click recommended-company collection built in Part 4 for a few days, the collected postings in Discover grew to **171.** Collection worked great, but there was no way to clean them up. A one-by-one delete button existed, but it was meaningless against 171 entries, and postings with no score were mixed into the list, blurring what was even worth looking at.

So in commit `84aa519`, I bolted on management tools.

### Edit mode + multi-select delete (soft delete)

Hitting the edit button shows a checkbox on every card, with select-all/deselect-all and bulk delete. One important decision here — **"delete" is a soft delete, not a DB row deletion.**

```ts
// src/app/discover/actions.ts
/** Multi-select delete in edit mode — soft delete (status='dismissed'), not a row delete */
export async function dismissDiscoveredJobs(
  discoveredJobIds: string[]
): Promise<{ dismissed?: number; error?: string }> {
  // ... login/profile check

  const ids = (discoveredJobIds ?? []).filter(Boolean).slice(0, 500)
  if (ids.length === 0) return { error: 'No postings were selected.' }

  const { data, error } = await supabaseAdmin
    .from('discovered_jobs')
    .update({ status: 'dismissed' })
    .in('id', ids)
    .eq('user_id', profile.id)
    .select('id')
  ...
}
```

After the data-loss incident covered in Part 2, this project adopted the principle of "never delete a DB row." Bulk "delete" here is really just a `status='dismissed'` update, so even a mistaken delete can be recovered by simply reverting the status. It's a clear example of one incident becoming a design principle that seeps into every feature built afterward. I also didn't forget the `.eq('user_id', profile.id)` filter that prevents touching anyone else's postings.

### An "unscored" filter — postings with no score aren't a bug, they're by design

Some of the collected postings have no score at all. This is intentional.

- Postings that fail the keyword pre-filter at collection time are saved without scoring (running everything through Haiku, including postings that look irrelevant to my field, would waste money)
- Even postings that pass the pre-filter get saved without a score once they exceed the per-collection scoring cap (50 postings)

Until now, these postings were ghost entries that never showed up in any score filter. I added an "unscored" chip to the score filter so they can be explicitly gathered and viewed.

```ts
type ScoreFilter = 'all' | '70' | '40' | 'unscored'

if (scoreFilter === 'unscored') {
  if (j.match_score !== null) return false
} else if (scoreFilter !== 'all' && (j.match_score === null || j.match_score < Number(scoreFilter))) {
  return false
}
```

### Individually scoring an unscored posting

If, browsing the unscored list, a posting catches your eye as "hey, this actually looks decent," a "Score it" button on the card runs Haiku scoring for just that one posting (`rescoreDiscoveredJob`). Bulk automatic scoring stays cost-controlled via the cap, while a posting the user has shown interest in can get on-demand AI treatment — a reasonable middle ground.

## Step 3. When scraping fails — work around it via Ctrl+A paste

MatchDa's default flow is "paste the posting URL → scrape → AI match," but on sites that block bots or render in unusual ways, scraping fails and produces a "title couldn't be parsed" card. No matter how sophisticated URL scraping gets, it can't beat every site.

So I flipped the approach. **The user is already looking at that posting page in their browser anyway.** So have them select all with `Ctrl+A` → copy with `Ctrl+C` → paste it in, and let AI handle removing the noise (`18af52d`).

```ts
// src/app/actions.ts — parseJobText (excerpt)
const message = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 3000,
  messages: [{
    role: 'user',
    content: `Below is text copied via select-all (Ctrl+A) from a job posting web page. It has noise mixed in — menus, ads, footers. Extract only the core job-posting information.

## Raw text
${text.slice(0, 15000)}

## Extraction rules
- title: job title (keep original language)
- company: company name
- location: work location (empty string if none)
- salary: salary info (only if explicitly stated, empty string otherwise)
- description: clean and reconstruct just the job posting body (key responsibilities, requirements, nice-to-haves, etc. Remove menu/ad/irrelevant text. Keep original language, max 2000 characters)

Respond with JSON only. ...`,
  }],
})
```

A `Ctrl+A` copy comes with navigation menus, ads, recommended postings, and footer links all mixed in. Stripping this out with regex or heuristics is a hell you'd have to rewrite per site, but for an LLM, "pick out just the posting body from the noise" is exactly the kind of task it's good at. I actually tested it by pasting in a messy Seek-style page dump (menu + recommended-postings list + footer all jumbled together), and it cleanly pulled out the title, company, location, salary, and a cleaned-up JD.

I built two entry points for this.

| Entry point | Behavior |
|---|---|
| "Auto-fill from paste" in the manual-add modal | Paste → analyzed by `parseJobText` → form fields auto-fill (user reviews, then saves) |
| The "Enter JD manually" button on a parse-failure card | Paste → `fixJobWithText` corrects the existing posting and **runs automatic matching too** |

The second path matters especially. A "title couldn't be parsed" dead-end card is now a card the user can self-recover. The correction action only allows edits after first confirming the posting belongs to the user's own list, and once the JD is filled in, it goes straight on to compute a match score in the same step.

```ts
// fixJobWithText (excerpt) — auto-match right after correction
const res = await parseJobText(rawText)
if (res.error || !res.parsed) return { error: res.error ?? 'Analysis failed' }

await supabaseAdmin.from('jobs').update({
  title: p.title, company: p.company || null, location: p.location || null,
  salary: p.salary || null, description: p.description || null,
}).eq('id', jobId)

if (p.description) {
  const matchRes = await matchSingleJob(jobId)  // AI matching immediately after the fix
  ...
}
```

### Reflecting it in the chatbot's knowledge base too — closing the self-service loop

Lastly, I added this usage info to the knowledge base of the support chatbot built in Part 4.

```
- 3 ways to add a posting:
  1) Paste the job posting URL (Seek, Indeed, LinkedIn, Glassdoor, etc.) → "Add"
  2) "Add manually" button → on the posting page, Ctrl+A (select all) → Ctrl+C (copy),
     then paste into the "auto-fill from paste" field and "Analyze with AI to fill in"
  3) Manual field-by-field entry
- If you added it by URL and it shows "title couldn't be parsed": use the "Enter JD manually"
  button on the card → copy and paste the entire posting page, and AI will re-analyze it,
  fill it in, and run matching.
```

Building the feature isn't the finish line — the self-service support loop only closes once a user asking the chatbot "I can't add a posting" actually gets pointed to this workaround. That's why the knowledge-base update rode along in the same commit as the feature.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| Brand assets | Every location references one source file — never leave a hand-drawn copy behind |
| Bulk-delete UI | Soft delete (`status='dismissed'`) + a user_id filter, never a row delete |
| Controlling AI scoring cost | Limit automatic scoring via a pre-filter + scoring cap, use on-demand individual scoring for items of interest |
| Handling scraping failures | Ctrl+A select-all copy → an LLM cleans noise and structures it (no per-site parser needed) |
| Shipping a new feature | Update the chatbot's knowledge base in the same commit — keeps the self-service loop intact |

## Summary

1. **Anything drawn "temporarily" absolutely has to go on a cleanup list.** The SVG hastily drawn to be "close enough" during the favicon work passed itself off as the final logo for weeks. A temporary artifact solidifies in place unless you decide, at the moment you make it, when it'll actually get replaced.
2. **A collection feature needs a management feature to follow it.** It only became clear that edit mode, filters, and individual scoring were needed once 171 entries had piled up. Any feature whose data grows over time needs to be built while imagining "the screen after it's grown."
3. **A good workaround beats a perfect parser.** Instead of fighting to beat every site's scraping defenses, having the user copy-paste a page they're already looking at and letting AI handle the cleanup turned out to be far more robust. The product isn't about eliminating failure cases — it's about designing what happens next when one occurs.
4. **An incident becomes a principle, and a principle seeps into the code.** The data-loss incident from Part 2 became the principle "only ever soft-delete," and this multi-select delete feature was built safely on top of that principle from the very start.

Across these six parts of the series, I've recorded the journey of one SaaS built with an AI coding assistant — from a URL redesign, through a data incident, RAG, a chatbot, monetization, and finally patching the holes that operating it for real exposed — going from "a pile of code" to "a product that moves real money and explains itself." Next up is real user feedback, and the improvements that follow from it.
