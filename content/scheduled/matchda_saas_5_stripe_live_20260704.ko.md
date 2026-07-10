---
title: 'AI 코딩 어시스턴트와 SaaS 만들기 ⑤: Stripe 결제, 코드에서 실제 돈이 도는 순간까지'
date: '2026-07-04'
publish_date: '2026-08-04'
description: 4편에서 코드만 완성했던 Stripe 구독 결제를 실제로 연결한 과정 — 미국 계정 가입, API로 가격 생성, 웹훅 등록, 그리고 오타 한 글자(wwhsec_) 때문에 결제가 반영되지 않던 사건의 전말
tags:
  - Stripe
  - SaaS
  - 구독 결제
  - Webhook
  - 디버깅
---

## 시작하며

4편 끝에서 Stripe 구독 결제를 "진행 중"으로 남겨뒀었다. Checkout 세션, 고객 포털, 웹훅 핸들러, 플랜 판정 로직까지 코드는 다 짜여 있었지만, 정작 Stripe 쪽 설정 — 계정, 상품, 가격, 웹훅 엔드포인트 — 은 하나도 안 되어 있는 상태였다.

이번 편은 그 나머지 절반의 기록이다. 그리고 미리 스포일러를 하자면, **결제는 성공했는데 플랜이 안 바뀌는** 사건이 터졌고, 원인은 코드가 아니라 **환경변수에 붙여넣다가 생긴 오타 한 글자**였다. 코드보다 설정에서 터지는 문제가 얼마나 찾기 어려운지, 그걸 어떻게 추적했는지가 이번 편의 하이라이트다.

- 5편(이 글): Stripe 계정 가입 → 가격 생성 → 웹훅 등록 → 결제·해지 전체 사이클 검증
- 6편: 브랜드 로고 통일 + 수집 공고 171건 관리 기능 + 공고 전문 붙여넣기 AI 분석

## Step 1. 계정 가입 — 한국은 Stripe 지원국이 아니다

첫 관문부터 예상 밖이었다. Stripe는 한국을 공식 지원하지 않는다. 가입 시 국가 목록에 한국이 없다.

MatchDa는 호주·뉴질랜드 IT 시장을 대상으로 하는 서비스라 결제 통화도 어차피 USD로 갈 생각이었고, 그래서 **미국 계정으로 가입**했다. 가입 과정에서 "What does your business do?"라는 질문에 사업 설명을 적어야 하는데, 이런 식으로 서비스가 뭘 하고 무엇에 과금하는지를 명확히 썼다.

> MatchDa is a SaaS career platform that helps job seekers apply to English-speaking markets. It automatically collects job postings, scores them against the user's resume with AI, and generates tailored resumes and cover letters. We charge a monthly subscription ($7.99/month) for premium features.

Stripe 심사에서 중요한 건 "실제로 뭘 파는지"가 분명한 것이라고 해서, 추상적인 소개 대신 과금 대상과 금액까지 구체적으로 적었다.

## Step 2. API 키 — 세 가지 중에 진짜 필요한 건 하나

Developers 메뉴에 들어가면 키가 세 종류 보인다. 처음엔 뭘 어디에 써야 하는지 헷갈렸는데, 정리하면 이렇다.

| 키 | 용도 | MatchDa에서 필요? |
|---|---|---|
| Secret key (`sk_...`) | 서버에서 Stripe API 호출 (세션 생성, 구독 조회 등) | **필요** |
| Publishable key (`pk_...`) | 브라우저에서 Stripe.js를 직접 쓸 때 | 불필요 |
| Restricted key (`rk_...`) | 권한을 좁힌 secret key (일부 API만 허용) | 불필요 |

MatchDa는 **서버에서 Checkout 세션을 만들어 Stripe 호스팅 결제 페이지로 리다이렉트**하는 방식이다. 카드 입력 폼을 우리 페이지에 직접 임베드하지 않으니 publishable key를 쓸 일이 없다. 결국 `.env`에 넣을 건 secret key 하나면 됐다.

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
```

프론트에 결제 UI를 직접 그리는 방식(Elements)이었다면 publishable key도 필요했을 것이다. "내 아키텍처가 어느 쪽인지"를 먼저 알면 키 설정에서 헤맬 일이 없다.

## Step 3. 상품과 가격을 API로 만들기

가격(Price)은 대시보드에서 클릭으로 만들 수도 있지만, 어차피 터미널이 열려 있으니 API로 만들었다. 상품 생성과 가격 생성이 curl 두 방이면 끝난다.

```bash
# 1) 상품 생성
curl https://api.stripe.com/v1/products \
  -u "$STRIPE_SECRET_KEY:" \
  -d name="MatchDa Premium" \
  -d description="Unlimited job sources and tailored resumes"

# 2) 월 $7.99 반복 결제 가격 생성 (unit_amount는 센트 단위)
curl https://api.stripe.com/v1/prices \
  -u "$STRIPE_SECRET_KEY:" \
  -d product=prod_... \
  -d unit_amount=799 \
  -d currency=usd \
  -d "recurring[interval]=month"
```

응답으로 받은 `price_...` ID를 환경변수에 넣으면, 4편에서 만들어둔 `billingEnabled()` 게이팅이 "이 환경은 결제가 살아있다"고 판단하고 무료 한도를 적용하기 시작한다.

```ts
// src/lib/plan.ts — 4편에서 만든 게이팅이 이제 실제로 동작한다
export function billingEnabled(): boolean {
  return !!process.env.STRIPE_PRICE_ID
}
```

가격 라벨도 이때 확정했다. 원래 `월 ₩9,900`으로 적어뒀던 걸 실제 Stripe 가격에 맞춰 바꿨다 (`940c758`).

```diff
-export const PREMIUM_PRICE_LABEL = '월 ₩9,900'
+export const PREMIUM_PRICE_LABEL = '$7.99 / 월'
```

## Step 4. Sandbox 웹훅 등록

결제가 완료됐을 때 Stripe가 우리 서버에 알려주는 통로가 웹훅이다. 테스트 모드(Sandbox)에서는 **Workbench → Webhooks → Add destination**으로 엔드포인트를 등록한다.

- **URL**: `https://matchda.com/api/stripe/webhook`
- **구독한 이벤트 4개**:
  - `checkout.session.completed` — 결제 완료
  - `customer.subscription.created` — 구독 생성
  - `customer.subscription.updated` — 구독 변경(갱신·상태 변경)
  - `customer.subscription.deleted` — 구독 해지

등록하면 서명 시크릿(`whsec_...`)이 발급된다. 웹훅 핸들러가 "이 요청이 진짜 Stripe에서 왔는지"를 검증하는 데 쓰는 값이다. 이걸 `STRIPE_WEBHOOK_SECRET` 환경변수에 넣었다. — 그리고 바로 여기서 사고가 났다.

## Step 5. 결제는 됐는데 플랜이 안 바뀐다

테스트 카드(`4242 4242 4242 4242`)로 결제를 진행했다. Stripe 대시보드에는 구독이 정상 생성됐다. 그런데 MatchDa로 돌아와 보니 **plan이 여전히 free**였다.

코드를 의심하기 전에, Stripe 쪽에서 이벤트가 어떻게 처리됐는지부터 확인했다. Events API를 조회해보니 단서가 나왔다.

```bash
curl -s "https://api.stripe.com/v1/events?limit=5" -u "$STRIPE_SECRET_KEY:" \
  | python3 -c "import json,sys; [print(e['type'], '| pending_webhooks:', e['pending_webhooks']) for e in json.load(sys.stdin)['data']]"
```

```
checkout.session.completed | pending_webhooks: 1
customer.subscription.created | pending_webhooks: 1
```

`pending_webhooks: 1` — **Stripe는 이벤트를 보냈는데, 우리 엔드포인트가 성공 응답을 주지 않아서 재시도 대기 중**이라는 뜻이다. 즉 이벤트는 도착했지만 우리 서버가 거부하고 있었다. 서명 검증 실패로 400을 돌려주고 있었던 것이다.

시크릿 값을 다시 확인해봤다.

```bash
grep STRIPE_WEBHOOK_SECRET .env.local
# STRIPE_WEBHOOK_SECRET=wwhsec_...
```

`wwhsec_...`. **`whsec_` 앞에 `w`가 하나 더 붙어 있었다.** 대시보드에서 값을 복사해 터미널에 붙여넣는 과정에서 글자 하나가 끼어든 것이다. 서명 검증은 시크릿이 한 글자만 달라도 통째로 실패하니, 코드가 아무리 완벽해도 모든 웹훅이 400으로 튕겨나가고 있었다.

수정은 허무할 만큼 간단했다.

```bash
# 로컬
sed -i '' 's/wwhsec_/whsec_/' .env.local

# Vercel — 환경변수 수정 후 재배포 필요 (env 변경은 재배포해야 반영된다)
```

Vercel 쪽 환경변수도 고치고 재배포했다 (`e470d57` 커밋이 바로 이 재배포 트리거다).

### 재시도를 기다리지 않고 즉시 재검증하는 트릭

Stripe는 실패한 웹훅을 지수 백오프로 재시도하는데, 다음 재시도까지 그냥 기다리기엔 답답했다. 그래서 **구독의 metadata를 의미 없이 touch해서 `customer.subscription.updated` 이벤트를 강제로 재발화**시켰다.

```bash
curl https://api.stripe.com/v1/subscriptions/sub_... \
  -u "$STRIPE_SECRET_KEY:" \
  -d "metadata[retrigger]=1"
```

metadata 변경도 엄연히 구독 업데이트라서 `customer.subscription.updated` 이벤트가 즉시 발생하고, 4편에서 만든 `applySubscription()`이 이 이벤트를 받아 profile을 갱신한다. 몇 초 뒤 확인하니 **plan이 premium으로 바뀌어 있었다.** 재시도 스케줄을 기다리는 대신 이벤트를 직접 유발해서 검증 루프를 짧게 만든, 개인적으로 이번 세션에서 가장 마음에 든 트릭이다.

## Step 6. 해지 플로우까지 검증해야 사이클이 닫힌다

결제 성공만 확인하고 끝내면 반쪽짜리다. 해지했을 때 플랜이 제대로 강등되는지도 봐야 한다. API로 구독을 즉시 해지해봤다.

```bash
curl -X DELETE https://api.stripe.com/v1/subscriptions/sub_... \
  -u "$STRIPE_SECRET_KEY:"
```

`customer.subscription.deleted` 이벤트가 날아오고, 웹훅 핸들러가 DB를 갱신했다.

```
profiles.plan                = 'free'
profiles.subscription_status = 'canceled'
```

이로써 **결제 → premium 승격 → 해지 → free 강등**의 전체 사이클이 실제 이벤트 기반으로 검증됐다. 4편에서 "코드는 다 짜였어도 외부 서비스 쪽 설정이 맞아떨어져야 실제로 동작한다"고 썼는데, 정확히 그 말대로였다.

## 자주 쓴 패턴 요약

| 상황 | 패턴 |
|---|---|
| 서버 Checkout 방식 | secret key 하나면 충분 — publishable/restricted는 아키텍처에 따라 판단 |
| 웹훅이 반영 안 될 때 | 코드보다 먼저 Events API의 `pending_webhooks` 확인 |
| 서명 검증 실패 | 시크릿 오타·공백·개행부터 의심 (붙여넣기 사고가 의외로 흔하다) |
| 웹훅 재시도 대기가 답답할 때 | 구독 metadata touch로 `subscription.updated` 강제 발화 |
| 환경변수 수정 후 | Vercel은 재배포해야 반영 — 수정만 하고 배포를 잊지 말 것 |
| 결제 미설정 환경 | `billingEnabled()` 게이팅으로 한도 미적용 — 업그레이드 경로 없는 dead-end 방지 |

## 정리

1. **결제 연동의 절반은 코드 밖에 있다.** 계정 심사 답변, 키 선택, 가격 객체, 웹훅 등록, 환경변수 — 이 중 하나만 어긋나도 완벽한 코드가 침묵한다. 이번 사고의 원인은 수백 줄의 결제 코드가 아니라 환경변수의 글자 하나였다.
2. **디버깅은 "누구 잘못인지"를 먼저 가르는 것.** plan이 안 바뀌었을 때 코드부터 파기 시작했다면 한참 헤맸을 것이다. Events API에서 `pending_webhooks: 1`을 확인한 순간 "Stripe는 보냈고 우리가 거부했다"로 범위가 좁혀졌고, 거기서 서명 검증 → 시크릿 값 순서로 자연스럽게 내려갔다.
3. **검증 루프를 짧게 만드는 수단을 알아두면 강하다.** 웹훅 재시도를 기다리는 대신 metadata touch로 이벤트를 강제 재발화한 것처럼, 외부 시스템의 스케줄에 끌려가지 않고 능동적으로 상태를 유발할 수 있으면 디버깅 속도가 완전히 달라진다.
4. **해지까지 테스트해야 유료화가 끝난다.** 승격만 확인하고 배포했다가 해지 반영이 안 되면, 돈은 안 들어오는데 premium을 계속 제공하는 최악의 상황이 된다.

다음 편(6편)에서는 결제 밖의 나머지 작업들 — 파비콘과 인앱 로고가 서로 달랐던 브랜드 불일치, 수집 공고가 171건으로 불어나며 생긴 관리 문제, 그리고 스크래핑이 실패하는 사이트를 위한 "공고 전문 붙여넣기 AI 분석"을 다룬다.
