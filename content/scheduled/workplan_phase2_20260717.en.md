---
title: 'Fixing Inherited Code (2/5): When AI Makes Up Numbers and No One Notices'
date: '2026-07-17'
publish_date: '2026-12-17'
description: Showing users what an AI match score is actually based on, and catching cases where AI invents facts not in the resume
tags:
  - AI SDK
  - Claude
  - UX
  - TypeScript
---

## Nobody Knew What a "Score of 0" Actually Meant

In the last post, I fixed the bug where the workspace was silently overwriting the master resume. This time it was a different kind of problem — less a bug, more a **trust problem**.

MatchDa has AI assign a match score for every job posting. But the "0" shown on screen was actually conflating two different meanings.

1. AI analyzed it and concluded "this posting really isn't a fit for me" → a genuine score of 0
2. Parsing the AI's response failed → a plain failure that got **stored as a score of 0**

From the user's side, both cases look identical — just "0." A temporary API error ends up delivering a false verdict: "you're not a fit for this company at all."

## Problem 1: Stop Disguising Failures as a Score of 0

The original code looked like this.

```ts
try {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found')
  return JSON.parse(jsonMatch[0]) as MatchResult
} catch {
  return { score: 0, reason: '분석 실패', highlights: [] }  // ← 실패인데 0점?
}
```

The fix is simple: **failure is `null`, a real verdict is a number.** I baked this distinction straight into the TypeScript types.

```ts
interface MatchResult {
  /** null = 분석 실패 (0점과 구분 — 0은 "무관한 직무"라는 실제 판정) */
  score: number | null
  reason: string
  highlights: string[]
}

function clampScore(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n)))
}
```

I pulled `clampScore` out as its own function because the model can occasionally hand back a number over 100, or even a string. This is where I first established the principle of **never trusting an AI response as-is — always enforce its type and range** — and I kept applying that same principle throughout the rest of the work.

This change alone wasn't enough. There were already "fake zeros" sitting in the database, so I retroactively corrected them with a migration.

```sql
-- 과거 분석 실패 행: 실제 0점이 아니라 실패였으므로 미채점(NULL)으로 정정
UPDATE matches
SET score = NULL
WHERE score = 0
  AND (reason LIKE '분석 실패%' OR reason LIKE '매칭 실패%');
```

Getting the parenthesization of `AND` and `OR` wrong here could wipe out rows that had a genuine score of 0 — this was something I flagged separately later during code review.

## Problem 2: a "Title-Only Guess" Looked Identical to a "Full-JD Score"

MatchDa has two kinds of match scoring.

- **Lightweight scoring**: when scanning the list of postings, Haiku quickly scores based on just the title, location, and department
- **Precise scoring**: analysis based on actually reading the full JD (job description detail)

If an "estimated 72" produced from the title alone looks identical on screen to a "72" derived from reading the full JD, the user ends up trusting it as much as the latter. But a title alone tells you nothing about visa requirements, required skills, or years of experience.

I added a `score_type` column to record the basis for each score.

```ts
export type ScoreType = 'jd_analysis' | 'title_estimate'

const hasJd = !!job.description?.trim()
const scoreType: ScoreType = hasJd ? 'jd_analysis' : 'title_estimate'
```

Then I made the UI distinguish between the two. The list shows "estimated 82," the workspace banner gets a yellow "title-based estimate" badge, and a tooltip explains "entering the JD will trigger a precise analysis."

```tsx
{isEstimate ? `예상 ${score}점` : `${score}점`}
```

Adding one small word ("estimated") might look trivial, but telling the user **how much to trust a number AI produced** is at the core of trustworthy UX.

## Problem 3: AI Invented Numbers That Weren't in the Resume

This was the most interesting part of this post. MatchDa's "enhance resume with AI" feature had this nailed down in its prompt:

> "No fabricating facts: don't invent specific figures (percentages, counts, amounts), company names, or project names that aren't in the original."

But **a prompt instruction alone doesn't guarantee anything.** When the model gets a request like "make this achievement sound more impressive," it often slips in a plausible-looking number. It'll invent something like "improved response time by 40%" out of thin air when the original never said that.

If a prompt can't fully prevent this, then **verify the output in code** instead. I wrote a pure function that compares the original against the AI-revised version and detects any numbers, company names, date ranges, skills, or job titles that newly appeared.

```ts
// resume-fact-check.ts
function numberTokens(text: string): Set<string> {
  const tokens = text.match(/\d[\d,.]*/g) ?? []
  return new Set(tokens.map(t => t.replace(/[,.]+$/, '').replace(/,/g, '')).filter(t => t.length >= 2))
}

export function checkResumeFacts(original: StudioResume, revised: StudioResume): FactWarning[] {
  const warnings: FactWarning[] = []

  const origNums = numberTokens(allText(original))
  const addedNums = [...numberTokens(allText(revised))].filter(n => !origNums.has(n))
  if (addedNums.length) {
    warnings.push({ kind: 'number', message: `원본에 없던 숫자가 추가됐어요: ${addedNums.join(', ')}` })
  }
  // 회사명·기간·스킬·직함도 같은 방식으로 비교
  ...
}
```

The key is that it **warns rather than blocks.** Failing this check doesn't prevent saving — it shows the user "please double-check this part." AI isn't always wrong, after all — a number might change for a legitimate reason. The human makes the final call.

```tsx
{undoSnapshot && (
  <div className="border border-amber-200 bg-amber-50 ...">
    ✨ AI가 이력서를 수정했어요 — 제출 전 사실이 맞는지 확인해주세요.
    <ul>{factWarnings.map(w => <li key={w}>{w}</li>)}</ul>
    <button onClick={handleUndoAi}>↺ 수정 전으로 되돌리기</button>
  </div>
)}
```

While working on this, I stumbled onto something else interesting. The workspace's "edit via AI chat" feature was **saving its output directly to the master resume** — the same kind of bug I'd fixed in part 1 was still lurking in a different function. I fixed that one too while I was at it, changing it so the AI's edit result sits in a "proposed" state until the user explicitly hits "save" to confirm it.

## Drawing the Line Between True and False Positives

What I worried about most with this detection logic was **false positives.** If even wording tweaks (phrasing improvements) or a reordered skill list trigger a "warning," users will quickly start ignoring them. So I split true/false positives into 8 cases and tested each one.

```ts
it('표현만 수정(사실 동일) → 경고 없음', () => {
  const r = clone()
  r.summary = '3년간 Node.js 기반 API 서버를 설계·개발한 경험이 있습니다.'
  expect(kinds(r)).toEqual([])  // 문장이 바뀌어도 숫자·고유명사가 그대로면 통과
})

it('원본에 없던 숫자 날조 → number 경고', () => {
  const r = clone()
  r.experience[0].description += '\n응답 속도 40% 개선'
  expect(kinds(r)).toEqual(['number'])
})
```

Warn too often and you become "the boy who cried wolf"; warn too rarely and the feature is pointless either way. The only way to find that balance was to build out a bunch of real scenarios and test them.

## Summary

| Problem | Fix |
|---|---|
| AI failures showed up as a score of 0 | Split into `score: number \| null`, retroactively corrected old data |
| Title-based estimates looked like precise analysis | `score_type` column + "estimated" label |
| AI invented facts not in the resume | Original-vs-revision comparison detector, warn instead of block, with undo |
| AI chat edits saved straight to the master | Switched to a "proposed" state before saving |

When you're building AI features, it's easy to fall into thinking "I wrote the rule in the prompt, so we're safe." What this post taught me is that **telling a model not to do something, and actually confirming in code that it doesn't, are two completely different things.** The next post covers a security problem that comes up when this service fetches external URLs — how I closed off an SSRF hole.
