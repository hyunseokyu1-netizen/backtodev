---
title: 'Fixing Inherited Code (4/5): Buttons That Do Nothing When You Click Them'
date: '2026-07-17'
publish_date: '2026-12-19'
description: "Making a landing page's overstated copy and non-functional buttons match what the app actually does"
tags:
  - UX
  - Next.js
  - Frontend
---

## Security Was Solid, But the UI Was Lying

Up through the last post, I'd fixed the data-integrity bug, verified AI output, and closed off SSRF. The inside of the codebase had gotten pretty solid — but going back to the handoff document, there was a much more embarrassing item left over.

> "The share button at the top of the workspace does nothing"
> "The workspace's 'apply to this job' button does nothing"
> "The 'Australia · New Zealand' selector in the landing search bar looks like a dropdown but does nothing"

**Buttons that did nothing when clicked** were sitting right there on screen. No matter how solid the backend is, if the first thing a user runs into is a dead button, that alone breaks their trust.

## How to Find Dead Buttons: grep Works Surprisingly Well

The fastest way to spot a dead button is to look for elements styled to look clickable that have no `onClick` at all.

```tsx
// WorkspaceTopbar.tsx — 있었던 코드
<button
  type="button"
  className="... hover:bg-[#F4F6F8] sm:flex"
>
  <Share size={17} />
</button>
```

There's no `onClick` at all. It even has hover styling that makes you want to click it, but clicking really does nothing. The "apply" button was the same way.

```tsx
<button className="... bg-[#046C4E] ...">
  <ArrowRight size={16} />
  <span>{t.workspace.apply}</span>
</button>
```

## Solution 1: Kill It, or Actually Wire It Up

There's no sharing feature at all yet, so the share button got **simply deleted.** Keeping a dead button around because "we'll build it someday" is worse than having no button at all. If it's needed later, it can be rebuilt then.

I took a different approach with the "apply" button. The job posting data already had the original URL, so all I had to do was wire that up.

```ts
// data.ts — jobs 테이블에서 url을 이미 로드하고 있었다
.select('title, company, location, description, url')
```

```tsx
{data.jobExtra?.applyUrl && (
  <a
    href={data.jobExtra.applyUrl}
    target="_blank"
    rel="noopener noreferrer"
    title="공고 페이지를 새 탭으로 엽니다. 제출을 마치면 지원 상태를 '지원 완료'로 바꿔주세요."
  >
    <ArrowRight size={16} />
    <span>{t.workspace.apply}</span>
  </a>
)}
```

Two things mattered here.

**First, opening a link is not the same as completing an application.** The temptation was "should clicking it automatically flip the application status?" But that would be a false signal. Opening a new tab is just viewing the page — the actual application submission happens separately, on that page. **Mixing a button click with the real-world action makes your data lie.**

**Second, sometimes there's no link at all.** A posting a user typed in manually (a card created by typing a company name and job title) has no real URL. In that case it holds a synthetic URL (`manual://uuid`), and opening a link like that as-is throws a browser error.

```ts
applyUrl: job.url && !job.url.startsWith('manual://') ? job.url : null,
```

This one condition prevented yet another kind of dead button — one that exists but does something broken when clicked.

## Solution 2: Static Text Disguised as a Dropdown

The country selector in the landing search bar was a genuinely frustrating case. A `<button>` combined with a `<ChevronDown>` icon reads as an obvious dropdown to anyone. But clicking it opens nothing — there was no country-selection feature at all.

```tsx
// before
<button type="button" className="... sm:flex">
  <GlobeMark />
  {country}
  <ChevronDown />  {/* ← 이게 있으면 드롭다운이라는 시각적 약속이다 */}
</button>
```

With no time to build the actual feature, I **lowered the visual promise instead.**

```tsx
// after — button을 span으로, 화살표 아이콘 제거
<span className="... sm:flex">
  <GlobeMark />
  {country}
</span>
```

`button` became `span`, and the chevron icon was removed. Now it reads as a static label — "Australia · New Zealand is the region this service covers" — rather than a promise. Removing the false promise took far less work than actually building the feature.

## Solution 3: the Copy Was Ahead of the Feature

Buttons weren't the only problem. The copy itself was overstated.

```ts
// i18n.ts
subheadLine1: '관심 회사의 채용 공고를 자동 수집하고 직무·기술로 검색하세요.',
```

At the time this copy was written, there was no auto-scraping yet (that came in part 3). A user who expects new postings to accumulate automatically just by registering, and then discovers they have to click a button manually, ends up disappointed. **Until the feature actually existed, I toned the copy down to honestly describe what it actually did.**

```ts
subheadLine1: '관심 회사의 채용 공고를 한 번에 모아 직무·기술로 검색하세요.',
```

Just dropping the word "automatic" and swapping in "all at once" was all it took, and now the sentence isn't a lie. (For what it's worth, since I built real auto-scraping in part 3, this copy can eventually go back to saying "automatic" again — just as soon as I've confirmed the cron runs reliably for a few days.)

I also fixed up the example company names on the intro page. It said "one-click registration for Apple's careers page," but Apple was actually a special case that only scraped correctly with a search keyword — one-click didn't work for it. I swapped it for companies where one-click genuinely does work (OpenAI, Stripe, Xero).

## Why This Matters — "Consistency of Promises"

If there's one principle tying all of this together, it's this: **every visual signal in a UI — a button's shape, an icon, a line of copy — is a promise made to the user.** Something that looks like a dropdown has to open when clicked; if it says "automatic," it has to actually work automatically; anything shaped like a button has to respond when pressed.

Once enough of these broken promises pile up, users stop trusting the whole screen. The suspicion of "is this fake too?" spreads even to the features that actually work. So this wasn't minor UI cleanup — it was **work that protects trust.**

## Summary — the Dead-Button Checklist

- [ ] Are there elements that look clickable but have no `onClick`/`href`?
- [ ] Does a button that changes state only fire when the matching real-world action has actually happened (opening a link != marking it complete)?
- [ ] Is a button that can have no effect under certain conditions (e.g. data with no URL) hidden entirely under those conditions?
- [ ] Does anything that looks like a dropdown or toggle have real interaction behind it — and if not, has the visual signal been toned down?
- [ ] Do words like "automatic" or "real-time" match what's actually implemented?

The final post wraps everything up with a code-quality pass — getting lint down to zero, migrating to Next.js 16's new convention, and introducing a test runner for the first time.
