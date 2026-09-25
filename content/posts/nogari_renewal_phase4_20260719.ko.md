---
title: '노가리 리뉴얼 (4/5) — 로그인 없는 서비스에서 "다시 오고 싶게" 만들기'
date: '2026-07-19'
publish_date: '2026-09-26'
description: 회원가입 없는 익명 커뮤니티에서 localStorage로 관심 방과 최근 방문을 기록하고 관련 방 추천, 오늘의 질문, SNS 콘텐츠 생성까지 붙인 성장 기능 모음
tags:
  - Next.js
  - localStorage
  - Claude API
  - next/og
  - 리텐션
---

## 로그인이 없는데 "다시 방문할 이유"를 어떻게 만들지

노가리는 회원가입도 로그인도 없다. 이게 진입 장벽을 낮추는 핵심 장점이지만, 동시에 리텐션을 만드는 가장 흔한 방법(로그인 기반 알림, 즐겨찾기, 히스토리)을 못 쓴다는 뜻이기도 하다. 지시서 12장은 이 문제를 정면으로 다뤘다.

> 로그인 없이도 브라우저 기준으로 다음 기능을 제공한다: 최근 방문한 방, 최근 댓글을 남긴 방, 내가 공감한 댓글, 관심 방 저장, 새 댓글 표시

이번 편은 이 "2단계: 성장 기능"에서 실제로 만든 기능들 — 관심 방 저장, 관련 방 추천, 오늘의 질문, 헤더 검색, 그리고 운영자가 SNS에 뿌릴 콘텐츠를 만드는 도구까지 묶어서 정리한다.

## Step 1: 로그인 없는 "내 방 목록" — localStorage

관심 방 저장과 최근 방문 기록은 서버에 유저를 특정할 방법이 없으니 브라우저(localStorage)에 저장하기로 했다. 작은 유틸리티 모듈 하나로 시작했다.

```ts
// src/lib/local-rooms.ts
export interface StoredRoom {
  id: string;
  title: string;
  visitedAt: number;
}

const RECENT_KEY = "nogari_recent_rooms";
const FAVORITE_KEY = "nogari_favorite_rooms";

function read(key: string): StoredRoom[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // 프라이빗 모드·용량 초과는 조용히 무시
  }
}

export function recordVisit(id: string, title: string): void {
  const rooms = read(RECENT_KEY).filter((r) => r.id !== id);
  rooms.unshift({ id, title, visitedAt: Date.now() });
  write(RECENT_KEY, rooms.slice(0, 10));
}

export function toggleFavorite(id: string, title: string): boolean {
  const rooms = read(FAVORITE_KEY);
  const exists = rooms.some((r) => r.id === id);
  if (exists) {
    write(FAVORITE_KEY, rooms.filter((r) => r.id !== id));
    return false;
  }
  rooms.unshift({ id, title, visitedAt: Date.now() });
  write(FAVORITE_KEY, rooms.slice(0, 50));
  return true;
}
```

방 상세에 진입하면 방문 기록만 조용히 남기는 컴포넌트를 하나 두고,

```tsx
// src/components/topic/RoomVisitTracker.tsx
export function RoomVisitTracker({ topicId, topicTitle }: Props) {
  useEffect(() => {
    recordVisit(topicId, topicTitle);
  }, [topicId, topicTitle]);
  return null;
}
```

메인 화면 상단에는 저장해둔 관심 방과 최근 방문 방을 칩으로 보여준다.

```tsx
// src/components/dashboard/MyRoomsSection.tsx
useEffect(() => {
  const favs = getFavoriteRooms().slice(0, 8);
  const favIds = new Set(favs.map((r) => r.id));
  setFavorites(favs);
  // 관심 방에 이미 있으면 최근 방문에서 중복 노출 안 함
  setRecents(getRecentRooms().filter((r) => !favIds.has(r.id)).slice(0, 8));
}, []);
```

여기서 신경 쓴 디테일 하나. localStorage는 서버(SSR)에는 없는 값이라, 이 값을 초기 렌더에 바로 반영하면 **서버가 그린 HTML과 클라이언트가 그린 HTML이 달라서 hydration 경고**가 뜬다. 그래서 항상 마운트 후 `useEffect` 안에서 읽어오고, 서버 렌더 시점엔 빈 배열로 시작한다. 컴포넌트 자체를 아예 `"use client"`로 선언해서 이 값에 의존하는 UI는 클라이언트에서만 결정되게 만든 것도 같은 이유다.

## Step 2: 관련 방 추천 — 이미 있는 트렌드 뷰를 재활용

방 상세 하단에 "이런 노가리방은 어때요?" 섹션을 넣었다. 여기서 새로운 집계 로직을 또 만들지 않고, 1편에서 만든 `v_trending_topics` 뷰를 그대로 재사용했다.

```ts
async function getRelatedTopics(topicId: string, topicType: TopicType) {
  const { data } = await supabase
    .from("v_trending_topics")
    .select("id, title, image_url, comment_24h_count")
    .in("topic_type", dbTypes)
    .neq("id", topicId)
    .order("trending_score", { ascending: false })
    .limit(5);
  return data ?? [];
}
```

"같은 유형(인물/브랜드/사건 등) 중 지금 가장 활발한 방 5개"라는 기준이면 충분했다. 새 집계 쿼리를 짜는 대신 이미 검증된 뷰에 필터 조건만 얹은 거라, 트렌드 점수 산식이 나중에 또 바뀌어도 관련 방 추천은 자동으로 같이 갱신된다.

## Step 3: 오늘의 질문 — AI가 초안을 만들고, 관리자가 승인

댓글이 없는 방은 첫 댓글을 남기기가 유독 부담스럽다. 그래서 각 방에 대화를 트는 질문 하나를 걸어두는 기능을 넣었다. 여기서도 지시서의 원칙 하나를 그대로 따랐다 — **완전 자동 게시는 하지 않는다.**

```ts
// src/lib/anthropic.ts
export async function generateTodayQuestion(
  topicTitle: string,
  topicDescription: string | null,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    system:
      "... 오늘의 질문 하나를 한국어 존댓말로 작성해라.\n" +
      "규칙: 1문장, 60자 이내, 물음표로 끝나기, 찬반이나 경험담이 갈릴 만한 " +
      "구체적 질문으로. 명예훼손·허위사실을 전제하는 질문 금지.",
    messages: [{ role: "user", content: `방 주제: ${topicTitle}\n설명: ${topicDescription || "(없음)"}` }],
  });
  return textBlock.text.trim();
}
```

관리자 화면(`/admin/topics`)에서 방을 검색하면 "AI 생성" 버튼이 뜨고, 누르면 질문 후보가 입력창에 채워진다. 그 상태에서 관리자가 수정하거나 그대로 저장할 수 있다. **생성과 게시를 한 버튼으로 묶지 않은 것**이 포인트다. AI가 만든 질문이 맥락에 안 맞거나 어색할 수 있으니, 사람이 한 번 보고 넘기는 단계를 항상 끼워뒀다.

## Step 4: SNS 콘텐츠도 같은 원칙 — 자동 게시 없음

운영자가 오늘의 TOP 5나 가장 뜨거운 댓글을 SNS에 올리고 싶을 때, 매번 수동으로 캡처하고 다듬는 건 번거롭다. 그래서 `/admin/sns` 페이지 하나로 텍스트와 이미지를 자동 생성하게 했다.

```tsx
const top5Text =
  `🔥 오늘의 노가리 TOP 5 (${dateLabel})\n\n` +
  topTopics.map((t, i) => `${i + 1}. ${t.title} — 24시간 댓글 ${t.comment_24h_count}개`).join("\n") +
  `\n\n지금 반응 보러 가기 👉 https://nogari.org`;
```

이미지는 3편에서 다룬 satori 함정을 다 피해서 정사각형(피드용)과 세로형(스토리용) 두 포맷으로 뽑는다.

```
GET /api/admin/sns-card?format=square   → 1080×1080
GET /api/admin/sns-card?format=story    → 1080×1920
```

여기서도 원칙은 동일하다. **생성은 자동, 게시는 사람.** 텍스트는 복사 버튼, 이미지는 다운로드 링크만 제공하고, 실제로 트위터나 인스타그램에 올리는 건 관리자가 직접 한다. AI/자동화가 만든 콘텐츠가 검토 없이 바로 외부로 나가는 파이프라인은 만들지 않았다.

## Step 5: 헤더 검색은 왜 처음부터 안 넣었나

전역 검색은 원래 메인 화면의 "노가리방" 탭 안에만 있었다. 이번에 헤더에서도 검색할 수 있게 진입점을 하나 더 뺐는데, 실제 검색 로직은 새로 안 만들고 기존 화면으로 라우팅만 시켰다.

```tsx
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const trimmed = query.trim();
  if (!trimmed) return;
  trackEvent("search_submit", { query_length: trimmed.length });
  router.push(`/?tab=browse&q=${encodeURIComponent(trimmed)}`);
}
```

새 검색 엔진을 만들지 않고 기존 화면의 쿼리스트링 규약(`?tab=browse&q=`)에 얹기만 한 이유는, 검색 결과 정렬·필터링 로직이 이미 그 화면에 다 있었기 때문이다. 같은 기능을 두 군데 유지보수하는 것보다, 진입점만 늘리는 게 훨씬 안전했다.

## 정리

| 기능 | 저장/처리 위치 | 핵심 원칙 |
|---|---|---|
| 관심 방 / 최근 방문 | localStorage | 마운트 후에만 읽어서 hydration 불일치 방지 |
| 관련 방 추천 | 기존 트렌드 뷰 재사용 | 새 집계 로직을 안 만들고 필터만 얹음 |
| 오늘의 질문 | Haiku 생성 + 관리자 저장 | AI는 초안만, 게시는 사람이 승인 |
| SNS 콘텐츠 | 텍스트/이미지 자동 생성 | 생성은 자동, 외부 게시는 항상 수동 |
| 헤더 검색 | 기존 검색 화면으로 라우팅 | 로직 중복 없이 진입점만 추가 |

다음 마지막 편은 뉴스 키워드 하나로 방을 자동 개설하는 "이슈 방 생성" 기능과, 여기저기 흩어져 있던 관리자 페이지를 하나의 홈으로 정리한 이야기다.
