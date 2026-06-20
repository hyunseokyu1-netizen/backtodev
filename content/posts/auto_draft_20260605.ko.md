---
title: '지원 이력을 코드로 관리한다 — 제출 이력서 저장 + 지원 날짜 자동 기록'
date: '2026-06-05'
publish_date: '2026-06-21'
description: Next.js Server Actions와 Supabase로 채용 지원 이력서와 지원 날짜를 공고 카드에 붙여 관리하는 기능을 만든 과정
tags:
  - Next.js
  - Supabase
  - Server Actions
  - TypeScript
  - 사이드프로젝트
---

## "이 공고에 어떤 이력서 냈더라?"

해외 채용 지원을 하다 보면 이력서 버전이 여러 개가 된다. 백엔드용, 풀스택용, 시니어 강조용... 그리고 공고마다 조금씩 다른 버전을 제출하게 된다.

문제는 한 달 뒤에 면접 연락이 왔을 때다. 분명히 이 공고에 지원했는데, 어떤 버전을 냈는지 기억이 나지 않는다. 로컬 폴더를 뒤지고, 이메일을 검색하고... 이건 진짜 낭비다.

[JobRadar](https://github.com/your-repo)는 공고 수집 + AI 매칭 + 커버레터 생성을 하는 사이드 프로젝트인데, 오늘은 여기에 두 가지 기능을 추가했다.

1. **공고 카드에 제출한 이력서를 업로드해서 저장**
2. **지원 날짜를 자동으로 기록하고, 경과일로 표시**

---

## 전체 흐름

기능을 붙이기 전에 데이터 구조를 먼저 정리했다. 이미 `matches` 테이블에 공고-유저 관계가 저장되어 있었기 때문에, 여기에 컬럼 두 개만 추가했다.

```sql
-- 006: 제출 이력서
ALTER TABLE matches
  ADD COLUMN applied_resume_text    TEXT,
  ADD COLUMN applied_resume_filename TEXT;

-- 007: 지원 날짜
ALTER TABLE matches
  ADD COLUMN applied_at TIMESTAMPTZ;
```

단순하다. 이력서 원본 파일은 저장하지 않고 **텍스트로 추출한 내용만** 저장한다. 나중에 "이 공고에 어떤 스킬을 강조했지?"를 볼 수 있으면 충분하기 때문이다.

---

## Step 1. 이력서 업로드 — Server Action 작성

파일을 받아서 텍스트로 변환하고, DB에 저장하는 Server Action이다.

```ts
// src/app/actions.ts

export async function uploadAppliedResume(
  formData: FormData
): Promise<{ text?: string; error?: string }> {
  const email = await getAuthUserEmail()
  if (!email) return { error: '로그인이 필요합니다.' }

  const file = formData.get('resume') as File | null
  const jobId = formData.get('jobId') as string

  if (!file || file.size === 0) return { error: '파일을 선택해주세요.' }
  if (file.size > 5 * 1024 * 1024) return { error: '파일 크기는 5MB 이하여야 합니다.' }

  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  const text = await parseResumeFile(file)   // PDF/DOCX → 텍스트
  if (!text) return { error: '텍스트를 추출할 수 없습니다.' }

  const { error } = await supabaseAdmin
    .from('matches')
    .update({
      applied_resume_text: text,
      applied_resume_filename: file.name,
    })
    .eq('user_id', profile.id)
    .eq('job_id', jobId)

  if (error) return { error: error.message }

  revalidatePath('/')
  return { text }
}
```

핵심은 `parseResumeFile(file)` 이 한 줄이다. PDF는 `pdf-parse`, DOCX는 `mammoth`로 텍스트를 뽑아낸다. 이 파서는 이전에 이력서로 프로필을 자동 추출하는 기능을 만들 때 이미 작성해둔 것을 재사용했다.

> **주의할 점:** `supabaseAdmin`은 RLS를 우회하기 때문에 반드시 `.eq('user_id', profile.id)`를 명시적으로 걸어야 한다. 빠뜨리면 다른 유저의 데이터를 덮어쓸 수 있다.

---

## Step 2. 업로드 모달 — AppliedResumeModal 컴포넌트

UI는 세 가지 상태를 가진다.

| 상태 | 표시 내용 |
|------|-----------|
| 이력서 없음 | "파일 선택" 버튼 + 안내 문구 |
| 업로드 완료 | 파일명 + "파일 교체" 버튼 + "텍스트 보기" 토글 |
| 업로드 중 | "업로드 중..." 비활성 상태 |

```tsx
// src/components/AppliedResumeModal.tsx (핵심 로직)

async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return

  setUploading(true)
  const fd = new FormData()
  fd.append('resume', file)
  fd.append('jobId', jobId)

  const result = await uploadAppliedResume(fd)
  setUploading(false)

  if (result.error) {
    setError(result.error)
  } else {
    setFilename(file.name)
    setText(result.text ?? '')
    onUploaded(file.name, result.text ?? '')  // 부모 컴포넌트에 즉시 반영
  }
}
```

텍스트 뷰는 접기/펼치기 토글로 처리했다. 이력서 전문을 항상 펼쳐두면 카드가 너무 길어지기 때문이다.

```tsx
{text && (
  <>
    <button onClick={() => setShowText(p => !p)}>
      {showText ? '▲ 텍스트 접기' : '▼ 텍스트 보기'}
    </button>
    {showText && (
      <textarea readOnly value={text} className="..." />
    )}
  </>
)}
```

---

## Step 3. 지원 날짜 자동 기록

상태를 `applied`로 바꿀 때 날짜를 자동으로 찍는다. 이미 `applied_at`이 있는 경우는 덮어쓰지 않는다 — 수동으로 날짜를 수정한 경우를 보존하기 위해서다.

```ts
// src/app/actions.ts

export async function updateMatchStatus(
  jobId: string,
  status: string
): Promise<{ error?: string; applied_at?: string }> {
  // ... 인증 처리 ...

  const patch: Record<string, unknown> = { status }

  if (status === 'applied') {
    const { data: existing } = await supabaseAdmin
      .from('matches')
      .select('applied_at')
      .eq('job_id', jobId)
      .eq('user_id', profile.id)
      .single()

    if (!existing?.applied_at) {
      patch.applied_at = new Date().toISOString()  // 최초 1회만 기록
    }
  }

  await supabaseAdmin.from('matches').update(patch)...

  return { applied_at: patch.applied_at as string | undefined }
}
```

저장된 날짜는 `applied_at`으로 반환해서 클라이언트에서 바로 화면에 반영한다. 페이지를 새로 고침하지 않아도 된다.

---

## Step 4. 경과일 표시 + 날짜 직접 수정

카드에는 날짜 대신 "지원 후 N일"로 표시했다. 직관적이기도 하고, "아직 연락이 없네"를 체감하기도 좋다.

```ts
function daysElapsed(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
```

버튼을 클릭하면 날짜 입력 필드로 전환된다. 자동 기록된 날짜가 틀렸을 때(예: 실수로 상태를 바꿨다가 되돌린 경우)를 위한 수정 UI다.

```tsx
{appliedAt && !editingDate && (
  <button onClick={startEditDate} className="text-xs text-zinc-400 hover:text-zinc-600">
    지원 후 {daysElapsed(appliedAt)}일
  </button>
)}

{editingDate && (
  <span className="flex items-center gap-1">
    <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} autoFocus />
    <button onClick={handleSaveDate}>저장</button>
    <button onClick={() => setEditingDate(false)}>취소</button>
  </span>
)}
```

---

## Step 5. 컴포넌트 간 상태 연결

`StatusButton`에서 상태를 바꾸면, 그 결과(applied_at)를 부모인 `JobList`가 받아야 한다. props 콜백으로 처리했다.

```ts
// StatusButton.tsx — props 확장
export default function StatusButton({
  jobId,
  initialStatus,
  onAppliedAt,      // 추가
}: {
  jobId: string
  initialStatus: string
  onAppliedAt?: (appliedAt: string) => void
}) {
  async function handleSelect(next: Status) {
    const res = await updateMatchStatus(jobId, next)
    if (!res.error) {
      setStatus(next)
      if (res.applied_at && onAppliedAt) onAppliedAt(res.applied_at)  // 부모에 전달
    }
  }
}
```

```tsx
// JobList.tsx — 콜백으로 상태 즉시 업데이트
<StatusButton
  jobId={job.id}
  initialStatus={job.match_status}
  onAppliedAt={date => setAppliedAt(date)}
/>
```

---

## 트러블슈팅

### applied_at이 업데이트되지 않는다

`patch` 객체를 만들 때 `status`만 들어가고 `applied_at`이 빠지는 경우가 있었다. `if (status === 'applied')` 블록 안에서 `patch.applied_at`을 할당하는데, 타입을 `Record<string, unknown>`으로 선언하지 않으면 타입 오류가 난다.

```ts
// 이렇게 하면 타입 오류
const patch = { status }
patch.applied_at = new Date().toISOString()  // Property 'applied_at' does not exist

// 이렇게 해야 함
const patch: Record<string, unknown> = { status }
patch.applied_at = new Date().toISOString()  // OK
```

### 모달 바깥 클릭 시 배경도 같이 클릭되는 문제

모달 배경(`div.fixed.inset-0`)에 `onClick={onClose}`를 달고, 모달 본체에는 `onClick={e => e.stopPropagation()}`을 달아서 이벤트 전파를 막는다. 이 패턴을 빠뜨리면 모달 안쪽을 클릭해도 닫힌다.

---

## 정리 — 핵심 흐름

```
[이력서 업로드]
파일 선택 (PDF/DOCX)
  → FormData 생성
  → uploadAppliedResume() Server Action 호출
  → parseResumeFile()로 텍스트 추출
  → supabaseAdmin.update (applied_resume_text, applied_resume_filename)
  → 클라이언트 상태 즉시 반영 (onUploaded 콜백)

[지원 날짜 기록]
상태 → 'applied' 전환
  → updateMatchStatus() 호출
  → applied_at 없으면 현재 시각 자동 기록
  → applied_at 반환
  → StatusButton → onAppliedAt 콜백 → JobList 상태 업데이트
  → 카드에 "지원 후 Nd" 즉시 표시
```

이제 면접 연락이 와도, 카드를 열면 제출한 이력서 전문과 "지원 후 23일"이 바로 보인다. 사소해 보이지만 이런 디테일이 쌓여야 진짜 쓸 만한 도구가 된다고 생각한다.
