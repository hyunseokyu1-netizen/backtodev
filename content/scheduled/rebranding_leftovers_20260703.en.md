---
title: "The Last 20% of a Rebranding Migration — Bulk sed Replacements and the Onboarding Banner That Quietly Vanished"
date: '2026-07-03'
publish_date: '2026-07-29'
description: How I cleaned up 17 leftover screens while ripping out the Tailwind zinc palette for brand hex tokens, and the story of discovering that the onboarding entry point had disappeared entirely after switching to the new shell
tags:
  - Tailwind CSS
  - Rebranding
  - Design Systems
  - Next.js
---

> **MatchDa Build Log Series (3/3)**
> Part 1: The three-tier fallback for bot-blocked scraping · Part 2: Building a React autocomplete chip input from scratch · **Part 3: Finding a screen that quietly went missing during the rebranding migration (this post)**

## A rebrand doesn't end at the main screens

While rebranding my side project JobRadar into **MatchDa**, I moved the main screens — dashboard, discover, workspace — over to the new design. New logo, new favicon too. I thought "that's it, done." But clicking through the actual product from scratch told a different story.

- Login page: still the old style (Tailwind `zinc` palette)
- Onboarding page: still using the old global header
- Cover letter modal, tailored resume modal, JD input modal… **10 shared modals**: all still the old tone

The front 80% of a rebrand (main screens) is fun; the back 20% (modals, login, edge screens) is tedious and keeps getting pushed off. But users hit that 20% every single day. This post is a record of cleaning up that leftover 20% in one day, and the story of a **more serious problem** I found along the way — not a screen that looked dated, but one that had disappeared entirely.

## Step 1: Survey the situation — grep the old palette

The old design uses Tailwind's default `zinc` palette; the new design uses brand hex tokens (`#046C4E` green family + `#101828`/`#667085` gray family). That means finding leftover screens is a single grep.

```bash
grep -rl 'zinc-' src/components src/app --include='*.tsx'
```

This time it caught 17 files. It's a side effect of the old and new styles being **syntactically distinguishable** (utility class names vs. arbitrary values), but it turned out to be more useful than I expected — it lets you mechanically measure migration progress. You get a real completion condition: "zero `zinc` hits = migration done."

## Step 2: Bulk-replace the mechanical parts with sed

Most of the changes across the 10 modals are 1:1 color mappings. There's no reason to fix these by hand.

| Old (zinc) | New (brand token) | Use |
|---|---|---|
| `text-zinc-900` | `text-[#101828]` | headings |
| `text-zinc-700` | `text-[#344054]` | body text |
| `text-zinc-500` | `text-[#667085]` | secondary text |
| `border-zinc-200` | `border-[#ECEEF0]` | borders |
| `bg-zinc-100` | `bg-[#EEF1F3]` | background |
| `hover:bg-zinc-50` | `hover:bg-[#F4F6F8]` | hover background |

```bash
sed -i '' \
  -e 's/text-zinc-900/text-[#101828]/g' \
  -e 's/text-zinc-700/text-[#344054]/g' \
  -e 's/text-zinc-500/text-[#667085]/g' \
  -e 's/border-zinc-200/border-[#ECEEF0]/g' \
  -e 's/bg-zinc-100/bg-[#EEF1F3]/g' \
  src/components/CoverLetterModal.tsx src/components/JdInputModal.tsx # ...
```

Two things to watch out for.

1. **Always eyeball the diff after replacing.** There's no guarantee `bg-zinc-100` was always used with the same meaning (selected-state background vs. disabled background have different context, and would need different mappings)
2. Bulk-replacing accent colors (`blue-600` → brand green `#046C4E`) is risky. Status colors (error red, warning amber) get mixed in with accents, so I handled just this part by hand

Places where the structure itself changed, like the login page, got restyled rather than replaced. For example, the tab-switch buttons changed like this.

```diff
- <div className="flex gap-1 mb-6 bg-zinc-100 rounded-lg p-1">
+ <div className="flex gap-1 mb-6 bg-[#EEF1F3] rounded-[9px] p-[3px]">
```

## Step 3 (the twist): it wasn't the style that vanished — it was the screen

While going through the leftover screens, I noticed something strange. **A newly signed-up user had no way to reach onboarding.**

Tracing the cause, here's what happened.

1. The old version had a "complete your profile" banner in the global layout
2. During the rebrand, the main screens moved to the new MatchDa shell (its own sidebar + topbar)
3. The new shell doesn't render the old global chrome → **the banner became invisible everywhere**
4. There was nothing wrong in the style migration diff. Nothing was "broken" — it just **quietly fell out of the render path**, so there was no error of any kind

A feature disappeared with no compile error, no runtime error, no broken layout. This kind of loss is hard to catch in code review, and only shows up when you **click through the new-user scenario from scratch.**

For the fix, I put the banner back — but this time in the new shell's dashboard, not the global layout. I made the dashboard component own it directly, so it won't quietly disappear again the next time something gets restructured.

```tsx
{/* Users who haven't completed onboarding → nudge them to finish their profile (a prerequisite for matching / tailored resumes) */}
{needsOnboarding && (
  <a href="/onboarding"
     className="mb-6 flex items-center justify-between gap-3 rounded-[14px]
                border border-[#CEEBDC] bg-[#ECFDF3] px-5 py-4 hover:bg-[#DFF7E9]">
    <div>
      <div className="text-[14px] font-bold text-[#046C4E]">
        ✨ Complete your profile to get job matches tailored to you
      </div>
      <p className="mt-0.5 text-[13px] text-[#3D7A63]">
        Answer through chat and we'll even put together an English resume for you. Takes just 3 minutes.
      </p>
    </div>
    <span className="whitespace-nowrap rounded-[9px] bg-[#046C4E] px-4 py-2
                     text-[13px] font-semibold text-white">Complete →</span>
  </a>
)}
```

`needsOnboarding` is fetched by a server component (`page.tsx`) checking whether the profile is complete, and passed down as a prop. In the same spirit, I also added a "view in workspace" shortcut right after adding a posting on the discover screen — when you move features screen-by-screen, these **connective paths between screens** are the first thing to break.

## Troubleshooting checklist: what's easy to lose in a screen-by-screen migration

- [ ] Does everything that lived in the global layout (banners, toasts, notices) still render in the new shell?
- [ ] Did you click through the entire new-user first flow (signup → onboarding → first action)?
- [ ] Are screens that aren't tied to a route — modals, dialogs — also in the new tone (check with a grep for the leftover palette)?
- [ ] Are the paths connecting screen A to screen B (links, redirects) still alive?

## Summary

- When the old and new palettes are syntactically distinguishable, **grep becomes a migration-progress gauge** (zero `zinc-` hits = done)
- For 1:1 color mappings, **bulk sed replacement + eyeballing the diff** is faster and safer than hand-editing. But do accent and status colors by hand
- What's actually scary about a rebrand isn't a screen that looks dated — it's a **screen that quietly disappeared.** A silent, error-free loss like this is only caught by clicking through the new-user scenario
- When fixing it, don't just restore the position — **move ownership** (global → the specific screen) so the same accident can't recur

That wraps up a series spun out of four commits from a single day. Taken together with Part 1 (the scraping fallback) and Part 2 (the chip input component), roughly half the day went into building features, and the other half into re-verifying "the thing I thought I'd already built."
