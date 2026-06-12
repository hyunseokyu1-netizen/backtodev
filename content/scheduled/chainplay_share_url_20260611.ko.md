---
title: 'DB 없이 공유 기능 만들기 — URL이 너무 길어졌을 때 줄이는 법'
date: '2026-06-11'
publish_date: '2026-06-24'
description: 서버 없이 base64 링크로 플레이리스트를 공유하다 URL이 1,300자를 넘긴 문제를, 제목을 빼고 videoId만 나열하는 방식으로 266자까지 줄인 과정
tags:
  - React Native
  - Expo
  - oEmbed
  - GitHub Pages
  - 딥링크
---

## 공유 기능을 만들고 싶은데, 서버가 없다

개인 프로젝트로 ChainPlay라는 유튜브 플레이리스트 앱을 만들고 있다. 영상을 "체인"으로 묶어서 순차 재생하는 단순한 앱인데, 쓰다 보니 자연스럽게 욕심이 생겼다. **내가 만든 체인을 친구한테 공유하고 싶다.**

문제는 이 앱에 서버가 없다는 것. 데이터는 전부 기기 안 AsyncStorage에만 있다. 공유 기능을 만들려면 보통 이렇게 한다.

1. 서버에 체인 데이터를 저장하고
2. 짧은 ID를 발급받아 (`/share/abc123`)
3. 받는 쪽이 그 ID로 데이터를 조회

하지만 취미 앱에 서버를 붙이는 순간 비용, 운영, 장애 대응이 전부 내 몫이 된다. 그래서 다른 길을 택했다. **데이터를 URL 자체에 담는 것.**

## Step 1: 첫 번째 시도 — JSON을 base64로

체인 데이터를 JSON으로 만들고, base64로 인코딩해서 URL 파라미터에 실었다.

```ts
// 체인 → JSON → base64 → URL
const payload = {
  n: chain.name,                    // 체인 이름
  v: chain.items.map((item) => ({
    i: item.videoId,                // 유튜브 영상 ID
    t: item.title,                  // 영상 제목
  })),
};
const base64 = toBase64(JSON.stringify(payload));
const url = `https://.../chainplay/?c=${base64}`;
```

받는 쪽은 GitHub Pages에 올린 정적 HTML 한 장이다. URL의 `?c=` 파라미터를 디코딩해서 영상 목록을 보여주고, "앱으로 열기" 버튼으로 딥링크(`chainplay://import?...`)를 호출한다. GitHub Pages는 무료이고, 정적 파일이라 서버 운영 부담이 없다.

여기까지는 잘 동작했다. 그런데 카카오톡으로 링크를 보내보고 깨달았다. **URL이 너무 길다.**

```
https://hyunseokyu1-netizen.github.io/chainplay/?c=eyJuIjoi7Lyg7J24...
(영상 10개 기준 약 1,351자)
```

채팅창을 몇 화면씩 차지하는 링크는 누가 봐도 스팸처럼 생겼다. 기능은 되는데 공유하고 싶지 않은 공유 링크가 된 셈이다.

## Step 2: 왜 이렇게 긴 걸까 — 범인은 한글 제목

페이로드를 뜯어보면 답이 나온다. 영상 하나당 이런 데이터가 들어간다.

```json
{ "i": "dQw4w9WgXcQ", "t": "아주 길고 긴 한국어 유튜브 영상 제목입니다" }
```

- `videoId`: 항상 **11자** 고정
- 제목: 한글은 UTF-8에서 **글자당 3바이트**, base64를 거치면 3바이트가 4문자로 불어난다. 즉 **한글 한 글자가 URL에서 4자**를 차지한다

제목 30자짜리 영상 하나가 URL에서 150자 안팎을 잡아먹는다. videoId는 11자인데 말이다. **URL 길이의 90%가 제목이었다.**

여기서 핵심 질문: 제목을 꼭 링크에 실어야 하나?

## Step 3: 제목은 빼고, 받는 쪽에서 복원하자

유튜브 영상은 videoId만 있으면 나머지를 전부 복원할 수 있다.

| 데이터 | 복원 방법 | 비고 |
|---|---|---|
| 썸네일 | `img.youtube.com/vi/{id}/mqdefault.jpg` | 그냥 이미지 URL 규칙 |
| 제목 | oEmbed API | **API 키 불필요** |

oEmbed는 의외로 덜 알려져 있는데, 유튜브가 공식 지원하는 무료 메타데이터 API다.

```
https://www.youtube.com/oembed?url=https://youtu.be/dQw4w9WgXcQ&format=json
```

```json
{ "title": "영상 제목", "thumbnail_url": "...", "author_name": "..." }
```

그래서 페이로드에서 제목을 통째로 들어냈다. 그러자 또 하나가 보였다. videoId의 문자셋은 `[a-zA-Z0-9_-]` — **그 자체로 URL-safe**다. base64 인코딩조차 필요 없다. 그냥 쉼표로 이어 붙이면 된다.

```ts
// 새 형식: ?n=<체인이름>&v=<videoId,videoId,...>
export function buildShareUrl(chain: Chain): string {
  const ids = chain.items.slice(0, MAX_SHARE_ITEMS).map((item) => item.videoId);
  return `${SHARE_BASE_URL}?n=${encodeURIComponent(chain.name)}&v=${ids.join(',')}`;
}
```

결과는 이렇다.

```
변경 전: ?c=eyJuIjoi7Lyg7J24...                    → 1,351자
변경 후: ?n=Kids&v=c_VRfwoiW2Q,yI_VFVxEdYI,...     →   266자
```

**같은 정보를 담고 약 5분의 1로 줄었다.** 영상 하나당 정확히 12자(ID 11자 + 쉼표)씩만 늘어나고, 사람이 봐도 대충 뭐가 들었는지 보이는 URL이 됐다.

## Step 4: 받는 쪽 — 랜딩 페이지와 앱

### 랜딩 페이지 (GitHub Pages)

썸네일은 URL 규칙만으로 즉시 그릴 수 있으니 먼저 렌더링하고, 제목은 oEmbed로 비동기 로드한다. 제목 로드가 실패해도 썸네일과 링크는 동작하니 치명적이지 않다.

```js
async function loadTitles(videos) {
  await Promise.all(videos.map(async (v, i) => {
    const url = 'https://www.youtube.com/oembed?url=' +
      encodeURIComponent('https://youtu.be/' + v.videoId) + '&format=json';
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('vt-' + i).textContent = data.title;
  }));
}
```

참고로 작업 전에 유튜브 oEmbed가 브라우저 CORS를 허용하는지 curl로 먼저 확인했다. 허용 안 하면 이 설계 자체가 불가능하기 때문이다.

```bash
curl -sI "https://www.youtube.com/oembed?url=..." -H "Origin: https://내도메인" \
  | grep -i access-control
# access-control-allow-origin: https://내도메인  ← 통과
```

### 앱 (딥링크 가져오기)

앱은 `chainplay://import?n=...&v=...` 딥링크를 받아 체인을 가져온다. 사용자가 가져오기를 확인하면 그때 oEmbed로 제목들을 채운다.

```ts
const videos = await Promise.all(
  decoded.videos.map(async (v) => {
    const info = await fetchVideoInfo(`https://youtu.be/${v.videoId}`);
    return { ...v, title: info?.title ?? '제목 없음' };
  })
);
importChain(decoded.name, videos);
```

기존에 뿌려진 구형식 링크(`?c=base64`)도 계속 열려야 하니, 파서는 새 형식을 먼저 시도하고 실패하면 구형식으로 폴백하게 했다. **링크는 한 번 공유되면 회수할 수 없다.** 형식을 바꿀 때 하위호환은 선택이 아니라 필수다.

## 트러블슈팅

실제로 겪은 것들이다.

### 1. "공유 링크가 올바르지 않습니다"

새 APK를 설치하고 신나게 링크를 보냈는데 랜딩 페이지가 에러를 띄웠다. 원인은 단순했다. **앱은 새 형식으로 링크를 만드는데, 배포된 랜딩 페이지는 아직 구버전 파서였다.** 클라이언트와 정적 페이지가 한 몸처럼 움직여야 하는 구조에서는 배포 순서가 중요하다. 받는 쪽(랜딩 페이지)을 먼저 배포하고, 보내는 쪽(앱)을 나중에 푸는 게 안전하다.

### 2. React Native의 URLSearchParams 함정

랜딩 페이지에서는 `new URLSearchParams(location.search)`로 깔끔하게 파싱했지만, React Native에서 같은 코드를 쓰면 **`URLSearchParams.get()`이 미구현이라 런타임 에러**가 난다. RN 쪽은 정규식으로 파싱했다.

```ts
const n = url.match(/[?&]n=([^&]+)/);
const v = url.match(/[?&]v=([^&]+)/);
```

### 3. app.json 버전을 올렸는데 빌드에 반영이 안 됨

Expo prebuild로 생성한 `android/` 폴더는 한 번 만들어지면 `app.json`과 따로 논다. 버전을 올릴 때 `app.json`만 고치면 **`android/app/build.gradle`의 `versionCode`는 그대로**라서, Play Store 업로드에서 versionCode 중복으로 거부당한다. 둘 다 직접 올려야 한다.

## 정리

| 단계 | 내용 |
|---|---|
| 설계 | 서버 대신 URL에 데이터를 담는다 (GitHub Pages + 딥링크) |
| 1차 구현 | JSON → base64 → `?c=` 파라미터. 동작은 하지만 1,351자 |
| 진단 | URL 길이의 대부분은 한글 제목 (UTF-8 3바이트 × base64 4/3배) |
| 핵심 아이디어 | **복원 가능한 데이터는 링크에 싣지 않는다** — videoId만 있으면 제목·썸네일은 oEmbed로 복원 |
| 2차 구현 | `?n=이름&v=id,id,...` — videoId는 URL-safe라 인코딩도 불필요. 266자 |
| 마무리 | 구형식 하위호환 유지, 랜딩 페이지 먼저 배포 |

서버 없이도 공유 기능은 충분히 만들 수 있다. 다만 URL은 생각보다 금방 길어진다. 그럴 때 압축 라이브러리나 단축 URL 서비스로 달려가기 전에, **"이 데이터, 정말 링크에 실어야 하나?"** 부터 물어보면 의외로 답이 간단할 때가 있다.
