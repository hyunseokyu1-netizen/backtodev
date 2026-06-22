---
title: '서버 없이 앱 콘텐츠 공유하기 — GitHub Pages + Android 딥링크'
date: '2026-06-11'
publish_date: '2026-06-23'
description: ChainPlay 앱에 체인 공유 기능을 추가하면서 서버 없이 GitHub Pages와 딥링크만으로 구현한 과정
tags:
  - Android
  - GitHub Pages
  - 딥링크
  - React Native
  - Expo
---

## 앱 콘텐츠를 어떻게 공유할까?

ChainPlay는 YouTube 영상을 묶어서 순서대로 재생하는 앱이다. 직접 쓰다 보니 "이 영상 목록을 다른 사람한테 보내고 싶다"는 생각이 자연스럽게 들었다.

문제는 이 앱이 완전히 로컬 기반이라는 것. AsyncStorage에 데이터를 저장하고, 서버가 전혀 없다. 공유 기능을 붙이려면 보통 "서버에 저장 → 단축 링크 생성" 흐름이 필요한데, 서버를 운영하고 싶지는 않았다.

그래서 찾은 방법이 **GitHub Pages + 딥링크 조합**이다. 핵심 아이디어는 간단하다:

> 체인 데이터를 URL 자체에 담아서, 웹 페이지는 데이터를 저장하지 않고 그냥 통로 역할만 한다.

---

## 전체 흐름

```
[공유할 때]
앱 → 체인 데이터 base64 인코딩 → URL 생성
→ https://hyunseokyu1-netizen.github.io/chainplay/?c=BASE64DATA

[받을 때]
링크 탭
 ├─ 앱 설치됨 → chainplay:// 딥링크로 앱 오픈 → 체인 자동 가져오기
 └─ 앱 없음   → 브라우저에서 GitHub Pages 페이지 표시
               ├─ 영상 목록 보여주기
               └─ 구글 플레이스토어 설치 버튼
```

서버가 없어도 된다. 데이터가 URL 안에 있으니까.

---

## Step 1. 체인 데이터 인코딩

체인 전체를 URL에 담으면 너무 길어진다. 그래서 **최소 필드만** 인코딩한다.

- 필요한 것: `chain name`, `videoId`, `title`
- 복원 가능한 것: `thumbnail` → `https://img.youtube.com/vi/{videoId}/mqdefault.jpg`
- 복원 가능한 것: `url` → `https://youtu.be/{videoId}`

```typescript
// src/utils/share.ts

const SHARE_BASE_URL = 'https://hyunseokyu1-netizen.github.io/chainplay/';
const MAX_SHARE_ITEMS = 20; // URL 길이 제한

function toBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export function encodeChain(chain: Chain): string {
  const payload = {
    n: chain.name,
    v: chain.items.slice(0, MAX_SHARE_ITEMS).map(({ videoId, title }) => ({
      i: videoId,
      t: title,
    })),
  };
  return toBase64(JSON.stringify(payload));
}

export async function shareChain(chain: Chain): Promise<void> {
  const base64 = encodeChain(chain);
  const url = `${SHARE_BASE_URL}?c=${encodeURIComponent(base64)}`;
  await Share.share({ message: url, title: chain.name });
}
```

**한국어 제목 처리 주의**: `btoa()`는 ASCII만 지원한다. 한국어 같은 유니코드 문자가 포함되면 에러가 난다. `encodeURIComponent` → 바이너리 변환 → `btoa` 순서로 처리해야 한다.

20개 제한을 둔 이유는 영상이 많으면 URL이 수천 자가 넘어가기 때문이다. 20개면 약 1,600자 정도로 안전하다.

---

## Step 2. GitHub Pages 랜딩 페이지

저장소에 `docs/` 폴더를 만들고 `index.html`을 작성한다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <!-- OG 태그 (카카오톡 공유 미리보기용) -->
  <meta property="og:title" content="ChainPlay — YouTube 체인 공유">
  <meta property="og:description" content="YouTube 영상 체인을 받았습니다. 앱에서 열어보세요.">
  <meta property="og:image" content="https://hyunseokyu1-netizen.github.io/chainplay/og-image.png">
</head>
<body>
  <script>
    function fromBase64(b64) {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    const params = new URLSearchParams(window.location.search);
    const c = params.get('c');
    const payload = JSON.parse(fromBase64(c));
    // payload.n = 체인 이름, payload.v = 영상 목록

    // 딥링크 시도
    function tryOpenApp() {
      window.location.href = 'chainplay://import?data=' + encodeURIComponent(c);
    }
  </script>
</body>
</html>
```

GitHub 저장소 Settings → Pages에서 Source를 `main` 브랜치의 `/docs` 폴더로 설정하면 바로 배포된다. 별도 서버 없이 무료다.

---

## Step 3. Android 딥링크 등록

앱이 `chainplay://` 스킴을 처리할 수 있도록 `AndroidManifest.xml`에 intent filter를 추가한다.

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity android:name=".MainActivity" ...>
  <!-- 기존 launcher intent -->
  <intent-filter>
    <action android:name="android.intent.action.MAIN"/>
    <category android:name="android.intent.category.LAUNCHER"/>
  </intent-filter>

  <!-- 딥링크 처리 추가 -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="chainplay"/>
  </intent-filter>
</activity>
```

> **Expo 주의사항**: `app.json`에 `intentFilters`를 추가해도 자동으로 반영되지 않는다. `npx expo prebuild`로 네이티브 코드를 재생성하거나, `AndroidManifest.xml`에 직접 추가해야 한다. 나는 `android/` 폴더가 `.gitignore`에 있어서 직접 수정했다.

---

## Step 4. 앱에서 딥링크 수신

```typescript
// App.tsx

useEffect(() => {
  function handleDeepLink(url: string) {
    if (!url.startsWith('chainplay://import')) return;
    const match = url.match(/[?&]data=([^&]+)/);
    if (!match) return;

    const decoded = decodeChain(decodeURIComponent(match[1]));
    if (!decoded) return;

    Alert.alert(
      '체인 가져오기',
      `"${decoded.name}" (영상 ${decoded.videos.length}개)을 새 체인으로 가져올까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '확인', onPress: () => importChain(decoded.name, decoded.videos) },
      ]
    );
  }

  // 앱이 꺼진 상태에서 딥링크로 열린 경우
  Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

  // 앱이 켜진 상태에서 딥링크가 들어온 경우
  const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
  return () => sub.remove();
}, [importChain]);
```

`Linking.getInitialURL()`과 `addEventListener` 두 가지를 모두 처리해야 한다. 앱이 꺼진 상태와 켜진 상태 둘 다 커버하기 위해서다.

---

## 중복 이름 처리

같은 이름의 체인을 여러 번 가져오면 목록이 지저분해진다. `importChain` 함수에서 이름 중복을 체크해 번호를 자동으로 붙인다.

```typescript
setChains((prev) => {
  const base = name.trim();
  let uniqueName = base;
  let n = 2;
  while (prev.some((c) => c.name === uniqueName)) {
    uniqueName = `${base} (${n++})`;
  }
  // "Kids" → "Kids (2)" → "Kids (3)"
  ...
});
```

---

## 트러블슈팅

### "앱으로 열기" 버튼이 아무 반응이 없다

`AndroidManifest.xml`에 intent filter가 없어서다. `app.json`만 수정하고 `prebuild`를 안 했다면 반영이 안 된다. manifest 파일을 직접 열어서 `chainplay` 스킴이 등록돼 있는지 확인하자.

```bash
grep -A 5 "chainplay" android/app/src/main/AndroidManifest.xml
```

### 한국어 제목이 깨진다

`btoa()`에 한국어를 직접 넣으면 안 된다. 앱(인코딩)과 웹페이지(디코딩) 양쪽에서 같은 UTF-8 처리 방식을 써야 한다.

- 앱: `encodeURIComponent` → 바이너리 → `btoa`
- 웹: `atob` → `Uint8Array` → `TextDecoder`

### 카카오톡에서 URL만 보인다

OG 태그가 없거나, GitHub Pages가 아직 활성화되지 않았을 때 그렇다. Pages 설정 후 1~2분 기다리면 반영된다. 카카오톡은 OG 태그를 캐싱하므로 처음 공유 시 바로 안 보일 수 있다.

---

## 정리

| 구성 요소 | 역할 |
|---|---|
| `share.ts` | 체인 → base64 URL 인코딩 (최대 20개) |
| `docs/index.html` | GitHub Pages 랜딩 — 영상 목록 표시, 딥링크 시도, 플레이스토어 연결 |
| `AndroidManifest.xml` | `chainplay://` 스킴 등록 |
| `App.tsx` | 딥링크 수신 → 확인 다이얼로그 → 체인 저장 |
| OG 태그 | 카카오톡 공유 미리보기 |

서버 없이, 무료로, 꽤 그럴듯한 공유 기능을 만들 수 있었다. 데이터가 URL 자체에 담겨 있어서 DB도 필요 없고 유지 비용도 없다. 물론 영상이 20개를 넘어가거나 체인 이름까지 미리보기에 표시하고 싶다면 서버사이드 렌더링이 필요하다. 그건 나중에.
