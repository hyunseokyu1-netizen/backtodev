---
title: 'Fixing Inherited Code (1/5): The Bug Silently Overwriting the Master Resume'
date: '2026-07-17'
publish_date: '2026-12-16'
description: Validating an AI-written product handoff doc and fixing the most dangerous data-integrity bug first
tags:
  - Next.js
  - Supabase
  - Data Modeling
  - Refactoring
---

## One Handoff Document Started It All

After weeks of continuously patching my side project, MatchDa, I reached a point where "what I'd fixed so far and what was left" only existed in my head. So I had a separate session analyze the whole project and produce a handoff document. It came out to a 28KB file, organized by priority (P0/P1/P2) and even broken into an execution order (Phase 1 through 5).

Before acting on it, I verified it first — you can't just trust a document because an AI wrote it. But once I checked, the issue flagged as P0 turned out to be **real.** And a pretty serious data-integrity bug at that.

This post is the first in that series — a record of fixing the most dangerous bug of the bunch.

## The Problem: the "Tailored Resume" Was Actually the Master Resume

MatchDa is a service that tailors your resume for each job posting you apply to. In the workspace, the user looks at a posting, edits their resume, and hits save. Naturally, they assume what gets saved is **a version scoped to that one posting.**

Looking at the code, that wasn't what happened.

```ts
// WorkspaceResume.tsx — 워크스페이스의 "저장" 버튼
async function handleSave() {
  const saveRes = await saveResumeStudio(koRef.current)   // ← 마스터 이력서에 씀
  const sync = await syncResumeEnglish(koRef.current)       // ← 이것도 마스터에 씀
  ...
}
```

`saveResumeStudio` and `syncResumeEnglish` were functions that directly updated `profiles.onboarding_ko`/`onboarding_en` — in other words, the **master resume** managed on the `/profile` page. The workspace had no concept of a "per-posting draft" in the database at all.

Here's what that looked like as an actual scenario.

1. Edit and save a "leadership-focused" version for job posting A
2. Edit and save a "technical-focused" version for job posting B → **this overwrites what was saved for A too**
3. Go to `/profile` and the master resume has quietly morphed to match job posting B

What made this even more confusing: the same screen had a **separate** "tailored resume" modal. That one was correctly saving per-posting data to the `tailored_resumes` table. In other words, there were two features serving the same purpose — one (the modal) worked correctly, while the other (the workspace's central editor) was corrupting the master.

## How This Happened

My guess is the workspace started out as "a screen where you look at your master resume and tweak it for reference," and later a requirement got added on top — "make it different per posting" — while the save logic stayed untouched and only the screen itself was extended. It's a familiar pattern: **the feature grew, but the data model didn't.**

## The Fix: Fully Separate the Save Paths

There was one guiding principle: **the master resume only changes on `/profile`. The workspace never writes to the master, period.**

### 1. Add Per-Posting Save Columns

I added structured-data columns onto the existing `tailored_resumes` table (which had only held plain text before).

```sql
ALTER TABLE tailored_resumes
  ADD COLUMN IF NOT EXISTS content_ko JSONB,
  ADD COLUMN IF NOT EXISTS content_en JSONB,
  ADD COLUMN IF NOT EXISTS base_resume_synced_at TIMESTAMPTZ;
```

I left the existing `content`/`translation` columns (plain text, used by the modal feature) untouched. Even though they share the same row, they're **different columns**, so the two features coexist without conflict.

### 2. Create a Workspace-Only Server Action

```ts
// src/app/workspace/actions.ts
export async function saveJobResumeDraft(jobId: string, input: StudioResume) {
  const auth = await authorizeJobAccess(jobId) // matches 테이블로 소유권 확인
  const ko = sanitizeStudio(input)

  await supabaseAdmin.from('tailored_resumes').upsert({
    user_id: auth.id,
    job_id: jobId,
    content_ko: ko,           // ← tailored_resumes에만 씀. profiles는 안 건드림
    base_resume_synced_at: ...,
  }, { onConflict: 'user_id,job_id' })
}
```

I left `saveResumeStudio` (master-only) as is, created a new `saveJobResumeDraft` (per-posting only), and switched the workspace to use it. Separating the names themselves reduces the odds of accidentally mixing them up later.

### 3. What Happens When the Master Changes? Never Auto-Overwrite

There was one more thing I had to think through. If a user has already created a draft for job posting A, and then adds new work experience to the master resume on `/profile`, what should happen?

**It must not auto-apply to the draft.** Doing so would silently wipe out what the user had carefully tailored for posting A. Instead, I show a "the master resume changed" banner and let the user decide whether to pull in the update.

```tsx
{masterChanged && (
  <div className="border border-amber-200 bg-amber-50 ...">
    마스터 이력서가 이 공고 초안을 만든 뒤 수정됐어요. 이 초안은 자동으로 바뀌지 않아요.
    <button onClick={handleResyncFromMaster}>최신 마스터로 갱신</button>
  </div>
)}
```

To determine this, I added a new column called `profiles.resume_updated_at`. At first I tried to use the existing `updated_at`, but that column also gets bumped when unrelated settings change — like desired salary — which would have triggered **false alerts**. The right call was a dedicated column that only updates when the resume content itself actually changes.

```ts
// 이력서 내용을 실제로 쓰는 5곳 전부에 이 한 줄을 추가
resume_updated_at: new Date().toISOString(),
```

## Verification Is Part of the Job

A refactor like this only means something if you confirm the isolation actually works before calling it "fixed." I laid out specific scenarios and walked through them myself.

1. Save the leadership-focused version for posting A → save the technical-focused version for posting B → go back to posting A and confirm the content is unchanged
2. Edit the master on `/profile` → open an existing posting draft and confirm it stays unchanged, with only the banner showing up
3. Confirm the master resume on `/profile` is still exactly as it was, even after two separate per-posting saves

All three scenarios passed. Later, in a follow-up post (part 5), I formally turned part of this verification into Vitest tests.

## Trust the AI's Document, or Verify It?

What I took away from this wasn't really technical — it was about process. When you receive an AI-written handoff document:

- **Verify the claims against the code.** I only started work after tracing the actual function-call chain to confirm the claim that "the workspace overwrites the master."
- **Question how current the document is.** I first screened for items marked "unresolved" that might have already been fixed by other work in the meantime.
- **Commit in small units.** I grouped the overall "clean up resume save structure" task — schema change → server action split → UI banner → verification — into one logical commit, but kept it separate from unrelated changes.

## Summary

| Item | Before | After |
|---|---|---|
| Workspace save target | `profiles.onboarding_ko/en` (master) | `tailored_resumes.content_ko/en` (per-posting) |
| Draft when master changes | Risk of silent overwrite | Banner notice + manual update only |
| Change-detection basis | None | Dedicated `resume_updated_at` column |
| Save functions | Master/per-posting mixed together | Clearly split into `saveResumeStudio` vs `saveJobResumeDraft` |

The next post is about how much users can trust what AI produces — showing the basis behind match scores, and detecting when AI invents facts that aren't in the resume.
