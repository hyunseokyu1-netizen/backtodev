---
title: 'Turning a Design Handoff Into a Real Product (1) — Reproducing an HTML Reference in Next.js'
date: '2026-07-01'
publish_date: '2026-07-20'
description: Reproducing a .dc.html design handoff built on a custom runtime, pixel-close, using our existing Next.js codebase's tokens, i18n, fonts, and components
tags:
  - Next.js
  - Tailwind CSS
  - i18n
  - TypeScript
---

I got a "handoff" from a designer. But instead of the usual Figma link, it was a single HTML file called `MatchDa.dc.html`. Opening it up, it was a **high-fidelity prototype** built on a custom runtime (`sc-if` for screen transitions, `renderVals()` exposing logic). Colors, spacing, interactions were all pinned down to the pixel — a "visible specification," so to speak.

The problem was clear. **I can't just copy-paste this HTML and ship it.** The runtime is different, and our project already runs on a Next.js + Tailwind stack. There was exactly one goal — **reference only the look and behavior, and rebuild it using our own codebase's patterns.**

This series is a record of that 4-stage journey (① reproduction → ② wiring up real data → ③ connecting CTA/search → ④ AI optimization). Part 1 is the most basic step: **moving the handoff into code.**

## Prep — understanding the stack first

When porting someone else's code (or design), the first thing to do is check "what's already in this house."

- **Next.js 16 App Router + React 19**
- **Tailwind v4** — no config file (`tailwind.config.js`), tokens set via `@theme` in CSS
- Fonts via `next/font/google`
- **No** i18n library

The spec (README) required the `IBM Plex Sans KR` font and exact hex/px values. I had to follow it precisely.

## Step 1. Design tokens — arbitrary values instead of extending the theme

There were two ways to handle color.

1. Register it in the Tailwind theme as `--color-primary: #046C4E` and use `bg-primary`
2. Just hardcode it as an **arbitrary value**, like `bg-[#046C4E]`

I went with option 2. The reason is simple — the spec explicitly said "use this hex **exactly as given**," and touching the existing theme (which only defines `background`/`foreground`) risked affecting other pages. During the handoff-reproduction stage, **having the spec and code map 1:1** is far more useful for debugging.

```tsx
// hardcode the README's hex/px values directly
<div className="rounded-[16px] border border-[#EAECEF] bg-white p-7">
  <div className="flex h-[46px] w-[46px] items-center justify-center
                  rounded-[12px] bg-[#ECFDF3] text-[#046C4E]">
```

Only the decorative SVG animation (the hero's dashed flow) got pulled out into `@keyframes` in `globals.css`, with `prefers-reduced-motion` applied too.

## Step 2. Fonts — expose as variables, applied only where needed

Loading `IBM Plex Sans KR` (body text) and `IBM Plex Mono` (the contact line) via `next/font`. The key is **exposing them as CSS variables** so they apply only to the areas that need them.

```tsx
// app/layout.tsx
const plexKr = IBM_Plex_Sans_KR({
  variable: '--font-plex-kr',
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
})
// <html className={`${plexKr.variable} ...`}>
```

Then, only inside the MatchDa screen wrapper, that variable gets assigned as the font.

```tsx
<div className="font-[family-name:var(--font-plex-kr)] antialiased text-[#111827]">
```

This way, existing pages (with a different font) stay untouched, while only the new screens wear IBM Plex.

## Step 3. i18n — no library, but clean separation

Since the UI mixes Korean and English, text needed to be separated from data. Rather than installing a new library, **a lightweight dictionary** was enough.

```ts
// lib/matchda/i18n.ts
export type Locale = 'ko' | 'en'
const ko = {
  nav: { login: '로그인', signup: '무료로 시작하기' },
  dashboard: {
    greeting: (name: string) => `안녕하세요, ${name}님`,  // ← even a function
    // ...
  },
}
export function getMatchdaDict(locale: Locale = 'ko') { /* ... */ }
```

There was **one trap** here, covered in the troubleshooting section.

## Step 4. Breaking down the components

I split the 3 screens (landing / dashboard / workspace) up by domain.

```
components/matchda/
  ui/        icons.tsx (inline SVG), Logo, MonogramChip, Avatar
  landing/   LandingHeader, SplitHero, FeatureCards, StatsBand, SiteFooter
  dashboard/ Sidebar, Topbar, StatCards, KanbanBoard, JobCard
  workspace/ WorkspaceTopbar, OptimizationBanner, ResumeDocument
lib/matchda/ i18n.ts, types.ts, mock-data.ts
```

For icons, instead of installing `lucide-react` fresh, I built the roughly 12 needed ones **directly as stroke SVGs.** One fewer dependency, and it made matching the handoff's exact shapes easier too.

## Step 5. Isolating the global chrome — the trickiest part

The existing root layout has a **global header** wrapping every page. But the new landing/dashboard screens are full-bleed designs, each with **its own header/sidebar.** Leave it as-is, and two headers stack on top of each other.

Since the root layout is a server component, it can't use `usePathname`, so I **extracted the global chrome into a client component.**

```tsx
// components/AppChrome.tsx ('use client')
const pathname = usePathname()
const isMatchda = pathname?.startsWith('/matchda')
if (isMatchda) return <>{children}</>   // full-bleed — hide the global header
return (<><header>…global header…</header><main>{children}</main></>)
```

The server layout only passes down user info as props, and the client handles path branching. Cleanly separated.

## Troubleshooting

Two things I ran into directly.

**① "Functions cannot be passed directly to Client Components"** — the landing page was throwing 500.
The i18n dictionary had a **function** like `greeting(name)`, and the cause was passing the entire dictionary down into a client component (the search bar). A function can't be serialized across the server→client boundary.

```tsx
// ❌ passing an object with a function, whole
<SearchBar t={t} />
// ✅ only the strings that are needed
<SearchBar country={t.hero.searchCountry} placeholder={t.hero.searchPlaceholder} />
```

**② Middleware kept bouncing the new screen to login** — `/matchda` kept redirecting to `/login` (307).
The existing auth middleware blocked everything except `/`/`/login`. Since the design demo is a public screen based on mock data, I added one line to the public path list.

```ts
if (pathname.startsWith('/matchda')) return supabaseResponse
```

## Summary

The core flow of reproducing a handoff:

1. **Understand the stack first** — build on top of what's already there
2. **Keep tokens as-is** — arbitrary values map spec-to-code 1:1 during reproduction, which is an advantage
3. **Expose fonts as variables**, apply only where needed
4. **Separate i18n into a lightweight dictionary** (but don't pass functions to the client)
5. **Isolate global chrome conflicts with a client component + usePathname**

This is where the "visible" stuff got built. In the next part, real data flows into this pretty shell — swapping mock data for real Supabase data, and promoting the design demo into the actual first screen.
