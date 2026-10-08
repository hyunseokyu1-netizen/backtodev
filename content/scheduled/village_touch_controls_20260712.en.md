---
title: "My Pixel Village Wouldn't Move on Phones — Adding Touch Controls to a Keyboard-Only Game"
date: '2026-07-12'
publish_date: '2026-11-17'
description: Fixing a minigame that worked fine on PC but had zero response to touch on mobile, using pointer events and a media query — all without touching the existing keyboard logic
tags:
  - Three.js
  - Next.js
  - Mobile UX
  - Responsive Web
  - React
---

## Why I'm Telling This Story

A while back I built a "pixel village" feature that greets you on this blog's (backtodev) homepage. It's
a 90s-style RPG minigame made with Three.js — move your character with WASD or arrow keys, walk into the
library (post list), my house (profile), or the workshop (projects) building, and if you find a hidden
easter egg (a boulder) somewhere in the town square, you can even plant a guestbook tree.

I tested it happily on my PC browser and shipped it, only to be startled a few days later when I opened my
own blog on my phone. The character just stood in the middle of the screen, completely unmoved no matter
how much I tapped. A feature that worked perfectly on PC turned into a "static image" on mobile.

Tracking down the cause revealed something almost too obvious. **The movement logic had been written to
respond only to keyboard events, from the very start.** This post covers that cause, and how I bolted
touch controls on without touching much of the existing logic at all.

## The Cause: Only Ever Watching Keyboard Events

This game's movement logic used a common pattern. On `keydown`, the pressed key code goes into a `Set`,
and every frame (`requestAnimationFrame`), that Set gets read to compute a movement direction.

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

The interaction logic (opening chests with SPACE, planting the tree, etc.) was exactly the same story —
it only existed inside a keyboard handler checking `e.code === "Space"`.

The problem is simple. **A phone has no physical keyboard, so the `keydown` event never fires at all.**
No matter how much you tap the screen, nothing ever gets added to the `pressed` Set, and the game loop was
computing `dx = 0, dy = 0` every single frame. This wasn't so much a bug as it was simply never having
built a way to control the game on mobile in the first place.

## The Fix

Rather than tearing apart the keyboard logic, I took the approach of **leaving the existing logic exactly
as it is, and just opening a door so touch input can poke at the same state (the Set) too.** Show a
virtual D-pad and an interact button on screen, and have pressing them add/remove key codes from the
`pressed` Set exactly the way pressing a keyboard key would — then the rest of the movement calculation
logic needs no changes at all.

### Step 1. Exposing the `pressed` Set Outside via useRef

This game manages the entire Three.js scene and game loop inside a `useEffect`, so the `pressed` Set was
a local variable trapped inside that effect. I pulled it out into a `useRef` so the component's JSX
(the buttons) could reach it too.

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

The SPACE interaction logic also got pulled out into a function called `handleInteract` and wired up to
`interactRef.current`. The keyboard's `onKeyDown` just calls this same function now — the behavior itself
is unchanged.

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

### Step 2. Adding a Virtual D-Pad and Interact Button to the Screen

All that's left is adding 4 directional buttons and 1 interact button to the JSX, and adding/removing
from `pressedRef.current` on `pointerdown`/`pointerup`.

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

Wiring up only `onPointerUp` leaves a case where a finger sliding off the button leaves the key stuck in
the "pressed" state. So I also wired up `onPointerLeave` and `onPointerCancel` to make sure the key gets
released reliably in every case a finger leaves the button.

The interact button just needs to call `interactRef.current()` the moment it's pressed.

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

I used `onPointerDown` instead of `onClick` because Pointer Events let mouse and touch input be handled
through a single unified API, and the response feels more immediate than `click`.

### Step 3. Hiding It on PC — `pointer: coarse`

Having these buttons visible in a mouse/keyboard environment too would look messy. The CSS media feature
`@media (pointer: coarse)` lets you target styles specifically at environments using an "imprecise input
device" (a touchscreen).

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

On desktop, where the mouse is the primary input device, this class stays `display: none` and the touch
buttons never render at all; they only appear in a touchscreen environment. Splitting on "does this
device actually use touch" turned out to be far more accurate than splitting on a responsive breakpoint
(screen width) — these days there are touchscreen laptops, and conversely people who pair a tablet with a
keyboard, so I judged that splitting by input method itself made more sense than screen size.

## What Was Nice About Fixing It This Way

This village game's homepage overlay and its `/village` page actually share the same component. So fixing
this one component fixed both places at once — another reminder that keeping components well-separated
means a bug fix like this can land everywhere in one shot.

## Wrap-Up

| Item | Detail |
|------|------|
| Symptom | The character never moved at all on mobile (touch) |
| Cause | Movement/interaction logic depended entirely on `keydown`/`keyup` keyboard events |
| Fix | Exposed the `pressed` Set and the interact function via `useRef` → touch buttons manipulate the same state |
| Visibility condition | `@media (pointer: coarse)` — buttons only show on touch devices |
| Side benefit | Another screen sharing the component (the overlay) got fixed automatically too |

Looking back, opening it on my phone just once before deploying would have caught this immediately. It's
easy to just shrink the PC browser window, check the responsive breakpoints, and call it "mobile tested."
But when the actual **input method** differs — keyboard/mouse vs. touch — that's a case you really do need
to verify on a real touch environment, separate from screen size entirely. A lesson I relearned the hard
way this time.
