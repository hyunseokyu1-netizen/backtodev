---
title: 'Building a Moderation Pipeline Where AI Triages Reports Before I Ever See Them'
date: '2026-07-13'
publish_date: '2026-11-18'
description: When a report comes in, Claude re-reviews it with the surrounding context and sorts it three ways — auto-hide, auto-dismiss, or send to an admin queue — including the conservative design that defers to a human when unsure, and recovery from false positives
tags:
  - Claude API
  - Moderation
  - Supabase
  - Next.js
  - LLM
---

If you run an anonymous community, there's one thing you can't avoid. **Report handling.** When a user hits the report button, that report lands in a queue somewhere, and eventually the operator (me) has to go through them one by one and decide "delete this, or ignore it."

My side project already had an AI filter running at comment-creation time. But reports were different. They just piled up in a reports table until I logged into the admin page and dealt with them — meaning **the problematic comment stayed visible the whole time.** A malicious comment could rack up 10 reports while I was asleep and just sit there until morning. For a one-person operation, that's a real liability.

So I built a pipeline where AI reviews the report the moment it comes in.

## Design — Three-Way Classification and the "Cowardly AI" Principle

The core idea is to have AI handle reports like **a first-instance court in a three-tier system**:

```
Report filed → AI re-review (report reason + original comment text + room context)
  ├─ VIOLATION (clearly violates)  → auto-hide the comment + close out related reports in bulk
  ├─ CLEAN (clearly fine)          → auto-dismiss the report (defense against false reports)
  └─ UNCERTAIN (ambiguous)         → sits in the admin queue as "needs review"
```

The most important design decision was **making the AI cowardly on purpose.** VIOLATION leads to automatic deletion, and CLEAN leads to automatically ignoring the report — these are verdicts with execution authority. A wrong call is expensive. So I nailed this down in the system prompt:

> "If you're not confident, you must return UNCERTAIN. VIOLATION leads to automatic deletion and CLEAN leads to automatic dismissal, so a human needs to look at anything ambiguous."

One more principle: **room closures never run automatically.** Hiding a comment is a recoverable soft delete, but closing a room is a destructive action that affects the entire conversation inside it — so even if the AI rules VIOLATION, it only ever gets routed to admin review. The scope of automation stops at "things that can be undone."

## Step 1 — How This Differs From the Creation-Time Filter: Context

The creation-time filter only sees the comment text. Report-time review has more material to work with:

```ts
const review = await reviewReportedContent({
  content,                    // 신고된 댓글 원문
  reportReason,               // 신고자가 적은 사유
  topicTitle,                 // 어느 방(누구/무엇에 대한 이야기)인지
});
```

This difference actually changes the quality of the verdict. I'll show that in the test cases later.

The implementation enforces the verdict using Claude API's structured output (json_schema):

```ts
output_config: {
  format: {
    type: "json_schema",
    schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["VIOLATION", "UNCERTAIN", "CLEAN"] },
        reason: { type: "string" },   // 관리자가 볼 한 문장 요약
      },
      required: ["verdict", "reason"],
    },
  },
},
```

Requiring `reason` is the key part. If you keep only the verdict, there's no way to later answer "why did the AI hide this?" — one sentence of reasoning becomes the audit log.

## Step 2 — History: Change the Status, Don't Delete the Row

The existing implementation **deleted** the row once a report was handled. That became a problem once automation entered the picture. If AI handles things on its own and the record disappears, the operator has no way to know what the AI actually did.

So instead of deleting, I switched to a state machine:

```sql
create type report_status as enum (
  'PENDING',        -- 접수됨 (AI 심사 전 또는 심사 실패)
  'AUTO_HIDDEN',    -- AI가 위반 판정 → 대상 자동 숨김
  'NEEDS_REVIEW',   -- AI가 애매 판정 → 관리자 검토 필요
  'AUTO_DISMISSED', -- AI가 정상 판정 → 자동 기각
  'RESOLVED'        -- 관리자가 직접 처리 완료
);

alter table reports add column status report_status not null default 'PENDING';
alter table reports add column ai_verdict text;   -- 판정
alter table reports add column ai_reason text;    -- 판단 근거 (감사 로그)
alter table reports add column resolution text;   -- 최종 조치 설명
alter table reports add column resolved_at timestamptz;
```

The admin page is split into two sections: "needs review" (PENDING + NEEDS_REVIEW) and "history" (everything else), and each report shows the AI's verdict, its reasoning, and the outcome. It's a setup where **I can scroll through what the AI hid and dismissed overnight with my morning coffee.**

I also had to plan for false positives. Auto-hiding is a soft delete, so the admin page has a "restore comment (false positive)" button, and restoring it leaves a history entry of "restored by admin (false-positive auto-hide)."

## Step 3 — A Safeguard Independent of AI: A Report-Count Threshold

Even if AI rules UNCERTAIN, there's a decent chance multiple people reporting something means there's a real reason. So I added one more rule that's independent of the AI's verdict:

```ts
// 같은 댓글에 미처리 신고가 3건 이상 쌓이면 일단 숨긴다
if ((count ?? 0) >= AUTO_HIDE_REPORT_THRESHOLD) {
  await hideCommentAndResolve(admin, targetId, `신고 ${count}건 누적으로 자동 숨김`);
}
```

"Hide it first, restore it if it turns out to be unfair" is safer than the reverse in an anonymous community. The damage from an exposed malicious comment is immediate; the damage from a wrongly hidden normal comment is recoverable.

Failure modes were designed explicitly too. What if the Claude API call fails? The report stays PENDING and lands in the admin queue. **Even if the AI goes down, reports don't evaporate — they naturally fall back to the existing manual process.**

## Step 4 — End-to-End Testing: A Moment Where the AI Was More Careful Than I Was

After implementation, I filed real reports and verified all three paths, and something interesting happened along the way.

**Test 1 — A normal comment plus an emotional report.** I reported the comment "air fryers really are the best way to make fries" with the reason "I just don't like it":

```json
{
  "status": "AUTO_DISMISSED",
  "ai_verdict": "CLEAN",
  "ai_reason": "에어프라이어 관련 일상적인 의견으로 위반 사항 없으며 신고 사유도 단순 불만 수준임."
}
```

Fake or emotional reports get filtered out before they ever reach the admin queue.

**Test 2 — A threatening sentence.** I entered something along the lines of "I'll track you down and kill you" and reported it, and I honestly expected VIOLATION — but:

```json
{
  "status": "NEEDS_REVIEW",
  "ai_verdict": "UNCERTAIN",
  "ai_reason": "살해·주소추적 언급이 있으나 에어프라이어 주제 맥락상 과장된 농담일 가능성이 있어 사람 검토가 필요함."
}
```

**It looked at the room context (air fryers) and punted to a human, saying it might be an exaggerated joke.** My first reaction was "is this a misjudgment?", but the more I thought about it, the more it felt right. Exaggeration like "lol I could literally kill you for this" is common in communities, and telling it apart from a real threat needs context. When unsure, return UNCERTAIN — this was the exact moment the principle baked into the prompt did its job.

Once more reports piled up on the same comment with a specific reason like "this is an actual threat," it then ruled VIOLATION, auto-hid the comment, and bulk-closed the pending reports on it.

**Test 3 turned up an edge case** too. A new report filed against a comment that was already hidden had no target left to review, and it just sat PENDING forever. I added a branch that immediately closes it out as "target already hidden." A bug I wouldn't have found without end-to-end testing.

## Troubleshooting Summary

| Situation | Design decision |
|---|---|
| AI wrongly hides a normal comment | soft delete + admin "restore (false positive)" button + history record |
| AI rules boldly on something ambiguous | prompt says "return UNCERTAIN if unsure" + explicitly states automatic actions are irreversible |
| Claude API outage | stays PENDING → naturally falls back to the manual process |
| A report against an already-hidden target | close it out immediately (prevents permanent PENDING) |
| VIOLATION on a room-level report | no auto-close — goes to admin review (destructive actions stay human) |

## Wrap-up

1. **Report review has an advantage over the creation-time filter** — it can use the report reason and room context as material too
2. **When you give AI execution authority, make it cowardly** — defer to a human when ambiguous, and keep destructive actions out of automation
3. **Automation history should be a status change, not a deletion** — a human needs to be able to audit what the AI did
4. **Layer in safeguards independent of the AI** — report-count thresholds, manual fallback on API outages
5. **Build the false-positive recovery path first** — having a restore button is what lets you comfortably turn on auto-hide

After building this, my nights running this solo got a lot easier. Clear-cut abuse disappears the moment it's reported, fake reports get dismissed on their own, and all I have to look at is whatever the AI flagged as "ambiguous." And more than anything — when the AI withheld judgment saying "might be a joke given the room context," that's when I started trusting the automated system. Good automation isn't trustworthy because it's bold — it's trustworthy because **it knows when to stop.**
