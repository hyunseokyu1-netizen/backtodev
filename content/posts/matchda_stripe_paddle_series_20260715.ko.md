---
title: '혼자 SaaS 결제 붙이기 — Stripe로 시작해서 Paddle로 끝난 이야기'
date: '2026-07-15'
publish_date: '2026-07-17'
description: 매치다에 Stripe 구독 결제를 완성한 지 나흘 만에 계정 국가 문제로 전면 재작업이 필요했던 사연과, Paddle(Merchant of Record)로 전환하며 얻은 기술적 교훈을 한 편으로 정리
tags:
  - Paddle
  - Stripe
  - 결제연동
  - SaaS
  - Webhook
---

## 왜 이 글을 쓰게 됐나

해외 취업 지원 서비스 매치다(MatchDa)에 프리미엄 구독 결제를 붙이는 작업을 했다. 처음엔 당연히 Stripe로 시작했고, 계정 가입부터 웹훅 검증까지 전체 사이클을 완성했다. 그런데 완성한 지 나흘 만에 **결제 시스템을 통째로 다른 서비스(Paddle)로 갈아타야 했다.** 코드가 잘못돼서가 아니라, Stripe 계정의 "국가" 설정 자체가 애초에 지속 가능한 선택이 아니었다는 걸 뒤늦게 깨달았기 때문이다.

이 글은 그 전체 여정 — Stripe 연동 → 뜻밖의 디버깅 사건 → 국가 문제 발견 → Paddle로 전환 — 을 한 편으로 정리한 기록이다. 한국(또는 Stripe 미지원 국가)에서 SaaS를 혼자 또는 소규모로 운영하는 개발자라면 언젠가 반드시 마주칠 문제라서, 겪은 그대로 남겨둔다.

## 1부. Stripe로 결제를 연결하다

### 계정 가입부터 한국은 지원국이 아니었다

첫 관문부터 예상 밖이었다. Stripe는 한국을 공식 지원하지 않는다. 가입 시 국가 목록에 한국이 없다.

매치다는 호주·뉴질랜드 IT 시장을 대상으로 하는 서비스라 결제 통화도 어차피 USD로 갈 생각이었고, 그래서 **미국 계정으로 가입**했다. 가입 과정의 "What does your business do?" 질문에는 추상적인 소개 대신 과금 대상과 금액까지 구체적으로 적었다.

> MatchDa is a SaaS career platform that helps job seekers apply to English-speaking markets. It automatically collects job postings, scores them against the user's resume with AI, and generates tailored resumes and cover letters. We charge a monthly subscription ($7.99/month) for premium features.

이때만 해도 이 "미국 계정"이라는 선택이 며칠 뒤 발목을 잡을 줄은 몰랐다.

### API 키 — 세 가지 중에 진짜 필요한 건 하나

Developers 메뉴에 들어가면 키가 세 종류 보인다.

| 키 | 용도 | 매치다에서 필요? |
|---|---|---|
| Secret key (`sk_...`) | 서버에서 Stripe API 호출 | **필요** |
| Publishable key (`pk_...`) | 브라우저에서 Stripe.js를 직접 쓸 때 | 불필요 |
| Restricted key (`rk_...`) | 권한을 좁힌 secret key | 불필요 |

매치다는 **서버에서 Checkout 세션을 만들어 Stripe 호스팅 결제 페이지로 리다이렉트**하는 방식이라, 카드 입력 폼을 직접 임베드하지 않는다. 결국 `.env`에 넣을 건 secret key 하나면 됐다. "내 아키텍처가 어느 쪽인지"를 먼저 알면 키 설정에서 헤맬 일이 없다.

### 상품·가격은 API로, 웹훅은 대시보드로

가격(Price)은 대시보드 클릭으로도 만들 수 있지만 터미널이 열려 있으니 API로 처리했다.

```bash
curl https://api.stripe.com/v1/products \
  -u "$STRIPE_SECRET_KEY:" \
  -d name="MatchDa Premium" \
  -d description="Unlimited job sources and tailored resumes"

curl https://api.stripe.com/v1/prices \
  -u "$STRIPE_SECRET_KEY:" \
  -d product=prod_... \
  -d unit_amount=799 \
  -d currency=usd \
  -d "recurring[interval]=month"
```

웹훅은 **Workbench → Webhooks → Add destination**으로 등록했다.

- **URL**: `https://matchda.com/api/stripe/webhook`
- **이벤트**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

등록하면 서명 시크릿(`whsec_...`)이 발급되고, 이 값을 `STRIPE_WEBHOOK_SECRET`에 넣었다. — 그리고 바로 여기서 첫 번째 사고가 났다.

### 사건: 결제는 됐는데 플랜이 안 바뀐다

테스트 카드(`4242 4242 4242 4242`)로 결제하면 Stripe 대시보드엔 구독이 정상 생성됐다. 그런데 매치다 쪽 plan은 여전히 `free`였다.

코드를 의심하기 전에 Stripe Events API부터 확인했다.

```bash
curl -s "https://api.stripe.com/v1/events?limit=5" -u "$STRIPE_SECRET_KEY:" \
  | python3 -c "import json,sys; [print(e['type'], '| pending_webhooks:', e['pending_webhooks']) for e in json.load(sys.stdin)['data']]"
```

```
checkout.session.completed | pending_webhooks: 1
customer.subscription.created | pending_webhooks: 1
```

`pending_webhooks: 1` — Stripe는 이벤트를 보냈는데 우리 엔드포인트가 성공 응답을 안 줘서 재시도 대기 중이라는 뜻이었다. 시크릿 값을 다시 확인했다.

```bash
grep STRIPE_WEBHOOK_SECRET .env.local
# STRIPE_WEBHOOK_SECRET=wwhsec_...
```

**`whsec_` 앞에 `w`가 하나 더 붙어 있었다.** 대시보드 값을 복사해 붙여넣는 과정에서 글자 하나가 끼어든 것이다. 서명 검증은 시크릿이 한 글자만 달라도 통째로 실패하니, 코드가 완벽해도 모든 웹훅이 400으로 튕겨나가고 있었다. 수정 자체는 허무할 만큼 간단했다.

```bash
sed -i '' 's/wwhsec_/whsec_/' .env.local
# Vercel 환경변수도 수정 후 재배포 필요
```

재시도 스케줄을 기다리는 대신, 구독 metadata를 의미 없이 touch해서 `customer.subscription.updated` 이벤트를 강제로 재발화시켰다.

```bash
curl https://api.stripe.com/v1/subscriptions/sub_... \
  -u "$STRIPE_SECRET_KEY:" \
  -d "metadata[retrigger]=1"
```

몇 초 뒤 plan이 premium으로 바뀌어 있었다. 이어서 해지 플로우도 API로 검증해, **결제 → premium 승격 → 해지 → free 강등**까지 전체 사이클을 실제 이벤트 기반으로 확인했다.

이 사건에서 남은 교훈은 이랬다.

1. **결제 연동의 절반은 코드 밖에 있다.** 이번 사고의 원인은 결제 코드가 아니라 환경변수의 글자 하나였다.
2. **디버깅은 "누구 잘못인지"를 먼저 가르는 것.** Events API에서 `pending_webhooks: 1`을 본 순간 "Stripe는 보냈고 우리가 거부했다"로 범위가 좁혀졌다.
3. **검증 루프를 짧게 만드는 수단을 알아두면 강하다.** metadata touch로 이벤트를 강제 재발화한 것처럼, 외부 시스템 스케줄에 끌려가지 않고 능동적으로 상태를 유발할 수 있으면 디버깅 속도가 달라진다.

여기까지가 Stripe 연동을 "완성"했다고 생각한 시점이다. 그런데 며칠 안 가 이 완성 자체가 흔들렸다.

## 2부. "미국 계정"이라는 선택이 진짜 문제였다

서비스를 운영하던 중 Stripe가 "추가 정보를 입력해주세요"라는 화면을 띄웠다. 평범한 안내 문구처럼 보였지만, 실제로는 **"당신이 진짜 미국 사업자가 맞는지 증명하라"**는 요구였다. 나는 미국 법인도, 미국 은행 계좌도 없는 한국 개인 사업자다. 이 요구를 통과할 방법이 없었다.

알아볼수록 이게 단순 국적 표시 문제가 아니라는 걸 알게 됐다. **Stripe 계정의 국가는 법적 사업자 소재지를 의미한다.** 실제 미국 법인(EIN)·주소·은행 계좌 없이 미국 계정을 유지하면 세 가지 문제가 기다리고 있었다.

1. **KYC(신원 확인)를 통과하지 못한다.** 매출이 일정 수준을 넘으면 요구하는 서류(미국 법인 등록증 등)를 제출할 수가 없다.
2. **정산(payout)이 막힌다.** Stripe는 보통 계정 국가와 같은 나라의 은행 계좌로만 입금한다. 미국 계좌가 없으면 매출이 Stripe 안에 그대로 묶인다.
3. **세금 신고가 꼬인다.** 미국 사업자로 분류되면 IRS 기준 세금 신고 대상이 될 수 있는데, 이는 한국 거주자로서 해야 하는 신고와는 완전히 별개다.

선택지는 두 가지로 좁혀졌다.

| 선택지 | 내용 | 트레이드오프 |
|---|---|---|
| **Stripe Atlas로 진짜 미국 법인 만들기** | Delaware C-Corp 설립 + EIN 발급 + 미국 은행 계좌 개설 | 법인 유지비·미국 법인세 신고 부담. 매출 규모가 커질 계획이면 고려할 만함 |
| **Merchant of Record(MoR) 결제사로 전환** | Paddle 같은 서비스가 "판매자" 역할을 대신 맡음 | 한국 개인도 미국 법인 없이 바로 정산 가능. 수수료는 다소 높음 |

초기 단계 SaaS를 혼자 운영하는 입장에서 법인 설립·유지 비용과 세무 복잡도는 감당하기 어려웠다. **Paddle로 전환하는 쪽이 훨씬 현실적**이라고 판단했다.

Paddle 같은 MoR은 나 대신 "판매자"로서 결제를 직접 처리한다. 실제 카드 청구서엔 내 회사명이 아니라 `PADDLE.NET* MATCHDA` 식으로 찍힌다. 핵심은 **전 세계 각국의 부가세(VAT)·판매세(GST) 계산·징수·납부까지 Paddle이 대신 해준다**는 점이다. 나는 Paddle의 "리셀러"처럼 동작하는 셈이라, 국가별 세율을 챙길 필요가 없어진다.

## 3부. Stripe → Paddle 코드 전환

Stripe와 Paddle은 결제 흐름 자체가 꽤 다르게 설계돼 있어서, 단순 치환이 아니라 구조를 다시 짜야 하는 부분이 있었다.

### 체크아웃 — 완전히 다른 방식

Stripe는 서버에서 Checkout Session을 만들고, 그 결과 URL로 페이지 전체를 리다이렉트한다.

```ts
// Stripe (Before)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: customerId,
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/pricing?success=1`,
})
window.location.href = session.url
```

Paddle Billing의 표준 방식은 다르다. **Paddle.js를 클라이언트에 로드하고, 오버레이(모달) 체크아웃을 직접 여는 방식**이다.

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

이 차이 때문에 서버 액션 `createCheckoutSession()`을 통째로 없애고, 클라이언트가 오버레이를 열 때 필요한 최소 정보(로그인 이메일, 프로필 ID)만 돌려주는 가벼운 `getBillingContext()`로 바꿨다. 결제 세션을 만드는 책임 자체가 서버에서 클라이언트로 넘어간 셈이다.

### 구독 관리(포털)은 놀랍도록 대칭적이었다

체크아웃은 완전히 새로 짜야 했지만, 구독 관리 포털은 거의 그대로 가져올 수 있었다. Paddle도 Customer Portal Sessions API로 URL을 반환하는 방식이라, Stripe의 `billingPortal.sessions.create`와 패턴이 거의 동일했다.

```ts
// Stripe
const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url })

// Paddle
const session = await paddle.customerPortalSessions.create(customerId, [subscriptionId])
// session.urls.general.overview 가 반환된 URL
```

같은 "결제"라는 카테고리 안에서도 시작 흐름과 관리 흐름의 설계 철학이 이렇게 다를 수 있다는 걸 느낀 지점이다.

### 웹훅 — 뼈대는 같고 이벤트 종류만 다르다

웹훅 구조 자체는 1부에서 겪은 Stripe 방식과 비슷했다. Stripe는 `stripe-signature` 헤더 + `stripe.webhooks.constructEvent`, Paddle은 `paddle-signature` 헤더 + `paddle.webhooks.unmarshal(body, secret, signature)`. **서명 검증 → 이벤트 타입 분기 → DB 반영**이라는 뼈대가 같아서, 기존 Stripe 웹훅 라우트 구조를 그대로 본떠 `/api/paddle/webhook`을 새로 만들었다.

다만 Paddle은 구독 상태 이벤트가 더 세분화돼 있다. `created`/`updated`/`canceled` 외에도 `activated`, `pastDue`, `paused`, `resumed`, `trialing`까지 있어서, 전부 같은 `applySubscription()` 함수로 처리하도록 분기했다.

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

> 1부의 `wwhsec_` 사고를 겪은 뒤라, 이번엔 시크릿을 옮길 때 값을 한 번 더 grep으로 대조하는 습관이 생겼다.

### 정확한 API 시그니처는 .d.ts 파일에서 찾았다

`@paddle/paddle-node-sdk`와 `@paddle/paddle-js`를 설치한 뒤, 문서만 보고 짜지 않고 **`node_modules` 안의 타입 정의(`.d.ts`)를 직접 열어서** 정확한 메서드 시그니처를 확인했다. 문서가 최신 API 변경을 못 따라가는 경우가 종종 있는데, 타입 정의는 설치된 패키지 버전과 항상 일치하니 더 믿을 만하다.

```bash
find node_modules/@paddle/paddle-node-sdk/dist/types -name "*.d.ts"
cat node_modules/@paddle/paddle-node-sdk/dist/types/paddle.d.ts
```

### DB — 컬럼을 지우지 않고 추가만 했다

운영 중인 DB에서 기존 `stripe_customer_id`/`stripe_subscription_id` 컬럼을 지우는 대신, `paddle_customer_id`/`paddle_subscription_id` 컬럼만 새로 추가했다.

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paddle_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
```

`plan`, `subscription_status`, `current_period_end` 컬럼은 처음 설계할 때부터 프로바이더 이름이 안 박혀 있는 중립적인 이름이라 그대로 재사용할 수 있었다. 의도한 건 아니었는데, "굳이 `stripe_status`라고 안 짓길 잘했다"는 걸 이번에 체감했다.

### 오히려 코드가 단순해진 부분도 있었다

Stripe는 결제를 취소하면 `cancel_url`로 리다이렉트해서 "결제가 취소됐어요" 배너를 보여주는 로직이 필요했다. Paddle 오버레이 체크아웃은 사용자가 모달을 닫으면 페이지 이동 없이 원래 화면에 남는다. 이 취소 리다이렉트 처리 자체가 필요 없어졌다 — 전환하면서 오히려 코드 한 뭉치가 사라진 드문 경우였다.

부분 병행이 아니라 완전 전환이었으므로, `stripe` npm 패키지와 `src/lib/stripe.ts`, Stripe 웹훅 라우트는 미련 없이 지웠다. 안 쓰는 코드를 "혹시 몰라서" 남겨두면 나중에 헷갈리기만 한다.

### 실수한 것 — 커밋 직후엔 항상 재확인하기

첫 커밋에서 `git add`로 여러 파일을 스테이징했는데, 신규 파일(`paddle.ts`, 새 웹훅 라우트, 마이그레이션 파일)만 커밋에 들어가고 **정작 수정한 기존 파일들(`billing-actions.ts`, `UpgradeButton.tsx`, `plan.ts` 등)이 스테이징에서 빠져버렸다.** 이 상태로 푸시하니, 원격 저장소는 "이미 삭제된 `stripe.ts`를 여전히 import하는" 빌드 깨진 상태가 됐다.

다행히 커밋 직후 확인하는 습관이 있었다.

```bash
git status --short
git show HEAD:src/app/billing-actions.ts | grep -i stripe
```

`git status`에 수정된 파일들이 그대로 남아있는 걸 보고 몇 분 안에 알아챘고, 두 번째 커밋으로 바로잡았다. **커밋을 만들고 나면 "진짜로 반영됐는지" `git status`와 `git show HEAD:파일경로`로 재확인하는 습관**이 이럴 때 진가를 발휘한다.

### 부수적으로 만든 것 — 환불 정책 페이지

Paddle은 판매자 계정을 승인하기 전에 사이트에 **환불 정책이 명확히 공개돼 있는지** 확인한다. 기존 이용약관의 짧은 조항을 별도 페이지(`/refund`)로 구체화했다 — 환불 가능 조건, "구독 해지"와 "환불"은 다른 개념이라는 점(해지는 다음 결제를 막을 뿐 이미 낸 돈을 돌려받는 게 아니다), 요청 방법과 처리 기간.

이 페이지를 만들다 버그를 하나 더 발견했다. 레거시 전역 헤더 컴포넌트(`AppChrome`)가 특정 경로(`/terms`, `/privacy`, `/support` 등)를 화이트리스트로 건너뛰도록 돼 있었는데, 새로 만든 `/refund`를 이 목록에 추가하는 걸 깜빡해서 레거시 헤더와 새 랜딩 헤더가 겹쳐 보이는 버그가 생겼다.

```ts
const usesMatchdaShell =
  pathname?.startsWith('/terms') ||
  pathname?.startsWith('/privacy') ||
  pathname?.startsWith('/refund') ||  // 이 한 줄이 빠져 있었다
  pathname?.startsWith('/support')
```

**새 정적 페이지를 추가할 때는 전역 레이아웃의 화이트리스트/분기 로직이 있는지 항상 확인해야 한다**는 교훈을 얻었다.

## 자주 쓴 패턴 요약

| 상황 | 패턴 |
|---|---|
| 서버 Checkout 방식(Stripe) | secret key 하나면 충분 |
| 웹훅이 반영 안 될 때 | 코드보다 먼저 Events API의 `pending_webhooks` 확인 |
| 서명 검증 실패 | 시크릿 오타·공백·개행부터 의심 (붙여넣기 사고가 의외로 흔하다) |
| 웹훅 재시도 대기가 답답할 때 | 구독 metadata touch로 `subscription.updated` 강제 발화 |
| 결제 SDK 사용법이 헷갈릴 때 | 문서보다 `node_modules`의 `.d.ts`가 더 정확 |
| 커밋 직후 | `git status` / `git show HEAD:파일경로`로 실제 반영 재확인 |
| 새 정적 페이지 추가 시 | 전역 레이아웃의 경로 화이트리스트/분기 확인 |

## 정리

```
1부 — Stripe 연동
  계정 가입(미국 국가 선택) → API 키(secret key만) → 상품·가격 생성 → 웹훅 등록
  → wwhsec_ 오타로 결제-플랜 동기화 실패 → Events API로 원인 특정 → 수정
  → 결제·해지 전체 사이클 검증

2부 — "미국 계정"의 대가
  실제 미국 법인 없이 미국 계정 유지 → KYC 통과 불가·정산 막힘·세금 신고 꼬임
  → 선택지: Stripe Atlas(진짜 법인) vs Paddle(MoR)
  → 초기 단계 SaaS엔 Paddle이 현실적

3부 — Stripe → Paddle 전환
  체크아웃: 서버 리다이렉트 → 클라이언트 오버레이 (구조 변경)
  포털: Stripe 패턴 거의 그대로 재사용
  웹훅: 뼈대 동일, 이벤트 세분화만 대응
  DB: 컬럼 삭제 없이 ADD COLUMN
  Stripe 코드는 전면 삭제, 환불 정책 페이지 신설
```

한국에서 SaaS를 혼자 운영하다 보면 결제 하나 붙이는 것부터 이렇게 나라별 제약에 부딪힌다. Stripe 연동을 완성했다는 성취감이 며칠 만에 "이 선택 자체가 지속 불가능하다"는 사실로 뒤집힐 수도 있다는 걸 이번에 배웠다. 그래도 Stripe가 안 되면 끝이 아니라 MoR 같은 대안이 있다는 걸 아는 것만으로도 선택지는 훨씬 넓어진다.
