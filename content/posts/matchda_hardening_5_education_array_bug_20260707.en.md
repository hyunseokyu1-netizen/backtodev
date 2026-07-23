---
title: 'Hardening MatchDa (5): Only One Education Entry Ever Showed — The Type Design Was the Problem'
date: '2026-07-07'
publish_date: '2026-08-23'
description: Tracing a bug where a resume always showed only one education entry, and finding the cause was a type designed as a single object instead of an array
tags:
  - TypeScript
  - React
  - Bug Tracing
  - Type Design
  - Next.js
---

## The situation

I got a report saying "I registered 2 education entries on my resume, but the workspace screen only shows 1." Bugs like this turn out to be quietly common once you've dealt with a few. My first thought was "the screen was probably only ever tested with one education entry" — but actually tracing the code, it turned out to be a far more fundamental problem.

## The tracing process

First, I mapped out the path data takes on its way to being rendered as education on screen.

```
Profile DB (onboarding_en, JSONB — stores an education array)
  → toStudioResume()      : DB JSON → StudioResume type (still an array up to here)
  → studioToDoc()          : StudioResume → ResumeDocumentData (for rendering)
  → the ResumeDocument component : draws it on screen
```

The DB clearly had education stored correctly as an array. Checking, both entries were genuinely there.

```
Education count: 2
  - California State University, Long Beach / Computer Science / B.S. (2015)
  - Grossmont College, San Diego, CA / Biology (2009 – 2011)
```

But looking at the type definition for `ResumeDocumentData` — the stage right before rendering — the cause was immediately visible.

```ts
// src/lib/matchda/types.ts (before the fix)
export interface ResumeEducation {
  org: string
  period: string
}

export interface ResumeDocumentData {
  name: string
  title: string
  contact: string
  experiences: ResumeExperience[]   // an array
  skills: string[]                  // an array
  education: ResumeEducation        // ← a single object, not an array!
}
```

`experiences` and `skills` are arrays that can hold multiple entries, but `education` alone was a single object. So the conversion function that fills in this type was forced to pick out only one education entry.

```ts
// src/lib/resume.ts (before the fix)
export function studioToDoc(r: StudioResume, contact: string): ResumeDocumentData {
  const exps = r.experience.filter(e => !e.hidden)
  const edu = r.education.filter(e => !e.hidden)[0]   // ← [0], takes only the first
  return {
    // ...
    education: edu
      ? { org: [edu.school, edu.major || edu.degree].filter(Boolean).join(' — '), period: edu.period }
      : { org: '', period: '' },
  }
}
```

`.filter(e => !e.hidden)[0]` — it was pulling out only the **first one** among non-hidden education entries. No matter how many education entries were registered, the type itself had pinned down "education is exactly one" as a fact — that was the root cause.

The nature of a bug like this is that the type system, rather than helping, actually hides the problem. TypeScript compiles `education: ResumeEducation` with no error whatsoever, exactly as the type says. The wrong premise — "there will be one education entry" — is itself baked into the type, so from the compiler's perspective, there was nothing at all strange about this code.

## Step 1. Mapping the blast radius first

Changing one type sounds simple, but every place using that type needs to be found to fix it completely. I swept it with `grep`.

```bash
grep -rn "\.education\|ResumeEducation" src/lib src/components --include="*.ts" --include="*.tsx"
```

The result turned up 6 spots.

| File | Role |
|---|---|
| `types.ts` | Type definition (`education: ResumeEducation` → to an array) |
| `studioToDoc` in `resume.ts` | Studio data → render-ready conversion |
| `docToRender` in `resume.ts` | Render-ready → download (PDF/DOCX) conversion |
| `matchda/data.ts` | DB data → render-ready conversion (the workspace's real-data path) |
| `matchda/mock-data.ts` | Demo mockup data |
| `ResumeDocument.tsx` | Actual on-screen rendering |
| `WorkspaceResume.tsx` | Rendering the edit preview on the left side of the workspace |

## Step 2. Making the type an array first

```ts
// After
export interface ResumeDocumentData {
  // ...
  education: ResumeEducation[]   // changed to an array
}
```

## Step 3. Changing conversion functions from `[0]` to `.map()`

```ts
// resume.ts — studioToDoc (After)
export function studioToDoc(r: StudioResume, contact: string): ResumeDocumentData {
  const exps = r.experience.filter(e => !e.hidden)
  const edu = r.education.filter(e => !e.hidden)   // [0] removed — keep everything
  return {
    // ...
    education: edu.map(e => ({
      org: [e.school, e.major || e.degree].filter(Boolean).join(' — '),
      period: e.period,
    })),
  }
}
```

I fixed `data.ts` (the function converting real DB data for the workspace) with the same pattern.

```ts
// matchda/data.ts (After)
const edu = (resume.education ?? []).filter((e) => !e.hidden)
// ...
education: edu.map((e) => ({
  org: [e.school, e.major || e.degree].filter(Boolean).join(' — '),
  period: e.period ?? '',
})),
```

## Step 4. Turning the on-screen rendering into a loop

```tsx
// ResumeDocument.tsx (Before)
<div className="flex items-baseline justify-between">
  <div>{doc.education.org}</div>
  <div>{doc.education.period}</div>
</div>
```

```tsx
// ResumeDocument.tsx (After)
{doc.education.map((edu, ei) => (
  <div key={`${edu.org}-${ei}`} className={ei > 0 ? 'mt-[6px]' : ''}>
    <div>{edu.org}</div>
    <div>{edu.period}</div>
  </div>
))}
```

I changed the Korean-language edit preview on the left side of the workspace (`WorkspaceResume.tsx`) to `.map()` the same way. The original `edu &&` condition, which checked whether a single object existed, just needed to become `edu.length > 0`.

## Step 5. Making the mock data an array too

Fixing only the real-data path could break the demo/mockup screen, so I updated the mock data alongside it too.

```ts
// mock-data.ts (Before → After)
education: { org: 'Seoul National University — B.S. Computer Science', period: '2015 – 2019' },
// ↓
education: [{ org: 'Seoul National University — B.S. Computer Science', period: '2015 – 2019' }],
```

## Step 6. Verifying by actually rendering it

I didn't stop at passing the type check (`tsc --noEmit`). I brought up the screen using an account with genuinely 2 education entries and directly confirmed **that both showed up.**

```bash
curl -s http://localhost:3999/r/test-slug | grep -o "California State University"
curl -s http://localhost:3999/r/test-slug | grep -o "Grossmont College"
```

Only once both were confirmed in the output did I conclude "this is fixed." A type check only guarantees "the code is syntactically valid" — it never guarantees "it behaves as intended."

## Common patterns, summarized

| Situation | Checkpoint |
|---|---|
| Data where "multiple" is the natural case (education, experience, skills, etc.) | Was the type designed as an array, not a single object? |
| Spotting code like `.filter(...)[0]` | Is this genuinely a "only one is needed" case, or is a design mistake discarding the rest? |
| Changing a single type | List every place that uses that type/field first, via `grep` |
| After fixing a bug | Don't just trust the type check — confirm the rendered result with real data |

## Troubleshooting

**Q. How do you prevent this kind of bug from the start?**
A. It helps to build the habit, at the data-modeling stage, of always asking "can this field realistically have 0, 1, or multiple values in the real world?" Information that varies in count per person — education, experience, certifications — is generally safer designed as an array by default. Conversely, a value that genuinely only ever exists once, like a name or email, is correctly a single field.

**Q. Is code that only uses `[0]` for the first item always a bug?**
A. No. There are plenty of intentional cases, like "only the most recent one is needed." But that intent absolutely needs to be verified. In this case, the UI had an "add education" button letting users register multiple entries, while the rendering type was locked to just one — a clear design mismatch.

## Summary

```
Report: "only one education entry shows" → trace the data flow (DB → conversion → render)
  → find the spot where the type definition was designed as a single object
  → fully survey the blast radius (grep) → unify types, conversion functions, and rendering around an array
  → sync the mock data too → verify rendering with a real account
```

The biggest impression left by this bug was that **a type system only guarantees "code that matches its types" — it never guarantees "a type that correctly reflects reality."** I found this by just visually scanning `education: ResumeEducation` (singular) sitting right next to `experiences: ResumeExperience[]`, and checking whether "anything looks off compared to the field right next to it" like this seems like a genuinely useful habit for code review too.

This wraps up this series. Starting from a security audit, through history cleanup, DB schema consolidation, new feature development, and bug fixing — they all shared the common thread of being work that "doubts and verifies what's already been built."
