---
title: 'Building a SaaS With an AI Coding Assistant (7): Turning a Design Handoff File Into a Landing Page Demo Showcase'
date: '2026-07-04'
publish_date: '2026-08-06'
description: How I added three demo showcases (resume translation, job discovery, applications kanban) that reproduce actual product screens on a landing page that had only ever had a hero and feature cards — the story of a dormant design handoff file getting a second life as a marketing asset
tags:
  - Next.js
  - Tailwind CSS
  - SaaS
  - Landing Page
  - AI Coding Assistant
---

## Starting off

By Part 6, billing was working, the chatbot was answering, and operational gaps had been patched. But the actual **first impression** was still a problem. The product owner's (my own) requirement was clear.

> "I want visitors to land on the homepage, see an example, and immediately go 'oh wow, this feature's good.'"

At the time, the landing page was just a hero, feature cards, and a stats band. There was a **sentence** saying "AI translates and tailors your resume," but no **screen** showing what that actually looks like. Structurally, a visitor never saw the product once before signing up.

This part is about the two commits (`e3d00ed`, `ac37088`) that fixed this. Zero new features — all the new code is landing-page mockup. But the material is fun — the star of the show is **a design handoff file received and implemented weeks ago, then forgotten.**

## Step 1. Finding the material — the project already had a hifi mockup

There are a few ways to show product screens on a landing page: take screenshots and drop them in as images, render the actual components with demo data, or draw new mockups from scratch.

But this project already had good material sitting around. The design handoff bundle received during the rebrand (`design_handoff_matchda/MatchDa.dc.html`) — a single file in a custom "Design Component" format (`.dc.html`) — contained **hifi mockups of 3 screens: landing, dashboard, and workspace.** It had been used to implement the landing page and dashboard back then, and had since been treated as "a document with nothing left to look at, now that the implementation's done."

The handoff README explicitly states a principle.

> The file included in this bundle (`MatchDa.dc.html`) is a **design reference built in HTML** — it is not production code meant to be copied as-is and shipped. The goal of the work is to **reproduce this HTML design using the target codebase's existing environment, patterns, and libraries.** Use the exact hex and px values below as-is.

There was a temptation here. Since this HTML renders beautifully on its own, dropping it into the landing page via an `iframe` would take 10 minutes. But I chose to reproduce it as static JSX instead.

| | iframe embed | Static JSX reproduction |
|---|---|---|
| Implementation speed | Fast | Slow |
| Dependency on the custom runtime (.dc.html) | Remains | Removed |
| Responsive support | Effectively impossible | Free, via Tailwind breakpoints |
| Editing demo data | Have to touch the original HTML | Just edit a constant array |
| Matches codebase patterns | ✗ | ✓ (exactly the handoff README's principle) |

With an AI coding assistant, the cost of "reproducing" isn't high either. Just feed it the handoff HTML and say "reproduce this screen using our landing component patterns."

## Step 2. WorkspaceShowcase — the core value, right below the hero

The first showcase is the workspace screen demonstrating MatchDa's core value — **"a Korean resume → a job-tailored English resume"** (`e3d00ed`). It reproduces the handoff's `isWorkspace` screen.

The layout matches the real workspace exactly.

- Top: a **"Optimizing for the Spotify posting" banner** + an **82%** match-rate badge
- Left: the original resume (Korean, "unedited · 312 words")
- Right: the AI-translated and tailored resume (English, "just updated · 298 words") — with optimized-phrase highlights + an AI adjustment-reasoning note

One fun detail was the **optimized-phrase highlight.** The handoff token calls for "background #DCF5E8 + a brand-color underline," but using `border-bottom` makes the underline look awkward on inline text that wraps across lines. I reproduced it with a `box-shadow inset` trick instead.

```tsx
function Hl({ children }: { children: React.ReactNode }) {
  // optimized-phrase highlight (handoff token: #DCF5E8 + brand underline)
  return (
    <span className="rounded-[3px] bg-[#DCF5E8] px-[3px] [box-shadow:inset_0_-2px_0_rgba(4,108,78,0.45)]">
      {children}
    </span>
  )
}
```

Phrases wrapped in this `<Hl>` visually show off "wording the AI adjusted to fit the posting."

```tsx
<li>Designed and operated a <Hl>high-throughput, distributed payments system</Hl> handling 5M daily transactions</li>
<li>Reduced response latency by 40% and led the migration to a <Hl>microservices architecture</Hl></li>
```

And since a highlight alone doesn't communicate "why it was changed this way," I added an AI adjustment-reasoning note below the resume. *"Adjusted the wording to emphasize your large-scale payments-system experience, matching Spotify's requirement for 'distributed systems.'"* — this one line explains the differentiator of "job-tailoring," not just "a translator."

The CTA branches by login state. Since the landing component already knows `authed` on the server, passing it down as a prop is all it takes.

```tsx
// MatchdaLanding.tsx
<WorkspaceShowcase ctaHref={authed ? '/profile' : signupHref ?? '/login?mode=signup'} />
```

A logged-out visitor goes to signup; an already-signed-up user goes straight to their own resume editor. The button copy is "Try it with your own resume" — carrying straight through into the next action right after seeing the demo.

## Step 3. DiscoverShowcase — for a screen the handoff doesn't have, use the real product

The second showcase, job discovery, was a different situation. At the time the handoff was created, `/discover` (one-click recommended-company collection + AI scoring) didn't exist yet, so **there's no original in the handoff to reproduce.** So this time I did the reverse — I turned the actual product UI into a mockup (`ac37088`).

```tsx
const PRESETS = ['Apple', 'Spotify', 'Stripe', 'Anthropic', 'Figma', 'Reddit']

const DEMO_JOBS = [
  {
    score: 82,
    title: 'Product Manager, AI Growth',
    meta: 'Figma · San Francisco, CA · United States',
    reason: 'A Product Manager for AI Growth is a perfect match for product strategy, AI experience, and data-driven prioritization',
  },
  // ...
]
```

Next to the recommended-company chips (`+ Apple`, `+ Spotify`, …), I slotted in a chip like this.

```tsx
<span className="inline-flex items-center rounded-full border border-[#CEEBDC] bg-[#ECFDF3] px-3.5 py-1.5 text-[13px] font-medium text-[#046C4E]">
  Figma · ✓ 171 found
</span>
```

This **171** isn't a made-up number. It's the actual count of postings that accumulated from running recommended-company collection for several days, covered in Part 6. Putting a real operational number into the demo mockup gives it the feel of "a screen where collection just finished." The job cards, too, faithfully reproduce a scaled-down version of everything visible in the real `/discover` — the score badge, the matching reason, and the "add to tracking" button.

## Step 4. ApplicationsShowcase — separating the kanban's data into constants

The third showcase reproduces the kanban board from the handoff's `isDashboard` screen. Four columns — preparing → applied → interview → offer — showing the final stage of the user journey ("tracking").

A kanban mockup has a lot of card elements, and hardcoding them into JSX gets messy fast. I split the demo data out into a typed constant array.

```tsx
interface DemoCard {
  initial: string
  chipBg: string
  role: string
  company: string
  location: string
  salary: string
  match: number
  note?: { text: string; tone: 'interview' | 'offer' }
  emphasized?: boolean
}

const COLUMNS: DemoColumn[] = [
  {
    label: 'Preparing',
    dot: '#98A2B3',
    cards: [
      { initial: 'S', chipBg: '#1DB954', role: 'Backend Engineer', company: 'Spotify', location: 'Stockholm, Sweden', salary: '€65K–85K', match: 82 },
      // ...
    ],
  },
  {
    label: 'Interview',
    dot: '#B45309',
    cards: [
      { initial: 'G', chipBg: '#00B14F', role: 'Product Manager', company: 'Grab', location: 'Singapore', salary: 'S$110K–140K', match: 91, note: { text: 'Round 2 interview · Jun 30', tone: 'interview' } },
    ],
  },
  // ...
]
```

Rendering is a single `COLUMNS.map()`, and changing the demo scenario later just means editing this array. I also stayed faithful to the handoff's design tokens.

- Per-status dot colors: preparing `#98A2B3` / applied `#1A56DB` / interview `#B45309` / offer `#046C4E`
- Branching the interview-schedule badge (`#FEF3E2` background + `#B45309` text) and the offer badge (`#ECFDF3` + `#046C4E`) off `note.tone`
- Company-initial chips using each company's brand color (`Spotify #1DB954`, `Grab #00B14F`, etc.) — a cheap trick that makes a card look like "a real company" even without a logo image

I matched the Spotify backend card to the same posting and the same match rate (82%) as the workspace demo in Step 2. Scrolling down through the three sections, one continuous story emerges — "this person tailored their resume to a Spotify posting → discovered other postings → is now tracking applications."

## Step 5. Assembly — arranging by user journey and a background rhythm

The three sections aren't arranged by feature importance — they're arranged in **user-journey order.**

```tsx
<SplitHero t={t} searchHref={searchHref} />
<WorkspaceShowcase ctaHref={authed ? '/profile' : signupHref ?? '/login?mode=signup'} />  {/* 1. translate & tailor */}
<DiscoverShowcase />       {/* 2. discover */}
<ApplicationsShowcase />   {/* 3. track */}
<FeatureCards t={t} />
<StatsBand t={t} />
```

The core value (resume translation) sits directly under the hero so it lands the moment someone visits, and everything after follows the flow of actually using the product. Section backgrounds alternate gray `#F4F6F8` → white → `#F7F8FA`, creating a rhythm so the mockup cards (white) stay visually separated from the background in every section.

A few implementation details.

- **Design tokens ported over as-is via Tailwind arbitrary values** — since the handoff said "use the exact hex/px values as-is," I moved inline style values straight into classes like `rounded-[14px]`, `text-[13px]`, `bg-[#ECFDF3]`, `shadow-[0_24px_60px_-28px_rgba(4,108,78,0.28)]`. Whether to promote these to design-system variables is a later problem — pixel accuracy came first.
- **Every showcase is a server component** — all three are static demos with not a single line of `'use client'`. I added three screens' worth of UI to the landing page, and client JS grew by exactly 0 bytes.
- **Verified with Playwright screenshots** — before deploying, I screenshotted the whole landing page locally to eyeball the highlight underline, badge colors, and kanban alignment. For mockup reproduction work, looking at the rendered result is faster than reviewing a diff.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| Showing product screens on a landing page | Static JSX mockups instead of screenshots/iframes — responsive, maintainable, matches codebase patterns |
| Making use of a design handoff | Not "implement and done" — reuse it as source material for a landing demo |
| A screen missing from the handoff | Turn the actual product UI into a mockup in reverse |
| Underlining inline-text highlights | `[box-shadow:inset_0_-2px_0_...]` — natural even across line wraps, with no border |
| Managing mockup data | Split into a typed constant array (`COLUMNS`), JSX is just a map |
| Making a demo feel alive | Reflect real operational numbers (171) and a consistent scenario (Spotify 82%) in the demo |
| CTA | Branch by login state (logged out → signup, logged in → the relevant feature) |

## Summary

1. **One screen beats saying "the feature is good."** Value that a hero line and feature cards failed to communicate got across instantly with a single Korean↔English resume comparison screen. Visitors need to be able to see the product before signing up.
2. **A design handoff isn't a one-time document.** A handoff file whose implementation was long finished got a second life weeks later as the raw material for a landing demo. The design tokens, layout, and demo data baked into a hifi mockup are also a marketing asset.
3. **Reproducing beats embedding.** An iframe takes 10 minutes, but leaves you with a custom-runtime dependency and responsive problems. With an AI assistant, the cost of "reproducing in the codebase's own patterns" drops sharply, so there was no reason not to honor the handoff README's principle.
4. **Real numbers bring a mockup to life.** The 171 in "Figma ✓ 171 found" is genuine operational data. Unlike a plausible-sounding made-up number, a real figure gives the demo the texture of "a product that just ran."
5. **A demo is still code.** Splitting out constant arrays, keeping things as server components, defining types — build a mockup carelessly and you pay for it the next time the demo scenario needs to change.

Now, the moment a visitor lands on matchda.com, they see three scenes of the product actually working. Whether it got them to "oh wow, this feature's good" — that's what the real user reaction, covered in the next part, will tell us.
