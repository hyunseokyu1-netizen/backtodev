---
title: 'Two Different AI Functions Were Writing Resumes in the Same Service — One Better Than the Other'
date: '2026-07-09'
publish_date: '2026-07-14'
description: Following up on a user's subtle quality-comparison feedback led to discovering a duplicated resume-generation API, unified by porting the RAG and prompt techniques, and cleaning up the redundant buttons
tags:
  - Claude API
  - RAG
  - Prompt Engineering
  - Next.js
  - Refactoring
---

## "This one seems better written" — what a gut-feeling piece of feedback revealed

A user gave me this feedback: "the tailored resume feels better written than the workspace resume." Matchda has two screens that rewrite a resume to fit a job posting, and one of them (the "Tailored Resume" button in the list view) produced a better result than the other (the "AI Analysis for This Posting" on the main workspace screen), according to this.

It was qualitative "feel" feedback, but this kind of gut-level comparison often pinpoints an exact code-structure problem. Opening up the code, sure enough — **there were two separate AI functions rewriting resumes within the same service.**

## Investigation — why two

### #1. `generateTailoredResume` (the original function)

- Has **RAG**, searching the user's past tailored resumes for ones relevant to this posting, referencing their phrasing/style
- Even uses the uploaded original resume's **file text** as supporting material
- The prompt explicitly instructs writing **persuasively**, structured as "PROFESSIONAL SUMMARY / KEY SKILLS / WORK EXPERIENCE"
- Output comes back as one solid block of plain text, shown in a modal (popup)

### #2. `tailorResumeForJob` (newly built for the workspace, just the day before)

- Used to rewrite, in-place, the **field-by-field, live-editable** structured resume on the workspace main screen (name, title, summary, skills, experience each as an independent field)
- Company name, title, and dates must never be touched — only `description` (achievement narration) gets rewritten, so the prompt is relatively constrained
- No RAG. Doesn't use the original uploaded file either — only uses the current edit state passed in from the client as supporting material

I also found an amusing fact here. The "Cover Letter"/"Tailored Resume" buttons in the list view and the identically named buttons at the top of the workspace were **using exactly the same API (`generateTailoredResume`)** — meaning these two were pure duplication.

Summarized:

| | generateTailoredResume | tailorResumeForJob |
|---|---|---|
| Supporting material | original resume text + structured data | only the client's current edit state |
| RAG (referencing past resumes) | Yes | No |
| Prompt tone instruction | explicit "persuasive" | relatively constrained |
| Output form | one solid block of plain text (modal) | structured fields (live-edit panel) |
| Used in | list view + workspace top (duplicated!) | workspace main |

The cause of the quality difference became clear — one was given rich material and explicit tone instructions, the other wasn't.

## Why you can't follow a request literally

The user's request was "make the workspace use the same API used over here too." Taken literally, this could be read as "throw away `tailorResumeForJob` and swap it entirely for `generateTailoredResume`."

But doing that causes a problem. `generateTailoredResume`'s output is **one solid block of plain text**, which can't replace the current workspace UI's field-by-field, live-editable structure (name separate, phone number separate, each experience entry independently editable). This was a feature carefully built just the day before — a full swap would mean throwing that feature away entirely.

So I changed direction. **Instead of swapping the API wholesale, I decided to port only the "technique" `generateTailoredResume` uses into `tailorResumeForJob`.** A compromise that keeps the structured editing UI intact while bringing the writing quality up to the same level.

In situations like this, before implementing a request literally, it's worth checking **whether it would sacrifice some other feature that's already well-built.** This time, checking confirmed it would, and "match the output quality while preserving the structure" turned out to be closer to the actual intent.

## The actual work

### Step 1. Extracting shared logic into a separate lib

The RAG retrieval logic (`retrievePastResumes`) was buried as a private function inside `app/actions.ts`, so reusing it in another file would've meant copy-pasting it as-is. I took this opportunity to pull it out into a shared library file.

```ts
// src/lib/resume-rag.ts
export async function retrievePastResumes(profileId: string, jobId: string, jd: string): Promise<string> {
  const { data: past } = await supabaseAdmin
    .from('tailored_resumes')
    .select('job_id, content')
    .eq('user_id', profileId)
    .neq('job_id', jobId)   // exclude the posting currently being generated for
    .not('content', 'is', null)
    .limit(30)
  // ...score relevance via keyword matching, return the top 3
}
```

The helper that serializes the original resume into plain text (`structuredResumeText`) got moved to `src/lib/resume.ts` for the same reason. Right now two functions split it between them, but even if a third resume-generation feature shows up later, it can reuse this as-is.

### Step 2. Feeding the same material into `tailorResumeForJob`

```ts
export async function tailorResumeForJob(
  jobId: string,   // added as a parameter, needed for the RAG search
  current: StudioResume,
  jobContext: { title: string; company: string; description: string | null }
) {
  // ...

  // Same as generateTailoredResume — supplement with the original uploaded file's text as supporting material
  const extraSource = profile.resume_text
    ? `\n\n[Original resume file (supplementary material — reference for details not present in the structured resume above)]\n${profile.resume_text.slice(0, 4000)}`
    : ''

  // RAG: reference phrasing/emphasis style from past tailored resumes
  const { retrievePastResumes } = await import('@/lib/resume-rag')
  const pastContext = await retrievePastResumes(profile.id, jobId, `${jobContext.title} ${jobContext.company} ${jd}`)

  // ...add extraSource, pastContext as supporting material in the prompt
}
```

I also strengthened the prompt instructions, referencing `generateTailoredResume`'s tone.

```
- Write the summary persuasively, placing the strength most relevant to the
  posting in the first sentence (no vague generic self-introductions).
- Write experience descriptions focused on achievements and contributions,
  not a flat list of duties.
```

### Step 3. Recovering the missing `jobId`

For RAG to work, "the posting currently being generated for" needs to be excluded from the search results, which requires `jobId`. But checking, it turned out that a different refactor the day before had entirely removed the `jobId` prop from the workspace component (`WorkspaceResume`) — a trace of a decision made while cleaning up some other feature, that "this component doesn't need jobId anymore." I revived it for this feature.

```tsx
// src/app/workspace/page.tsx
<WorkspaceResume
  jobId={jobId}   // revived
  initialKo={...}
  // ...
/>
```

### Step 4. Cleaning up the duplicate buttons

The list view's "Cover Letter"/"Tailored Resume" buttons had **the exact same functionality already** at the top of the workspace, so I removed the list-view ones. Cleaned up the related state (`showCoverLetter`, `showTailoredResume`), modal rendering, and unused imports along with it. The "Paste JD," "Notes," and "Submitted Documents" buttons were left as-is, since the workspace doesn't have that functionality yet.

```tsx
// Before: 5 buttons (Paste JD, Notes, Cover Letter, Tailored Resume, Submitted Documents)
// After:  3 buttons (Paste JD, Notes, Submitted Documents)
//         Cover Letter / Tailored Resume are now used via the "Workspace"
```

## Verification — confirming the quality actually changed

I checked two things directly with a headless browser.

**① Whether the buttons actually disappeared**

```js
const coverBtn = await page.locator('button:has-text("Cover Letter")').count()
const tailoredBtn = await page.locator('button:has-text("Tailored Resume")').count()
console.log('Cover Letter button:', coverBtn)     // 0
console.log('Tailored Resume button:', tailoredBtn) // 0
```

**② Whether the workspace output actually changed**

Before the fix, experience narration was a flat list; after, it changed to something like this.

```
Built the company's first design system (42 components) from the ground up,
designing and documenting it while working closely with engineers to
shorten design-to-dev handoff time
Led dark mode and accessibility (WCAG AA) support, establishing accessibility
standards across the product
Improved a full redesign of the remittance flow, reducing step-by-step drop-off
from 35% to 18%, demonstrating funnel-metric-driven decision making
```

Sentences noticeably start with action verbs far more often now. And the more convincing evidence: the phrase **"funnel-based decision making"** reappeared in this output — a phrase this user had used in a tailored resume they'd made for a different posting in the past. In other words, RAG genuinely pulled phrasing from a past resume, and this was solid confirmation it was working as intended, not by coincidence.

## Frequently used pattern summary

| Situation | How to handle it |
|---|---|
| Similar AI features built at different times end up with diverging prompts | pull the supporting-material retrieval/serialization logic into a shared lib for reuse |
| "Make this feature over here use what's used over there" request | before swapping the API literally, check whether it sacrifices an existing feature |
| Want to prove RAG "referenced past output" | check whether a distinctive phrase from a past output reappears in the result (evidence it's not coincidental) |

## Summary

```
"This one seems better written" feedback → discovered two separate resume-generation APIs in the code
  → one had RAG + original file + a persuasive prompt, the other a constrained, structure-preserving prompt
  → chose "port only the technique" over a full API swap (preserving the editing feature)
  → extracted RAG/serialization logic into a shared lib → strengthened tailorResumeForJob's material + prompt
  → restored the missing jobId prop → cleaned up the duplicate list-view buttons
  → verified with a headless browser: buttons removed, quality changed (action-verb narration, RAG phrasing reappearing)
```

Two things stuck with me most from this work. One: **a user's gut-feeling "this one seems better" feedback was actually a signal pointing at a structural problem — code duplication.** The other: **the habit of checking, before implementing a request literally, whether it breaks some other feature that's already well-built.** This time, that check is exactly what led to the better conclusion — "match the quality, but preserve the editing feature I just built."
