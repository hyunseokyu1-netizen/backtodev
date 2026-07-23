---
title: '워크스페이스 업그레이드 ①: 칸반 카드에서 회사명이 잘려 보이던 문제'
date: '2026-07-08'
publish_date: '2026-08-25'
description: 상태 드롭다운과 회사명이 한 줄에서 자리를 다투던 칸반 카드 레이아웃을, 상태 배지를 아래 줄로 내려 해결한 기록
tags:
  - React
  - Tailwind
  - UI디자인
  - 레이아웃
---

## 문제 상황

매치다 대시보드의 칸반 보드는 지원 현황을 "준비 중 / 지원 완료 / 면접 진행 / 오퍼" 네 컬럼으로 보여줍니다. 카드 하나에는 회사 로고, 직무명, 회사명, 지원 상태(드롭다운), 위치, 매칭률이 들어갑니다.

여기서 눈에 띄는 문제가 하나 있었습니다. 회사명이 긴 경우("Logo von Remofirst Remofirst", "㈜아이씨엔코리아" 같은) 카드 헤더가 3줄까지 줄바꿈되면서 카드 높이가 들쭉날쭉해지고, 보드 전체가 지저분해 보였습니다.

원인은 레이아웃 구조에 있었습니다.

```tsx
// Before
<div className="mb-[11px] flex items-start gap-[10px]">
  <MonogramChip brand={job.brand} />
  <div className="min-w-0 flex-1">
    <div className="truncate text-[14px] font-semibold">{job.role}</div>
    <div className="text-[12px] text-[#98A2B3]">{job.company}</div>
  </div>
  {job.status && <StatusSelect jobId={job.id} initialStatus={job.status} />}
</div>
```

제목·회사명 블록(`flex-1`)과 상태 드롭다운(`StatusSelect`)이 **같은 줄**에 나란히 배치돼 있었습니다. `flex-1`이 남는 공간을 다 가져가긴 하지만, 상태 드롭다운이 폭을 일부 차지하는 만큼 회사명이 쓸 수 있는 가로 공간이 줄어듭니다. 회사명이 길면 그만큼 더 많이 줄바꿈될 수밖에 없는 구조였습니다.

## 해결 — 상태 배지를 아래 줄로 분리

가장 간단하면서 효과적인 방법은, 상태 드롭다운을 제목 줄에서 완전히 빼서 **별도의 줄**로 내리는 것이었습니다. 이렇게 하면 제목·회사명 블록이 카드의 전체 가로 폭을 온전히 쓸 수 있어서, 회사명이 줄바꿈되더라도 최대 1~2줄 안에서 끝납니다.

```tsx
// After
<div className="mb-[10px] flex items-start gap-[10px]">
  <MonogramChip brand={job.brand} />
  <div className="min-w-0 flex-1">
    <div className="truncate text-[14px] font-semibold">{job.role}</div>
    <div className="text-[12px] text-[#98A2B3]">{job.company}</div>
  </div>
</div>

{job.status && (
  <div className="mb-[10px] flex justify-end">
    <StatusSelect jobId={job.id} initialStatus={job.status} />
  </div>
)}
```

이렇게 하면 결과적으로 두 가지 문제를 한 번에 해결합니다.

1. **회사명이 잘리지 않고 더 짧게 보임** — 폭 제약이 풀려서 wrap되는 줄 수가 줄어듭니다.
2. **레이아웃이 안정적** — 상태 드롭다운이 항상 같은 위치(제목 블록 바로 아래, 우측 정렬)에 있어서 카드마다 배지 위치가 들쭉날쭉하지 않습니다.

## 위치를 옮겨도 클릭이 안 깨진 이유

레이아웃을 바꿀 때 걱정했던 부분이 하나 있었습니다. 이 칸반 카드는 카드 전체가 클릭 가능한 링크(워크스페이스로 이동)인데, 그 안에 있는 `StatusSelect`(상태 변경 드롭다운)는 클릭했을 때 카드 이동이 아니라 드롭다운만 열려야 합니다. 즉 이벤트 버블링을 막는 처리가 돼 있어야 하는데, **컴포넌트 위치를 옮기면 이 처리도 같이 깨지지 않을까** 하는 걱정이었습니다.

확인해보니 `StatusSelect`는 이미 자체적으로 이벤트를 막고 있었습니다.

```tsx
// StatusSelect.tsx
return (
  <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        setOpen((v) => !v)
      }}
      ...
```

`onClick={(e) => e.stopPropagation()}`이 컴포넌트 최상단 wrapper `div`에 붙어 있어서, 이 컴포넌트를 카드 안 어디에 두든 상관없이 클릭 이벤트가 부모(카드 전체 클릭 핸들러)로 전파되지 않습니다. 즉 **컴포넌트 자체가 위치에 의존하지 않고 자기 책임을 완결**하고 있었던 덕분에, 레이아웃만 바꾸고 별도 이벤트 처리 코드는 건드릴 필요가 없었습니다.

## 배운 점

이번 수정은 코드 몇 줄 옮기는 수준이었지만, 두 가지를 다시 생각하게 됐습니다.

- **같은 줄에 여러 요소를 배치할 때는 "누가 남는 공간을 갖는가"를 먼저 따져야 한다.** `flex-1`이 있다고 해서 그 요소가 전체 폭을 다 쓰는 게 아니라, 형제 요소들이 차지하는 만큼은 항상 양보하게 됩니다.
- **이벤트 전파를 컴포넌트 스스로 책임지게 만들면, 나중에 레이아웃을 자유롭게 바꿀 수 있다.** `stopPropagation()`을 부모 쪽에서 처리했다면, 이번처럼 위치를 옮길 때마다 이벤트 로직도 같이 신경 써야 했을 겁니다.

## 정리

```
문제: 회사명 + 상태 드롭다운이 한 줄 → 회사명이 wrap되며 카드 높이가 들쭉날쭉
해결: 상태 드롭다운을 제목 블록 아래 별도 줄로 이동
검증: 클릭 이벤트는 StatusSelect 자체의 stopPropagation 덕분에 위치와 무관하게 정상 동작
```

다음 편에서는 같은 워크스페이스 화면에서, "이 공고에 맞춰 AI 분석"이라는 버튼의 역할을 완전히 새로 정의한 이야기를 다룬다.
