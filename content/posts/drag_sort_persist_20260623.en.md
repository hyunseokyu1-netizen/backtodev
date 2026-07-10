---
title: "Drag Works, But the Order Doesn't Change — Making Sorting and Manual Order Coexist"
date: '2026-06-23'
publish_date: '2026-07-06'
description: How I fixed a bug where dnd-kit drag reordering was getting overwritten by auto-sort, then persisted the user's manual order to the database
tags:
  - dnd-kit
  - React
  - Next.js
  - Supabase
  - PostgreSQL
---

## Intro: "the drag isn't taking"

JobRadar's job listing view had a feature to reorder cards by dragging. `@dnd-kit` was wired up, and the drag handle (⠿) was visible. Then a user said this.

> "It's supposed to let me reorder, but it doesn't. Might be because of the sort mode (by score / by recency)?"

I tried it myself, and yep. Grabbing a card and dragging it up or down shows the drag motion just fine, but **the instant you release, it snaps right back to its original position.** The drag clearly does something — the result just vanishes within a tenth of a second.

This post traces that "looks like it works but doesn't" drag bug, and takes it further into a feature that **permanently persists the order the user chose.** If you're wiring up dnd-kit for the first time, this is a trap you'll likely hit once, so it's worth writing down.

## Step 1. Why does the order snap back?

The cause was in one spot in the code. Look at the part rendering the list.

```tsx
const [jobs, setJobs] = useState(initialJobs)

// Reorder the jobs array once dragging ends
function handleDragEnd(event) {
  const { active, over } = event
  if (over && active.id !== over.id) {
    setJobs(prev => {
      const oldIndex = prev.findIndex(j => j.id === active.id)
      const newIndex = prev.findIndex(j => j.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)  // reorder
    })
  }
}

// But what actually renders isn't jobs — it's filteredJobs
const filteredJobs = sortMode === 'recent'
  ? [...filtered].sort((a, b) => /* by recency */)
  : [...filtered].sort((a, b) => /* by score */)   // ← always re-sorted!

// ...
{filteredJobs.map(job => <SortableJobCard ... />)}
```

See the problem? Dragging **definitely does** change the `jobs` state. But what's actually rendered isn't `jobs` — it's `filteredJobs`, which **re-applies `.sort()` by score/recency on every render.**

So the sequence goes like this.

1. Drag → `jobs` array order changes → triggers a re-render
2. Re-render → `filteredJobs` **re-sorts `jobs` by score**
3. The screen shows the score-sorted order → **the drag result vanishes without a trace**

The order my hand just set was being overwritten by the `.sort()` on the very next line. And on top of that, the order wasn't stored anywhere, so even if it had shown, it was doomed to disappear on refresh.

## Step 2. Design — "auto-sort" and "manual sort" can't coexist

There was an important realization here. **Auto-sort (by score/recency) and manual sort (drag) are fundamentally incompatible.** The moment you sort by score, whatever order I set by dragging becomes meaningless. Only one of the two can rule the screen.

So the answer wasn't "mix drag into auto-sort" — it was **creating a third sort mode.**

| Sort mode | Behavior |
|-----------|------|
| By score | Descending match score (automatic) |
| By recency | Descending posting date (automatic) |
| **Manual order** (new) | **The order the user set by dragging. Never re-sorted** |

And only in "manual order" mode:
- The screen shows the `jobs` array order **without re-sorting**
- Drag is **enabled**
- The changed order is **saved to the DB**

I added one more UX touch on top. If a user tries to drag while in a different mode, it **automatically switches to "manual order" mode.** They don't need to know they have to change the mode first — they can just drag.

## Step 3. Where to store the order — deciding column placement

Persisting the order permanently needs a DB column. But **which table** it goes into turned out to be an important design decision.

Multiple JobRadar users share the same job postings (`jobs`). Per-user data like match score, notes, and application status live in the **`matches` table**. Order needs to be settable **differently per user** too, the same way — my chosen order should never change another user's screen.

So the order needs to live in the **per-user table (`matches`)**, not the shared table (`jobs`).

```sql
-- 012_add_position_to_matches.sql
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS position INTEGER;
```

> **A data modeling instinct**: always ask "who does this value belong to?" first. A value everyone shares (a job title) and a value that differs per user (my sort order) need to live in different tables. Get this wrong, and you get the bug where "I reorder mine, and it changes someone else's screen too."

## Step 4. The server action that saves the order

Once a drag ends, it takes the new order (an array of job ids) and writes each job's `position` as its array index.

```ts
'use server'

export async function reorderJobs(orderedJobIds: string[]) {
  // Verify the logged-in user (always dynamically)
  const email = await getAuthUserEmail()
  if (!email) return { error: 'Login required.' }
  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  // Record position = 0, 1, 2 ... following the array order
  const results = await Promise.all(
    orderedJobIds.map((jobId, index) =>
      supabaseAdmin
        .from('matches')
        .update({ position: index })
        .eq('user_id', profile.id)   // ← must scope to only my data
        .eq('job_id', jobId)
    )
  )

  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }
  return {}
}
```

`Promise.all` sends multiple updates at once. Even with dozens of job postings, they're processed concurrently, so it's plenty fast. And **`.eq('user_id', profile.id)` must never be skipped** — the service role key bypasses RLS (row-level security), so if the code itself doesn't filter to "only my data," you can end up rewriting someone else's order.

## Step 5. Frontend — mode branching and enabling drag

Now for the screen side. First, add "manual order" to the render branch.

```tsx
const filteredJobs =
  sortMode === 'manual'
    ? filtered                              // ← don't re-sort, keep the array order
    : sortMode === 'recent'
    ? [...filtered].sort(/* by recency */)
    : [...filtered].sort(/* by score */)
```

Once a drag ends, it reorders, switches the mode, and saves to the DB.

```tsx
function handleDragEnd(event) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const oldIndex = jobs.findIndex(j => j.id === active.id)
  const newIndex = jobs.findIndex(j => j.id === over.id)
  if (oldIndex < 0 || newIndex < 0) return

  const next = arrayMove(jobs, oldIndex, newIndex)
  setJobs(next)
  setSortMode('manual')              // dragging auto-switches to manual mode
  reorderJobs(next.map(j => j.id))   // save to the DB
}
```

Finally, I locked drag to work **only** in "manual order" mode. Allow dragging in an auto-sort mode, and the screen order (sorted) diverges from the actual array order, causing cards to land in the wrong spot. dnd-kit's `useSortable` lets you disable this cleanly with the `disabled` option.

```tsx
const { attributes, listeners, setNodeRef, ... } =
  useSortable({ id: job.id, disabled: !draggable })
```

```tsx
// The parent passes draggable based on the current mode
<SortableJobCard ... draggable={sortMode === 'manual'} />
```

I also visually distinguished the handle by mode — bold (grabbable) in manual mode, faded with a tooltip hint otherwise.

```tsx
<button
  {...attributes}
  {...listeners}
  disabled={!draggable}
  title={draggable ? 'Drag to reorder' : "Switch to 'Manual Order' to reorder"}
  className={draggable ? 'text-zinc-400 cursor-grab' : 'text-zinc-200 cursor-not-allowed'}
>
  ⠿
</button>
```

## Step 6. Surviving a refresh — initial sort order

Saving isn't the whole job. **Loading** also needs to come back in the saved order. When the page reads job postings, it fetches `position` alongside them and builds the array in that order.

```tsx
// position takes priority; falls back to the existing score-based sort if missing
const sorted = [...jobList].sort((a, b) => {
  const pa = a.position ?? Infinity
  const pb = b.position ?? Infinity
  if (pa !== pb) return pa - pb
  // among items with no position, put matched ones first + sort by score
  if (a.match_score !== null && b.match_score === null) return -1
  if (a.match_score === null && b.match_score !== null) return 1
  return (b.match_score ?? 0) - (a.match_score ?? 0)
})
```

Jobs where `position` is `null` (never manually reordered yet) are treated as `Infinity` and pushed to the back, keeping the existing score-based order among themselves. This way, even a user who's never manually reordered anything sees a sensible default order.

## Troubleshooting: verification doesn't need code

After applying the migration, instead of clicking through the UI, I queried the DB directly to confirm "save → read back" round-tripped correctly. Non-destructively, using the service role key.

```
Test target user matches: 16
✅ 1) position column exists and is queryable
✅ 2) order (position) save→read round-trip succeeded
🧹 3) restored original position values
```

The test values were reverted back to their originals afterward, leaving no trace in the actual data. Build and type checks (`tsc --noEmit`, `next build`) were also passed before committing.

## Summary: with drag, "showing it" is half the job, "keeping it" is the other half

Here's today's work at a glance:

1. **Root cause of the bug** — the order changed by dragging was being overwritten every render by `filteredJobs`'s `.sort()`
2. **Design decision** — auto-sort and manual sort can't coexist → introduced a "manual order" mode
3. **Storage location** — a per-user value, so a `position` column on the `matches` table
4. **Save action** — `reorderJobs` writes the index to position (with a mandatory `user_id` filter)
5. **Drag gating** — enabled only in manual order mode, auto-switches on drag
6. **Initial sort** — sorts by position first on load, so it survives a refresh

Wiring up drag motion with dnd-kit really only takes a few lines. The real work comes after — **making sure the changed order isn't overwritten by another sort, making it survive a refresh, and making sure it doesn't touch anyone else's data.** This time really drove home how different "drag is visible" and "drag actually works" are.
