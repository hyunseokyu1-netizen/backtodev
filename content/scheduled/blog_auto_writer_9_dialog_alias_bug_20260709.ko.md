---
title: '블로그 발행을 자동화해보자 (9) <dialog open>은 모달이 아니다 — 그리고 안 보이던 배포 주소'
date: '2026-07-09'
publish_date: '2026-08-31'
description: 네이티브 dialog 태그가 open 속성만으로는 진짜 모달이 되지 않는 이유와, 같은 프로젝트인데 다른 URL에서는 옛날 화면이 보이던 배포 별칭 문제
tags:
  - React
  - CSS
  - Vercel
  - 트러블슈팅
  - Next.js
---

앞 편에서 다룬 사고를 수습하던 같은 날, 대시보드 화면에서 두 가지 UI 버그 리포트를 받았습니다. 하나는 버튼이 세로로 깨져 보인다는 것, 하나는 초안 보기 모달이 화면 맨 아래에 이상하게 뜬다는 것이었습니다. 둘 다 원인은 CSS/HTML의 기본 동작을 잘못 알고 있었던 거였습니다.

## 버튼이 한 글자씩 세로로 쌓이는 문제

테이블의 "작업" 칸 버튼들("초안 보기/생성", "발행", 삭제)이 화면이 좁아지면 글자가 한 줄에 한 글자씩 세로로 쌓이는 증상이었습니다. 원인은 `white-space: nowrap`이 빠져 있던 것이었습니다.

```css
/* 문제가 있던 코드 */
.actions { display:flex; gap:6px; flex-wrap:wrap; }
```

테이블 셀에 폭 제약(`width: 1%`)이 걸려 있는 상태에서, flex 아이템인 버튼에 줄바꿈 방지가 없으니 브라우저가 버튼 텍스트를 문자 단위로 줄바꿈하며 최대한 좁게 욱여넣은 겁니다. 고친 코드는 단순합니다.

```css
.actions { display:flex; gap:6px; flex-wrap:nowrap; }
.actions button { white-space:nowrap; flex-shrink:0; }
td.col-actions { width:1%; white-space:nowrap; }
.table-wrap { overflow-x:auto; }
```

버튼 자체에 `white-space:nowrap`을 주고, 테이블이 너무 좁아지면 버튼이 잘리는 대신 테이블 전체를 가로 스크롤하도록 감싸는 `.table-wrap`을 추가했습니다.

## `<dialog open>`은 모달이 아니었다

두 번째는 더 근본적인 오해였습니다. 초안 보기를 누르면 이런 코드가 실행됐습니다.

```jsx
{dlgOpen && (
  <dialog open>
    {/* 초안 내용 */}
  </dialog>
)}
```

`<dialog>` 태그의 `open` 속성만 넣으면 당연히 화면 중앙에 배경이 어두워지면서 모달이 뜰 거라 생각했습니다. 실제로는 그렇지 않았습니다. `open` 속성만 있는 `<dialog>`는 그냥 **문서 흐름 안에 놓인 평범한 블록 요소**로 렌더링됩니다. 페이지의 어디에 배치했든 그 자리에 그냥 나타날 뿐, 브라우저의 "top layer"로 올라가지 않고 `::backdrop`도 적용되지 않습니다. 실제 문제 화면에서 모달이 페이지 맨 아래에 어색하게 붙어 있던 게 바로 이 증상이었습니다.

진짜 모달로 띄우려면 JavaScript로 `showModal()`을 직접 호출해야 합니다.

```tsx
const dialogRef = useRef<HTMLDialogElement>(null);

useEffect(() => {
  if (dlgOpen) dialogRef.current?.showModal();
  else dialogRef.current?.close();
}, [dlgOpen]);

// JSX에서는 항상 렌더링하고, 보이고 숨기는 건 showModal()/close()에 맡긴다
<dialog ref={dialogRef} onClose={() => setDlgOpen(false)}>
  {/* ... */}
</dialog>
```

여기서 한 가지 더 신경 쓴 부분은, `<dialog>`를 조건부로 마운트/언마운트하는 대신 **항상 DOM에 존재하게 하고** `showModal()`/`close()`로만 표시 여부를 제어했다는 점입니다. 조건부 마운트를 쓰면 `dlgOpen`이 `true`가 되는 순간에야 `ref`가 잡히기 때문에, 그 첫 렌더 타이밍에 `showModal()`을 호출하는 게 타이밍상 꼬이기 쉽습니다. 항상 마운트해두면 이 문제 자체가 사라집니다.

배경(`::backdrop`) 클릭으로 닫히는 것도 네이티브 `<dialog>`는 기본 제공하지 않아서, 클릭 대상이 다이얼로그 자기 자신인지 확인하는 방식으로 직접 추가했습니다.

```tsx
onClick={(e) => { if (e.target === dialogRef.current) setDlgOpen(false); }}
```

`padding: 0`으로 만들어둔 다이얼로그 자체 영역을 클릭했다는 건 안쪽 콘텐츠가 아니라 배경 여백을 눌렀다는 뜻이라, 이 조건으로 배경 클릭을 판별할 수 있습니다.

## 고쳤는데도 안 고쳐진 것처럼 보였던 이유

두 버그를 고치고 배포한 뒤, 확인을 부탁드렸더니 "안 바뀐 것 같다"는 답이 왔습니다. 원인은 코드가 아니라 **주소**였습니다. Vercel 프로젝트에는 프로덕션 배포에 연결된 별칭(alias) 도메인이 여러 개 있었는데, `vercel deploy --prod`를 실행하면 **주 별칭 하나만 자동으로 최신 배포를 가리키게 갱신되고, 예전에 붙여둔 다른 별칭들은 그대로 옛날 배포에 묶여 있었습니다.**

```bash
vercel alias ls
# dashboard-xxxx...vercel.app  →  dashboard-hyunseokyu1-netizens-projects.vercel.app  (최신)
# dashboard-yyyy...vercel.app  →  dashboard-delta-one-uv1f81wsqi.vercel.app          (옛날 그대로!)
```

같은 프로젝트인데 URL마다 배포 시점이 다를 수 있다는 걸 이번에 처음 제대로 알았습니다. 확인해달라고 하신 주소가 하필 자동으로 안 따라온 별칭이었던 겁니다. 수동으로 다시 연결해주니 바로 해결됐습니다.

```bash
vercel alias set <최신-배포-URL> dashboard-delta-one-uv1f81wsqi.vercel.app
```

## 정리

| 버그 | 겉보기 증상 | 실제 원인 |
|---|---|---|
| 버튼 세로 줄바꿈 | 테이블이 좁아지면 버튼 글자가 한 글자씩 쌓임 | `white-space:nowrap` 누락 |
| 모달이 페이지 하단에 뜸 | `<dialog open>`이 그냥 블록 요소로 렌더링됨 | `showModal()` 미호출 |
| "수정했는데 안 보임" | 사용자가 보던 주소가 다른 배포를 가리킴 | 보조 별칭이 자동 갱신 안 됨 |

세 가지 모두 "겉으로 보이는 증상"과 "진짜 원인"의 거리가 꽤 멀었습니다. 특히 마지막 별칭 문제는 코드를 아무리 들여다봐도 못 찾는 종류의 버그라, `vercel alias ls`로 실제 배포 상태를 직접 찍어보고 나서야 잡을 수 있었습니다. 이 시리즈에서 계속 반복되는 교훈이지만, 결국 "짐작하지 말고 실제 상태를 직접 확인하라"는 원칙이 UI 버그에서도, 배포 인프라에서도 똑같이 적용된다는 걸 다시 확인한 하루였습니다.
