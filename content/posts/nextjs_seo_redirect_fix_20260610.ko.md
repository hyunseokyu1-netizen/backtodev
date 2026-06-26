---
title: 'Google Search Console 빨간불 끄기 — Next.js i18n 리디렉션 오류 수정기'
date: '2026-06-10'
publish_date: '2026-06-27'
description: 찾을 수 없음(404), 리디렉션 오류, 중복 페이지까지 — Search Console 오류를 하나씩 파헤쳐 next.config.ts 몇 줄로 해결한 과정
tags:
  - NextJS
  - SEO
  - GoogleSearchConsole
  - next-intl
  - Debugging
---

블로그를 운영한 지 두 달쯤 됐을 때 Google Search Console을 열어봤더니 빨간 경고들이 쌓여 있었다.

- 찾을 수 없음(404) 4개
- 리디렉션 오류 1개
- 사용자가 선택한 표준이 없는 중복 페이지 6개
- 크롤링됨 - 현재 색인이 생성되지 않음 4개
- 리디렉션이 포함된 페이지 2개

숫자는 작아 보이지만, 색인이 잘못 쌓이면 나중에 고치기 더 힘들어진다. 하나씩 파헤쳐봤다.

---

## 블로그 구조 먼저

이 블로그는 Next.js 16 + next-intl로 한국어(`/ko/`)와 영어(`/en/`)를 함께 운영한다. 미들웨어(`proxy.ts`)에서 브라우저 언어를 감지해 locale 접두사를 자동으로 붙여준다.

이 구조가 Search Console 오류의 주요 배경이다.

---

## 오류 1 — 찾을 수 없음(404)

### 해당 URL

```
https://backtodev.com/posts/hello-world
https://backtodev.com/ko/posts/hello-world
https://backtodev.com/ko/posts/ai-개발시작001-클로드-코드-시작
https://backtodev.com/posts/ai-개발시작001-클로드-코드-시작
```

### 원인

`hello-world`는 초기에 테스트용으로 쓴 슬러그다. 지금은 삭제됐지만 Google이 한 번 색인에 올린 URL은 계속 재방문한다.

`ai-개발시작001-클로드-코드-시작`은 포스트 파일명을 바꾸면서 생긴 구 슬러그다. 지금 실제 파일은 `ai_coding_start_001_20260327`으로 바뀌었다.

### 해결

이미 `next.config.ts`에 리디렉션 규칙을 추가해둔 상태였는데, 문제가 있었다. `hello-world`의 `permanent` 값이 `false`(302 임시 리디렉션)였던 것.

```ts
// 수정 전: 302 → Google이 "임시"로 인식, 계속 재크롤링
{
  source: "/:locale(ko|en)/posts/hello-world",
  destination: "/:locale/posts",
  permanent: false, // ← 문제
},

// 수정 후: 301 → Google이 "영구 이동"으로 인식, 재크롤링 중단
{
  source: "/:locale(ko|en)/posts/hello-world",
  destination: "/:locale/posts",
  permanent: true,
},
```

**302는 "나중에 돌아올 수도 있다"는 신호다.** Google은 302 리디렉션을 받은 URL을 색인에서 지우지 않고 계속 크롤링한다. 사라진 페이지를 가리킬 때는 반드시 301을 써야 한다.

---

## 오류 2 — 리디렉션 오류 (`backtodev.com/ko/`)

### 증상

URL: `https://backtodev.com/ko/` (trailing slash 포함)
→ Google이 리디렉션 오류로 분류.

### 원인 분석

next-intl 미들웨어와 Next.js의 trailing slash 처리가 충돌하면서 리디렉션 루프가 발생한다.

```
/ko/ → intlMiddleware → /ko 로 리디렉션 (trailing slash 제거)
/ko  → intlMiddleware → /ko/ 로 리디렉션 (trailing slash 추가?)
     → 루프
```

Google의 크롤러가 이 루프에 빠지면 "리디렉션 오류"로 분류한다.

### 해결

`next.config.ts`의 `redirects()`에 trailing slash 정규화 규칙을 **미들웨어보다 먼저** 실행되도록 추가했다.

```ts
async redirects() {
  return [
    // trailing slash 정규화 — 미들웨어 전에 처리
    { source: "/ko/", destination: "/ko", permanent: true },
    { source: "/en/", destination: "/en", permanent: true },
    // ... 나머지 규칙
  ];
},
```

`next.config.ts`의 `redirects()`는 미들웨어보다 **먼저** 실행된다. 그래서 `/ko/`가 미들웨어에 닿기 전에 `/ko`로 301 처리된다. 루프가 끊긴다.

---

## 오류 3 — 사용자가 선택한 표준이 없는 중복 페이지 (6개)

### 증상

주로 `/ko/posts/슬러그` 형태 URL들이 "중복 페이지"로 분류됨.

### 원인

이 포스트들이 Google에 처음 크롤링됐을 때 영어 번역 파일이 없었다. 그 시점에는 `/en/posts/슬러그`에 접근하면 `/ko/` 원문 내용을 그대로 보여주는 "fallback" 처리가 됐다. Google은 `/ko/`와 `/en/`이 같은 내용이지만 둘 중 어느 게 정본인지 모르겠다고 판단한 것.

### 해결 방향

지금은 영어 번역 파일을 모두 추가한 상태다. Google이 재크롤링하면 `/ko/`와 `/en/`이 서로 다른 내용임을 확인하고 중복 경고가 사라진다.

코드 레벨에서는 fallback 페이지에 `noindex` 설정이 이미 되어 있다.

```ts
// app/[locale]/posts/[slug]/page.tsx
const canonicalUrl = post.isFallback
  ? `${BASE_URL}/ko/posts/${slug}`
  : `${BASE_URL}/${locale}/posts/${slug}`;

return {
  ...(post.isFallback && { robots: { index: false, follow: false } }),
  alternates: {
    canonical: canonicalUrl,
    // ...
  },
};
```

별도 수정 없이 Google 재크롤링을 기다리면 해소된다.

---

## 오류 4 — 크롤링됨 - 현재 색인이 생성되지 않음 (4개)

| URL | 원인 | 처리 |
|---|---|---|
| `/en/posts/hello-world` | 오류 1과 동일 | 301 리디렉션으로 해결 |
| `/en/posts/data_inbreeding` | 크롤링 시점에 영어 번역 없었음 | 번역 추가로 해결, 재크롤링 대기 |
| `/favicon.ico?...` | Google이 정적 파일 크롤링 | 무시해도 됨 |
| `/_next/static/media/...woff2` | Google이 폰트 파일 크롤링 | 무시해도 됨 |

`favicon.ico`와 `woff2`는 Google이 사이트를 크롤링하면서 리소스 파일까지 수집한 것이다. 페이지가 아니니까 색인이 안 되는 게 당연하고, 수정할 필요 없다.

---

## 오류 5 — 리디렉션이 포함된 페이지 (2개)

| URL | 리디렉션 목적지 | 처리 |
|---|---|---|
| `backtodev.com/en/` | `/en` | 오류 2 수정으로 해결 |
| `backtodev.com/contact` | `/ko/contact` 또는 `/en/contact` | 정상 동작, 수정 불필요 |

`/contact`는 locale 없이 접근하면 미들웨어가 브라우저 언어에 맞춰 `/ko/contact` 또는 `/en/contact`로 보내준다. 리디렉션이 발생하는 건 맞지만, 정상적인 동작이다. Google이 "리디렉션이 있는 페이지"로 표시하는 건 오류가 아니라 단순 정보다.

---

## 정리

```
리디렉션 오류 /ko/  → next.config.ts에 /ko/ → /ko 301 추가 (미들웨어 루프 차단)
404 hello-world    → permanent: false → true (301로 변경)
중복 페이지         → 영어 번역 추가 완료, Google 재크롤링 대기
크롤링됨-색인안됨   → 리디렉션 수정 + 번역 추가로 자연 해소
```

결국 `next.config.ts` 5줄 추가가 전부였다.

Search Console 오류는 무시하기 쉬운데, 리디렉션 루프 같은 건 시간이 지날수록 색인이 꼬이기 때문에 초반에 잡는 게 낫다. 숫자가 작을 때 보는 게 제일 깔끔하다.
