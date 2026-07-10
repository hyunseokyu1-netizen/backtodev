---
title: 'Turning a Design Demo Into the Real App (2) — Reusing Modals and Swapping the Route'
date: '2026-07-02'
publish_date: '2026-07-26'
description: Porting per-job features by reusing existing modals via a slot pattern, and swapping the logged-in home into the MatchDa dashboard through conditional chrome (AppChrome) and component extraction
tags:
  - Next.js
  - App Router
  - React
  - Server Actions
---

In [Part 1](#), I ported the interactive kanban and board entry points. Now two of the biggest chunks remain.

- **Per-job features** — cover letter, tailored resume, JD, notes, delete, etc. tied to a single posting
- **Route swap** — actually replacing the logged-in `/` with the MatchDa dashboard

Part 2 is the practical work of "how do you move something that already exists without breaking it."

## Step 1. Keep the modals as-is, only build where they open

Opening up the old app's per-job modals (cover letter, tailored resume, paste-JD, submitted resume), the **props were remarkably consistent.**

```ts
// all four modals effectively share the same signature
{ jobId, jobTitle, company, onClose }
```

On top of that, each modal **loads its own data** (`getCoverLetter(jobId)`, etc.). So there was exactly one thing left for me to do — **build only the buttons that open these modals** from the workspace.

I built a client component called `WorkspaceActions` to hold the buttons + modals.

```tsx
'use client'
import CoverLetterModal from '@/components/CoverLetterModal'   // the old modal, unchanged
import TailoredResumeModal from '@/components/TailoredResumeModal'

export default function WorkspaceActions({ jobId, jobTitle, company, ... }) {
  const [modal, setModal] = useState<ModalKind>(null)
  return (
    <>
      <button onClick={() => setModal('cover')}>Cover Letter</button>
      <button onClick={() => setModal('tailored')}>Tailored Resume</button>
      {/* ⋯ overflow menu: paste JD · submitted resume · notes · edit info · re-match · delete */}

      {modal === 'cover' && <CoverLetterModal jobId={jobId} jobTitle={jobTitle} company={company} onClose={() => setModal(null)} />}
      {/* ... */}
    </>
  )
}
```

### Crossing the server/client boundary with a slot pattern

The workspace top bar (`WorkspaceTopbar`) is a **server component.** How do you slot a client action button into it? A React basic — **leave a `ReactNode` slot** open.

```tsx
// server component: just leave the slot open
export default function WorkspaceTopbar({ t, data, actions }: { ...; actions?: React.ReactNode }) {
  return <header>{/* ... */}{actions}{/* ... */}</header>
}
```

```tsx
// injecting a client component into the slot from the page (server)
<WorkspaceTopbar
  data={data}
  actions={real && jobId ? <WorkspaceActions jobId={jobId} ... /> : undefined}
/>
```

A server component **rendering a client component as a child** is entirely normal. Thanks to the slot, I layered interaction onto the top bar without ever turning it into a client component.

### Only building what didn't exist — notes/info editing

In the old app, editing notes and title/company/location was **inline**, not a modal. This didn't fit the workspace's context, so I built two small new modals (`MemoModal`, `JobInfoModal`). Saving, of course, reused existing actions.

```tsx
// JobInfoModal: only save what actually changed
if (title.trim() !== initialTitle) await updateJobTitle(jobId, title.trim())
if (company.trim() !== initialCompany) await updateJobCompany(jobId, company.trim())
// ...
```

Supplementary per-job data (JD, notes, submitted resume, application date) all got bundled into the workspace's fetch function to be returned in one go.

## Step 2. Route swap — finally replacing the actual home

Now to swap the logged-in `/` into the MatchDa dashboard. Three things were needed.

### ① Extracting the dashboard into a reusable component

Since `/matchda/dashboard` and the logged-in `/` need to use **the same screen**, I pulled the page's JSX out into a `DashboardScreen` component.

```tsx
// shared by both routes
export default function DashboardScreen({ t, summary, columns, real, unmatchedCount, userEmail }) {
  return <div className="flex ..."><Sidebar .../><main>{/* stats + kanban */}</main></div>
}
```

```tsx
// app/page.tsx
if (!email) return <MatchdaLanding ... />          // logged out → landing
return <DashboardScreen real={!!real} ... />        // logged in → dashboard
```

### ② AppChrome — conditionally hiding the global chrome

The problem was the root layout's **global header.** The MatchDa screens have their own sidebar/header, so the global header would overlap. The root layout is a server component and can't use `usePathname`. So I **extracted the chrome into a client component** and branched by path.

```tsx
'use client'
const pathname = usePathname()
const usesMatchdaShell =
  pathname === '/' || pathname?.startsWith('/matchda') /* ... */
if (usesMatchdaShell) return <>{children}</>   // full-bleed, hide the global header
return <><header>…old global header…</header><main>{children}</main></>
```

There's a subtle spot here. `/` shows **a different screen depending on login state** (landing vs. dashboard), but **both have their own chrome.** So checking `pathname === '/'` alone, regardless of auth state, correctly hides the global chrome. It fell into place cleanly.

### ③ Turning the sidebar into real navigation

The MatchDa sidebar had been placeholder links all along. I wired it to real routes, and attached user info + logout. Since logout is a server action, it can be **rendered as a form directly inside a server component.**

```tsx
import { signOut } from '@/app/auth-actions'
{userEmail && (
  <form action={signOut}>
    <button type="submit">Log Out</button>
  </form>
)}
```

## Troubleshooting

**A consistency gate.** I made per-job action buttons appear **only when the workspace is rendered with real data.** Because the `jobTitle/company` the button passes to a modal is fake (Spotify) when it's the mock fallback, which would mismatch the real `jobId`, mixing up filenames and the like. Making sure "the data shown and the data acted on match" is fundamental to user trust.

**Verified as much as possible with no session.** I couldn't view the real logged-in screen locally without a session, but I filtered out as many regressions as possible with `tsc`/`eslint` + rendering the logged-out mock + confirming the auth gate (307 redirect).

## Summary

The core of the porting work.

1. **For a modal with consistent props, only build "where it opens"** — leave the body untouched
2. **Inject client interaction into a server component via a slot (ReactNode)**
3. **Build only the UX that didn't exist, but reuse existing actions for saving**
4. **Extracting the screen** lets two routes share one component
5. **Conditionally render global chrome via client + usePathname**

Now, logging in shows the real MatchDa dashboard. But `/discover` and `/profile` are still in the old header with zinc tones. In the final part, I wrap it up with **unifying the app shell and bulk-mapping the color tone.**
