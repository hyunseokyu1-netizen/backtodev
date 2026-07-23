---
title: 'AI에게 "너가 구직자라고 생각하고 써봐"라고 시켰더니 진짜 버그를 잡아냈다'
date: '2026-07-08'
publish_date: '2026-08-24'
description: 헤드리스 브라우저로 가상의 구직자 페르소나를 만들어 회원가입부터 RAG 맞춤 이력서 생성까지 직접 구동시키고, 그 과정에서 발견한 AI 사실 날조 버그를 고친 기록
tags:
  - Playwright
  - Claude API
  - RAG
  - QA자동화
  - 프롬프트엔지니어링
---

## 왜 이런 방식으로 테스트했나

내가 만든 이력서 서비스가 실제로 잘 동작하는지 확인하는 가장 확실한 방법은 뭘까. 코드를 눈으로 읽는 것도, 유닛 테스트를 돌리는 것도 아니다. **진짜 사용자처럼 처음부터 끝까지 써보는 것**이다. 이번엔 "해외 취업을 꿈꾸는 5년차 프로덕트 디자이너"라는 가상의 페르소나를 만들어서, 회원가입부터 AI가 맞춤 이력서를 써주는 순간까지 전체 흐름을 직접 구동해봤다.

그냥 눈으로 훑어보고 끝내지 않았다. **브라우저를 실제로 띄워서** 폼에 값을 입력하고, 버튼을 클릭하고, 결과 화면을 스크린샷으로 찍었다. 이 과정에서 겉보기엔 멀쩡해 보였지만 실제로는 사실을 지어내고 있던 버그를 발견했다. 이번 글은 그 과정을 정리한 기록이다.

## 사전 준비 — 브라우저 자동화 도구가 없을 때

보통 이런 작업엔 전용 브라우저 자동화 MCP 도구를 쓰지만, 이번 환경엔 없었다. 대신 프로젝트에 이미 스크래핑용으로 설치돼 있던 `playwright-core`를 재사용하기로 했다. 채용공고 스크래퍼가 봇 차단을 우회할 때 헤드리스 브라우저로 페이지를 렌더링하는 코드가 있었는데, 거기서 쓰던 패키지 그대로다.

```bash
# playwright-core는 있지만 브라우저 실행파일이 없을 수 있다 — 캐시 확인
ls ~/Library/Caches/ms-playwright/
# chromium-1228, chromium_headless_shell-1228 등이 보이면 재사용 가능
```

로컬에 이미 캐시된 Chromium이 있길래, 실행 경로만 직접 지정해서 브라우저를 띄웠다.

```js
const { chromium } = require('/path/to/node_modules/playwright-core')

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/.../ms-playwright/chromium_headless_shell-1228/.../chrome-headless-shell',
})
```

**dev 서버는 백그라운드로 띄우고, `curl`로 응답이 오는지 확인**하는 방식을 썼다. `sleep 5` 같은 걸로 무작정 기다리지 않고, 포트가 실제로 열렸는지 폴링하는 게 훨씬 안정적이다.

```bash
npx next dev -p 3999 &
until curl -sf http://localhost:3999/ >/dev/null; do sleep 1; done
```

## Step 1. 이메일 인증을 사람 없이 통과하기

회원가입을 하면 대부분 서비스가 확인 메일을 보낸다. 자동화 스크립트는 메일함을 열어볼 수 없으니, 이 단계에서 막힌다. 다행히 Supabase는 admin API로 이메일 인증을 이미 완료된 상태로 유저를 만들 수 있다.

```js
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data } = await admin.auth.admin.createUser({
  email: 'haneul.kim.eval@gmail.com',
  password: 'EvalPersona2026!',
  email_confirm: true, // 인증 메일 확인 절차를 건너뜀
})
```

실제로는 UI로 먼저 가입을 시도했다가 "확인 메일을 보냈어요"라는 응답을 받고, 그다음 admin API로 해당 계정만 콕 집어 인증 처리했다. **이메일로 정확히 매칭해서 그 계정만 건드리는 것**이 중요하다 — service role 키는 RLS를 무시하기 때문에, 아무 계정이나 잘못 건드리면 실제 유저 데이터를 오염시킬 수 있다.

## Step 2. 페르소나로 이력서 채우기

"5년차 프로덕트 디자이너 김하늘"이라는 인물을 만들어 실제로 입력했다. 핀테크 앱 리디자인 경험, 디자인 시스템 구축 경험, Figma·User Research 스킬 등을 채웠다.

```js
await page.fill('input[placeholder*="이름"]', '김하늘')
await page.fill('input[placeholder*="직함"]', '프로덕트 디자이너')
await page.fill('textarea[placeholder*="핵심 경력"]',
  '5년차 프로덕트 디자이너입니다. 핀테크 앱의 송금 플로우를 리디자인해 이탈률을 크게 줄였고...')
// 경력, 학력, 스킬도 순서대로 입력
```

저장 → 영어로 동기화까지 진행한 뒤, 실제 채용공고(Canva Product Designer)를 붙여넣어 등록했다. 매칭 점수는 **92%**가 나왔다. JD의 키워드("design system", "user research", "accessibility")와 이력서의 실제 경험이 잘 겹치는 걸 보면, 매칭 로직 자체는 합리적으로 동작하고 있었다.

## Step 3. RAG가 정말 작동하는지 확인하기

이 서비스는 유저가 과거에 만든 맞춤 이력서를 참고해서 새 공고에 맞는 이력서를 쓰는 RAG(검색 증강 생성) 기능이 있다. 이게 진짜 작동하는지 보려면 **공고를 두 개 이상 등록해야** 한다.

1. Canva 공고로 맞춤 이력서 생성 (1건 저장됨)
2. Atlassian "Senior Product Designer, Design Systems" 공고 추가
3. 이 공고에서 다시 맞춤 이력서 생성

두 번째 생성 결과에 이런 배너가 떴다.

> ✨ 이전에 작성한 맞춤 이력서 1건을 참고해 이 공고에 맞췄어요.

실제 생성된 텍스트를 보니, 1차 이력서에서 썼던 "funnel-based decision making" 같은 표현이 2차 이력서에도 자연스럽게 이어져 있었다. 설계된 대로 동작하는 걸 직접 확인한 순간이었다.

## Step 4. 결과물을 꼼꼼히 읽다가 발견한 것 — 사실 날조 3건

여기서 끝냈다면 "RAG 잘 되네" 하고 넘어갔을 텐데, 생성된 이력서 전문을 처음부터 끝까지 읽어봤다. 그러다 세 가지 문제를 발견했다.

| 문제 | 실제 생성된 값 | 원본 데이터 |
|---|---|---|
| 이메일 | `haneul.kim@email.com` | `haneul.kim.eval@gmail.com` |
| 위치 | 공고의 근무지(Sydney, Remote)를 지원자 거주지처럼 표기 | 없음(입력한 적 없음) |
| 직함 | Senior Product Designer | Product Designer |

전부 "그럴듯해서 못 알아챌 수도 있는" 종류의 거짓말이었다. 이메일 도메인이 gmail.com에서 email.com으로 바뀐 건 슬쩍 봐서는 지나치기 쉽고, 공고 근무지를 지원자 거주지처럼 쓴 것도 문맥상 자연스러워 보인다. 직함 승격은 더 위험하다 — 실제 이력서에 없는 직급으로 지원하면 면접에서 바로 들통난다.

## Step 5. 원인 파악 — 프롬프트가 채워달라는 정보를 안 줬다

코드를 열어보니 원인이 명확했다.

```
## 작성 요구사항
- 구성: 이름·연락처 → PROFESSIONAL SUMMARY → KEY SKILLS → WORK EXPERIENCE → EDUCATION
```

프롬프트는 "이름·연락처를 넣어라"고 지시하는데, **정작 실제 연락처 데이터를 프롬프트 안에 넣어주지 않았다.** 모델 입장에서는 "이름 정보는 있는데 연락처가 없네? 이력서 형식엔 있어야 하니까 그럴듯한 값을 만들자"가 된 것이다. 직함도 "JD 요구사항에 맞춰 재구성하라"는 지시가 너무 넓어서, 모델이 직급까지 자기 재량으로 바꿔버렸다.

## Step 6. 수정 — 실제 데이터를 주고, 하지 말아야 할 것을 명시

```ts
// 실제 연락처 — 모델이 지어내지 않도록 명시적으로 제공한다
const realContact = [email, profile.phone, en.links]
  .map(v => v?.trim()).filter(Boolean).join(' · ')
```

```
## 지원자 실제 연락처 (아래 표기를 그대로 사용, 변형·추가 금지)
${realContact || '(연락처 없음 — 연락처 줄을 아예 출력하지 말 것)'}

## 작성 요구사항
- 연락처(이메일·전화·링크)는 위 "실제 연락처"만 그대로 사용할 것.
  이메일 주소나 거주지·위치를 절대 지어내지 말 것
  (원본에 없는 위치는 출력하지 말 것 — 공고의 근무지를 지원자 위치처럼 쓰지 말 것)
- 직함은 원본 이력서의 직함을 유지할 것. 공고 직급(Senior 등)에 맞춰 임의로 올리지 말 것
```

핵심은 두 가지다. **①** "이런 정보가 필요하다"고 요청만 하지 말고 **그 정보를 실제로 프롬프트에 채워 넣을 것**. **②** "~하지 마라"는 지시는 구체적인 시나리오("공고 근무지를 지원자 위치처럼 쓰지 마라")로 못 박아야 모델이 회피 경로를 못 찾는다.

수정 후 같은 공고로 재생성해서 DB에 저장된 실제 텍스트를 직접 확인했다.

```
가짜 이메일(@email.com) 포함: ✓ 없음
실제 이메일 포함: ✓ haneul.kim.eval@gmail.com
Location 날조: ✓ 없음
직함: ✓ Product Designer (원본 유지)
```

## 덤으로 잡은 것 — React hydration 경고

테스트 중 브라우저 콘솔 로그를 계속 확인하고 있었는데, 화면엔 안 보이지만 콘솔에 hydration mismatch 경고가 떠 있었다.

```
- aria-describedby="DndDescribedBy-0"
+ aria-describedby="DndDescribedBy-2"
```

칸반 보드에 쓴 `dnd-kit`의 `DndContext`가 고유 `id`를 지정 안 해주면, 서버 렌더링 시점과 클라이언트 렌더링 시점에 내부적으로 자동 생성하는 접근성 속성(`aria-describedby`) 번호가 어긋난다. `id`를 고정값으로 주면 해결된다.

```tsx
<DndContext id="kanban-board" sensors={sensors} ...>
```

화면에는 아무 문제가 없어 보였지만, 콘솔을 안 봤다면 놓쳤을 경고다.

## 자주 쓰는 패턴 요약

| 목적 | 방법 |
|---|---|
| 헤드리스 브라우저로 실제 플로우 구동 | `playwright-core` + 로컬 캐시된 Chromium 실행파일 경로 지정 |
| 이메일 인증 없이 테스트 계정 생성 | Supabase `admin.auth.admin.createUser({ email_confirm: true })` |
| dev 서버가 뜨는지 확인 | `sleep` 대신 `curl` 폴링 |
| AI 기능 검증 | 화면 스크린샷 + **DB에 저장된 실제 값**을 직접 조회해서 대조 |
| React hydration 경고 방지 | 서버/클라이언트에서 값이 갈릴 수 있는 컴포넌트(DndContext 등)에 고정 `id` 부여 |

## 정리

```
페르소나 설계 → 헤드리스 브라우저로 회원가입~이력서 생성 전체 구동
  → 스크린샷+DB값으로 결과 검증 → RAG 정상 동작 확인
  → 결과물을 사람처럼 정독 → 사실 날조 3건 발견
  → 원인: 프롬프트가 요구하는 정보를 실제로 안 줬음
  → 수정: 실제 데이터 주입 + 금지 시나리오 구체적으로 명시
  → 재생성 후 DB 값으로 재검증
```

이번 작업에서 가장 크게 남은 인상은, **AI 기능은 "잘 작동하는 것처럼 보이는 것"과 "정말 정확한 것" 사이에 생각보다 큰 간극이 있다**는 점이다. 매칭 점수가 높고 문장이 매끄러워도, 그 안에 조용히 지어낸 이메일 하나가 섞여 있을 수 있다. 사람이 처음부터 끝까지 직접 써보고 결과를 한 글자씩 읽는 것 — 이게 자동화 테스트로도 대체하기 어려운 검증 방법이라는 걸 다시 느꼈다.
