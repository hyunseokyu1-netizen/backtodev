---
title: 'Building a SaaS With an AI Coding Assistant (1): Rebuilding the URL Structure From Scratch'
date: '2026-07-04'
publish_date: '2026-07-31'
description: How I cleaned up MatchDa's tangled URL structure and redesigned the discover/applications flow off a single piece of user feedback
tags:
  - Next.js
  - SaaS
  - AI Coding Assistant
  - Product Design
  - Claude Code
---

## Starting off: why I'm writing this series

These days I'm building a side project called **MatchDa** — a job-matching platform that automatically collects IT job postings from Australia and New Zealand, scores them against a profile with AI, and generates tailored resumes and cover letters for each posting.

The unusual thing about this project is that nearly all of the code was written together with Claude Code, an AI coding assistant. Coming back to development after a break, I wanted to run an experiment: "can pair-programming with AI actually get a real SaaS shipped?"

Short answer — yes. But there's a different flavor of pitfall than when a person is coding solo. In this one session alone there was a URL structure refactor, feature separation, a flow redesign driven by user feedback, and (embarrassingly) **an incident where the AI actually deleted a real user account.** I want to write these experiences up as a series.

- Part 1 (this post): Cleaning up the URL structure + splitting dashboard/applications + redesigning the discover flow
- Part 2: A data-loss incident and its recovery — what you absolutely need to know before handing the DB to an AI
- Part 3: Auto-analyzing resumes + using RAG to improve tailored resume quality
- Part 4: One-click collection of recommended companies + a support chatbot + Stripe subscription billing

This part looks like a relatively quiet refactor of "tidying up screens and URLs," but it's actually one of the areas that wobbles most often when building a SaaS.

## Why the URLs had to be fixed first

MatchDa was originally developed by bolting screens onto paths under `/matchda`, `/matchda/dashboard`, and so on. That was convenient during the early prototype stage, but as features grew, the cracks showed.

- `/matchda` was treated as the dashboard regardless of login state, so a logged-out visitor landed on an awkward, half-baked screen
- The landing page (marketing intro screen) and the actual product screens weren't distinguishable by URL
- Sharing links or bookmarking was awkward (you can't exactly show someone `/matchda/dashboard`)

So early in this session I decided to rebuild the URL structure from the ground up.

## Step 1. Set the principles first

Before diving into the refactor, I set the principles first. I've come to feel that when you're handing code to an AI assistant, agreeing in words on "what changes how" beforehand matters far more than with a human collaborator. Otherwise the AI can write something that looks plausible but isn't the structure you actually wanted.

The principles I settled on were simple.

| Path | Role | Login required |
|---|---|---|
| `/` | Public landing (product intro) page | No |
| `/dashboard` | First screen after login (summary) | Yes |
| `/applications` | Application tracking (kanban/list) | Yes |
| `/discover` | Job discovery (posting collection) | Yes |
| `/workspace` | Per-posting resume/cover-letter workspace | Yes |
| `/profile` | Resume studio | Yes |

The core rule is "`/` is always the landing page." Whether logged in or not, visiting `/` shows the same intro page — only the header CTA changes, from "Sign Up" to "Go to Dashboard," depending on login state.

## Step 2. Working in commit-sized chunks

Looking at the actual commit log, the work was split like this.

```
048f69d refactor: clean up URL structure — root is landing, dashboard moves to /dashboard
63e8f11 refactor: move workspace to /workspace — URL structure unification complete
6d3b2df feat: split out applications (/applications) + summarize dashboard + list toggle · discover search/sort
```

I split this into "move URLs" → "move workspace" → "split features" instead of cramming it all into one commit, because a large diff produced by an AI assistant is hard to review in one pass. Splitting commits small also narrows the blast radius that a single `git revert` needs to cover if something goes wrong.

The actual file list for the `048f69d` commit looks like this.

```
src/app/auth/callback/route.ts                     |  2 +-
src/app/dashboard/page.tsx                         | 78 +++++++++++++++++++
src/app/login/LoginForm.tsx                        |  2 +-
src/app/matchda/dashboard/page.tsx                 | 30 +-------
src/app/matchda/page.tsx                           |  6 +-
src/app/page.tsx                                   | 90 +++-------------------
src/components/matchda/landing/LandingHeader.tsx   | 28 ++++---
src/middleware.ts                                  |  4 +-
```

`/app/page.tsx` shrank by 90 lines because it originally held the logic for "conditionally render dashboard or landing depending on login state." Stripping that out and leaving pure landing content made the code dramatically lighter. The actual dashboard logic moved to `/app/dashboard/page.tsx` instead.

I also didn't forget redirects for users still hitting the old paths.

```
/matchda            → /
/matchda/dashboard   → /dashboard
```

A minimal courtesy so that users arriving via a bookmark or cached link don't hit a broken screen.

## Step 3. Splitting the dashboard from "Applications"

Once the URLs were cleaned up, it became clear that a single dashboard was doing too many jobs. Board/list toggle, stat cards, activity history, add-a-posting — all of it was crammed into one dashboard screen.

So in the `6d3b2df` commit, I created a new menu/page called **"Applications"** (`/applications`), moved the heavier features there, and simplified the dashboard down to a summary screen.

```
src/app/applications/page.tsx                      |  76 +++++++++++++
src/app/dashboard/page.tsx                         |   9 +-
src/components/matchda/dashboard/ApplicationsScreen.tsx | 73 +++++++++++++
src/components/matchda/dashboard/DashboardScreen.tsx     | 118 ++++++++++++++-------
```

The division of responsibility now looks like this.

| Screen | What it shows |
|---|---|
| Dashboard (`/dashboard`) | Stat cards (translated resumes, saved postings, active applications, average match rate) + recent postings summary |
| Applications (`/applications`) | Kanban board (preparing · applied · interview · offer) + list view + bulk matching |

While I was at it, I also fixed a long-standing bug — the list-view toggle button existed but did nothing when clicked. The cause was a conditional that disabled the list view entirely whenever a user was logged in but had zero saved postings. An empty list is still a perfectly valid state, and this was a textbook case of failing to distinguish "there's nothing" from "it doesn't work." A previous commit (`6d1c38f`) had partially addressed it, and this session I cleaned it up so the list view is always enabled once logged in.

## Step 4. The job-discovery flow — the part I got wrong

This is where I learned the most this session. My original design was this.

> When you register a career page in Discover (`/discover`) and it collects a posting, that posting immediately lands in Applications (`/applications`).

It sounded reasonable. But using it for real felt off. Since "browsing" and "things to actually manage" weren't distinguished, even postings I just wanted to glance at piled up in Applications. Feedback from the user (myself, but from a product standpoint, the end user) was blunt.

> "You should have to go into Discover, and only click a 'send to tracking' button to have it land in Applications."

The core issue is that **browsing and tracking need to be separated.** No matter how well you write a spec, this is the kind of problem that's hard to see until you actually click through the screen. The same is true working with an AI assistant — noticing that the original design was wrong ultimately comes down to a human using it.

So in commit `e4ee239` I rebuilt the flow.

```
feat: add a shared pool of all collected postings to Discover + a 'send to tracking' button → Applications

- Added a shared jobs-pool section to Discover (postings not yet in Applications), with search/sort support
- The 'send to tracking' button → creates a match via addJobToApplications → shows up in Applications, removed from the pool
- Existing career-page-collected postings (discovered_jobs) get their own 'My Career Page Postings' section
```

Diagrammed, the changed data flow looks like this.

```
[career page registration/collection]     [Discover screen]              [Applications]
      │                                        │                              │
      ▼                                        ▼                              │
 discovered_jobs / jobs pool  ──▶  browse with search/sort                    │
      │                                        │                              │
      │                          click "send to tracking"                     │
      │                                        └──▶ addJobToApplications ──▶ added to the matches table
      │                                                                       (removed from the pool)
```

Looking at just one server action makes the structure clear.

```ts
// src/app/discover/actions.ts
export async function addJobToApplications(jobId: string): Promise<{ error?: string }> {
  // ... after checking login/profile
  // links a posting from the jobs table into the matches table → now visible in Applications
}
```

Separating "viewing" from "managing" at the table level itself (shared `jobs`/`discovered_jobs` pool vs. per-user `matches`) meant that when I later added a recommended-company preset (covered in Part 4), it slotted naturally onto the same structure.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| Handling old URLs | Keep redirect routes, and bulk-replace every internal link to the new path |
| Large refactors | Split commits into "move" → "separate" → "add feature," in that order |
| Screen branching by login state | Don't branch the page itself — conditionally render just the header CTA within the same page |
| Browse vs. manage data | Split into a shared pool table + a per-user linking table (match) |

## Summary

Three key takeaways from this part.

1. **URLs get expensive to fix later.** If a temporary path like `/matchda` sticks around too long, you end up having to touch redirects, internal links, and even OAuth callbacks. It's much easier to set the principle early on — "root = landing, everything else gets a role-based path."
2. **When one screen is doing too many jobs, it's time to split it.** While the dashboard held stats + kanban + list + activity history all at once, users didn't know where to look. Splitting into summary (dashboard) and management (applications) made each screen's purpose clear.
3. **Don't trust the AI's first design at face value — actually use it.** Auto-enrolling discovered postings straight into applications sounded reasonable in theory, but a single piece of real-use feedback ("there needs to be a 'send to tracking' button") changed the entire flow. AI assistants are strong at translating requirements into code accurately, but whether "this requirement is even right" is still something a human has to judge by actually using it.

Next up: the most harrowing incident of this session — when the AI's test-cleanup script deleted a real user account, and the recovery that followed.
