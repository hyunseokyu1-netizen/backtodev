---
title: '[픽셀 마을 3편] 도서관 문을 열다 — 씬 전환과 블로그 데이터 연동'
date: '2026-07-10'
publish_date: '2026-09-04'
description: 건물 진입 페이드 전환, 무한 왕복 루프 방지, 그리고 도서관 책장에 실제 블로그 포스트를 태그 기반으로 꽂는 과정
tags:
  - ThreeJS
  - NextJS
  - React
  - 픽셀마을
  - 사이드프로젝트
---

[2편](/ko/posts/pixel_village_02_pixelart_code_20260710)까지 해서 마을은 완성됐다. 하지만 건물은 아직 그림일 뿐이다. 이번 편의 목표:

- 도서관 문으로 걸어가면 **페이드 아웃 → 내부 씬 → 페이드 인**
- 내부 책장 앞에서 SPACE를 누르면 **실제 블로그 포스트 목록**이 레트로 모달로
- 우리 집(프로필), 공방(포트폴리오)도 같은 구조로

게임이 블로그와 연결되는 순간이다.

---

## Step 1 — 씬을 데이터로: GameWorld 구조

씬이 하나일 때는 전역 변수로 대충 버텼는데, 마을·도서관·집·공방 4개가 되니 구조가 필요했다. "장소 하나"를 이렇게 정의했다.

```ts
interface GameWorld {
  scene: THREE.Scene;        // 그릴 것들
  colliders: AABB[];         // 못 지나가는 곳
  triggers: Trigger[];       // 밟으면 다른 씬으로 이동하는 존 (문, 출구 매트)
  zones: InteractZone[];     // SPACE 상호작용 존 (책장, 책상, 작업대)
  mapW: number;
  mapH: number;
}

interface Trigger {
  box: AABB;
  target: WorldId;                  // "village" | "library" | "home" | "lab"
  spawn: { x: number; y: number };  // 도착 씬에서의 스폰 위치
}
```

`buildVillage()`, `buildLibrary()` 같은 팩토리 함수가 각각의 GameWorld를 만들고, 게임 루프는 `active` 하나만 바라본다. 이동·충돌·트리거 검사 코드는 어느 씬이든 동일하게 동작한다.

플레이어 메시는 하나를 모든 씬이 공유한다. Three.js는 오브젝트를 다른 씬에 `add`하면 이전 씬에서 자동으로 빠지기 때문에, 씬 전환이 `newScene.add(player)` 한 줄이다.

## Step 2 — 페이드 전환: WebGL 말고 CSS로

씬 전환 페이드는 셰이더나 Three.js 후처리로 할 수도 있지만, 훨씬 쉬운 방법이 있다. **캔버스 위에 검은 div를 올리고 CSS transition으로 opacity만 조절**하는 것.

```tsx
<div
  ref={fadeRef}
  style={{
    position: "absolute",
    inset: 0,
    background: "#000",
    opacity: 0,
    transition: "opacity 380ms ease",
    pointerEvents: "none",
  }}
/>
```

전환 시퀀스는 setTimeout 두 개로 조립한다. 페이드 아웃(380ms) → 씬 교체 + 스폰 이동 → 페이드 인.

```ts
function goToWorld(target: WorldId, spawn: { x: number; y: number }) {
  if (transitioning) return; // 전환 중 재진입 방지
  transitioning = true;
  fade.style.opacity = "1";
  setTimeout(() => {
    active = worlds[target];
    active.scene.add(player);
    player.position.set(spawn.x, spawn.y, zForFoot(spawn.y - PLAYER_H / 2));
    camera.position.set(spawn.x, spawn.y, camera.position.z); // 카메라도 스냅
    fade.style.opacity = "0";
    setTimeout(() => { transitioning = false; }, FADE_MS);
  }, FADE_MS);
}
```

`transitioning` 플래그가 서 있는 동안은 게임 루프에서 입력 처리를 건너뛴다. 화면이 검은 동안 캐릭터가 움직이는 사고를 막는다.

### 함정: 무한 왕복 루프

첫 구현에서 도서관에 들어갔다 나오는 순간 **다시 도서관으로 빨려 들어갔다.** 원인은 스폰 위치. 마을로 나올 때의 스폰 좌표가 도서관 문 트리거 박스 안에 있으면, 도착하자마자 트리거가 다시 발동한다.

해결은 단순하다. **출구 스폰 위치를 입구 트리거보다 몇 유닛 남쪽에** 둔다. 문에서 한 발짝 나온 위치에서 시작하는 게 자연스럽기도 하다. 씬 전환을 만들 때 반드시 체크해야 할 항목.

## Step 3 — 블로그 포스트를 게임에 넣기

이 블로그의 포스트 데이터는 이미 `getAllPosts()` 함수로 추상화돼 있다(로컬은 fs, 프로덕션은 GitHub GraphQL). 게임을 위한 별도 API를 만들 필요 없이, **서버 컴포넌트에서 읽어서 props로 내려주면 끝**이다.

```tsx
// page.tsx (서버 컴포넌트)
export default async function VillagePage({ params }) {
  const { locale } = await params;
  const posts = (await getAllPosts(locale)).map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    tags: p.tags ?? [],
  }));
  return <VillageGame locale={locale} posts={posts} />;
}
```

본문은 빼고 메타데이터만 추리는 게 포인트. 포스트 100개 분량의 제목·날짜·태그면 몇 KB밖에 안 된다.

## Step 4 — 책장 = 카테고리: 태그 표기 편차와의 싸움

도서관에 책장 4개를 놓고 각각 카테고리를 맡겼다: **RECENT / WEB / APP / AI**. 포스트를 태그 기준으로 분류하는데, 여기서 현실적인 문제를 만났다. 2년 치 포스트의 태그 표기가 제멋대로였다.

- `Next.js` vs `NextJS`
- `Claude Code` vs `ClaudeCode`
- `next-intl` vs `nextintl`

전부 같은 주제인데 문자열이 다르다. 태그를 일괄 정리하는 대신 **비교 시점에 정규화**하는 쪽을 골랐다. 기존 포스트를 안 건드려도 되기 때문이다.

```ts
/** "Next.js" / "NextJS" → "nextjs", "Claude Code" → "claudecode" */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[\s.\-_]/g, "");
}

const shelf = {
  id: "web",
  sign: "WEB",
  tags: ["nextjs", "react", "vercel", "seo", "i18n", "supabase", ...],
};

// 분류: 정규화한 포스트 태그가 책장 태그 목록과 하나라도 겹치면 꽂는다
const normalized = post.tags.map(normalizeTag);
if (normalized.some((t) => shelf.tags.includes(t))) result[shelf.id].push(post);
```

한 포스트가 여러 책장에 꽂힐 수 있는데, 실제 도서관도 그런 건 아니지만 발견성 측면에서는 오히려 낫다.

## Step 5 — 상호작용 존과 레트로 모달

책장 앞 공간에 보이지 않는 존을 깔고, 플레이어 발밑 박스와 겹치면 화면 하단에 `[SPACE] 웹 개발 책장 읽기` 프롬프트를 띄운다. 게임 루프는 존 감지만 하고, 프롬프트/모달 UI는 React state로 넘긴다. **Three.js는 월드만, UI는 React가** — 이 분리가 코드를 깔끔하게 유지해 줬다.

모달은 HTML 오버레이다. 레트로 감성은 CSS 몇 줄로 나온다.

```css
border: 3px solid #e8e4d8;
box-shadow: 0 0 0 3px #10140d, 8px 8px 0 rgba(0, 0, 0, 0.6);
font-family: var(--font-mono), monospace;
```

`box-shadow`를 겹쳐 이중 픽셀 보더를 만들고, 블러 없는 하드 섀도를 깔면 90년대 게임 대화창 느낌이 난다. 목록의 포스트를 클릭하면 `target="_blank"`로 실제 포스트 페이지가 새 탭에 열린다. 게임 상태를 잃지 않기 위해서다.

### 함정: 모달과 게임의 키보드 싸움

모달을 띄워도 window 키 리스너는 살아 있다. 그대로 두면 두 가지 사고가 난다.

1. 모달이 열린 동안 WASD로 캐릭터가 돌아다닌다
2. 이동키를 누른 채 SPACE로 모달을 열면, keyup을 모달이 먹어서 **닫은 뒤 캐릭터가 혼자 걸어간다**

해결: 모달 열림 상태면 게임 루프에서 이동을 통째로 건너뛰고, 모달을 여는 순간 눌린 키 Set을 비운다.

```ts
if (currentZone && !transitioning) {
  openModal(currentZone);
  pressed.clear(); // ← 이 한 줄이 유령 이동을 막는다
}
```

우리 집(책상 → 프로필), 공방(작업대 → 프로젝트 목록)도 전부 같은 존+모달 구조의 인스턴스일 뿐이다. 구조를 한 번 잡아두니 방 하나 추가가 30분 일이 됐다.

---

## 정리

| 항목 | 방법 | 핵심 |
|------|------|------|
| 씬 관리 | GameWorld 인터페이스 + 팩토리 | 루프 코드는 씬 개수와 무관 |
| 페이드 | HTML div + CSS transition | 셰이더 불필요, 380ms×2 시퀀스 |
| 왕복 루프 방지 | 출구 스폰을 입구 트리거 밖에 | 씬 전환 필수 체크리스트 |
| 데이터 연동 | 서버 컴포넌트 → props | 별도 API 없음, 기존 파이프라인 재사용 |
| 태그 분류 | 비교 시점 정규화 | 기존 포스트 무수정 |
| UI | Three.js는 월드, React는 모달 | 키 입력 충돌은 pressed.clear()로 |

여기까지가 계획했던 기능의 끝이었다. 그런데 만들고 나니 마을이 좀 조용했다. 방문자가 흔적을 남길 수 있으면 어떨까? 다음 편은 계획에 없던 이스터에그 — **글을 쓰면 잔디밭에 나무가 자라는 방명록** 이야기다.
