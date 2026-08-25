---
title: 'Next.js SEO, robots.txt·sitemap 다음 단계 — canonical과 JSON-LD 제대로 채우기'
date: '2026-07-13'
publish_date: '2026-08-26'
description: Next.js App Router의 Metadata API로 canonical URL과 JSON-LD 구조화 데이터를 추가하고 curl로 직접 검증한 기록
tags:
  - Next.js
  - SEO
  - JSON-LD
  - Metadata API
---

## robots.txt와 sitemap만으로는 반쪽짜리다

사이드 프로젝트 매치다(MatchDa)에 SEO 기본기를 넣은 지 좀 됐다. `robots.ts`로 크롤러를 막을 곳/열 곳을 나누고, `sitemap.ts`로 공개 페이지를 등록하고, `opengraph-image.tsx`로 카카오톡·슬랙 공유 미리보기까지 만들어뒀다. 여기까지 하면 "SEO 했다"고 말하고 싶어지는데, 사실 이건 **크롤러가 사이트에 들어오게 하는 최소한**일 뿐이다.

들어온 크롤러가 페이지 내용을 어떻게 "이해"하는지는 다른 문제다. 오늘은 그 다음 단계 — **canonical URL**과 **JSON-LD 구조화 데이터**를 채웠다. 이 둘은 검색엔진에게 "이 페이지가 정본이다"와 "이 페이지는 이런 종류의 것이다"를 명시적으로 알려주는 장치다.

## canonical URL — "이 주소가 진짜예요"

같은 콘텐츠가 여러 URL로 접근 가능하면(예: `/pricing`과 `/pricing?ref=abc`), 검색엔진은 이걸 중복 콘텐츠로 오해해서 순위를 나눠 먹을 수 있다. `<link rel="canonical">`은 "이 여러 URL 중 이게 대표"라고 못박는 태그다.

Next.js Metadata API에서는 각 페이지의 `metadata` export에 한 줄만 추가하면 된다.

```ts
// src/app/about/page.tsx
export const metadata: Metadata = {
  title: '서비스 소개',
  description: '...',
  alternates: { canonical: '/about' },  // 이 한 줄
}
```

루트 레이아웃에 `metadataBase`가 설정돼 있으면 상대 경로(`/about`)가 자동으로 절대 URL(`https://matchda.com/about`)로 조합된다.

```ts
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://matchda.com'),
  alternates: { canonical: '/' },
  // ...
}
```

로그인 필요 페이지(대시보드·워크스페이스 등)는 애초에 `robots.ts`에서 크롤링 차단이라 canonical이 필요 없다. **공개 페이지 6~7개에만** 달면 끝이다.

## JSON-LD — "이 페이지는 이런 종류예요"

검색엔진은 HTML을 읽고 어떻게든 내용을 추측하지만, 그 추측을 도와주는 표준 방법이 있다. `<script type="application/ld+json">`으로 [schema.org](https://schema.org) 어휘에 맞춰 데이터를 박아두면, 구글이 리치 결과(별점, 가격, 조직 로고 등)를 만들 근거로 쓴다.

### Organization + WebSite — 전 페이지 공통

루트 레이아웃에 두 개를 추가했다. 하나는 회사 자체("MatchDa라는 조직이 있다"), 하나는 웹사이트 자체("이 URL이 그 웹사이트다").

```tsx
// src/app/layout.tsx
const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MatchDa',
  alternateName: '매치다',
  url: SITE_URL,
  logo: `${SITE_URL}/matchda-mark.png`,
  description: DEFAULT_DESCRIPTION,
}

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MatchDa',
  url: SITE_URL,
  inLanguage: 'ko-KR',
}
```

렌더링은 `<body>` 안에서 `dangerouslySetInnerHTML`로 JSON을 그대로 박는다.

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
/>
```

여기서 `dangerouslySetInnerHTML`을 보면 반사적으로 XSS를 의심해야 한다. **직렬화하는 대상이 정적 상수인지, 유저 입력이나 DB 값이 한 톨이라도 섞여 있는지**를 꼭 확인하자. 이번 건 전부 코드에 박힌 상수라 안전하지만, 만약 여기 유저 닉네임이나 리뷰 텍스트가 들어간다면 얘기가 완전히 달라진다.

### 여기서 뺀 것 — SearchAction

WebSite 스키마에는 사이트 내 검색을 지원한다고 알리는 `potentialAction: SearchAction`이라는 필드가 있다. 넣으면 구글 검색 결과에 사이트명 아래 검색창이 바로 뜨는 멋진 기능이다. 그런데 안 넣었다.

이유는 단순하다. **우리 서비스엔 그 검색이 없다.** 매치다는 로그인 후 "내가 등록한 회사"의 공고만 검색되는 구조라, 전역 검색 엔드포인트가 있는 척하는 스키마를 심으면 실제로 없는 기능을 검색엔진에 약속하는 꼴이다. 사용자가 그 검색창을 눌렀을 때 기대한 결과를 못 받으면, SEO에서 이득 본 걸 UX에서 까먹는다.

이건 사실 며칠 전 이 프로젝트 랜딩 페이지를 신규 유저 관점으로 점검하다가 배운 교훈의 연장선이다. 그때 랜딩 히어로의 검색바가 "전 세계 채용 공고를 검색하세요"라고 약속해놓고 실제로는 텅 빈 결과만 주는 걸 고쳤었다. **구조화 데이터도 마찬가지다. 검색엔진에게 하는 약속이든 유저에게 하는 약속이든, 실제로 되는 것만 말해야 한다.**

### Product + Offer — 가격 리치 스니펫, 그리고 동기화 문제

요금제 페이지에는 가격을 알리는 `Product`/`Offer` 스키마를 추가했다. 이게 붙으면 구글 검색 결과에 "$7.99부터" 같은 가격이 스니펫으로 뜰 수 있다.

```ts
const PRICING_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'MatchDa 프리미엄',
  offers: [
    { '@type': 'Offer', name: '무료', price: '0', priceCurrency: 'USD' },
    {
      '@type': 'Offer',
      name: '프리미엄',
      price: PREMIUM_PRICE_NUMBER,
      priceCurrency: 'USD',
      priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' },
    },
  ],
}
```

여기서 하나 걸린 게 있다. 화면에 보이는 가격 문구는 `PREMIUM_PRICE_LABEL = '$7.99 / 월'`이라는 **사람이 읽는 문자열**이고, JSON-LD의 `price`는 **숫자만** 있어야 한다. 이걸 새 상수로 따로 박아두면 나중에 가격을 올릴 때 표시 문구는 고치고 JSON-LD는 까먹는 사고가 난다. (`$7.99`짜리 서비스가 검색 결과엔 계속 옛날 가격으로 뜨는 그림이다.)

그래서 새 숫자 상수를 만드는 대신, 기존 표시 문구에서 **정규식으로 숫자만 뽑았다.**

```ts
// PREMIUM_PRICE_LABEL("$7.99 / 월")에서 숫자만 추출 — 표시 가격과 항상 동기화됨
const PREMIUM_PRICE_NUMBER = PREMIUM_PRICE_LABEL.match(/[\d.]+/)?.[0] ?? '7.99'
```

값의 출처를 하나로 유지하는 방법(single source of truth)이다. `?? '7.99'` 폴백은 정규식이 매칭 실패했을 때(문구 형식이 통째로 바뀌는 등) 조용히 옛 가격을 쓰게 되는 리스크가 있다는 걸 알고 있다 — 완벽한 방법은 아니지만, 새 상수를 또 만들어서 동기화 지점을 늘리는 것보다는 낫다는 판단이다.

통화도 하나 신경 썼다. 화면에는 무료 플랜이 "₩0", 프리미엄이 "$7.99"로 서로 다른 통화 기호가 붙어 있는데(0원이니 어차피 상관없어 보이지만), 같은 `Product`의 `offers` 배열 안에서 `priceCurrency`가 오퍼마다 다르면 구글 리치 결과 검증기가 경고를 띄운다. 0은 어느 통화로도 0이라, 그냥 둘 다 `USD`로 맞췄다.

### 조건부 필드 — 없는 값은 아예 안 보낸다

네이버 서치어드바이저 소유 확인은 메타 태그에 인증 코드를 박아야 하는데, 그 코드는 네이버 서치어드바이저에 사이트를 등록해야 발급된다. 지금은 아직 없다. 그렇다고 빈 문자열을 넣어두면 나중에 까먹고 안 채울 수도 있고, 애초에 코드가 없는 상태에서 태그만 있는 건 의미가 없다.

```ts
// 값이 있을 때만 verification 필드 자체를 생성 (스프레드 조건부)
...(process.env.NAVER_SITE_VERIFICATION && {
  verification: { other: { 'naver-site-verification': process.env.NAVER_SITE_VERIFICATION } },
}),
```

값이 없으면 `verification` 키 자체가 metadata 객체에 안 생긴다. 나중에 Vercel 환경변수에 `NAVER_SITE_VERIFICATION`만 추가하고 재배포하면 자동으로 살아난다. **없는 값은 빈 문자열로 채우지 말고, 필드 자체를 안 만드는 게** 나중에 실수를 줄인다.

## 검증 — curl로 직접 확인하기

Metadata API가 알아서 렌더링해줄 거라 믿고 넘어가는 대신, 프로덕션 빌드를 로컬에 띄우고 실제 응답을 확인했다.

```bash
npx next build && npx next start -p 3457 &

# canonical 태그 확인
curl -s http://localhost:3457/about | grep -o '<link rel="canonical"[^>]*>'
# → <link rel="canonical" href="https://matchda.com/about"/>

# JSON-LD 내용 확인
curl -s http://localhost:3457/ | grep -o '<script type="application/ld+json">[^<]*</script>'
# → Organization, WebSite 스크립트 태그 두 개가 실제로 찍히는지 확인

# 요금제 페이지의 가격 구조화 데이터 확인
curl -s http://localhost:3457/pricing | grep -o '"@type":"[A-Za-z]*"'
# → Product, Offer, Offer, UnitPriceSpecification

# 네이버 인증 태그가 (아직 값이 없으니) 안 뜨는지 확인
curl -s http://localhost:3457/ | grep -o 'naver-site-verification[^/]*'
# → 아무것도 안 나오면 정상
```

빌드가 성공하고 타입 에러가 없다고 해서 메타 태그가 원하는 값으로 나온다는 보장은 없다. `metadataBase` 설정을 빼먹으면 canonical이 상대 경로 그대로 나가거나, 상속 순서를 잘못 짜면 페이지별 설정이 레이아웃 기본값에 덮여버리는 일이 흔하다. **curl 한 줄로 실제 HTML을 눈으로 보는 게 제일 빠른 확인 방법**이다.

## 정리 — SEO 기본기 체크리스트

robots.txt·sitemap·OG 이미지까지 했다면, 다음은 이 정도면 충분하다.

| 항목 | 역할 | Next.js 구현 |
|---|---|---|
| canonical | 중복 URL 정리 | 각 페이지 `metadata.alternates.canonical` |
| Organization JSON-LD | 브랜드/로고 인식 | 레이아웃에 정적 스크립트 태그 |
| WebSite JSON-LD | 사이트 식별 | 레이아웃에 정적 스크립트 태그 (SearchAction은 실제 기능 있을 때만) |
| Product/Offer JSON-LD | 가격 리치 스니펫 | 표시 가격에서 파생시켜 동기화 유지 |
| 조건부 verification | 검색엔진별 소유 확인 | 환경변수 있을 때만 필드 생성 |

공통 원칙 하나만 남긴다면: **구조화 데이터도 코드다.** 하드코딩된 값이 표시 문구와 따로 놀지 않게 하고, 실제로 없는 기능은 스키마에도 약속하지 말고, 만든 다음엔 눈으로 확인하자.
