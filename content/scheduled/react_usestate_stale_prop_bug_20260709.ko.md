---
title: '분명 DB엔 저장됐는데 화면엔 안 보인다 — useState 초기값이 파놓은 함정'
date: '2026-07-09'
publish_date: '2026-07-15'
description: 드래그 앤 드롭을 위해 서버 데이터를 로컬 state로 복사해 쓰던 컴포넌트가, 이후 서버가 새 데이터를 내려줘도 그걸 무시하던 React 흔한 버그를 추적하고 고친 기록
tags:
  - React
  - useState
  - Next.js
  - 버그추적
  - 상태관리
---

## 제보 — "직접 추가한 다음에... 카드가 안 떠"

사용자로부터 스크린샷과 함께 짧은 제보를 받았다. "직접 추가한 다음에.... 카드가 안떠." 매치다의 지원 현황 보드에서 채용공고를 직접 입력해 카드를 만들었는데, 화면에 새 카드가 안 보인다는 이야기였다.

바로 전날 이 보드에 드래그 앤 드롭 기능을 새로 붙였던 참이라, 그 작업이 뭔가를 건드렸겠다는 감이 왔다. 실제로 원인을 찾아보니 **React를 다루다 보면 누구나 한 번쯤 밟는 전형적인 함정**이었다. 이번 글은 그 추적 과정을 기록한 것이다.

## 증상부터 정리하기

먼저 확인한 건 "정말 저장이 안 된 건지, 저장은 됐는데 화면에만 안 보이는 건지"였다. Supabase에서 직접 데이터를 조회해보니 **공고는 DB에 정상적으로 들어가 있었다.** 즉 서버 쪽(백엔드 로직)은 아무 문제가 없었다. 문제는 순수하게 화면(클라이언트) 쪽에 있다는 뜻이었다.

## 원인 — 드래그 앤 드롭이 남긴 로컬 state

전날 만든 드래그 앤 드롭 기능은 이런 구조였다. 카드를 마우스로 끌 때 화면이 즉각 반응하려면(서버 응답을 기다렸다가 다시 그리면 뚝뚝 끊겨 보인다), 컬럼별 카드 목록을 컴포넌트 안에 **로컬 state로 따로 들고 있어야** 한다. 그래서 이렇게 짜여 있었다.

```tsx
// InteractiveKanban.tsx (문제가 있던 코드)
export default function InteractiveKanban({ columns: initial }: { columns: KanbanColumnView[] }) {
  const [columns, setColumns] = useState(initial)
  // ...드래그 로직에서 setColumns로 카드를 낙관적으로 옮김
}
```

부모(서버 컴포넌트)가 `columns`라는 prop을 내려주면, 그걸 초기값 삼아 `useState`로 복사해서 쓰는 방식이다. 여기까지는 흔한 패턴이고 문제가 없다.

문제는 "직접 추가" 모달에서 새 공고를 저장한 뒤 벌어지는 일이었다. 저장이 끝나면 `router.refresh()`를 호출해서 페이지를 다시 서버에서 렌더링하게 만든다. 서버는 최신 DB 데이터로 새 `columns` 값을 계산해서 다시 내려준다 — **여기까지는 의도대로 잘 동작한다.**

그런데 `InteractiveKanban` 컴포넌트 입장에서 생각해보면 다르다. **`useState(initial)`의 `initial` 인자는 컴포넌트가 처음 화면에 나타날 때(마운트될 때) 딱 한 번만 쓰인다.** 이미 마운트가 끝난 컴포넌트에 부모가 새로운 `initial`(=`columns`) prop을 내려줘도, `useState`는 "어? 나 이미 초기화 끝냈는데?"라며 그 새 값을 그냥 무시한다.

정리하면 이렇다.

```
1. 페이지 최초 로드 → InteractiveKanban 마운트 → useState(initial)로 카드 목록 저장
2. "직접 추가"로 새 공고 저장 → DB에 정상 반영
3. router.refresh() → 서버가 새 columns prop을 다시 내려줌
4. 하지만 InteractiveKanban은 이미 마운트된 상태 → 새 prop을 받아도 내부 state는 그대로
5. 화면엔 여전히 1번 시점의 낡은 카드 목록만 보임
```

새로고침(F5)을 하면 페이지 전체가 다시 마운트되니 당연히 보였을 것이다. 사용자는 새로고침을 안 해봤을 뿐이고, 그래서 "안 떠"라고 느꼈던 거다.

## 이게 왜 "흔한" 함정인가

이 버그의 진짜 이름은 **"prop으로 초기화한 state가 이후의 prop 변경을 못 따라가는 문제"**다. React 커뮤니티에서 "derived state가 stale해진다"고도 부른다. `useState(props.something)`처럼 prop을 초기값으로만 쓰는 코드를 짤 때마다 잠재적으로 이 문제를 안고 간다 — 그 prop이 나중에 또 바뀔 수 있는 상황이라면 말이다.

이번 경우는 드래그 앤 드롭 때문에 "로컬에서 즉시 반응하는 state"가 꼭 필요했던 상황이라 이 패턴 자체를 안 쓸 수는 없었다. 문제는 **"이후에 prop이 바뀌면 어떻게 동기화할 것인가"를 처음 설계할 때 빠뜨렸다는 것.**

## 해결 — 렌더링 도중에 state를 재설정하기

React 공식 문서에 정확히 이 상황을 위한 패턴이 나와 있다. `useEffect`를 쓰지 않고, **렌더 함수 본문에서 직접 비교하고 필요하면 그 자리에서 `setState`를 호출**하는 방식이다.

```tsx
export default function InteractiveKanban({ columns: initial }: { columns: KanbanColumnView[] }) {
  const [columns, setColumns] = useState(initial)

  // 서버가 새 props(initial)를 내려줄 때마다(router.refresh 등) 로컬 state를 동기화한다.
  // useState(initial)은 마운트 시 한 번만 반영되므로, 그 이후의 서버 리프레시가
  // 이 컴포넌트에 반영되려면 렌더 중 동기화가 필요하다.
  const [prevInitial, setPrevInitial] = useState(initial)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setColumns(initial)
  }

  // ...
}
```

왜 `useEffect` 안에 넣지 않았는지가 핵심이다. `useEffect`로 처리하면 이런 순서가 된다.

```
렌더링 → 화면에 낡은 값 그려짐(한 프레임) → 이펙트 실행 → setState → 리렌더 → 새 값 그려짐
```

한 프레임이지만 눈에 깜빡임으로 보일 수 있고, 무엇보다 "커밋 이후에 다시 렌더를 유발하는" 구조라 성능 경고 대상이기도 하다(실제로 같은 프로젝트의 다른 파일에서 `setState in effect`라는 린트 경고를 발견하기도 했다 — 정확히 이 안티패턴을 잡아주는 규칙이다).

반면 **렌더링 도중에 호출한 `setState`는 다르게 동작한다.** React는 "어, 렌더링 중에 state가 바뀌었네"를 감지하면 화면에 커밋하기 전에 그 자리에서 즉시 다시 렌더링을 시작한다. 그래서 사용자 눈에는 낡은 값이 단 한 프레임도 그려지지 않고 바로 최신 값으로 나타난다.

```
렌더링 시작 → "prop이 바뀌었네" 감지 → setState 호출 → 커밋 전에 재시작 → 새 값으로 렌더링 → 화면에 커밋
```

## 검증 — 고쳤다고 믿지 않고 직접 재현해서 확인

코드를 고친 뒤 "이제 됐겠지"로 끝내지 않았다. 헤드리스 브라우저(Playwright)로 실제 계정에 로그인해서, "직접 추가"로 공고를 하나 만들고 **새로고침 없이** 카드가 나타나는지 스크립트로 재현했다.

```js
const before = await page.locator(`text=${uniqueTitle}`).count()
console.log('추가 전:', before) // 0

await page.click('button:has-text("직접 추가")')
// ...폼 채우고 저장...

// 모달이 닫히고 router.refresh()가 끝날 때까지 대기
await page.waitForSelector('text=채용공고 직접 추가', { state: 'detached' })
await page.waitForTimeout(1500)

const after = await page.locator(`text=${uniqueTitle}`).count()
console.log('추가 후(새로고침 없이):', after) // 2 → 카드가 실제로 보임
```

수정 전 코드로 같은 스크립트를 돌렸다면 `after`도 0이 나왔을 것이다. 수정 후에는 카드가 즉시 나타나는 걸 확인하고서야 "고쳤다"고 결론 내렸다.

## 자주 쓰는 패턴 요약

| 상황 | 올바른 처리 |
|---|---|
| prop을 그대로 화면에 쓰면 됨 | `useState` 없이 prop을 바로 사용 |
| prop을 초기값으로 로컬 state를 만들되, 그 이후로도 prop이 바뀔 수 있음 | 렌더링 중 이전 prop과 비교해 다르면 그 자리에서 `setState` (useEffect 금지) |
| prop이 바뀌어도 로컬에서 조작한 값을 유지하고 싶음(진짜 "초기값"인 경우) | 부모에 `key`를 줘서 컴포넌트를 통째로 리마운트시키는 방법도 고려 |

## 트러블슈팅

**Q. `useEffect(() => setState(prop), [prop])`도 결국 되는 거 아닌가?**
A. 동작은 한다. 다만 한 프레임 늦게 반영되고, React의 최신 린트 규칙(`react-hooks/set-state-in-effect`)이 경고를 준다. "이펙트 안에서 곧바로 setState"는 대부분 렌더링 중 동기화로 바꿀 수 있다는 신호로 받아들이면 된다.

**Q. 이런 버그를 애초에 안 만들려면?**
A. `useState(prop)`처럼 prop을 초기값으로만 쓰는 코드를 볼 때마다 "이 prop이 나중에 또 바뀔 수 있는가?"를 자문해보는 습관이 도움이 된다. 바뀔 수 있다면, 그 순간부터 동기화 전략이 필요하다는 뜻이다.

## 정리

```
증상: 직접 추가한 공고가 새로고침 전엔 안 보임(DB엔 정상 저장)
원인: useState(initial)이 마운트 시 한 번만 반영, 이후 router.refresh()로
      내려온 새 prop을 무시함
해결: 렌더링 중 prev prop과 비교해 다르면 그 자리에서 setState 호출
      (useEffect 대신 — 깜빡임 없고 cascading render 경고도 없음)
검증: 헤드리스 브라우저로 "새로고침 없이 카드가 뜨는지" 직접 재현
```

가장 크게 남은 인상은, **"서버 데이터를 로컬 state로 복사해서 쓰는" 패턴 자체가 문제가 아니라, 그 복사가 딱 한 번만 일어난다는 사실을 잊는 게 진짜 문제**라는 것이다. 드래그 앤 드롭처럼 즉각 반응이 필요한 UI를 만들 때마다, "이 로컬 state를 서버 데이터와 언제 다시 맞출 것인가"를 처음부터 같이 설계해야 한다는 걸 다시 배웠다.
