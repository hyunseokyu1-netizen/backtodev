---
title: 'Nogari Renewal (5/5) — Opening Rooms from a Single Keyword and Consolidating a Scattered Admin'
date: '2026-07-19'
publish_date: '2026-12-29'
description: Wrapping up the renewal with an AI-assisted issue-room creation feature driven by a news keyword, and pulling five scattered admin pages into one home screen
tags:
  - Claude API
  - Next.js
  - Product Planning
  - Admin Tools
  - Renewal
---

## Five Parts of Renewal, the Final Installment

Part 1 covered the concept and the trend score, Parts 2-3 covered AI summaries and share cards, and Part 4 covered growth features. That wraps up Stages 1-2 of the spec (core renewal + growth features). The last things I touched were **automatic issue-room generation** — one item from Stage 3, "enhancements" — and cleaning up the admin pages, which had quietly grown to five over the course of the work.

## Step 1: Generating a Room Proposal from a Single News Headline

Nogari has a problem where rooms look empty when there aren't many early users yet. To ease this, the spec called for a flow where "the admin enters a news headline or keyword, AI proposes a room name, description, and question, and the admin reviews it before opening the room."

```text
입력: 전국 폭염 경보 확대

생성 결과:
방 이름: 폭염 특보
카테고리: 사건
설명: 전국적인 폭염과 관련한 생활, 노동, 전기요금 문제를 이야기하는 방입니다.

오늘의 질문:
- 에어컨 전기요금 부담이 커졌나요?
- 야외 노동 제한이 필요하다고 보나요?
- 정부의 폭염 대책이 충분하다고 생각하나요?
```

I split this into a two-stage API. Stage 1 is "just get a proposal," stage 2 is "actually open the room using the content the admin has reviewed."

```ts
// POST /api/admin/issue-room — 개설안 생성 + 기존 방 중복 검사
export async function POST(request: NextRequest) {
  const draft = await generateIssueRoom(keyword);

  // 이미 있는 방과 겹치는지 AI로 재확인 — 방 제안 기능에 쓰던 함수를 그대로 재사용
  const similarity = await checkTopicSimilarity(draft.name, draft.description, existingTopics);

  return NextResponse.json({ draft, isDuplicate: similarity.isDuplicate, similarTopics: similarity.similarTopics });
}

// PUT /api/admin/issue-room — 관리자가 검토한 내용으로 즉시 개설
export async function PUT(request: NextRequest) {
  const { data: topic } = await admin.from("topics").insert({
    title: name,
    description,
    topic_type: topicType,
    room_mode: "PERMANENT",
    status: "ACTIVE",           // ← 일반 방 제안과 다르게 동의 절차 없이 바로 활성화
    required_votes: 0,
    activated_at: new Date().toISOString(),
    is_seed: true,
    today_question: todayQuestion,
  }).select().single();

  return NextResponse.json({ topic }, { status: 201 });
}
```

There's an interesting bit of reuse here. `checkTopicSimilarity`, used for the duplicate check, was originally a function built to check against existing rooms **when a regular user proposes a room.** Issue-room creation turned out to be the same underlying problem — "check for duplicates before creating a new room" — so I pulled it in as-is rather than writing it again. The admin form shows a warning with a "go to existing room" link when a similar room is found, but leaves the final call to the admin.

What differs from a regular room proposal is `required_votes: 0` and `status: "ACTIVE"`. A regular user's proposal needs to collect votes before it opens, but an official room the admin creates directly opens immediately with no voting step. Even though both use the same `topics` table, these two fields are what encode the fact that **the opening procedure differs depending on who's creating the room.**

## Step 2: One Principle Running Through All Three AI-Generation Features

This renewal called out to AI in three places — comment summaries (Part 2), the question of the day (Part 4), and this issue-room generation. The principle I tried to uphold across all three converges into a single line.

> **AI produces the draft; final approval is always made by a human.**

The issue-room creation form also keeps a separate "generate" button and "open" button. It displays the AI-generated name, description, type, and three candidate questions on screen, turns them into input fields the admin can freely edit, and only then can the open button be pressed.

```tsx
<Button onClick={handleGenerate}>AI 개설안 생성</Button>

{draft && (
  <div>
    <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
    <textarea value={draft.description} onChange={...} />
    <select value={draft.topicType} onChange={...}>...</select>
    {/* 오늘의 질문 3개 중 라디오로 하나 선택 */}
    <Button onClick={handleCreate}>이 내용으로 공식 방 개설</Button>
  </div>
)}
```

Full automation might look flashier, but given the risk of a defamatory or false room name going out as-is, I judged this much friction to be a necessary safeguard.

## Step 3: The Admin Had Grown to Five Pages — Time to Clean Up

Admin pages naturally multiplied as the renewal went on. Report management already existed, and room management, operational settings, social content, and issue-room creation got added one at a time on top of it. The problem was that navigating between pages meant **hand-written underlined links scattered differently on every single page.**

```tsx
// 신고 관리 페이지
<Link href="/admin/topics">노가리방 정보 수정</Link>
<Link href="/admin/settings">운영 설정</Link>

// 노가리방 관리 페이지
<Link href="/admin/reports">신고 관리로 이동</Link>
<Link href="/admin/settings">운영 설정</Link>
```

Every time a new page appeared, the structure demanded adding a link to it on all 4 existing pages without missing a single one. I actually did forget one link when I added the social content page. So I pulled everything into one shared shell component.

```tsx
// src/components/admin/AdminShell.tsx
export const ADMIN_MENU = [
  { key: "home", label: "홈", href: "/admin" },
  { key: "reports", label: "신고 관리", href: "/admin/reports" },
  { key: "topics", label: "노가리방 관리", href: "/admin/topics" },
  { key: "issue-room", label: "이슈 방 만들기", href: "/admin/issue-room" },
  { key: "sns", label: "SNS 콘텐츠", href: "/admin/sns" },
  { key: "settings", label: "운영 설정", href: "/admin/settings" },
];

export function AdminShell({ active, title, description, children }) {
  return (
    <div>
      <nav>
        {ADMIN_MENU.map((item) => (
          <Link key={item.key} href={item.href} aria-current={item.key === active ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <header><h1>{title}</h1><p>{description}</p></header>
      {children}
    </div>
  );
}
```

Now adding a new admin page only takes one line in the `ADMIN_MENU` array, and the menu is automatically reflected across all 5 existing pages. I also built `/admin` fresh as a landing page that hadn't existed before, showing operational numbers — open report count, active room count, 24-hour comment count — as stat tiles, with cards leading into each menu item.

```tsx
const stats = [
  { label: "미처리 신고", value: openReports.count, href: "/admin/reports", alert: openReports.count > 0 },
  { label: "활성 노가리방", value: activeTopics.count, href: "/admin/topics" },
  { label: "개설 대기 제안", value: pendingTopics.count, href: "/proposals" },
  { label: "24시간 댓글", value: comments24h.count, href: "/" },
];
```

If there's even a single unresolved report, the number is highlighted in red. The screen an admin sees first after logging in has effectively become a dashboard that immediately tells them "what you need to look at right now."

## Looking Back on the Renewal

Summed up in one line, the work spread across these five parts was a move **from "a community where people have to manually create and fill rooms" to "a platform that shows what's hot in real time, with AI assisting on top while a human gives final approval."**

Three principles I kept re-confirming while working, laid out below.

1. **AI drafts, a human approves.** For summaries, questions, and issue-room generation alike, there's a human-review step between the AI call and the result actually going live.
2. **Weights and thresholds live in configuration, not in code.** I avoided hardcoding the trend score weights and room-opening criteria (vote count, time window) and made them directly adjustable from the admin screen. Values whose right answer you can't know ahead of time need to be tunable after deployment.
3. **Design on the assumption of failure.** Falling back to the previous cache when an AI call fails, falling back to a photo-less layout when an external image fetch fails — at every point with an external dependency, I built a path where "failure doesn't take the whole thing down."

This renewal started from a single spec document and grew into 5 database migrations, several new pages, and admin tooling. What's left is going back to the spec for the Stage 3 items I deferred this time — things like browser push notifications and per-room sentiment trends.

## Series Recap

| Part | Topic |
|---|---|
| Part 1 | Main concept renewal, trend score v2 formula |
| Part 2 | AI comment summaries, caching strategy, 4 comment sort modes |
| Part 3 | Troubleshooting a satori OG image 500 error |
| Part 4 | localStorage-based favorite rooms, related room suggestions, question of the day, social content |
| Part 5 | Automatic issue-room generation, admin home cleanup |
