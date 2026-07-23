---
title: '블로그 발행을 자동화해보자 (10) 남의 계정에 로그인해야 할 때 — Browserbase를 고른 이유와 실제 사용법'
date: '2026-07-09'
publish_date: '2026-09-01'
description: 비밀번호를 한 번도 안 거치고 남의 티스토리/네이버 계정을 연동하는 방법으로 Browserbase를 선택한 이유와, 세션 생성부터 로그인 감지까지 실제 연동 코드
tags:
  - Browserbase
  - Playwright
  - SaaS
  - 브라우저자동화
  - Next.js
---

8편에서 SaaS 전환을 결정하면서 가장 어려운 기술 문제로 꼽았던 게 "사용자가 자기 티스토리/네이버 계정을 어떻게 연동시키느냐"였습니다. 이번 편에서는 그 답으로 고른 **Browserbase**를 왜 골랐는지, 그리고 실제로 어떻게 붙였는지를 정리합니다.

## 문제: 남의 비밀번호를 우리가 다루면 안 된다

지금까지 이 도구는 제 개인 계정으로만 썼습니다. 로컬에서 제가 직접 브라우저로 로그인하고, 그 세션 쿠키를 저장해 재사용하는 방식이었죠(3편 참고). 그런데 다른 사람도 쓰게 하려면, "사용자의 아이디/비밀번호를 입력받아서 우리 서버가 대신 로그인한다"는 선택지가 있습니다 — 하지만 이건 하면 안 됩니다. 비밀번호를 우리 데이터베이스에 저장하거나 코드로 다루는 순간, 유출 시 책임과 신뢰 문제가 전부 우리 몫이 됩니다.

검토한 대안은 세 가지였습니다.

| 방식 | 비밀번호 처리 | 인프라 비용 | 사용자 경험 |
|---|---|---|---|
| **원격 브라우저(Browserbase) 임베드** | 우리 서버를 전혀 거치지 않음 | 세션당 과금 | 버튼 하나로 끝, 설치 불필요 |
| 브라우저 확장 프로그램 | 우리 서버를 전혀 거치지 않음 | 없음 | 확장 설치라는 진입 장벽 |
| 수동 쿠키 붙여넣기 | 우리 서버를 전혀 거치지 않음 | 없음 | 개발자도구를 열어야 해서 비현실적 |

셋 다 "비밀번호를 안 다룬다"는 원칙은 지킵니다. 차이는 온보딩 경험과 비용입니다. 확장 프로그램은 별도로 만들고 배포·유지보수해야 하는 부담이 있고, 수동 쿠키는 일반 사용자에게 너무 기술적입니다. 매끄러운 온보딩을 우선순위로 두고 Browserbase를 골랐습니다.

## Browserbase가 하는 일

한 줄로 요약하면 "원격 서버에 크롬 브라우저를 띄워주고, 그 화면을 우리 웹사이트 안에 그대로 보여주는 서비스"입니다. 사용자는 우리 사이트를 벗어나지 않고도 실제로는 Browserbase의 서버에서 돌아가는 브라우저 안에서 로그인을 완료하게 됩니다.

이미 이 프로젝트에서 `playwright-core`로 헤드리스 크롬을 조작하는 코드(`tistory-publish.ts`)가 있었기 때문에, Browserbase를 고른 실용적인 이유가 하나 더 있습니다 — **새 라이브러리를 배울 필요가 없습니다.** `chromium.connectOverCDP()` 한 줄이면 원격 브라우저에 우리 Playwright 코드가 그대로 붙습니다.

```typescript
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
const session = await bb.sessions.create({ projectId, keepAlive: true });

const browser = await chromium.connectOverCDP(session.connectUrl);
// 이제부터는 로컬 크롬을 조작하던 것과 완전히 같은 Playwright API
```

## 실제 연동 흐름

```
[사용자] "네이버 연동" 버튼 클릭
   → POST /api/blog-connect/start
      Browserbase 세션 생성(keepAlive: true) → 로그인 페이지로 미리 이동
      → { sessionId, liveViewUrl } 응답

[화면] liveViewUrl을 iframe에 그대로 띄움
   → 사용자가 그 화면 안에서 직접 아이디/비밀번호 입력, 로그인 완료

[폴링] GET /api/blog-connect/status?sessionId=...  (2초 간격)
   원격 세션에 다시 접속해서 로그인 완료를 나타내는 쿠키(NID_AUT 등)가
   생겼는지만 확인 — 있으면 "연동 완료" 버튼 활성화

[사용자] "연동 완료" 클릭
   → POST /api/blog-connect/finish
      원격 세션에 재접속 → storageState()로 쿠키 캡처 → Redis에 저장
      → Browserbase 세션 종료
```

여기서 중요한 설계 포인트가 `keepAlive: true`입니다. Browserbase 세션은 기본적으로 CDP 연결이 끊기면 세션 자체도 종료됩니다. `keepAlive`를 켜두면 우리가 연결을 끊었다 나중에 다시 붙어도 세션이 살아있습니다. 이게 없으면 "로그인 페이지 띄우기 → 사용자 로그인 대기 → 완료 후 재접속해서 쿠키 캡처"라는, 연결을 여러 번 끊었다 붙이는 이 흐름 자체가 불가능합니다.

이 가정이 진짜 맞는지 코드를 짜기 전에 먼저 스모크 테스트로 확인했습니다.

```typescript
const session = await bb.sessions.create({ keepAlive: true });
const browser1 = await chromium.connectOverCDP(session.connectUrl);
await browser1.contexts()[0].pages()[0].goto('https://example.com');
await browser1.close(); // 로컬 연결만 끊음

const browser2 = await chromium.connectOverCDP(session.connectUrl); // 재접속
console.log(browser2.contexts()[0].pages()[0].url()); // → example.com 그대로 유지됨 ✅
```

## 로그인 완료를 자동으로 넘기지 않은 이유

폴링에서 로그인 쿠키가 확인돼도, 곧바로 `finish`를 자동 호출하지 않고 사용자가 직접 "연동 완료" 버튼을 누르게 했습니다. 이유는 이 시리즈에서 계속 반복된 교훈과 같습니다 — 로그인 쿠키가 생겼다고 해서 로그인이 "완전히" 끝난 게 아닐 수 있습니다. 2차 인증, 추가 확인 화면 같은 게 남아있을 수 있는데, 그 상태에서 세션을 캡처해버리면 나중에 발행 시점에야 문제가 드러납니다. 사용자가 화면을 직접 보고 "이제 다 됐다"고 판단한 시점에 캡처하는 게 훨씬 안전합니다.

## 부딪힌 문제 1: 프리 플랜에서 프록시가 막혔다

한국 IP로 카카오/네이버 로그인을 시도하려고 국가별 프록시를 설정했는데, 실제로 써보니 이런 에러가 났습니다.

```
402 Proxies are not included in the free plan. Please upgrade to a paid plan to continue
```

프록시(지역 IP 지정)는 유료 플랜부터 지원되는 기능이었습니다. 일단 프록시 없이 실제로 로그인이 막히는지부터 확인해보기로 하고, 코드는 환경변수로 켜고 끌 수 있게 만들어뒀습니다.

```typescript
...(process.env.BROWSERBASE_USE_KR_PROXY === 'true'
  ? { proxies: [{ type: 'browserbase', geolocation: { country: 'KR' } }] }
  : {}),
```

## 부딪힌 문제 2: 화면이 너무 작아서 캡차를 못 읽는다

실사용 테스트 중, 원격 브라우저 화면을 작은 모달 박스에 욱여넣다 보니 캡차 이미지(영수증 사진에서 숫자 읽기 같은) 글자가 안 보인다는 피드백을 받았습니다. 두 가지로 해결했습니다.

1. **모달 자체를 화면의 96%까지 키움** (기존엔 폭 720px짜리 작은 박스였음)
2. **iframe에 자체 확대/축소 버튼 추가** — CSS `transform: scale()`로 원격 화면 자체를 확대하고, 넘치는 부분은 스크롤

```tsx
<iframe
  src={liveViewUrl}
  style={{ width: '100%', height: '100%', transform: `scale(${zoom})`, transformOrigin: 'top left' }}
/>
```

추가로 Browserbase 세션 자체의 해상도(`browserSettings.viewport`)도 넉넉하게(1440×1000) 올려서, 축소 없이도 처음부터 좀 더 선명하게 뜨도록 했습니다.

## 정리

| 결정 | 이유 |
|---|---|
| 브라우저 확장 대신 원격 브라우저 | 설치 없는 매끄러운 온보딩이 우선순위 |
| Browserbase 선택 | 이미 쓰던 Playwright 코드를 그대로 재사용 가능 |
| `keepAlive: true` | 연결을 끊었다 붙였다 하는 흐름 자체의 전제조건 |
| 로그인 감지 후 자동 캡처 안 함 | "화면상 로그인됨"과 "실제로 완전히 끝남"은 다를 수 있음 |
| 프록시는 env var로 조건부 | 프리 플랜 제약에 안전하게 대응, 유료 전환 시 한 줄로 켜짐 |

결국 이번에도 "실제로 되는지 코드 짜기 전에 스모크 테스트로 확인한다"는 습관이 제일 크게 작용했습니다. Browserbase의 `keepAlive` 재접속 동작은 공식 문서만 봐서는 확신이 안 서는 부분이었는데, 10줄짜리 스크립트로 5분 만에 확인하고 나니 그 뒤 설계가 훨씬 편해졌습니다.
