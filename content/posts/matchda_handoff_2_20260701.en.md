---
title: 'Turning a Design Handoff Into a Real Product (2) — Mock Data to Real Data, and Promoting the Public Landing'
date: '2026-07-01'
publish_date: '2026-07-21'
description: Wiring the MatchDa screens that ran on mock data to real Supabase data, promoting the design demo landing into the real first screen, and adding mobile responsiveness
tags:
  - Next.js
  - Supabase
  - Server Components
  - Tailwind CSS
---

In [Part 1](#), I reproduced the handoff in code. But those screens were all **hardcoded mockups.** The job cards on the dashboard's kanban, the resume in the workspace, the summary stats — all fake. Pretty, but not "my data."

Part 2 is about **flowing real data into this shell**, and **promoting the design demo into the actual service's first screen.** There was exactly one core principle — **real data if logged in, fall back to a mock demo otherwise.** Satisfying both a design showcase (for logged-out visitors) and the real app (for logged-in users) with one component.

## Step 1. Promoting the public landing — the design becomes the "real first screen"

The existing `/` showed an old intro page for logged-out visitors. I swapped this for the new MatchDa landing. First, extracted the landing into a **reusable component**:

```tsx
// reused across both the demo (/matchda) and the public (/) route
export default function MatchdaLanding({ loginHref, signupHref, searchHref }) { … }
```

Then, on the `/` page, render it when logged out.

```tsx
if (!email) return <MatchdaLanding loginHref="/login" signupHref="/login?mode=signup" />
```

The problem was the `AppChrome` built in Part 1. `/matchda` hides the global header, but `/` **needs the global header for logged-in users.** So I added one more condition.

```tsx
// / when logged out is the public landing → hide global chrome, go full-bleed
const isPublicLanding = pathname === '/' && !userEmail
if (isMatchda || isPublicLanding) return <>{children}</>
```

Branching by path + auth state, **the same `/` route now has an entirely different shell** depending on login status.

## Step 2. Dashboard — kanban and stats via Supabase

The most interesting mapping was here. The design's kanban has 4 columns (Preparing / Applied / Interviewing / Offer), but the actual `matches.status` uses 8 values. So I built **a mapping that folds status values into columns.**

| Actual `matches.status` | Kanban column |
|---|---|
| new / interested / considering | Preparing |
| applied | Applied |
| interview | Interviewing |
| accepted | Offer |
| rejected / pass | (excluded from the board) |

With no company logos, initial chips were used, but colors changing every time is jarring. **I fixed the color by hashing the company name.**

```ts
function brandFor(company: string) {
  let h = 0
  for (const c of company) h = (h * 31 + c.charCodeAt(0)) | 0
  return { initial: (company[0] ?? '?').toUpperCase(),
           color: CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length] }
}
```

Summary stats also became measured values. But I **boldly dropped the design's fictional deltas**, like "+1 this week" or "top 15%." Rather than convincingly inventing data that doesn't exist, it's more honest to show only values that can actually be counted.

```ts
// null if logged out → the caller falls back to mock data
export async function getMatchdaDashboard() {
  const email = await getAuthUserEmail()
  if (!email) return null
  // query matches + jobs → fill column buckets → measured stats
}
```

```tsx
// page: real data first, mock demo as fallback
const real = await getMatchdaDashboard()
const columns = real?.columns ?? getKanbanColumns()
```

## Step 3. Workspace — structured resume, two columns

The workspace shows the Korean original ↔ English version side by side. Conveniently, the profile already stored a **structured Korean/English resume** (`onboarding_ko` / `onboarding_en`) as JSONB. Given the `{ summary, experience[], education[], skills[] }` structure, it mapped almost directly onto the design's two columns.

```ts
function buildDoc(resume, name, contact, fallbackTitle) {
  return {
    name, contact,
    title: resume.experience?.[0]?.position || fallbackTitle,
    experiences: (resume.experience ?? []).map(e => ({
      org: [e.company, e.position].filter(Boolean).join(' — '),
      period: e.period ?? '',
      bullets: (e.description ?? '').split('\n').filter(Boolean).map(text => ({ text })),
    })),
    skills: resume.skills ?? [],
    // …
  }
}
```

With `?jobId=`, it measures the target posting and match rate, falling back to mock data if the English resume is empty. I also wired the dashboard cards to `/matchda/workspace?jobId=<id>`, completing the **dashboard → workspace flow.**

## Step 4. Mobile responsiveness — repainting mobile-first

The handoff was designed for desktop-wide (≥1200px). For mobile, I **pushed the desktop layout behind `lg:` and made the small screen the default.**

```tsx
// 2 columns → 1 column, large fonts stepped down gradually
<section className="grid grid-cols-1 lg:grid-cols-[1.04fr_0.96fr] …">
<h1 className="text-[34px] sm:text-[44px] lg:text-[53px] …">
```

Main rules:

- The landing header's nav is hidden on mobile via `hidden lg:flex`
- The search bar hides the country select on narrow screens to make room for the input
- The dashboard's **sidebar is hidden on mobile** (`lg:flex`), replaced by exposing the logo on the topbar instead
- Kanban's 4 columns → `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`

## Troubleshooting

**Keeping migration timing safe.** The workspace needed to read a column that would be added later, and `select('score, optimization')` throws an error if the column doesn't exist yet. Using `select('*')` instead **only returns whatever columns exist**, with missing fields coming back as `undefined` — no error. Safe both before and after the migration is applied. (More on this "column to be added later" in Part 4.)

**The temptation of fictional data.** Trying to fake a label like "top 15%" with real data ends up meaning you invent it. If it can be counted, show it — otherwise, it's better to drop the label entirely.

## Summary

The core of the mock-to-real-data transition.

1. **Login/logout fallback** — returning `null` lets one component double as both demo and real data
2. **Design ↔ real model mapping** — an explicit conversion table, like folding 8 statuses into 4 columns
3. **Reuse existing data** — the profile's structured resume happened to fit the two columns perfectly
4. **Drop fictional numbers** — an honest blank beats a convincing lie
5. **Mobile-first responsiveness**, pushing desktop behind `lg:`

The screens now come alive with real data. But the landing's buttons and search are still **demo links.** In the next part, these get wired into the actual login/signup funnel.
