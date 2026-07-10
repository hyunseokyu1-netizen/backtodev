---
title: 'Workspace Upgrades (3): The Bug Where the Korean Name Showed on the English Resume, and Adding Contact Fields'
date: '2026-07-08'
publish_date: '2026-08-27'
description: Fixing a Korean-name-exposure bug caused by a single English-translation prompt rule, and adding editable phone number and portfolio link fields to the resume contact line
tags:
  - TypeScript
  - Prompt Engineering
  - React
  - UX Design
---

## Recap of the last part

Last time, I wrote about turning the workspace's "AI analysis" button into a resume-rewriting feature. This part covers two bugs I found while checking that work — small, but important in actual use.

## Problem 1 — the name is in Korean on an English resume

Downloading the English resume as a DOCX, everything else had been translated into English, but **only the name still showed "유현석,"** unchanged. A Korean name on an English resume looks jarring to an overseas recruiter, and I needed to figure out why this was even happening in the first place.

The cause was in the AI prompt responsible for English syncing (Korean → English conversion).

```
Rules:
- Use only facts present in the resume, and never fabricate anything.
- Do not translate name/phone/period — preserve the original notation.
```

There was a rule saying "don't translate the name." The rule itself wasn't ill-intentioned — it was probably meant to prevent "the AI arbitrarily making up a different name." But because "don't translate" got interpreted as "keep the original characters exactly as they are," the Korean name got copied straight into the English version.

## The fix — not "no translation," but "convert to romanization"

I changed the rule governing the name like this.

```
Rules:
- Convert name to the standard English-resume notation (romanization). Example: "유현석" → "Hyunseok Yu." If it's already romanized, leave it.
- Do not translate phone/period — preserve the original notation.
```

All that changed was going from "don't translate" to "convert the name to romanization." It looks minor, but it reminded me once again that **instructions given to an AI are far safer when they specify exactly what to do, rather than what not to do.** "Don't translate" is easily misread as "leave it exactly as it is," but "convert to romanization" leaves no room for interpretation.

I also cleaned up the workspace's document rendering so the English document prioritizes the English-version name.

```ts
function buildDoc(resume: OnboardingResume, name: string, email: string, fallbackTitle: string) {
  return {
    // prefer the language-specific name in the resume data (romanized for the English version) if present
    name: resume.name?.trim() || name,
    ...
  }
}
```

The download filename was similarly changed to be based on the English-version name.

```ts
const fileBaseEn = `resume_${(enDoc.name || ko.name || 'resume').replace(/\s+/g, '_')}`
```

## Problem 2 — contact info only has email, no phone number or links

Looking at the resume's top contact line, there was just a single, lonely email address. A real resume would naturally include a phone number or a portfolio/GitHub link alongside it, but there wasn't even a field to enter one.

## Step 1. Adding a field to the data structure

I added a new `links` field to the resume-editing data type (`StudioResume`). (`phone` already existed, but wasn't exposed in the UI.)

```ts
export interface StudioResume {
  name: string
  phone: string
  /** additional contact links like portfolio, GitHub, etc. (free text, displayed separated by ' · ') */
  links: string
  title: string
  // ...
}
```

## Step 2. A helper function to assemble the contact line

Email, phone number, and links, these three, need to be joined together with only the ones that actually exist (if no phone number was entered, that spot is simply omitted). I pulled this out into a single helper function so this logic didn't need repeating everywhere.

```ts
/** the resume's top contact line: email · phone · links (excluding empty values) */
export function contactLine(email: string, phone?: string, links?: string): string {
  return [email, phone, links].map(v => v?.trim()).filter(Boolean).join(' · ')
}
```

`filter(Boolean)` is the key part. Empty strings or `undefined` get filtered out of the array, so only fields with actual values get joined together automatically. This one function is shared across resume rendering (`studioToDoc`), PDF/DOCX conversion (`studioToRender`), and text download (`studioToText`) — previously, each of these had its own duplicated code like `[contact, r.phone].filter(Boolean).join(' • ')`, and I consolidated it into one place.

## Step 3. Making it directly editable in the workspace

MatchDa's workspace uses a `contentEditable` approach, where clicking a resume field lets you edit it immediately. I added phone and links the same way.

```tsx
<div className="mt-[6px] font-mono text-[13px] text-[#98A2B3]">
  {contact}
  <span className="mx-1.5 text-[#D0D5DD]">·</span>
  <EditableText editKey={editKey} v={ko.phone} ph="Phone number" cls=""
    onCommit={val => commit(d => ({ ...d, phone: val }), val, ko.phone)} />
  <span className="mx-1.5 text-[#D0D5DD]">·</span>
  <EditableText editKey={editKey} v={ko.links} ph="Portfolio/GitHub link" cls=""
    onCommit={val => commit(d => ({ ...d, links: val }), val, ko.links)} />
</div>
```

When a value is empty, without a hint about "what to enter here," a user won't even realize that spot is editable at all. So I added a placeholder (`ph`) option to the `EditableText` component, handling it with pure CSS so a faded hint text shows when it's empty.

```tsx
className={`${cls} ... ${
  ph ? 'empty:before:text-[#C5CBD3] empty:before:content-[attr(data-ph)]' : ''
}`}
```

Tailwind's `empty:before:content-[attr(data-ph)]` is a CSS trick that shows the `data-ph` attribute's value as a pseudo-element only when the element is empty (`:empty`). Rather than implementing "show placeholder text when empty, hide it once typed" directly in JavaScript, this was solved with a CSS selector alone.

## Step 4. The public resume keeps excluding only the phone number

The public resume-sharing page (`/r/<slug>`) built earlier never exposed contact info at all, for privacy protection. With the new links field, I re-examined that principle — portfolio/GitHub links are information that's inherently "fine to make public," so they can be shown, but a phone number is still personal data and needs to stay excluded.

```ts
// never include email/phone on the public resume — minimize personal data
// (portfolio/GitHub links are kept, since they're information meant to be public)
const doc = studioToDoc({ ...resume, phone: '' }, '')
```

Just overwriting `phone` with an empty string before passing it along means the `contactLine` helper built earlier automatically skips that item, showing only links (or nothing) with no email. It reminded me again that it matters to pause and ask "is this information okay to make public?" every single time a new field gets added.

## Summary

```
Bug: the Korean name showed on the English resume
Cause: the "don't translate" rule got interpreted as "leave it as-is"
Fix: made it specific — "convert to romanization" + English documents prioritize the English-version name

Feature: added phone number and links to contact info
Implementation: a StudioResume.links field + deduplication via a shared contactLine() helper
      + a contentEditable placeholder (empty:before CSS)
      + the public page keeps excluding only the phone number
```

Next up (the last part): attaching drag-and-drop to the kanban board, and adding a feature to re-measure the match rate on the fly.
