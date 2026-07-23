---
title: '매치다 안전하게 만들기 ④: 이력서 공개 공유 링크로 바이럴 루프 설계하기'
date: '2026-07-07'
publish_date: '2026-08-22'
description: 로그인 없이 열람 가능한 이력서 공유 페이지(/r/slug)를 개인정보 보호와 검색엔진 색인 차단까지 고려해 구현한 기록
tags:
  - Next.js
  - SupabaseRLS
  - 바이럴루프
  - 성장전략
  - 개인정보보호
---

## 왜 이 기능이 필요했나

매치다는 한국어 이력서를 영문으로 정리해주는 서비스입니다. 마케팅 방향을 고민하다가, "이미 만든 결과물을 유저가 자연스럽게 공유하게 만드는 것"이 광고보다 훨씬 효율적인 성장 전략이라는 결론에 도달했습니다. 흔히 **바이럴 루프(viral loop)**라고 부르는 구조인데, 원리는 단순합니다.

> 유저가 자기 결과물(이력서)을 SNS나 커뮤니티에 공유 → 그 페이지 하단에 "이 이력서는 OO로 만들었습니다"라는 표시 → 그걸 본 사람이 유입

콘텐츠 마케팅이나 광고는 만드는 사람이 계속 힘을 써야 하지만, 이런 루프는 **제품 자체가 광고를 만들어냅니다.** 그래서 이번엔 "공개 이력서 공유 링크"를 실제로 구현했습니다.

## 설계 원칙 먼저 정하기

기능을 짜기 전에 세 가지를 먼저 정했습니다. 이력서는 민감한 개인정보라, 나중에 고치는 것보다 처음부터 원칙을 세우는 게 안전합니다.

1. **연락처(이메일·전화번호)는 공개 페이지에 절대 포함하지 않는다.** 이름·경력·스킬만 보여준다.
2. **검색엔진에는 색인되지 않게 한다.** "공유 링크가 있는 사람만 볼 수 있다"와 "구글 검색하면 누구나 나온다"는 완전히 다른 프라이버시 수준이다.
3. **토글 하나로 껐다 켤 수 있고, 끄면 즉시 접근 불가능해야 한다.**

## Step 1. DB에 컬럼 두 개 추가

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS public_slug            TEXT,
  ADD COLUMN IF NOT EXISTS public_resume_enabled  BOOLEAN NOT NULL DEFAULT false;

-- 슬러그는 전역에서 유일해야 URL이 충돌하지 않는다
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_public_slug
  ON profiles (public_slug)
  WHERE public_slug IS NOT NULL;
```

`public_slug`가 곧 공개 URL(`/r/<slug>`)의 식별자입니다. `WHERE public_slug IS NOT NULL` 조건부 유니크 인덱스를 쓴 이유는, 대부분의 유저는 이 기능을 안 쓸 텐데 `NULL` 값끼리는 유니크 제약에서 충돌로 안 치기 때문입니다(`NULL`은 `NULL`과 다르다고 취급됩니다).

## Step 2. 추측하기 어려운 슬러그 생성

URL 경로에 유저 ID를 그대로 노출하면 순차적으로 유추당할 위험이 있으니, 랜덤 문자열을 씁니다.

```ts
function genSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}
```

`Math.random()` 대신 `crypto.getRandomValues`를 쓴 이유는, 전자는 암호학적으로 안전하지 않아서 URL처럼 추측되면 안 되는 값에는 부적합하기 때문입니다.

슬러그를 생성할 때 유니크 인덱스 충돌(다른 유저가 이미 같은 슬러그를 가진 경우) 가능성도 고려해서 재시도 로직을 넣었습니다.

```ts
if (enable && !slug) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = genSlug()
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ public_slug: candidate, public_resume_enabled: true })
      .eq('id', profile.id)
    if (!error) { slug = candidate; break }
    if (error.code !== '23505') return { error: error.message }  // 23505 = unique_violation 외의 에러는 즉시 반환
  }
}
```

10자리 랜덤 문자열이 겹칠 확률은 극히 낮지만(36^10가지 조합), 그래도 "혹시 겹치면 어떻게 할까"를 코드로 명시해두는 게 나중에 원인 모를 실패를 줄여줍니다.

## Step 3. 공개 페이지 만들기 — 기존 컴포넌트 재사용

여기서 예상외로 수월했던 부분이 있습니다. 매치다에는 이미 이력서를 렌더링하는 `ResumeDocument`라는 컴포넌트가 있었는데, 확인해보니 `'use client'` 지시어가 없는 순수 서버 컴포넌트였습니다. 즉 **로그인 상태나 클라이언트 훅에 의존하지 않는 순수 프레젠테이션 컴포넌트**라서, 공개 페이지에서도 그대로 가져다 쓸 수 있었습니다.

```tsx
// src/app/r/[slug]/page.tsx
export default async function PublicResumePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const profile = await getPublicProfile(slug)
  if (!profile) notFound()

  const resume = toStudioResume(profile.onboarding_en)

  // 공개 이력서에는 연락처(이메일·전화)를 넣지 않는다 — 개인정보 최소화
  const doc = studioToDoc(resume, '')

  return (
    <div className="min-h-screen bg-[#F4F6F8] py-8 px-4 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <ResumeDocument doc={doc} labels={EN_LABELS} variant="original" />
        {/* 워터마크 + CTA */}
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[13px] text-[#98A2B3]">
            이 이력서는 <span className="font-semibold">MatchDa</span>로 제작되었습니다.
          </p>
          <Link href="/" className="rounded-[10px] bg-[#046C4E] px-5 py-2.5 text-white">
            나도 영문 이력서 무료로 만들기
          </Link>
        </div>
      </div>
    </div>
  )
}
```

`studioToDoc(resume, '')`에서 두 번째 인자(연락처)를 빈 문자열로 넘긴 게 원칙 1번(연락처 미노출)을 구현한 부분입니다. 데이터를 아예 안 담아서 넘기니, 실수로 어딘가에 렌더될 걱정이 없습니다.

조회 함수는 반드시 `public_resume_enabled = true`인 프로필만 리턴하게 만들어서, 토글을 끄면 그 즉시 404가 뜨게 했습니다.

```ts
async function getPublicProfile(slug: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('onboarding_en, public_resume_enabled')
    .eq('public_slug', slug)
    .eq('public_resume_enabled', true)   // 꺼져 있으면 조회 자체가 안 됨
    .maybeSingle()
  return data
}
```

## Step 4. 검색엔진 색인 차단

Next.js의 `generateMetadata`에서 `robots` 필드로 간단히 처리됩니다.

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  // ...
  return {
    title: `${name} — MatchDa`,
    robots: { index: false },  // 검색엔진 색인 제외(개인 이력서)
  }
}
```

이걸로 "링크를 아는 사람만 볼 수 있다"와 "구글에 검색되어 누구나 찾을 수 있다" 사이의 선을 지켰습니다.

## Step 5. 미들웨어에 공개 경로 등록

매치다는 미들웨어에서 로그인 여부를 확인해 페이지 접근을 막는데, `/r/*`는 로그인 없이 봐야 하는 경로라 공개 목록에 추가했습니다.

```ts
// src/middleware.ts
if (pathname.startsWith('/r/')) {
  return supabaseResponse  // 로그인 없이 열람 가능
}
```

## Step 6. 실제로 켜보고 검증한 뒤 즉시 원복

기능을 다 짜고 나서 "될 것 같다"로 끝내지 않고, 실제로 동작을 확인했습니다. 로컬 dev 서버를 띄우고, 검증용으로 잠깐 슬러그를 켰다가 확인 후 바로 껐습니다.

```bash
# 1) 없는 슬러그 → 404 확인
curl -s -o /dev/null -w "%{http_code}" http://localhost:3999/r/nonexistent
# → 404

# 2) 임시로 공개 설정
curl -X PATCH ".../profiles?email=eq.내이메일" -d '{"public_slug":"verifytest","public_resume_enabled":true}'

# 3) 렌더 확인 — 이름은 나오고 이메일은 안 나오는지 grep으로 검사
curl -s http://localhost:3999/r/verifytest | grep -o "홍길동"        # 나와야 정상
curl -s http://localhost:3999/r/verifytest | grep -o "my@email.com" # 안 나와야 정상

# 4) 즉시 원복
curl -X PATCH ".../profiles?email=eq.내이메일" -d '{"public_slug":null,"public_resume_enabled":false}'
```

기능 구현에서 가장 신경 쓴 부분이 바로 이 검증 단계였습니다. "연락처를 안 넣었으니 안 나오겠지"라고 추측만 하고 넘어가지 않고, 실제 렌더링 결과물에서 이메일 문자열이 정말 없는지 `grep`으로 직접 확인했습니다.

## 자주 쓰는 패턴 요약

| 목적 | 방법 |
|---|---|
| 추측 불가능한 URL 슬러그 생성 | `crypto.getRandomValues()` (Math.random 금지) |
| NULL 값끼리 유니크 제약 피하기 | `CREATE UNIQUE INDEX ... WHERE col IS NOT NULL` |
| 개인정보 안 남기고 렌더 | 애초에 데이터를 안 담아서 넘기기 (`studioToDoc(resume, '')`) |
| 검색엔진 색인 차단 | Next.js `generateMetadata`의 `robots: { index: false }` |
| 토글 끄면 즉시 비공개 | 조회 쿼리 자체에 `enabled = true` 조건 포함 |

## 트러블슈팅

**Q. 유니크 인덱스에 슬러그가 중복돼서 실패하면?**
A. Postgres의 unique_violation 에러 코드는 `23505`입니다. 이 코드일 때만 재시도하고, 다른 에러는 그대로 반환하도록 분기했습니다. 모든 에러를 재시도하면 진짜 문제(권한 오류 등)를 숨기게 됩니다.

**Q. 기존 컴포넌트를 재사용해도 되는지 어떻게 판단하나?**
A. 컴포넌트 파일 맨 위에 `'use client'`가 있는지부터 봅니다. 없으면 서버에서도 그대로 렌더 가능한 순수 컴포넌트일 가능성이 높습니다. 이번에도 `ResumeDocument`가 그런 경우라 새로 만들 필요가 없었습니다.

## 정리

```
공개 여부 컬럼 추가 → 안전한 슬러그 생성(+ 충돌 재시도)
  → 기존 렌더 컴포넌트 재사용(연락처는 아예 안 넘김)
  → robots: noindex로 검색엔진 차단 → 미들웨어에 공개 경로 등록
  → 실제 렌더 결과를 grep으로 검증 후 원복
```

기능 자체보다 더 중요하게 남은 건, **"공유되는 걸 전제로 만드는 기능은 개인정보 원칙을 코드보다 먼저 정해야 한다"**는 것입니다. 연락처 제외, 색인 차단, 즉시 비공개 전환 — 이 세 가지를 나중에 추가하려 했다면 이미 어딘가에 새어나간 뒤였을 수도 있습니다.

다음 편(마지막)에서는 방향을 바꿔서, "학력을 여러 개 등록했는데 화면엔 하나만 보이는" 버그를 추적하다가 발견한 타입 설계 문제를 다룹니다.
