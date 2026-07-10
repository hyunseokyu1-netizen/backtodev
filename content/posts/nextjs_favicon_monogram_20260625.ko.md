---
title: 'Next.js App Router 파비콘 제대로 만들기: SVG 모노그램부터 285KB .ico를 2KB로 줄이기까지'
date: '2026-06-25'
publish_date: '2026-07-16'
description: 기본 Next.js 파비콘을 브랜드 모노그램으로 교체하며 겪은 App Router 아이콘 규약, sharp 렌더링, png-to-ico 용량 함정과 직접 ICO 인코딩 해결기
tags:
  - Next.js
  - 파비콘
  - sharp
  - SVG
  - 브랜딩
---

서비스 이름을 `MatchDa`로 바꾸고 나니, 브라우저 탭에 여전히 **Next.js 기본 파비콘**(까만 N 모양 동그라미)이 떠 있는 게 거슬렸다. 사소해 보여도, 탭이 여러 개 열려 있을 때 내 서비스를 못 알아보는 건 꽤 큰 손해다. 그래서 "MD" 모노그램(Match + Da의 머리글자) 파비콘을 만들기로 했다.

"파비콘 하나 만드는 게 뭐 대수냐" 싶었는데, 막상 제대로 하려니 알아야 할 게 꽤 있었다. **Next.js App Router의 아이콘 규약**, **SVG를 PNG로 굽는 법**, 그리고 **흔히 쓰는 도구(png-to-ico)가 만들어준 285KB짜리 파비콘을 2KB로 줄이는 법**까지. 이 글은 그 과정을 정리한 기록이다.

## Step 1. Next.js App Router의 아이콘 규약부터 알자

옛날엔 `<head>`에 `<link rel="icon">`을 직접 넣었다. 하지만 Next.js App Router(13+)는 **파일만 특정 위치에 두면 자동으로 인식**한다. `app/` 폴더에 아래 파일을 두면 끝이다.

| 파일 | 역할 | 비고 |
|------|------|------|
| `app/icon.svg` | 모던 브라우저용 파비콘 | 벡터라 모든 크기에서 선명 |
| `app/favicon.ico` | 레거시 폴백 | `/favicon.ico`로 서빙 |
| `app/apple-icon.png` | iOS 홈 화면 아이콘 | 보통 180×180 |

Next.js가 알아서 `<link rel="icon" type="image/svg+xml">`, `<link rel="apple-touch-icon">` 같은 태그를 `<head>`에 꽂아준다. 빌드하면 이렇게 라우트가 잡힌 게 보인다.

```
├ ○ /apple-icon.png
├ ○ /icon.svg
```

> 핵심: **모던 브라우저는 `icon.svg`를 우선 사용**한다. 그래서 SVG만 잘 만들면 사실상 대부분 해결된다. `.ico`는 구형 브라우저·일부 폴백용일 뿐이다.

## Step 2. MD 모노그램을 SVG로 디자인하기

SVG 파비콘의 장점은 **벡터라 16px이든 512px이든 깨지지 않는다**는 것. 디자인은 단순하게 갔다. 다크 라운드 사각형(헤더 버튼과 같은 `zinc-900`) 위에 흰색 "MD".

```svg
<!-- src/app/icon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#18181b"/>
  <text x="32" y="33" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        font-size="29" font-weight="800" letter-spacing="-1.5" fill="#ffffff">MD</text>
</svg>
```

포인트 몇 개:
- `text-anchor="middle"` + `dominant-baseline="central"`로 텍스트를 정중앙에 배치
- `font-weight="800"`(아주 굵게)와 `letter-spacing="-1.5"`로 작은 크기에서도 "MD"가 또렷하게
- 배경 `#18181b`는 Tailwind의 `zinc-900` — 헤더·버튼과 톤을 맞춰 브랜드 통일감

여기까지면 모던 브라우저 파비콘은 끝이다. 문제는 `.ico`와 `apple-icon.png`처럼 **래스터(PNG) 이미지**가 필요한 부분이었다.

## Step 3. sharp로 SVG를 PNG로 굽기 (그리고 텍스트가 사라지는 함정)

Node 환경이라 이미지 변환은 `sharp`로 했다(Next.js가 의존성으로 이미 갖고 있는 경우가 많다). SVG를 PNG로 굽는 건 간단하다.

```js
const sharp = require('sharp')
const svg = require('fs').readFileSync('src/app/icon.svg')

// density를 높여 렌더링 후 다운스케일 → 작은 크기에서도 선명
await sharp(svg, { density: 512 }).resize(180, 180).png().toFile('apple-icon.png')
```

그런데 여기 **함정**이 있다. `sharp`(내부적으로 librsvg/resvg)는 `<text>`를 렌더링할 때 **시스템에 폰트가 없으면 글자를 그냥 비워버린다.** 배경 사각형만 나오고 "MD"가 사라지는 것이다. 환경마다 다르게 동작하니 **반드시 결과 PNG를 눈으로 확인**해야 한다.

나는 256px PNG를 하나 구워서 직접 열어봤다. 다행히 내 맥에는 폰트가 있어서 "MD"가 또렷하게 렌더링됐다. 만약 글자가 비어 나왔다면, `<text>` 대신 **글자를 벡터 path로 그린 SVG**를 써야 한다(폰트 의존성이 사라져 어디서든 동일하게 렌더링됨).

## Step 4. png-to-ico가 만든 285KB 파비콘 (그리고 직접 인코딩으로 2KB)

`.ico`를 만들려고 `png-to-ico`라는 인기 패키지를 npx로 돌렸다.

```bash
npx png-to-ico md-16.png md-32.png md-48.png > favicon.ico
```

결과 파일을 보고 깜짝 놀랐다.

```
favicon.ico ... 285,478 bytes  (≈ 278KB!)
```

16·32·48 PNG를 합쳐도 2KB 남짓일 텐데, 파비콘이 **278KB**라니. 헤더를 까보니 원인이 나왔다. `png-to-ico`는 **입력과 무관하게 256×256까지 항상 포함**시킨다. 그리고 작은 아이콘들을 PNG가 아니라 **무압축 BMP**로 저장한다. 256×256 32비트 BMP 하나가 `256 × 256 × 4 = 262,144` 바이트, 즉 256KB. 이게 통째로 들어간 것이다.

파비콘은 모든 페이지에서 요청되는 자원이라 278KB는 용납하기 어렵다(게다가 모던 브라우저는 어차피 `icon.svg`를 쓴다). 그래서 **ICO 컨테이너를 직접 인코딩**하기로 했다. ICO 포맷은 의외로 단순하다.

- **6바이트 헤더**: 예약(2) + 타입(2, 아이콘=1) + 이미지 개수(2)
- **이미지당 16바이트 디렉토리 엔트리**: 너비(1) + 높이(1) + ... + 데이터 크기(4) + 오프셋(4)
- 그 뒤에 실제 이미지 데이터

그리고 ICO는 **PNG를 그대로 임베드**할 수 있다(Windows Vista 이후 지원). 무압축 BMP 대신 PNG를 넣으면 용량이 확 준다.

```js
const sharp = require('sharp'); const fs = require('fs')
const svg = fs.readFileSync('src/app/icon.svg')
const sizes = [16, 32, 48]

const pngs = []
for (const s of sizes) {
  pngs.push(await sharp(svg, { density: 512 }).resize(s, s).png({ compressionLevel: 9 }).toBuffer())
}

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)            // reserved
header.writeUInt16LE(1, 2)            // type: icon
header.writeUInt16LE(sizes.length, 4) // image count

const entries = []
let offset = 6 + 16 * sizes.length
sizes.forEach((s, i) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(s >= 256 ? 0 : s, 0)   // width  (0 == 256)
  e.writeUInt8(s >= 256 ? 0 : s, 1)   // height
  e.writeUInt16LE(1, 4)               // color planes
  e.writeUInt16LE(32, 6)              // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8)  // size of image data
  e.writeUInt32LE(offset, 12)         // offset
  offset += pngs[i].length
  entries.push(e)
})

fs.writeFileSync('src/app/favicon.ico', Buffer.concat([header, ...entries, ...pngs]))
```

결과: **2,145 바이트.** 278KB → 2KB. 130배 줄었다. 헤더(`00 00 01 00 03 00` = 아이콘 3개)도 정상이고, 브라우저에서도 잘 뜬다.

## 트러블슈팅

- **파비콘이 안 바뀐다** → 브라우저 파비콘 캐시는 유난히 끈질기다. 강력 새로고침(`Cmd+Shift+R`)으로도 안 되면 탭을 닫았다 새로 열거나, 시크릿 창에서 확인하자.
- **sharp 결과 PNG에 글자가 없다** → 폰트 미탑재 문제. `<text>` 대신 path로 그린 SVG를 쓰거나, 렌더링 환경에 폰트를 설치해야 한다.
- **`.ico`가 비정상적으로 크다** → png-to-ico처럼 256까지 무압축 BMP로 넣는 도구 때문일 수 있다. 직접 인코딩하거나, 필요한 크기만 PNG로 임베드하자.

## 정리

브랜드 파비콘 하나 만드는 전체 흐름:

1. **App Router 규약 활용**: `app/icon.svg` + `app/favicon.ico` + `app/apple-icon.png`를 두면 Next.js가 자동 연결
2. **SVG로 디자인**: 벡터라 모든 크기에서 선명. 모던 브라우저는 이것만으로 충분
3. **sharp로 PNG 굽기**: 단, `<text>`가 폰트 없으면 사라지니 결과를 눈으로 확인
4. **`.ico`는 작게**: 도구가 부풀린 파일을 그대로 쓰지 말고, 필요하면 직접 ICO 컨테이너 인코딩

가장 기억에 남는 교훈은 4번이다. **"인기 있는 도구가 만들어준 결과물도 일단 의심하고 확인하자."** 278KB짜리 파비콘을 그냥 배포했다면, 모든 방문자가 매번 그 무거운 파일을 받았을 거다. 파일 하나 까보는 5분이 그걸 막았다. 그리고 ICO처럼 "복잡해 보이는" 바이너리 포맷도, 명세를 한 번 들여다보면 의외로 직접 다룰 만하다.
