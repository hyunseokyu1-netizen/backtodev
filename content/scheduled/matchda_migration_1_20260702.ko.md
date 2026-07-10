---
title: '디자인 데모를 실제 앱으로 (1) — 두 개의 앱이 공존할 때'
date: '2026-07-02'
publish_date: '2026-07-25'
description: 예쁜 디자인 데모와 실제 로그인 앱이 따로 노는 상황을 발견하고, 기능 누락 없이 대체하기 위한 인벤토리와 페이즈 계획을 세운 기록
tags:
  - Next.js
  - Supabase
  - 리팩터링
  - Server Actions
---

지난 며칠간 MatchDa라는 커리어 플랫폼의 새 디자인을 `/matchda` 경로 아래에 열심히 구현했습니다. 랜딩, 대시보드(칸반 보드), 이력서 워크스페이스까지 — 픽셀 단위로 맞추고, 실데이터도 연결하고, 반응형에 AI 기능까지 붙였죠. 스스로도 뿌듯했습니다.

그런데 어느 날 사용자가 이렇게 물었습니다.

> "근데 이거, 실제 사이트랑 연결된 게 아니고 디자인만 /matchda에 넣은 거 같은데?"

**정곡이었습니다.**

## 문제: 나도 모르게 만들어버린 "두 개의 앱"

확인해보니 상황은 이랬습니다.

- 로그아웃 상태로 `/`에 가면 → 새 MatchDa 랜딩 (연결됨 ✅)
- **로그인하면 `/`는 여전히 옛날 디자인**(zinc 톤의 공고 목록)
- 전역 헤더 nav(`지원 관리`, `잡 탐색`, `프로필`)도 전부 옛 페이지
- 옛 앱에서 `/matchda`로 들어가는 링크는 **단 하나도 없음**

즉 `/matchda/dashboard`는 실데이터를 읽긴 하지만, **로그인 유저가 실제로 쓰는 화면이 아니었습니다.** 예쁜 전시장을 하나 더 지어놓고 정작 손님은 옛 매장으로 보내고 있던 셈이죠.

이런 일은 생각보다 흔합니다. 새 디자인을 "안전하게" 별도 경로에서 개발하다 보면, 그 경로가 실제 흐름과 연결되지 않은 채 방치되기 쉽습니다. 디자인은 100% 완성인데 사용자에겐 0% 전달되는 상태.

그래서 목표를 명확히 했습니다 — **로그인 유저의 실제 앱을 MatchDa 디자인으로 "완전 대체"하되, 기존 기능은 하나도 잃지 않는다.**

## 사전 준비 — 대체하기 전에 "인벤토리"부터

무손실 대체의 첫걸음은 **없앨 것(옛 화면)이 무슨 기능을 갖고 있는지 전부 적어두는 것**입니다. 이걸 건너뛰면 배포 후에 "어? 그 버튼 어디 갔어?"가 터집니다.

옛 공고 목록(`JobList`)을 뜯어보니 이만큼 있었습니다.

| 레벨 | 기능 |
|---|---|
| 보드 | 공고 추가(URL/직접), 일괄 AI 매칭 |
| 카드 | 상태 변경(8단계), 드래그 정렬, 메모, 인라인 편집(제목/회사/위치), 지원일, 삭제, 재매칭 |
| 모달 | 커버레터, 맞춤 이력서, 지원 이력서 업로드, JD 직접 입력 |

`grep`으로 어떤 서버 액션과 컴포넌트를 쓰는지도 뽑아뒀습니다.

```bash
grep -nE "^import" src/components/JobList.tsx
# → StatusButton, CoverLetterModal, JdInputModal, AppliedResumeModal,
#   TailoredResumeModal, updateMatchStatus, reorderJobs, deleteJob ...
```

이 목록이 곧 **"이사할 짐의 체크리스트"**가 됩니다.

## 페이즈로 쪼개기

한 번에 다 바꾸면 회귀(regression)를 잡기 어렵습니다. 그래서 4단계로 나눴습니다.

1. **인터랙티브 칸반** — 카드에서 상태 변경
2. **보드 진입점** — 공고 추가 + 일괄 매칭
3. **per-job 기능 이식** — 모달들 + 메모/편집/삭제/재매칭
4. **라우트 스왑** — 로그인 홈을 MatchDa로 교체

핵심 원칙: **`/matchda`에서 기능 패리티를 먼저 달성하고, 실제 `/`를 갈아끼우는 건 맨 마지막에.** 그래야 도중에 앱이 깨지지 않습니다.

## Step 1. 인터랙티브 칸반 — 상태 드롭다운 이식

옛 앱은 상태를 8단계 드롭다운(`StatusButton`)으로 바꿨습니다. 저는 이걸 그대로 재활용하되 MatchDa 톤으로 감쌌어요. 중요한 건 **기존 서버 액션(`updateMatchStatus`)을 그대로 쓴다**는 점입니다.

```tsx
'use client'
import { updateMatchStatus } from '@/app/actions'
import { STATUS_OPTIONS, type Status } from '@/components/StatusButton'  // 옛 정의 재사용

async function select(next: Status) {
  const res = await updateMatchStatus(jobId, next)
  if (!res.error) router.refresh()   // 상태 바뀌면 컬럼 재배치
}
```

카드 전체는 클릭 시 워크스페이스로 가야 하는데, 그 안에 드롭다운 버튼을 넣으니 **클릭 이벤트가 충돌**했습니다. `stopPropagation`으로 분리했습니다.

```tsx
<div role="button" onClick={() => router.push(`/matchda/workspace?jobId=${job.id}`)}>
  {/* ... */}
  <div onClick={(e) => e.stopPropagation()}>
    <StatusSelect jobId={job.id} initialStatus={job.status} />
  </div>
</div>
```

그리고 **로그인 실데이터일 때만 인터랙티브**, 비로그인 데모에선 정적 카드로. 한 컴포넌트에 `interactive` 플래그 하나로 갈랐습니다.

```tsx
{interactive
  ? <InteractiveJobCard job={job} matchLabel={label} />
  : <JobCard job={job} t={t} />}   // 목업 데모(정적 Link)
```

## Step 2. 보드 진입점 — 새로 만들지 말고 재사용

"공고 추가"와 "일괄 매칭"은 옛 앱에 이미 잘 도는 컴포넌트(`AddJobForm`, `RunMatchButton`)가 있었습니다. 굳이 새로 만들 이유가 없죠. **그대로 가져다 MatchDa 카드 안에 넣었습니다.**

```tsx
{real && (
  <div className="mb-6 rounded-[14px] border border-[#ECEEF0] bg-white p-4">
    <AddJobForm />   {/* URL 추가 + 직접 추가 모달 그대로 */}
  </div>
)}
{real && <RunMatchButton unmatchedCount={real.unmatchedCount} />}
```

톤이 살짝 달라 보이긴 했지만(zinc 버튼), **기능은 100% 그대로**입니다. "일단 기능부터 옮기고, 톤은 나중에"가 무손실 마이그레이션의 리듬입니다. (톤 통일은 3편에서 다룹니다.)

## 트러블슈팅

**드래그 정렬은 일부러 뺐습니다.** 옛 앱은 flat 리스트라 수동 정렬(position)이 의미 있었지만, 칸반은 상태로 자동 그룹핑되니 수동 정렬 가치가 낮았습니다. "옛것에 있으니 무조건 옮긴다"가 아니라, **새 맥락에서 필요한지 다시 판단**하는 게 맞더군요. 사용자에게 물어보고 생략했습니다.

**목업 폴백을 지켰습니다.** 비로그인 방문자에겐 여전히 예쁜 데모가 보여야 합니다. 그래서 데이터 조회 함수는 로그인 아니면 `null`을 반환하고, 호출부에서 목업으로 폴백하게 했습니다. 덕분에 **한 컴포넌트가 데모와 실앱을 겸임**합니다.

## 정리

무손실 마이그레이션의 시작.

1. **"두 개의 앱" 신호를 알아채라** — 별도 경로의 디자인이 실제 흐름과 연결됐는지 확인
2. **인벤토리 먼저** — 없앨 화면의 기능을 표로 전부 적는다
3. **페이즈로 쪼개고, 실제 라우트 스왑은 맨 마지막**
4. **기존 액션·컴포넌트를 최대한 재사용** — 새로 짜지 않는다
5. **옛 기능도 새 맥락에서 다시 판단** (드래그 정렬은 생략)

다음 편에서는 가장 큰 덩어리 — **모달 여러 개를 재사용해 per-job 기능을 옮기고, 마침내 실제 홈을 MatchDa로 갈아끼우는** 이야기입니다.
