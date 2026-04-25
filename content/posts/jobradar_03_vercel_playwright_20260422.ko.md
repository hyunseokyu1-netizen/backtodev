---
title: 'JobRadar 3편: Vercel에 Playwright 올렸더니 터졌다 — @sparticuz/chromium 삽질기'
date: '2026-04-22'
publish_date: '2026-04-26'
description: 로컬에서 잘 되던 스크래퍼가 Vercel에만 올리면 터지는 이유. @sparticuz/chromium 도입부터 ETXTBSY, 60초 타임아웃 대응까지 삽질 전 과정.
tags:
  - JobRadar
  - Playwright
  - Vercel
  - 서버리스
---

[2편](/posts/jobradar_02_scraper_20260421)에서 Playwright 스크래퍼 코드가 완성됐다. 로컬에서 실행해보니 Seek 공고가 잘 긁혔다. 이제 Vercel에 올리기만 하면 된다.

그렇게 생각했다.

> "Vercel에만 올리면 터진다."

이 한 문장이 그날 하루를 통째로 설명한다.

---

## 전체 삽질 타임라인

```
playwright 패키지 사용
  → 빌드 에러 (dynamic import 필요)
  → 모듈 누락 (outputFileTracingIncludes)
  → playwright-extra transitive deps 지옥
  → ETXTBSY (동시 실행 시 바이너리 충돌)
  → playwright-extra 전면 제거
  → @sparticuz/chromium + playwright-core 조합으로 교체
  → 봇 감지 우회 (수동 stealth)
  → 60초 타임아웃 대응 (SCRAPE_TARGET_LIMIT)
  → Seek 38개 공고 저장 성공
```

---

## 사전 준비

- Next.js 14 App Router 프로젝트 (1편에서 세팅 완료)
- Playwright 스크래퍼 코드 (2편에서 구현 완료)
- Vercel 배포 환경 (Hobby 플랜)

최종 패키지 구성:

```bash
npm install playwright-core @sparticuz/chromium
npm uninstall playwright playwright-extra puppeteer-extra-plugin-stealth
```

---

## Step 1 — 처음엔 그냥 playwright 올렸다가 빌드 에러

로컬에서 잘 되니까 그냥 `playwright`를 그대로 배포했다.

**에러 1: 최상단 import 실패**

Next.js App Router에서 서버에서만 동작하는 무거운 모듈을 최상단에서 import하면 빌드 단계에서 터진다.

```ts
// 이렇게 하면 안 됨
import { scrapeSeek } from '@/lib/scrapers/seek'

// 이렇게 해야 함
const { scrapeSeek } = await import('@/lib/scrapers/seek')
```

**에러 2: serverExternalPackages 설정 필요**

```ts
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'playwright-core'],
}
```

이 설정이 없으면 Next.js가 playwright를 번들링하려다 실패한다.

---

## Step 2 — 모듈 누락 지옥

빌드는 됐는데 런타임에서 모듈을 못 찾는다는 에러가 쏟아졌다.

```
Error: Cannot find module 'lazy-cache'
Error: Cannot find module 'is-plain-object'
```

Vercel은 배포할 때 실제로 사용되는 파일만 Lambda 패키지에 포함시킨다 (File Tracing). 동적으로 로드되는 모듈은 이 과정에서 빠져버린다.

`outputFileTracingIncludes`로 수동 명시를 시도했다:

```ts
outputFileTracingIncludes: {
  '/api/scrape': [
    './node_modules/is-plain-object/**',
    './node_modules/clone-deep/**',
    './node_modules/merge-deep/**',
    './node_modules/lazy-cache/**',
    // ...
  ],
},
```

여기까지 와도 새로운 모듈 누락 에러가 계속 나왔다. `playwright-extra`의 플러그인 시스템이 런타임에 동적으로 로드하는 의존성이 끝이 없었다.

> 이쯤에서 판단했다. **playwright-extra 자체를 버리자.**

---

## Step 3 — @sparticuz/chromium + playwright-core로 교체

Vercel Lambda에서 Playwright를 쓰는 표준 방법이 있었다. `@sparticuz/chromium` — Lambda 환경에서 실행 가능하도록 최적화된 Chromium 바이너리를 제공한다.

```bash
npm install playwright-core @sparticuz/chromium
npm uninstall playwright playwright-extra puppeteer-extra-plugin-stealth
```

`next.config.ts`가 대폭 간소화됐다:

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  outputFileTracingIncludes: {
    '/api/scrape': [
      './node_modules/@sparticuz/chromium/**',
      './node_modules/playwright-core/**',
    ],
  },
}
```

모듈 목록이 7개에서 2개로 줄었다.

스크래퍼 코드에서 환경에 따라 Chromium 실행 방식을 분기한다:

```ts
import { chromium } from 'playwright-core'
import chromiumBin from '@sparticuz/chromium'

const isVercel = !!process.env.VERCEL

const browser = await chromium.launch({
  args: isVercel ? chromiumBin.args : [],
  executablePath: isVercel ? await chromiumBin.executablePath() : undefined,
  headless: true,
})
```

- 로컬: `executablePath` 없이 → playwright-core가 알아서 찾음
- Vercel: `@sparticuz/chromium`의 바이너리 경로와 최적화 args 사용

---

## Step 4 — ETXTBSY 해결

두 스크래퍼(Indeed + Seek)를 `Promise.allSettled`로 동시 실행했더니:

```
ETXTBSY: text file busy, open '/tmp/chromium'
```

Lambda 환경의 `/tmp`에 Chromium 바이너리가 압축 해제되는데, 두 프로세스가 동시에 같은 파일을 쓰려다 충돌한 것이다.

```ts
// 이전: 동시 실행 (ETXTBSY 발생)
const [indeed, seek] = await Promise.allSettled([scrapeIndeed(), scrapeSeek()])

// 이후: 순차 실행
const indeedResult = await scrapeIndeed().catch((e: unknown) => ({ error: String(e) }))
const seekResult = await scrapeSeek().catch((e: unknown) => ({ error: String(e) }))
```

성능은 약간 손해지만, Lambda 환경에서는 선택의 여지가 없다.

---

## Step 5 — 봇 감지 우회 (수동 stealth)

playwright-extra를 버렸으니 stealth 플러그인도 없어졌다. 수동으로 처리한다.

```ts
args: [
  ...(isVercel ? chromiumBin.args : []),
  '--disable-blink-features=AutomationControlled',
],
```

```ts
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

await page.setExtraHTTPHeaders({ 'User-Agent': UA })

// navigator.webdriver = true 이면 봇으로 인식됨
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false })
})
```

---

## Step 6 — 60초 타임아웃 대응

Vercel Hobby 플랜의 서버리스 함수 실행 시간 한도는 60초다. 스크래핑 타겟이 많으면 그냥 타임아웃으로 잘린다.

환경변수로 타겟 수를 제한할 수 있게 만들었다:

```ts
const limit = parseInt(process.env.SCRAPE_TARGET_LIMIT ?? '2')
return targets.slice(0, limit)
```

| 환경변수 | 값 | 설명 |
|---|---|---|
| `SCRAPE_TARGET_LIMIT` | `2` | 기본값, 60초 안전권 |
| `SCRAPE_TARGET_LIMIT` | `5` | 여유 있게 실행하고 싶을 때 |

---

## Step 7 — Vercel 리전 시드니로 변경

호주 잡보드를 긁는 거라 미국 리전에서 요청하면 차단될 가능성이 있다.

```json
// vercel.json
{
  "regions": ["syd1"],
  "crons": [...]
}
```

---

## 트러블슈팅 요약

| 에러 | 원인 | 해결 |
|---|---|---|
| 빌드 에러 | 최상단 static import | `await import()` 동적 import |
| `Cannot find module` | File Tracing 누락 | playwright-extra 제거 |
| `ETXTBSY` | /tmp 바이너리 동시 쓰기 | 순차 실행 |
| 봇 감지 차단 | stealth 플러그인 없음 | 수동 UA + webdriver override |
| 60초 타임아웃 | 타겟 수 과다 | `SCRAPE_TARGET_LIMIT` 환경변수 |

---

## 정리 — 최종 구성 한눈에

```
패키지:
  playwright-core + @sparticuz/chromium

next.config.ts:
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core']
  outputFileTracingIncludes: { '/api/scrape': [...] }

스크래퍼 실행 흐름:
  1. VERCEL 환경변수 체크
  2. @sparticuz/chromium의 executablePath + args 사용
  3. 수동 stealth (UA 헤더, webdriver override)
  4. Indeed → Seek 순차 실행 (ETXTBSY 방지)
  5. SCRAPE_TARGET_LIMIT으로 타임아웃 제어

vercel.json:
  regions: ["syd1"]
```

`@sparticuz/chromium`으로 교체하고 나서는 구성이 오히려 더 단순해졌다. playwright-extra가 편리하긴 하지만, Lambda 환경에서는 의존성 복잡도가 발목을 잡는다.

결과적으로 Seek에서 38개 공고를 Supabase에 저장하는 데 성공했다.

근데 기쁨도 잠깐이었다. `inserted: 38`은 됐는데, 실제로 확인해보니 **공고 내용이 엉망**이었다. 봇 감지를 완전히 피하지 못한 거다. 그리고 매일 Cron으로 긁어봤자 관심 없는 공고가 대부분이라는 것도 느꼈다.

이걸 어떻게 해결했는지는 4편에서 다룬다.
