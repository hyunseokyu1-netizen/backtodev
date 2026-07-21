---
title: 'Turning a Design Handoff Into a Real Product (3) — Wiring CTAs and Search Into the Real Login Funnel'
date: '2026-07-01'
publish_date: '2026-07-22'
description: Wiring the landing's demo-link CTAs and search into the real login/signup funnel with Server Actions and useRouter, and handling useSearchParams with Suspense
tags:
  - Next.js
  - Server Actions
  - React
  - App Router
---

By [Part 2](#), the screens had come alive with real data. But the public landing's "Log In," "Get Started Free" buttons and the hero search bar were still pointing at **design demo links** (mockup screens like `/matchda/dashboard`). If this is the real first screen, clicking a button should lead into the **real signup flow.**

Part 3 is short but practical — turning static links into **an actually functioning funnel.**

## First: our entire app sits behind an auth gate

An important premise to establish first. Every route in this app except `/` and `/login` sits behind login. In other words, **the act of "searching" is simply impossible for a logged-out visitor.** So the natural destination of a search isn't search results — it's the **login (signup) screen.** Once I accepted this, the design became simple.

| CTA | Destination |
|---|---|
| Log In | `/login` |
| Get Started Free | `/login?mode=signup` |
| Submit search / Enter | `/login?mode=signup&q=<input>` |

## Step 1. Splitting destinations out as props

The same landing component needed to behave differently on the demo (`/matchda`) versus public (`/`) routes. So I pulled the link destinations out **as props, with demo defaults.**

```tsx
export default function LandingHeader({
  loginHref = '/matchda/dashboard',   // demo default
  signupHref = loginHref,             // defaults to the same as login
}) { … }
```

Only the public landing overrides these with the real funnel.

```tsx
<MatchdaLanding loginHref="/login" signupHref="/login?mode=signup" searchHref="/login?mode=signup" />
```

A small JS destructuring tip — like `signupHref = loginHref`, **a default value can reference a parameter destructured earlier in the same list.** The demo points both at the same place; the public route specifies them separately.

## Step 2. Actually routing the search

The search bar's `handleSearch` had been an empty function all along. I wired up real navigation with `useRouter`.

```tsx
'use client'
const router = useRouter()
function handleSearch() {
  if (!submitHref) return                 // no-op for the demo
  const q = query.trim()
  const sep = submitHref.includes('?') ? '&' : '?'
  router.push(q ? `${submitHref}${sep}q=${encodeURIComponent(q)}` : submitHref)
}
```

The typed search term gets carried along as `q`. There's no consumer for it yet, but it's carried along so the intent isn't lost (a future search page can pick it up).

## Step 3. `/login?mode=signup` — auto-selecting the tab

Landing via "Get Started Free" should naturally open with the **signup tab** active first. The login form only kept tab state as internal `useState`, so I changed it to read from the URL parameter.

```tsx
const searchParams = useSearchParams()
const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
const [mode, setMode] = useState(initialMode)
```

## Step 4. useSearchParams needs Suspense

This is where I hit a snag. In App Router, a client component using `useSearchParams` **needs to be wrapped in a Suspense boundary** (otherwise it's a build warning/opt-out during static rendering). I wrapped the form in Suspense on the login page.

```tsx
// app/login/page.tsx
<Suspense fallback={null}>
  <LoginForm />
</Suspense>
```

Checking it, `useSearchParams` turned the page dynamic, and the form was correctly included in the SSR HTML (no blank-screen flicker).

## Troubleshooting

**Where does the search term get consumed?** Honestly, the app doesn't currently have a public free-text search endpoint. So I carried `q` along, but **deferred consuming it to a future task.** Rather than forcing a search-results page into existence, guiding toward the login funnel was the honest flow given the current structure.

**One component for both demo and public.** Thanks to prop defaults, the `/matchda` demo works exactly as before with zero changes, while only `/` uses the real funnel. Not baking the branching as an if-statement inside the component was good for maintainability.

## Summary

The gist of wiring up CTAs and search.

1. **If the app is gated, a search's destination is login** — accepting this fact simplifies the design
2. **Destinations as props**, demo defaults + public overrides
3. **Route search via useRouter**, carrying intent (`q`) along without losing it
4. **`?mode=signup` auto-selects the tab** — a small detail that shapes conversion
5. **Wrap useSearchParams in Suspense**

Now, when a visitor clicks a button, they land in the real signup flow. In the final part, I cover this series' highlight — **optimizing a resume against a job posting with Claude**, and how a test caught a bug along the way.
