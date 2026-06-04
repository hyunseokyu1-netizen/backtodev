---
title: 'Your own playlist app without YouTube Premium - Build it yourself with React Native (Expo)'
date: '2026-05-05'
publish_date: '2026-05-30'
description: Building a YouTube playlist app from scratch with Expo SDK 54 + TypeScript — what broke and how I fixed it
tags:
  - React Native
  - Expo
  - expo
  - YouTube
  - Android
---

## Why I made it myself

I like to watch YouTube music videos or lectures back-to-back, but without YouTube Premium, I have to manually hit the next one after each video ends. There are third-party apps, but they're full of ads or keep forcing updates.

So I just made this. A simple app that automatically fetches the title and thumbnail when you paste the YouTube URL, and automatically plays the next video when it's finished. I also wanted to try React Native.

---

## Tech stack

| Item | Choice | Reason |
|---|---|---|
| Framework | Expo SDK 54 | Minimal native config, fast start |
| Language | TypeScript | Type safety |
| Player | react-native-youtube-iframe | Official YouTube IFrame API wrapper |
| Video info | YouTube oEmbed API | No API key needed |
| Storage | AsyncStorage | Simple local persistence |

At first, I tried to embed YouTube directly with a custom WebView, but YouTube checks User-Agent in the Android WebView and prevents playback. The `react-native-youtube-iframe` bypasses this issue and works fine.

---

## App structure

```
src/
├── types/index.ts # PlaylistItem interface
├── utils/youtube.ts # URL parsing + oEmbed lookup
├── hooks/usePlaylist.ts # Playlist state management
└── components/
    ├── Player.tsx # YouTube player + controls
    ├── Playlist.tsx # FlatList wrapper
    ├── PlaylistItem.tsx # Playlist rows
    └── AddUrlModal.tsx # URL input modal
```

The data type is simple:

```ts
interface PlaylistItem {
  id: string; // `${videoId}_${Date.now()}`
  videoId: string; // 11-character YouTube video ID
  title: string; // Title taken from oEmbed
  thumbnail: string; // oEmbed thumbnail_url
  url: string; // Original input URL
}
```

---

## Step 1 - Parsing the YouTube URL + getting video information

YouTube URLs come in many different formats, so we used regular expressions to handle them all.

```ts
// src/utils/youtube.ts
export function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&]+)/, // youtube.com/watch?v=ID
    /youtu\.be\/([^?]+)/, // youtu.be/ID
    /\/embed\/([^?]+)/, // youtube.com/embed/ID
    /\/shorts\/([^?]+)/, // youtube.com/shorts/ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  } return null;
}
```

The video title and thumbnail are fetched from the YouTube oEmbed API. This is nice because you don't need an API key.

```ts
export async function fetchVideoInfo(url: string) {
  const encoded = encodeURIComponent(url);
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encoded}&format=json`
  );
  if (!res.ok) throw new Error('Unable to fetch video information');
  const data = await res.json();
  return { title: data.title, thumbnail: data.thumbnail_url };
}
```

---

## Step 2 - Configure the Player

The `react-native-youtube-iframe` controls the playback state with the `play` prop. We've hooked up `useEffect` to autoplay when the video changes.

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
/>.
```

When the video ends (`'ended'`) with `onChangeState`, the autoplay is completed by flipping to the next song.

---

## Step 3 - Isolate the SafeAreaProvider structure

The `useSafeAreaInsets()` can only be called from inside the `SafeAreaProvider`. I initially wrote it directly inside `App()` and encountered an error. The solution is to isolate the `AppContent`.

```tsx
// App.tsx
function AppContent() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  // drop bottomInset to modal, FAB, etc.
}

export default function App() {
  return (
    <SafeAreaProvider> <SafeAreaProvider
      <AppContent />ã€'
    </SafeAreaProvider> <AppContent
  );
}
```

This pattern pushes the `bottomInset` down to the `AddUrlModal` and the buttons so that they are not obscured by the home indicator.

---

## Troubleshooting

> UI improvements and Android-specific bugs (autoplay timing, custom play buttons, KeyboardAvoidingView issues) have been covered in detail in [previous post](../yt_player_ui_bugfix_20260504). Here we will only summarize the issues we encountered in the initial setup.

### 1. Media control emoji is broken on Android

Media control emojis like `⏸` and `▶` are displayed as boxes on Android. I solved it by manually drawing a triangle with the border property of the View. See the previous post for the detailed code.

### 2. react-native-reanimated conflict

After installing `react-native-reanimated` for drag alignment, the app crashed. New Architecture (`newArchEnabled: true`) and reanimated v4 cause TurboModule error. I removed reanimated completely and replaced it with ▲▼ buttons. It's also important not to leave any traces of the plugin in `babel.config.js`.

### 3. index.ts first line order

```ts
import '@expo/metro-runtime'; // must be first line
import { registerRootComponent } from 'expo';
import App from './App';
````

If `@expo/metro-runtime` is not the first line, the development server will throw an error about `window.location`.

---

## Build APK + Deploy directly to GitHub Releases

YouTube's policies are tricky to get on the store (alternative client apps work fine on the Play Store). Since this is for personal use, direct distribution of the APK is sufficient.

```bash
# Create a native project (first time)
npx expo prebuild --platform android

# build + install device at once
cd android && \
ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleRelease && \
~/Library/Android/sdk/platform-tools/adb install -r \
  app/build/outputs/apk/release/app-release.apk
```

Once the APK is complete, you can use the GitHub CLI to push it directly to your release.

```bash
gh release create v1.0.0 app-release.apk \
  --title "v1.0.0" \
  --notes "How to install: Download APK, then allow apps from unknown sources → Install"
```

This will allow you to download and install the APK directly from the GitHub Releases page.

---

## Cleanup

| Problem | Solved |
|---|---|
| Blocking YouTube WebView | Using react-native-youtube-iframe | Android emoji broken | Drawing directly with View border trick
| Android emoji broken | Draw directly with View border trick
| reanimated New Architecture crashes | remove reanimated, replace with ▲▼ buttons | SafeAreaInsets crashes
| Error calling SafeAreaInsets | AppContent component separation | Store registration not possible
| Store registration not available | GitHub Releases APK direct distribution

I've been using it every day since I made it. The ads are still there, but that's YouTube's policy, and I'm happy enough not to have to touch them at the end of every video.

Source code: [https://github.com/hyunseokyu1-netizen/yt-player](https://github.com/hyunseokyu1-netizen/yt-player)
