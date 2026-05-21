---
title: 'YouTube Premium 없이 쓰는 나만의 플레이리스트 앱 — React Native(Expo)로 직접 만들기'
date: '2026-05-05'
publish_date: '2026-05-30'
description: Expo SDK 54 + TypeScript로 유튜브 플레이리스트 앱을 처음부터 만들면서 겪은 삽질과 해결법
tags:
  - React Native
  - Expo
  - TypeScript
  - YouTube
  - Android
---

## 왜 직접 만들었나

유튜브 뮤직 비디오나 강의 영상을 연달아 틀어두고 싶은데, YouTube Premium이 없으면 영상이 끝날 때마다 직접 다음 걸 눌러야 한다. 서드파티 앱도 있긴 한데 광고 범벅이거나 계속 강제 업데이트를 요구한다.

그래서 그냥 만들었다. 유튜브 URL 붙여넣으면 제목·썸네일 자동으로 가져오고, 끝나면 자동으로 다음 영상 재생하는 심플한 앱. React Native를 한번 써보고 싶기도 했고.

---

## 기술 선택

| 항목 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Expo SDK 54 | 네이티브 설정 최소화, 빠른 시작 |
| 언어 | TypeScript | 타입 안정성 |
| 플레이어 | react-native-youtube-iframe | YouTube IFrame API 공식 래퍼 |
| 영상 정보 | YouTube oEmbed API | API 키 불필요 |
| 저장 | AsyncStorage | 간단한 로컬 영속성 |

처음에는 커스텀 WebView로 직접 YouTube embed를 시도했다. 근데 YouTube가 안드로이드 WebView에서 User-Agent를 체크해서 재생을 막아버린다. `react-native-youtube-iframe`은 이 문제를 우회해서 정상 작동한다.

---

## 앱 구조

```
src/
├── types/index.ts          # PlaylistItem 인터페이스
├── utils/youtube.ts        # URL 파싱 + oEmbed 조회
├── hooks/usePlaylist.ts    # 플레이리스트 상태 관리
└── components/
    ├── Player.tsx          # YouTube 플레이어 + 컨트롤
    ├── Playlist.tsx        # FlatList 래퍼
    ├── PlaylistItem.tsx    # 플레이리스트 행
    └── AddUrlModal.tsx     # URL 입력 모달
```

데이터 타입은 단순하다:

```ts
interface PlaylistItem {
  id: string;        // `${videoId}_${Date.now()}`
  videoId: string;   // 11자 YouTube video ID
  title: string;     // oEmbed에서 가져온 제목
  thumbnail: string; // oEmbed thumbnail_url
  url: string;       // 원본 입력 URL
}
```

---

## Step 1 — YouTube URL 파싱 + 영상 정보 가져오기

유튜브 URL은 형식이 여러 가지라 정규식으로 다 처리했다.

```ts
// src/utils/youtube.ts
export function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&]+)/,           // youtube.com/watch?v=ID
    /youtu\.be\/([^?]+)/,      // youtu.be/ID
    /\/embed\/([^?]+)/,        // youtube.com/embed/ID
    /\/shorts\/([^?]+)/,       // youtube.com/shorts/ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

영상 제목과 썸네일은 YouTube oEmbed API로 가져온다. API 키가 필요 없어서 편하다.

```ts
export async function fetchVideoInfo(url: string) {
  const encoded = encodeURIComponent(url);
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encoded}&format=json`
  );
  if (!res.ok) throw new Error('영상 정보를 불러올 수 없습니다');
  const data = await res.json();
  return { title: data.title, thumbnail: data.thumbnail_url };
}
```

---

## Step 2 — 플레이어 구성

`react-native-youtube-iframe`은 `play` prop으로 재생 상태를 제어한다. 영상이 바뀔 때 자동재생이 되도록 `useEffect`를 연결했다.

```tsx
// Player.tsx
const [playing, setPlaying] = useState(false);

useEffect(() => {
  if (item) setPlaying(true);
  else setPlaying(false);
}, [item?.videoId]);

<YoutubePlayer
  height={playerHeight}
  videoId={item.videoId}
  play={playing}
  onChangeState={(state) => {
    if (state === 'ended') onNext();
    if (state === 'paused') setPlaying(false);
    if (state === 'playing') setPlaying(true);
  }}
/>
```

`onChangeState`로 영상이 끝났을 때(`'ended'`) 다음 곡으로 넘기면 자동재생이 완성된다.

---

## Step 3 — SafeAreaProvider 구조 분리

`useSafeAreaInsets()`는 `SafeAreaProvider` 안에서만 호출할 수 있다. 처음에 `App()` 안에서 바로 썼다가 에러를 만났다. 해결법은 `AppContent`를 분리하는 것.

```tsx
// App.tsx
function AppContent() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  // bottomInset을 모달, FAB 등에 내려줌
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
```

이 패턴으로 `bottomInset`을 `AddUrlModal`과 버튼들에 내려줘서 홈 인디케이터에 가리지 않게 했다.

---

## 트러블슈팅

> UI 개선과 Android 관련 버그(자동재생 타이밍, 커스텀 재생 버튼, KeyboardAvoidingView 문제)는 [이전 포스트](../yt_player_ui_bugfix_20260504)에서 자세히 다뤘다. 여기서는 초기 세팅에서 만난 이슈만 정리한다.

### 1. 안드로이드에서 미디어 컨트롤 이모지가 깨진다

`⏸`, `▶` 같은 미디어 컨트롤 이모지가 Android에서 박스로 표시된다. View의 border 속성으로 삼각형을 직접 그려서 해결했다. 자세한 코드는 이전 포스트 참조.

### 2. react-native-reanimated 충돌

드래그 정렬을 위해 `react-native-reanimated`를 설치했다가 앱이 죽었다. New Architecture(`newArchEnabled: true`)와 reanimated v4가 TurboModule 에러를 일으킨다. reanimated를 완전히 제거하고 ▲▼ 버튼으로 대체했다. `babel.config.js`에도 플러그인 흔적을 남기지 않는 게 중요하다.

### 3. index.ts 첫 줄 순서

```ts
import '@expo/metro-runtime'; // 반드시 첫 줄
import { registerRootComponent } from 'expo';
import App from './App';
```

`@expo/metro-runtime`이 첫 줄이 아니면 개발 서버에서 `window.location` 관련 에러가 난다.

---

## APK 빌드 + GitHub Releases 직배포

스토어에 올리기엔 YouTube 관련 정책이 까다롭다 (대체 클라이언트 앱은 Play Store에서 잘 걸린다). 개인용이니까 APK 직접 배포로 충분하다.

```bash
# 네이티브 프로젝트 생성 (최초 1회)
npx expo prebuild --platform android

# 빌드 + 기기 설치 한 번에
cd android && \
ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleRelease && \
~/Library/Android/sdk/platform-tools/adb install -r \
  app/build/outputs/apk/release/app-release.apk
```

APK가 완성되면 GitHub CLI로 릴리즈에 바로 붙일 수 있다.

```bash
gh release create v1.0.0 app-release.apk \
  --title "v1.0.0" \
  --notes "설치 방법: APK 다운로드 후 출처를 알 수 없는 앱 허용 → 설치"
```

이렇게 하면 GitHub Releases 페이지에서 APK를 직접 다운받아 설치할 수 있다.

---

## 정리

| 문제 | 해결 |
|---|---|
| YouTube WebView 차단 | react-native-youtube-iframe 사용 |
| 안드로이드 이모지 깨짐 | View border trick으로 직접 그리기 |
| reanimated New Architecture 충돌 | reanimated 제거, ▲▼ 버튼으로 대체 |
| SafeAreaInsets 호출 에러 | AppContent 컴포넌트 분리 |
| 스토어 등록 불가 | GitHub Releases APK 직배포 |

만들고 나서 매일 쓰고 있다. 광고는 여전히 나오지만 그건 YouTube 정책이니 어쩔 수 없고, 영상 끝날 때마다 손 안 대도 되는 것만으로도 충분히 만족스럽다.

소스코드: [https://github.com/hyunseokyu1-netizen/yt-player](https://github.com/hyunseokyu1-netizen/yt-player)
