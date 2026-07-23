---
title: 'AI 코딩 어시스턴트와 SaaS 만들기 ⑩: 비밀번호 찾기부터 눈 아이콘까지 — 인증 UX 마감 작업'
date: '2026-07-05'
publish_date: '2026-08-09'
description: Supabase가 "일부러 성공처럼" 응답하는 기가입 signUp의 정체(identities 빈 배열), open redirect를 한 줄로 막는 next 파라미터 설계, 그리고 2편 데이터 유실 사고의 원인이었던 admin API 함정을 이번엔 알고 피해간 이야기
tags:
  - Supabase
  - Next.js
  - 인증
  - UX
  - AI 코딩 어시스턴트
---

## 시작하며

9편에서 설정 페이지와 비밀번호 변경까지 만들고 나니, 인증 주변에 아직 구멍이 세 개 남아 있었다.

- 비밀번호를 **잊어버린** 사람은 방법이 없다 — 로그인한 사람만 바꿀 수 있으니까
- 이미 가입한 이메일로 회원가입을 누르면 "가입 완료"라고 뜬다 (?!)
- 비밀번호 입력칸에 눈 아이콘이 없다 — 요즘 서비스 중에 이게 없는 곳을 본 적이 있는가

셋 다 "핵심 기능"은 아니다. 하지만 인증은 모든 사용자가 반드시 지나가는 문이고, 문에서 걸리면 그 뒤에 뭐가 있는지는 영영 못 보여준다. 이 세 구멍을 하루에 메운 세 커밋(`6f0b067`, `46ab3f5`, `992365c`) 이야기다. 특히 두 번째 구멍은 파고들다 보니 **Supabase가 일부러 거짓말을 하는** 지점이었고, 그걸 우회하는 과정에서 2편의 데이터 유실 사고와 정확히 같은 함정을 다시 만났다 — 이번엔 결과가 달랐지만.

## Step 1. 비밀번호 찾기·재설정 플로우 (`6f0b067`)

### 플로우 전체 그림

Supabase의 비밀번호 재설정은 페이지 두 개와 콜백 하나로 구성된다.

```
로그인 폼 "비밀번호를 잊으셨나요?"
  → /forgot-password (이메일 입력 → resetPasswordForEmail)
  → 사용자 메일함의 재설정 링크 클릭
  → /auth/callback?code=...&next=/reset-password (코드를 세션으로 교환)
  → /reset-password (새 비밀번호 입력 → updateUser)
  → /dashboard
```

발송 쪽은 `resetPasswordForEmail` 한 번이면 끝인데, `redirectTo`에 목적지를 실어 보내는 게 포인트다.

```tsx
// src/app/forgot-password/page.tsx
const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
  redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
})
```

여기서 개념 하나를 짚고 가야 한다. **메일 링크를 클릭한 순간, 사용자는 이미 (임시로) 로그인된 상태다.** Supabase는 재설정 링크의 코드를 세션으로 교환해주는데, 이걸 recovery 세션이라 부른다. 그래서 `/reset-password`에서 새 비밀번호를 저장하는 코드는 놀랍게도 그냥 `updateUser`다 — 9편 설정 페이지의 비밀번호 변경과 같은 API를, "기존 비밀번호 확인 없이" 쓸 수 있는 이유가 바로 이 recovery 세션이다. 메일함 접근 자체가 본인 인증을 대신했으니까.

```tsx
// src/app/reset-password/page.tsx
const { error } = await supabase.auth.updateUser({ password })

if (error) {
  setError(
    error.message.includes('different from the old')
      ? '이전과 다른 비밀번호를 사용해주세요.'
      : '변경에 실패했어요. 재설정 링크가 만료됐을 수 있으니 다시 요청해주세요.'
  )
  return
}
setDone(true)
setTimeout(() => router.push('/dashboard'), 1500)
```

에러 분기 두 번째 문구도 실사용에서 나온다. 재설정 링크는 만료되는데, 사용자 입장에서 "AuthApiError: ..." 같은 원문은 아무 도움이 안 된다. "링크가 만료됐을 수 있으니 다시 요청해주세요"가 실제로 할 수 있는 다음 행동이다.

### auth 콜백의 `next` 파라미터 — open redirect를 막는 한 줄

기존 auth 콜백은 무조건 `/dashboard`로 보냈다. 재설정 플로우는 `/reset-password`로 가야 하니 목적지를 파라미터로 받게 바꿨는데, 여기서 그냥 `next`를 믿고 리다이렉트하면 **open redirect 취약점**이 된다. 공격자가 `?next=https://evil.com`을 심은 링크를 뿌리면, 우리 도메인에서 출발한 리다이렉트가 피싱 사이트로 사용자를 실어 나른다.

```ts
// src/app/auth/callback/route.ts
const next = searchParams.get('next')
// open redirect 방지: 내부 경로만 허용
const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

return NextResponse.redirect(`${origin}${target}`)
```

방어는 한 줄이다. `startsWith('/')`로 절대 URL(`https://...`)을 거르고, `!startsWith('//')`로 프로토콜 상대 URL(`//evil.com` — 앞에 `/`가 있어서 첫 조건은 통과한다)까지 거른다. 화이트리스트 배열을 만들 수도 있었지만, "내부 경로 전부 허용"이 이 서비스의 요구사항이라 이 두 조건이면 충분하다. AI 어시스턴트가 `next` 파라미터를 추가하면서 이 방어를 같은 커밋에 함께 넣었는데, 이런 "기능에 따라오는 보안 상식"이 자동으로 딸려 오는 건 확실히 편하다 — 물론 딸려 왔는지 리뷰에서 확인하는 건 내 몫이다.

## Step 2. 기가입 이메일 가입 차단 — Supabase의 "착한 거짓말" (`46ab3f5`)

### 증상: 가입된 이메일인데 "가입 완료"

이번 편의 하이라이트다. 제품 오너(나)가 테스트하다 이상한 걸 발견했다. **이미 가입된 이메일로 회원가입 버튼을 누르면 "가입이 완료됐습니다"라고 뜬다.** 에러도 없고, 물론 실제로 가입되지도 않는다. 사용자 입장에선 가입이 된 줄 알고 로그인하다가 "비밀번호가 틀렸다"는 미궁에 빠지는 최악의 경로다.

AI 어시스턴트에게 원인 규명을 시켰더니, 먼저 실제 `signUp` 응답을 로그로 찍었다.

```
[Signup] 결과 - error: null | user: hyunseok.yu1@gmail.com | confirmed: undefined
[Signup] user.identities: []
```

`error: null`. user 객체도 멀쩡히 온다. 그런데 `identities`가 **빈 배열**이다. 정상 가입이면 email identity가 하나 들어 있어야 할 자리다.

### 원인: email enumeration 방지 정책

이건 버그가 아니라 Supabase의 **의도된 동작**이다. 이메일 확인(confirm email)이 켜진 환경에서 기가입 이메일로 `signUp`을 호출하면, Supabase는 일부러 성공처럼 응답한다. "이미 가입된 이메일입니다"라고 정직하게 답하면, 공격자가 임의 이메일을 넣어보는 것만으로 "이 이메일은 이 서비스의 회원이다"를 알아낼 수 있기 때문이다(email enumeration). 대신 가짜 성공 응답에 `identities: []`라는 흔적만 남긴다.

보안 관점에선 훌륭한 정책이다. 문제는 **우리 서비스엔 이 보호가 필요 없다는 것**이다. 데이팅 앱이나 익명 커뮤니티라면 "회원 여부" 자체가 민감 정보지만, 잡 매칭 SaaS에서 이메일 가입 여부가 노출돼서 생기는 위험은 사실상 없다. 반면 "가입된 이메일인데 가입 완료라고 뜨는" UX 비용은 확실하다. 보안 정책과 UX가 충돌할 때 어느 쪽을 택할지는 프레임워크가 아니라 **제품이 결정할 문제**고, 여기선 명시적 안내를 택했다.

### 해법: 이중 방어 — 그리고 2편 함정과의 재회

1차 방어는 signUp 전에 서버에서 직접 확인하는 `emailExists` 서버 액션이다. 그런데 여기서 — 시리즈를 처음부터 읽은 분이라면 등골이 서늘할 지점이 나온다. "admin API로 이메일 조회"라면, **2편에서 내 계정을 통째로 날려먹은 바로 그 함정**이다. GoTrue admin API는 email 쿼리 필터를 조용히 무시하고 전체 유저 목록을 반환한다. 그때는 이걸 몰라서 `[0]`번 유저를 삭제했고, 그 `[0]`이 내 실제 계정이었다.

이번엔 알고 있었다. 사고 직후 AI 어시스턴트의 메모리에 등록해둔 규칙("admin API의 email 필터를 신뢰하지 않는다")이 그대로 코드 주석과 구현에 반영됐다.

```ts
// src/app/auth-actions.ts
/**
 * 회원가입 전 이메일 중복 검사.
 * 주의: GoTrue admin API의 email 쿼리 필터는 무시되므로(전체 반환),
 * 반드시 페이지네이션 순회 후 로컬에서 정확히 매칭한다.
 */
export async function emailExists(email: string): Promise<boolean> {
  const { supabaseAdmin } = await import('@/lib/supabase-admin')
  const target = email.trim().toLowerCase()
  if (!target) return false

  let page = 1
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return false // 판단 불가 시 가입 흐름을 막지 않음 (identities 폴백이 2차 방어)
    if (data.users.some(u => u.email?.toLowerCase() === target)) return true
    if (data.users.length < 200) return false
    page++
  }
  return false
}
```

필터를 서버에 맡기지 않고, **페이지를 순회하며 로컬에서 정확히 매칭**한다. 같은 함정, 다른 결과. 2편에서는 이 함정이 데이터 유실 사고가 됐고, 이번에는 주석 한 줄짜리 방어 지식이 됐다. 사고를 메모리에 규칙으로 남겨둔 게 이렇게 회수된다.

설계 디테일 두 가지도 짚을 만하다.

- **에러 시 `false` 반환** — 중복 검사가 실패했다고 가입 자체를 막으면 안 된다. 판단 불가면 통과시키고, 뒤의 2차 방어에 맡긴다.
- **2차 방어는 identities 빈 배열 감지** — 프리체크가 놓쳐도(레이스 컨디션, admin API 장애) Supabase의 가짜 성공 응답에서 흔적을 잡는다.

```tsx
// src/app/login/LoginForm.tsx
// 1차: 서버에서 기가입 여부 확인
if (await emailExists(email)) {
  setError('이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.')
  setLoading(false)
  return
}

const { data, error } = await supabase.auth.signUp({ email, password })
// ...
} else if (data.user && (data.user.identities?.length ?? 0) === 0) {
  // 2차 방어: 기가입 이메일이면 Supabase가 identities를 비워 보낸다
  setError('이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.')
}
```

### 에러 문구는 출구가 있어야 한다

"이미 가입된 이메일입니다"에서 끝나면 사용자는 다시 막다른 길이다. 이 사람이 다음에 할 일은 둘 중 하나 — 로그인하거나, 비밀번호를 찾거나. 에러 박스 안에 그 두 출구를 버튼으로 넣었다.

```tsx
{error.includes('이미 가입된') && (
  <span className="mt-1 flex gap-3">
    <button type="button" onClick={() => { setMode('login'); setError(''); setMessage('') }}
      className="font-semibold text-[#046C4E] hover:underline">
      로그인하기
    </button>
    <Link href="/forgot-password" className="font-semibold text-[#046C4E] hover:underline">
      비밀번호 찾기
    </Link>
  </span>
)}
```

Step 1에서 만든 `/forgot-password`가 여기서 바로 출구로 쓰인다. 같은 날 작업한 기능들이 서로의 배선이 되는 순간이다.

덤으로, 가입 성공 문구도 이번에 정정했다. 기존 "가입이 완료됐습니다. 로그인해주세요."는 이메일 확인이 필수인 현재 환경에서 거짓말이다 — 메일 인증 전엔 로그인이 안 되니까. "확인 메일을 보냈어요. 메일함(스팸함 포함)에서 인증을 완료해주세요."로 바꿨다.

## Step 3. 비밀번호 보기 토글 — 공용 PasswordInput (`992365c`)

마지막은 작지만 앱 전체에 닿는 작업이다. 비밀번호 입력칸이 이 시점에 몇 개였냐면 — 로그인/회원가입 1개, 재설정 2개(새 비밀번호·확인), 설정의 비밀번호 변경 3개(현재·새·확인). **총 5개 필드 전부에 눈 아이콘이 없었다.**

각 폼에 `useState`를 하나씩 심는 대신 공용 컴포넌트로 만들었다.

```tsx
// src/components/ui/PasswordInput.tsx
export default function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className ?? ''} pr-10`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#475467]"
      >
        {/* eye / eye-off SVG */}
      </button>
    </div>
  )
}
```

44줄짜리 컴포넌트지만 설계 결정이 몇 개 들어 있다.

1. **`{...props}` 스프레드 + `type` 오버라이드** — `InputHTMLAttributes` 전체를 그대로 받아서 `input`에 넘기되, `type`만 스프레드 **뒤에** 둬서 토글 상태가 항상 이긴다. 기존 폼들의 `value`, `onChange`, `required`, `minLength`, `placeholder`를 하나도 안 건드리고 태그 이름만 `input` → `PasswordInput`으로 바꾸면 끝난다. 실제로 적용 diff가 폼당 1~3줄이다.
2. **`className`도 그대로 통과** — 각 폼의 기존 input 스타일을 유지하고 `pr-10`(아이콘 자리)만 덧붙인다. 공용 컴포넌트가 스타일을 소유하지 않으니 로그인 폼과 설정 폼의 서로 다른 룩을 억지로 통일할 필요가 없다.
3. **`tabIndex={-1}`** — 이메일 → 비밀번호 → 제출 버튼으로 가는 탭 흐름 사이에 눈 아이콘이 끼어들면 키보드 사용자가 매번 한 번 더 탭해야 한다. 토글은 마우스/터치 보조 기능이므로 탭 순서에서 뺐다. 대신 `aria-label`로 스크린 리더에는 정체를 알린다.

### Playwright로 토글까지 자동 검증

적용 후 검증도 AI 어시스턴트가 Playwright로 직접 돌렸다. 로그인 페이지를 열고, 비밀번호를 입력하고, 눈 아이콘을 클릭한 뒤 **input의 type 속성이 `password` → `text`로 실제로 바뀌는지**까지 확인하는 식이다.

```
✓ /login: 눈 아이콘 표시됨, 클릭 → input[type=text], 재클릭 → input[type=password]
✓ /reset-password: 2개 필드 각각 독립 토글 동작
✓ /settings: 비밀번호 변경 3개 필드 토글 동작
```

"화면에 아이콘이 보인다"가 아니라 "클릭하면 type이 바뀐다"를 검증하는 게 요점이다. UI 검증은 렌더링 확인에서 멈추기 쉬운데, 상태 토글류는 동작 후의 DOM 속성까지 봐야 실제로 검증한 것이다.

## 자주 쓴 패턴 요약

| 상황 | 패턴 |
|---|---|
| 비밀번호 재설정 발송 | `resetPasswordForEmail(email, { redirectTo: origin + '/auth/callback?next=/reset-password' })` |
| 재설정 페이지에서 저장 | recovery 세션 위에서 그냥 `updateUser({ password })` — 메일 링크 클릭이 본인 인증을 대신 |
| 콜백 리다이렉트 목적지 | `next.startsWith('/') && !next.startsWith('//')` — 절대 URL과 `//host` 둘 다 차단 |
| 기가입 signUp 감지 | ① 서버 프리체크(`emailExists`) ② `identities.length === 0` 폴백, 이중 방어 |
| admin API로 유저 이메일 조회 | email 필터를 신뢰하지 말 것 — `listUsers` 페이지 순회 + 로컬 정확 매칭 |
| 프리체크 실패 시 | 가입 흐름을 막지 않고 통과 → 2차 방어에 위임 |
| 에러 메시지 | 막다른 길 금지 — 다음 행동(로그인하기·비밀번호 찾기)을 버튼으로 |
| 비밀번호 토글 컴포넌트 | `{...props}` 스프레드 + `type` 오버라이드, `className` 통과, `tabIndex={-1}` + `aria-label` |
| 토글 UI 검증 | 렌더링이 아니라 동작 후 DOM 속성(`input[type]`)까지 Playwright로 확인 |

## 정리

1. **프레임워크의 "착한 거짓말"은 제품 결정으로 뒤집을 수 있어야 한다.** Supabase가 기가입 signUp에 성공처럼 응답하는 건 email enumeration 방지라는 합리적 정책이다. 하지만 그 보호가 우리 서비스에 필요한지는 Supabase가 아니라 제품 오너가 판단할 문제고, 뒤집기로 했다면 `identities: []` 같은 흔적을 찾아내는 건 로그를 실제로 찍어보는 데서 시작한다. 문서보다 응답이 진실이다.
2. **사고는 규칙이 되고, 규칙은 코드가 된다.** 2편에서 계정을 날린 "admin API email 필터 무시" 함정을, 이번엔 주석과 페이지 순회 구현으로 정면에서 피해갔다. 같은 함정을 두 번 만나는 건 피할 수 없지만, 두 번째에 같은 값을 지불할지는 첫 번째 사고를 어떻게 기록했느냐에 달렸다. AI 어시스턴트의 메모리에 남긴 사고 규칙이 몇 주 뒤 커밋에서 회수되는 걸 보는 건 이 시리즈에서 가장 보람 있는 순간이었다.
3. **인증 UX의 완성도는 예외 경로에서 드러난다.** 정상 가입·정상 로그인은 누구나 만든다. 비밀번호를 잊은 사람, 이미 가입한 걸 잊은 사람, 입력한 비밀번호를 확인하고 싶은 사람 — 이 예외 경로들이 매끄러워야 문 앞에서 이탈하지 않는다. 그리고 예외 경로의 에러 문구에는 반드시 출구(다음 행동 버튼)가 있어야 한다.

다음 편은 이 플로우의 나머지 반쪽이다 — 사용자 메일함에 실제로 도착하는 그 메일. "Confirm your signup"이라는 밋밋한 제목의 Supabase 기본 메일을 브랜드 템플릿으로 바꾸고, Resend SMTP를 연결하며 겪은 설정 협업기를 다룬다.
