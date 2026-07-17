---
title: 'AI가 만든 로고를 진짜 파비콘으로 — Next.js 파비콘 제작기'
date: '2026-07-02'
publish_date: '2026-07-18'
description: AI가 생성한 로고 이미지를 16/32px 검증부터 favicon.ico 직접 빌드, 색 통일까지 거쳐 Next.js 앱의 진짜 파비콘으로 만든 기록
tags:
  - Next.js
  - sharp
  - favicon
  - Node.js
---

MatchDa라는 서비스의 브랜드 톤을 초록색으로 통일해 왔는데, 정작 브라우저 탭에 뜨는 파비콘은 옛날 그대로 **검정 배경에 "MD"** 글자였습니다. 앱은 초록인데 탭 아이콘만 까맣게 튀니까 어색하죠.

마침 AI(ChatGPT/Gemini)로 로고 후보를 여러 개 뽑아둔 게 있어서, 그중 하나를 골라 **진짜 파비콘/앱 아이콘으로 만드는** 작업을 했습니다. "이미지 하나 넣으면 끝 아니야?" 싶지만, 막상 해보면 챙길 게 은근히 많습니다. 오늘은 그 과정을 정리합니다.

## 사전 지식 — Next.js App Router의 파비콘 규칙

Next.js(App Router)는 `src/app/` 아래 **약속된 파일 이름**을 자동으로 파비콘 메타태그로 만들어줍니다. 코드로 `<link rel="icon">`을 쓸 필요가 없어요.

| 파일 | 용도 |
|---|---|
| `src/app/favicon.ico` | 클래식 파비콘(구형 브라우저 포함) |
| `src/app/icon.svg` (또는 `icon.png`) | 모던 브라우저 파비콘 |
| `src/app/apple-icon.png` | iOS 홈 화면 아이콘(보통 180×180) |

즉 내가 할 일은 **이 세 파일을 잘 만들어서 넣는 것**입니다.

## Step 1. 후보를 고르기 전에, 16px로 줄여보기

가장 중요한 교훈부터. 파비콘은 **결국 16×16, 32×32로 보입니다.** 큰 화면에서 멋있어도 작게 줄이면 뭉개지는 디자인이 많아요. 그래서 후보를 고를 때 **말로 추측하지 말고 실제로 줄여서 봐야** 합니다.

맥이라면 `sips`(기본 내장)로 즉석에서 줄일 수 있습니다.

```bash
sips -s format png -z 16 16 "logo.png" --out fav16.png
sips -s format png -z 32 32 "logo.png" --out fav32.png
```

저는 8개 후보를 이렇게 줄여서 하나씩 확인했습니다. 결과는 의외였어요 — 화려한 "네트워크 연결선 M"은 얇은 선이 16px에서 다 뭉개졌고, 오히려 **두 사람이 악수하며 M을 이루는 마크**가 작게 줄이면 "초록 타일 + 흰 M"으로 깔끔하게 단순화됐습니다. **작아지면 사라지는 디테일**과 **끝까지 남는 실루엣**을 구분하는 게 핵심이더군요.

> 참고: 기존 파비콘과 로고는 **작업 전에 백업**해뒀습니다. 아이콘 교체는 되돌리고 싶어질 때가 많거든요.

## Step 2. SVG 마크를 PNG로 굽기 — sharp

고른 마크를 깨끗한 **SVG**로 준비한 뒤(벡터라 무한 확대 OK), 필요한 크기의 PNG로 래스터화합니다. Node 환경이면 `sharp`가 SVG 입력을 지원해서 편합니다.

```js
const sharp = require('sharp')
const fs = require('fs')

const svg = fs.readFileSync('icon.svg')
for (const size of [512, 180, 48, 32, 16]) {
  await sharp(svg).resize(size, size).png().toFile(`icon-${size}.png`)
}
```

`apple-icon.png`는 이 중 180px를 그대로 쓰면 됩니다.

## Step 3. favicon.ico는 직접 빌드해야 한다

여기서 벽을 만났습니다. **`sharp`도 `sips`도 `.ico`를 출력하지 못합니다.** ImageMagick이 있으면 편하지만 없을 수도 있죠. 그래서 ICO 파일을 **직접 조립**했습니다.

ICO 포맷은 생각보다 단순합니다.

```
[ICONDIR 6바이트]  예약(2)=0, 타입(2)=1, 이미지 수(2)=N
[ICONDIRENTRY 16바이트 × N]  각 이미지의 크기/오프셋 정보
[이미지 데이터 …]  PNG를 그대로 넣어도 됨(모던 브라우저 지원)
```

핵심은 **PNG를 그대로 페이로드로 넣을 수 있다**는 것. 그래서 16/32/48 PNG를 만들어 이어붙이면 됩니다.

```js
function buildIco(entries) {           // entries: [{size, data(PNG buffer)}]
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)           // reserved
  header.writeUInt16LE(1, 2)           // type: icon
  header.writeUInt16LE(count, 4)       // count

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  entries.forEach((e, i) => {
    const b = i * 16
    dir.writeUInt8(e.size, b)          // width  (256이면 0)
    dir.writeUInt8(e.size, b + 1)      // height
    dir.writeUInt16LE(1, b + 4)        // planes
    dir.writeUInt16LE(32, b + 6)       // bpp
    dir.writeUInt32LE(e.data.length, b + 8)  // 바이트 수
    dir.writeUInt32LE(offset, b + 12)        // 오프셋
    offset += e.data.length
  })
  return Buffer.concat([header, dir, ...entries.map(e => e.data)])
}
```

만든 뒤엔 헤더를 다시 읽어 **검증**했습니다. (이런 바이너리는 꼭 되읽어 확인하는 게 안전해요.)

```js
const b = fs.readFileSync('favicon.ico')
console.log(b.readUInt16LE(2), b.readUInt16LE(4)) // 1(type), 3(count)
```

## Step 4. AI 이미지를 그대로 쓰기 — 여백 잘라내고 모서리 다듬기

"디자인을 이 이미지 그대로 써줘"라는 요청이 있으면, AI가 뱉은 PNG를 소스로 삼아야 합니다. 그런데 그 이미지엔 보통 **흰 여백**이 둘러져 있고, 타일 모서리도 제각각이죠. `sharp`로 정리할 수 있습니다.

```js
// 1) 바깥 흰 여백 자동 트림 → 타일 경계까지
const trimmed = await sharp(SRC).trim({ threshold: 20 }).toBuffer()

// 2) 정사각 리사이즈
const base = await sharp(trimmed).resize(512, 512, { fit: 'fill' }).png().toBuffer()

// 3) 둥근 사각 마스크로 모서리를 투명하게 (dest-in 합성)
const mask = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">' +
  '<rect width="512" height="512" rx="96" fill="#fff"/></svg>'
)
const rounded = await sharp(base)
  .composite([{ input: mask, blend: 'dest-in' }])   // 마스크가 불투명한 곳만 남김
  .png().toBuffer()
```

`blend: 'dest-in'`이 포인트입니다. 마스크(흰 둥근 사각형)가 **불투명한 영역만 남기고** 나머지는 투명하게 잘라내서, 모서리가 깔끔하게 둥글어집니다.

## Step 5. 인앱 로고도 같은 마크로 — currentColor 활용

탭 아이콘만 바꾸면 앱 안의 로고(사이드바·헤더)와 또 따로 놀죠. 인앱 로고도 같은 마크로 교체했습니다. 인라인 SVG를 컴포넌트로 만들 때, 색을 `currentColor`로 두면 **CSS `text-*` 클래스로 색을 물려받아** 재사용이 편합니다.

```tsx
export function HandshakeMark({ size = 18, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" {...p}>
      <g fill="currentColor">{/* 머리·몸통·손 */}</g>
      <g stroke="currentColor" strokeWidth="18" strokeLinecap="round">{/* 팔 */}</g>
    </svg>
  )
}
// 초록 타일 안에서:  <HandshakeMark className="text-white" />
```

## Step 6. 색이 미묘하게 다를 때 — 안티앨리어싱 보존 리컬러

마지막 함정. 파비콘은 AI 이미지의 초록(`#035647`)인데, 앱 UI 브랜드색은 `#046C4E`였습니다. 미묘하게 다른 두 초록이 공존하니 거슬리죠. 타일 색만 `#046C4E`로 바꾸고 싶은데, 단순히 "초록 픽셀을 다른 초록으로 치환"하면 **흰 마크와 초록 타일 사이의 경계(안티앨리어싱)** 가 계단처럼 깨집니다.

그래서 **흰색↔초록 축을 따라 선형 보간**했습니다. 각 픽셀이 얼마나 흰지(`t`)를 추정해서, 초록 끝점만 새 초록으로 바꾸는 방식입니다.

```js
const G1 = [4, 108, 78]   // #046C4E 목표
const TMIN = 3            // 원본 타일 최소 채널(#035647의 R) → t=0 기준

for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] === 0) continue                 // 투명 유지
  // 흰색도 t: 픽셀이 흰색(마크)이면 1, 타일 초록이면 0
  let t = (Math.min(data[i], data[i+1], data[i+2]) - TMIN) / (255 - TMIN)
  t = Math.max(0, Math.min(1, t))
  // white(255)과 G1 사이를 t로 보간 → 마크는 흰색 유지, 타일만 새 초록
  data[i]   = Math.round(t * 255 + (1 - t) * G1[0])
  data[i+1] = Math.round(t * 255 + (1 - t) * G1[1])
  data[i+2] = Math.round(t * 255 + (1 - t) * G1[2])
}
```

`t = min(R,G,B)`를 흰색도로 쓴 게 트릭입니다. 흰색은 세 채널이 다 크니 `min`도 크고(`t≈1`), 어두운 초록은 `min`이 작죠(`t≈0`). 경계의 반투명 픽셀은 그 사이 값이라 **부드럽게 이어집니다.** 결과 타일색은 정확히 `#046c4e`가 나왔습니다.

## 트러블슈팅

- **`.ico`를 못 만든다** → sharp/sips는 ICO 미지원. PNG를 페이로드로 넣어 ICO를 직접 조립.
- **AI 이미지에 흰 여백이 있다** → `sharp().trim()`으로 자르고, 둥근 마스크(`dest-in`)로 모서리 정리.
- **탭 아이콘이 안 바뀐다** → 브라우저 **파비콘 캐시가 굉장히 끈질깁니다.** 배포했는데 그대로면 강력 새로고침/캐시 삭제, 혹은 시크릿 창으로 확인하세요. 코드가 틀린 게 아닐 확률이 높습니다.
- **색이 미묘하게 다르다** → 단순 치환 대신 흰색↔브랜드색 축 선형 리맵으로 AA 보존.

## 정리

AI 로고 → 진짜 파비콘, 한눈에 보는 흐름.

1. **후보는 16/32px로 줄여서 고른다** (작게 남는 실루엣이 진짜 승부처)
2. Next.js는 `src/app/`의 `favicon.ico`·`icon.svg`·`apple-icon.png`를 자동 인식
3. **sharp로 SVG→PNG**, 크기별로 굽기
4. **favicon.ico는 직접 빌드**(헤더+엔트리+PNG 페이로드)
5. AI 이미지를 쓸 땐 **trim + 둥근 마스크**로 정리
6. 색 통일은 **AA 보존 선형 리맵**으로
7. 안 바뀌면 십중팔구 **브라우저 캐시**

"이미지 하나 넣으면 끝"인 줄 알았던 파비콘이, 알고 보니 축소 검증·바이너리 포맷·색 보정까지 꽤 촘촘한 작업이었습니다. 덕분에 탭부터 홈 화면, 앱 안 로고까지 같은 초록 마크로 딱 맞아떨어졌네요.
