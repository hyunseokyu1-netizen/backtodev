---
title: "Why My LLM Profanity Filter Let Curse Words Through — It Wasn't a Bug, It Was the Prompt"
date: '2026-07-14'
publish_date: '2026-11-30'
description: What I learned from anonymous community comments containing straight-up profanity sailing past my filter, and the layered moderation design (regex first pass + LLM second pass) I built to actually fix it
tags:
  - Claude API
  - LLM
  - Content Moderation
  - Prompt Engineering
  - Next.js
---

## The Swearing Went Straight Through

I was using "Nogari," an anonymous community service I built, and left a comment just to test things out.

> F***...

I hit submit. And it went straight through. To double-check, I also left "you idiot" and "this sucks."
All of them passed.

I panicked and opened the code. I'd definitely wired up an LLM-based moderation filter, so why was such
blatant profanity sailing through unfiltered? Once I checked the logs and reread the prompt, the answer
clicked. **It wasn't a bug. The system was doing exactly what I'd told it to do.**

## The Cause — I Built It That Way Myself

The existing moderation function's prompt looked like this.

```ts
system:
  "입력된 댓글에 심각한 패드립, 살해 협박, 명백한 허위 사실 유포 성격의 " +
  "문장이 포함되어 있는지 확인해라. 일반적인 비판, 풍자, 해학 수준의 뒷담화는 " +
  "통과시켜라. 익명 커뮤니티 특유의 거친 표현 자체는 차단 사유가 아니다."
```

When I first wrote this prompt, I had my own logic for it. "This is an anonymous community for talking
behind people's backs — if the tone gets too sanitized, isn't it just less fun? Let's only block the
severe stuff and leave the rest free." But if you put yourself in the shoes of the model actually receiving
this prompt, a single swear word isn't profanity aimed at someone's family, a death threat, or
disinformation. So **the model didn't break any rule — the rule I gave it simply wasn't designed to filter
out swearing in the first place.**

This is the first thing you need to internalize when working with LLM filters. **The moment something
"feels like it's behaving strangely," the first thing to suspect isn't the model — it's the prompt you
wrote.** Especially with prompts written as a list of forbidden items (a blacklist-style prompt), it's
easy to forget that anything you didn't explicitly list is implicitly allowed through.

## Redefining the Policy First

Before touching the code, I nailed down the principle first.

> **Talking behind someone's back is fine. Swearing is not.**

This single line became the standard for everything I implemented afterward. Sharp criticism without
profanity — things like "this policy is terrible" or "are the mods even paying attention?" — is part of
the community's identity and needs to survive. But the swear words themselves get blocked regardless of
content. Separating these two things was the whole key.

## Step 1 — Instantly Block the Obvious Stuff with a Regex First Pass

There was already a first-pass filter that instantly blocked PII patterns (national ID numbers, phone
numbers, emails) using regex. It runs without any LLM call, so it's fast and free. I added profanity
patterns to it.

```ts
// 흔한 욕설/비속어(초성·로마자 우회 포함). 정규식으로 가장 명백한 것만
// 즉시 차단하고, 애매하거나 변형이 심한 표현은 뒤의 LLM 단계가 판단한다.
const PROFANITY_PATTERNS: RegExp[] = [
  /씨\s*발/i,
  /시\s*발/i,
  /병\s*신/i,
  /좆\s*같/i,
  /좆\s*또/i,
  /개\s*새\s*끼/i,
  /지\s*랄/i,
  /니\s*기\s*미/i,
  /ㅅㅂ/i,
  /ㅂㅅ/i,
  /sib+al/i,
  /sip+al/i,
  /byeong\s*sin/i,
  /ssibal/i,
];
```

There are a few design decisions in here worth calling out.

- I **allowed whitespace/separators between characters with `\s*`.** This catches common filter-evasion
  tricks like inserting spaces or punctuation between letters, e.g. writing it with a space or a dot in
  the middle.
- I **included Korean consonant-only abbreviations and Romanized spellings too.** When I actually tested
  it, writing the word out in Roman letters sailed right past the old filter.
- This regex only catches **the most unambiguous cases.** It's fine if heavily disguised or ambiguous
  variants slip past this stage — that's what the next stage, the LLM, is for, judging things by context.

## Step 2 — Rewriting the LLM Second-Pass Prompt to Be Unambiguous

Whatever makes it past the regex gets handed to the LLM, and this is where I rewrote the prompt from
scratch.

```ts
system:
  "너는 익명 커뮤니티 '노가리'의 댓글 검열 담당자다. 이 커뮤니티의 핵심 " +
  "원칙은 '뒷담화(노가리)는 까도 되지만 욕은 하지 않는다'이다.\n" +
  "차단 대상: 욕설·비속어(변형·초성·로마자 표기 포함), 패드립, 살해·폭력 " +
  "협박, 명백한 허위 사실 유포, 심각한 인신공격.\n" +
  "허용 대상: 대상에 대한 비판, 풍자, 해학, 불만 표현 — 단 욕설 없이 " +
  "표현된 경우에 한한다. '별로다', '실망스럽다', '이해가 안 간다' 같은 " +
  "표현은 통과. 욕설 단어가 하나라도 섞여 있으면 나머지 내용이 정상적인 " +
  "비판이어도 차단해라."
```

The difference from the earlier version is stark.

| | Before | After |
|---|---|---|
| Principle | "Only block the severe stuff" (blacklist-style) | "Swearing is always blocked, criticism only passes without it" (a clear line) |
| Treatment of profanity | Not grounds for blocking | Explicit top-priority blocking target |
| Handling ambiguous cases | Not addressed | Priority stated explicitly: "even one swear word blocks the whole thing" |
| Examples | None | Concrete examples of acceptable phrasing provided |

The last line in particular mattered most: **"If even one swear word is mixed in, block it even if the
rest of the content is ordinary criticism."** LLMs tend to look at the overall tone of a sentence and give
it the benefit of the doubt, thinking "eh, this is just strong criticism" — and this line closes off that
room for leniency directly in the prompt.

The `reviewReportedContent` function, which re-reviews already-reported content, got its prompt aligned
to the same principle too. If the filter used at posting time and the filter used at report-review time
run on different standards, you end up with the confusing user experience of "it passed when I posted it,
but now it's getting blocked for a different reason after someone reported it."

## Step 3 — Actually Verifying It

Changing the prompt and stopping at "looks like it should work" isn't good enough. Before deploying, I hit
the real API from the browser to check.

```js
const tests = ["씨발...", "좆같아.", "병신들", "Sippal", "니기미 좆또"];
for (const content of tests) {
  const res = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topicId, content }),
  });
  console.log(content, "→", res.status);
}
```

Results:

```
씨발...     → 422 (차단됨)
좆같아.     → 422 (차단됨)
병신들      → 422 (차단됨)
Sippal      → 422 (차단됨)
니기미 좆또 → 422 (차단됨)
```

And I checked the opposite case too. Harsh criticism without profanity still needs to pass through.

```
"이 정책은 진짜 별로다. 피해자 지원이 너무 느림"     → 201 (등록됨)
"전세사기범들 진짜 벌 좀 세게 받았으면"               → 201 (등록됨)
```

The split came out exactly as intended. Profanity blocked 100%, and the freedom to talk behind someone's
back preserved.

## Step 4 — Retroactively Handling Profanity Already Posted

Changing the policy doesn't remove comments that are already live. I tracked down the 5 profane comments
I'd left while testing and soft-deleted them from the DB.

```ts
await supabase
  .from("comments")
  .update({ deleted_at: new Date().toISOString() })
  .in("id", profanityCommentIds);
```

The reason I only filled in `deleted_at` instead of physically deleting the rows is that I might later
need an audit trail of "when exactly did this policy start applying, and to which content." The more you
tweak a filter, the more leaving a trail helps you down the line.

## Wrap-Up

1. **When an LLM behaves strangely, suspect the prompt first.** In most cases, the model is doing exactly
   what it was told. "The filter isn't working" is often not a bug but a design problem — "I never clearly
   defined what the filtering criteria actually are."
2. **Nail down your content policy in one sentence before you write the prompt.** A clear principle like
   "talking behind someone's back is fine, swearing isn't" keeps the prompt — and every judgment call
   afterward — consistent.
3. **A layered defense helps both cost and accuracy.** Handle the unambiguous patterns (regex) instantly
   without an LLM call, and only hand the ambiguous judgment calls to the LLM. Catching all 5 blatant
   profanity cases at the regex stage alone means saved API call costs and a faster response time.
4. **Spell out priority for edge cases directly in the prompt.** Ambiguous points — like which side wins
   when profanity is mixed into otherwise legitimate criticism — need to be explicitly decided, or the LLM
   will default to leniency.
5. **Before deploying, verify both directions against the real API.** True verification means confirming
   not just that what should be blocked gets blocked, but also that what should pass still passes.

Running an anonymous community means constantly having to draw a line between "freedom of expression" and
"a minimum level of decency." If that line is blurry, the LLM will judge things blurrily too. What I
learned firsthand this time is that a good moderation system doesn't start with a good model — it starts
with **one clear policy sentence.**
