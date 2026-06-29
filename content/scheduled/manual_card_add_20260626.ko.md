---
title: '링크 복사가 안 되는 채용 사이트, 카드 직접 추가 기능으로 해결하기'
date: '2026-06-26'
publish_date: '2026-07-19'
description: URL 스크래핑이 막힌 채용공고를 직접 입력해 카드로 만드는 기능을 Next.js 서버 액션으로 구현한 기록
tags:
  - Next.js
  - Server Actions
  - Supabase
  - TypeScript
---

채용공고를 모아서 관리하는 사이드 프로젝트(JobRadar)를 만들면서, 처음엔 "URL만 붙여넣으면 알아서 긁어온다"는 흐름으로 충분하다고 생각했습니다. 공고 페이지 링크를 입력칸에 넣으면 스크래퍼가 제목·회사·위치를 가져오고, 곧바로 AI 매칭까지 돌아가는 구조였죠.

그런데 며칠 쓰다 보니 현실은 좀 달랐습니다.

## 왜 "직접 추가"가 필요했나

문제는 **링크 복사 자체가 안 되는 사이트**가 의외로 많다는 거였습니다.

- 회사 자체 채용 페이지인데 공고마다 고유 URL이 없고, 한 페이지에서 자바스크립트로 내용만 바꿔치는 경우
- 로그인을 해야만 공고가 보여서, URL을 그대로 넣으면 스크래퍼는 로그인 페이지만 받아오는 경우
- 링크드인·인디드처럼 봇 차단이 빡세서 스크래핑이 번번이 실패하는 경우
- 심지어 채용 담당자가 메일이나 메신저로 JD 텍스트만 던져주는 경우

이런 공고들은 URL 기반 흐름에서 아예 등록이 안 됩니다. 분명 지원하고 싶은 공고인데 내 관리 보드에 올릴 방법이 없는 거죠. 그래서 **URL 없이도 손으로 입력해서 카드를 만드는 "직접 추가"** 기능을 붙이기로 했습니다.

핵심 요구사항은 단순했습니다.

1. URL 없이 직무명만 있어도 카드가 생성될 것
2. JD(채용공고 본문)를 같이 붙여넣으면, 기존처럼 자동으로 AI 매칭까지 돌 것
3. 기존 데이터 구조를 최대한 건드리지 않을 것

## 사전 준비: 기존 구조 파악하기

이미 URL로 추가하는 `addJobByUrl`이라는 서버 액션이 잘 동작하고 있었기 때문에, 새 기능도 같은 패턴을 따라가는 게 안전했습니다. 데이터 흐름은 이렇게 생겼습니다.

- `jobs` 테이블: 공고 자체 (title, company, location, url, source, description ...)
- `matches` 테이블: "이 유저가 이 공고를 담았다"는 연결 (user_id, job_id, status)

여기서 발목을 잡은 게 하나 있었습니다. `jobs.url` 컬럼이 **고유(unique)이자 필수(not null)** 였다는 점입니다. URL 기반으로 중복을 거르는 구조였으니 당연한 설계인데, "URL 없는 공고"를 넣으려니 이 제약과 정면으로 부딪혔습니다.

## Step 1. 합성 URL로 제약 우회하기

테이블 스키마를 바꾸는 건 마이그레이션이 필요하고, 기존 중복 체크 로직에도 영향을 줍니다. 그래서 **스키마는 그대로 두고, 직접 추가 공고에는 가짜(합성) URL을 부여**하는 쪽을 택했습니다.

```ts
// URL 컬럼은 고유·필수이므로 직접 입력 공고에는 합성 URL을 부여한다.
const syntheticUrl = `manual://${globalThis.crypto.randomUUID()}`
```

`manual://` 스킴을 붙인 이유는 두 가지입니다.

- `crypto.randomUUID()`로 매번 다른 값이 나오니 **unique 제약을 자연스럽게 통과**
- 나중에 `WHERE url LIKE 'manual://%'` 같은 식으로 **직접 추가 공고만 골라내기 쉬움**

`globalThis.crypto`는 Node 19+ / 최신 Next.js 런타임에서 별도 import 없이 바로 쓸 수 있어서 편했습니다.

## Step 2. 서버 액션 작성

이제 본체인 `addJobManually` 서버 액션입니다. `'use server'`가 선언된 파일에 함수를 하나 추가하면 끝입니다. 폼 데이터를 받아서 → 검증하고 → `jobs`에 insert → `matches`에 연결 → JD가 있으면 매칭까지 돌립니다.

```ts
'use server'

export async function addJobManually(
  formData: FormData
): Promise<{ jobId?: string; matched?: boolean; score?: number; error?: string }> {
  const email = await getAuthUserEmail()
  if (!email) return { error: '로그인이 필요합니다.' }

  const title = (formData.get('title') as string)?.trim()
  const company = (formData.get('company') as string)?.trim() ?? ''
  const location = (formData.get('location') as string)?.trim() ?? ''
  const description = (formData.get('description') as string)?.trim() ?? ''

  if (!title) return { error: '직무명을 입력해주세요.' }

  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  // URL 컬럼은 고유·필수이므로 직접 입력 공고에는 합성 URL을 부여한다.
  const syntheticUrl = `manual://${globalThis.crypto.randomUUID()}`

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .insert({
      url: syntheticUrl,
      source: 'other',
      title,
      company,
      location,
      description: description || null,
      scraped_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // 이 유저의 보드에 연결
  await supabaseAdmin
    .from('matches')
    .upsert(
      { user_id: profile.id, job_id: data.id, status: 'new' },
      { onConflict: 'user_id,job_id' }
    )

  // JD 가 있으면 바로 매칭
  let matched = false
  let score: number | undefined
  if (description) {
    const matchRes = await matchSingleJob(data.id)
    if (!matchRes.error && matchRes.score !== undefined) {
      matched = true
      score = matchRes.score
    }
  }

  revalidatePath('/')
  return { jobId: data.id, matched, score }
}
```

몇 가지 짚어둘 포인트가 있습니다.

| 부분 | 의도 |
|---|---|
| `getAuthUserEmail()` 로 시작 | 로그인 유저를 동적으로 확인. 이메일·ID를 코드에 박지 않기 |
| `title`만 필수 | 회사·위치·JD는 비워도 카드 생성 가능 |
| `description \|\| null` | 빈 문자열 대신 null로 저장해 "JD 없음"을 명확히 |
| `matches`는 `upsert` | 같은 유저-공고 조합이 중복돼도 안전 |
| `description` 있을 때만 매칭 | 빈 JD로 AI를 호출하는 낭비 방지 |
| `revalidatePath('/')` | 추가 직후 목록 페이지 캐시 갱신 |

반환 타입에 `matched`, `score`를 같이 담아서, 프런트에서 "매칭까지 끝났는지"를 알 수 있게 했습니다.

## Step 3. 입력 모달 만들기

서버가 준비됐으니 입력 UI 차례입니다. 기존에 JD를 붙여넣는 모달(`JdInputModal`)이 있어서, 같은 톤으로 `AddJobManualModal`을 만들었습니다. 클라이언트 컴포넌트로 폼 상태만 관리하고, 제출 시 서버 액션을 호출합니다.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addJobManually } from '@/app/actions'

export default function AddJobManualModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'matching'>('idle')
  const [error, setError] = useState('')

  const busy = status !== 'idle'

  async function handleSubmit() {
    if (!title.trim() || busy) return
    setError('')
    setStatus('saving')

    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('company', company.trim())
    fd.append('location', location.trim())
    fd.append('description', description.trim())

    if (description.trim()) setStatus('matching')
    const res = await addJobManually(fd)
    setStatus('idle')

    if (res.error) { setError(res.error); return }

    router.refresh()  // 서버 컴포넌트 목록 다시 그리기
    onClose()
  }

  // ...입력 필드(직무명/회사/위치/JD) + 버튼 렌더링
}
```

`FormData`로 묶어서 넘긴 이유는, 서버 액션이 `formData.get(...)`으로 값을 읽는 기존 컨벤션과 맞추기 위해서입니다. 제출 성공 후 `router.refresh()`를 호출하면 서버 컴포넌트로 그려진 공고 목록이 새 카드를 포함해 다시 렌더됩니다.

작은 디테일 하나 — 버튼 라벨을 JD 유무에 따라 바꿔줬습니다.

```tsx
<button onClick={handleSubmit} disabled={!title.trim() || busy}>
  {description.trim() ? '추가 후 매칭' : '카드 추가'}
</button>
```

JD를 넣었으면 "추가 후 매칭", 안 넣었으면 "카드 추가"로 보여서, 지금 무슨 일이 일어날지 사용자가 미리 알 수 있게 했습니다.

## Step 4. 진입 버튼 붙이기

마지막으로 기존 URL 입력 폼(`AddJobForm`) 옆에 "직접 추가" 버튼을 두고, 클릭하면 모달이 열리게 했습니다.

```tsx
<button
  type="button"
  onClick={() => setManualOpen(true)}
  className="text-sm border border-zinc-200 text-zinc-600 px-4 py-2.5 rounded-lg ..."
>
  직접 추가
</button>

<p className="text-xs text-zinc-400 mt-1.5">
  링크 복사가 안 되는 사이트는{' '}
  <button onClick={() => setManualOpen(true)} className="underline">직접 추가</button>로
  카드를 만드세요.
</p>

{manualOpen && <AddJobManualModal onClose={() => setManualOpen(false)} />}
```

버튼 밑에 짧은 안내 문구를 같이 넣었습니다. 기능이 있어도 사용자가 발견하지 못하면 없는 것과 같으니까요. "링크 복사가 안 되면 이걸 쓰세요"라고 맥락을 딱 집어주는 한 줄이 생각보다 중요했습니다.

## 전체 흐름 한눈에

```
[직접 추가 버튼] 클릭
        │
        ▼
[모달] 직무명(필수) / 회사 / 위치 / JD 입력
        │
        ▼  handleSubmit → FormData
[addJobManually] 서버 액션
        │
        ├─ 로그인 확인 + 직무명 검증
        ├─ manual://<uuid> 합성 URL 부여
        ├─ jobs INSERT
        ├─ matches UPSERT (내 보드에 연결)
        └─ JD 있으면 → matchSingleJob (AI 매칭)
        │
        ▼
router.refresh() → 목록에 새 카드 등장
```

## 트러블슈팅: 내가 부딪힌 것들

- **`url` unique 제약 충돌**: 빈 문자열이나 고정값을 넣으면 두 번째 공고부터 충돌합니다. `crypto.randomUUID()`로 매번 다른 값을 만들어 해결했습니다.
- **빈 JD로 AI 호출 낭비**: 처음엔 무조건 매칭을 돌렸는데, JD가 없으면 매칭할 근거가 없어 비용만 나갔습니다. `if (description)` 조건으로 분기했습니다.
- **추가 후 목록이 안 바뀜**: 서버 컴포넌트로 그린 목록은 클라이언트 상태를 안 보기 때문에, `revalidatePath`(서버)와 `router.refresh()`(클라이언트)를 같이 써야 새 카드가 즉시 보입니다.
- **빈 문자열 vs null**: `company`나 `description`을 빈 문자열로 저장하면 나중에 "값이 있는지" 판단이 애매해집니다. JD는 `description || null`로 명시적으로 null 처리했습니다.

## 정리

URL 스크래핑이라는 "자동화"에 너무 기대다 보니, 정작 자동화가 안 통하는 공고를 못 담는 사각지대가 생겼던 겁니다. 결국 **사람이 직접 입력하는 탈출구를 하나 열어주는 것**으로 해결됐습니다.

이번 작업에서 다시 확인한 것들:

1. **기존에 잘 도는 패턴을 그대로 복제**하면 리스크가 확 줄어든다 (`addJobByUrl` → `addJobManually`).
2. **스키마 제약은 우회할 수 있으면 우회**한다 — 합성 URL 한 줄로 마이그레이션을 피했다.
3. **서버 액션 + `FormData`** 조합은 폼 처리에 군더더기가 없다.
4. 기능만큼이나 **"여기 있어요"라고 알려주는 한 줄 안내**가 중요하다.

자동화가 닿지 않는 곳에는 결국 수동 입력이라는 안전판이 필요하더라는, 어찌 보면 당연한 교훈을 코드로 한 번 더 새긴 작업이었습니다.
