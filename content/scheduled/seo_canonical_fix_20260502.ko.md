---
title: '구글이 내 블로그를 무시했던 이유 — Next.js SEO 버그 2가지 수정기'
date: '2026-05-02'
publish_date: '2026-05-26'
description: Google Search Console에서 색인 누락을 발견하고 canonical 태그와 footer 404 링크를 수정한 과정
tags:
  - Next.js
  - SEO
  - canonical
  - i18n
  - Google Search Console
---

블로그를 만들고 나서 한동안 잊고 있었던 Google Search Console을 열었다가 꽤 당황했다. 열심히 만든 페이지들이 색인에 아예 없거나, "중복 페이지"로 분류돼 있었기 때문이다.

원인을 찾다 보니 문제가 두 군데였다. 하나는 footer 링크가 404를 내고 있었고, 다른 하나는 canonical 태그가 잘못 설정돼 있었다. 둘 다 코드에서 바로 눈에 띄는 버그는 아니었다. 그래서 오늘은 이 두 가지를 어떻게 찾고 고쳤는지 정리해본다.

---

## canonical이 뭔지 모르는 분을 위해

같은 내용이 여러 URL로 접근 가능할 때, canonical 태그로 "이 페이지의 대표 URL은 이거야"라고 구글에 알려주면 혼선 없이 올바른 URL이 색인에 오른다. Next.js에서는 `generateMetadata`의 `alternates.canonical`로 설정한다.

> canonical 개념과 next-intl 환경에서의 상세 설정법은 [후속 포스트](../nextjs_canonical_seo_20260517)에서 더 깊이 다뤘다.

---

## 버그 1: footer 링크가 404를 내고 있었다

### 문제

이 블로그는 다국어를 지원하기 때문에 URL 구조가 `/[locale]/페이지` 형태다. `/ko/about`, `/en/posts` 이런 식으로.

그런데 footer 코드를 보면:

```tsx
// before
<a href="/contact">Contact</a>
<a href="/privacy">Privacy Policy</a>
```

`/contact`로 하드코딩돼 있었다. 실제 페이지는 `/ko/contact`인데, `/contact`로 가면 당연히 404다.

구글 봇이 footer 링크를 타고 들어가면 죄다 404. 크롤링 관점에서 최악의 상황이었다.

### 수정

layout 컴포넌트에서 이미 `locale`을 받고 있었으므로, 그냥 동적으로 이어붙이면 됐다.

```tsx
// after
<a href={`/${locale}/contact`}>Contact</a>
<a href={`/${locale}/privacy`}>Privacy Policy</a>
```

단순한 수정이지만, 이게 없으면 구글 봇 입장에서 "Contact 링크 눌렀더니 404네? 이 사이트 관리 안 하는 거 아냐?" 하고 넘어갈 수 있다.

---

## 버그 2: layout의 canonical이 모든 페이지를 "홈페이지"로 만들고 있었다

### 문제

`app/[locale]/layout.tsx`에 전체 레이아웃용 메타데이터가 있고, 거기에 canonical이 이미 설정돼 있었다.

```tsx
// layout.tsx (기존)
export const metadata: Metadata = {
  alternates: {
    canonical: "https://backtodev.com",  // 홈페이지 URL
  },
};
```

Next.js는 하위 페이지에 `generateMetadata`가 없으면 layout의 metadata를 상속한다. 그러니까 `about`, `posts`, `contact`, `privacy` 페이지가 전부 자신의 canonical URL 대신 홈페이지 URL을 canonical로 내보내고 있었던 것이다.

구글 입장에서는 이랬다:

| 페이지 URL | 내보낸 canonical |
|---|---|
| `/ko/about` | `https://backtodev.com` (홈페이지!) |
| `/ko/posts` | `https://backtodev.com` (홈페이지!) |
| `/ko/contact` | `https://backtodev.com` (홈페이지!) |

"이 페이지들 전부 홈페이지랑 같은 내용인가봐" — 구글이 이렇게 판단하면 색인에서 제외되거나, 중복 페이지로 분류된다.

### 수정

각 페이지에 `generateMetadata`를 추가해서 올바른 canonical URL을 명시해줬다. `export const metadata` 방식 대신 `generateMetadata` 함수를 쓴 이유는, URL에 locale이 포함돼야 해서 동적으로 생성해야 하기 때문이다.

```tsx
// app/[locale]/about/page.tsx
import type { Metadata } from "next";

const BASE_URL = "https://backtodev.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `${BASE_URL}/${locale}/about`,
      languages: {
        ko: `${BASE_URL}/ko/about`,
        en: `${BASE_URL}/en/about`,
      },
    },
  };
}
```

`languages` 필드는 다국어 대체 URL을 알려주는 `hreflang` 설정이다. "한국어 버전은 `/ko/about`, 영어 버전은 `/en/about`이야"라고 구글에 알려준다. 이걸 넣으면 구글이 언어별로 적절한 버전을 검색 결과에 올려준다.

같은 패턴을 `posts`, `contact`, `privacy` 페이지에도 똑같이 적용했다.

---

## 수정 결과 요약

| 구분 | 수정 전 | 수정 후 |
|---|---|---|
| footer Contact 링크 | `/contact` (404) | `/${locale}/contact` |
| footer Privacy 링크 | `/privacy` (404) | `/${locale}/privacy` |
| about 페이지 canonical | 홈페이지 URL 상속 | `/ko/about` 또는 `/en/about` |
| posts 페이지 canonical | 홈페이지 URL 상속 | `/ko/posts` 또는 `/en/posts` |
| contact 페이지 canonical | 홈페이지 URL 상속 | `/ko/contact` 또는 `/en/contact` |
| privacy 페이지 canonical | 홈페이지 URL 상속 | `/ko/privacy` 또는 `/en/privacy` |

---

## 트러블슈팅 — `export const metadata` vs `generateMetadata`

`export const metadata`는 정적 객체라 `locale` 같은 동적 값을 사용할 수 없다. URL에 locale이 들어가는 경우 반드시 `generateMetadata` 함수를 써야 한다. `params`에서 locale을 `await`으로 꺼내야 하는 점도 주의. 자세한 내용은 [후속 포스트](../nextjs_canonical_seo_20260517) 참조.

---

## 정리

이번 수정의 핵심은 두 가지였다.

1. **다국어 사이트에서 하드코딩된 경로는 위험하다.** `/contact` 하나가 404를 뿌리고 있어도 개발 중엔 쉽게 발견이 안 된다. 항상 locale-aware한 경로를 써야 한다.

2. **layout의 metadata는 하위 페이지에 상속된다.** 각 페이지가 자신의 canonical을 명시하지 않으면, layout에 있는 canonical을 그대로 물려받는다. Next.js에서 다국어 SEO를 제대로 하려면 각 페이지마다 `generateMetadata`로 canonical을 직접 지정하는 게 안전하다.

Google Search Console은 이런 SEO 문제를 찾는 데 생각보다 훨씬 유용하다. 아직 안 연결했다면 블로그를 공개하는 동시에 연결해두는 걸 추천한다.
