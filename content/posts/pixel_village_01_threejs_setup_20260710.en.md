---
title: '[Pixel Village Part 1] Building an RPG Village Inside a Blog — Three.js 2D Top-Down Setup'
date: '2026-07-10'
publish_date: '2026-09-02'
description: The first step in building a 90s-RPG-style top-down village in a Next.js blog with Three.js OrthographicCamera — keyboard movement, AABB collision, and camera tracking
tags:
  - ThreeJS
  - NextJS
  - React
  - PixelVillage
  - SideProject
---

Run a blog long enough and eventually this thought hits you: "isn't the post-list page kind of plain?"

So I went for it. **Turning the blog into a 90s RPG village.** Like Pokémon or Stardew Valley, you control a character and walk around a village, walk into the library building and the post list shows up, walk into my house and my profile shows up. The finished thing is walkable at [backtodev.com/ko/village](https://backtodev.com/ko/village).

I built it in a day, but not all in one go. I worked by **splitting it into phases, confirming each stage worked, then moving to the next,** and this series follows that same order.

| Part | Content |
|----|------|
| **Part 1 (this post)** | Three.js 2D setup, character movement, collision, camera |
| Part 2 | Drawing pixel art in code, with zero image files |
| Part 3 | Scene transitions and hooking up blog data |
| Part 4 | A guestbook easter egg where a tree grows |

---

## Why Three.js — for a 2D game?

For a 2D top-down game, Phaser or the Canvas 2D API usually comes to mind first. I used Three.js anyway, because:

- A single **OrthographicCamera** produces a perfect 2D view. With no perspective distortion, the retro-RPG top-down composition reproduces exactly
- There's room to later extend it into a slightly tilted 2.5D look, or add lighting effects
- And honestly, I'd been wanting to properly try Three.js for once

Installation is just this.

```bash
npm install three @types/three
```

## Step 1 — Route and component structure

Following the Next.js App Router, I created a `/village` route. Since the game is a bundle of browser APIs (canvas, keyboard), it's a client component, split apart so metadata is handled by a server component.

```
app/[locale]/village/
├── page.tsx          # server component — metadata, data fetching
└── VillageGame.tsx   # "use client" — the game engine itself
```

```tsx
// page.tsx
export default async function VillagePage({ params }) {
  const { locale } = await params;
  return <VillageGame locale={locale} />;
}
```

## Step 2 — Creating a 2D view with OrthographicCamera

Three.js is a 3D library, but placing the camera straight-on facing the XY plane and using a perspective-free OrthographicCamera to look down produces perfect 2D. **The z-axis is used purely for "draw order (layering)," not depth.**

```tsx
const VIEW_HEIGHT = 14; // vertical range visible on screen (world units). Smaller = more zoomed in

const camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 100);
camera.position.z = 50;

function updateCameraFrustum() {
  const aspect = container.clientWidth / container.clientHeight;
  const viewW = VIEW_HEIGHT * aspect;
  camera.left = -viewW / 2;
  camera.right = viewW / 2;
  camera.top = VIEW_HEIGHT / 2;
  camera.bottom = -VIEW_HEIGHT / 2;
  camera.updateProjectionMatrix();
}
```

The key point is **fixing the vertical field of view and computing the horizontal one to match the screen aspect ratio.** The character appears the same size on any screen size. Resize is detected via `ResizeObserver`, which re-calls this function.

Since this is pixel art, anti-aliasing is turned off on the renderer.

```tsx
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

## Step 3 — Keyboard input: e.code, not e.key

The first trap you hit handling movement keys. Using `e.key` means **when a Korean IME is active, `w` comes in as `ㅈ`, and the character just doesn't move.** You need `e.code`, which gives the physical key position instead.

```tsx
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],  ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0],  ArrowRight: [1, 0],
};

const pressed = new Set<string>();

function onKeyDown(e: KeyboardEvent) {
  if (MOVE_KEYS[e.code] || e.code === "Space") {
    e.preventDefault(); // prevent arrow keys/space from scrolling the page
    pressed.add(e.code);
  }
}
function onKeyUp(e: KeyboardEvent) {
  pressed.delete(e.code);
}
```

`preventDefault` is essential too. Without it, the blog page scrolls along every time an arrow key is pressed.

## Step 4 — The game loop and movement

A `requestAnimationFrame` loop reads input every frame and moves the character. Two details:

**① Diagonal correction** — press W and D together and the vector's length becomes √2, making diagonal movement 1.4x faster. Solved by normalizing.

**② A delta cap** — leave the tab in the background and come back, and delta can spike to tens of seconds, teleporting the character. A cap prevents this.

```tsx
const PLAYER_SPEED = 7; // units / sec
const MAX_DELTA = 0.05;
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const delta = Math.min(clock.getDelta(), MAX_DELTA);

  let dx = 0, dy = 0;
  for (const code of pressed) {
    const dir = MOVE_KEYS[code];
    if (dir) { dx += dir[0]; dy += dir[1]; }
  }
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    player.position.x += (dx / len) * PLAYER_SPEED * delta;
    player.position.y += (dy / len) * PLAYER_SPEED * delta;
  }

  renderer.render(scene, camera);
}
```

## Step 5 — AABB collision: sliding along walls

Since you shouldn't be able to pass through buildings and trees, collision detection is needed. A complex physics engine isn't necessary — **an AABB (axis-aligned bounding box) overlap check** is enough.

```tsx
interface AABB { minX: number; maxX: number; minY: number; maxY: number; }

function intersects(a: AABB, b: AABB): boolean {
  return a.maxX > b.minX && a.minX < b.maxX && a.maxY > b.minY && a.minY < b.maxY;
}
```

The important trick here is **axis-separated movement.** Moving X and Y together and canceling both on collision makes the character abruptly stop when walking at an angle into a wall. Checking the X-axis move and the Y-axis move separately makes movement slide along the wall instead. That's the retro-RPG feel.

```tsx
const nextX = player.position.x + stepX;
if (!collides(nextX, player.position.y)) player.position.x = nextX;

const nextY = player.position.y + stepY;
if (!collides(player.position.x, nextY)) player.position.y = nextY;
```

The collision box only covers **the character's feet,** not the whole sprite. This lets the head overlap a building's roof while still being walkable, producing the RPG-specific effect of "walking around behind a building" (Y-sorting is covered in Part 2).

## Step 6 — Camera tracking: damp, not lerp

If the camera stiffly follows the character 1:1, it feels nauseating. Smooth tracking usually uses `lerp(a, b, 0.1)`, but this **has a decay speed that varies with framerate** (moves differently at 60fps vs. 144fps). Three.js has a framerate-independent version built in.

```tsx
camera.position.x = THREE.MathUtils.damp(camera.position.x, player.position.x, 6, delta);
camera.position.y = THREE.MathUtils.damp(camera.position.y, player.position.y, 6, delta);

// clamp so the camera never shows the empty margin outside the map
const camMaxX = Math.max(0, MAP_WIDTH / 2 - viewW / 2);
camera.position.x = THREE.MathUtils.clamp(camera.position.x, -camMaxX, camMaxX);
```

Adding a map-boundary clamp completes the familiar RPG camera — it stops at the edges of the map while only the character keeps moving.

## Troubleshooting — two canvases in React StrictMode

If two canvases show up overlapping in dev mode, it's due to StrictMode's deliberate double-mount. **Everything created needs to be released in the useEffect cleanup.** Three.js doesn't have GC automatically clean up GPU resources, so explicit disposal is required.

```tsx
return () => {
  cancelAnimationFrame(rafId);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
  renderer.dispose();
  container.removeChild(renderer.domElement);
};
```

---

## Summary

| Item | Choice | Reason |
|------|------|------|
| Camera | OrthographicCamera, fixed vertical FOV | Perspective-free 2D, screen-size-independent zoom |
| Key input | `e.code` + preventDefault | Handles Korean IME, prevents page scroll |
| Movement | Vector normalization + a delta cap | Corrects diagonal speed, prevents teleporting on tab return |
| Collision | AABB + axis-separated checks | Wall sliding, no physics engine needed |
| Camera tracking | `MathUtils.damp` + clamp | Framerate-independent decay |
| Cleanup | Dispose geometry/material/renderer, all of it | Handles StrictMode's double-mount |

At this point, a red square smoothly moves around on a green floor. It looks bare, but the game's whole skeleton is in place. Next up: turning this square into a real pixel character, and the green floor into a real village — **all in code, with zero image files.**
