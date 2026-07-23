---
title: '[픽셀 마을 2편] 이미지 파일 없이 코드로 픽셀아트 그리기'
date: '2026-07-10'
publish_date: '2026-09-03'
description: ASCII 문자열로 스프라이트를 정의하고 캔버스에 그려 Three.js 텍스처로 쓰는 방법. NearestFilter, 3×5 픽셀 폰트, Y-소팅까지
tags:
  - ThreeJS
  - Canvas
  - 픽셀아트
  - 픽셀마을
  - 사이드프로젝트
---

[1편](/ko/posts/pixel_village_01_threejs_setup_20260710)에서 빨간 네모가 돌아다니는 뼈대를 만들었다. 이번엔 눈에 보이는 걸 만들 차례다. 집, 도서관, 공방, 나무, 캐릭터, 그리고 간판까지.

문제는 나는 그림을 못 그린다는 것. 에셋을 사거나 AI로 생성할 수도 있지만, 파일 관리도 귀찮고 나중에 색 하나 바꾸려면 이미지 에디터를 열어야 한다. 그래서 **스프라이트를 전부 코드로 정의**하기로 했다. 결과적으로 이 방식이 훨씬 편했다.

---

## Step 1 — ASCII 문자열이 곧 스프라이트

아이디어는 단순하다. 문자 하나 = 픽셀 하나. 문자열 배열로 그림을 그리고, 팔레트로 문자를 색에 매핑한다.

```ts
export interface SpriteDef {
  rows: string[];
  palette: Record<string, string>;
}

/** 우리 집 — 붉은 지붕 작은 집, 22×16px */
export const HOME_SPRITE: SpriteDef = {
  palette: {
    R: "#c0503f", r: "#93392e",  // 지붕 / 지붕 그림자
    W: "#ead9b0", w: "#d6c290",  // 벽 / 벽 아랫단
    D: "#8a5a33", d: "#5f3b1e",  // 문
    G: "#8fd3e8", g: "#3f3f46",  // 창문 / 창틀
  },
  rows: [
    ".....RRRRRRRRRRRR.....",
    "....RRRRRRRRRRRRRR....",
    // ... (지붕이 넓어지다가)
    "WWgGGgWWWWWWWWWWgGGgWW",
    "WWWWWWWWWdDDdWWWWWWWWW",
    // ... (벽, 창문, 문)
  ],
};
```

`.`은 투명 픽셀. 코드 에디터에서 문자열을 보면 그대로 도트 그림이 보인다. 색을 바꾸고 싶으면 팔레트 hex만 수정하면 되고, git diff에도 "지붕 3픽셀 수정"이 그대로 드러난다.

이걸 캔버스에 1:1로 찍으면 텍스처가 된다.

```ts
export function createSpriteTexture(def: SpriteDef) {
  const pxHeight = def.rows.length;
  const pxWidth = Math.max(...def.rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = pxWidth;
  canvas.height = pxHeight;
  const ctx = canvas.getContext("2d")!;
  def.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = def.palette[row[x]];
      if (!color) continue; // 팔레트에 없는 문자 = 투명
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return new THREE.CanvasTexture(canvas);
}
```

캔버스 크기가 22×16 같은 초소형이라는 점에 주목. 확대는 GPU가 한다.

## Step 2 — NearestFilter: 픽셀아트의 생명줄

22px짜리 텍스처를 화면에서 수백 px로 확대하면 기본 설정에서는 **뿌옇게 블러**가 낀다. 텍스처 필터 기본값이 인접 픽셀을 부드럽게 보간하는 LinearFilter이기 때문이다. 픽셀아트는 이거 하나로 다 망가진다.

```ts
texture.magFilter = THREE.NearestFilter; // 확대 시 보간 없이 가장 가까운 픽셀
texture.minFilter = THREE.NearestFilter; // 축소 시에도
texture.colorSpace = THREE.SRGBColorSpace; // 팔레트 hex 색 그대로 나오게
```

이 두 줄이면 도트가 칼같이 각지게 나온다. 모든 텍스처 생성 함수를 하나로 모아 여기서 일괄 적용했다.

스프라이트 메시는 투명 픽셀을 잘라내는 컷아웃 방식으로 만든다.

```ts
new THREE.MeshBasicMaterial({
  map: texture,
  transparent: true,
  alphaTest: 0.5,           // 알파 0.5 미만 픽셀은 아예 그리지 않음
  side: THREE.DoubleSide,   // scale.x = -1 좌우반전 시 사라짐 방지
});
```

`alphaTest`는 뒤에 나올 Y-소팅과 직결된다. 반투명 블렌딩 대신 픽셀을 통째로 버리므로 depth buffer가 정상 동작한다. `DoubleSide`는 캐릭터 좌우반전(`scale.x = -1`) 때 backface culling으로 스프라이트가 통째로 사라지는 버그를 막는다. 실제로 당했다.

## Step 3 — 바닥: 시드 고정 난수로 잔디 깔기

40×30 유닛 맵 바닥은 스프라이트로 만들기엔 크다. 유닛당 16px짜리 큰 캔버스(640×480) 한 장에 절차적으로 그렸다. 잔디 베이스 → 노이즈 점 → 잔디 포기 → 꽃 → 흙길 → 광장 순서다.

여기서 함정 하나. `Math.random()`으로 노이즈를 찍으면 **페이지를 새로고침할 때마다 잔디 무늬가 바뀐다.** 미묘하게 세계가 흔들리는 느낌이라 신경 쓰인다. 시드 고정 난수(mulberry32)로 해결했다.

```ts
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260710); // 시드 = 오늘 날짜. 언제 봐도 같은 잔디
```

광장 타원은 `ctx.ellipse()` 대신 픽셀 단위로 타원 방정식을 검사하며 찍었다. 캔버스의 도형 API는 안티앨리어싱이 들어가서 픽셀아트 규칙이 깨지기 때문이다.

마지막으로 광장 아래 잔디에 마을 이름을 새겼다. 깎은 잔디 느낌이 나도록 바탕보다 어두운 초록으로.

## Step 4 — 3×5 픽셀 폰트로 간판 만들기

건물마다 영어 간판(MY HOME, LIBRARY, WORKSHOP)을 달고 싶었다. 폰트 파일을 쓰면 블러 문제로 돌아가니까, **폰트도 글리프를 직접 정의**했다.

```ts
const PIXEL_FONT: Record<string, string[]> = {
  H: ["101", "101", "111", "101", "101"],
  O: ["111", "101", "101", "101", "111"],
  M: ["10001", "11011", "10101", "10001", "10001"], // M, W는 5px 가변폭
  "'": ["1", "1", "0", "0", "0"],
  // ...
};
```

높이 5px 고정, 폭은 글자마다 가변(1~5px)이다. 처음엔 전부 3px로 했더니 M과 W가 도저히 못 읽을 모양이 나와서 넓혔다. 글리프를 순서대로 캔버스에 찍고 자간 1px을 두면 텍스트가 되고, 나무판 배경을 깔면 간판이 된다. 잔디에 새긴 마을 이름도 같은 폰트를 스케일만 키워서 썼다.

필요한 글자만 정의하면 되니 부담이 없다. 지금 폰트에 있는 글자는 A~Z 중 14자 정도다.

## Step 5 — Y-소팅: 건물 뒤로 걸어가면 가려지게

탑다운 RPG의 핵심 연출. **캐릭터가 건물 북쪽(위)에 있으면 지붕에 가려지고, 남쪽(아래)에 있으면 건물 앞에 그려져야 한다.** "화면에서 아래에 있는 것일수록 나중에(위에) 그린다"는 규칙이다.

매 프레임 스프라이트를 정렬해서 그리는 방법도 있지만, Three.js에서는 더 쉬운 길이 있다. **z 좌표에 규칙을 부여하고 depth buffer에 맡기는 것.**

```ts
/** 발밑 y좌표가 남쪽일수록 카메라에 가깝게(z 크게) */
export function zForFoot(footY: number): number {
  return 1 + (MAP_HEIGHT / 2 - footY) * 0.03;
}

// 건물, 나무: 배치 시 한 번
mesh.position.set(x, y, zForFoot(footY));

// 플레이어: 움직이니까 매 프레임 갱신
player.position.z = zForFoot(player.position.y - PLAYER_H / 2);
```

기준을 스프라이트 중심이 아니라 **발밑**으로 잡는 게 포인트다. 키 큰 건물과 캐릭터가 겹칠 때 "발이 더 남쪽인 쪽이 앞"이라는 직관과 일치한다. Step 2의 `alphaTest` 컷아웃 덕분에 투명 픽셀이 depth를 오염시키지 않아서, 정렬 코드 한 줄 없이 이 공식만으로 끝난다.

1편에서 충돌 박스를 발밑만 잡은 것도 여기와 맞물린다. 건물 스프라이트의 위쪽 절반(지붕)은 충돌이 없으므로 캐릭터가 지붕 영역으로 "걸어 들어가면" 자연스럽게 가려진다.

---

## 정리

| 항목 | 방법 | 핵심 |
|------|------|------|
| 스프라이트 | ASCII 행렬 + 팔레트 | 이미지 파일 0개, git으로 도트 관리 |
| 선명도 | NearestFilter + SRGBColorSpace | 확대해도 블러 없음 |
| 투명 처리 | alphaTest 0.5 컷아웃 | depth buffer 정상 동작 |
| 바닥 | 큰 캔버스 + 시드 고정 난수 | 새로고침해도 같은 잔디 |
| 텍스트 | 자작 3×5 가변폭 픽셀 폰트 | 간판, 잔디 마을 이름 |
| 앞뒤 정렬 | 발밑 y → z 변환 (Y-소팅) | 건물 뒤로 돌아가면 가려짐 |

이제 마을이 마을처럼 보인다. 그런데 아직 건물에 들어갈 수가 없다. 다음 편에서 문을 열어준다 — 씬 전환, 페이드 효과, 그리고 도서관 책장에 실제 블로그 포스트를 꽂는 작업이다.
