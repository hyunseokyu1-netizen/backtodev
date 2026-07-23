---
title: "폰으로 접속하면 안 움직이는 픽셀 마을 -- 키보드 전용 게임에 터치 컨트롤 붙이기"
date: '2026-07-12'
publish_date: '2026-08-17'
description: PC에서만 테스트하고 넘어간 미니게임이 모바일에서 아예 조작이 안 됐던 버그를 pointer 이벤트와 media query로 고친 과정
tags:
  - Three.js
  - Next.js
  - 모바일 UX
  - 반응형 웹
  - React
---

## 왜 이 얘기를 하냐면

얼마 전에 이 블로그(backtodev) 첫 화면에 들어오면 뜨는 "픽셀 마을" 기능을 만들었다. Three.js로 만든 90년대 RPG 스타일 미니게임인데, WASD나 화살표 키로 캐릭터를 움직여서 도서관(포스트 목록), 우리 집(프로필), 공방(프로젝트) 건물에 들어갈 수 있고, 마을 광장 어딘가에 숨은 이스터에그(돌바위)를 찾으면 방명록 나무도 심을 수 있다.

PC 브라우저로 신나게 테스트하고 배포까지 끝냈는데, 며칠 뒤에 폰으로 내 블로그에 들어가 봤다가 당황했다. 캐릭터가 화면 한가운데 그냥 서 있기만 하고 아무리 화면을 눌러도 꼼짝을 안 했다. PC에서는 완벽하게 잘 되던 기능이 모바일에서는 그냥 "정지 이미지"였던 거다.

원인을 찾아보니 너무 당연한 이유였다. **이동 로직을 처음부터 키보드 이벤트로만 짰기 때문**이었다. 이 글에서는 그 원인과, 기존 로직을 거의 건드리지 않고 터치 컨트롤을 얹은 방법을 정리해본다.

## 원인: 키보드 이벤트만 보고 있었다

이 게임의 이동 로직은 흔히 쓰는 방식으로 되어 있었다. `keydown`이 오면 눌린 키 코드를 `Set`에 담아두고, 매 프레임(`requestAnimationFrame`) 그 Set을 읽어서 이동 방향을 계산하는 구조다.

```ts
const pressed = new Set<string>();

function onKeyDown(e: KeyboardEvent) {
  if (MOVE_KEYS[e.code]) {
    pressed.add(e.code); // "KeyW", "ArrowUp" 등
  }
}
function onKeyUp(e: KeyboardEvent) {
  pressed.delete(e.code);
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

// 게임 루프 — 매 프레임 실행
function tick() {
  let dx = 0, dy = 0;
  for (const code of pressed) {
    const dir = MOVE_KEYS[code];
    if (dir) { dx += dir[0]; dy += dir[1]; }
  }
  // dx, dy로 캐릭터 이동...
}
```

상호작용(SPACE로 상자 열기, 나무 심기 등) 로직도 마찬가지로 `e.code === "Space"`를 검사하는 키보드 핸들러 안에만 있었다.

문제는 간단하다. **폰에는 물리 키보드가 없으니 `keydown` 이벤트 자체가 발생하지 않는다.** 화면을 아무리 터치해도 `pressed` Set에는 아무것도 안 들어가고, 게임 루프는 매 프레임 `dx = 0, dy = 0`만 계산하고 있었던 거다. 버그라기보다는, 애초에 모바일 조작 수단을 만들어 놓지 않은 것에 가까웠다.

## 해결 방향

키보드 로직을 뜯어고치는 대신, **기존 로직은 그대로 두고 터치에서도 같은 상태(Set)를 건드릴 수 있게 창구만 열어주는** 방향으로 접근했다. 화면에 가상 방향 버튼(D-pad)과 상호작용 버튼을 띄워서, 버튼을 누르면 키보드를 눌렀을 때와 똑같이 `pressed` Set에 키 코드를 추가/삭제하게 만들면 나머지 이동 계산 로직은 손댈 필요가 없다.

### Step 1. `pressed` Set을 useRef로 밖에서도 접근 가능하게 노출

이 게임은 `useEffect` 안에서 Three.js 씬과 게임 루프를 통째로 관리하고 있어서, `pressed` Set이 이펙트 안에 갇힌 지역 변수였다. 이걸 컴포넌트 JSX(버튼)에서도 건드릴 수 있게 `useRef`로 빼냈다.

```ts
// 컴포넌트 최상단
const pressedRef = useRef<Set<string>>(new Set());
const interactRef = useRef<() => void>(() => {});
```

```ts
// useEffect 안 — 기존 지역 변수 대신 ref가 들고 있는 Set을 그대로 사용
const pressed = pressedRef.current;
pressed.clear();
```

SPACE 상호작용 로직도 `handleInteract`라는 함수로 뽑아서 `interactRef.current`에 연결했다. 키보드의 `onKeyDown`도 이 함수를 호출하도록 바꿨을 뿐, 동작은 그대로다.

```ts
function handleInteract() {
  const m = modalRef.current;
  if (m) {
    if (m.kind !== "plant") closeModal();
  } else if (currentZone && !transitioning) {
    openModal(currentZone);
    pressed.clear();
  }
}
interactRef.current = handleInteract;
```

### Step 2. 화면에 가상 D-pad와 상호작용 버튼 추가

이제 버튼 4개(상하좌우)와 상호작용 버튼 1개를 JSX에 추가하고, `pointerdown`/`pointerup`에서 `pressedRef.current`를 add/delete 하면 끝이다.

```tsx
<button
  onPointerDown={(e) => {
    e.preventDefault();
    pressedRef.current.add("KeyW");
  }}
  onPointerUp={() => pressedRef.current.delete("KeyW")}
  onPointerLeave={() => pressedRef.current.delete("KeyW")}
  onPointerCancel={() => pressedRef.current.delete("KeyW")}
>
  ▲
</button>
```

`onPointerUp`만 걸어두면 손가락이 버튼 밖으로 미끄러져 나갔을 때 키가 눌린 채로 고정돼버리는 경우가 생긴다. 그래서 `onPointerLeave`, `onPointerCancel`까지 같이 걸어서 손가락이 버튼을 벗어나는 모든 경우에 확실히 떼지도록 했다.

상호작용 버튼은 그냥 누르는 순간 `interactRef.current()`를 호출하면 된다.

```tsx
<button
  onPointerDown={(e) => {
    e.preventDefault();
    interactRef.current();
  }}
>
  실행
</button>
```

`onClick` 대신 `onPointerDown`을 쓴 이유는, 마우스와 터치 이벤트를 하나로 통일해서 처리할 수 있고(Pointer Events), `click`보다 반응이 즉각적이기 때문이다.

### Step 3. PC에는 안 보이게 — `pointer: coarse`

이 버튼들이 마우스/키보드 환경에서도 화면에 떠 있으면 지저분해 보인다. CSS `@media (pointer: coarse)`를 쓰면 "정밀하지 않은 입력 장치"(터치스크린)를 쓰는 환경만 골라서 스타일을 적용할 수 있다.

```css
.pv-touch-controls {
  display: none;
}
@media (pointer: coarse) {
  .pv-touch-controls {
    display: block;
  }
}
```

마우스가 기본 입력 장치인 데스크톱에서는 이 클래스가 계속 `display: none`이라 터치 버튼이 아예 렌더링되지 않고, 터치스크린 환경에서만 나타난다. 반응형 브레이크포인트(화면 너비)로 나누는 것보다 "이 기기가 실제로 터치를 쓰는가"를 기준으로 나누는 게 훨씬 정확했다 — 요즘은 터치스크린 노트북도 있고, 반대로 태블릿을 키보드에 물려 쓰는 사람도 있어서, 화면 크기보다 입력 방식 자체를 기준으로 나누는 게 맞는다고 판단했다.

## 고치고 나서 좋았던 점

이 마을 게임은 홈 화면 진입 시 뜨는 오버레이와 `/village` 페이지가 사실 같은 컴포넌트를 재사용하고 있었다. 그래서 이 컴포넌트 하나만 고치면 두 군데가 동시에 해결됐다 — 컴포넌트를 잘 분리해두면 이런 식으로 버그 수정도 한 번에 끝난다는 걸 다시 느꼈다.

## 정리

| 항목 | 내용 |
|------|------|
| 증상 | 모바일(터치)에서 캐릭터가 전혀 움직이지 않음 |
| 원인 | 이동/상호작용 로직이 `keydown`/`keyup` 키보드 이벤트에만 의존 |
| 해결 | `pressed` Set과 상호작용 함수를 `useRef`로 노출 → 터치 버튼이 같은 상태를 조작 |
| 노출 조건 | `@media (pointer: coarse)` — 터치 기기에서만 버튼 표시 |
| 부수 효과 | 컴포넌트를 공유하는 다른 화면(오버레이)도 자동으로 같이 고쳐짐 |

돌아보면 배포 전에 폰으로 한 번만 열어봤어도 바로 알아챌 수 있었던 버그다. PC 브라우저 창을 좁혀서 반응형만 확인하고 "모바일 테스트 끝!"이라고 생각하기 쉬운데, 키보드/마우스 vs 터치처럼 **입력 방식 자체가 다른 경우**는 화면 크기와 별개로 반드시 실제 터치 환경에서 확인해야 한다는 걸 다시 배웠다.
