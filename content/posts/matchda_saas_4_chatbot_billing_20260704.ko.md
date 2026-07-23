---
title: 'AI 코딩 어시스턴트와 SaaS 만들기 ④: 원클릭 수집, 챗봇, 그리고 첫 유료화'
date: '2026-07-04'
publish_date: '2026-08-03'
description: 공개 ATS API로 검증한 대기업 채용공고 원클릭 수집, 사용법만 안내하는 고객센터 챗봇, Stripe 구독 결제로 무료 SaaS를 유료화하기까지
tags:
  - Stripe
  - Claude API
  - SaaS
  - Next.js
  - 구독 결제
---

## 시작하며

1편에서 URL과 플로우, 2편에서 데이터 유실 사고, 3편에서 이력서 관련 기능들을 다뤘다. 이번 편은 이번 세션의 마지막 세 가지 작업을 정리한다.

- 대기업 채용페이지를 클릭 한 번으로 등록·수집하는 추천 기업 프리셋
- 사용법만 안내하는 고객센터 AI 챗봇
- Stripe로 구현한 첫 유료 구독 (진행 중)

앞의 두 기능은 "사용자가 첫 화면에서 무엇을 하게 만들 것인가"에 대한 답이고, 마지막은 무료로 만들어온 서비스를 실제로 돈을 받는 제품으로 바꾸는 단계다.

## Step 1. 추천 기업 프리셋 — API로 먼저 검증하고 등록

MatchDa는 사용자가 채용페이지 URL을 직접 등록해야 공고 수집이 시작된다. 그런데 첫 방문자에게 "채용페이지 URL을 넣어보세요"라고 하면 막막하다. 뭘 넣어야 할지 모르니까.

그래서 `88ba103` 커밋에서 Apple, Spotify, Stripe, Anthropic, Databricks 등 잘 알려진 기업의 채용페이지를 칩(chip) 형태로 미리 등록해두고, 클릭 한 번으로 "등록 + 즉시 수집"이 되도록 만들었다.

```
feat: 잡 탐색에 추천 기업 프리셋 + 원클릭 수집

- Apple·Spotify·Stripe·Anthropic·Databricks 등 14개 대기업 채용페이지 프리셋
- 칩 클릭 → addPresetSource(채용페이지 등록) → scrapeSourceAction(즉시 수집)
- 공개 ATS API(greenhouse/lever/apple)로 유효성 확인한 슬러그만 포함
```

여기서 신경 쓴 부분은 **"프리셋으로 등록한 슬러그가 실제로 살아있는 채용페이지인지"를 먼저 검증**하는 것이었다. Greenhouse와 Lever 같은 ATS(Applicant Tracking System)는 아래처럼 공개 API를 제공한다.

```
# Greenhouse 공개 API
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs

# Lever 공개 API
GET https://api.lever.co/v0/postings/{slug}
```

회사 슬러그(예: `stripe`, `anthropic`)를 이 API에 직접 요청해보고 실제로 공고 목록이 돌아오는지 확인한 다음에만 프리셋 목록에 넣었다. 그냥 "회사 이름 + greenhouse.io" 식으로 짐작해서 슬러그를 넣으면, 실제로는 그 회사가 Greenhouse를 안 쓰거나 슬러그가 다른 경우가 생각보다 많다. 최종적으로 완성된 프리셋 목록은 이렇다.

```ts
// src/lib/discover/presets.ts
export const PRESET_COMPANIES: PresetCompany[] = [
  { name: 'Apple', url: 'https://jobs.apple.com/en-us/search' },
  { name: 'Spotify', url: 'https://jobs.lever.co/spotify' },
  { name: 'Stripe', url: 'https://boards.greenhouse.io/stripe' },
  { name: 'Anthropic', url: 'https://boards.greenhouse.io/anthropic' },
  { name: 'Databricks', url: 'https://boards.greenhouse.io/databricks' },
  // ... 총 14곳
]
```

클릭 시 실행되는 서버 액션은 두 단계로 나뉜다.

```ts
// src/app/discover/actions.ts
export async function addPresetSource(
  name: string,
  url: string
): Promise<{ sourceId?: string; already?: boolean; error?: string }> {
  // 이미 등록된 채용페이지면 기존 sourceId를 그대로 반환 (중복 등록 방지)
  const { data: existing } = await supabaseAdmin
    .from('job_sources')
    .select('id')
    .eq('user_id', profile.id)
    .eq('url', url)
    .maybeSingle()
  if (existing) return { sourceId: existing.id, already: true }

  // 없으면 새로 등록하고 sourceId 반환 → 클라이언트가 이어서 수집 액션 호출
  const { type } = detectAtsType(url)
  const { data, error } = await supabaseAdmin
    .from('job_sources')
    .insert({ user_id: profile.id, name, url, source_type: type })
    .select('id')
    .single()
  ...
}
```

칩을 클릭하면 클라이언트에서 `addPresetSource`로 등록하고, 반환된 `sourceId`로 바로 `scrapeSourceAction`(수집)을 이어서 호출한다. 사용자 입장에서는 "칩 클릭 한 번"이지만 내부적으로는 등록과 수집이라는 두 단계를 순서대로 밟는 구조다. 중복 클릭에 대비해 "이미 등록돼 있으면 기존 걸 재사용"하는 처리도 넣어뒀다.

## Step 2. 고객센터 챗봇 — 범위를 일부러 좁히기

`03800a7` 커밋에서 우하단 플로팅 위젯으로 고객센터 챗봇을 추가했다.

```
feat: 고객센터 AI 챗봇(사용법 안내) 추가

- 우하단 플로팅 위젯(SupportChat)으로 전 페이지에서 사용법·FAQ 응대
- askSupportBot 서버 액션: MatchDa 지식 베이스 기반 Haiku 응대, DB 조회 없음
- 범위 밖 요청은 정중히 거절하고 서비스 기능으로 안내
- 추천 질문 칩 + 대화 히스토리(최근 12턴) 유지
```

이 기능에서 가장 중요한 설계 결정은 **"이 챗봇은 DB를 조회하지 않는다"**는 제약이었다. "내 지원 현황이 어떻게 되나요?" 같은 질문에 실제 데이터로 답하는 챗봇을 만들 수도 있었지만, 그러려면 사용자 데이터 접근 권한, 프롬프트 인젝션 방어, 응답 정확성 검증까지 훨씬 큰 범위의 작업이 필요하다. 지금 단계에서는 "서비스 사용법과 FAQ에만 답하는 챗봇"으로 범위를 좁히는 게 실용적이었다.

지식 베이스는 별도 파일에 마크다운으로 정리해뒀다.

```ts
// src/lib/support/knowledge.ts
export const SUPPORT_KNOWLEDGE = `
# MatchDa 서비스 개요
MatchDa(매치다)는 한국어 이력서를 전문가 수준 영어로 정리하고,
채용 공고에 맞춰 자동 최적화해 주는 글로벌 커리어 플랫폼입니다.

## 잡 탐색 (/discover)
- "추천 기업 바로 수집": Apple·Spotify·Stripe·Anthropic 등 대기업 칩을
  클릭하면 채용페이지를 등록하고 즉시 공고를 수집합니다.
- "전체 수집 공고"에서 검색·정렬해 둘러보고, "관리 보내기" 버튼으로
  지원 현황에 추가합니다.
...
# 자주 묻는 질문(FAQ)
- 매칭 점수는? AI가 내 이력서와 공고를 비교해 0~100점으로 적합도를 계산합니다.
- 공고가 안 보여요: 잡 탐색에서 채용페이지를 등록하거나 추천 기업을 수집한 뒤,
  "관리 보내기"로 지원 현황에 추가하세요.
`.trim()
```

이 지식 베이스를 시스템 프롬프트에 그대로 주입하고, 여기 없는 질문(계정 문제, 결제 문제, 서비스 범위를 벗어난 잡담 등)은 정중히 거절하도록 지시했다. 여기서도 모델은 Haiku를 썼다 — 창작이 아니라 정해진 지식 안에서 응답하는 작업이라 속도와 비용이 우선이었다. 대화 맥락은 최근 12턴만 유지해서 토큰 비용이 무한정 늘어나지 않게 했다.

3편에서 다룬 RAG 맞춤 이력서와 이번 챗봇을 나란히 보면 재미있는 대조가 있다. 둘 다 Haiku + 커스텀 컨텍스트 주입이라는 같은 패턴을 쓰지만, RAG는 "사용자 데이터를 참고해 사실 기반으로 생성"하는 쪽이고 챗봇은 "정적 지식 베이스 안에서만 답하고 사용자 데이터는 아예 건드리지 않는" 쪽이다. 기능의 리스크 수준에 따라 데이터 접근 범위를 다르게 설계한 셈이다.

## Step 3. Stripe 구독 결제 — 무료 SaaS를 유료화하기

`6a413fa` 커밋에서 월 $7.99 구독 모델을 구현했다. 이 부분은 아직 **진행 중**이다 — Stripe 대시보드에서 secret key 설정과 DB 마이그레이션 적용까지는 끝났고, price ID·webhook 설정이 남아있다.

```
feat: Stripe 월 구독 유료 결제 + 무료 플랜 한도

- 요금제 페이지(/pricing): 무료 vs 프리미엄, 업그레이드/구독관리 버튼
- Stripe Checkout 구독 세션 + 고객 포털(billing-actions), 웹훅으로 구독상태→plan 반영
- 무료 한도: 채용페이지 5개·맞춤이력서 2개 (STRIPE_PRICE_ID 설정 시에만 적용)
- 사이드바 '프리미엄 업그레이드' → /pricing 연결
- 마이그레이션 015: profiles에 plan·stripe 컬럼 추가 (승인 후 실행 예정)
```

구조를 정리하면 이렇다.

```
사용자가 "업그레이드" 클릭
        │
        ▼
Stripe Checkout 세션 생성 (billing-actions)
        │
        ▼
Stripe 결제 완료
        │
        ▼
Webhook 이벤트 수신 (checkout.session.completed / subscription.updated 등)
        │
        ▼
profiles 테이블의 plan, subscription_status 갱신
```

Webhook 핸들러 코드를 보면, Stripe 이벤트를 profile 상태로 반영하는 로직이 한 함수에 모여 있다.

```ts
// src/app/api/stripe/webhook/route.ts
async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const profileId = sub.metadata?.profile_id
  const status = sub.status
  const active = status === 'active' || status === 'trialing'

  const patch = {
    plan: active ? 'premium' : 'free',
    subscription_status: status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    current_period_end: sub.items.data[0]?.current_period_end
      ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }

  // profile_id(metadata) 우선, 없으면 stripe_customer_id로 매칭
  const query = supabaseAdmin.from('profiles').update(patch)
  if (profileId) await query.eq('id', profileId)
  else await query.eq('stripe_customer_id', customerId)
}
```

여기서 두 가지를 눈여겨볼 만하다.

첫째, **웹훅 서명 검증**을 빼먹지 않았다는 점이다. `stripe.webhooks.constructEvent(body, sig, webhookSecret)`으로 요청이 진짜 Stripe에서 온 것인지 확인한 뒤에만 처리한다. 이게 없으면 누구나 `checkout.session.completed` 이벤트를 흉내 내서 요청을 보내 무료로 프리미엄 플랜을 얻어갈 수 있다.

둘째, **결제 연동이 안 된 환경에서는 한도 자체를 걸지 않는다**는 점이다.

```ts
// src/lib/plan.ts
export function billingEnabled(): boolean {
  return !!process.env.STRIPE_PRICE_ID
}
```

`STRIPE_PRICE_ID` 환경변수가 없으면 무료 한도(채용페이지 5개, 맞춤이력서 2개)를 아예 적용하지 않도록 했다. 결제 설정이 아직 완료되지 않은 개발/스테이징 환경에서, 업그레이드할 방법도 없는데 한도만 걸려서 기능이 막히는 상황을 막기 위해서다. 환경변수 하나로 "이 환경은 결제가 살아있는가"를 판단하는 단순한 게이팅이지만, 실무에서 꽤 유용한 패턴이었다.

무료/프리미엄 판정 로직도 한 곳에 모아뒀다.

```ts
export function planOf(profile): Plan {
  if (!profile) return 'free'
  const active = profile.subscription_status === 'active' || profile.subscription_status === 'trialing'
  if (profile.plan === 'premium' && active) return 'premium'
  if (profile.plan === 'premium' && profile.subscription_status == null) return 'premium'
  return 'free'
}
```

`subscription_status`가 아직 없는(마이그레이션 직후) 프로필도 `plan === 'premium'`이면 인정하도록 예외를 둔 부분이 눈에 띈다. 스키마 변경 중간 상태에서도 기존 데이터가 갑자기 무료로 강등되지 않도록 하는 방어적 코드다.

아직 남은 작업은 Stripe 대시보드에서 실제 가격(Price) 객체를 만들어 `STRIPE_PRICE_ID`를 채워 넣고, 프로덕션 웹훅 엔드포인트를 등록하는 것이다. 이 부분은 다음 세션에서 마무리할 예정이라 5편 격으로 이어서 다룰 수 있을 것 같다.

## 자주 쓴 패턴 요약

| 기능 | 핵심 패턴 |
|---|---|
| 원클릭 수집 | 등록(idempotent) → 즉시 수집, 슬러그는 공개 ATS API로 사전 검증 |
| 고객센터 챗봇 | 정적 지식 베이스 주입 + DB 미조회로 리스크 범위 최소화 |
| 구독 결제 | 웹훅 서명 검증 필수, 환경변수로 "결제 활성 여부" 게이팅 |

## 정리

이번 편에서 만든 세 기능은 결이 다르지만 공통된 태도가 있었다.

1. **첫 경험의 마찰을 줄이는 데 진심을 들였다.** 채용페이지 URL을 몰라도 칩 클릭 한 번으로 시작할 수 있게 한 것, 사용법을 몰라도 챗봇에 물어보면 되게 한 것 모두 "처음 온 사용자가 막히지 않게" 하려는 선택이었다.
2. **기능의 리스크에 맞춰 데이터 접근 범위를 다르게 설계했다.** 챗봇은 DB를 아예 안 건드리고, 결제는 웹훅 서명 검증을 필수로 두고, 프리셋은 등록 전에 외부 API로 사전 검증했다. "일단 되게 만들고 나중에 안전장치를 붙이자"가 아니라 처음부터 리스크 수준에 맞는 경계를 그었다.
3. **유료화는 기능 하나가 아니라 시스템이다.** Checkout, 고객 포털, 웹훅, 플랜 판정, 환경변수 게이팅까지 맞물려야 "결제"라는 하나의 기능이 완성된다. 아직 price ID·webhook 설정이 남아있는 것도 이 때문이다 — 코드는 다 짜였어도 외부 서비스(Stripe) 쪽 설정이 맞아떨어져야 실제로 동작한다.

이번 세션 전체를 돌아보면, AI 코딩 어시스턴트와 함께한 하루 동안 URL 재설계부터 데이터 유실 사고, RAG 구현, 유료화 초입까지 다뤘다. 가장 크게 배운 건 결국 "AI가 코드를 빠르게 짜주는 것"보다 "무엇을 만들지, 어디까지 권한을 줄지, 무엇을 사람이 반드시 확인해야 하는지"를 사람이 계속 판단해야 한다는 점이었다. 다음 세션에서는 Stripe 설정 마무리와, 그 이후 어떤 피드백이 들어오는지를 이어서 기록할 예정이다.
