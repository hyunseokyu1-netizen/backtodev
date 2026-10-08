---
title: "A UI That Doesn't Work Is Worse Than None at All — A Day Spent Cleaning Up MVP UI"
date: '2026-07-17'
publish_date: '2026-12-06'
description: "Removing a fake search bar, showing login state in the landing header, and adding a company chip filter — what I learned spending a day cleaning up my side project's MVP UI"
tags:
  - Next.js
  - React
  - MVP
  - UX
  - TypeScript
---

When you're building a side project, "placeholder for now" UI tends to pile up — things like a div shaped like a search bar, a header that still shows nothing but a login button even when you're already logged in, or onboarding placeholders full of developer-only examples.

I'm building a job-matching service for working abroad with Next.js, and today, instead of shipping a new feature, I spent the day cleaning up this kind of "uneasy UI." It ended up as a single small commit (12 files, +127/−56), but there were a few points worth thinking about when building an MVP, so I'm writing them down.

## Why This Work Was Necessary

There were four things to clean up.

| Problem | Symptom |
|---|---|
| Fake search bar | There's a search bar at the top of the dashboard, but clicking it does nothing |
| Header ignores login state | Even logged-in users only see "Log in / Start for free" buttons on the landing page |
| Job browsing flow | No way to group the full job list by company |
| Tech-industry bias | The service now targets "working abroad in general," but every example is a developer role |

Let's go through how I solved each one.

## Step 1: Removing the Fake Search Bar — The Trap of Decorative UI

The Topbar at the top of the dashboard had a search bar that looked legit. But open up the code, and here's what you find.

```tsx
{/* TODO(api): 공고/회사/국가 검색 연동 */}
<div className="hidden w-[200px] items-center gap-[9px] rounded-[10px] border ... md:flex lg:w-[340px]">
  <Search size={17} strokeWidth={1.8} className="text-[#98A2B3]" />
  <span className="truncate text-[14px] text-[#98A2B3]">{t.dashboard.topbarSearch}</span>
</div>
```

It wasn't even an `input`. It was a **decorative div** with a `TODO` comment attached — a leftover from copying a design mockup with a "I'll wire this up later" note.

The problem is what it does to the user. When something that looks like a search bar does nothing on click, the user doesn't think "oh, that feature isn't built yet" — they think "**is something broken with this service?**" A UI that doesn't work sets up an expectation and then betrays it, which erodes trust more than simply not having the feature at all.

So instead of rushing out a real search feature, I removed the search bar entirely.

```tsx
// Before: 가짜 검색바 div
// After:
<div className="flex-1" />
```

Just a layout spacer, and that's it. I also cleaned up the now-unused i18n key (`topbarSearch`). Search will get built for real once it's actually needed.

> **Lesson**: In an MVP, don't draw the "slot for a feature I'll add later" into the UI ahead of time. When the feature actually exists, the UI can show up alongside it.

## Step 2: Showing Login State in the Landing Header

The more interesting one was the header. The `LandingHeader` component received an `authed` prop and **deliberately ignored it.**

```tsx
/** @deprecated 랜딩 헤더는 항상 방문자 관점(로그인·가입 버튼)으로 표시한다 */
authed?: boolean
```

The original intent was "the landing page always shows the visitor's point of view, and if a logged-in user clicks a button, the middleware will route them to the app anyway." That keeps the implementation simple, but it has a side effect: a logged-in user who lands back on the page has no way to tell they're logged in. Do they need to click "Log in" again? That's exactly the kind of confusion it creates.

This time I flipped the design around, adding `userName`/`userEmail` props so that logged-in users see an avatar, their name, and a dashboard button.

```tsx
{userEmail ? (
  <div className="flex items-center gap-[10px]">
    <Link href="/dashboard" className="rounded-lg bg-[#046C4E] ...">
      {t.dashboard.nav.dashboard}
    </Link>
    <Link href="/settings" title={userEmail} className="flex items-center gap-[9px] ...">
      <Avatar initial={displayName.slice(0, 1).toUpperCase()} size={32} />
      <span className="hidden max-w-[140px] truncate ... sm:block">{displayName}</span>
    </Link>
  </div>
) : (
  /* 기존 로그인 · 무료로 시작하기 버튼 */
)}
```

I also added a fallback that falls back to the email's local part when there's no name.

```tsx
const displayName = userName || userEmail?.split('@')[0] || ''
```

In the server component `page.tsx`, I look up the user with an auth helper and pass the result down. The key is that the email is never hardcoded — it's always resolved dynamically.

```tsx
const [email, testimonials] = await Promise.all([
  getAuthUserEmail(),
  getPublicTestimonials(),
])
const profile = email ? await getOrCreateProfile(email) : null
```

`Promise.all` runs the auth check and the data fetch in parallel, and the profile lookup only follows if there's actually an email.

On top of that, I cleaned up the logo links. The logos in Sidebar/AppShell/Topbar all linked to `/dashboard`; I unified them to `/` to match the "logo = home" convention. Since it's a relative path rather than an absolute URL, it works fine in local and preview environments too.

## Step 3: Adding a Company Chip Filter to Job Browsing

The full collected job list (`PoolJobList`) only supported text search. But in actual use, the need to "just show me this one company's postings" turned out to matter a lot more.

I used `useMemo` to count postings per company, and sorted the chips by posting count, most first.

```tsx
const [companyFilter, setCompanyFilter] = useState<string>('all')

// 회사별 공고 수 — 많은 순으로 칩 정렬
const companies = useMemo(() => {
  const counts = new Map<string, number>()
  for (const j of jobs) counts.set(j.company, (counts.get(j.company) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}, [jobs])
```

The chips toggle. Tapping a selected chip again goes back to showing everything.

```tsx
<button onClick={() => setCompanyFilter(prev => (prev === name ? 'all' : name))}>
  {name} ({count})
</button>
```

It combines with the existing text search filter using AND logic.

```tsx
const visible = jobs.filter(j => {
  if (companyFilter !== 'all' && j.company !== companyFilter) return false
  if (!q) return true
  return `${j.title} ${j.company} ${j.location ?? ''}`.toLowerCase().includes(q)
})
```

It's a light implementation that just filters the array already fetched, on the client, without re-requesting the server — exactly right for MVP scale. I also tweaked the page's flow: instead of leading with the power-user feature of "manually registering a URL," I moved "pick from company presets" to appear first. I pushed the path most users actually take to the top.

## Step 4: Removing Tech-Industry Bias From Example Data

The last one isn't code — it's about **copy and mock data.**

We decided to broaden the service's target from "developer jobs abroad" to "working abroad in general," but the landing page's demo postings and onboarding placeholders were all developer examples.

```
Before: 'Senior Backend Engineer, Payments' — Stripe
After:  'Registered Nurse — Emergency Department' — Ramsay Health Care
```

```ts
// 온보딩 placeholder
- placeholder: '예: 풀스택 개발자, 백엔드 개발자, React Native 개발자',
+ placeholder: '예: 간호사, 마케팅 매니저, 백엔드 개발자',
```

If every mock example is a developer role, a visitor who's a nurse just looks at the landing page and bounces, thinking "oh, this is for developers." **Example data isn't decoration — it's a signal of who the service is actually for.**

One decision I made deliberately: I split the positioning expansion into a **copy layer** and a **data layer**.

1. **Copy layer (today)** — diversify the example roles in the landing showcase and onboarding placeholders
2. **Data layer (next step)** — expand the actual job-collection sources to non-developer roles

Doing both at once would require expanding the scraper too, which balloons the scope. I changed the surface that shows "who this is for" first, and pushed the data to a separate stage, to keep today's work small enough to ship.

## Wrap-Up

Here's the core flow of today's work at a glance.

| Work | Principle |
|---|---|
| Removed the fake search bar | A UI that doesn't work is worse than no UI at all |
| Showed login state in the header | When a "design that simplifies implementation" confuses users, flip it |
| Unified the logo link to `/` | Follow convention, and use relative paths |
| Added a company chip filter | Make the path users actually take the default flow |
| Diversified example roles | Mock data decides the impression of who the service targets |

No new features in this commit, but a lot of the felt polish of a product comes from cleanups like this. If you're building an MVP, it's worth asking yourself today — **is there any UI on my screen that does nothing when clicked?** If there is, deleting it is often the right answer, more often than rushing a feature to fill it.
