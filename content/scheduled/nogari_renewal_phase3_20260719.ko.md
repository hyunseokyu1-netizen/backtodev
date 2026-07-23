---
title: '노가리 리뉴얼 (3/5) — Next.js OG 이미지가 숫자 하나 때문에 500을 뱉었다'
date: '2026-07-19'
publish_date: '2026-09-25'
description: satori 기반 next/og ImageResponse에서 숫자·이모지 자식이 알 수 없는 500 에러를 내던 문제를 이분 탐색으로 잡은 트러블슈팅 기록
tags:
  - Next.js
  - satori
  - OG 이미지
  - 디버깅
  - Vercel
---

## 댓글을 이미지로 공유하는 기능, 그리고 뜬금없는 500

노가리는 댓글에 공감을 많이 받으면 그걸 캡처해서 카카오톡이나 인스타그램 스토리에 공유하고 싶어지는 서비스다. 그래서 댓글마다 공유 버튼을 달고, 누르면 로고·방 이름·닉네임·댓글·공감 수가 들어간 정사각형 이미지 카드를 만들어주는 기능을 붙였다. Next.js의 `ImageResponse`(내부적으로 [satori](https://github.com/vercel/satori)를 씀)를 쓰면 JSX로 이미지를 그릴 수 있어서 어렵지 않아 보였다.

관리자용 "오늘의 TOP 5" SNS 카드까지 같은 방식으로 만들고 배포했는데, 실제로 눌러보니 **500 에러**가 떴다. 로컬에서도 똑같이 재현됐다.

```
GET /api/admin/sns-card?format=square 500 in 947ms
⨯ Error: failed to pipe response
  [cause]: Error: Expected <div> to have explicit "display: flex",
  "display: contents", or "display: none" if it has more than one child node.
```

에러 메시지는 명확해 보였다 — "자식이 여러 개면 display를 명시하라"는 거니까. 그런데 문제는, **내 코드의 모든 `<div>`에는 이미 `display: flex`가 다 붙어 있었다.** 어느 div가 문제인지 에러가 알려주지 않아서, 여기서부터 진짜 디버깅이 시작됐다.

## Step 1: 로컬에서 재현 환경부터 만들기

배포 로그만 보고는 원인을 못 찾을 것 같아서, 로컬 dev 서버를 띄우고 관리자 인증까지 통과시켜서 직접 curl로 찔러보기로 했다.

```bash
npx next dev -p 3457 > dev.log 2>&1 &

# 관리자 로그인 → 쿠키 저장
curl -s -c cookies.txt -X POST http://localhost:3457/api/admin/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$ADMIN_SECRET\"}"

# 실제 엔드포인트 호출
curl -s -b cookies.txt -o card.png -w "%{http_code}\n" \
  "http://localhost:3457/api/admin/sns-card?format=square"
```

이러면 `dev.log`에 satori가 던지는 에러 스택이 그대로 남는다. 배포 환경보다 훨씬 빠르게 반복 테스트를 할 수 있는 환경을 갖춘 것부터가 절반이었다.

## Step 2: JSX를 절반으로 쪼개며 이분 탐색

에러가 "몇 번째 div"인지 안 알려주니, 직접 찾아야 했다. 방법은 단순했다. **JSX를 최소한으로 줄여서 200이 뜨는지 확인하고, 조금씩 다시 붙여나가는 이분 탐색.**

먼저 껍데기만 남겼다.

```tsx
return new ImageResponse(
  <div style={{ width: "100%", height: "100%", display: "flex", background: "#F4F3F1" }}>
    <div style={{ fontSize: 64 }}>{headline}</div>
  </div>
);
```

→ **200.** 문제는 이 아래 어딘가다.

헤더 영역(로고 + 날짜 + 제목)을 다시 붙였다.

→ **200.** 여기도 문제 없음.

TOP 5 목록 반복 렌더링 부분을 붙였다.

```tsx
{items.map((item) => (
  <div key={item.rank} style={{ display: "flex", ... }}>
    <div style={{ fontSize: 52, width: 56 }}>{item.rank}</div>
    <div style={{ fontSize: 46, flexGrow: 1 }}>{item.title}</div>
    <div style={{ fontSize: 32, color: "#6B6862" }}>{`댓글 ${item.count}`}</div>
    <div style={{ fontSize: 34, color: "#D9480F" }}>{`🔥${item.flame}`}</div>
  </div>
))}
```

→ **500.** 범인은 여기 안에 있다.

이제 이 네 개 자식 중 어느 걸 빼면 되는지 하나씩 지웠다. `item.title` 하나만 남겼을 땐 통과, `item.rank`를 되살리자마자 다시 500이 떴다.

```tsx
<div style={{ fontSize: 52, width: 56 }}>{item.rank}</div>
```

`item.rank`는 `i + 1`로 만든 **숫자**였다. 문자열로 바꿔봤다.

```ts
const items = topics.map((t, i) => ({
  rank: String(i + 1),  // 숫자 → 문자열
  ...
}));
```

→ **200.** 찾았다.

## 원인: satori는 "자식 하나 = 문자열 하나"만 좋아한다

satori는 React 요소를 SVG로 그리는 라이브러리인데, div의 자식(children)을 셀 때 **문자열 리터럴 하나가 아니면 여러 노드로 취급하는** 특성이 있다. 그래서 이런 것들이 다 지뢰였다.

```tsx
{/* 숫자 타입 자식 — 지뢰 */}
<div>{item.rank}</div>          // rank: number

{/* 텍스트 + 표현식 혼합 — 지뢰 (JSX가 자식을 ["댓글 ", count] 두 개로 쪼갬) */}
<div>댓글 {item.count}</div>

{/* 이모지 포함 텍스트 — 자식은 문자열 1개인데도 지뢰가 될 수 있음 */}
<div>🔥 {item.flame}</div>
```

이모지는 satori 내부적으로 별도 이미지 노드로 렌더링될 수 있어서, "문자열 하나"처럼 보여도 실제로는 텍스트와 이모지가 분리된 자식 취급을 받는 경우가 있었다. 그래서 숫자는 전부 문자열로 미리 변환하고, 텍스트+변수 조합은 템플릿 리터럴로 하나의 문자열로 합치고, 이모지가 들어간 div에는 명시적으로 `display: "flex"`를 한 번 더 박아뒀다.

```tsx
const items = topics.map((t, i) => ({
  rank: `${i + 1}`,
  title: t.title.length > 14 ? `${t.title.slice(0, 14)}…` : t.title,
  count: `댓글 ${t.comment_24h_count ?? 0}`,      // 템플릿 리터럴로 통일
  flame: `🔥 ${Math.max(0, Math.round(t.trending_score ?? 0))}`,
}));

// JSX에서는 항상 변수 하나만 그대로 출력
<div style={{ fontSize: 52, width: 56 }}>{item.rank}</div>
<div style={{ fontSize: 32, color: "#6B6862" }}>{item.count}</div>
<div style={{ display: "flex", fontSize: 34, color: "#D9480F" }}>{item.flame}</div>
```

댓글 공유 카드 쪽에도 같은 패턴이 숨어 있었다. `“{content}”`처럼 따옴표와 변수를 나란히 쓴 부분, `👍 {likeLabel}`처럼 이모지와 변수를 섞은 부분을 전부 템플릿 리터럴로 바꾸고 나서야 두 카드(정사각형/스토리형)와 댓글 카드 전부 200으로 돌아왔다.

## Step 3: 폰트 서브셋에도 숫자를 잊지 않기

하나 더 짚을 점. 노가리는 한글 폰트를 통째로 들고 다니지 않고, Google Fonts의 `text=` 파라미터로 실제 화면에 쓰는 글자만 서브셋으로 받아온다.

```ts
export async function loadKoreanFont(text: string): Promise<ArrayBuffer> {
  const unique = Array.from(new Set(text)).join("");
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@700&text=${encodeURIComponent(unique)}`,
  );
  ...
}
```

이 방식은 폰트 파일을 가볍게 유지해주지만, **서브셋 문자열에 실제로 화면에 그릴 글자를 전부 포함시켜야 한다**는 책임이 따라온다. TOP 5 카드는 순위 숫자, 댓글 수, 불꽃 지수처럼 숫자가 잔뜩 나오는데, 이걸 서브셋 소스 문자열에 빼먹으면 숫자만 네모(tofu)로 깨진다.

```ts
const font = await loadKoreanFont(
  headline + dateLabel + urlLabel +
  "노가리댓글 0123456789…" +   // 숫자·특수문자 글리프를 명시적으로 포함
  items.map((i) => i.title).join(""),
);
```

## 정리

| 증상 | 원인 | 해결 |
|---|---|---|
| `display: flex` 관련 500, 어느 div인지 안 알려줌 | satori가 숫자/혼합 텍스트 자식을 여러 노드로 취급 | 이분 탐색으로 JSX를 반씩 줄이며 재현 범위를 좁힘 |
| `{item.rank}` (숫자) | 숫자 타입 자식은 문자열 하나로 안 쳐줌 | `${i + 1}`로 미리 문자열화 |
| `댓글 {count}` | 텍스트+표현식이 자식 2개로 쪼개짐 | 템플릿 리터럴로 통일: `` `댓글 ${count}` `` |
| `🔥 {flame}` | 이모지가 별도 노드로 렌더링될 수 있음 | 템플릿 리터럴 + 이모지 div에 `display: flex` 명시 |
| 숫자가 네모로 깨짐 | 폰트 서브셋에 숫자 글리프 누락 | 서브셋 소스 문자열에 `0123456789` 등 명시적으로 포함 |

이번 트러블슈팅에서 가장 값졌던 건 원인 자체보다 **접근 방식**이었다. 에러 메시지가 위치를 안 알려줄 때, 배포 로그만 들여다보며 추측하기보다 로컬에서 재현 커맨드를 만들고 JSX를 반씩 쪼개며 좁혀가는 게 훨씬 빨랐다. 이 방식은 satori뿐 아니라 "에러는 뜨는데 위치를 모르겠는" 대부분의 렌더링 버그에 그대로 써먹을 수 있다.

다음 편은 관심 방 저장, 최근 방문, 오늘의 질문처럼 로그인 없는 서비스에서 "다시 방문할 이유"를 만드는 성장 기능들 이야기다.
