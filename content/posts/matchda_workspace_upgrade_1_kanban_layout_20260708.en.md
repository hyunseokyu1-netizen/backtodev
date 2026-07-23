---
title: 'Workspace Upgrades (1): The Problem of Company Names Getting Cut Off in Kanban Cards'
date: '2026-07-08'
publish_date: '2026-08-25'
description: Fixing a kanban card layout where the status dropdown and the company name were fighting for space on the same line, by moving the status badge down to its own row
tags:
  - React
  - Tailwind
  - UI Design
  - Layout
---

## The situation

MatchDa dashboard's kanban board shows application status across four columns: "Preparing / Applied / Interview / Offer." Each card holds a company logo, job title, company name, application status (a dropdown), location, and match rate.

There was one problem that stood out here. When a company name was long ("Logo von Remofirst Remofirst," or something like "㈜ICN Korea"), the card header would wrap up to 3 lines, making card heights jagged and the whole board look messy.

The cause was in the layout structure.

```tsx
// Before
<div className="mb-[11px] flex items-start gap-[10px]">
  <MonogramChip brand={job.brand} />
  <div className="min-w-0 flex-1">
    <div className="truncate text-[14px] font-semibold">{job.role}</div>
    <div className="text-[12px] text-[#98A2B3]">{job.company}</div>
  </div>
  {job.status && <StatusSelect jobId={job.id} initialStatus={job.status} />}
</div>
```

The title/company-name block (`flex-1`) and the status dropdown (`StatusSelect`) were laid out side by side, **on the same line.** `flex-1` does grab all the remaining space, but since the status dropdown takes up part of the width, that reduces the horizontal room available for the company name. The structure meant a longer company name simply had to wrap that much more.

## The fix — splitting the status badge onto its own line

The simplest and most effective approach was to pull the status dropdown out of the title row entirely and drop it onto **its own separate line.** This lets the title/company-name block use the card's full horizontal width, so even if the company name wraps, it tops out at 1-2 lines.

```tsx
// After
<div className="mb-[10px] flex items-start gap-[10px]">
  <MonogramChip brand={job.brand} />
  <div className="min-w-0 flex-1">
    <div className="truncate text-[14px] font-semibold">{job.role}</div>
    <div className="text-[12px] text-[#98A2B3]">{job.company}</div>
  </div>
</div>

{job.status && (
  <div className="mb-[10px] flex justify-end">
    <StatusSelect jobId={job.id} initialStatus={job.status} />
  </div>
)}
```

This ends up solving two problems at once.

1. **The company name no longer gets truncated and appears shorter** — with the width constraint lifted, it wraps across fewer lines.
2. **The layout is stable** — the status dropdown always sits in the same spot (right under the title block, right-aligned), so badge position no longer varies jaggedly from card to card.

## Why clicking didn't break after moving the position

There was one thing I worried about while changing the layout. This kanban card is entirely a clickable link (navigating to the workspace), but the `StatusSelect` (status-change dropdown) inside it needs a click to only open the dropdown, not navigate the card. In other words, it needs to stop event bubbling — and my worry was **whether moving the component's position would break that handling too.**

Checking it, `StatusSelect` was already handling this itself.

```tsx
// StatusSelect.tsx
return (
  <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        setOpen((v) => !v)
      }}
      ...
```

`onClick={(e) => e.stopPropagation()}` is attached to the component's top-level wrapper `div`, so no matter where this component is placed within the card, its click event never propagates up to the parent (the card's whole-card click handler). In other words, since **the component itself completes its own responsibility without depending on its position,** all I had to change was the layout — there was no need to touch any separate event-handling code.

## What I learned

This fix was only a matter of moving a few lines of code, but it made me reconsider two things.

- **When placing multiple elements on the same line, figure out "who gets the leftover space" first.** Having `flex-1` doesn't mean that element uses the full width — it always yields however much space its sibling elements take up.
- **Making a component responsible for its own event propagation lets you freely rearrange the layout later.** If `stopPropagation()` had been handled on the parent's side instead, I would have had to worry about the event logic too, every time the position moved, exactly like this case.

## Summary

```
Problem: company name + status dropdown on one line → the company name wraps, card heights get jagged
Fix: move the status dropdown to its own separate row, below the title block
Verification: click events work correctly regardless of position, thanks to StatusSelect's own stopPropagation
```

Next up, on the same workspace screen: the story of completely redefining what the "AI analysis for this posting" button actually does.
