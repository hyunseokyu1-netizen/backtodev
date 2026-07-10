---
title: 'Stripe 계정 국가에 한국이 없어서 Paddle로 갈아탄 이야기'
date: '2026-07-08'
publish_date: '2026-07-17'
description: 한국에서 SaaS를 운영하며 Stripe 계정을 미국으로 만들 수밖에 없었던 문제를 Paddle(Merchant of Record)로 전환하며 해결한 기록
tags:
  - Paddle
  - Stripe
  - 결제연동
  - SaaS
  - Next.js
---

## 왜 이 글을 쓰게 됐나

매치다(MatchDa)라는 해외 취업 지원 이력서 서비스를 한국에서 개인으로 운영하고 있다. 프리미엄 구독 결제를 붙이려고 Stripe 계정을 만드는데, 국가 선택 화면에 **대한민국이 아예 없었다.** Stripe가 정식 지원하는 국가 목록에 한국이 빠져 있는 건 꽤 알려진 사실인데, 막상 직접 겪으니 당황스러웠다. 어쩔 수 없이 "미국"을 선택해서 계정을 만들었다.

문제는 그다음이었다. 서비스를 운영하던 중 Stripe가 "추가 정보를 입력해주세요"라는 화면을 띄웠다. 겉보기엔 평범한 안내 문구였지만, 실제로는 **"당신이 진짜 미국 사업자가 맞는지 증명하라"**는 요구였다. 나는 미국 법인도, 미국 은행 계좌도 없는 한국 개인 사업자다. 이 요구를 통과할 방법이 없었다.

이 글은 이 문제를 어떻게 판단하고, Paddle이라는 다른 결제 서비스로 코드를 전환한 과정을 정리한 기록이다. 한국(또는 Stripe 미지원 국가)에서 SaaS를 혼자 또는 소규모로 운영하는 개발자라면 언젠가 반드시 마주칠 문제라서, 겪은 그대로 남겨둔다.

## 왜 "미국으로 설정"이 진짜 문제였나

처음엔 "그냥 미국으로 해두면 되지 않나?"라고 가볍게 생각했다. 그런데 알아볼수록 이게 단순히 국적 표시 문제가 아니라는 걸 알게 됐다. **Stripe 계정의 국가는 법적 사업자 소재지를 의미한다.** 계정을 미국으로 만들면 Stripe는 그 계정을 실제 미국 사업자로 취급하고, 그에 맞는 규정을 적용한다.

실제 미국 법인(EIN)·미국 주소·미국 은행 계좌가 없는 상태에서 이 설정을 유지하면 세 가지 문제가 기다리고 있었다.

1. **KYC(신원 확인)를 통과하지 못한다.** Stripe는 계정이 일정 매출을 넘거나 이상 징후가 보이면 신원 확인을 강화한다. 이때 요구하는 서류(미국 법인 등록증 등)를 제출할 수가 없다.
2. **통과해도 정산(payout)이 막힌다.** Stripe는 보통 계정 국가와 같은 나라의 은행 계좌로만 입금한다. 미국 계좌가 없으면 매출이 Stripe 안에 그대로 묶여버린다.
3. **세금 신고가 꼬인다.** 계정이 미국 사업자로 분류되면 미국 국세청(IRS) 기준 세금 신고 대상이 될 수 있는데, 이건 한국 거주자로서 해야 하는 세금 신고와는 완전히 별개의 절차다.

이걸 정리하고 나니 선택지는 두 가지로 좁혀졌다.

| 선택지 | 내용 | 트레이드오프 |
|---|---|---|
| **Stripe Atlas로 진짜 미국 법인 만들기** | Delaware C-Corp 설립 + EIN 발급 + Mercury 같은 미국 은행 계좌 개설 | 법인 유지비, 미국 법인세 신고 부담이 생김. 매출 규모가 커질 계획이면 고려할 만함 |
| **Merchant of Record(MoR) 결제사로 전환** | Paddle 같은 서비스가 "판매자" 역할을 대신 맡아줌 | 한국 개인/사업자도 미국 법인 없이 바로 정산 가능. 수수료는 Stripe보다 다소 높음 |

초기 단계 SaaS를 혼자 운영하는 입장에서는 법인 설립·유지 비용과 세무 복잡도를 감당하기 어려웠다. **Paddle로 전환하는 쪽이 훨씬 현실적**이라고 판단했다.

### MoR(Merchant of Record)이 정확히 뭘 해주나

Paddle은 나 대신 "판매자"로서 결제를 직접 처리한다. 실제 카드 청구서에는 내 회사명이 아니라 `PADDLE.NET* MATCHDA` 같은 식으로 찍힌다. 이게 핵심인데, **전 세계 각국의 부가세(VAT)·판매세(GST) 계산·징수·납부까지 Paddle이 대신 해준다.** 나는 Paddle의 "리셀러"처럼 동작하는 셈이다. 국가별 세율을 하나하나 챙길 필요 없이, Paddle이 계산해서 처리한 다음 정산해준다.

## 코드 전환 — 아키텍처가 근본적으로 다르다

여기서부터는 실제 코드 이야기다. Stripe와 Paddle은 결제 흐름 자체가 꽤 다르게 설계돼 있어서, 단순 치환이 아니라 구조를 다시 짜야 하는 부분이 있었다.

### 체크아웃 — 완전히 다른 방식

Stripe는 서버에서 Checkout Session을 만들고, 그 결과로 받은 URL로 페이지 전체를 리다이렉트하는 방식이다.

```ts
// Stripe (Before)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: customerId,
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/pricing?success=1`,
})
// 클라이언트에서
window.location.href = session.url
```

Paddle Billing(현재 API 버전)의 표준 방식은 다르다. **Paddle.js를 클라이언트에 로드하고, 오버레이(모달) 체크아웃을 직접 여는 방식**이다. 서버가 미리 "결제 페이지 URL"을 만들어줄 필요가 없다.

```ts
// Paddle (After) — 클라이언트 컴포넌트 안
const paddle = await initializePaddle({ token, environment: 'sandbox' })
paddle.Checkout.open({
  items: [{ priceId, quantity: 1 }],
  customer: { email },
  customData: { profile_id: profileId },
  settings: { successUrl: `${window.location.origin}/pricing?success=1` },
})
```

이 차이 때문에 서버 액션 `createCheckoutSession()`을 통째로 없애고, 대신 클라이언트가 오버레이를 열 때 필요한 최소 정보(로그인 이메일, 프로필 ID)만 돌려주는 가벼운 `getBillingContext()`로 바꿨다. 결제 세션을 만드는 책임 자체가 서버에서 클라이언트로 넘어간 셈이다.

### 구독 관리(포털)은 놀랍도록 대칭적이었다

체크아웃은 완전히 새로 짜야 했지만, "구독 관리" 버튼(고객 포털)은 의외로 거의 그대로 가져올 수 있었다. Paddle도 Customer Portal Sessions API로 URL을 반환하는 방식이라, Stripe의 `billingPortal.sessions.create`와 패턴이 거의 동일했다.

```ts
// Stripe
const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url })

// Paddle
const session = await paddle.customerPortalSessions.create(customerId, [subscriptionId])
// session.urls.general.overview 가 반환된 URL
```

같은 회사의 결제 시스템 안에서도 "결제를 시작하는 흐름"과 "이미 있는 구독을 관리하는 흐름"이 설계 철학이 다를 수 있다는 걸 느낀 지점이다.

### 웹훅 — 뼈대는 같고 이벤트 종류만 다르다

웹훅도 구조 자체는 비슷했다. Stripe는 `stripe-signature` 헤더 + `stripe.webhooks.constructEvent`, Paddle은 `paddle-signature` 헤더 + `paddle.webhooks.unmarshal(body, secret, signature)`. **서명 검증 → 이벤트 타입 분기 → DB 반영**이라는 뼈대가 같아서, 기존 Stripe 웹훅 라우트 구조를 그대로 본떠 `/api/paddle/webhook`을 새로 만들었다.

다만 Paddle은 구독 상태 이벤트가 더 세분화돼 있다. `subscription.created`/`updated`/`canceled` 외에도 `activated`, `pastDue`, `paused`, `resumed`, `trialing`까지 있어서, 이걸 전부 `EventName` enum으로 분기해 같은 `applySubscription()` 함수로 처리하게 만들었다.

```ts
switch (event.eventType) {
  case EventName.SubscriptionCreated:
  case EventName.SubscriptionUpdated:
  case EventName.SubscriptionCanceled:
  case EventName.SubscriptionActivated:
  case EventName.SubscriptionPastDue:
  case EventName.SubscriptionPaused:
  case EventName.SubscriptionResumed:
  case EventName.SubscriptionTrialing:
    await applySubscription(event.data)
    break
}
```

### 정확한 API 시그니처는 .d.ts 파일에서 찾았다

`@paddle/paddle-node-sdk`와 `@paddle/paddle-js`를 설치한 뒤, 문서만 보고 짜지 않고 **`node_modules` 안의 타입 정의(`.d.ts`) 파일을 직접 열어서 정확한 메서드 시그니처를 하나씩 확인**했다. `Paddle` 클래스 생성자, `webhooks.unmarshal`의 반환 타입, `customerPortalSessions.create`의 파라미터, `CheckoutOpenOptions`의 정확한 필드명까지. 문서가 최신 API 변경을 못 따라가는 경우가 종종 있는데, 타입 정의는 실제 설치된 패키지 버전과 항상 일치하니 더 믿을 만하다.

```bash
# 타입 정의 위치를 직접 찾아서 읽는다
find node_modules/@paddle/paddle-node-sdk/dist/types -name "*.d.ts"
cat node_modules/@paddle/paddle-node-sdk/dist/types/paddle.d.ts
```

### DB — 컬럼을 지우지 않고 추가만 했다

운영 중인 DB에서 기존 `stripe_customer_id`/`stripe_subscription_id` 컬럼을 지우는 건 신중해야 할 일이라, 지우지 않고 그대로 뒀다. 대신 `paddle_customer_id`/`paddle_subscription_id` 컬럼만 새로 추가했다.

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paddle_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
```

`plan`, `subscription_status`, `current_period_end` 컬럼은 처음 설계할 때부터 프로바이더 이름이 안 박혀 있는 중립적인 이름이었어서 그대로 재사용할 수 있었다. 의도한 건 아니었는데, 예전에 "굳이 stripe_status라고 안 짓길 잘했다"는 걸 이번에 체감했다.

### 오히려 코드가 단순해진 부분도 있었다

Stripe는 결제를 취소하면 `cancel_url`로 리다이렉트했는데, 이걸 받아서 "결제가 취소됐어요" 배너를 보여주는 로직이 있었다. Paddle 오버레이 체크아웃은 사용자가 그냥 모달을 닫으면 페이지 이동 없이 원래 화면에 남는다. 그래서 이 취소 리다이렉트 처리 자체가 필요 없어졌다 — 전환하면서 오히려 코드 한 뭉치가 사라진 드문 경우였다.

### 전면 교체이므로 미련 없이 지웠다

부분적으로 두 프로바이더를 같이 쓰는 게 아니라 완전히 전환하는 것이었으므로, `stripe` npm 패키지와 `src/lib/stripe.ts`, Stripe 웹훅 라우트를 전부 지웠다. 안 쓰는 코드를 "혹시 몰라서" 남겨두면 나중에 헷갈리기만 한다.

## 실수한 것 — 커밋 직후엔 항상 재확인하기

첫 커밋을 만들 때 `git add`로 여러 파일을 스테이징했는데, 신규 파일(`paddle.ts`, 새 웹훅 라우트, 마이그레이션 파일)만 실제로 커밋에 들어가고, **정작 수정한 기존 파일들(`billing-actions.ts`, `UpgradeButton.tsx`, `plan.ts` 등)이 스테이징에서 빠져버렸다.** 이 상태로 푸시하니, 원격 저장소는 "이미 삭제된 `stripe.ts`를 여전히 import하는" 빌드가 깨진 상태가 됐다.

다행히 커밋하고 나서 바로 확인하는 습관이 있었다.

```bash
git status --short
git show HEAD:src/app/billing-actions.ts | grep -i stripe
```

`git status`에 아직 수정된 파일들이 그대로 남아있는 걸 보고 몇 분 안에 알아챘고, 두 번째 커밋으로 즉시 바로잡았다. **커밋을 만들고 나면 "진짜로 반영됐는지" `git status`와 `git show HEAD:파일경로`로 재확인하는 습관**이 이럴 때 진가를 발휘한다.

## 부수적으로 만든 것 — 환불 정책 페이지

Paddle은 판매자 계정을 승인하기 전에 사이트에 **환불 정책이 명확히 공개돼 있는지** 확인한다는 걸 알게 됐다. 기존 이용약관에는 "결제 후 7일 이내 + 프리미엄 기능 미사용 시 환불 가능"이라는 짧은 조항만 있었는데, 이걸 별도 페이지(`/refund`)로 훨씬 구체화했다.

- 환불 가능 조건과 제한되는 경우
- **"구독 해지"와 "환불"은 다른 개념**이라는 걸 명확히 구분 — 해지는 다음 결제를 막는 것뿐이고, 이미 낸 돈을 돌려받는 게 아니다
- 요청 방법과 처리 기간

이 페이지를 만들다가 버그를 하나 더 발견했다. 프로젝트에는 `AppChrome`이라는 레거시 전역 헤더 컴포넌트가 있는데, 특정 경로(`/terms`, `/privacy`, `/support` 등)는 화이트리스트에 등록돼서 이 레거시 헤더를 건너뛰고 자체 헤더만 쓰도록 돼 있었다. 새로 만든 `/refund`를 이 화이트리스트에 추가하는 걸 깜빡해서, 레거시 헤더(지원 관리/잡 탐색/프로필 메뉴)와 새 페이지의 랜딩 헤더(서비스 소개/채용 정보/이력서 번역/요금제)가 위아래로 겹쳐 보이는 버그가 생겼다. 사용자가 스크린샷을 보내줘서 알게 됐고, 화이트리스트에 한 줄 추가로 해결했다.

```ts
const usesMatchdaShell =
  pathname?.startsWith('/terms') ||
  pathname?.startsWith('/privacy') ||
  pathname?.startsWith('/refund') ||  // 이 한 줄이 빠져 있었다
  pathname?.startsWith('/support') ||
  // ...
```

**새 정적 페이지를 추가할 때는 이런 전역 레이아웃의 화이트리스트/분기 로직이 있는지 항상 확인해야 한다**는 교훈을 얻었다.

## 정리

```
문제: Stripe 계정 국가에 한국이 없어 "미국"으로 설정
  → 실제 미국 법인·계좌 없이는 KYC 통과 불가, 정산 막힘, 세금 신고 꼬임
  → 선택지: Stripe Atlas로 진짜 미국 법인 vs Paddle(MoR)로 전환
  → 초기 단계 SaaS엔 Paddle이 현실적 선택

전환 작업:
  체크아웃: 서버 리다이렉트 → 클라이언트 Paddle.js 오버레이 (구조 변경)
  포털: Stripe 패턴 거의 그대로 재사용 (대칭적)
  웹훅: 뼈대(서명검증→분기→DB반영) 동일, 이벤트 종류만 세분화
  DB: 컬럼 삭제 없이 ADD COLUMN, 중립적 컬럼명 덕분에 재사용 폭 넓었음
  Stripe 관련 코드는 전면 교체이므로 미련 없이 삭제

교훈:
  - API 시그니처는 문서보다 설치된 패키지의 .d.ts가 더 정확
  - 커밋 직후엔 git status/git show HEAD로 항상 재확인
  - 새 정적 페이지 추가 시 전역 레이아웃 화이트리스트 확인 필수
```

한국에서 SaaS를 혼자 운영하다 보면 결제 하나 붙이는 것부터 이렇게 나라별 제약에 부딪힌다. Stripe가 안 되면 못 하는 게 아니라, MoR 같은 대안이 있다는 걸 아는 것만으로도 선택지가 훨씬 넓어진다.
