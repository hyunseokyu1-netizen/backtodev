---
title: 'Building a SaaS With an AI Coding Assistant (8): Killing Dead Links — Making Every Click on the Landing Page Go Somewhere'
date: '2026-07-04'
publish_date: '2026-08-07'
description: The landing page looked convincing with demo showcases, but actually clicking through it revealed holes everywhere — wiring the hero search to job discovery, opening the pricing page to logged-out visitors, and adding a new about page so all 4 header nav items finally worked
tags:
  - Next.js
  - SaaS
  - Landing Page
  - Middleware
  - AI Coding Assistant
---

## Starting off

Once Part 7 added three demo showcases to the landing page, the first screen looked pretty convincing — scroll down and you'd see the resume translation screen, the job discovery screen, and the applications kanban, one after another. But when the product owner (me) actually **clicked through** the landing page, holes turned up everywhere.

- The search bar right in the middle of the hero — type a query and submit, and it **ignores the query** and navigates to the dashboard
- 2 of the 4 header nav items ("About" and "Pricing") weren't links at all — **dead `<span>`s** that did nothing on click
- The "Resume Translation" nav item pointed to `/workspace` — an **empty workspace template** built early in the rebrand

The feedback came in the user's own plain words.

> "Make it so searching here goes to job discovery and actually searches."
> "Build out content for the pricing and about pages."

Showing (the showcase) and working (the wiring) turned out to be entirely separate jobs. This part covers the two commits (`83c1454`, `a33746d`) that brought every dead link on the landing page back to life.

## Step 1. Wiring the hero search to job discovery

The fun part is that the search bar itself was already ready. The `SearchBar` component built during the rebrand had been designed with a `submitHref?q=query` pattern from the start, and its comment already said this.

```tsx
// SearchBar.tsx
/**
 * submitHref: where to navigate on submit. If not specified, no-op (for design demo purposes).
 *   The entered query is passed along as a q query param (to be consumed later
 *   by the search page — TODO(api)).
 */
const sep = submitHref.includes('?') ? '&' : '?'
router.push(q ? `${submitHref}${sep}q=${encodeURIComponent(q)}` : submitHref)
```

This is essentially cashing in a `TODO(api)` left weeks ago. On the sending side, all that's needed is changing the destination — a one-line fix.

```tsx
// src/app/page.tsx
-      searchHref={authed ? '/dashboard' : '/login?mode=signup'}
+      searchHref={authed ? '/discover' : '/login?mode=signup'}
```

`/discover`, the receiving side, is a server component. In Next.js 15 style, `searchParams` arrives as a Promise, so it needs an `await` to unwrap.

```tsx
// src/app/discover/page.tsx
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  // the initial query passed over from the landing hero's search bar
  const { q } = await searchParams
  const initialSearch = (q ?? '').trim()
  // ...
  <DiscoveredJobList jobs={jobs} initialSearch={initialSearch} />
  <PoolJobList jobs={poolJobs} initialSearch={initialSearch} />
```

`/discover` has two job lists (my career-page-collected postings + the shared job pool). Both are client components that already had their own search state, so all that's needed is accepting an `initialSearch` prop and using it as the `useState` initial value.

```tsx
// PoolJobList.tsx / DiscoveredJobList.tsx follow the same pattern
export default function PoolJobList({
  jobs,
  initialSearch = '',
}: {
  jobs: PoolJobItem[]
  initialSearch?: string
}) {
  const [search, setSearch] = useState(initialSearch)
```

This is the lightest possible way to use the URL as a source of state. I could have brought in a URL-state-sync library like `nuqs`, but all that was actually needed here was "inject an initial value once, on arrival from the landing page." Since the URL never needs to update afterward when the user changes the search term, `useState(initialSearch)` is enough. If two-way sync is ever needed, that's the day to bring one in.

Now, typing "backend engineer" on the landing page and hitting enter navigates to `/discover?q=backend%20engineer`, and both lists open already filtered to that query.

## Step 2. Opening up the pricing page

The second hole was pricing. The existing `/pricing`'s first line was this.

```tsx
const email = await getAuthUserEmail()
if (!email) redirect('/login')
```

The paradox of **needing to sign up before you can even see the price.** When the billing feature (Part 5) was built, it was designed as a "manage subscription" page, so it naturally sat behind login — but the moment "Pricing" got exposed in the header nav, this page picked up a second role: a marketing page telling pre-signup visitors what things cost.

The core of the refactor is **separating the body content from the chrome.** I extracted the two pricing cards and the payment-result banner into `PlanCards`/`PricingBody` components, and wrapped the same body in different chrome depending on login state.

```tsx
export default async function PricingPage({ searchParams }: { ... }) {
  const email = await getAuthUserEmail()
  const { success, canceled } = await searchParams

  // logged out — public pricing (landing chrome)
  if (!email) {
    const t = getMatchdaDict('ko')
    return (
      <div className="min-h-screen bg-white ...">
        <LandingHeader t={t} />
        <main className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8">
          <PricingBody isPremium={false} authed={false} />
        </main>
        <SiteFooter t={t} />
      </div>
    )
  }

  // logged in — app chrome (sidebar)
  const profile = await getOrCreateProfile(email)
  const isPremium = planOf(profile) === 'premium'
  return (
    <AppShell activeKey="profile" userName={...} userEmail={email}>
      <PricingBody isPremium={isPremium} authed success={success} canceled={canceled} />
    </AppShell>
  )
}
```

A logged-out visitor, having come from the landing page, sees pricing wrapped in the landing header/footer; a logged-in user sees the same content inside the app, with its sidebar. One body, two shells — if pricing or the feature list ever changes, only one place needs editing.

The CTA button also branches three ways by state. Showing a logged-out visitor an `UpgradeButton` (which calls Stripe checkout) would throw an auth error the instant it's clicked, so I swapped it for a signup-funnel `Link` instead.

```tsx
{!authed ? (
  <Link href="/login?mode=signup" className="...">Start Premium</Link>
) : isPremium ? (
  <UpgradeButton mode="manage" label="Manage Subscription" />
) : (
  <UpgradeButton mode="upgrade" label="Start Premium" />
)}
```

The button copy stays the same ("Start Premium"), but the destination differs. A logged-out visitor signs up first; an existing user goes straight to checkout.

## Step 3. Adding a new About (/about) page

The third case was a page that simply didn't exist. "About" in the header had been left as a `<span>` because there was no page to link to yet. I built `/about` from scratch.

The structure follows the standard 4 sections.

1. **Intro** — "The biggest wall to working abroad is the English resume — AI solves it"
2. **4-step usage flow** — upload your resume → translate and polish into English → collect postings and get AI matches → apply with a tailored resume
3. **6 key-feature cards** — translation, posting collection & scoring, tailored optimization, cover letters, kanban tracking, PDF/DOCX download
4. **A green CTA band** — "Start for free right now" + a pricing link

Following the same principle as the kanban mockup from Part 7, content is split into constant arrays and JSX is just a map.

```tsx
const STEPS = [
  {
    n: '1',
    title: 'Upload your resume',
    desc: 'Upload a Korean resume file (PDF/DOCX) and AI automatically analyzes it and fills in your basic info. ...',
  },
  // ... 4 steps
]

{STEPS.map(s => (
  <div key={s.n} className="rounded-[14px] border border-[#ECEEF0] bg-white p-6">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF3] text-[15px] font-bold text-[#046C4E]">
      {s.n}
    </div>
    <div className="mt-3 text-[16px] font-bold text-[#1F2A37]">{s.title}</div>
    <p className="mt-1.5 text-[14px] leading-[1.6] text-[#667085]">{s.desc}</p>
  </div>
))}
```

An about page is one where the copy changes often. Building it so that only the `STEPS`/`FEATURES` arrays need editing keeps "wording changes" separate from "layout code changes." The CTA branches by login state here too — `authed ? '/dashboard' : '/login?mode=signup'`.

## Step 4. Finishing the wiring — middleware, chrome, nav

Building the page isn't the finish line. This app's middleware works as a **public-path whitelist,** so any path not registered redirects a logged-out visitor to login. I added `/about` and `/pricing`.

```ts
// src/middleware.ts
-  // root (/) is the public intro page (landing regardless of login state)
-  if (pathname === '/') {
+  // root (/) plus the about and pricing pages are public (regardless of login state)
+  if (pathname === '/' || pathname === '/about' || pathname === '/pricing') {
     return supabaseResponse
   }
```

One more thing — I added `/about` to the list of MatchDa-shell paths so `AppChrome` (the old layout's global header) doesn't get layered on top. Miss this, and the old header stacks on top of the landing header, producing a double header — `/pricing` was already on the list so it skated by, but this is a checkpoint that trips you up every time you add a new page.

```tsx
// src/components/AppChrome.tsx
    pathname?.startsWith('/pricing') ||
+   pathname?.startsWith('/about') ||
```

Finally, the header nav. I converted the 2 dead `<span>`s into `Link`s, and cleaned up the 2 that pointed to the wrong destination — all 4 finally wired up correctly.

| Nav item | Before | After |
|---|---|---|
| About | `<span>` (dead link) | `/about` (newly built) |
| Job Listings | `/dashboard` | `/discover` (job discovery) |
| Resume Translation | `/workspace` (empty template) | `/profile` (the actual resume editor) |
| Pricing | `<span>` (dead link) | `/pricing` (now public) |

The destination change for "Resume Translation" mattered especially. `/workspace` was a static template built while implementing the rebranding handoff, so it only shows demo data. The place where the actual translation feature lives is `/profile` (the resume editor), so the nav needs to point wherever the feature actually is.

Verification went two ways. I took Playwright screenshots of the landing page, /about, and /pricing to eyeball whether there was a double header and check the layout, and used `curl` simulating a logged-out state to confirm `/about` and `/pricing` return **200** instead of a 302. A missing entry in the middleware whitelist is exactly the kind of bug you'll never catch from a browser that already has a logged-in session cookie.

## Common patterns, summarized

| Situation | Pattern |
|---|---|
| A URL query → a client-side list's initial state | Server does `await searchParams` → pass as a prop → `useState(initialSearch)` |
| A URL-state library (nuqs, etc.) | Unnecessary if you only need one-way initial injection — bring one in once two-way sync is actually needed |
| Same body, different shell | Extract the body component, then wrap it in landing chrome (logged out) vs. AppShell (logged in) |
| A payment button shown to a logged-out visitor | Swap the Stripe button for a signup-funnel `Link` |
| About page content | `STEPS`/`FEATURES` constant arrays + map — separates copy edits from layout edits |
| Adding a new public page | The 3-piece set: ① middleware whitelist ② AppChrome path list ③ nav link |
| Wiring to finish later | A `TODO(api)` comment + designing just the interface (`submitHref?q=`) ahead of time |
| Verifying a public page | Confirm 200 via a logged-out `curl` — a logged-in browser can't catch this |

## Summary

1. **Showing and working are separate jobs.** The showcases from Part 7 made the landing page look convincing, but its clicks were still dead. And holes like this only ever surface from **feedback by someone who actually clicked through** — not from a diff review. "Make it so searching here goes to job discovery and searches" is a user's sentence, not a code reviewer's.
2. **A TODO comment is a design document addressed to your future self.** Thanks to SearchBar's `submitHref?q=` pattern and its "to be consumed later by the search page — TODO(api)" comment, connecting search up weeks later became "cashing in," not "designing from scratch." One line on the sending side, plus a prop injection on the receiving side, and it's done.
3. **A page's role is defined by its entry point.** `/pricing` was originally a subscription-management page, but the moment it got exposed in the landing header, it picked up a marketing-page role too. Requiring login just to see the price was a symptom of that role conflict, and separating body from chrome let both roles coexist.
4. **A whitelist middleware charges a toll on every new page.** Explicitly declaring public paths is safe, but it means every new page has to be wired into three places at once — middleware, AppChrome, and nav. Turning this into a fixed checklist means the next public page ships without a mistake.

Now, no click on matchda.com's landing page goes into the void. Search leads to search results, pricing leads to a price table, about leads to an about page. A landing page with no dead links — it sounds like it should go without saying, but it didn't, until someone actually clicked through it.
