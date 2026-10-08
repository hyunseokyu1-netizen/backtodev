---
title: "The Mobile List Redesign That Started From One Screenshot and 'These Cards Feel Kind of Big'"
date: '2026-07-16'
publish_date: '2026-12-04'
description: Why vertical cards looked loose and empty on mobile, and how I used sm:hidden / hidden sm:flex to switch just the mobile view to a horizontal list while leaving the desktop grid untouched
tags:
  - Next.js
  - Tailwind CSS
  - Responsive UI
  - Mobile
---

When you're building a feature, it's easy to stay focused on logic and lose sight of "what does this actually look like." The Nogari room list card was exactly that. It looked fine on the desktop grid, and I only noticed the problem once I got a mobile screenshot.

> "The Nogari room cards feel kind of big. Seems like there's a lot of empty space too. Should we make the image bigger and shrink the row height a bit?"

The existing card had a vertical layout — photo on top, text below. On the desktop grid (2-4 per row), a near-square card fits well, but on mobile, once those cards stack into a single column, all the leftover space between the photo and the text, and between the text and the stats, became plainly visible. Each card was also tall, so there was a lot more scrolling involved.

## Why I Changed the Layout Instead of Just Shrinking It

At first I thought about just trimming padding or font size, but the root problem was that the "photo on top, text below" structure itself didn't fit a mobile vertical-scroll list. Think of a Twitter or Reddit feed and the answer's obvious — a big circular profile photo on the left, text compressed into two lines on the right, in a horizontal list. So I decided to switch the direction to horizontal entirely.

- Left: a big circular photo (avatar)
- Right, first line: badge + title
- Right, second line: subtitle (affiliation/party) + stats (comments, likes, dislikes)

## Step 1 — Pulling the Stats Block Out Into a Shared Variable

Both the horizontal and vertical cards needed to show the same comment/like/dislike stats, so I pulled this part out into a variable first and reused it across both layouts.

```tsx
const stats = (
  <>
    <span className="inline-flex items-center gap-1">
      <MessageCircle className="size-3.5" strokeWidth={2} />
      {topic.comment_count}
    </span>
    <span className="inline-flex items-center gap-1">
      <ThumbsUp className="size-3.5" strokeWidth={2} />
      {topic.like_count}
    </span>
    <span className="inline-flex items-center gap-1">
      <ThumbsDown className="size-3.5" strokeWidth={2} />
      {topic.dislike_count}
    </span>
  </>
);
```

## Step 2 — Adding a Mobile-Only Horizontal Card

I added the horizontal markup inside the same `TopicCard.tsx`. I put the photo as a big `size-20` circular avatar on the left, and packed the right side into one line of badge+title and one line of subtitle+stats, pushing information density way up.

```tsx
<div className="flex items-center gap-4 rounded-[18px] border-2 border-ink bg-card px-4 py-3.5 ... sm:hidden">
  {topic.image_url ? (
    <Avatar className="size-20 shrink-0 border-[1.5px] border-ink">
      <AvatarImage src={topic.image_url} alt={topic.title} />
      <AvatarFallback className="text-xl">{topic.title.slice(0, 1)}</AvatarFallback>
    </Avatar>
  ) : (
    <NogariIcon strokeWidth={14} eye={false} className="w-14 shrink-0 text-ink opacity-25" />
  )}
  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant="outline" className="shrink-0 px-2 py-0.5 text-[11px]">
        {TYPE_LABELS[topic.topic_type]}
      </Badge>
      <span className="truncate text-[17px] font-bold text-ink">{topic.title}</span>
    </div>
    <div className="flex min-w-0 items-center gap-2.5 text-[12.5px] text-meta">
      {sub && <span className="truncate">{sub}</span>}
      {stats}
    </div>
  </div>
</div>
```

`truncate` was essential here since the title can run long. Without it, the layout would break in any room where a politician's name gets a long modifier tacked onto the end.

## Step 3 — Branching Between Two Layouts in One Component With Responsive Classes

Instead of building a separate component, I branched within the same `TopicCard` using the combination of `sm:hidden` (visible on mobile only) and `hidden sm:flex` (visible at sm and up).

```tsx
{/* 모바일 — 가로형 리스트 카드 */}
<div className="flex items-center gap-4 ... sm:hidden">
  {/* ... */}
</div>

{/* sm 이상(그리드) — 기존 세로 카드 */}
<div className="hidden h-full flex-col gap-3.5 ... sm:flex">
  {/* ... */}
  <div className="mt-auto flex items-center gap-3 border-t-[1.5px] border-divider pt-3 text-[13px] text-meta">
    {stats}
  </div>
</div>
```

I did consider splitting this into two components, but since it's really just rendering the same data differently, switching between two markup blocks with CSS was simpler. No need to pass `topic` twice either, and state management stays in one place.

## Trade-offs

- **Desktop stayed untouched**: the vertical card already worked well on the grid, so I only changed mobile and left the desktop UI alone. No reason to force the two into one unified look.
- **Handling long titles**: the horizontal layout crams badge+title onto one line, so space is tight, which made `truncate` mandatory.
- **Two sets of markup exist now**: from a maintenance standpoint, I minimized duplication by pulling out shared parts like the stats display into a variable, but I accepted the trade-off of keeping two separate layout structures.

## Verification — Confirmed With Screenshots at Two Viewports

Layout changes are hard to judge from code alone, so I used Playwright to screenshot both viewports and compare.

- Mobile viewport (390px): confirmed the horizontal list visibly reduced card height
- Desktop viewport (1280px): confirmed the existing grid layout stayed exactly the same

Laying the before/after screenshots side by side, the vertical space per card clearly shrank, and I could see with my own eyes that more rooms now fit on the same screen.

## Wrap-up

1. **One screenshot is the most accurate bug report there is** — seeing the actual screen pinpoints the problem far faster than hearing "there's a lot of empty space"
2. **Mobile and desktop can legitimately need different layouts** — rather than forcing one structure to work everywhere, branch into genuinely different markup with responsive classes when needed
3. **Pull out the shared parts as variables, branch structure boldly** — extract only what repeats, like the stats block, and cleanly split the layout itself with `sm:hidden` / `hidden sm:flex`
4. **Always verify layout changes with per-viewport screenshots** — code review alone can't tell you "how much it actually shrank"

A small request ("the cards feel kind of big") ended up making me rethink the layout structure itself. When feedback comes in, it turns out that stepping back to ask "is this structure right in the first place" is a faster path in the end than fiddling with code-level micro-adjustments.
