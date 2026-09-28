---
title: '카톡 링크 미리보기를 링크마다 다르게 — 정적 사이트에서 OG 태그 동적으로 주입하기'
date: '2026-08-07'
publish_date: '2026-10-18'
description: 공유 링크 미리보기 제목이 전부 똑같이 뜨는 문제를 Cloudflare Pages Functions와 HTMLRewriter로 해결하고, 카카오톡 캐시라는 복병까지 만난 기록
tags:
  - Cloudflare Pages
  - HTMLRewriter
  - OpenGraph
  - 카카오톡
  - Pillow
---

## 링크를 보냈는데 전부 똑같이 뜬다

카세트 테이프 앱에 "테이프를 링크로 공유하기" 기능이 있다. 내가 만든 믹스테이프를 링크 하나로 보내면, 받는 사람이 앱 없이도 웹에서 곡 목록을 미리 볼 수 있다.

문제는 그 링크를 카톡에 붙였을 때였다. 어떤 테이프를 보내든 미리보기가 항상 이랬다.

```
믹스테이프 — 테이프 공유
You received a mixtape. Play it in the app...
repotape.pages.dev
```

「사랑노래」를 보내든 「운동할 때 듣는 노래」를 보내든 똑같은 제목. 받는 사람 입장에서는 뭘 받은 건지 열어보기 전엔 모른다. 선물로 테이프를 보낸다는 컨셉인데 포장지에 아무것도 안 적혀 있는 셈이다.

원하는 건 명확했다.

```
Mix Tape - 사랑노래forYou
Side A 7곡 · Side B 7곡 — 📼 믹스테이프를 선물받았습니다.
[테이프 색상이 반영된 이미지]
```

## 왜 자바스크립트로는 안 되나

공유 링크는 이런 형태다. 테이프 이름이 URL 파라미터에 들어 있다.

```
https://repotape.pages.dev/?n=사랑노래forYou&a=DokABcA8Iy8,9ipBvDc-kIs&b=wTe1ljdLt1E&c=E0705F
```

`n`은 테이프 이름, `a`/`b`는 A면/B면 유튜브 영상 ID, `c`는 테이프 색상이다. 페이지는 이 값을 자바스크립트로 읽어서 곡 목록을 그린다.

그러면 같은 방식으로 제목도 바꾸면 되지 않을까? 처음엔 이렇게 했다.

```javascript
document.title = `Mix Tape - ${name}`;
document.querySelector('meta[property="og:title"]')
        .setAttribute('content', `Mix Tape - ${name}`);
```

브라우저로 열면 잘 바뀐다. 그런데 카톡 미리보기는 여전히 그대로였다.

이유는 단순하다. **링크 미리보기 크롤러는 자바스크립트를 실행하지 않는다.** 카카오톡, 페이스북, 슬랙, 트위터 전부 마찬가지다. 이들은 URL로 HTTP 요청을 보내서 돌아온 **HTML 원문만 읽는다.** `<head>` 안의 `og:` 메타태그를 파싱해서 끝. DOM을 만들지도, 스크립트를 돌리지도 않는다.

그래서 자바스크립트로 아무리 바꿔봐야 크롤러에게는 안 보인다. **서버가 응답하는 HTML 자체가 링크마다 달라야 한다.**

## 그런데 이건 정적 사이트인데

내 공유 페이지는 `index.html` 파일 하나다. 서버가 없다. Cloudflare Pages에 정적 파일로 올려둔 게 전부다.

서버 없이 응답 HTML을 링크마다 다르게 만들려면 방법이 몇 가지 있다.

| 방법 | 장점 | 단점 |
|---|---|---|
| 테이프마다 HTML 파일 생성 | 순수 정적 | 테이프가 무한히 생기므로 불가능 |
| Next.js 등으로 SSR 전환 | 정석 | 페이지 하나 때문에 프레임워크 도입은 과함 |
| **엣지 함수로 응답 가로채기** | 정적 파일 유지 + 서버 로직 | 플랫폼 종속 |

세 번째를 골랐다. Cloudflare Pages에는 **Pages Functions**라는 게 있어서, 정적 파일을 그대로 두면서 요청/응답 사이에 코드를 끼워넣을 수 있다.

## Step 1. `_middleware.js` 만들기

배포 폴더에 `functions/` 디렉토리를 만들고 `_middleware.js`를 넣으면, 그 사이트로 오는 **모든 요청**이 이 파일을 거친다.

```
repotape_web/
├── index.html
└── functions/
    └── _middleware.js
```

기본 구조는 이렇다.

```javascript
export async function onRequest({ request, next }) {
  const response = await next();   // 원래 응답(정적 index.html)을 먼저 받고
  return response;                  // 가공해서 돌려준다
}
```

`next()`가 원래대로라면 브라우저에 갔을 응답이다. 이걸 받아서 손을 본 뒤 반환하면 된다.

## Step 2. HTMLRewriter로 메타태그 갈아끼우기

응답 HTML을 문자열로 받아서 정규식으로 치환할 수도 있지만, Cloudflare Workers에는 **HTMLRewriter**라는 전용 API가 있다. 스트리밍으로 HTML을 파싱하면서 CSS 선택자로 요소를 잡아 수정한다. 전체를 메모리에 올리지 않아서 빠르다.

```javascript
export async function onRequest({ request, next }) {
  const response = await next();

  // HTML 문서가 아니면 그대로 통과 (이미지·JS 등)
  if (!(response.headers.get('content-type') || '').includes('text/html')) {
    return response;
  }

  const url = new URL(request.url);
  const name = url.searchParams.get('n');
  if (!name) return response;   // 이름 없는 링크는 기본 문구 유지

  const title = `Mix Tape - ${name}`;

  return new HTMLRewriter()
    .on('title', {
      element(el) { el.setInnerContent(title); },
    })
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute('content', title); },
    })
    .transform(response);
}
```

`.on(선택자, 핸들러)` 형태로 원하는 만큼 붙일 수 있다. 곡 수도 미리보기에 넣고 싶어서 파라미터를 세서 `og:description`도 바꿨다.

```javascript
/// 'a=id,id&b=id' → 면별 곡 수. 빈 값이면 0.
function countSide(params, key) {
  const raw = params.get(key);
  if (!raw) return 0;
  return raw.split(',').filter((v) => v.trim() !== '').length;
}

const a = countSide(params, 'a');
const b = countSide(params, 'b');

// 곡이 하나도 없는 링크는 곡 수를 내세우지 않고 기본 설명을 그대로 둔다
if (a + b > 0) {
  const description = `Side A ${a}곡 · Side B ${b}곡 — 📼 믹스테이프를 선물받았습니다.`;
  rewriter.on('meta[property="og:description"]', {
    element(el) { el.setAttribute('content', description); },
  });
}
```

## Step 3. 사용자 입력을 메타태그에 넣을 때 조심할 것

여기서 한 번 멈췄다. 테이프 이름은 **사용자가 직접 입력한 값**이다. 그걸 그대로 HTML 속성에 넣는다는 건 인젝션 위험이 있다는 뜻이다.

테스트로 이런 이름을 넣어봤다.

```
?n="><script>alert(1)</script>
```

응답을 확인하니:

```html
<title>Mix Tape - "&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>
<meta property="og:title" content="Mix Tape - &quot;><script>alert(1)</script>">
```

`<title>` 안은 완전히 이스케이프됐다. `meta` 속성은 큰따옴표(`"` → `&quot;`)만 이스케이프되고 꺾쇠는 그대로 남았다. HTMLRewriter가 **속성값에 필요한 만큼만** 이스케이프하기 때문이다.

이게 위험한가? 결론은 **안전하다.** HTML5 파싱 규칙상 큰따옴표로 감싼 속성값 안에서는 `<`가 태그 시작으로 해석되지 않는다. 속성을 빠져나가려면 `"`가 필요한데 그건 이스케이프됐다.

다만 링크 미리보기 크롤러는 표준 브라우저 파서를 쓴다는 보장이 없다. 자체 파서로 대충 긁는 곳도 있다. 그래서 방어적으로 꺾쇠와 제어문자를 미리 걷어냈다.

```javascript
/// HTMLRewriter가 따옴표를 이스케이프하므로 속성 탈출은 불가능하지만,
/// 링크 미리보기 크롤러마다 HTML 파서가 제각각이라 꺾쇠는 미리 걷어낸다.
/// 개행·탭 등 제어문자는 공백으로 — 미리보기 한 줄 표시가 깨지지 않게.
function sanitize(s) {
  let out = '';
  for (const ch of s) {
    if (ch === '<' || ch === '>') continue;
    const code = ch.codePointAt(0);
    out += code < 0x20 || code === 0x7f ? ' ' : ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/// 미리보기에서 잘리지 않을 정도로만 제한 (넘치면 말줄임)
function clip(s, max) {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
```

여담인데 처음엔 제어문자 제거를 정규식 `/[\x00-\x1F]/g`로 쓰려다가, 편집 과정에서 이스케이프 시퀀스가 아니라 **실제 NUL 바이트가 파일에 박히는** 사고가 났다. `od -c`로 보니 이랬다.

```
r e p l a c e ( / [ \ r \ n \ t \0 - 037 ] / g ,
```

동작은 하지만 소스로는 최악이다. 코드포인트 비교로 바꿔서 정규식 자체를 피했다. 제어문자를 다룰 땐 이런 함정이 있다.

## Step 4. og:image를 테이프 색상별로

제목이 되니 이미지도 넣고 싶어졌다. 미리보기에 이미지가 없으면 회색 상자만 나온다.

테이프마다 셸 색상이 다르니 이미지도 색상을 반영하면 좋겠는데, 문제는 **이미지를 어떻게 만드느냐**다.

| 방식 | 판단 |
|---|---|
| 런타임에 PNG 생성 (`workers-og` 등) | wasm 번들이 크고 CPU 시간 제한이 걸림 |
| SVG를 og:image로 | 대부분의 크롤러가 SVG를 지원 안 함 |
| **색상별 정적 PNG 미리 생성** | 앱 팔레트가 고정 7색이라 가능 |

앱 코드를 확인하니 셸 색상이 고정 팔레트였다.

```dart
static const tapePaletteHex = [
  'FF9A44', // 오렌지
  'E0705F', // 레드
  '44DE80', // 그린
  '4AC8E0', // 시안
  '5B79C9', // 블루
  'B48EE0', // 퍼플
  'C9A227', // 골드
];
```

7색 + 색상 없음(기본 다크 셸) = 8장만 만들면 끝이다. 런타임 생성이 필요 없다.

Python의 Pillow로 1200×630 카세트 그림을 그렸다.

```python
def draw_cassette(shell_hex):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    shell = hex_rgb(shell_hex)

    # 은은한 배경 발광 — 셸 색을 아주 어둡게 깔아 카세트가 떠 보이게
    d.rounded_rectangle([150, 62, 1050, 545], radius=48, fill=shade(shell, 0.13))

    # 카세트 본체
    d.rounded_rectangle([230, 105, 970, 525], radius=30, fill=shell)
    d.rounded_rectangle([230, 105, 970, 525], radius=30,
                        outline=shade(shell, 0.72), width=4)

    # 상단 라벨 (크림) + 필기 줄무늬
    d.rounded_rectangle([272, 145, 928, 320], radius=12, fill=LABEL)
    for i, y in enumerate((196, 236, 276)):
        right = 880 - i * 90        # 아래로 갈수록 짧아지는 줄
        d.rounded_rectangle([300, y, right, y + 9], radius=4, fill=(206, 196, 178))
    ...
```

`shade()`로 같은 색을 밝게/어둡게 만들어 테두리와 배경 발광에 쓰면, 색상 하나만 바꿔도 전체가 조화롭게 나온다. 8장 만드는 데 1초도 안 걸리고 장당 8KB다.

이제 미들웨어에서 색상에 맞는 이미지를 골라준다.

```javascript
const SHELL_COLORS = new Set([
  'FF9A44', 'E0705F', '44DE80', '4AC8E0', '5B79C9', 'B48EE0', 'C9A227',
]);

// 팔레트 밖 값이면 index.html의 기본 이미지를 그대로 둔다
const color = (params.get('c') || '').toUpperCase();
if (SHELL_COLORS.has(color)) {
  const image = `${url.origin}/og/tape-${color}.png`;
  rewriter.on('meta[property="og:image"]', {
    element(el) { el.setAttribute('content', image); },
  });
}
```

`url.origin`을 쓰면 프리뷰 배포든 커스텀 도메인이든 알아서 맞는 절대 URL이 된다. og:image는 상대경로를 못 읽는 크롤러가 있어서 절대 URL이 안전하다.

`index.html`에는 기본값을 넣어둬서, 미들웨어가 없어도 이미지가 하나는 뜨게 했다.

```html
<meta property="og:image" content="https://repotape.pages.dev/og/tape-default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

`og:image:width/height`를 명시하면 크롤러가 이미지를 내려받기 전에 레이아웃을 잡을 수 있어 미리보기가 더 빨리 뜬다.

## 검증 — 브라우저 말고 크롤러로 확인해야 한다

브라우저로 열어보는 건 검증이 안 된다. 자바스크립트가 돌기 때문이다. **크롤러가 보는 것**을 봐야 한다. `curl`에 User-Agent를 씌우면 된다.

```bash
curl -s -A "facebookexternalhit/1.1 kakaotalk-scrap/1.0" \
  "https://repotape.pages.dev/?n=사랑노래forYou&a=x,y&b=z&c=E0705F" \
  | grep -E 'og:|twitter:'
```

```html
<meta property="og:title" content="Mix Tape - 사랑노래forYou">
<meta property="og:description" content="Side A 2곡 · Side B 1곡 — 📼 믹스테이프를 선물받았습니다.">
<meta property="og:image" content="https://repotape.pages.dev/og/tape-E0705F.png">
<meta property="og:image:width" content="1200">
<meta name="twitter:card" content="summary_large_image">
```

엣지 케이스도 같이 확인했다.

| 입력 | 결과 |
|---|---|
| 정상 이름 | `Mix Tape - 사랑노래forYou` |
| `"><script>` 포함 | 꺾쇠 제거 + 따옴표 이스케이프 |
| 개행·탭 포함 | 공백 하나로 정규화 |
| 60자 초과 | 59자 + `…` |
| 팔레트 밖 색상 | 기본 이미지로 폴백 |
| 이름 없이 루트 방문 | 기존 기본 문구 유지 |

## 복병: 카카오톡 캐시

배포하고 서버 응답까지 확인했는데, 카톡에 링크를 보내니 **여전히 옛날 미리보기**가 떴다. 그것도 링크마다 다르게.

- 어떤 링크: `Cassette Player — 믹스테이프 공유` (앱 이름 바꾸기 **전** 값)
- 어떤 링크: `믹스테이프 — 테이프 공유` (이름은 바꿨지만 OG 작업 **전** 값)

서버를 다시 확인하니 두 링크 모두 새 값을 정확히 반환하고 있었다. 즉 **카카오톡이 URL별로 미리보기를 캐시**하고 있었던 것이다. 각 URL을 처음 공유한 시점의 OG가 그대로 박혀 있었다.

페이스북은 Sharing Debugger에서 캐시를 지울 수 있지만, **카카오톡은 그런 공개 도구가 없다.** 캐시가 만료되기를 기다리는 수밖에 없다.

다행히 실무상 큰 문제는 아니었다.

- **새로 공유하는 링크는 정상** — 테이프가 다르면 URL도 다르니 캐시가 없어 새로 크롤링한다
- 캐시가 낀 건 테스트하느라 반복해서 보낸 URL 몇 개뿐

당장 확인하고 싶으면 URL 뒤에 아무 파라미터나 붙이면 된다.

```
...&c=E0705F&v=2
```

새 URL로 인식돼서 즉시 새로 크롤링한다. 페이지와 앱 모두 `n`, `a`, `b`, `c`만 읽고 나머지는 무시하므로 동작에 영향이 없다. 이 트릭은 OG 작업을 테스트할 때 계속 쓰게 된다.

## 정리

정적 사이트에서 링크별 미리보기를 만드는 흐름은 이렇다.

1. **자바스크립트로는 안 된다** — 크롤러는 JS를 실행하지 않고 HTML 원문만 읽는다
2. **엣지 함수로 응답을 가로챈다** — Cloudflare Pages는 `functions/_middleware.js` 하나면 된다
3. **HTMLRewriter로 메타태그를 교체한다** — 선택자로 잡아서 `setAttribute`
4. **사용자 입력은 한 번 걸러낸다** — 자동 이스케이프를 믿되, 크롤러 파서는 못 믿는다
5. **이미지는 경우의 수가 유한하면 미리 만들어 둔다** — 런타임 생성보다 훨씬 단순하다
6. **검증은 크롤러 User-Agent로** — 브라우저로 보면 JS가 돌아서 의미가 없다
7. **카카오톡 캐시를 기억한다** — 테스트할 땐 더미 파라미터로 URL을 바꿔가며

전체 작업은 파일 두 개(`_middleware.js`, 이미지 생성 스크립트)에 100줄 남짓이었다. 서버를 세우지 않고 정적 사이트를 유지한 채로 이 정도가 된다는 게 엣지 함수의 매력인 것 같다.
