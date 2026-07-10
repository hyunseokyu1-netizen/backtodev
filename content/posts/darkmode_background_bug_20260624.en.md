---
title: "Screen Breaks Every Evening? The prefers-color-scheme and Tailwind v4 Layer Trap"
date: '2026-06-24'
publish_date: '2026-07-14'
description: The cause of a bug where only the background turned black due to automatic OS dark mode, and the fix using color-scheme to lock it to light
tags:
  - CSS
  - TailwindCSS
  - Next.js
  - Dark Mode
---

One evening, I opened my service and the screen looked off. During the day it was a perfectly clean white background, but now **only the background had turned pitch black, while the text and cards stayed in light mode**, making it look broken somehow. I'd never even built a dark mode.

What was even stranger was the pattern **"it seems to happen in the evening."** This clue turned out to be the decisive hint that caught the culprit. This post traces down an absurd bug — "dark mode breaking, even though I never built dark mode."

## Symptom: dark mode I never built

Here's how the situation broke down.

- Normal during the day (white background, black text)
- In the evening, only the background turns black, content stays styled for light → readability wrecked
- I had **never once** used a dark mode toggle or `dark:` classes in the code

The keyword "evening" immediately triggered a thought. **macOS's automatic appearance switching.** Leave the appearance set to "Auto" in system settings, and the OS automatically switches to dark mode after sunset. And the browser passes this OS setting straight through to CSS — via the `prefers-color-scheme` media query.

## Cause 1: leftover dark mode planted by create-next-app

Opening `globals.css`, there was the culprit. The **default template auto-generated when first creating a Next.js project** had code like this baked in.

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}

/* ← this block is the culprit */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;   /* nearly black */
    --foreground: #ededed;   /* nearly white */
  }
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

Starting a project with `create-next-app` bakes in this dark mode media query by default. **Once the OS goes into dark mode, `--background` switches to `#0a0a0a`, and the body background turns black.**

I thought "ah, so I just delete this," but one more question remained. **My body clearly had a bright background set via Tailwind, didn't it?**

```tsx
<body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
```

`bg-zinc-50` is a bright gray background. So why does `globals.css`'s black background win over it? Even though a class selector (`.bg-zinc-50`) should outrank an element selector (`body`)?

## Cause 2: Tailwind v4's layer priority (the real trap)

This is the core of this bug, and something that'll confuse you forever if you don't know it.

Tailwind CSS v4 is loaded via `@import "tailwindcss"`, and at that point **every utility class (`bg-zinc-50`, etc.) gets placed inside a CSS `@layer`.** Meanwhile, the `body { background: ... }` I wrote directly in `globals.css` is **outside any layer (unlayered).**

And CSS cascade rules have this:

> **A style not belonging to any layer always beats a style inside a layer.** (regardless of selector specificity)

In other words:

| Rule | Location | Priority |
|------|------|----------|
| `body { background: var(--background) }` | outside a layer | **wins** 👑 |
| `.bg-zinc-50 { background: ... }` | `@layer utilities` | loses |

Looking at selectors alone, `.bg-zinc-50` (a class) should normally beat `body` (an element). But since **layer rules apply before selector specificity**, the unlayered `body` rule wins.

To conclude:
1. Evening → OS dark mode → `--background` becomes `#0a0a0a`
2. `body { background: var(--background) }` (unlayered) **beats** `bg-zinc-50` (layered)
3. Only the background turns black, everything else stays light → **broken screen**

This bug came from two causes intertwined.

## Fix: lock it to light-only

This app was designed light-only from the start (every component assumes bright colors). So the right fix isn't to half-heartedly support dark mode — it's to **lock it to light entirely.**

I removed the dark media query from `globals.css` and added `color-scheme: light`.

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
  /* Lock even forms/scrollbars to light, regardless of OS dark mode (evening auto-switch) */
  color-scheme: light;
}

/* @media (prefers-color-scheme: dark) { ... } ← deleted entirely */

body {
  background: var(--background);  /* now always #ffffff */
  color: var(--foreground);
}
```

Two key things:

1. **Delete the `@media (prefers-color-scheme: dark)` block** → now `--background` stays white even if the OS is in dark mode
2. **Add `color-scheme: light`** → forces not just the background, but also **native browser UI** (input boxes, selects, scrollbars, etc.) into light mode. Skip this, and form controls render in the OS's dark style, looking equally odd.

Checked again in the evening after deploying, and the light screen held up cleanly.

## Troubleshooting

- **Deployed, but nothing changed** → browser CSS cache. A hard refresh (`Cmd+Shift+R` on Mac) fixes it.
- **Only inputs/dropdowns remain dark** → `color-scheme: light` was skipped. Fixing just the background color leaves native form controls still following the OS's dark theme.
- **Can't reproduce it** → just switch your own OS into dark mode directly to test. On macOS: System Settings → Displays → Appearance → "Dark." No need to wait until evening.

## Summary

The full story of "dark mode breaking, even though I never built dark mode":

1. **`create-next-app`'s default `globals.css`** had a `prefers-color-scheme: dark` media query hidden inside
2. In the evening, **the OS auto-switches to dark mode**, triggering it
3. Because of **Tailwind v4's layer rules**, the unlayered `body` background beats `bg-zinc-50`
4. Fix: **delete** the dark media query + **lock** `color-scheme: light`

I took away two lessons. First, **take one look at the default code your starter template planted.** Code you never wrote can still cause a bug. Second, **in Tailwind v4, an element style written directly in `globals.css` beats a utility class.** Without understanding the layer concept, you can end up stuck for a long while going "I definitely applied the class, why isn't it working?"

> Note: if you actually want to **support real dark mode**, that's a separate, sizable project — dressing every component in `dark:` variant classes and attaching toggle UI. Nothing like locking it to light-only. Do it properly when it's actually needed.
