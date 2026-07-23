---
title: '노가리 리뉴얼 (5/5) — 키워드 하나로 방을 여는 기능과, 흩어진 관리자 화면 모으기'
date: '2026-07-19'
publish_date: '2026-09-27'
description: 뉴스 키워드를 받아 AI가 방 개설안을 제안하는 자동 이슈 방 생성 기능을 만들고 5개로 흩어진 관리자 페이지를 홈 하나로 정리하며 리뉴얼을 마무리한 기록
tags:
  - Claude API
  - Next.js
  - 서비스 기획
  - 관리자 도구
  - 리뉴얼
---

## 5편에 걸친 리뉴얼, 마지막 순서

1편에서 컨셉과 트렌드 점수를, 2~3편에서 AI 요약과 공유 카드를, 4편에서 성장 기능들을 다뤘다. 지시서의 1~2단계(핵심 리뉴얼 + 성장 기능)는 여기까지고, 마지막으로 손댄 건 3단계 "고도화" 중 하나인 **자동 이슈 방 생성**과, 작업하면서 하나씩 늘어나 어느새 5개가 된 관리자 페이지를 정리하는 일이었다.

## Step 1: 뉴스 제목 하나로 방 개설안 뽑기

노가리는 초기 사용자가 적으면 방이 텅 비어 보이는 문제가 있다. 지시서는 이걸 완화하려고 "운영자가 뉴스 제목이나 키워드를 넣으면 AI가 방 이름·설명·질문을 제안하고, 관리자가 확인 후 개설"하는 흐름을 요구했다.

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

이걸 2단계 API로 나눴다. 1단계는 "제안만 받기", 2단계는 "관리자가 확인한 내용으로 실제 개설"이다.

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

여기서 흥미로운 재사용이 하나 있었다. 중복 검사에 쓰인 `checkTopicSimilarity`는 원래 **일반 사용자가 방을 제안할 때** 기존 방과 겹치는지 확인하려고 만든 함수였다. 이슈 방 생성도 결국 "새 방을 만들기 전에 중복인지 확인한다"는 같은 문제였기 때문에, 새로 짜지 않고 그대로 가져다 썼다. 관리자용 폼에는 유사 방이 있으면 "기존 방으로 이동" 링크와 함께 경고를 띄우되, 최종 판단은 관리자에게 맡겼다.

일반 방 제안과 다른 점은 `required_votes: 0`, `status: "ACTIVE"`다. 일반 사용자 제안은 동의를 받아야 열리지만, 운영자가 직접 만드는 공식 방은 동의 절차 없이 즉시 열린다. 같은 `topics` 테이블을 쓰면서도 **누가 만드느냐에 따라 개설 절차가 다르다**는 걸 이 두 필드로 구분한 셈이다.

## Step 2: AI 생성 기능 3개를 관통하는 한 가지 원칙

이번 리뉴얼에서 AI를 부른 곳이 세 군데였다 — 댓글 요약(2편), 오늘의 질문(4편), 그리고 이 이슈 방 생성. 셋 다 지키려고 한 원칙은 하나로 수렴했다.

> **AI는 초안을 만들고, 최종 승인은 항상 사람이 한다.**

이슈 방 생성 폼도 "생성" 버튼과 "개설" 버튼을 분리했다. AI가 만든 이름·설명·유형·질문 3개를 화면에 뿌려주고, 관리자가 이 값들을 자유롭게 고칠 수 있는 입력창으로 바꿔둔 다음에야 개설 버튼이 눌린다.

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

완전 자동화가 더 화려해 보일 수 있지만, 명예훼손이나 허위사실이 섞인 방 이름이 그대로 나갈 위험을 생각하면 이 정도 마찰은 반드시 필요한 안전장치라고 판단했다.

## Step 3: 관리자 페이지가 5개가 됐다, 정리할 시간

리뉴얼을 진행하면서 관리자 페이지가 자연스럽게 늘었다. 신고 관리는 원래 있었고, 여기에 노가리방 관리, 운영 설정, SNS 콘텐츠, 이슈 방 만들기가 하나씩 추가됐다. 문제는 페이지 이동 방법이 **페이지마다 제각각 손으로 넣은 밑줄 링크**였다는 거다.

```tsx
// 신고 관리 페이지
<Link href="/admin/topics">노가리방 정보 수정</Link>
<Link href="/admin/settings">운영 설정</Link>

// 노가리방 관리 페이지
<Link href="/admin/reports">신고 관리로 이동</Link>
<Link href="/admin/settings">운영 설정</Link>
```

새 페이지가 생길 때마다 기존 페이지 4곳에 링크를 빠짐없이 추가해야 하는 구조였다. 실제로 SNS 콘텐츠 페이지를 추가했을 때 링크 하나를 깜빡한 적도 있었다. 그래서 공통 셸 컴포넌트 하나로 묶었다.

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

이제 새 관리자 페이지를 추가할 때 `ADMIN_MENU` 배열에 한 줄만 넣으면 기존 5개 페이지 전부에 자동으로 메뉴가 반영된다. 그리고 `/admin`을 아예 없던 랜딩 페이지로 새로 만들어서, 미처리 신고 수·활성 방 수·24시간 댓글 수 같은 운영 현황을 숫자 타일로 보여주고 각 메뉴로 들어가는 카드를 배치했다.

```tsx
const stats = [
  { label: "미처리 신고", value: openReports.count, href: "/admin/reports", alert: openReports.count > 0 },
  { label: "활성 노가리방", value: activeTopics.count, href: "/admin/topics" },
  { label: "개설 대기 제안", value: pendingTopics.count, href: "/proposals" },
  { label: "24시간 댓글", value: comments24h.count, href: "/" },
];
```

미처리 신고가 하나라도 있으면 숫자를 빨간색으로 강조했다. 관리자가 로그인해서 제일 먼저 보는 화면이 "지금 뭘 봐야 하는지"를 바로 알려주는 대시보드가 된 셈이다.

## 리뉴얼을 돌아보며

다섯 편에 걸쳐 정리한 작업을 한 줄로 요약하면, **"사람이 직접 방을 만들고 채워야 하는 커뮤니티"에서 "실시간으로 뭐가 핫한지 보여주고, 그 위에 AI가 보조하되 사람이 최종 승인하는 플랫폼"으로 옮겨간 것**이다.

작업하면서 반복해서 확인한 원칙 세 가지를 정리하면 이렇다.

1. **AI는 초안, 승인은 사람.** 요약·질문·이슈 방 생성 셋 다 AI 호출과 최종 반영 사이에 사람이 확인하는 단계를 뒀다.
2. **가중치·기준값은 코드가 아니라 설정으로.** 트렌드 점수 가중치, 방 개설 기준(동의 인원·시간)을 하드코딩하지 않고 관리자 화면에서 바로 조정할 수 있게 했다. 정답을 미리 알 수 없는 값은 배포 후 튜닝이 가능해야 한다.
3. **실패를 전제로 설계한다.** AI 호출 실패 시 이전 캐시로 폴백, 외부 이미지 fetch 실패 시 사진 없는 레이아웃으로 폴백 — 외부 의존성이 있는 모든 지점에 "실패해도 전체가 안 죽는" 경로를 만들었다.

작업지시서 한 장으로 시작해서 데이터베이스 마이그레이션 5개, 새 페이지 여러 개, 관리자 도구까지 이어진 리뉴얼이었다. 다음은 이번에 미룬 3단계 항목들 — 브라우저 푸시 알림이나 방별 감정 추세 같은 것들을 스펙부터 다시 잡는 일이 남아있다.

## 시리즈 전체 정리

| 편 | 주제 |
|---|---|
| 1편 | 메인 컨셉 리뉴얼, 트렌드 점수 v2 산식 |
| 2편 | AI 댓글 요약, 캐싱 전략, 댓글 정렬 4종 |
| 3편 | satori OG 이미지 500 에러 트러블슈팅 |
| 4편 | localStorage 기반 관심 방, 관련 방 추천, 오늘의 질문, SNS 콘텐츠 |
| 5편 | 자동 이슈 방 생성, 관리자 홈 정리 |
