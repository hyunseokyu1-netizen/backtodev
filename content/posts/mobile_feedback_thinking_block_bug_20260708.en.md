---
title: '3 KakaoTalk Screenshots Uncovered a Hidden Bug Spread Across the Entire Service'
date: '2026-07-08'
publish_date: '2026-08-29'
description: Following up on a small UI bug report from a real-device mobile screenshot led to discovering — and fixing — a root-cause bug where Claude thinking-response handling was done wrong in 20 different places
tags:
  - Claude API
  - Mobile UX
  - Next.js
  - Bug Tracing
  - Prompt Engineering
---

## It started with 3 KakaoTalk screenshots

I got a report over KakaoTalk, with screenshots, about problems encountered using the service on an actual phone (Samsung Browser). The request broke down into four things.

1. The support chatbot button overlaps the "Check Resume" button
2. There's no hamburger menu on mobile to navigate between pages
3. Since most users first arrive via mobile, the first screen should show the overseas job-discovery screen right away
4. After writing a resume, clicking "Rewrite with AI" shows the error **"Couldn't parse the AI response. Please try again."**

The first three are obviously UI layout/routing problems at a glance. The fourth was the interesting one — reproducing it showed it was **a bug that failed 100% of the time, regardless of input** — and digging into it led to a landmine buried across the entire service.

## Problem 1 — the chatbot button overlaps another button

The support chatbot is a floating button fixed to the bottom-right of the screen. It's fine on desktop where there's room to spare, but at mobile screen widths, it was fighting for space with other bottom elements, like the workspace's "Submitted Documents" button.

Summarized, the requirement was — **keep it visible on every page on desktop, but only show it on the support (/support) page on mobile.** I read the current path with Next.js's `usePathname` and applied a conditional class.

```tsx
const pathname = usePathname()
// overlaps on mobile, so only show it on /support; always show on desktop (sm and up)
const mobileVisible = pathname?.startsWith('/support')
const visibility = mobileVisible ? 'flex' : 'hidden sm:flex'

<button className={`fixed bottom-5 right-5 ${visibility} ...`}>
```

`hidden sm:flex` is the key part. Hidden by default, and shown again (`sm:flex`) once the screen is at least the `sm` breakpoint. Forcing `flex` on only when the path is `/support` makes it visible on mobile too.

## Problem 2 — no way to navigate pages on mobile

Looking at the existing structure, desktop navigates between pages via the left sidebar, but on mobile that sidebar was entirely hidden (`lg:hidden`), leaving only the logo. In other words, **a mobile user, once logged in, had no way to reach any other page besides clicking the logo to return to the dashboard.**

I built a new component (`MobileNav`) and added a hamburger button to the mobile header. Clicking it opens a dropdown linking to Dashboard, Applications, Discover, My Resume, Settings, Pricing, and Support.

```tsx
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'applications', label: 'Applications', href: '/applications' },
  { key: 'discover', label: 'Discover', href: '/discover' },
  // ...
] as const

{open && (
  <>
    <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setOpen(false)} />
    <nav className="fixed left-0 right-0 top-[60px] z-50 ...">
      {NAV_ITEMS.map(({ key, label, href }) => (
        <Link key={key} href={href} onClick={() => setOpen(false)} ...>{label}</Link>
      ))}
    </nav>
  </>
)}
```

I laid down a backdrop (`bg-black/25`) that closes the menu when clicked. If a menu opens on mobile with no clear way to close it, that itself becomes yet another annoyance.

## Problem 3 — the first screen was an empty dashboard

Previously, logging in landed on an empty dashboard that was nothing but a handful of stat cards. For a new user, this is a screen that fails to answer "so what am I supposed to do now?" As requested, **I changed the destination right after login/onboarding completion to the job discovery (`/discover`) page** — where overseas company job postings and match scores show up immediately.

The place deciding this destination wasn't just one spot. Searching with grep, four locations all needed to change consistently.

| Location | Role |
|---|---|
| `middleware.ts` | Redirects an already-logged-in user who visits `/login` |
| `auth/callback/route.ts` | The default destination after OAuth (Google login) completes |
| `login/LoginForm.tsx` | Navigation after a successful email login form submission |
| `onboarding/page.tsx`, `OnboardingChat.tsx` | Navigation after onboarding completes |

With two login paths (email, Google) and a new-user/existing-user branch on top of that, the code deciding "where to send someone after a successful login" had naturally scattered across multiple places. Missing even one creates an inconsistent experience — "logging in via Google goes to the dashboard, but logging in via email goes to Discover."

## Problem 4 — "Couldn't parse the AI response" (the real problem)

Reproducing it showed that not just a fresh-graduate's resume (no experience, only 3 skills), but **this button failed every single time it was clicked, regardless of input.** I reproduced the actual API call directly and dissected the response.

```js
const msg = await client.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 4000,
  messages: [{ role: 'user', content: prompt }],
})
console.log(msg.content.map(b => b.type))
// → [ 'thinking', 'text' ]
```

I found the cause. The model this service uses has **adaptive thinking** turned on, which runs an internal reasoning process before answering — and in that case, **the first block in the response's `content` array is `thinking`, not `text`.** But the code was written like this.

```ts
// The problematic code — only checks index 0 of the array
const summary = message.content[0].type === 'text'
  ? message.content[0].text.trim()
  : ''
```

Since `content[0]` is the `thinking` block, `.type === 'text'` is always `false`, and the result was **always an empty string.** This is exactly why clicking "Rewrite with AI" failed identically no matter what the input was changed to.

What worried me more was that this pattern wasn't unique to this one feature. Digging with `grep`, I found **the exact same pattern used in 20 places** — cover letter generation, resume translation, AI match scoring, onboarding parsing, even scraped-job-posting scoring. Even the spots that weren't currently throwing an error were a latent landmine that would start silently returning an empty string the moment `thinking` got enabled on that particular API call later.

### The fix — swapping it all out with one shared helper

I built one helper function that finds the block with type `text` in the `content` array.

```ts
// src/lib/claude.ts
export function textOf(message: { content: { type: string; text?: string }[] }): string {
  const block = message.content.find(b => b.type === 'text')
  return typeof block?.text === 'string' ? block.text.trim() : ''
}
```

The key is not trusting the array index and instead finding the type directly via `.find()`. No matter how many `thinking` blocks come first, it accurately finds the block with type `text`. I replaced the dangerous pattern in all 20 places with this one function.

```ts
// Before
const text = message.content[0].type === 'text' ? message.content[0].text : ''
// After
const text = textOf(message)
```

Deploying this should be the end of it, but to be sure, I re-ran the exact failing case I'd reproduced and confirmed it now succeeded.

## Also improving the prompt for early-career job seekers

While fixing the bug, I also folded in the original requirement. I added a rule so that when a fresh graduate with almost no experience clicks "Rewrite with AI," it produces a professional, confident summary using only the material available (skills, personal projects).

```
5. **A new grad/early-career person with no experience, or only 1-2 lines**: Use skills,
   education, and the existing summary (including personal projects) as material to write
   a confident, rich summary (3-4 sentences). Express their technical understanding,
   hands-on building experience, learning speed, and drive to grow using professional
   vocabulary — but never fabricate fake experience, numbers, or company names.
```

In practice, a one-line input like this

> Built an iPhone app by myself, has over 10000 downloads.

turned into this.

> A developer with hands-on experience independently planning, developing, and shipping an iOS app that achieved over 10,000 downloads. Combines native iOS development skill using Swift with a solid understanding of frontend development via React... has built strong problem-solving ability and self-directed learning capability.

Without inventing a single new number or company name, it expanded the facts already in the original (iOS app development, 10,000 downloads, React/Swift skills) into far more professional vocabulary. The word "embellish" can sound like it's condoning lying, but what was actually needed **wasn't lying — it was expressing the same facts better.**

## Verifying it for real with a mobile viewport

Rather than just eyeballing the fix, I ran the whole thing again from login onward in a headless browser given a mobile viewport.

```js
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})
```

I verified: login → arriving at `/discover`; the chatbot button hidden on `/discover` and visible on `/support`; and opening the hamburger menu and clicking "My Resume" actually navigates to `/profile` — all recorded with screenshots along the way.

## Common patterns, summarized

| Purpose | Approach |
|---|---|
| Hiding an element only on mobile | Tailwind's `hidden sm:flex` combination |
| Branching UI by current path | Next.js's `usePathname()` |
| Safely extracting just the text from an AI response | `content.find(b => b.type === 'text')` instead of `content[0]` |
| Checking logic scattered across multiple places, like post-login navigation | Full-survey the relevant redirect/navigation spots via `grep` |
| Verifying mobile UI regressions | A headless browser with an `isMobile: true` viewport |

## Troubleshooting

**Q. Why hadn't code like `content[0].type === 'text'` been a problem until now?**
A. Features using a model with `thinking` turned off happened to work fine, because `content[0]` genuinely was the `text` block. The problem is that switching to a smarter model later, or turning on `thinking`, breaks it silently with no warning at all — since it doesn't throw an error, it **returns an empty string** instead, which makes the root cause far harder to pin down.

**Q. How do you prevent something like this in advance?**
A. It helps to build one shared utility for handling API responses from the start, and make a habit of catching direct array-index access in code review. The habit of "copy-pasting existing code every time a new feature is built" was also exactly what kept spreading this same bug.

## Summary

```
3 KakaoTalk screenshots → 2 UI bugs (chatbot overlap, missing menu) fixed right away
  → 4 first-screen-redirect locations changed consistently
  → reproduced "Rewrite with AI" → found content[0] index access hitting a thinking block
  → full-surveyed the same pattern in 20 spots via grep → unified them all with a textOf() helper
  → added an early-career-specific rule to the prompt → fully re-verified with a mobile viewport
```

One small screenshot looked like a "please move the chatbot button a bit" level of request, but following it through led to a root-cause bug spread across 20 places in the service's AI features. **The attitude of following a user's minor inconvenience report all the way through to "does this actually reproduce"** turned out, once again, to be the path to finding a much bigger problem that had been invisible until then.
