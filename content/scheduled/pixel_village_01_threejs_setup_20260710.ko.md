---
title: '[픽셀 마을 1편] 블로그 안에 RPG 마을 만들기 — Three.js 2D 탑다운 세팅'
date: '2026-07-10'
publish_date: '2026-09-02'
description: Next.js 블로그에 Three.js OrthographicCamera로 90년대 RPG 스타일 탑다운 마을을 만드는 첫 단계. 키보드 이동, AABB 충돌, 카메라 추적까지
tags:
  - ThreeJS
  - NextJS
  - React
  - 픽셀마을
  - 사이드프로젝트
---

블로그를 운영하다 보면 어느 순간 이런 생각이 든다. "포스트 목록 페이지, 너무 평범하지 않나?"

그래서 저질렀다. **블로그를 90년대 RPG 마을로 만들기.** 포켓몬이나 스타듀밸리처럼 캐릭터를 조작해서 마을을 돌아다니고, 도서관 건물에 들어가면 포스트 목록이 나오고, 우리 집에 들어가면 프로필이 나오는 구조다. 완성본은 [backtodev.com/ko/village](https://backtodev.com/ko/village)에서 직접 돌아다닐 수 있다.

하루 만에 만들었지만 한 번에 다 만들지는 않았다. **Phase를 쪼개서 각 단계가 동작하는 걸 확인하고 다음으로 넘어가는 방식**으로 진행했고, 이 시리즈도 그 순서를 따른다.

| 편 | 내용 |
|----|------|
| **1편 (이 글)** | Three.js 2D 셋업, 캐릭터 이동, 충돌, 카메라 |
| 2편 | 이미지 파일 없이 코드로 픽셀아트 그리기 |
| 3편 | 씬 전환과 블로그 데이터 연동 |
| 4편 | 나무가 자라는 방명록 이스터에그 |

---

## 왜 Three.js인가 — 2D 게임인데?

2D 탑다운 게임이면 Phaser나 Canvas 2D API가 먼저 떠오른다. 그런데도 Three.js를 쓴 이유:

- **OrthographicCamera** 하나로 완벽한 2D 뷰가 나온다. 원근 왜곡이 없어서 위에서 내려다보는 레트로 RPG 구도가 그대로 재현된다
- 나중에 살짝 기울인 2.5D나 조명 효과로 확장할 여지가 있다
- 그리고 솔직히, Three.js를 한번 제대로 써보고 싶었다

설치는 이게 전부다.

```bash
npm install three @types/three
```

## Step 1 — 라우트와 컴포넌트 구조

Next.js App Router 기준으로 `/village` 라우트를 만든다. 게임은 브라우저 API(캔버스, 키보드) 덩어리이므로 클라이언트 컴포넌트, 메타데이터는 서버 컴포넌트가 담당하도록 분리했다.

```
app/[locale]/village/
├── page.tsx          # 서버 컴포넌트 — 메타데이터, 데이터 fetch
└── VillageGame.tsx   # "use client" — 게임 엔진 본체
```

```tsx
// page.tsx
export default async function VillagePage({ params }) {
  const { locale } = await params;
  return <VillageGame locale={locale} />;
}
```

## Step 2 — OrthographicCamera로 2D 뷰 만들기

Three.js는 3D 라이브러리지만, 카메라를 XY 평면 정면에 두고 원근 없는 OrthographicCamera로 내려다보면 완벽한 2D가 된다. **z축은 깊이가 아니라 "그리기 순서(레이어)"로만 쓴다.**

```tsx
const VIEW_HEIGHT = 14; // 화면에 보이는 세로 범위(월드 유닛). 작을수록 줌인

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

포인트는 **세로 시야를 고정하고 가로는 화면 비율에 맞춰 계산**하는 것. 어떤 화면 크기에서도 캐릭터가 같은 크기로 보인다. 리사이즈는 `ResizeObserver`로 감지해서 이 함수를 다시 부른다.

렌더러는 픽셀아트니까 안티앨리어싱을 끈다.

```tsx
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

## Step 3 — 키보드 입력: e.key 말고 e.code

이동 키 처리에서 처음 만나는 함정. `e.key`를 쓰면 **한글 IME가 켜져 있을 때 `w`가 `ㅈ`으로 들어와서 캐릭터가 안 움직인다.** 물리 키 위치를 주는 `e.code`를 써야 한다.

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
    e.preventDefault(); // 방향키/스페이스로 페이지 스크롤되는 것 방지
    pressed.add(e.code);
  }
}
function onKeyUp(e: KeyboardEvent) {
  pressed.delete(e.code);
}
```

`preventDefault`도 필수다. 안 그러면 방향키를 누를 때마다 블로그 페이지가 같이 스크롤된다.

## Step 4 — 게임 루프와 이동

`requestAnimationFrame` 루프에서 매 프레임 입력을 읽어 이동시킨다. 두 가지 디테일:

**① 대각선 보정** — W와 D를 같이 누르면 벡터 길이가 √2가 되어 대각선이 1.4배 빨라진다. 정규화로 해결.

**② delta 상한** — 탭을 백그라운드에 뒀다 돌아오면 delta가 수십 초로 튀어서 캐릭터가 순간이동한다. 상한을 걸어둔다.

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

## Step 5 — AABB 충돌: 벽에서 미끄러지게

건물과 나무를 통과하면 안 되니까 충돌 판정이 필요하다. 복잡한 물리 엔진 없이 **AABB(축 정렬 박스) 겹침 검사**면 충분하다.

```tsx
interface AABB { minX: number; maxX: number; minY: number; maxY: number; }

function intersects(a: AABB, b: AABB): boolean {
  return a.maxX > b.minX && a.minX < b.maxX && a.maxY > b.minY && a.minY < b.maxY;
}
```

여기서 중요한 트릭이 **축 분리 이동**이다. X와 Y를 한꺼번에 이동시키고 충돌이면 둘 다 취소하는 방식은, 벽에 비스듬히 걸었을 때 캐릭터가 뚝 멈춰버린다. X축 이동과 Y축 이동을 따로 판정하면 벽을 따라 미끄러지듯 이동한다. 레트로 RPG의 그 느낌이다.

```tsx
const nextX = player.position.x + stepX;
if (!collides(nextX, player.position.y)) player.position.x = nextX;

const nextY = player.position.y + stepY;
if (!collides(player.position.x, nextY)) player.position.y = nextY;
```

충돌 박스는 캐릭터 스프라이트 전체가 아니라 **발밑만** 잡는다. 머리가 건물 지붕과 겹쳐도 걸어갈 수 있어야 "건물 뒤로 돌아가는" RPG 특유의 연출이 나온다(Y-소팅은 2편에서).

## Step 6 — 카메라 추적: lerp 말고 damp

카메라가 캐릭터를 뻣뻣하게 1:1로 따라오면 멀미난다. 부드러운 추적에 보통 `lerp(a, b, 0.1)`을 쓰는데, 이건 **프레임레이트에 따라 감쇠 속도가 달라진다**(60fps와 144fps에서 다르게 움직임). Three.js에 프레임레이트 무관 버전이 내장돼 있다.

```tsx
camera.position.x = THREE.MathUtils.damp(camera.position.x, player.position.x, 6, delta);
camera.position.y = THREE.MathUtils.damp(camera.position.y, player.position.y, 6, delta);

// 카메라가 맵 바깥 여백을 비추지 않도록 클램프
const camMaxX = Math.max(0, MAP_WIDTH / 2 - viewW / 2);
camera.position.x = THREE.MathUtils.clamp(camera.position.x, -camMaxX, camMaxX);
```

맵 경계 클램프까지 넣으면 맵 가장자리에서 카메라가 멈추고 캐릭터만 이동하는, 익숙한 RPG 카메라가 완성된다.

## 트러블슈팅 — React StrictMode에서 캔버스가 2개

dev 모드에서 캔버스가 두 개 겹쳐 나온다면 StrictMode의 의도적인 이중 마운트 때문이다. **useEffect cleanup에서 만든 것을 전부 해제**해야 한다. Three.js는 GC가 GPU 리소스를 자동으로 정리해주지 않으므로 명시적 dispose가 필요하다.

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

## 정리

| 항목 | 선택 | 이유 |
|------|------|------|
| 카메라 | OrthographicCamera, 세로 시야 고정 | 원근 없는 2D, 화면 크기 무관 줌 |
| 키 입력 | `e.code` + preventDefault | 한글 IME 대응, 페이지 스크롤 방지 |
| 이동 | 벡터 정규화 + delta 상한 | 대각선 속도 보정, 탭 복귀 순간이동 방지 |
| 충돌 | AABB + 축 분리 판정 | 벽 슬라이딩, 물리 엔진 불필요 |
| 카메라 추적 | `MathUtils.damp` + 클램프 | 프레임레이트 무관 감쇠 |
| 클린업 | geometry/material/renderer 전부 dispose | StrictMode 이중 마운트 대응 |

여기까지 하면 초록 바닥 위에서 빨간 네모가 부드럽게 돌아다닌다. 초라해 보여도 게임의 뼈대는 전부 갖췄다. 다음 편에서는 이 네모를 진짜 픽셀 캐릭터로, 초록 바닥을 진짜 마을로 바꾼다. **이미지 파일 하나 없이 전부 코드로.**
