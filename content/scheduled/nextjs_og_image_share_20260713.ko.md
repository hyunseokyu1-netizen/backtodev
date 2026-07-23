---
title: 'Next.js 동적 OG 이미지 만들기 — 한글 폰트 서브셋 트릭과 Satori의 함정'
date: '2026-07-13'
publish_date: '2026-08-24'
description: 링크 공유가 예뻐야 사람이 들어온다 — ImageResponse로 페이지별 OG 이미지를 만들고, 수 MB 한글 폰트 문제를 Google Fonts text= 서브셋으로 푸는 방법
tags:
  - Next.js
  - OG 이미지
  - ImageResponse
  - Web Share API
  - Satori
---

사이드 프로젝트에 커스텀 도메인을 연결하고 나니 다음 고민이 생겼습니다. **이제 링크를 어디에 공유하지?** 그런데 공유를 하려고 보니 더 근본적인 문제가 있었어요. 카카오톡에 링크를 붙여넣으면 아무 이미지도 없는 밋밋한 미리보기가 떴습니다.

커뮤니티 서비스는 링크 공유가 곧 유입 통로입니다. "이 방에서 익명으로 까면 됨" 하고 링크를 던졌을 때, 방 이름이 큼직하게 박힌 카드가 뜨는 것과 회색 빈 카드가 뜨는 것은 클릭률이 완전히 다릅니다. 그래서 오늘은 **페이지마다 다른 OG 이미지를 동적으로 생성**하는 작업을 했고, 그 과정에서 만난 한글 폰트 문제와 Satori 렌더러의 함정을 정리합니다.

## OG 이미지가 뭐길래

`og:image`는 링크를 공유했을 때 카카오톡·트위터·슬랙 등이 보여주는 미리보기 이미지입니다. 정적 사이트라면 이미지 한 장 만들어서 메타태그에 박으면 끝인데, 제 서비스는 **게시판(방)이 유저에 의해 계속 생겨나는 구조**라 방마다 다른 이미지가 필요했습니다. "스탠리 텀블러" 방을 공유하면 스탠리 텀블러라고 적힌 카드가 떠야죠.

Next.js는 이걸 파일 컨벤션 하나로 해결합니다. 라우트 폴더에 `opengraph-image.tsx`를 두면, 해당 경로의 OG 이미지가 **요청 시점에 JSX → PNG로 렌더링**됩니다.

## Step 1 — 루트 메타데이터 정비

이미지 전에 기본기부터. 루트 레이아웃의 `metadata`에 `metadataBase`와 타이틀 템플릿을 설정합니다:

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://nogari.org"),  // 상대 URL의 기준
  title: {
    default: "노가리 — 익명 커뮤니티",
    template: "%s | 노가리",   // 하위 페이지 title이 자동으로 "○○ | 노가리"
  },
  openGraph: { siteName: "노가리", type: "website", locale: "ko_KR" },
  twitter: { card: "summary_large_image" },
};
```

`metadataBase`를 설정하면 OG 이미지 URL이 상대 경로여도 절대 URL로 완성됩니다. 이거 없이 배포하면 미리보기가 안 뜨는 원인 1순위입니다.

## Step 2 — 동적 라우트의 메타데이터: generateMetadata

방 상세 페이지(`app/topics/[id]/page.tsx`)는 방마다 제목·설명이 달라야 하니 `generateMetadata`를 씁니다:

```tsx
export async function generateMetadata({ params }) {
  const { id } = await params;          // Next.js 16: params는 Promise
  const topic = await getTopic(id);
  if (!topic) return { title: "노가리방" };

  const title = `${topic.title} 노가리방`;
  const description = topic.description ??
    `${topic.title}에 대해 익명으로 노가리 까는 방. 가입 없이 바로 참여하세요.`;

  return { title, description, openGraph: { title, description } };
}
```

이제 링크를 붙이면 "스탠리 텀블러 노가리방 — 요즘 다 이거 들고 다니던데"가 미리보기 텍스트로 뜹니다.

## Step 3 — ImageResponse로 이미지 그리기

같은 폴더에 `opengraph-image.tsx`를 만들고, `next/og`의 `ImageResponse`에 JSX를 넘기면 PNG가 됩니다. DB에서 방 정보를 읽어와 그대로 캔버스에 얹을 수 있습니다:

```tsx
// app/topics/[id]/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }) {
  const { id } = await params;
  const topic = await getTopic(id);   // Supabase에서 방 이름·유형 조회
  const title = topic?.title ?? "노가리방";

  return new ImageResponse(
    (
      <div style={{ /* 배경·테두리·패딩 — 브랜드 스타일 */ }}>
        <div style={{ fontSize: title.length > 12 ? 72 : 96 }}>{title}</div>
        {/* 로고 SVG, 유형 태그, 도메인 라벨... */}
      </div>
    ),
    { ...size, fonts: [{ name: "IBMPlexSansKR", data: font, weight: 700 }] },
  );
}
```

포인트 몇 가지:

- 렌더러는 브라우저가 아니라 **Satori**라는 별도 엔진입니다. CSS 부분집합만 지원해요 (뒤에서 함정 소개)
- 제목 길이에 따라 폰트 크기를 조건부로 줄이면 긴 방 이름도 안 잘립니다
- 브랜드 SVG 로고는 JSX 안에 인라인으로 넣으면 그대로 렌더됩니다

## Step 4 — 한글 폰트 문제: text= 서브셋 트릭

여기가 오늘의 하이라이트입니다. `ImageResponse`는 폰트 데이터를 직접 넘겨야 하는데, **한글 폰트는 글리프가 1만 자가 넘어서 TTF 하나가 수 MB**입니다. 리포에 넣자니 무겁고, 매 렌더마다 통째로 로드하자니 느립니다.

해결책은 Google Fonts css2 API의 `text=` 파라미터입니다. **지정한 글자만 담은 서브셋 폰트**를 만들어 줍니다:

```ts
export async function loadKoreanFont(text: string): Promise<ArrayBuffer> {
  const unique = Array.from(new Set(text)).join("");   // 중복 글자 제거
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@700&text=${encodeURIComponent(unique)}`,
  );
  const css = await cssRes.text();
  const url = css.match(/src:\s*url\((.+?)\)/)?.[1];   // css 안의 실제 폰트 URL
  const fontRes = await fetch(url!);
  return fontRes.arrayBuffer();
}
```

동작 원리:

1. 이미지에 들어갈 텍스트(방 이름 + 고정 문구)를 모아서 중복 글자를 제거
2. `text=` 파라미터로 css2 API 호출 → 그 글자들만 담은 폰트를 가리키는 CSS 반환
3. CSS에서 폰트 URL을 정규식으로 뽑아 다운로드

이러면 폰트 데이터가 수 MB → **수 KB**로 줄어듭니다. 참고로 fetch에 브라우저 User-Agent를 안 붙이면 Google이 woff2 대신 Satori가 읽을 수 있는 TTF를 반환하는 것도 이 방식의 숨은 장점입니다.

## Step 5 — 공유 버튼: Web Share API + 클립보드 폴백

이미지가 예뻐졌으니 공유 진입점도 만들어야죠. 방 타이틀 바에 "공유" 버튼을 달았습니다:

```tsx
"use client";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {                    // 모바일: 시스템 공유 시트
      try { await navigator.share({ title, url }); } catch { /* 취소 */ }
      return;
    }
    await navigator.clipboard.writeText(url); // 데스크톱: 클립보드 복사
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={handleShare}>{copied ? "복사됨!" : "공유"}</button>
  );
}
```

- 모바일(iOS/안드로이드)은 `navigator.share`가 있어서 카톡·메시지 등 시스템 공유 시트가 열립니다
- 데스크톱 브라우저 대부분은 미지원이라 클립보드 복사 + "복사됨!" 2초 표시로 폴백
- `navigator.share`의 reject는 대부분 "사용자가 시트를 닫음"이라 조용히 무시하는 게 맞습니다

Playwright로 두 경로를 다 테스트했는데, 폴백 경로는 `page.addInitScript`로 `navigator.share`를 `undefined`로 덮어쓰면 데스크톱 환경을 강제할 수 있습니다.

## Step 6 — 응용: "아직 열리지 않은 페이지"를 공유 무기로

이 인프라의 진짜 재미는 응용에서 나왔습니다. 제 서비스는 게시판(방)이 유저 30명의 동의로 개설되는 구조인데, **개설 대기중인 방이야말로 공유가 필요한 순간**입니다. "이 방 만들고 싶은데 같이 동의해줘"를 친구에게 보내야 하니까요.

그래서 대기중인 방에는 OG 이미지와 랜딩을 다르게 만들었습니다:

- OG 카드의 태그 pill이 "물건 노가리방" 대신 **"개설 대기중 · 3/30명 동의"**, 서브 카피는 "함께 동의하면 방이 열려요"
- 링크를 타고 온 사람은 안내 페이지가 아니라 **그 자리에서 바로 동의할 수 있는 랜딩**에 떨어집니다

같은 `opengraph-image.tsx`에서 DB의 `status`와 `votes_count`만 분기하면 됩니다. 공유 카드가 "구경 와라"가 아니라 **"행동해 달라"는 요청장**이 되는 거죠. 동적 OG의 가치는 예쁜 미리보기가 아니라, 페이지 상태에 맞는 메시지를 링크에 실어 보내는 데 있다는 걸 이 작업에서 배웠습니다.

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| OG 이미지 500 에러: `Expected <div> to have explicit "display: flex"` | Satori는 자식이 2개 이상인 div에 flex 명시를 요구. `{typeLabel} 노가리방`처럼 **표현식+텍스트 혼합도 자식 2개로 취급** | 템플릿 리터럴로 합치기: `` {`${typeLabel} 노가리방`} `` |
| 한글이 □□□로 렌더 | 폰트 데이터에 해당 글리프 없음 | `text=` 서브셋에 렌더링할 모든 텍스트를 포함했는지 확인 |
| 배포 후 미리보기 안 뜸 | `metadataBase` 미설정으로 이미지 URL이 상대 경로 | 루트 metadata에 `metadataBase` 추가 |
| 공유 시 이전 이미지가 계속 뜸 | 카카오·트위터가 OG를 캐시 | 카카오 공유 디버거에서 캐시 초기화 |

특히 첫 번째가 악랄합니다. JSX에서 `{variable} 텍스트`는 눈에는 한 덩어리로 보이지만 Satori에게는 자식 노드 2개입니다. 에러 메시지만 봐서는 원인을 특정하기 어려워서, dev 서버 로그를 보고서야 잡았습니다.

## 정리

1. **루트 metadata** — `metadataBase` + 타이틀 템플릿 + OG/트위터 기본값
2. **동적 라우트** — `generateMetadata`로 페이지별 title/description
3. **`opengraph-image.tsx`** — 파일 컨벤션만으로 요청 시점 PNG 생성, DB 조회도 가능
4. **한글 폰트** — Google Fonts `text=` 서브셋으로 수 MB → 수 KB
5. **Satori 주의** — 다중 자식 div는 flex 명시, 표현식+텍스트 혼합도 다중 자식
6. **공유 버튼** — `navigator.share` 우선, 클립보드 폴백
7. **상태별 OG 분기** — 같은 라우트라도 페이지 상태(개설 대기중 등)에 맞는 카드로

링크 하나 예쁘게 만드는 데 이렇게까지 하나 싶지만, 커뮤니티 서비스에서 공유 카드는 사실상 첫 화면입니다. 방문자가 사이트에 오기 전에 보는 유일한 UI니까요.
