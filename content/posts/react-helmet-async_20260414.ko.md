---
title: React SPA에서 페이지별 title과 meta 태그 바꾸기 — react-helmet-async
date: '2026-04-14'
description: SEO작업 중 react-helmet에 대한 설명
tags:
  - React
  - SEO
  - react-helmet-async
  - SPA
---

# React SPA에서 페이지별 title과 meta 태그 바꾸기 
## react-helmet-async

React로 만든 사이트를 배포하고 나서 이런 경험 한 번쯤 있지 않나요?

브라우저 탭을 보면 어느 페이지를 가든 title이 똑같고, 카카오톡에 링크를 공유하면 썸네일도 없고 설명도 없고... SEO 점수는 바닥이고.

저도 WiFi QR 코드 생성기를 만들면서 딱 이 문제에 부딪혔습니다. `/` 홈 페이지랑 `/privacy` 페이지가 브라우저 탭에서 똑같이 "WiFi QR Print"로 뜨더라고요. 이걸 해결하면서 알게 된 게 바로 **react-helmet-async**입니다.

---

## 왜 이런 문제가 생기나?

React SPA는 기본적으로 `index.html` **딱 하나**를 씁니다.

```html
<!-- index.html -->
<head>
  <title>WiFi QR Print</title>
  <meta name="description" content="..." />
</head>
<body>
  <div id="root"></div>
</body>
```

React Router(또는 wouter)로 `/privacy`로 이동해도, 브라우저가 서버에 새 HTML 파일을 요청하는 게 아니라 JavaScript가 화면을 바꾸는 거라서 `<head>` 는 그대로입니다.

결과적으로:

| 페이지 | 기대하는 title | 실제 title |
|--------|--------------|------------|
| `/` | WiFi QR Print – Free Generator | WiFi QR Print |
| `/privacy` | Privacy Policy – WiFi QR Print | WiFi QR Print |

SEO 입장에서는 모든 페이지가 같은 title, 같은 description이니 구글이 제대로 색인을 못 합니다.

---

## react-helmet-async 란?

컴포넌트 안에서 `<head>` 태그를 **선언적으로 제어**할 수 있게 해주는 라이브러리입니다.

```tsx
function Home() {
  return (
    <>
      <Helmet>
        <title>홈 페이지 제목</title>
      </Helmet>
      <div>페이지 본문</div>
    </>
  )
}
```

이 컴포넌트가 렌더링되는 순간 브라우저의 `<head>` 가 자동으로 업데이트됩니다.

> **왜 react-helmet이 아니라 react-helmet-async?**  
> 원조인 `react-helmet`은 현재 유지보수가 중단된 상태입니다. `react-helmet-async`가 React 18 비동기 렌더링 환경에서도 안전하게 동작하는 공식 후계자입니다.

---

## 설치

```bash
npm install react-helmet-async
```

버전 주의: **v1**을 설치하세요. v3는 API가 완전히 바뀌어서 기존 문서대로 쓰면 화이트스크린이 납니다. 저도 처음에 최신 버전(`@3`) 설치했다가 배포 후 사이트가 통째로 안 뜨는 경험을 했습니다.

```bash
npm install react-helmet-async@1  # 안전한 버전 명시 권장
```

---

## Step 1 — HelmetProvider로 앱 감싸기

`Helmet`은 React Context로 동작합니다. 앱 최상단에 `HelmetProvider`를 한 번만 설정하면 됩니다.

```tsx
// App.tsx
import { HelmetProvider } from "react-helmet-async";

function App() {
  return (
    <HelmetProvider>
      {/* 나머지 앱 */}
      <Router />
    </HelmetProvider>
  );
}
```

`HelmetProvider` 없이 `Helmet`을 쓰면 경고가 뜨거나 동작하지 않으니 꼭 설정해야 합니다.

---

## Step 2 — 페이지 컴포넌트에서 Helmet 사용하기

이제 각 페이지 컴포넌트 안에서 `<head>`를 원하는 대로 선언합니다.

```tsx
// pages/Home.tsx
import { Helmet } from "react-helmet-async";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>WiFi QR Print – Free WiFi QR Code Generator</title>
        <meta name="description" content="QR 코드를 몇 초 만에 생성하세요." />
        <link rel="canonical" href="https://wi-fi-qr.xyz/" />
      </Helmet>

      <div>페이지 본문...</div>
    </>
  );
}
```

```tsx
// pages/Privacy.tsx
import { Helmet } from "react-helmet-async";

export default function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy – WiFi QR Print</title>
        <meta name="description" content="개인정보처리방침입니다." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://wi-fi-qr.xyz/privacy" />
      </Helmet>

      <div>페이지 본문...</div>
    </>
  );
}
```

이제 `/privacy`로 이동하면 브라우저 탭 title이 "Privacy Policy – WiFi QR Print"로 바뀝니다.

---

## Step 3 — 다국어 사이트에서 동적으로 바꾸기

제 프로젝트는 한국어/영어/중국어/독일어를 지원해서, 언어에 따라 title과 description도 달라져야 했습니다.

```tsx
export default function Home() {
  const { lang } = useI18n();

  const pageTitles = {
    en: "WiFi QR Print – Free WiFi QR Code Generator",
    ko: "WiFi QR 프린트 – 무료 WiFi QR 코드 생성기",
    zh: "WiFi 二维码打印 – 免费WiFi二维码生成器",
    de: "WiFi QR Druck – Kostenloser WLAN QR-Code Generator",
  };

  const pageDescs = {
    en: "Generate a printable WiFi QR code in seconds.",
    ko: "몇 초 만에 인쇄 가능한 WiFi QR 코드를 생성하세요.",
    zh: "几秒钟内生成可打印的WiFi二维码。",
    de: "Erstellen Sie in Sekunden einen druckbaren WLAN-QR-Code.",
  };

  return (
    <>
      <Helmet htmlAttributes={{ lang }}>
        <title>{pageTitles[lang]}</title>
        <meta name="description" content={pageDescs[lang]} />
        <link rel="canonical" href="https://wi-fi-qr.xyz/" />
      </Helmet>
      ...
    </>
  );
}
```

`htmlAttributes={{ lang }}`을 쓰면 `<html lang="ko">` 처럼 html 태그의 속성도 제어할 수 있습니다.  
> ⚠️ `<html lang="ko" />` 를 Helmet 자식으로 직접 쓰는 방식은 v3에서 에러를 유발하니 항상 `htmlAttributes` prop을 사용하세요.

---

## 자주 쓰는 패턴 요약

```tsx
<Helmet htmlAttributes={{ lang: "ko" }}>
  {/* 탭 제목 */}
  <title>페이지 제목</title>

  {/* 검색 결과 설명 */}
  <meta name="description" content="페이지 설명" />

  {/* 중복 URL 방지 */}
  <link rel="canonical" href="https://example.com/page" />

  {/* 구글 색인 제외 (개인정보처리방침 등) */}
  <meta name="robots" content="noindex, follow" />

  {/* SNS 공유 미리보기 */}
  <meta property="og:title" content="공유될 때 보이는 제목" />
  <meta property="og:description" content="공유 설명" />
  <meta property="og:image" content="https://example.com/og-image.png" />

  {/* 트위터 카드 */}
  <meta name="twitter:card" content="summary_large_image" />
</Helmet>
```

---

## 트러블슈팅

### 배포 후 사이트가 아무것도 안 뜸 (화이트스크린)

**원인**: `react-helmet-async@3` 설치.  
v3는 API가 완전 재설계되어 `Helmet`, `HelmetProvider` 기존 방식이 동작하지 않습니다.

```bash
# 해결: v1으로 명시 설치
npm install react-helmet-async@1
```

---

### title이 바뀌지 않음

`HelmetProvider`로 앱을 감쌌는지 확인하세요. `HelmetProvider` 없이는 동작하지 않습니다.

```tsx
// ❌ 안 됨
<App />

// ✅ 됨
<HelmetProvider>
  <App />
</HelmetProvider>
```

---

### SSR(서버사이드 렌더링) 환경

Next.js처럼 SSR을 쓰는 경우, react-helmet-async보다 Next.js 내장 `<Head>` 컴포넌트나 `next/head`를 쓰는 게 더 적합합니다. react-helmet-async는 주로 **Vite/CRA 같은 순수 클라이언트 SPA** 환경에서 씁니다.

---

## 정리

```
문제: SPA는 index.html 하나 → 모든 페이지 title/meta가 동일
해결: react-helmet-async로 컴포넌트 안에서 <head> 동적 제어

설치: npm install react-helmet-async@1  ← 버전 꼭 명시

1. App.tsx 최상단에 <HelmetProvider> 감싸기
2. 각 페이지 컴포넌트에 <Helmet> 선언
3. title, description, canonical, og 태그 등 자유롭게 설정
```

SEO는 한 번에 되는 게 아니라 이런 작은 것들을 하나씩 쌓아가는 과정인 것 같습니다. react-helmet-async 하나만 넣어도 페이지별 title과 canonical이 정확하게 잡히면서 구글이 사이트를 훨씬 잘 이해할 수 있게 됩니다.
