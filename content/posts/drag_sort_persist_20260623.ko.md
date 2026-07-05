---
title: '드래그는 되는데 순서가 안 바뀐다 — 정렬과 수동 정렬을 공존시키기'
date: '2026-06-23'
publish_date: '2026-07-06'
description: dnd-kit 드래그가 자동 정렬에 덮어써지던 버그를 잡고, 사용자가 직접 정한 순서를 DB에 저장해 유지하는 과정 정리
tags:
  - dnd-kit
  - React
  - Next.js
  - Supabase
  - PostgreSQL
---

## 들어가며: "드래그가 먹질 않아요"

JobRadar의 채용공고 목록에는 드래그로 카드 순서를 바꾸는 기능이 들어 있었다. `@dnd-kit`도 붙어 있고, 드래그 핸들(⠿)도 보였다. 그런데 사용자가 이렇게 말했다.

> "순서 바꿀 수 있게 되어 있는데, 안 바뀌어져. 정렬(점수순/최신순) 때문인 것 같은데."

직접 해보니 정말 그랬다. 카드를 잡아서 위아래로 끌면 끌리는 모션은 보이는데, **손을 놓는 순간 원래 자리로 휙 돌아갔다.** 드래그가 분명 동작은 하는데, 결과가 0.1초 만에 사라지는 것이다.

이 글은 그 "되는 것 같은데 안 되는" 드래그 버그를 추적하고, 더 나아가 **사용자가 정한 순서를 영구 저장**하는 기능으로 완성한 과정이다. dnd-kit을 처음 붙여본 사람이라면 한 번쯤 겪는 함정이라 정리해둔다.

## Step 1. 왜 순서가 원래대로 돌아갈까

원인은 코드 한 곳에 있었다. 목록을 렌더링하는 부분을 보자.

```tsx
const [jobs, setJobs] = useState(initialJobs)

// 드래그가 끝나면 jobs 배열을 재배치
function handleDragEnd(event) {
  const { active, over } = event
  if (over && active.id !== over.id) {
    setJobs(prev => {
      const oldIndex = prev.findIndex(j => j.id === active.id)
      const newIndex = prev.findIndex(j => j.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)  // 순서 바꿈
    })
  }
}

// 그런데 화면에 그리는 건 jobs가 아니라 filteredJobs
const filteredJobs = sortMode === 'recent'
  ? [...filtered].sort((a, b) => /* 최신순 */)
  : [...filtered].sort((a, b) => /* 점수순 */)   // ← 항상 다시 정렬!

// ...
{filteredJobs.map(job => <SortableJobCard ... />)}
```

문제가 보이는가? 드래그는 `jobs` 상태를 **분명히 바꾼다.** 그런데 화면에 실제로 그려지는 건 `jobs`가 아니라 `filteredJobs`인데, 이게 **렌더링할 때마다 `.sort()`로 점수순/최신순을 다시 적용**한다.

그러니까 흐름이 이렇게 된다.

1. 드래그 → `jobs` 배열 순서 바뀜 → 리렌더 발생
2. 리렌더 → `filteredJobs`가 `jobs`를 **점수순으로 다시 정렬**
3. 화면엔 점수순 그대로 → **드래그 결과가 흔적도 없이 사라짐**

내 손이 바꾼 순서를, 바로 다음 줄의 `.sort()`가 덮어쓰고 있던 것이다. 게다가 순서는 어디에도 저장되지 않아서, 설령 보였다 해도 새로고침하면 사라질 운명이었다.

## Step 2. 설계 — "정렬"과 "수동 정렬"은 공존할 수 없다

여기서 중요한 깨달음이 있었다. **자동 정렬(점수순/최신순)과 수동 정렬(드래그)은 본질적으로 양립할 수 없다.** 점수순으로 정렬하는 순간, 내가 드래그로 정한 순서는 의미가 없어진다. 둘 중 하나만 화면을 지배할 수 있다.

그래서 답은 "드래그를 자동 정렬과 섞기"가 아니라, **세 번째 정렬 모드를 만드는 것**이었다.

| 정렬 모드 | 동작 |
|-----------|------|
| 점수순 | 매칭 점수 내림차순 (자동) |
| 최신순 | 등록일 내림차순 (자동) |
| **직접 정렬** (신규) | **사용자가 드래그로 정한 순서. 재정렬 안 함** |

그리고 "직접 정렬" 모드일 때만:
- 화면을 **재정렬하지 않고** `jobs` 배열 순서 그대로 보여준다
- 드래그를 **활성화**한다
- 바뀐 순서를 **DB에 저장**한다

여기에 UX 한 스푼을 더했다. 사용자가 다른 모드에서 드래그를 시도하면 **자동으로 "직접 정렬" 모드로 전환**되게 했다. 모드를 먼저 바꿔야 한다는 걸 몰라도, 그냥 끌면 되도록.

## Step 3. 순서를 어디에 저장할까 — 칼럼 위치 정하기

순서를 영구 저장하려면 DB 칼럼이 필요하다. 그런데 **어느 테이블에** 넣느냐가 중요한 설계 포인트였다.

JobRadar는 여러 사용자가 같은 공고(`jobs`)를 공유한다. 매칭 점수, 메모, 지원 상태 같은 **사용자별 데이터는 `matches` 테이블**에 들어 있다. 순서도 마찬가지로 **사용자마다 다르게** 정할 수 있어야 한다. 내가 정한 순서가 다른 사용자 화면을 바꾸면 안 되니까.

그래서 순서는 공유 테이블(`jobs`)이 아니라 **사용자별 테이블(`matches`)에** 저장해야 한다.

```sql
-- 012_add_position_to_matches.sql
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS position INTEGER;
```

> **데이터 모델링 감각**: "이 값은 누구의 것인가?"를 먼저 물어라. 모두가 공유하는 값(공고 제목)과 사용자마다 다른 값(내 정렬 순서)은 사는 테이블이 달라야 한다. 이걸 틀리면 "내가 순서를 바꿨더니 남의 화면도 바뀌는" 버그가 생긴다.

## Step 4. 순서를 저장하는 서버 액션

드래그가 끝나면 새 순서(공고 id 배열)를 받아서, 각 공고의 `position`을 배열 인덱스로 기록한다.

```ts
'use server'

export async function reorderJobs(orderedJobIds: string[]) {
  // 로그인 유저 확인 (항상 동적으로)
  const email = await getAuthUserEmail()
  if (!email) return { error: '로그인이 필요합니다.' }
  const profile = await getOrCreateProfile(email)
  if (!profile) return { error: 'Profile not found' }

  // 배열 순서대로 position = 0, 1, 2 ... 기록
  const results = await Promise.all(
    orderedJobIds.map((jobId, index) =>
      supabaseAdmin
        .from('matches')
        .update({ position: index })
        .eq('user_id', profile.id)   // ← 반드시 내 데이터만
        .eq('job_id', jobId)
    )
  )

  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }
  return {}
}
```

`Promise.all`로 여러 업데이트를 한꺼번에 보낸다. 공고가 수십 개여도 동시에 처리되니 충분히 빠르다. 그리고 **`.eq('user_id', profile.id)`는 절대 빠뜨리면 안 된다** — service role 키는 RLS(행 수준 보안)를 우회하기 때문에, 코드에서 직접 "내 데이터만" 거르지 않으면 남의 순서까지 바꿔버릴 수 있다.

## Step 5. 프론트엔드 — 모드 분기와 드래그 활성화

이제 화면 쪽을 손본다. 먼저 렌더링 분기에 "직접 정렬"을 추가한다.

```tsx
const filteredJobs =
  sortMode === 'manual'
    ? filtered                              // ← 재정렬 안 함, 배열 순서 그대로
    : sortMode === 'recent'
    ? [...filtered].sort(/* 최신순 */)
    : [...filtered].sort(/* 점수순 */)
```

드래그가 끝나면 순서를 바꾸고, 모드를 전환하고, DB에 저장한다.

```tsx
function handleDragEnd(event) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const oldIndex = jobs.findIndex(j => j.id === active.id)
  const newIndex = jobs.findIndex(j => j.id === over.id)
  if (oldIndex < 0 || newIndex < 0) return

  const next = arrayMove(jobs, oldIndex, newIndex)
  setJobs(next)
  setSortMode('manual')              // 드래그하면 자동으로 직접 정렬 모드로
  reorderJobs(next.map(j => j.id))   // DB에 저장
}
```

마지막으로, 드래그는 "직접 정렬" 모드에서만 동작하게 막았다. 자동 정렬 모드에서 드래그를 허용하면, 화면 순서(정렬됨)와 실제 배열 순서가 달라서 엉뚱한 위치로 가는 버그가 생기기 때문이다. dnd-kit의 `useSortable`은 `disabled` 옵션으로 깔끔하게 끌 수 있다.

```tsx
const { attributes, listeners, setNodeRef, ... } =
  useSortable({ id: job.id, disabled: !draggable })
```

```tsx
// 부모에서 모드에 따라 draggable 전달
<SortableJobCard ... draggable={sortMode === 'manual'} />
```

그리고 핸들도 모드에 따라 시각적으로 구분해줬다. 직접 정렬일 땐 진하게(잡을 수 있음), 아닐 땐 흐리게 + 툴팁으로 안내.

```tsx
<button
  {...attributes}
  {...listeners}
  disabled={!draggable}
  title={draggable ? '드래그해서 순서 변경' : '‘직접 정렬’에서 순서를 바꿀 수 있어요'}
  className={draggable ? 'text-zinc-400 cursor-grab' : 'text-zinc-200 cursor-not-allowed'}
>
  ⠿
</button>
```

## Step 6. 새로고침해도 유지되게 — 초기 정렬

저장만 하면 끝이 아니다. **불러올 때도** 저장된 순서대로 와야 한다. 페이지에서 공고를 읽을 때 `position`을 같이 가져와서, 그 순서로 배열을 만든다.

```tsx
// position 우선, 없으면 기존처럼 점수순
const sorted = [...jobList].sort((a, b) => {
  const pa = a.position ?? Infinity
  const pb = b.position ?? Infinity
  if (pa !== pb) return pa - pb
  // position 없는 것끼리는 매칭된 것 위로 + 점수순
  if (a.match_score !== null && b.match_score === null) return -1
  if (a.match_score === null && b.match_score !== null) return 1
  return (b.match_score ?? 0) - (a.match_score ?? 0)
})
```

`position`이 `null`인(아직 한 번도 직접 정렬 안 한) 공고는 `Infinity`로 취급해서 뒤로 보내고, 그 안에서는 기존 점수순을 유지했다. 이렇게 하면 직접 정렬을 한 번도 안 한 사용자도 자연스러운 기본 순서를 본다.

## 트러블슈팅: 검증은 코드 없이도 가능하다

마이그레이션을 적용한 뒤, UI를 일일이 클릭하지 않고 DB에 직접 쿼리해서 "저장 → 조회"가 도는지 확인했다. service role 키로 비파괴적으로.

```
테스트 대상 user matches: 16건
✅ 1) position 칼럼 존재 및 조회 가능
✅ 2) 순서(position) 저장→조회 라운드트립 성공
🧹 3) 기존 position 원복 완료
```

테스트로 바꾼 값은 끝나고 원래대로 되돌려서, 실제 데이터엔 흔적을 남기지 않았다. 빌드/타입 체크(`tsc --noEmit`, `next build`)도 통과시킨 뒤에 커밋했다.

## 정리: 드래그는 "보이기"가 절반, "지키기"가 절반

이번 작업의 흐름을 한눈에 보면:

1. **버그 원인** — 드래그가 바꾼 순서를 `filteredJobs`의 `.sort()`가 매 렌더마다 덮어씀
2. **설계 결정** — 자동 정렬과 수동 정렬은 공존 불가 → "직접 정렬" 모드 신설
3. **저장 위치** — 사용자별 값이므로 `matches` 테이블에 `position` 칼럼
4. **저장 액션** — `reorderJobs`로 인덱스를 position에 기록 (`user_id` 필터 필수)
5. **드래그 제어** — 직접 정렬 모드에서만 활성화, 드래그 시 자동 전환
6. **초기 정렬** — 불러올 때 position 우선으로 정렬해 새로고침 후에도 유지

dnd-kit으로 드래그 모션을 띄우는 건 사실 몇 줄이면 된다. 진짜 일은 그다음이다 — **바꾼 순서가 다른 정렬에 덮어써지지 않게 하고, 새로고침해도 살아남게 하고, 남의 데이터를 건드리지 않게 하는 것.** "드래그가 보이는 것"과 "드래그가 제대로 동작하는 것"은 전혀 다른 일이라는 걸, 이번에 제대로 느꼈다.
