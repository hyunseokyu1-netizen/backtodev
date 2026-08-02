---
title: 'Next.js로 SEO 기본기 세팅하기 — robots, sitemap, OG 이미지까지 코드로'
date: '2026-07-10'
publish_date: '2026-08-03'
description: 로그인 위주 서비스에서 SEO 작업 범위를 공개 페이지로 좁히고, robots.txt·sitemap.xml·OG 이미지를 Next.js 파일 컨벤션으로 세팅하다가 미들웨어가 이 파일들을 전부 막고 있던 버그까지 잡은 기록
tags:
  - Next.js
  - SEO
  - App Router
  - 미들웨어
  - next/og
---

## 왜 SEO 세팅이 필요했나

매치다(MatchDa) 서비스를 점검하다가 SEO가 거의 손도 안 대져 있다는 걸 알게 됐다. `robots.txt`도 `sitemap.xml`도 없었고, 루트 레이아웃의 메타데이터는 `title`과 `description` 딱 두 줄이 전부였다. `metadataBase`도 없고 OG(Open Graph)·Twitter 카드 설정도 없어서, **카카오톡이나 슬랙에 링크를 붙여넣어도 미리보기가 안 떴다.** 전체 22개 페이지 중에서 자체 메타데이터를 가진 건 이용약관·개인정보처리방침 같은 법적 페이지 4개뿐이었고, 정작 검색에 잡혀야 할 랜딩·요금제·소개 페이지엔 아무것도 없었다.

이번 글은 이걸 처음부터 세팅한 기록이다. 그 과정에서 겉보기엔 멀쩡해 보였지만 실제로는 SEO 파일들을 전부 무력화하고 있던 버그도 하나 잡았는데, 그 얘기가 사실 이 글의 핵심이다.

## Step 1. 작업 범위부터 좁히기

22개 페이지를 전부 손볼 필요는 없었다. 매치다는 로그인해야 쓸 수 있는 서비스라, 로그인 안 한 사람(그리고 검색엔진 크롤러)이 실제로 콘텐츠를 볼 수 있는 페이지는 몇 개 안 된다. 이걸 확인하는 가장 빠른 방법은 인증 미들웨어의 공개 경로 화이트리스트를 보는 것이었다.

```ts
// src/middleware.ts
const PUBLIC_PATHS = ['/', '/about', '/pricing', '/terms', '/privacy', '/refund', '/support', ...]
```

여기 있는 7개가 SEO 작업의 전부다. 나머지(대시보드, 워크스페이스, 설정 등)는 로그인 안 하면 어차피 `/login`으로 튕겨나가니, 검색엔진이 크롤링해봤자 인덱싱할 콘텐츠가 없다. **"로그인 후 사용" 위주 서비스에서 SEO 작업의 첫 단계는 전체 페이지 목록이 아니라 미들웨어의 공개 경로부터 확인하는 것**이라는 걸 이번에 배웠다.

## Step 2. robots.txt — 파일 하나로 끝

Next.js App Router는 `src/app/robots.ts` 파일을 만들면 `/robots.txt`를 자동으로 생성해준다. 별도 라우트 핸들러를 짤 필요가 없다.

```ts
// src/app/robots.ts
import type { MetadataRoute } from 'next'

const SITE_URL = 'https://matchda.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/about', '/pricing', '/terms', '/privacy', '/refund', '/support'],
      disallow: [
        '/dashboard', '/applications', '/discover', '/profile', '/workspace',
        '/settings', '/onboarding', '/login', '/auth', '/api', '/matchda', '/r/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

`/r/<slug>`(유저가 만든 공개 이력서 공유 링크)를 `disallow`에 넣은 게 포인트다. 이 페이지는 "링크를 아는 사람만 보라"는 의도로 만든 기능이라, 로그인 없이 접근은 되지만 검색 노출은 원치 않는다. 접근 가능 = 검색 노출 허용이 아니라는 걸 명시적으로 갈라줘야 한다.

## Step 3. sitemap.xml — 같은 방식으로

`src/app/sitemap.ts`도 마찬가지로 파일 컨벤션이다. 공개 페이지 7개를 등록하고, 중요도에 따라 `priority`를 다르게 줬다.

```ts
// src/app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    // ...
  ]
}
```

랜딩 페이지가 1.0, 소개·요금제가 0.8, 법적 페이지들은 0.2 — 자주 안 바뀌고 검색 우선순위도 낮은 페이지는 낮게 잡았다.

## Step 4. OG 이미지 — 디자인 툴 없이 코드로

링크 공유 미리보기 이미지를 만들려면 보통 디자인 툴이 필요하다고 생각하기 쉬운데, Next.js는 `next/og`의 `ImageResponse`로 **이미지를 서버에서 요청 시점에 렌더링**할 수 있게 해준다. `src/app/opengraph-image.tsx` 파일 하나면 끝이다.

```tsx
// src/app/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  // public 폴더의 로고 파일을 읽어서 base64로 임베드
  const logoData = await readFile(join(process.cwd(), 'public', 'matchda-mark.png'))
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', background: '#F7FBF9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src={logoSrc} alt="" width={84} height={84} style={{ borderRadius: 20 }} />
          <span style={{ fontSize: 64, fontWeight: 700, color: '#0C1A14' }}>MatchDa</span>
        </div>
        <div style={{ marginTop: 32, fontSize: 34, fontWeight: 600, color: '#0B1A12' }}>
          한국어 이력서를 전문가 수준 영어로,
        </div>
        <div style={{ marginTop: 8, fontSize: 34, fontWeight: 600, color: '#046C4E' }}>
          해외 채용 공고에 맞춰 자동으로.
        </div>
      </div>
    ),
    { ...size }
  )
}
```

`ImageResponse`가 받는 JSX는 일반 React가 아니라 제한된 서브셋(flexbox 기반 스타일만 지원)인데, 로컬 이미지 파일을 쓰려면 `<Image>` 컴포넌트가 아니라 `fs.readFile`로 직접 읽어서 base64 data URI로 변환한 뒤 평범한 `<img>` 태그에 넣어야 한다. 이 패턴 하나만 알면 로고가 들어간 브랜드 OG 이미지를 코드만으로 만들 수 있다.

만들고 나서 바로 결과물을 PNG로 받아서 눈으로 확인했다. 코드가 문법적으로 맞다고 결과물이 예쁘게 나온다는 보장은 없으니, 실제로 열어보는 게 중요하다.

## Step 5. 메타데이터 상속 구조 잡기

루트 레이아웃에 `metadataBase`와 `title` 템플릿을 추가했다.

```ts
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://matchda.com'),
  title: {
    default: 'MatchDa — 한국 인재를 위한 글로벌 커리어 플랫폼',
    template: '%s — MatchDa',
  },
  description: '...',
  openGraph: {
    // ...
    images: ['/opengraph-image'],  // 하위 페이지가 따로 안 정하면 이걸 상속
  },
}
```

`title.template`이 핵심이다. 이렇게 해두면 하위 페이지는 `title: '요금제'`처럼 짧게만 써도 실제로는 `"요금제 — MatchDa"`로 자동 완성된다. `openGraph.images`도 마찬가지로, 하위 페이지가 이미지를 따로 안 정하면 방금 만든 OG 이미지를 그대로 물려받는다.

## 트러블슈팅 — 코드 리뷰만으로는 못 잡는 버그 두 개

### 버그 1. title이 두 번 겹침

`title` 템플릿을 추가하고 나서, 기존에 이미 메타데이터가 있던 4개 페이지(이용약관·개인정보처리방침·환불정책·고객센터)를 다시 봤다.

```ts
// Before — 이미 "— MatchDa"까지 박아둔 상태
export const metadata = { title: '환불 정책 — MatchDa' }
```

템플릿(`%s — MatchDa`)과 이 값이 합쳐지면 `"환불 정책 — MatchDa — MatchDa"`가 되어버린다. **템플릿을 도입하는 순간, 기존에 하위 페이지들이 스스로 접미사를 붙이고 있던 건 아닌지 전부 재점검해야 한다.** 4개 페이지 전부 짧은 제목으로 바꾸고, 없던 `description`도 새로 추가했다.

```ts
// After
export const metadata = {
  title: '환불 정책',
  description: 'MatchDa 프리미엄 구독의 환불 가능 조건, 제한 사유, 요청 방법을 안내합니다.',
}
```

### 버그 2. robots.txt조차 로그인 페이지로 리다이렉트되고 있었다

여기가 진짜였다. 다 만들어놓고 브라우저로 직접 접속해봤다.

```bash
curl -s http://localhost:3999/robots.txt
# → /login  (?!)
```

`robots.txt`가 `/login`으로 리다이렉트되고 있었다. `sitemap.xml`도, 방금 만든 `opengraph-image`도, 심지어 파비콘(`icon.svg`, `apple-icon.png`)까지 전부 마찬가지였다.

원인은 인증 미들웨어의 `matcher` 설정이었다.

```ts
// Before
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
}
```

이 정규식은 "이 목록에 없는 모든 경로는 미들웨어를 통과시켜라(=로그인 체크를 해라)"는 뜻이다. `_next/static`, `api` 같은 건 제외돼 있었지만, `robots.txt`·`sitemap.xml`·`opengraph-image`처럼 **새로 생긴 Next.js 파일 컨벤션 경로들은 이 목록에 없었다.** 그래서 이것들도 평범한 페이지 취급을 받아 "로그인 안 했으니 `/login`으로 보내" 로직을 그대로 탄 것이다.

즉 지금까지 검색엔진이 `robots.txt`조차 제대로 못 읽고 있었을 가능성이 있었다는 뜻이다. 아무리 `robots.ts`를 잘 짜도, 그 앞단에서 미들웨어가 리다이렉트를 걸어버리면 크롤러 입장에선 `robots.txt`가 아니라 로그인 페이지 HTML을 받게 된다.

```ts
// After
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|auth/callback|robots.txt|sitemap.xml|opengraph-image|icon.svg|apple-icon.png).*)',
  ],
}
```

이 버그의 교훈은 명확하다. **SEO 관련 파일은 코드가 문법적으로 맞다고 끝난 게 아니라, 실제로 HTTP 요청을 날려서 응답을 확인해야 한다.** `robots.ts` 코드만 리뷰했다면 "잘 만들었네"로 끝났을 텐데, 미들웨어라는 전혀 다른 레이어가 조용히 이걸 다 막고 있었다. 코드 리뷰로는 절대 못 잡는 종류의 문제였다.

## 검증

수정하고 나서 다시 curl로 확인했다.

```bash
curl -s http://localhost:3999/robots.txt
# User-Agent: *
# Allow: /
# Allow: /about
# ...
# Sitemap: https://matchda.com/sitemap.xml

curl -s -o /dev/null -w "%{content_type} %{size_download}\n" http://localhost:3999/opengraph-image
# image/png 37825
```

그리고 미들웨어를 건드렸으니, **보호돼야 할 페이지가 실수로 뚫리지 않았는지도 꼭 재확인**했다.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3999/dashboard
# 307  ← 여전히 로그인으로 리다이렉트됨(정상)
```

SEO 파일들이 열리게 하려고 matcher를 넓혔는데, 그 과정에서 정작 지켜야 할 보호 경로까지 같이 뚫려버리면 그게 더 큰 사고다. 바뀐 설정이 "의도한 것만" 풀어줬는지 확인하는 이 단계를 빼먹지 않는 게 중요하다.

## 자주 쓰는 패턴 요약

| 목적 | 방법 |
|---|---|
| robots.txt 생성 | `src/app/robots.ts` (파일 컨벤션, 코드 반환) |
| sitemap.xml 생성 | `src/app/sitemap.ts` (파일 컨벤션) |
| 동적 OG 이미지 | `src/app/opengraph-image.tsx` + `next/og`의 `ImageResponse` |
| 로컬 이미지를 OG 이미지에 임베드 | `fs.readFile` → `base64` data URI → `<img src="data:...">` |
| 하위 페이지 title 자동 완성 | 루트 `metadata.title = { default, template: "%s — 브랜드명" }` |
| 미들웨어가 특수 라우트를 막고 있는지 확인 | `curl -s -o /dev/null -w "%{http_code}"`로 직접 요청 |

## 정리

```
공개 페이지 범위 확정(미들웨어 화이트리스트 확인, 22개 중 7개만 해당)
  → robots.ts / sitemap.ts (파일 컨벤션으로 자동 생성)
  → opengraph-image.tsx (next/og로 코드에서 PNG 렌더링, 로고는 fs+base64로 임베드)
  → layout.tsx에 metadataBase + title 템플릿 + OG/Twitter 기본값
  → 기존 4개 페이지의 title 중복 수정
  → curl로 실제 응답 확인 → 미들웨어가 SEO 라우트를 로그인 페이지로 막고 있던 버그 발견
  → matcher 수정 → 재검증(SEO 라우트는 열림, 보호 페이지는 여전히 막힘)
```

이번 작업에서 가장 크게 남은 인상은, **SEO 세팅은 "그럴듯한 코드를 작성했는가"가 아니라 "실제로 그 경로에 요청을 날렸을 때 뭐가 오는가"로 검증해야 한다**는 것이다. `robots.ts`·`sitemap.ts`·OG 이미지 코드는 전부 문법적으로 완벽했다. 문제는 그 앞단의 미들웨어였고, 이건 curl 한 번 안 날려봤다면 배포하고 몇 주가 지나도 몰랐을 종류의 버그다.
