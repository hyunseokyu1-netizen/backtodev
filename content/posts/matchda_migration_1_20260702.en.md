---
title: 'Turning a Design Demo Into the Real App (1) — When Two Apps Coexist'
date: '2026-07-02'
publish_date: '2026-07-25'
description: Discovering that a pretty design demo and the real logged-in app were living separate lives, and building an inventory and phase plan to replace one with the other with zero feature loss
tags:
  - Next.js
  - Supabase
  - Refactoring
  - Server Actions
---

Over the past several days, I'd diligently built out a new design for a career platform called MatchDa under the `/matchda` route. Landing page, dashboard (kanban board), resume workspace — matched pixel-for-pixel, wired up to real data, made responsive, even had AI features attached. I was pretty proud of it.

Then one day a user asked me this.

> "Wait, this isn't actually connected to the real site, is it — just the design dropped into /matchda?"

**Right on the nose.**

## The problem: I'd unknowingly built "two apps"

Checking it, here's how things stood.

- Visit `/` logged out → the new MatchDa landing (connected ✅)
- **Log in, and `/` is still the old design** (a zinc-toned job listing)
- The global header nav ("Application Management," "Job Search," "Profile") was all old pages too
- The old app had **not a single link** leading into `/matchda`

In other words, `/matchda/dashboard` did read real data, but **it wasn't the screen a logged-in user actually used.** I'd built a beautiful showroom right next door while sending customers to the old store anyway.

This happens more often than you'd think. Developing a new design "safely" on a separate route makes it easy for that route to sit unconnected to the actual flow. The design is 100% complete, but 0% of it reaches the user.

So I made the goal explicit — **completely replace the logged-in user's real app with the MatchDa design, without losing a single existing feature.**

## Prep — an "inventory" before replacing anything

The first step of a lossless replacement is **writing down every single feature the thing being removed (the old screen) has.** Skip this, and post-deployment you get "wait, where did that button go?"

Digging through the old job listing (`JobList`), here's what it had.

| Level | Feature |
|---|---|
| Board | add a posting (URL/manual), bulk AI matching |
| Card | status change (8 stages), drag reordering, notes, inline editing (title/company/location), application date, delete, re-match |
| Modal | cover letter, tailored resume, submitted-resume upload, paste-JD |

I also pulled which server actions and components it used, via `grep`.

```bash
grep -nE "^import" src/components/JobList.tsx
# → StatusButton, CoverLetterModal, JdInputModal, AppliedResumeModal,
#   TailoredResumeModal, updateMatchStatus, reorderJobs, deleteJob ...
```

This list becomes **"the moving checklist."**

## Splitting into phases

Changing everything at once makes regressions hard to catch. So I split it into 4 stages.

1. **Interactive kanban** — changing status from a card
2. **Board entry points** — adding a posting + bulk matching
3. **Porting per-job features** — modals + notes/editing/delete/re-match
4. **Route swap** — replacing the logged-in home with MatchDa

Core principle: **achieve feature parity on `/matchda` first, and swap the actual `/` route last.** That way the app doesn't break mid-transition.

## Step 1. Interactive kanban — porting the status dropdown

The old app switched status via an 8-stage dropdown (`StatusButton`). I reused it as-is, just wrapped in MatchDa's tone. The important part is **using the existing server action (`updateMatchStatus`) unchanged.**

```tsx
'use client'
import { updateMatchStatus } from '@/app/actions'
import { STATUS_OPTIONS, type Status } from '@/components/StatusButton'  // reusing the old definition

async function select(next: Status) {
  const res = await updateMatchStatus(jobId, next)
  if (!res.error) router.refresh()   // rearrange columns once status changes
}
```

The entire card needs to navigate to the workspace on click, but putting a dropdown button inside it caused **conflicting click events.** Separated with `stopPropagation`.

```tsx
<div role="button" onClick={() => router.push(`/matchda/workspace?jobId=${job.id}`)}>
  {/* ... */}
  <div onClick={(e) => e.stopPropagation()}>
    <StatusSelect jobId={job.id} initialStatus={job.status} />
  </div>
</div>
```

And it's **interactive only with real logged-in data**, static cards for the logged-out demo. Split by a single `interactive` flag in one component.

```tsx
{interactive
  ? <InteractiveJobCard job={job} matchLabel={label} />
  : <JobCard job={job} t={t} />}   // mock demo (a static Link)
```

## Step 2. Board entry points — reuse instead of rebuilding

"Add a posting" and "bulk matching" already had well-working components in the old app (`AddJobForm`, `RunMatchButton`). No reason to build them fresh. **I just dropped them into the MatchDa card as-is.**

```tsx
{real && (
  <div className="mb-6 rounded-[14px] border border-[#ECEEF0] bg-white p-4">
    <AddJobForm />   {/* add-by-URL + manual-add modal, unchanged */}
  </div>
)}
{real && <RunMatchButton unmatchedCount={real.unmatchedCount} />}
```

The tone looked slightly off (zinc buttons), but **the functionality was 100% unchanged.** "Move the functionality first, worry about tone later" is the rhythm of a lossless migration. (Tone unification is covered in Part 3.)

## Troubleshooting

**I deliberately left out drag reordering.** In the old app's flat list, manual ordering (position) meant something, but with a kanban auto-grouping by status, manual ordering had low value. Rather than "if it existed before, port it unconditionally," it's more correct to **re-judge whether it's needed in the new context.** I asked the user and left it out.

**Kept the mock fallback intact.** A logged-out visitor still needs to see the pretty demo. So the data-fetching function returns `null` when logged out, and the caller falls back to mock data. Thanks to this, **one component doubles as both the demo and the real app.**

## Summary

The start of a lossless migration.

1. **Recognize the "two apps" signal** — check whether a separately-routed design is actually connected to the real flow
2. **Inventory first** — write down every feature of the screen to be removed, in a table
3. **Split into phases, and swap the actual route last**
4. **Reuse existing actions/components as much as possible** — don't rebuild from scratch
5. **Re-judge old features in the new context too** (drag reordering got dropped)

In the next part — the biggest chunk — reusing multiple modals to port per-job features, and finally swapping the actual home into MatchDa.
