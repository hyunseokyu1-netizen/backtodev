---
title: 'AI 코딩 어시스턴트와 SaaS 만들기 ⑨: SaaS의 "어른스러운" 부분 — 설정 페이지와 법적 문서'
date: '2026-07-04'
publish_date: '2026-08-08'
description: 우상단 아바타를 눌러도 아무 일이 없던 앱에 설정 페이지·비밀번호 변경·약관·개인정보 처리방침·고객센터를 하루에 배선한 과정 — Supabase에 없는 "기존 비밀번호 확인"을 anon 클라이언트 + admin API 2단계로 구현한 패턴 포함
tags:
  - Next.js
  - Supabase
  - SaaS
  - 인증
  - AI 코딩 어시스턴트
---

## 시작하며

8편에서 랜딩의 죽은 링크를 전부 살리고 나니, 이번엔 앱 안쪽에서 같은 종류의 피드백이 나왔다. 제품 오너(나)가 대시보드 우상단의 '유' 아바타를 눌러봤더니 — **아무 일도 일어나지 않았다.**

생각해보면 당연히 있어야 할 것들이 통째로 없었다. 매칭, 맞춤 이력서, 커버레터, 결제, 챗봇까지 다 있는데:

- 설정 페이지가 없다 — 내 이메일이 뭔지, 어떻게 가입했는지 볼 곳이 없다
- 비밀번호를 바꿀 방법이 없다
- 푸터의 "서비스 약관"·"개인정보 처리방침"·"고객센터"는 죽은 링크
- 이력서라는 민감한 데이터를 다루면서, 그 데이터가 어디로 가는지 알려주는 문서가 없다

기능(feature)은 데모에서 박수를 받지만, 이런 것들은 없을 때만 눈에 띈다. SaaS의 "어른스러운" 부분 — 설정, 비밀번호 변경, 약관, 개인정보 처리방침, 고객센터 — 을 하루에 배선한 두 커밋(`f3ac45e`, `c505ca7`) 이야기다.

## Step 1. 설정 페이지(/settings) 만들기

### 진입점부터: 죽어 있던 아바타 2개를 Link로

8편의 교훈 그대로, 페이지보다 먼저 진입점을 배선했다. 클릭할 수 있어 보이는 것은 클릭되어야 한다. 우상단 Topbar의 아바타와, 사이드바 하단의 프로필 칩 — 둘 다 지금까지 장식이었다.

```tsx
// Topbar.tsx — 아바타를 Link로 감싸기
-  <Avatar initial={initial} size={36} fontSize={14} />
+  <Link href="/settings" title="설정" className="rounded-full transition-opacity hover:opacity-80">
+    <Avatar initial={initial} size={36} fontSize={14} />
+  </Link>
```

사이드바 프로필 칩은 `<div>`를 `<Link>`로 바꾸면서, `/settings`에 있을 때 하이라이트되도록 active 처리도 넣었다.

```tsx
// Sidebar.tsx
-  <div className="flex items-center gap-[10px] p-2">
+  <Link
+    href="/settings"
+    title="설정"
+    className={`flex items-center gap-[10px] rounded-[9px] p-2 transition-colors hover:bg-[#F4F6F8] ${
+      activeKey === 'settings' ? 'bg-[#ECFDF3]' : ''
+    }`}
+  >
```

이때 `AppShell`과 `Sidebar`의 `activeKey` 유니언 타입도 확장했다.

```tsx
-  activeKey: 'dashboard' | 'discover' | 'profile'
+  activeKey: 'dashboard' | 'applications' | 'discover' | 'profile' | 'settings'
```

`'settings'`는 사이드바 nav 목록에는 없는 키다. 그래도 타입에 넣는다 — nav 항목이 아니어도 "현재 어느 화면인가"는 표현할 수 있어야 하고, 프로필 칩의 하이라이트가 그 소비자다. 유니언 타입은 메뉴 목록이 아니라 **화면 목록**으로 열어두는 편이 확장에 유리하다.

### 로그인 정보 카드 — provider 자동 감지

설정 첫 카드는 로그인 정보(이메일·로그인 방식·가입일)다. Supabase는 가입 경로를 `user.app_metadata.provider`에 담아주므로, 이걸 읽어 한글 라벨로 매핑하면 된다.

```tsx
// src/app/settings/page.tsx
const PROVIDER_LABEL: Record<string, string> = {
  email: '이메일 · 비밀번호',
  google: 'Google 소셜 로그인',
  github: 'GitHub 소셜 로그인',
  kakao: '카카오 소셜 로그인',
}

const provider = (user.app_metadata?.provider as string) ?? 'email'
const providerLabel = PROVIDER_LABEL[provider] ?? provider
const joinedAt = user.created_at
  ? new Date(user.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  : '-'
```

`PROVIDER_LABEL[provider] ?? provider` — 매핑에 없는 provider가 와도 원문이라도 보여준다. 나중에 Apple 로그인을 붙여도 설정 페이지는 안 깨진다.

### 비밀번호 변경 — Supabase에 없는 "기존 비밀번호 확인"

여기가 이번 편의 핵심 딜레마다. 비밀번호 변경 폼의 정석은 "현재 비밀번호 → 새 비밀번호 → 확인" 3칸이다. 그런데 **Supabase에는 "기존 비밀번호가 맞는지 확인"하는 API가 없다.** `updateUser({ password })`는 로그인 세션만 있으면 바로 바꿔버린다.

그게 왜 문제냐면 — 카페에서 노트북을 잠깐 열어둔 사이 누군가 내 세션으로 비밀번호를 바꾸면, 계정이 통째로 넘어간다. 세션 소유와 비밀번호 지식은 다른 층위의 인증이고, 비밀번호 변경은 후자를 요구해야 한다.

AI 어시스턴트와 논의한 끝에 나온 해법은 2단계 패턴이다. **① 세션에 영향 없는 일회용 anon 클라이언트로 `signInWithPassword`를 호출해 현재 비밀번호를 검증**하고, **② 통과하면 service role의 admin API로 교체**한다.

```ts
// src/app/settings/actions.ts (Server Action)
export async function changePassword(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: '로그인이 필요합니다.' }

  const provider = user.app_metadata?.provider ?? 'email'
  if (provider !== 'email') {
    return { error: `${provider} 소셜 로그인 계정은 비밀번호가 없습니다. ${provider} 계정 설정에서 관리하세요.` }
  }

  // ...길이·일치 검증 생략...

  // ① 현재 비밀번호 검증 (세션 쿠키에 영향 없는 일회용 anon 클라이언트)
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyError) return { error: '현재 비밀번호가 올바르지 않습니다.' }

  // ② 검증 통과 → admin API로 교체
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (error) return { error: `비밀번호 변경 실패: ${error.message}` }

  return {}
}
```

포인트 세 가지.

1. **`persistSession: false`** — 검증용 `signInWithPassword`가 성공하면 새 세션이 생기는데, 이 옵션이 없으면 그 세션이 어딘가 저장되려 든다. 일회용 클라이언트는 로그인 "시도" 자체를 비밀번호 검증기로만 쓰고 결과 세션은 버린다. 사용자의 실제 세션 쿠키는 건드리지 않는다.
2. **admin API는 검증 뒤에만** — `supabaseAdmin`(service role)은 RLS를 우회하는 만능 키라, 반드시 코드 레벨 검증(현재 비밀번호 확인 + `user.id`는 세션에서 취득)을 통과한 뒤에만 호출한다. `user.id`를 폼 입력으로 받지 않는 것도 같은 이유다.
3. **Server Action이라 가능한 설계** — service role 키가 필요한 로직이므로 애초에 클라이언트에서는 못 한다. `'use server'` 액션 안에서 검증과 교체가 한 함수에 원자적으로 묶인다.

### 소셜 로그인 유저 분기

Google로 가입한 유저에게 비밀번호 변경 폼을 보여주면 혼란만 준다 — 그 계정엔 비밀번호가 없다. 페이지에서 provider로 분기해 폼 대신 안내 문구를 보여준다.

```tsx
{provider === 'email' ? (
  <PasswordForm />
) : (
  <p className="rounded-lg bg-[#F4F6F8] px-4 py-3 text-[13px] text-[#667085]">
    {providerLabel} 계정은 별도 비밀번호가 없습니다. 해당 서비스의 계정 설정에서 관리하세요.
  </p>
)}
```

서버 액션 쪽에도 같은 분기가 있다(위 코드의 `provider !== 'email'` 가드). UI 분기는 UX용, 액션 분기는 방어용 — 화면을 우회해 액션을 직접 호출해도 막힌다.

나머지는 정석대로다. 이름·전화번호를 수정하는 개인정보 카드(`profiles` 테이블, `.eq('id', profile.id)` 필터), 계정 삭제·데이터 내보내기를 안내하는 데이터 관리 카드.

## Step 2. 법적 문서 3종 — /terms, /privacy, /support

### StaticPageShell — 정책 문서 공용 셸

약관·방침·고객센터는 전부 "랜딩 크롬 + 좁은 본문 컬럼 + 섹션 반복" 구조다. 공용 셸 하나와 섹션 컴포넌트 하나로 마크업을 통일했다.

```tsx
// src/components/matchda/landing/StaticPageShell.tsx
export default async function StaticPageShell({ title, subtitle, children }) {
  const authed = !!(await getAuthUserEmail())
  const t = getMatchdaDict('ko')
  return (
    <div className="min-h-screen bg-white ...">
      <LandingHeader t={t} authed={authed} />
      <main className="mx-auto max-w-[760px] px-4 pb-24 pt-14 sm:px-8">
        <h1 className="text-[30px] font-bold ...">{title}</h1>
        {subtitle && <p className="mt-2 text-[14px] text-[#98A2B3]">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </main>
      <SiteFooter t={t} />
    </div>
  )
}

/** 정책 문서용 섹션 (번호 제목 + 본문) */
export function PolicySection({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[17px] font-bold text-[#1F2A37]">{title}</h2>
      <div className="space-y-2 text-[14px] leading-[1.75] text-[#475467]">{children}</div>
    </section>
  )
}
```

덕분에 약관 페이지는 `<PolicySection title="제1조 (목적)">...`의 나열이 됐다. 조문 추가·수정이 레이아웃과 완전히 분리된다. 8편의 `STEPS` 배열과 같은 원칙 — 카피 수정과 코드 수정을 분리한다.

### 약관에서 AI SaaS가 반드시 써야 하는 조항

약관 11개 조문 대부분은 어느 SaaS에나 있는 보일러플레이트다. 하지만 제5조는 AI 서비스 특유의 조항이라 직접 챙겼다.

```tsx
<PolicySection title="제5조 (AI 생성 결과물에 관한 안내)">
  <p>1. 서비스가 생성하는 번역·이력서·커버레터·매칭 점수는 AI 모델의 결과물로, 정확성·완전성이 보장되지 않습니다.</p>
  <p>2. 회원은 생성된 결과물을 제출 전 반드시 직접 검토해야 하며, 결과물 사용으로 발생하는 결과(채용 여부 등)에 대해 회사는 책임을 지지 않습니다.</p>
  <p>3. 맞춤 이력서는 회원이 입력한 원본 이력서의 사실 정보만을 재구성하도록 설계되어 있으나, 최종 사실 확인 책임은 회원에게 있습니다.</p>
</PolicySection>
```

3항이 재밌는 부분이다. 3편에서 맞춤 이력서를 만들 때 "원본에 없는 사실은 추가하지 않는다"를 프롬프트 제약으로 설계했는데, 그 **제품 설계가 그대로 약관 문장이 됐다.** 좋은 제약은 코드에도 법적 문서에도 같은 문장으로 들어간다.

### 개인정보 처리방침 — 숨기지 않기로 한 결정

방침에서 제일 고민한 건 제3조(처리 위탁)였다. 이력서를 다루는 서비스에서 사용자가 가장 궁금해할(그리고 불안해할) 지점은 "내 이력서가 어디로 가는가"다. 얼버무리는 대신 5개사를 전부 명시했다.

```tsx
<PolicySection title="3. 개인정보의 처리 위탁">
  <p>· <b>Supabase</b> — 데이터베이스 및 인증 (계정·프로필·이력서 데이터 저장)</p>
  <p>· <b>Anthropic</b> — AI 처리 (이력서 번역·분석·매칭 시 이력서와 공고 내용이 Claude API로 전송됨)</p>
  <p>· <b>Stripe</b> — 결제 처리</p>
  <p>· <b>Vercel</b> — 서비스 호스팅</p>
  <p>· <b>Resend</b> — 이메일 발송</p>
</PolicySection>
```

특히 "이력서와 공고 내용이 Claude API로 전송됨"을 그대로 적었다. AI SaaS가 이걸 숨기면 언젠가 반드시 문제가 되고, 밝히면 오히려 신뢰가 된다. 기술 스택 문서가 곧 위탁 업체 목록이라, 이 조항은 CLAUDE.md를 보고 그대로 쓸 수 있었다.

### 고객센터 — JS 0바이트 아코디언

`/support`는 문의 채널 2개(챗봇 우선, 이메일 보조)와 FAQ 7개다. FAQ 아코디언은 `useState` 없이 HTML `details/summary`로 만들었다.

```tsx
{FAQS.map(f => (
  <details key={f.q} className="group rounded-[14px] border border-[#ECEEF0] bg-white px-5 py-4 open:border-[#CEEBDC]">
    <summary className="flex cursor-pointer list-none items-center justify-between ... [&::-webkit-details-marker]:hidden">
      {f.q}
      <span className="ml-3 text-[#98A2B3] transition-transform group-open:rotate-180">⌄</span>
    </summary>
    <p className="mt-3 text-[13.5px] leading-[1.7] text-[#667085]">{f.a}</p>
  </details>
))}
```

열림/닫힘 상태는 브라우저가 관리하고, Tailwind의 `open:`·`group-open:` variant로 테두리 색과 화살표 회전까지 CSS만으로 처리된다. 클라이언트 컴포넌트로 만들 이유가 하나도 없다. 정책·FAQ류 페이지에서 자주 쓰게 될 패턴이다.

채널 배치에도 의도가 있다. 챗봇 카드를 초록 배경에 "가장 빠름" 라벨로 먼저 놓고, 이메일은 "계정 삭제, 환불, 데이터 내보내기 등" 사람 손이 필요한 일로 한정했다. 4편에서 만든 챗봇이 1차 지원 채널로 승격된 셈이다.

### 미들웨어 — if 체인에서 배열로

공개 페이지가 3개 더 생기니, 8편에서 만든 미들웨어 화이트리스트 if 문이 한계에 왔다. 배열로 리팩터했다.

```ts
// src/middleware.ts
-  if (pathname === '/' || pathname === '/about' || pathname === '/pricing') {
+  const PUBLIC_PATHS = ['/', '/about', '/pricing', '/terms', '/privacy', '/support']
+  if (PUBLIC_PATHS.includes(pathname)) {
     return supabaseResponse
   }
```

조건 2개까지는 `||`가 편하고, 3개부터는 배열이 낫다. 다음 공개 페이지는 문자열 하나 추가로 끝난다. 물론 8편의 3종 세트(미들웨어 + AppChrome 경로 목록 + 링크 연결)는 이번에도 그대로 밟았다 — 푸터의 죽은 링크 3개가 드디어 실제 페이지로 연결됐다.

## Step 3. 셀프서비스 루프 — 문서·챗봇·설정이 서로를 가리키게

마지막 배선은 코드가 아니라 지식이다. 챗봇 지식 베이스(`src/lib/support/knowledge.ts`)에 설정 페이지 사용법을 추가했다.

```ts
+## 설정 (/settings)
+- 우상단 프로필 아이콘(이름 이니셜) 또는 사이드바 하단 프로필을 클릭하면 설정으로 이동합니다.
+- 이메일로 가입한 경우 현재 비밀번호 확인 후 비밀번호를 변경할 수 있습니다. 소셜 로그인(Google 등) 계정은 해당 서비스에서 비밀번호를 관리합니다.
+- 계정 삭제·데이터 내보내기는 고객센터 챗봇 또는 support@matchda.com으로 요청하면 처리됩니다.
```

이걸로 순환이 닫힌다.

- 사용자가 챗봇에 "비밀번호 어떻게 바꿔요?"라고 물으면 → 챗봇이 설정 페이지로 안내
- `/support` FAQ의 "비밀번호를 바꾸고 싶어요" → 설정 페이지로 안내
- 설정 페이지의 데이터 관리 카드 → 챗봇과 support 이메일로 안내

문서(FAQ)·챗봇·설정 페이지가 서로를 참조하는 셀프서비스 루프다. 기능을 만들 때 지식 베이스를 같은 커밋에서 갱신하는 습관은 4편부터 이어온 것인데, 기능과 "기능에 대한 답변"이 어긋나는 순간 챗봇은 거짓말쟁이가 되기 때문이다.

## 자주 쓴 패턴 요약

| 상황 | 패턴 |
|---|---|
| Supabase에서 기존 비밀번호 확인 | `persistSession: false` 일회용 anon 클라이언트로 `signInWithPassword` → 성공 시에만 `admin.updateUserById` |
| service role(admin) API 사용 | 반드시 코드 레벨 검증 뒤에만 호출, 대상 ID는 폼이 아니라 세션에서 취득 |
| 이메일/소셜 가입 구분 | `user.app_metadata.provider` + `PROVIDER_LABEL[provider] ?? provider` 폴백 |
| 소셜 유저에게 비밀번호 폼 | UI 분기(안내 문구) + 서버 액션 분기(가드), 이중으로 |
| activeKey 유니언 타입 | nav 항목이 아니어도 화면이면 타입에 추가 — 메뉴 목록이 아니라 화면 목록 |
| 정책 문서 마크업 | `StaticPageShell` + `PolicySection` — 조문 수정과 레이아웃 분리 |
| FAQ 아코디언 | `details/summary` + Tailwind `open:`/`group-open:` — JS 0바이트 |
| 공개 경로 화이트리스트 | 조건 3개부터는 `PUBLIC_PATHS` 배열 + `includes` |
| 기능 추가 시 | 챗봇 지식 베이스를 같은 커밋에서 갱신 — 문서·챗봇·화면이 서로를 참조 |

## 정리

1. **어른스러운 부분은 없을 때만 보인다.** 매칭도 결제도 챗봇도 있는데 설정이 없다는 건, 만드는 사람 눈에는 안 보인다. "아바타 눌러도 아무 일 없음" 같은 피드백은 결국 **실제로 눌러본 사람**에게서만 나온다 — 8편의 죽은 링크와 정확히 같은 교훈이 앱 안쪽에서 반복됐다.
2. **비밀번호 변경은 세션 인증이 아니라 지식 인증이다.** Supabase가 기존 비밀번호 확인 API를 안 주는 건 함정이다. 일회용 anon 클라이언트로 검증하고 admin API로 교체하는 2단계 패턴은, 세션 탈취만으로 계정이 넘어가는 걸 막는 최소한의 방어다.
3. **AI가 잘 쓰는 것과 사람이 정해야 하는 것의 경계를 인수인계하라.** 약관·방침의 보일러플레이트는 AI 어시스턴트가 몇 분 만에 초안을 뽑는다. 하지만 환불 정책("7일 이내·실질 미사용"), support@matchda.com이 실제로 수신되는 메일함인지, 사업자 정보를 언제 채울지는 AI가 정할 수 없는 **사업 결정**이다. 초안을 받으며 이 목록을 명시적으로 넘겨받았고, 이건 코드 리뷰가 아니라 오너의 숙제로 남겼다.
4. **투명성은 조항이 아니라 결정이다.** "이력서가 Claude API로 전송됨"을 방침에 그대로 적은 건 법적 요건 이전에 신뢰의 문제였다. AI SaaS의 처리 위탁 조항은 기술 스택 문서와 같아야 한다 — 다르다면 둘 중 하나가 거짓말이다.

이제 matchda.com에서 아바타를 누르면 설정이 열리고, 푸터의 약관·방침·고객센터는 진짜 문서로 이어지고, 챗봇은 "비밀번호 어떻게 바꿔요?"에 답할 수 있다. 화려한 기능은 하나도 없는 하루였지만, 이 하루를 지나고 나서야 MatchDa는 장난감이 아니라 서비스처럼 보이기 시작했다.
