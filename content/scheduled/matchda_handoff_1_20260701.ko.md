---
title: '디자인 핸드오프를 진짜 제품으로 (1) — HTML 레퍼런스를 Next.js로 재현하기'
date: '2026-07-01'
publish_date: '2026-07-20'
description: 커스텀 런타임으로 만든 .dc.html 디자인 핸드오프를 기존 Next.js 코드베이스의 토큰·i18n·폰트·컴포넌트로 픽셀에 가깝게 재현한 기록
tags:
  - Next.js
  - Tailwind CSS
  - i18n
  - TypeScript
---

디자이너에게 "핸드오프"를 받았습니다. 그런데 익숙한 Figma 링크가 아니라 `MatchDa.dc.html` 이라는 HTML 파일 하나였습니다. 열어보니 커스텀 런타임(`sc-if`로 화면 전환, `renderVals()`로 로직 노출)으로 만든 **고해상도 프로토타입**이더군요. 색·간격·인터랙션이 픽셀 단위로 확정된, 말하자면 "보이는 명세서"였습니다.

문제는 명확했습니다. **이 HTML을 그대로 복붙해서 출시할 수는 없다**는 것. 런타임이 다르고, 우리 프로젝트는 이미 Next.js + Tailwind 스택을 쓰고 있으니까요. 목표는 하나였습니다 — **외관과 동작만 참고해서, 우리 코드베이스의 패턴으로 다시 짓기.**

이 시리즈는 그 4단계 여정(① 재현 → ② 실데이터 연결 → ③ CTA·검색 연결 → ④ AI 최적화)을 정리한 기록입니다. 1편은 가장 기본, **핸드오프를 코드로 옮기는 일**입니다.

## 사전 준비 — 스택부터 파악

남의 코드(혹은 디자인)를 옮길 때 제일 먼저 하는 건 "이 집에 이미 뭐가 있나" 확인입니다.

- **Next.js 16 App Router + React 19**
- **Tailwind v4** — 설정 파일(`tailwind.config.js`)이 없고 CSS의 `@theme`로 토큰을 잡는 방식
- 폰트는 `next/font/google`
- i18n 라이브러리는 **없음**

명세서(README)는 `IBM Plex Sans KR` 폰트와 정확한 hex/px 값을 요구했습니다. 그대로 따라야 했죠.

## Step 1. 디자인 토큰 — 테마 확장 대신 arbitrary value

색을 다루는 방법은 둘이었습니다.

1. Tailwind 테마에 `--color-primary: #046C4E` 식으로 등록해서 `bg-primary`로 쓰기
2. 그냥 `bg-[#046C4E]` 처럼 **arbitrary value**로 박기

저는 2번을 택했습니다. 이유는 단순합니다 — 명세서가 "이 hex를 **그대로** 쓰라"고 못 박았고, 기존 테마(`background`/`foreground`만 정의됨)를 건드리면 다른 페이지에 영향이 갈 수 있었거든요. 핸드오프 재현 단계에선 **명세와 코드가 1:1로 보이는 게** 디버깅에 훨씬 유리합니다.

```tsx
// README의 hex/px를 그대로 박는다
<div className="rounded-[16px] border border-[#EAECEF] bg-white p-7">
  <div className="flex h-[46px] w-[46px] items-center justify-center
                  rounded-[12px] bg-[#ECFDF3] text-[#046C4E]">
```

장식용 SVG 애니메이션(히어로의 점선 흐름)만 `globals.css`에 `@keyframes`로 빼고, `prefers-reduced-motion`도 걸어줬습니다.

## Step 2. 폰트 — 변수로 노출하고, 필요한 영역에만

`IBM Plex Sans KR`(본문)와 `IBM Plex Mono`(연락처 라인)를 `next/font`로 불러옵니다. 핵심은 **CSS 변수로 노출**해서 원하는 영역에만 적용하는 것.

```tsx
// app/layout.tsx
const plexKr = IBM_Plex_Sans_KR({
  variable: '--font-plex-kr',
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
})
// <html className={`${plexKr.variable} ...`}>
```

그리고 MatchDa 화면 래퍼에서만 그 변수를 폰트로 지정합니다.

```tsx
<div className="font-[family-name:var(--font-plex-kr)] antialiased text-[#111827]">
```

이렇게 하면 기존 페이지(다른 폰트)는 그대로 두고, 새 화면만 IBM Plex를 입힐 수 있습니다.

## Step 3. i18n — 라이브러리 없이, 그러나 분리는 확실히

한국어/영어가 섞이는 UI라 텍스트를 데이터에서 분리해야 했습니다. 라이브러리를 새로 깔기보단 **경량 딕셔너리**로 충분했어요.

```ts
// lib/matchda/i18n.ts
export type Locale = 'ko' | 'en'
const ko = {
  nav: { login: '로그인', signup: '무료로 시작하기' },
  dashboard: {
    greeting: (name: string) => `안녕하세요, ${name}님`,  // ← 함수도 있다
    // ...
  },
}
export function getMatchdaDict(locale: Locale = 'ko') { /* ... */ }
```

여기서 **함정이 하나** 있었는데, 그건 트러블슈팅에서 이야기할게요.

## Step 4. 컴포넌트 분해

화면 3종(랜딩 / 대시보드 / 워크스페이스)을 도메인별로 쪼갰습니다.

```
components/matchda/
  ui/        icons.tsx(인라인 SVG), Logo, MonogramChip, Avatar
  landing/   LandingHeader, SplitHero, FeatureCards, StatsBand, SiteFooter
  dashboard/ Sidebar, Topbar, StatCards, KanbanBoard, JobCard
  workspace/ WorkspaceTopbar, OptimizationBanner, ResumeDocument
lib/matchda/ i18n.ts, types.ts, mock-data.ts
```

아이콘은 `lucide-react`를 새로 깔지 않고, 필요한 12개 정도만 **stroke SVG로 직접** 만들었습니다. 의존성 하나 줄이고, 핸드오프의 도형을 정확히 맞추기에도 좋았어요.

## Step 5. 전역 크롬 격리 — 가장 까다로웠던 부분

기존 루트 레이아웃엔 모든 페이지를 감싸는 **전역 헤더**가 있었습니다. 그런데 새 랜딩/대시보드는 각자 **자기 헤더·사이드바**를 가진 풀블리드 디자인이죠. 그냥 두면 헤더가 두 개 겹칩니다.

루트 레이아웃은 서버 컴포넌트라 `usePathname`을 쓸 수 없으니, 전역 크롬을 **클라이언트 컴포넌트로 추출**했습니다.

```tsx
// components/AppChrome.tsx ('use client')
const pathname = usePathname()
const isMatchda = pathname?.startsWith('/matchda')
if (isMatchda) return <>{children}</>   // 풀블리드 — 전역 헤더 숨김
return (<><header>…전역 헤더…</header><main>{children}</main></>)
```

서버 레이아웃은 유저 정보만 props로 내려주고, 경로 분기는 클라이언트가 담당. 깔끔하게 분리됐습니다.

## 트러블슈팅

직접 부딪힌 두 가지입니다.

**① "Functions cannot be passed directly to Client Components"** — 랜딩이 500.
i18n 딕셔너리에 `greeting(name)` 같은 **함수**가 들어 있었는데, 이 딕셔너리 전체를 클라이언트 컴포넌트(검색바)에 통째로 넘겼던 게 원인입니다. 서버→클라이언트 경계로는 함수를 직렬화해 보낼 수 없거든요.

```tsx
// ❌ 함수 포함 객체를 통째로
<SearchBar t={t} />
// ✅ 필요한 문자열만
<SearchBar country={t.hero.searchCountry} placeholder={t.hero.searchPlaceholder} />
```

**② 미들웨어가 새 화면을 로그인으로 튕김** — `/matchda`가 자꾸 `/login`(307)으로.
기존 인증 미들웨어가 `/`·`/login` 외 전부를 막고 있었습니다. 디자인 데모는 목 데이터 기반 공개 화면이라, 공개 경로로 한 줄 추가했습니다.

```ts
if (pathname.startsWith('/matchda')) return supabaseResponse
```

## 정리

핸드오프 재현의 핵심 흐름입니다.

1. **스택부터 파악** — 이미 있는 것 위에 짓는다
2. **토큰은 그대로** — 재현 단계에선 arbitrary value가 명세-코드 1:1이라 유리
3. **폰트는 변수로 노출**, 필요한 영역에만 적용
4. **i18n는 경량 딕셔너리**로 분리(단, 함수는 클라이언트로 넘기지 말 것)
5. **전역 크롬 충돌은 클라이언트 컴포넌트 + usePathname으로 격리**

여기까지는 "보이는 것"을 만든 단계입니다. 다음 편에서는 이 예쁜 껍데기에 **진짜 데이터**를 흘려보냅니다 — 목업을 Supabase 실데이터로 바꾸고, 디자인 데모를 실제 첫 화면으로 승격시키는 이야기입니다.
