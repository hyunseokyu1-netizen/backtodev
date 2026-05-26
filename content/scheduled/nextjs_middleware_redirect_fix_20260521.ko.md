---
title: 'Next.js + next-intl, /ko/ 리디렉션 오류와 proxy.ts 충돌 삽질기'
date: '2026-05-21'
publish_date: '2026-06-10'
description: Google Search Console 리디렉션 오류를 잡으려다 빌드 에러까지 만난 과정과 proxy.ts 구조 이해
tags:
  - Next.js
  - next-intl
  - SEO
  - middleware
---

Google Search Console을 보다가 이런 항목이 눈에 들어왔다.

> **리디렉션 오류** — 영향받은 페이지 1개  
> `https://backtodev.com/ko/`

사이트는 잘 돌아가고 있었다. `/ko` 로 접근하면 홈이 뜨고, 포스트도 잘 보인다. 그런데 `/ko/` (trailing slash 붙은 버전)에서 리디렉션 오류가 난다고 한다.

원인을 찾다가 `middleware.ts`를 추가했는데, 오히려 빌드 에러가 터졌다. 알고 보니 이미 `proxy.ts`가 있었다.

---

## 1차 시도 — middleware.ts 추가 (삽질)

Next.js + next-intl 구조를 살펴보니 `middleware.ts`가 없었다. next-intl은 로케일 라우팅을 위해 미들웨어가 필요하다. 바로 추가했다.

```ts
// middleware.ts (새로 생성)
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/(ko|en)/:path*",
    "/((?!_next|_vercel|api|.*\\..*).*)",
  ],
};
```

커밋하고 푸시했더니 Vercel 빌드가 터졌다.

```
Error: Both middleware file "./middleware.ts" and proxy file "./proxy.ts"
are detected. Please use "./proxy.ts" only.
```

`proxy.ts`가 이미 존재한다는 것을 몰랐다.

---

## 원인 파악 — proxy.ts가 이미 있었다

프로젝트 루트에 `proxy.ts` 파일이 있었다. Next.js의 특정 버전에서는 `middleware.ts` 대신 `proxy.ts`를 미들웨어 파일로 사용한다. 두 파일이 동시에 존재하면 빌드가 실패한다.

`proxy.ts` 내용을 확인해보니, **이미 next-intl 미들웨어가 포함되어 있었다**.

```ts
// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { verifyToken } from "./lib/auth";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 인증 API는 항상 허용
  if (pathname.startsWith("/api/admin/auth")) return NextResponse.next();

  // /admin 페이지 보호
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const token = request.cookies.get("admin_token")?.value;
    const valid = token ? await verifyToken(token) : false;
    if (!valid) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // 나머지는 next-intl 처리
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/admin/:path*"],
};
```

마지막 줄 `return intlMiddleware(request)` — 어드민 경로가 아닌 모든 요청은 next-intl 미들웨어가 처리하고 있었다. `/ko/` trailing slash 처리도 이미 여기서 담당 중이었다.

---

## proxy.ts 구조 이해

이 프로젝트의 미들웨어는 두 가지 역할을 동시에 한다.

```
요청 들어옴
    ↓
proxy.ts 가로챔
    ├── /api/admin/auth → 통과 (로그인/로그아웃 API)
    ├── /admin/login → 통과
    ├── /admin/* → 토큰 검증 → 실패 시 /admin/login 리다이렉트
    ├── /api/admin/* → 토큰 검증 → 실패 시 401
    └── 나머지 전부 → createIntlMiddleware 처리
                          ├── / → /ko 리다이렉트
                          ├── /ko/ → /ko 정리
                          └── /알수없는경로 → /ko/알수없는경로
```

`middleware.ts`(일반적인 next-intl 설정)와 다른 점은 어드민 보호 로직이 앞단에 결합되어 있다는 것이다. 별도 파일로 분리하면 두 미들웨어가 충돌하기 때문에 하나로 합쳐놓은 구조다.

---

## 해결 — middleware.ts 삭제

내가 만든 `middleware.ts`를 그냥 삭제했다. `proxy.ts`가 이미 모든 걸 처리하고 있었으니까.

```bash
rm middleware.ts
git add middleware.ts
git commit -m "fix: 중복 middleware.ts 제거 — proxy.ts에 이미 intl middleware 포함"
git push origin main
```

빌드 성공. `/ko/` 리디렉션도 `proxy.ts`의 `intlMiddleware`가 원래부터 처리하고 있었다.

---

## 배운 것

**기존 파일부터 확인하자.** 에러를 보고 새 파일을 추가하기 전에, 이미 비슷한 역할을 하는 파일이 있는지 먼저 살펴봤어야 했다.

**Next.js 버전에 따라 middleware 파일명이 다를 수 있다.** 일반적으로는 `middleware.ts`지만, 이 프로젝트처럼 `proxy.ts`를 쓰는 경우도 있다. 두 파일이 동시에 존재하면 빌드 자체가 실패한다.

**next-intl은 다른 미들웨어 로직과 합칠 수 있다.** `createIntlMiddleware`가 반환하는 함수를 직접 호출하는 방식으로, 어드민 인증 같은 커스텀 로직과 하나의 파일에 깔끔하게 통합할 수 있다.

---

## 정리

```
Google Search Console: /ko/ 리디렉션 오류 발생
    ↓
middleware.ts 없다고 판단 → 새로 생성
    ↓
빌드 에러: proxy.ts와 middleware.ts 동시 존재 불가
    ↓
proxy.ts 확인 → 이미 createIntlMiddleware 포함되어 있음
    ↓
middleware.ts 삭제 → 빌드 성공
    ↓
/ko/ 리디렉션은 원래부터 proxy.ts가 처리 중이었음
```

Search Console 오류는 Google이 재크롤링하면 자연스럽게 해소된다.
