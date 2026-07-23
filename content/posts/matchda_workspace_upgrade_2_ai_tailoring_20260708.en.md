---
title: 'Workspace Upgrades (2): Making the "AI Analysis" Button Actually Write the Resume'
date: '2026-07-08'
publish_date: '2026-08-26'
description: Turning a button that only compared a job posting against a resume into one that directly rewrites the resume to fit the posting, redesigned as a clean 2-stage (analyze → translate) flow
tags:
  - Next.js
  - Claude API
  - Server Actions
  - UX Design
  - Prompt Engineering
---

## Recap of the last part

Last time, I wrote about cleaning up the kanban card layout. This part is the record of completely rebuilding the "AI analysis for this posting" button that lived in the workspace (the resume-editing screen).

## What this button originally did

The workspace shows the original Korean resume on the left and the English resume on the right, side by side. There was a button at the top right labeled "AI analysis for this posting" — clicking it ran a server action called `generateWorkspaceOptimization`, which:

- Found phrases in the resume overlapping with the job posting's requirements and **highlighted** them
- Generated a **single short note**, like "we emphasized your 'distributed systems' experience for the XX posting"

This result got cached in the DB (`matches.optimization`) and shown as a green box below the English resume. In other words, it was a feature that **didn't rewrite the resume at all — it just pointed out "this part is relevant."**

## Why I decided to change it

Thinking about it from the user's perspective, "directly rewriting the resume to fit the posting" is far more practically useful than "pointing out relevant parts." MatchDa already had a similar feature (`generateTailoredResume`), but that ran in a completely separate popup modal flow, disconnected from the resume being edited in the workspace.

So I decided to turn the single "AI analysis for this posting" button into a feature that **rewrites, right there, the Korean resume currently being edited in the workspace to fit the posting.**

## Step 1. Designing the new server action — keep the facts, change only the phrasing

What I cared about most was "the AI must never fabricate experience that doesn't exist while rewriting the resume." So I clearly restricted the scope the AI was allowed to touch.

```ts
export async function tailorResumeForJob(
  current: StudioResume,
  jobContext: { title: string; company: string; description: string | null }
): Promise<{ ko?: StudioResume; error?: string }> {
  // ...
  const visibleExp = ko.experience.filter(e => !e.hidden)

  // ask the AI to rewrite only description (the achievement bullets)
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    messages: [{
      role: 'user',
      content: `... [job posting] ... [current resume] ...
Rules:
- Use only facts present in the resume. Never fabricate or exaggerate experience, numbers, or company names.
- Keep experience at the same count and order as the original — rewrite only each entry's description (achievement bullets).`,
    }],
  })
```

And when merging the AI response back into the original, **company name, title, and dates keep the original values as-is**, and only `description` (the achievement bullets) gets replaced with what the AI produced.

```ts
const nextKo: StudioResume = sanitizeStudio({
  ...ko,
  title: raw.title?.trim() || ko.title,
  summary: raw.summary?.trim() || ko.summary,
  skills: Array.isArray(raw.skills) && raw.skills.length ? raw.skills.map(String) : ko.skills,
  experience: [
    ...visibleExp.map((e, i) => ({
      ...e,                                              // keep company/position/period from the original
      description: raw.experience?.[i]?.description?.trim() || e.description,
    })),
    ...hiddenExp,
  ],
})
```

This eliminates any room at all for the AI to make a mistake like "mistranscribing a company name" or "slightly changing a date range." **Because those fields are never pulled from the AI's response in the first place.** This is far safer than asking in a prompt to "not fabricate anything" — blocking it structurally in code, so it simply can't be touched at all, is much more certain.

## Step 2. Relocating the button — "analysis" belongs on the Korean side

This button used to sit on the English panel. But since this feature now **rewrites the Korean original,** moving it to the Korean panel's header was the right call.

```tsx
{/* Left: the Korean original panel header */}
<button type="button" onClick={handleTailorToJob} disabled={busy !== null}
  className="flex items-center gap-[6px] rounded-[9px] border border-[#CEEBDC] bg-[#ECFDF3] px-3 py-[7px] text-[13px] font-semibold text-[#046C4E]">
  <Sparkle size={14} strokeWidth={1.8} />
  {busy === 'tailor' ? labels.optimizing : labels.optimizeButton}
</button>
```

## Step 3. Turning "AI Translate & Tailor (English)" into a real button

I found one more thing here. The text "AI Translate & Tailor (English)" sitting in the English panel's header looked like a button on the surface, but was actually a **static badge** with no `onClick` at all.

```tsx
// Before — a decorative badge that does nothing when clicked
<div className="flex items-center gap-2 rounded-lg border bg-[#ECFDF3] px-3 py-[6px]">
  <Sparkle size={14} strokeWidth={1.8} className="text-[#046C4E]" />
  <span className="text-[13px] font-semibold text-[#046C4E]">{labels.translated}</span>
</div>
```

The English panel had, up to this point, worked by automatically refreshing along with the "Save" button. While rebuilding the flow this time, I turned this badge into a **real button that only triggers translation when explicitly clicked.**

```tsx
// After
<button type="button" onClick={handleTranslate} disabled={busy !== null}
  className="flex items-center gap-2 rounded-lg bg-[#046C4E] px-3 py-[6px] text-[13px] font-semibold text-white">
  <Sparkle size={14} strokeWidth={1.8} />
  {busy === 'translate' ? labels.translating : labels.translated}
</button>
```

```ts
async function handleTranslate() {
  setBusy('translate')
  const sync = await syncResumeEnglish(koRef.current)
  if (sync.en) setEnDoc(studioToDoc(sync.en, contact))
  setDirty(false)
  setSavedAt(true)
  router.refresh()
}
```

## The finished flow — cleanly split into 2 stages

The workspace's usage flow ended up organized like this.

```
1. Click [AI analysis for this posting]
   → the Korean resume gets rewritten to fit this posting (not yet saved, shows "unsaved")
2. The user reviews and edits the result
   → uses the existing edit UI (contentEditable) as-is, free to change anything
3. Click [AI Translate & Tailor (English)]
   → translates the finalized Korean into English while saving at the same time
```

The reason for separating "analyze → review → translate" is to keep the user from just trusting the AI's first output as-is and moving on. If translation had run automatically all in one step, the user would've been pushed straight through to English with no chance to fix anything at the Korean stage.

## Troubleshooting — cleaning up an unused prop

While ripping out the old feature (`GenerateOptimizationButton`), a prop called `optimizable`, used only by that feature, was left behind in several components. TypeScript doesn't flag an unused function parameter as an error by default, but leaving it means "a prop nobody knows the purpose of" piles up in the code. I found and removed `optimizable` everywhere — the component type definitions, and every place the page passed it down.

```bash
# finding every place a specific prop/identifier is still left behind
grep -rn "optimizable" src/ --include="*.ts" --include="*.tsx"
```

When ripping out a feature, it's not enough to just delete the code — tracing and removing the types and props that came along with that feature too is what keeps "dead code" from being left behind.

## Summary

```
Before: "AI analysis" = only generates highlights and a note (uneditable supplementary info)
After:  "AI analysis" = rewrites the Korean resume to fit the JD (keeps company name/dates, AI only rewrites achievement descriptions)
        → review/edit → explicit English sync via the "AI Translate" button
```

The biggest impression left by this was that **restricting the AI's scope structurally, via code, rather than via prompt wording, is far safer.** No matter how carefully you write "please don't fabricate anything" into a prompt, it's never as certain as simply never pulling that field from the AI's response in the first place.

Next up: a bug I stumbled onto while building this feature — an English resume that kept showing the Korean name, unchanged.
