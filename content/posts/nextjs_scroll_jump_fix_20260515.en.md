---
title: 'Why My Next.js Site Got a Scroll Animation Every Time I Navigated Pages'
date: '2026-05-15'
publish_date: '2026-06-06'
description: Tracking down two consecutive scroll-jump bugs caused by a back button implementation tangled up with scroll-behavior smooth
tags:
  - NextJS
  - AppRouter
  - Debugging
  - UX
  - CSS
---

Some weird animation showed up on my blog.

Clicking a post from the listing made the detail page slide up from the bottom, and pressing the `← cd ..` button on the detail page made the list page slide down from the top. I definitely never added this animation.

Tracing the cause turned up two bugs. One was how the back button was implemented, the other was a single line of global CSS.

---

## The full picture of the symptom

| Navigation direction | Behavior |
|-----------|------|
| List → click a detail page | detail page scrolls **from the bottom up** |
| Detail → click `← cd ..` | list page scrolls **from the top down** |

At a glance, it looks like a deliberately added scroll animation. It wasn't.

---

## Cause 1 — `scroll-behavior: smooth`

First, I opened `globals.css`.

```css
/* globals.css */
html { scroll-behavior: smooth; }
```

This one line was the core cause.

Set `scroll-behavior: smooth` globally on `html`, and **the animation applies even when JavaScript programmatically moves the scroll position** — not just when the user scrolls manually.

Next.js App Router programmatically handles two things when navigating:

- **Moving to a new page**: `window.scrollTo(0, 0)` — this should jump to the top instantly, but the smooth animation applies instead
- **Going back to a previous page**: restoring the saved scroll position — the smooth animation applies all the way to the restored position too

So every page navigation ended up looking like a smooth sliding scroll.

**Fix**: change to `scroll-behavior: auto`

```css
/* globals.css */
html { scroll-behavior: auto; }  /* smooth → auto */
```

With this, Next.js's programmatic scroll jumps instantly, and only the user's own manual scrolling follows the default behavior.

---

## Cause 2 — `<Link href="/posts">` isn't going back

After fixing the CSS, the scroll animation was gone. But pressing the `← cd ..` button still felt off — the list page felt like it was loading from scratch.

Looking at the code, it was implemented like this:

```tsx
// existing code
<Link href="/posts">← cd ..</Link>
```

Looks like going back at a glance, but this isn't the browser's "back" — it's a **fresh navigation** to `/posts`. It doesn't step backward through browser history; it adds a new history entry.

So the list page behaved like this:

```
1. Click the Link → /posts renders completely from scratch
2. Server component: re-fetches the post list via the GitHub API
3. Data arrives → post cards get added to the DOM → page height grows
4. Next.js: "this page was previously scrolled to 600px, so let's restore that"
5. Scrolls to 600px (with smooth removed, now an instant jump)
```

Removing smooth got rid of the animation, but the scroll-restoration itself still happened.

**Fix**: swap it for `router.back()`

Just use actual back navigation. It pops the previous page off the browser history stack and restores it, pulling from cache rather than a fresh render. The scroll position stays exactly as it was.

`useRouter` is a client hook and can't be used directly in a server component. Split it into a small client component.

```tsx
// components/BackButton.tsx
"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ label = "← cd .." }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: "hsl(var(--muted-foreground))",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      {label}
    </button>
  );
}
```

Swap it in on the post detail page (a server component) like this.

```tsx
// Before
import { Link } from "@/i18n/navigation";
<Link href="/posts">← cd ..</Link>

// After
import BackButton from "@/components/BackButton";
<BackButton />
```

---

## Link vs. router.back() — which to use, when

| Situation | Use |
|------|------|
| A link that always goes to the same page | `<Link href="...">` |
| Something reachable from various paths | `router.back()` |
| Need to preserve the scroll position of the previous page | `router.back()` |
| A link needed for SEO (crawlers need to follow it) | `<Link href="...">` |

Going back from a post detail page to the list is a textbook `router.back()` case. You might've come from the list, or you might've landed on the post directly via URL — either way, the intent behind "go back" is "return to wherever I just was."

---

## Troubleshooting

**I removed smooth, and now anchor links (`#section`) lost their smooth scrolling**

That's because `scroll-behavior: smooth` was removed globally. If you need smooth scrolling specifically for anchor navigation, handle it explicitly in the link's click handler.

```tsx
// when you need smooth scrolling for an anchor link
element.scrollIntoView({ behavior: 'smooth' })
```

Applying it selectively where needed, rather than globally in CSS, is the safer approach.

**Pressing `router.back()` does nothing**

This happens when there's no previous page in browser history (e.g., the user arrived by typing the URL directly). Add a fallback.

```tsx
onClick={() => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/posts')
  }
}}
```

---

## Summary

The cause and fix for both bugs, summarized:

```
Bug 1 — scroll-behavior: smooth
  Cause: html { scroll-behavior: smooth } in globals.css
  Effect: Next.js's programmatic scrollTo gets animated too
  Fix: changed to scroll-behavior: auto

Bug 2 — Link href vs. router.back()
  Cause: <Link href="/posts"> = fresh navigation (adds to history)
  Effect: list page re-renders + scroll-position restoration jump
  Fix: router.back() = browser history restoration (instant, from cache)
```

Setting `scroll-behavior: smooth` globally on `html` produces animation in places you never expect — especially in a framework like Next.js, where page navigation is handled programmatically via JavaScript. It's better to apply it explicitly only where it's actually needed.
