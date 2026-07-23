---
title: '[픽셀 마을 4편] 방명록이 나무로 자란다 — GitHub JSON 저장소와 288가지 표정'
date: '2026-07-10'
publish_date: '2026-09-05'
description: 돌바위에 글을 쓰면 잔디밭에 표정 있는 나무가 심어지는 방명록 이스터에그. DB 없이 GitHub 커밋으로 저장하고, 스팸을 막고, 나무마다 랜덤 얼굴을 그린 과정
tags:
  - NextJS
  - GitHub
  - API
  - 픽셀마을
  - 사이드프로젝트
---

[3편](/ko/posts/pixel_village_03_scenes_data_20260710)까지 해서 픽셀 마을의 계획된 기능은 다 끝났다. 그런데 마을을 돌아다니다 보니 아쉬웠다. 방문자는 구경만 하고 간다. 흔적이 안 남는다.

그래서 이스터에그를 하나 심었다. 마을 오른쪽 아래 구석에 돌바위가 하나 있는데, 다가가면 `[SPACE] 나무 심기`가 뜬다. 닉네임과 메시지를 적고 심기를 누르면 **잔디밭 어딘가에 나무 한 그루가 자라난다.** 그 나무에 다가가면 글이 보인다. 방명록이 목록이 아니라 숲으로 쌓이는 것이다.

심고 나면 이렇게 안내한다. *"이제 본인의 나무를 찾아보세요 🌱"*

---

## Step 1 — 저장소 선택: DB 없이 GitHub 커밋으로

방명록이니까 모든 방문자가 서로의 나무를 봐야 한다. 서버 저장이 필요하다. 선택지를 비교했다.

| 방식 | 장점 | 단점 |
|------|------|------|
| localStorage | 구현 5분 | 본인 나무만 보임 — 방명록이 아님 |
| Supabase 등 DB | 실시간, 정석 | 이 블로그에 새 인프라 추가 |
| **GitHub 저장소 JSON** | 추가 인프라 0, 히스토리 자동 | 글 하나당 커밋 1개 + 재배포 |

**GitHub JSON**을 골랐다. 이 블로그는 애초에 포스트를 GitHub API로 읽고 쓰는 구조라, 이미 있는 `putFile()` 래퍼를 그대로 재사용하면 된다. `content/guestbook.json` 파일 하나에 배열로 쌓인다.

```ts
// lib/guestbook.ts
const FILE = "content/guestbook.json";
const IS_PROD = !!process.env.VERCEL;

export async function readGuestbook() {
  if (IS_PROD) {
    const file = await getFile(FILE); // GitHub Contents API
    return { entries: JSON.parse(file?.content ?? "[]"), sha: file?.sha };
  }
  // 로컬 개발은 그냥 fs
  return { entries: JSON.parse(fs.readFileSync(FILE, "utf-8")) };
}

export async function saveGuestbook(entries, sha, visitorName) {
  const json = JSON.stringify(entries, null, 2) + "\n";
  if (IS_PROD) {
    await putFile(FILE, json, `guestbook: ${visitorName}님의 나무 심기 🌳`, sha);
  } else {
    fs.writeFileSync(FILE, json);
  }
}
```

부수 효과가 재미있다. **나무 한 그루가 git 커밋 하나다.** 저장소 히스토리에 `guestbook: Raon님의 나무 심기 🌳` 같은 커밋이 쌓인다. 방명록이 곧 커밋 로그다.

물론 트레이드오프도 있다. 글 하나마다 Vercel 재배포가 돈다. 개인 블로그 방명록 빈도에서는 전혀 문제가 안 되지만, 트래픽 있는 서비스라면 이 방식은 쓰면 안 된다.

## Step 2 — 나무 심을 자리 찾기: rejection sampling

나무 위치는 서버가 정한다. 잔디밭 아무 데나 찍되, 건물·길·광장·잔디에 새긴 마을 이름·기존 나무를 전부 피해야 한다. 복잡한 알고리즘 대신 **rejection sampling** — 랜덤으로 찍고, 금지 구역이면 다시 찍는다.

```ts
const NO_PLANT_ZONES: AABB[] = [
  { minX: -15.5, maxX: -8.5, minY: 0.4, maxY: 6.6 },  // 우리 집 + 문 앞
  { minX: -13.6, maxX: 13.6, minY: -3.4, maxY: -0.6 }, // 중앙 길
  { minX: -8.0, maxX: 8.0, minY: -8.0, maxY: -6.2 },   // 마을 이름 텍스트
  // ...
];

export function findPlantingSpot(taken: { x: number; y: number }[]) {
  for (let i = 0; i < 300; i++) {
    const x = -18 + Math.random() * 36;
    const y = -13 + Math.random() * 25.5;
    if (NO_PLANT_ZONES.some((b) => x > b.minX && x < b.maxX && y > b.minY && y < b.maxY)) continue;
    if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < 1.8)) continue; // 기존 나무와 거리
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  return null; // 300번 실패 = 숲이 가득 참
}
```

300번 시도해서 실패하면 "숲이 가득 찼어요"를 반환한다. 우아하진 않지만 맵 하나에 나무 수백 그루 규모에서는 이걸로 충분하다.

## Step 3 — 공개 API의 최소 방어선

인증 없는 공개 쓰기 API는 스팸의 놀이터가 되기 쉽다. 개인 블로그 수준의 3중 방어를 넣었다.

```ts
// ① 허니팟 — 사람 눈에 안 보이는 필드. 봇이 채우면 즉시 거절
if (body.website) return NextResponse.json({ error: "..." }, { status: 400 });

// ② 길이 제한 + 제어문자 제거
const name = sanitize(body.name, 20);      // 닉네임 20자
const message = sanitize(body.message, 200); // 메시지 200자

// ③ IP당 1분에 1회
const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
if (lastPostByIp.get(ip) > Date.now() - 60_000) {
  return NextResponse.json({ error: "나무는 1분에 한 그루만 심을 수 있어요." }, { status: 429 });
}
```

스로틀은 `Map` 기반이라 서버리스 인스턴스가 바뀌면 리셋되는 한계가 있다. 완벽한 rate limit이 필요하면 Upstash 같은 외부 스토어를 써야 하지만, "실수 연타 방지 + 단순 봇 차단" 목적으로는 이 정도로 충분하다고 판단했다. 전체 상한(500그루)도 걸어서 최악의 경우에도 저장소가 무한히 크지는 않는다.

에러 메시지도 세계관에 맞췄다. 429는 "나무는 1분에 한 그루만", 상한 초과는 "숲이 가득 찼어요. 다음 시즌을 기다려 주세요 🌲".

## Step 4 — 나무마다 다른 얼굴: 6×6×8 = 288가지

처음 심은 나무들이 다 똑같이 생겨서 심심했다. 그래서 **나무에 표정**을 넣었다. 눈은 `. > < - ^ _` 여섯 가지, 입은 `- ㅠ ㅜ = + . ⏝ ⏜` 여덟 가지. 왼눈과 오른눈을 **각각 독립적으로** 뽑아서 짝눈(`>` `<`)도 나온다. 조합은 6×6×8 = 288가지.

핵심 결정: **표정은 클라이언트가 아니라 서버가, 심는 순간 뽑아서 저장한다.**

```ts
const entry: GuestbookEntry = {
  id: `gb_${Date.now()}_...`,
  name, message, date,
  x: spot.x, y: spot.y,
  eyeL: GB_EYES[Math.floor(Math.random() * GB_EYES.length)],
  eyeR: GB_EYES[Math.floor(Math.random() * GB_EYES.length)],
  mouth: GB_MOUTHS[Math.floor(Math.random() * GB_MOUTHS.length)],
};
```

렌더링 시점에 랜덤을 돌리면 새로고침할 때마다 표정이 바뀐다. "내 나무"라는 애착이 생기려면 표정이 고정돼야 한다. 위치와 마찬가지로 표정도 그 나무의 영구 속성인 것이다.

그리는 쪽은 2편의 ASCII 스프라이트 방식 그대로다. 잎 가운데를 비워둔 나무 몸통에, 눈/입 글리프를 픽셀로 합성한다.

```ts
const EYE_GLYPHS: Record<string, string[]> = {
  ".": ["11", "11"],
  ">": ["100", "010", "100"],
  "^": ["010", "101"],
  // ...
};

// 나무 캔버스에 얼굴 찍기
drawGlyph(ctx, EYE_GLYPHS[eyeL], 4, 5, FACE_COLOR);   // 왼눈
drawGlyph(ctx, EYE_GLYPHS[eyeR], 11, 5, FACE_COLOR);  // 오른눈
drawGlyph(ctx, MOUTH_GLYPHS[mouth], 7, 8, FACE_COLOR); // 입
```

`^` `^` + `⏝`이 나오면 방실방실 웃는 나무, `>` `<` + `⏜`이면 뭔가 억울한 나무가 된다. 잔디밭에 표정이 제각각인 나무들이 늘어서 있는 걸 보면 만든 나도 웃음이 난다.

## Step 5 — 심자마자 보이게

폼 제출이 성공하면 서버가 확정한 엔트리(위치+표정 포함)를 돌려준다. 페이지를 새로고침하지 않고 **현재 씬에 바로 나무를 추가**한다.

```ts
const res = await fetch("/api/guestbook", { method: "POST", body: ... });
const { entry } = await res.json();
plantRef.current?.(entry); // 마을 씬에 메시 + 충돌 박스 + 상호작용 존 추가
```

그리고 "이제 본인의 나무를 찾아보세요 🌱" 모달을 띄운다. 어디 심어졌는지는 알려주지 않는다. 직접 돌아다니며 찾는 게 이 이스터에그의 핵심 재미다.

배포하고 얼마 지나지 않아 저장소에 낯선 커밋이 하나 올라왔다. `guestbook: Raon님의 나무 심기 🌳`. 첫 방문자의 나무가 실제로 심어진 것이다. 이 커밋 알림이 뜨는 순간이 이번 프로젝트에서 제일 즐거웠다.

---

## 정리

| 항목 | 선택 | 이유 |
|------|------|------|
| 저장소 | GitHub 저장소 JSON 파일 | 추가 인프라 0, 기존 래퍼 재사용, 커밋 = 방명록 로그 |
| 위치 결정 | 서버 rejection sampling | 금지 구역 회피, 나무 간 최소 거리 |
| 스팸 방어 | 허니팟 + 길이 제한 + IP 스로틀 + 총량 상한 | 공개 쓰기 API 최소 방어선 |
| 표정 | 서버가 심는 순간 추첨 후 저장 | 새로고침해도 고정, 눈 좌우 독립 288조합 |
| UX | 위치 비공개 + "나무를 찾아보세요" | 탐색 자체가 보상 |

이렇게 픽셀 마을 시리즈 끝. 하루 동안 Three.js 첫 셋업부터 방명록 숲까지 왔다. 완성된 마을은 [backtodev.com/ko/village](https://backtodev.com/ko/village)에 있다. 놀러 와서 나무 한 그루 심고 가시길 — 표정은 복불복이다.
