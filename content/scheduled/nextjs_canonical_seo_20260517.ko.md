---
title: 'Next.js 다국어 블로그에서 canonical 빠뜨리면 생기는 일'
date: '2026-05-17'
publish_date: '2026-06-08'
description: Google Search Console에서 "중복 페이지, Google에서 사용자와 다른 표준을 선택함" 오류가 뜬 이유와 next-intl 환경에서 canonical 설정하는 방법
tags:
  - NextJS
  - SEO
  - next-intl
  - GoogleSearchConsole
---

Google Search Console을 열었더니 이런 메시지가 떠 있었다.

> **중복 페이지, Google에서 사용자와 다른 표준을 선택함**

영향받은 페이지: `https://backtodev.com/ko`, `https://backtodev.com/ko/contact`

"내가 표준을 선택하려고 했는데 Google이 다르게 골랐다"는 뜻이다. 알고 보니 홈 페이지에 canonical 태그 자체가 없었다.

---

## 문제 상황

이 블로그는 `next-intl`로 한국어·영어를 분리 운영한다. URL 구조는 이렇다.

```
https://backtodev.com/ko    ← 한국어 홈
https://backtodev.com/en    ← 영어 홈
```

루트 `/`로 접근하면 `next-intl`이 자동으로 언어를 감지해 `/ko` 또는 `/en`으로 리다이렉트한다.

Google 입장에서는:
- `/`를 크롤링 → `/ko`로 리다이렉트됨
- `/ko`도 따로 크롤링
- 둘 다 같은 내용인데 canonical이 없으니 "이 중에 뭐가 표준이야?" 혼란

---

## 원인 파악

canonical 태그가 있는 페이지를 찾아보니 포스트 상세, posts 목록, about, portfolio 등에는 다 있는데, **홈 페이지만 없었다.**

```
app/
  [locale]/
    page.tsx         ← ❌ generateMetadata 없음 (홈)
    contact/
      page.tsx       ← ⚠️ canonical은 있지만 description이 영어 고정
    posts/
      page.tsx       ← ✅ canonical 있음
    about/
      page.tsx       ← ✅ canonical 있음
```

Next.js App Router에서 canonical 태그는 `generateMetadata`에서 `alternates.canonical`을 설정해야 자동으로 `<link rel="canonical">` 태그가 붙는다. 이게 없으면 canonical 태그 자체가 HTML에 포함되지 않는다.

---

## 해결

### Step 1 — 홈 페이지에 generateMetadata 추가

```tsx
// app/[locale]/page.tsx
import type { Metadata } from "next";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isKo = locale === "ko";

  return {
    title: isKo ? "backtodev — 다시 개발자로" : "backtodev — Back to Dev",
    description: isKo
      ? "40대 PM이 다시 개발자로 돌아오는 기록. 실패하고 배우며 성장하는 이야기."
      : "A 40-something PM returning to development. Notes on learning, building, and shipping.",
    alternates: {
      canonical: `${BASE_URL}/${locale}`,   // 핵심
      languages: {
        ko: `${BASE_URL}/ko`,
        en: `${BASE_URL}/en`,
      },
    },
  };
}
```

`alternates.canonical`을 설정하면 Next.js가 자동으로 아래 태그들을 `<head>`에 삽입한다.

```html
<link rel="canonical" href="https://backtodev.com/ko" />
<link rel="alternate" hrefLang="ko" href="https://backtodev.com/ko" />
<link rel="alternate" hrefLang="en" href="https://backtodev.com/en" />
```

`hrefLang` alternate는 Google에게 "이 페이지의 다른 언어 버전은 여기야"라고 알려준다. 다국어 사이트에서 중복 콘텐츠 신호를 줄이는 데 도움이 된다.

### Step 2 — contact 페이지 description 분리

contact 페이지는 canonical은 있었지만 description이 영어 고정이었다.

```tsx
// 수정 전
description: "Get in touch with backtodev.",

// 수정 후
const isKo = locale === "ko";
description: isKo ? "backtodev에 연락하기" : "Get in touch with backtodev",
```

같은 URL인데 언어마다 다른 내용을 보여주는 페이지에서 description까지 같으면 Google이 중복 신호로 읽을 수 있다. 사소해 보이지만 다국어 사이트에서는 이런 디테일이 쌓인다.

---

## 배포 후 확인

빌드하고 배포하면 실제 HTML에서 확인할 수 있다.

```bash
curl -s "https://backtodev.com/ko" | grep -i "canonical\|hrefLang"
```

```html
<link rel="canonical" href="https://backtodev.com/ko"/>
<link rel="alternate" hrefLang="ko" href="https://backtodev.com/ko"/>
<link rel="alternate" hrefLang="en" href="https://backtodev.com/en"/>
```

이렇게 나오면 정상이다.

Search Console에서는 해당 URL을 **URL 검사 → 색인 생성 요청**해두면 Google이 빠르게 재크롤링한다. 오류가 해소되기까지는 보통 며칠에서 몇 주 걸린다.

---

## next-intl 다국어 사이트 canonical 체크리스트

| 페이지 | canonical | hreflang | description 분리 |
|--------|-----------|----------|-----------------|
| 홈 (`/[locale]`) | ✅ 필수 | ✅ 필수 | ✅ 권장 |
| 목록 (`/[locale]/posts`) | ✅ 필수 | ✅ 필수 | ✅ 권장 |
| 상세 (`/[locale]/posts/[slug]`) | ✅ 필수 | ✅ 필수 | — (포스트별 자동) |
| 정적 페이지 (about, contact) | ✅ 필수 | ✅ 필수 | ✅ 권장 |

빠진 페이지가 없는지 이 표로 한 번씩 점검해보면 좋다.

---

## 트러블슈팅

**`generateMetadata`를 추가했는데 canonical 태그가 안 보인다**

`params`에서 `locale`을 제대로 받아오는지 확인한다. App Router에서는 `params`가 Promise라 `await`이 필요하다.

```tsx
// 틀림
export async function generateMetadata({ params }) {
  const locale = params.locale  // ❌ Promise를 await 안 함
}

// 맞음
export async function generateMetadata({ params }) {
  const { locale } = await params  // ✅
}
```

**`getLocale()`로 locale을 가져오는데 generateMetadata에서 쓸 수 없다**

`getLocale()`은 서버 컴포넌트 내부에서만 동작한다. `generateMetadata`에서는 반드시 `params`에서 locale을 받아야 한다.

---

## 정리

```
문제: 홈 페이지 generateMetadata 누락
        ↓
  canonical 태그 없음
        ↓
  Google이 / 와 /ko 를 중복으로 인식
        ↓
  "중복 페이지, Google에서 사용자와 다른 표준을 선택함" 오류

해결: generateMetadata 추가
  → alternates.canonical 설정
  → alternates.languages로 hreflang까지 한 번에 처리
```

포스트 상세 페이지만 SEO를 신경 쓰고 홈이나 목록 페이지는 빠뜨리는 경우가 많다. 다국어 사이트라면 특히 모든 라우트를 빠짐없이 점검해야 한다.
