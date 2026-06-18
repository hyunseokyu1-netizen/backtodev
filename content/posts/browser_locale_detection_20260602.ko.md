---
title: '외국 사용자에게 영어 페이지 보여주기 — IP 말고 브라우저 언어로'
date: '2026-06-02'
publish_date: '2026-06-19'
description: Next.js 16 proxy.ts에서 Accept-Language 헤더로 언어를 자동 감지하고, 쿠키로 선택을 유지하는 구현 과정
tags:
  - Next.js
  - i18n
  - next-intl
  - 다국어
---

## 한국 사람만 오는 블로그는 아니니까

블로그에 영어 번역을 붙였는데, 기본 언어가 한국어로 고정되어 있었다.

해외에서 들어오는 사람은 주소를 직접 `/en/`으로 바꾸지 않는 이상 계속 한국어를 보게 된다. 접근성이 나쁘다.

"외국에서 접속하면 영어로 자동으로 보여주면 좋겠다."

방법은 두 가지였다.

1. **IP 기반 감지** — 접속 IP 주소로 국가를 판단
2. **브라우저 언어 감지** — `Accept-Language` 헤더로 사용자 언어 환경 파악

---

## IP 기반 감지를 선택하지 않은 이유

IP로 국가를 판단하는 건 생각보다 복잡하다.

| 문제 | 설명 |
|------|------|
| 외부 API 필요 | IP → 국가 변환은 직접 구현이 어렵고, MaxMind나 ipapi 같은 서비스가 필요 |
| 비용 발생 가능 | 무료 플랜에 호출 제한이 있음 |
| VPN 우회 | VPN 쓰는 사람은 다른 나라 IP로 잡힘 |
| 정확도 한계 | 국내에서 해외 서버 쓰는 경우 잘못 분류됨 |
| 레이턴시 | 외부 API 호출이 매 요청에 추가됨 |

그리고 결정적으로 — IP가 한국이라도 브라우저가 영어 설정이면 영어로 보고 싶을 수 있다. 반대로 해외 거주 한국인은 브라우저가 한국어 설정일 가능성이 높다.

**위치보다 사용자의 언어 설정이 더 신뢰할 수 있는 정보다.**

---

## Accept-Language 헤더란

브라우저는 서버에 요청을 보낼 때 자동으로 이 헤더를 붙인다.

```
Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7
```

- `ko-KR` — 1순위: 한국어(한국)
- `ko` — 2순위: 한국어
- `en-US;q=0.8` — 3순위: 영어(미국), 선호도 0.8
- `en;q=0.7` — 4순위: 영어, 선호도 0.7

영어 브라우저라면 이렇게 온다.

```
Accept-Language: en-US,en;q=0.9
```

외부 API 없이, 헤더 하나만 읽으면 언어 환경을 알 수 있다. 비용도 없고, 추가 레이턴시도 없다.

---

## 구현

이 블로그는 Next.js 16 + next-intl 구조다. Next.js 16에서는 `middleware.ts` 대신 `proxy.ts`가 서버 요청을 가로채는 역할을 한다.

### Step 1 — 언어 감지 함수 작성

```typescript
const LOCALE_COOKIE = "NEXT_LOCALE";

function detectLocale(request: NextRequest): "en" | "ko" {
  // 쿠키에 이미 선택한 언어가 있으면 그걸 우선 사용
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie === "en" || cookie === "ko") return cookie;

  // Accept-Language 헤더에서 ko 또는 ko-KR이면 한국어
  // 그 외 모든 언어(영어, 일본어, 프랑스어...)는 영어로
  const acceptLang = request.headers.get("accept-language") ?? "";
  return /\bko\b/.test(acceptLang) ? "ko" : "en";
}
```

우선순위:
1. **쿠키** — 사용자가 직접 언어를 바꾼 적이 있으면 그 선택을 존중
2. **Accept-Language** — 처음 방문이라면 브라우저 언어 설정으로 판단

`\bko\b` 정규식을 쓰는 이유는 `ko`를 단어 경계로 잡기 위해서다. `ko-KR`, `ko`는 매칭되고, `ko` 가 포함된 다른 언어 코드는 걸러진다.

---

### Step 2 — proxy.ts에 리디렉션 로직 추가

```typescript
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ... admin 인증 처리 ...

  // locale 접두사 없는 요청만 감지 대상
  // /en/posts, /ko/posts 처럼 이미 locale이 있으면 그냥 통과
  const hasLocalePrefix = /^\/(en|ko)(\/|$)/.test(pathname);

  if (!hasLocalePrefix) {
    const locale = detectLocale(request);
    if (locale === "en") {
      const target = new URL(request.url);
      target.pathname = `/en${pathname}`;
      return NextResponse.redirect(target);
    }
    // ko면 intlMiddleware가 /ko/로 알아서 처리
  }

  return intlMiddleware(request);
}
```

흐름:

```
/ 접속
├── locale prefix 있음? (/en/, /ko/) → intlMiddleware 처리
└── 없음 → detectLocale 실행
    ├── 쿠키 있음 → 쿠키 값으로 리디렉션
    ├── Accept-Language: ko* → /ko/ (intlMiddleware 처리)
    └── 그 외 → /en/ 으로 리디렉션
```

한국어는 `defaultLocale`이 `ko`이기 때문에, `intlMiddleware`에 맡기면 자동으로 `/ko/`로 보내준다. 영어만 명시적으로 리디렉션하면 된다.

---

### Step 3 — 사용자가 언어를 바꾸면 쿠키에 저장

Nav 컴포넌트의 EN/KO 토글 버튼에 쿠키 저장 코드를 추가했다.

```typescript
const toggleLocale = () => {
  const next = locale === "ko" ? "en" : "ko";
  // 1년 유지되는 쿠키 설정
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
  router.replace(cleanPath, { locale: next });
};
```

이제 사용자가 직접 언어를 바꾸면, 다음 방문 때도 그 설정이 유지된다. Accept-Language보다 쿠키가 우선이기 때문에 사용자 선택이 항상 존중된다.

---

## 테스트 방법

시스템 언어를 바꾸지 않아도 된다. curl로 간단히 확인할 수 있다.

```bash
# 영어 브라우저 시뮬레이션 → /en/ 리디렉션 확인
curl -I -H "Accept-Language: en-US" http://localhost:3000/
# Location: http://localhost:3000/en 이 나와야 함

# 한국어 브라우저 시뮬레이션 → /ko/ 리디렉션 확인
curl -I -H "Accept-Language: ko-KR" http://localhost:3000/
# Location: http://localhost:3000/ko/ 이 나와야 함

# 프랑스어 브라우저 → 영어로 처리되는지 확인
curl -I -H "Accept-Language: fr-FR" http://localhost:3000/
# Location: http://localhost:3000/en 이 나와야 함
```

Chrome DevTools에서 테스트하려면:

1. DevTools 열기 → Network 탭
2. 우측 상단 ⋮ → **Network conditions**
3. Accept-Language에서 "Use browser default" 해제
4. 원하는 값 입력 후 새로고침

---

## 정리

| | IP 기반 | Accept-Language |
|--|---------|-----------------|
| 외부 API | 필요 | 불필요 |
| 추가 비용 | 발생 가능 | 없음 |
| VPN 우회 | 취약 | 무관 |
| 정확도 | 위치 기준 | 사용자 설정 기준 |
| 구현 난이도 | 높음 | 낮음 |

Accept-Language가 더 정확하고, 구현도 단순하고, 비용도 없다. IP 기반을 선택할 이유가 딱히 없었다.

```
최종 언어 결정 우선순위:

1. NEXT_LOCALE 쿠키 (사용자가 직접 선택한 경우)
2. Accept-Language 헤더 (ko/ko-KR → 한국어, 그 외 → 영어)
3. 기본값 없음 (2번에서 항상 결정됨)
```

사용자가 언어를 직접 바꾸면 쿠키에 저장되어, 이후 방문에서도 자신의 선택이 유지된다.
