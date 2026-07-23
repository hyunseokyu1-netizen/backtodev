---
title: '워크스페이스 업그레이드 ④: dnd-kit으로 칸반 카드 드래그 앤 드롭 붙이기'
date: '2026-07-08'
publish_date: '2026-08-28'
description: 이미 설치만 돼 있던 dnd-kit을 활용해 칸반 카드를 컬럼 간 드래그로 옮기면 지원 상태가 바뀌도록 구현하고, 클릭과 드래그가 충돌하지 않게 만든 기록
tags:
  - dnd-kit
  - React
  - 드래그앤드롭
  - Next.js
---

## 지난 편 요약

지난 세 편에 걸쳐 칸반 카드 레이아웃, AI 이력서 재작성 기능, 영문 이름·연락처 버그를 다뤘다. 이번 편(마지막)은 칸반 보드에 드래그 앤 드롭을 붙인 이야기다.

## 하려는 것

매치다 대시보드는 지원 현황을 4개 컬럼(준비 중 / 지원 완료 / 면접 진행 / 오퍼)의 칸반 보드로 보여줍니다. 지금까지는 카드마다 있는 상태 드롭다운을 눌러서 상태를 바꿔야 했는데, **카드를 마우스로 끌어서 다른 컬럼에 놓으면 상태가 바뀌게** 만들고 싶었습니다.

## 사전 준비 — 이미 설치돼 있었다

라이브러리를 새로 설치할 필요가 없었습니다. `package.json`을 보니 지원 목록 리스트 뷰(드래그로 순서 바꾸기 기능)에서 이미 `@dnd-kit`을 쓰고 있었습니다.

```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```

리스트 뷰는 "같은 목록 안에서 순서만 바꾸는" 용도(`@dnd-kit/sortable`)였고, 이번엔 "카드를 다른 컬럼(다른 목록)으로 옮기는" 용도라 조금 다릅니다. `sortable` 패키지 대신 `@dnd-kit/core`의 기본 훅(`useDraggable`, `useDroppable`)을 직접 썼습니다.

## Step 1. 드래그 가능한 카드, 드롭 가능한 컬럼

`dnd-kit`의 기본 단위는 두 가지입니다 — **드래그되는 대상**(`useDraggable`)과 **드롭을 받는 영역**(`useDroppable`). 칸반에 대입하면 카드가 draggable, 컬럼이 droppable입니다.

```tsx
function DraggableCard({ job, emphasized }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? 'z-30 cursor-grabbing opacity-90 shadow-lg' : 'cursor-grab'}
    >
      <InteractiveJobCard job={job} matchLabel={job.matchLabel} emphasized={emphasized} />
    </div>
  )
}

function DroppableColumn({ col }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status })
  return (
    <div ref={setNodeRef} className={isOver ? 'border-[#9ADBBE] bg-[#ECFDF3]' : 'border-[#EDF0F2] bg-[#F4F6F8]'}>
      {/* 컬럼 헤더 + 카드 목록 */}
    </div>
  )
}
```

`isOver`는 지금 드래그 중인 카드가 이 컬럼 위에 올라와 있는지 알려주는 값입니다. 이걸로 드롭 대상 컬럼을 초록색으로 하이라이트해서, 사용자가 "여기에 놓으면 되는구나"를 시각적으로 알 수 있게 했습니다.

## Step 2. 컬럼을 바꿨을 때 상태값 매핑

칸반 컬럼(4개)과 실제 DB의 지원 상태(`matches.status`, 8단계)는 1:1이 아닙니다. 예를 들어 "준비 중" 컬럼에는 `new`, `interested`, `considering` 세 가지 상태가 다 모여있습니다. 그래서 카드를 특정 컬럼에 놓았을 때 **그 컬럼을 대표하는 상태값**으로 매핑하는 테이블을 만들었습니다.

```ts
const COLUMN_TO_STATUS: Record<ApplicationStatus, string> = {
  preparing: 'new',
  applied: 'applied',
  interview: 'interview',
  offer: 'accepted',
}
```

"준비 중" 컬럼으로 옮기면 세부 상태가 무엇이었든 `new`로 통일됩니다. 완벽하진 않지만(예: `interested`였던 카드를 준비 중 컬럼 안에서만 옮겼다가 다시 원래 컬럼에 놓으면 `new`로 바뀜), 드래그는 "컬럼 간 이동"이 목적이라 그 안의 세부 상태까지 보존할 필요는 없다고 판단했습니다.

## Step 3. 낙관적 업데이트 + 실패 시 원복

드래그로 카드를 옮겼는데 서버 요청이 끝날 때까지 화면이 그대로면 사용자는 "어? 안 됐나?" 하고 다시 드래그를 시도하게 됩니다. 그래서 **먼저 화면을 바꾸고, 서버 저장이 실패하면 되돌리는** 방식(낙관적 업데이트)을 썼습니다.

```ts
async function handleDragEnd(e: DragEndEvent) {
  const jobId = String(e.active.id)
  const target = e.over?.id as ApplicationStatus | undefined
  if (!target) return

  const fromCol = columns.find(c => c.jobs.some(j => j.id === jobId))
  if (!fromCol || fromCol.status === target) return

  const job = fromCol.jobs.find(j => j.id === jobId)!
  const nextStatus = COLUMN_TO_STATUS[target]

  // 먼저 화면에서 옮기고
  const prev = columns
  setColumns(cols => cols.map(c =>
    c.status === fromCol.status ? { ...c, jobs: c.jobs.filter(j => j.id !== jobId) }
    : c.status === target ? { ...c, jobs: [...c.jobs, { ...job, status: nextStatus }] }
    : c
  ))

  // 서버에 저장 시도, 실패하면 원래 상태로 되돌림
  const res = await updateMatchStatus(jobId, nextStatus)
  if (res.error) {
    setColumns(prev)
    alert(res.error)
    return
  }
  router.refresh()
}
```

`prev` 변수에 드래그 전 상태를 통째로 저장해두고, 실패 시 그걸로 그대로 되돌리는 게 핵심입니다. 부분적으로 되돌리려 하면 로직이 복잡해지고 실수하기 쉬운데, "전체를 스냅샷으로 저장 → 실패 시 통째로 복원"이 훨씬 단순하고 안전합니다.

## Step 4. 드래그와 클릭이 충돌하는 문제

카드는 원래 클릭하면 워크스페이스로 이동하는 링크였습니다. 그런데 드래그 기능을 추가하고 나니, **카드를 살짝 눌렀다 놓기만 해도** 클릭으로 인식돼 드래그를 시도하는 도중에도 페이지 이동이 발생하는 문제가 있었습니다.

두 가지로 해결했습니다.

**첫째, 활성화 거리(activation distance) 설정.** 마우스를 8px 이상 움직여야 드래그로 인식하게 만들면, 단순 클릭(움직임 없음)과 드래그(일정 거리 이상 이동)가 자연스럽게 구분됩니다.

```ts
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
```

**둘째, 드래그 직후 클릭 이벤트 차단.** 8px 임계값이 있어도, 드래그를 끝내고 마우스를 놓는 순간 브라우저가 `click` 이벤트를 한 번 더 발생시킬 수 있습니다. 이걸 막기 위해 "방금 드래그가 있었는지"를 기록하는 ref를 두고, 그 직후의 클릭을 캡처 단계에서 가로챕니다.

```tsx
const dragHappened = useRef(false)

<DndContext
  onDragStart={() => { dragHappened.current = true }}
  onDragEnd={(e) => { handleDragEnd(e); setTimeout(() => { dragHappened.current = false }, 0) }}
>
  <div onClickCapture={(e) => {
    if (dragHappened.current) { e.preventDefault(); e.stopPropagation() }
  }}>
    {/* 컬럼들 */}
  </div>
</DndContext>
```

`onClickCapture`는 일반 `onClick`과 달리 이벤트가 자식으로 전파되기 **전에** 먼저 실행됩니다(캡처링 단계). 그래서 카드 내부의 링크 클릭 핸들러가 실행되기도 전에 여기서 미리 막을 수 있습니다. `setTimeout(..., 0)`으로 플래그를 다음 이벤트 루프에서 초기화하는 이유는, `dragEnd`와 그로 인해 뒤따라오는 `click` 이벤트가 **같은 틱에** 연달아 발생하기 때문에, 그 사이에는 플래그가 켜져 있어야 하기 때문입니다.

## 덤 — 매칭률 재측정 버튼

같은 작업 중에, 워크스페이스 상단 배너의 매칭률 숫자("25%")도 그냥 텍스트였던 걸 클릭 가능한 버튼으로 바꿨습니다. 이력서를 AI로 다시 쓴 뒤(이번 편 이전에 다룬 기능) 점수가 얼마나 올랐는지 궁금할 텐데, 그때마다 다른 메뉴를 찾아 들어갈 필요 없이 **점수 자체를 눌러서 바로 재측정**할 수 있게 했습니다.

```tsx
<button type="button" onClick={rematch} disabled={loading}>
  {loading ? '측정 중...' : `${score}%`}
</button>
```

작은 기능이지만, "방금 고친 이력서가 얼마나 나아졌는지"를 확인하는 흐름이 한 번의 클릭으로 끝나게 됐습니다.

## 자주 쓰는 패턴 요약

| 목적 | dnd-kit API |
|---|---|
| 드래그 가능한 요소 | `useDraggable({ id })` |
| 드롭을 받는 영역 | `useDroppable({ id })` |
| 여러 draggable/droppable을 감싸는 컨텍스트 | `<DndContext onDragEnd={...}>` |
| 클릭과 드래그 구분 | `useSensor(PointerSensor, { activationConstraint: { distance: 8 } })` |
| 드래그 중 위치 이동 스타일 | `style={{ transform: CSS.Translate.toString(transform) }}` |

## 정리

```
기존 카드(Link) + StatusSelect 드롭다운
  → useDraggable/useDroppable로 컬럼 간 드래그 이동 추가
  → 컬럼→대표 상태 매핑 테이블로 낙관적 업데이트, 실패 시 스냅샷 복원
  → activationConstraint(8px) + onClickCapture로 클릭/드래그 충돌 방지
```

4편에 걸쳐 다룬 오늘 작업은 결국 전부 같은 화면(워크스페이스·대시보드)을 다듬는 일이었다. 레이아웃 하나, AI 기능 하나, 버그 하나, 인터랙션 하나 — 각각은 작지만, "이력서를 고치고 → 지원 상태를 관리하는" 하나의 흐름이 훨씬 매끄러워졌다.
