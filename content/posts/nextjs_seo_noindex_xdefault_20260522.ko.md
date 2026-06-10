---
title: 'Next.js 다국어 블로그 SEO — Google이 /ko를 무시하는 이유와 두 가지 해결법'
date: '2026-05-22'
publish_date: '2026-06-11'
description: Google Search Console 중복 페이지 오류의 원인인 x-default hreflang 누락과 isFallback noindex 처리 방법
tags:
  - Next.js
  - SEO
  - next-intl
  - hreflang
---

Google Search Console에서 이런 항목이 생겼다.

> **중복 페이지, Google에서 사용자와 다른 표준을 선택함**  
> 영향받은 페이지: `https://backtodev.com/ko`, `https://backtodev.com/ko/contact`

내가 canonical을 `https://backtodev.com/ko`로 분명히 지정했는데, Google이 무시하고 `/en` 버전을 대표 URL로 선택해버린 것이다.

원인이 두 가지였다.

---

## 원인 1 — x-default hreflang 누락

다국어 사이트에서 hreflang을 설정할 때 보통 이렇게 한다.

```tsx
alternates: {
  canonical: `${BASE_URL}/${locale}`,
  languages: {
    ko: `${BASE_URL}/ko`,
    en: `${BASE_URL}/en`,
  },
},
```

이걸 보면 `ko`와 `en`은 있는데, `x-default`가 없다.

**`x-default`는 "어떤 언어도 매칭되지 않을 때 기본으로 사용할 URL"을 Google에게 알려주는 신호다.** 이게 없으면 Google은 `/ko`와 `/en` 중 어느 쪽이 "진짜 대표"인지 스스로 판단해야 한다. 그 판단이 내 의도와 다를 수 있다.

실제로 이 블로그에서는 기본 언어가 한국어인데, `x-default`가 없으니 Google이 `/en`을 canonical로 선택해서 `/ko`가 "중복 페이지"로 밀려났다.

---

## 원인 2 — isFallback 포스트 처리 미흡

이 블로그는 한국어 포스트만 있는 경우에도 `/en/posts/[slug]` URL이 존재한다. 영어 번역이 없으니 한국어 내용을 그대로 보여준다(isFallback).

그러면 Google 입장에서는:
- `https://backtodev.com/ko/posts/어떤포스트` → 한국어 콘텐츠
- `https://backtodev.com/en/posts/어떤포스트` → 똑같은 한국어 콘텐츠

두 URL이 같은 내용 → 중복 페이지 판정.

canonical을 `/ko`로 고정해뒀지만, Google이 `/en` URL 자체를 크롤링하고 색인하려는 시도를 막지는 못한다. 더 강한 신호가 필요하다.

---

## 해결 1 — x-default 추가

모든 페이지의 `generateMetadata`에 `x-default`를 추가했다.

**홈 페이지 (`app/[locale]/page.tsx`):**

```tsx
alternates: {
  canonical: `${BASE_URL}/${locale}`,
  languages: {
    ko: `${BASE_URL}/ko`,
    en: `${BASE_URL}/en`,
    "x-default": `${BASE_URL}/ko`,  // 추가
  },
},
```

**포스트 목록, about, contact 페이지도 동일하게:**

```tsx
languages: {
  ko: `${BASE_URL}/ko/posts`,
  en: `${BASE_URL}/en/posts`,
  "x-default": `${BASE_URL}/ko/posts`,  // 추가
},
```

렌더링되면 이런 태그가 생긴다.

```html
<link rel="alternate" hreflang="ko" href="https://backtodev.com/ko" />
<link rel="alternate" hreflang="en" href="https://backtodev.com/en" />
<link rel="alternate" hreflang="x-default" href="https://backtodev.com/ko" />
```

이제 Google은 "기본 언어는 한국어"라는 걸 명확히 알게 된다.

---

## 해결 2 — isFallback 포스트에 noindex 추가

canonical만으로는 부족하다. Google이 `/en` 한국어 포스트를 아예 색인하지 않도록 `noindex`를 추가했다.

```tsx
// app/[locale]/posts/[slug]/page.tsx
return {
  title: post.title,
  description: post.description,
  ...(post.isFallback && { robots: { index: false, follow: false } }),  // 추가
  alternates: {
    canonical: canonicalUrl,
    languages: {
      ko: `${BASE_URL}/ko/posts/${slug}`,
      ...(otherPost && !otherPost.isFallback
        ? { en: `${BASE_URL}/en/posts/${slug}`, "x-default": `${BASE_URL}/ko/posts/${slug}` }
        : { "x-default": `${BASE_URL}/ko/posts/${slug}` }),
    },
  },
  // ...
};
```

isFallback인 경우 렌더링되는 태그:

```html
<meta name="robots" content="noindex, nofollow" />
```

Google은 이 태그를 보고 해당 URL을 색인 대상에서 제외한다. canonical보다 강력한 신호다.

---

## noindex vs canonical → /ko 고정, 어떤 게 나을까?

| 방식 | 장점 | 단점 |
|------|------|------|
| `canonical → /ko` | 구현 간단 | Google이 무시할 수 있음. URL 모순(영어 URL → 한국어 canonical) |
| `noindex` | 확실하게 색인 차단 | 해당 URL은 검색 결과에 절대 안 나옴 |

영어 번역이 없는 페이지라면 `noindex`가 맞다. "이 페이지는 아직 준비 안 됐어"라는 명확한 신호다. 나중에 영어 콘텐츠를 추가하면 `noindex`만 제거하면 된다.

---

## 적용 범위 정리

| 페이지 | x-default | noindex |
|--------|-----------|---------|
| 홈 (`/[locale]`) | ✅ 추가 | ❌ 불필요 (영어 콘텐츠 있음) |
| 포스트 목록 | ✅ 추가 | ❌ 불필요 |
| about | ✅ 추가 | ❌ 불필요 |
| contact | ✅ 추가 | ❌ 불필요 |
| 포스트 상세 (isFallback) | ✅ 추가 | ✅ 추가 |
| 포스트 상세 (정상) | ✅ 추가 | ❌ 불필요 |

---

## 정리

```
Google Search Console: /ko 중복 페이지 오류
    ↓
원인 1: x-default hreflang 없음
        → Google이 /ko와 /en 중 임의로 canonical 선택
원인 2: isFallback 포스트에 noindex 없음
        → /en URL에 한국어 콘텐츠 → 중복 판정
    ↓
해결:
  전체 페이지 → "x-default": /ko 추가
  isFallback 포스트 → robots: { index: false, follow: false }
    ↓
Google Search Console에서 재검사 요청 → 수일 내 해소
```

다국어 Next.js 블로그를 만들 때 hreflang 설정에서 `x-default`는 빠뜨리기 쉬운 항목이다. `ko`와 `en`만 넣으면 된다고 생각하기 쉬운데, `x-default`가 없으면 Google이 어느 쪽이 기본인지 알 수 없다.
