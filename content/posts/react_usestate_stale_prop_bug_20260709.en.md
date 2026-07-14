---
title: "It's Definitely Saved in the DB, But Not on Screen — the Trap useState's Initial Value Sets"
date: '2026-07-09'
publish_date: '2026-07-15'
description: How I tracked down and fixed a common React bug — a component that copied server data into local state for drag-and-drop, then kept ignoring fresh data the server sent down afterward
tags:
  - React
  - useState
  - Next.js
  - Bug Tracking
  - State Management
---

## The report — "After adding manually... the card doesn't show up"

A user sent me a short report along with a screenshot. "After adding manually.... the card doesn't show up." On Matchda's application-status board, they'd manually entered a job posting to create a card, but the new card wasn't appearing on screen.

Drag-and-drop had just been added to this board the day before, so I had a hunch that work had touched something. Tracing the actual cause, it turned out to be **a textbook trap anyone working with React eventually steps in.** This post is a record of that trace.

## First, laying out the symptom

The first thing I checked was "did it really not save, or did it save but just isn't showing on screen." Querying the data directly in Supabase, **the posting had been saved to the DB just fine.** So the server side (backend logic) had zero problems. Meaning the issue was purely on the screen (client) side.

## Cause — local state left behind by drag-and-drop

The drag-and-drop feature built the day before was structured like this. For the screen to react instantly while dragging a card with the mouse (waiting for a server response and re-rendering would look choppy), the per-column card list needs to be held **separately as local state** inside the component. So it was written like this.

```tsx
// InteractiveKanban.tsx (the buggy code)
export default function InteractiveKanban({ columns: initial }: { columns: KanbanColumnView[] }) {
  const [columns, setColumns] = useState(initial)
  // ...drag logic optimistically moves cards via setColumns
}
```

The parent (a server component) passes down a `columns` prop, and it gets copied into `useState` as the initial value to work with. This much is a common pattern with no issue.

The problem was what happened after saving a new posting via the "Add Manually" modal. Once saving finishes, `router.refresh()` gets called to re-render the page from the server. The server computes a fresh `columns` value from the latest DB data and sends it back down — **up to this point, everything works exactly as intended.**

But from the `InteractiveKanban` component's perspective, it's different. **`useState(initial)`'s `initial` argument is only used once — when the component first appears on screen (mounts).** Even if the parent sends down a new `initial` (=`columns`) prop to an already-mounted component, `useState` says "huh? I already finished initializing" and simply ignores the new value.

Summarized:

```
1. Initial page load → InteractiveKanban mounts → useState(initial) stores the card list
2. Save a new posting via "Add Manually" → reflected correctly in the DB
3. router.refresh() → the server sends a fresh columns prop back down
4. But InteractiveKanban is already mounted → receives the new prop, but internal state stays as-is
5. The screen still shows only the stale card list from step 1
```

A hard refresh (F5) remounts the entire page, so it would've naturally shown up. The user simply hadn't tried refreshing, which is why it felt like it "doesn't show up."

## Why is this a "common" trap

The real name of this bug is **"state initialized from a prop fails to track subsequent prop changes."** The React community also calls it "derived state going stale." Any time you write code like `useState(props.something)`, using a prop only as an initial value, you're potentially carrying this problem — as long as that prop can change again later.

In this case, drag-and-drop genuinely needed "state that reacts locally and instantly," so avoiding this pattern altogether wasn't an option. The problem was **forgetting to design "how to sync when the prop changes later" from the start.**

## The fix — resetting state during rendering

React's official docs have a pattern exactly for this situation. Instead of `useEffect`, **compare directly in the render function body, and call `setState` right there if needed.**

```tsx
export default function InteractiveKanban({ columns: initial }: { columns: KanbanColumnView[] }) {
  const [columns, setColumns] = useState(initial)

  // Sync local state whenever the server sends down new props (initial) via router.refresh, etc.
  // useState(initial) only applies once at mount, so for a subsequent server refresh
  // to reach this component, syncing needs to happen during render.
  const [prevInitial, setPrevInitial] = useState(initial)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setColumns(initial)
  }

  // ...
}
```

The key question is why not put this inside `useEffect`. Handling it via `useEffect` produces this sequence.

```
Render → stale value painted on screen (one frame) → effect runs → setState → re-render → new value painted
```

One frame, but it can show up as a visible flicker, and more importantly, it's a structure that "triggers another render after committing," which is exactly what triggers a performance warning (I actually found a `setState in effect` lint warning elsewhere in the same project — a rule that catches exactly this anti-pattern).

By contrast, **`setState` called during rendering behaves differently.** The moment React detects "oh, state changed during rendering," it immediately restarts rendering right there, before committing to the screen. So from the user's perspective, the stale value never gets painted for even a single frame — it appears with the latest value right away.

```
Render starts → detects "the prop changed" → calls setState → restarts before committing → renders with the new value → commits to screen
```

## Verification — not trusting the fix, reproducing it directly

After fixing the code, I didn't stop at "this should be fine now." I logged into a real account with a headless browser (Playwright), created a posting via "Add Manually," and scripted a reproduction of whether the card appears **without refreshing.**

```js
const before = await page.locator(`text=${uniqueTitle}`).count()
console.log('Before adding:', before) // 0

await page.click('button:has-text("Add Manually")')
// ...fill out the form and save...

// Wait for the modal to close and router.refresh() to finish
await page.waitForSelector('text=Add Job Manually', { state: 'detached' })
await page.waitForTimeout(1500)

const after = await page.locator(`text=${uniqueTitle}`).count()
console.log('After adding (no refresh):', after) // 2 → the card actually shows up
```

Running the same script against the pre-fix code would've also returned 0 for `after`. Only after confirming the card appeared instantly with the fix did I conclude "this is fixed."

## Frequently used pattern summary

| Situation | Correct approach |
|---|---|
| A prop can just be used directly on screen | use the prop directly, no `useState` |
| Local state is built from a prop as its initial value, but the prop can still change afterward | during render, compare against the previous prop and call `setState` right there if different (no useEffect) |
| Want to keep locally-modified values even when the prop changes (a genuine "initial value" case) | consider giving the parent a `key` to fully remount the component instead |

## Troubleshooting

**Q. Doesn't `useEffect(() => setState(prop), [prop])` work too, in the end?**
A. It works. But it applies one frame late, and React's newer lint rule (`react-hooks/set-state-in-effect`) flags it. Take "calling setState directly inside an effect" as a signal that it can usually be converted to syncing during render.

**Q. How do you avoid creating this bug in the first place?**
A. Whenever you see code like `useState(prop)` that uses a prop only as an initial value, it helps to build the habit of asking yourself "can this prop change again later?" If it can, that's the moment a sync strategy is needed.

## Summary

```
Symptom: manually-added postings don't show up until refreshed (saved fine in the DB)
Cause: useState(initial) only applies once at mount, ignoring the new prop
       sent down later by router.refresh()
Fix: compare against the previous prop during render, call setState right there if different
     (instead of useEffect — no flicker, no cascading render warning)
Verification: directly reproduced "does the card show up without refreshing" with a headless browser
```

The biggest thing that stuck with me: **the pattern of "copying server data into local state" itself isn't the problem — forgetting that the copy happens exactly once is the real problem.** I relearned that whenever building UI needing instant reaction, like drag-and-drop, "when will this local state get resynced with server data" needs to be designed alongside it from the very start.
