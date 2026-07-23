---
title: 'Workspace Upgrades (4): Adding Kanban Card Drag-and-Drop With dnd-kit'
date: '2026-07-08'
publish_date: '2026-08-28'
description: Using dnd-kit, which was already installed but unused, to let dragging a kanban card between columns change its application status — and making sure clicks and drags never conflict
tags:
  - dnd-kit
  - React
  - Drag and Drop
  - Next.js
---

## Recap of the last part

Across the last three parts, I covered the kanban card layout, the AI resume-rewriting feature, and the English name/contact-info bugs. This part (the last one) is about adding drag-and-drop to the kanban board.

## What I set out to do

MatchDa's dashboard shows application status as a kanban board with 4 columns (Preparing / Applied / Interview / Offer). Up to now, changing status required clicking the dropdown on each card — I wanted to make it so **dragging a card with the mouse and dropping it on another column changes the status.**

## Prep — it was already installed

There was no need to install a new library. Checking `package.json`, `@dnd-kit` was already in use for the applications list view (the drag-to-reorder feature).

```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```

The list view was for "reordering within the same list" (`@dnd-kit/sortable`), which is a bit different from this case — "moving a card into a different column (a different list)." Instead of the `sortable` package, I used `@dnd-kit/core`'s basic hooks (`useDraggable`, `useDroppable`) directly.

## Step 1. A draggable card, a droppable column

`dnd-kit`'s basic units are two things — **the thing being dragged** (`useDraggable`) and **the area that receives a drop** (`useDroppable`). Mapped onto the kanban board, a card is draggable and a column is droppable.

```tsx
function DraggableCard({ job, emphasized }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? 'z-30 cursor-grabbing opacity-90 shadow-lg' : 'cursor-grab'}
    >
      <InteractiveJobCard job={job} matchLabel={job.matchLabel} emphasized={emphasized} />
    </div>
  )
}

function DroppableColumn({ col }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status })
  return (
    <div ref={setNodeRef} className={isOver ? 'border-[#9ADBBE] bg-[#ECFDF3]' : 'border-[#EDF0F2] bg-[#F4F6F8]'}>
      {/* column header + card list */}
    </div>
  )
}
```

`isOver` tells you whether the card currently being dragged is hovering over this column. I used this to highlight the drop-target column in green, so the user can visually tell "this is where it'll drop."

## Step 2. Mapping status values on column change

The 4 kanban columns and the actual DB's application status (`matches.status`, 8 stages) aren't a 1:1 mapping. For example, the "Preparing" column groups together three statuses at once: `new`, `interested`, `considering`. So I built a mapping table that translates dropping a card onto a specific column into **the status value representing that column.**

```ts
const COLUMN_TO_STATUS: Record<ApplicationStatus, string> = {
  preparing: 'new',
  applied: 'applied',
  interview: 'interview',
  offer: 'accepted',
}
```

Moving a card into the "Preparing" column unifies it to `new`, regardless of what its detailed status was before. It's not perfect (e.g., a card that was `interested` gets reset to `new` if moved within the Preparing column and dropped back in the same one), but since dragging's purpose is "moving between columns," I judged that preserving the detailed sub-status within a column wasn't necessary.

## Step 3. Optimistic updates + reverting on failure

If a card gets dragged and the screen stays unchanged until the server request finishes, the user thinks "huh, did that not work?" and tries dragging again. So I used **update the screen first, then revert if the server save fails** (an optimistic update).

```ts
async function handleDragEnd(e: DragEndEvent) {
  const jobId = String(e.active.id)
  const target = e.over?.id as ApplicationStatus | undefined
  if (!target) return

  const fromCol = columns.find(c => c.jobs.some(j => j.id === jobId))
  if (!fromCol || fromCol.status === target) return

  const job = fromCol.jobs.find(j => j.id === jobId)!
  const nextStatus = COLUMN_TO_STATUS[target]

  // move it on screen first
  const prev = columns
  setColumns(cols => cols.map(c =>
    c.status === fromCol.status ? { ...c, jobs: c.jobs.filter(j => j.id !== jobId) }
    : c.status === target ? { ...c, jobs: [...c.jobs, { ...job, status: nextStatus }] }
    : c
  ))

  // attempt the server save, revert to the original state on failure
  const res = await updateMatchStatus(jobId, nextStatus)
  if (res.error) {
    setColumns(prev)
    alert(res.error)
    return
  }
  router.refresh()
}
```

The key is storing the entire pre-drag state in the `prev` variable and reverting to it wholesale on failure. Trying to revert partially makes the logic complex and error-prone — "snapshot everything → restore it wholesale on failure" is far simpler and safer.

## Step 4. The problem of drag and click conflicting

A card was originally a link that navigated to the workspace on click. But once I added dragging, there was a problem where **even barely tapping and releasing a card** got recognized as a click, triggering navigation mid-drag-attempt.

I solved this with two things.

**First, setting an activation distance.** Requiring the mouse to move at least 8px before it's recognized as a drag naturally distinguishes a simple click (no movement) from a drag (moved beyond a certain distance).

```ts
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
```

**Second, blocking the click event right after a drag.** Even with the 8px threshold, the browser can still fire one more `click` event the moment the mouse is released at the end of a drag. To block this, I kept a ref recording "did a drag just happen," and intercepted the click right after it at the capture stage.

```tsx
const dragHappened = useRef(false)

<DndContext
  onDragStart={() => { dragHappened.current = true }}
  onDragEnd={(e) => { handleDragEnd(e); setTimeout(() => { dragHappened.current = false }, 0) }}
>
  <div onClickCapture={(e) => {
    if (dragHappened.current) { e.preventDefault(); e.stopPropagation() }
  }}>
    {/* columns */}
  </div>
</DndContext>
```

Unlike a regular `onClick`, `onClickCapture` runs **before** the event propagates down to children (the capturing phase). So it can block things here, before the link's click handler inside the card even runs. The reason for resetting the flag on the next event loop via `setTimeout(..., 0)` is that `dragEnd` and the `click` event that follows it fire back-to-back **within the same tick,** so the flag needs to stay on in between the two.

## A bonus — a match-rate re-measurement button

During this same work, I also turned the match-rate number ("25%") in the workspace's top banner from plain text into a clickable button. After rewriting a resume with AI (a feature covered before this part), you'd naturally wonder how much the score improved — instead of needing to dig into some other menu every time, I made it so **clicking the score itself immediately re-measures it.**

```tsx
<button type="button" onClick={rematch} disabled={loading}>
  {loading ? 'Measuring...' : `${score}%`}
</button>
```

A small feature, but the flow of checking "how much better did the resume I just fixed get" now finishes in a single click.

## Common patterns, summarized

| Purpose | dnd-kit API |
|---|---|
| A draggable element | `useDraggable({ id })` |
| A droppable area | `useDroppable({ id })` |
| A context wrapping multiple draggables/droppables | `<DndContext onDragEnd={...}>` |
| Distinguishing click from drag | `useSensor(PointerSensor, { activationConstraint: { distance: 8 } })` |
| Positional-shift style during a drag | `style={{ transform: CSS.Translate.toString(transform) }}` |

## Summary

```
Existing card (Link) + StatusSelect dropdown
  → added drag-between-columns via useDraggable/useDroppable
  → optimistic updates via a column-to-representative-status mapping table, snapshot restore on failure
  → prevented click/drag conflicts via activationConstraint (8px) + onClickCapture
```

The work covered across these 4 parts ultimately all came down to polishing the same screens (workspace, dashboard). One layout fix, one AI feature, one bug, one interaction — each small on its own, but the single flow of "fix the resume → manage application status" became far smoother as a whole.
