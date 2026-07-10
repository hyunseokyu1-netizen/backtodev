---
title: "Showing a Game Overlay on the Home Screen — Once Per Session, So It Doesn't Get Annoying"
date: '2026-07-10'
publish_date: '2026-09-06'
description: How to show a pixel game as a full-screen overlay on the blog's first visit to home, without annoying repeat visitors, using sessionStorage, and a stacking-context bug where the X button got hidden behind the Nav
tags:
  - NextJS
  - React
  - UX
  - sessionStorage
  - PixelVillage
---

I built a pixel RPG village inside the blog with Three.js (I'm writing the build log as a separate series). Once it was built, I got ambitious. **I wanted to show this village immediately to a first-time visitor landing on home.**

But this is exactly where the UX dilemma starts. What if the game pops up full-screen every single time someone visits home? For a repeat visitor who just came to read a post, that's nothing but an annoying popup they have to hunt down an X button for, every time. Even I'd get irritated by the second visit.

This post is the record of striking that balance. The implementation itself is only a few lines, but the process of comparing options, and a z-index bug I ran into along the way, seemed worth sharing.

---

## Laying out the requirements

- On the first visit to home (`/`), the pixel village shows up as a **full-screen overlay**
- Clicking the X button in the top-right closes it, revealing the normal blog home
- The person who closed it **never gets shown it again**

The third one is the crux. Where exactly should the line for "never show it again" be drawn?

## Comparing 3 options

| Approach | Behavior | Pros | Cons |
|------|------|------|------|
| Always show it | An overlay on every home load | Minimal implementation | Annoys repeat visitors every time |
| sessionStorage | Once per tab session | Shows fresh on every new visit | Can't be seen again within the same tab |
| localStorage + date | Once per day | Fine-grained control over exposure frequency | Complex code, might never be seen again |

**I chose sessionStorage.** The reason is simple.

- Refreshing, or navigating back to home after reading a post, doesn't trigger it → doesn't interrupt the browsing flow
- Close the tab and come back later, and it shows again → shows again for someone who's "been away a while"
- The code is two lines

Using localStorage for "once a day" would be more refined, but I doubted a personal blog really needed that level of frequency control. For anyone who wants to see the village again, by the way, I added a separate Village menu item to the Nav. The overlay is strictly an "entrance event" — the real way in is the menu.

## Implementation — the overlay component

```tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import VillageGame from "@/app/[locale]/village/VillageGame";

const SEEN_KEY = "pv-intro-seen";

export default function VillageIntroOverlay({ locale, posts, guestbook }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // avoids SSR hydration mismatch — check the session only after mounting
    if (!sessionStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);

  if (!open) return null;

  const close = () => {
    sessionStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#0a0d08", overflowY: "auto" }}>
      <button onClick={close} style={{ position: "fixed", top: 18, right: 22, zIndex: 101 }}>
        X
      </button>
      <VillageGame locale={locale} posts={posts} guestbook={guestbook} />
    </div>,
    document.body
  );
}
```

Three points worth noting.

### 1. Check sessionStorage inside a useEffect

At first, you're tempted to write it like this.

```tsx
// ❌ blows up during SSR
const [open, setOpen] = useState(!sessionStorage.getItem(SEEN_KEY));
```

`sessionStorage` is a browser API, so it doesn't exist during server rendering. In Next.js, this either throws a `ReferenceError`, or, even if somehow avoided, causes a hydration mismatch where the server's HTML and the client's first render differ.

So **the initial value is always `false` (hidden), and whether to open it gets decided in a useEffect after mounting.** The overlay shows up one beat late on first paint, but since it fades in, it doesn't feel awkward.

### 2. Record "seen" only when it closes

Recording it the moment it opens would mean someone who refreshes mid-game loses the village. Only recording it when the close button is clicked matches exactly the intent of "never show it again only to someone who explicitly closed it."

### 3. Locking scroll on the page underneath

If the home page underneath keeps scrolling while the overlay is up, it looks broken.

```tsx
useEffect(() => {
  if (!open) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = prev;
  };
}, [open]);
```

---

## Troubleshooting — the X button exists but isn't visible

Deploying and checking, the X button wasn't showing up. It was clearly there in the code. `position: fixed`, `zIndex: 101` — so why?

The cause was a **stacking context.** My layout structure looked like this.

```tsx
// layout.tsx
<Nav />                                    {/* sticky, z-index: 50 */}
<main style={{ position: "relative", zIndex: 10 }}>
  {children}                               {/* the overlay renders in here */}
</main>
```

The overlay's `zIndex: 100` is **100 within the stacking context created by `<main>`.** Seen from outside, the entire `<main>` is one z-index-10 block, and its sibling, Nav (z-50), always draws on top of it. The X button sat in the top-right of the screen — exactly Nav's header area — so it was hidden behind Nav's semi-transparent background.

If a parent has `position: relative` + `z-index`, a child can't escape the parent's context even by raising its own z-index to 9999. This is a genuinely common trap with modals and overlays.

The fix is a **portal.** Rendering the overlay outside `<main>`, directly under body via `createPortal(overlay, document.body)`, escapes `<main>`'s stacking context. Now the overlay's z-100 gets compared at the same level as Nav's z-50, so it covers Nav too.

```tsx
return createPortal(<div style={{ zIndex: 100 }}>...</div>, document.body);
```

The React component tree stays the same, so props and state are all preserved — only the rendered DOM location changes.

---

## Summary

| Item | Choice | Reason |
|------|------|------|
| Exposure frequency | sessionStorage, once per session | Prevents annoying repeat visitors + shows again in a new session |
| When to check | useEffect (after mounting) | Avoids an SSR hydration mismatch |
| When to record | On clicking the close button | Persists even if refreshed mid-game |
| Render location | createPortal → document.body | Escapes the parent's stacking context, displays above Nav |

"I closed it, and it doesn't show up on refresh" isn't a bug — it's the design. Close the tab and come back, and the village welcomes you again.
