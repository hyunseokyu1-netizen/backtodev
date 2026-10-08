---
title: 'Adding YouTube Links to My Cassette App — A Fight With the WebView Bridge'
date: '2026-07-10'
publish_date: '2026-10-25'
description: Wanting to recreate the memory of making and trading mix tapes with friends, I added YouTube links and tape sharing to my no-skip retro cassette music player, then hunted down a lost postMessage bridge bug in react-native-youtube-iframe and an FF/REW seek race condition using real-device logs
tags:
  - React Native
  - Expo
  - Android
  - WebView
  - Troubleshooting
---

## The Existing App, and What I Was Trying to Add This Time

`Cassette — No Skip` is a retro cassette music player with no skip button. The concept is Side A/B, 30 minutes each, loaded only with audio files already on your phone, listened to start to finish. This time I wanted to add two things.

1. **Adding tracks via YouTube link** — fill a cassette with just a link, even without a file
2. **Managing and sharing multiple tapes** — hand a playlist I made to a friend with a single code

The work itself stretched over several days, and every time a feature went in, a bug showed up that only reproduced on a real device. This post is the debugging log from that process.

## Why YouTube Links — Those Days We Used to Trade Tapes

What got me to make this update wasn't really that the feature was needed — it was a memory from the past.

Back in the day, I used to pick out songs I liked and put them on a tape for a friend. "I put this one in because I liked it," agonizing over the order starting from the first track on Side A, and once it was done, I'd meet up with the tape in hand and we'd listen to it together, talking for ages about why some song was good. It's a different kind of experience from just throwing someone a playlist link on a streaming service today. The whole process of picking by hand, arranging the order, and handing it over in person — that itself was the good part.

When I first built `Cassette — No Skip`, I focused on the feeling of "listen all the way through, no skipping." But using it, I realized there was a piece missing from that old experience — **sharing it with someone.** If a tape is made only from files on my phone, that tape can never leave my phone. So this time I wanted to let people fill a tape with songs via YouTube links, no files needed, hand that tape to a friend with a single code, and have the friend slot it into their own cassette. In a way, I wanted to recreate that old gesture of handing over a tape, just in a form that fits the current era.

So the two features in this update are really pointed at a single purpose. YouTube links are the material that lets anyone fill in songs, and tape sharing implements the act of "handing it over" for whatever gets made.

## Adding a YouTube Track — Title and Length From Just a Link

I pulled the videoId out of a YouTube link (`youtube.com/watch?v=`, `youtu.be/`, `shorts/`) with a regex, and filled in metadata using two official, unauthenticated endpoints.

```typescript
// 제목은 oEmbed (API 키 불필요)
async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );
  const data = await res.json();
  return typeof data.title === "string" ? data.title : null;
}

// 길이는 Innertube player 엔드포인트 (ANDROID 클라이언트는 400, WEB 클라이언트로 통과)
async function fetchYouTubeDuration(videoId: string): Promise<number> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00" } },
      videoId,
    }),
  });
  const data = await res.json();
  const sec = parseInt(data?.videoDetails?.lengthSeconds, 10);
  return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 0;
}
```

The response from the Innertube endpoint changed depending on which client name I passed in. Requesting with the `ANDROID` client got me a `400 Precondition check failed`, while switching to the `WEB` client went through (though `playabilityStatus` comes back as `UNPLAYABLE` — fine for us, since we only need metadata, not actual playback). If this lookup fails, I leave the duration at 0 and have the player screen's iframe auto-correct it via `getDuration()` once it loads, as a double safety net.

I handled playback with `react-native-youtube-iframe`. I kept the cassette's reel animation in the main screen as-is, with a separate 356×200 (16:9) video window popping up underneath only for YouTube tracks. YouTube embeds can't be fully hidden due to policy constraints, so I initially considered hiding the cassette entirely and showing just a large video, but since the "cassette feel" is this app's identity, I settled on always keeping the reels visible.

## Real-Device Problem 1 — Play/Pause Stops Working From the Second Track Onward

The first track worked fine, but from the next track onward, the play/pause button went dead. I reproduced it with USB debugging on and sprinkled logs at each function's entry point.

```typescript
const pause = useCallback(async () => {
  console.log(`[dbg] pause isPlaying=${isPlaying} noise=${isPlayingNoise} yt=${currentYoutubeId}`);
  // ...
```

Pulling the real-device log with `adb logcat -d | grep -F "[dbg]"`, I could see `pause` was being called correctly, but the `paused` event never came back from the iframe at all. The command was going out from the app toward the WebView and vanishing somewhere along the way.

The cause was a change in `react-native-webview` 13.x. The latest version delivers the RN→WebView `postMessage` on Android through the `document` object, but the player script `react-native-youtube-iframe` injects was only listening for messages on `window`.

```javascript
// react-native-youtube-iframe이 iframe 안에 심는 리스너 (라이브러리 소스)
window.addEventListener('message', function (event) {
  const { data } = event;
  const parsedData = JSON.parse(data);
  switch (parsedData.eventName) {
    case 'playVideo': player.playVideo(); break;
    // ...
```

A message arriving via `document` never reaches a `window` listener, so the play/pause command just vanished into thin air. FF/REW used the `injectJavaScript` path (injecting a script directly), so it was unaffected by this and worked fine — which is exactly why the symptom was "FF/REW works, but play/pause alone doesn't." It wasn't until I confirmed through logs that the two were taking completely different paths that it made sense why only half of it was broken.

The fix was injecting one more bridge script that relays `document` messages over to `window`.

```tsx
<YoutubeIframe
  webViewProps={{
    injectedJavaScript: `
      document.addEventListener('message', function (e) {
        window.dispatchEvent(new MessageEvent('message', { data: e.data }));
      });
      true;
    `,
  }}
/>
```

## Real-Device Problem 2 — Rewinding to a Previous Track Plays From the Start

When FF/REW crossed a track boundary into the previous track, playback would always start from 0 seconds instead of the wound-to position. Looking at the logs, the `seekTo` request was being sent correctly.

```
[dbg] REW stop @142054
[dbg] playItemAt idx=1 type=track src=youtube init=140054
[dbg] ytState=paused idx=1
[dbg] ytState=unstarted idx=1
[dbg] ytState=buffering idx=1
[dbg] ytState=playing idx=1
```

`init=140054` (the 140-second mark) was calculated correctly, but playback actually started at 0 seconds. The cause was timing. When only the video changes within the same iframe (a track switch) via `loadVideoById`, the `onReady` callback doesn't fire again — but my seek logic was waiting for "the iframe to become ready." So the request was being silently dropped.

```tsx
// 수정 전 — onReady를 기다리다가 트랙 전환 시엔 영원히 못 옴
const applyYoutubeSeek = useCallback(() => {
  if (!youtubeSeekRequest || !ytReadyRef.current || !ytRef.current) return;
  ytRef.current.seekTo(youtubeSeekRequest.ms / 1000, true);
}, [youtubeSeekRequest]);
```

`onReady` only fires when the iframe is first created, and a video swap needs a different signal entirely. In the end, I duplicated when the seek gets applied: "try immediately once the request comes in" plus "confirm again once the video actually reaches the `playing` state."

```tsx
// 1차: 요청이 오는 즉시 시도 (이미 플레이어가 떠 있으면 바로 먹힘)
useEffect(() => {
  if (!youtubeSeekRequest || !ytRef.current) return;
  if (youtubeSeekRequest.ms > 500) {
    ytRef.current.seekTo(youtubeSeekRequest.ms / 1000, true).catch(() => {});
  }
}, [youtubeSeekRequest]);

// 2차: "playing" 이벤트에서 확정 (loadVideoById로 1차가 무시된 경우 대비)
const handleYtStateChange = useCallback((state: string) => {
  if (state === "playing" && seekReqRef.current && ytRef.current) {
    const { ms } = seekReqRef.current;
    seekReqRef.current = null;
    if (ms > 500) ytRef.current.seekTo(ms / 1000, true).catch(() => {});
  }
  onYoutubeStateChange(state);
}, [onYoutubeStateChange]);
```

If either one gets ignored, the other one catches it. It looks a bit messy time-wise, but given that the app has no control over the iframe's lifecycle, this ended up being the most robust approach.

## The Final UX Decision — "Use the YouTube Button for YouTube"

Once I'd fixed everything up to here, the play/pause commands were arriving fine, but the iframe's reaction was sometimes slow by 2-4 seconds. Every other button in the app (FF/REW/flip) responded instantly, while this one spot stayed subtly sluggish. Even after several rounds of tuning, it was hard to fully eliminate given how the YouTube iframe behaves.

So I changed direction. **While a YouTube track is playing, instead of the app's play/pause button, I guide the video screen's own ▶/⏸ buttons to be the official controls.** Pressing the app button just shows a toast with guidance and doesn't touch the state.

```typescript
function showYoutubeControlHint() {
  const msg = "YouTube 트랙은 영상 화면의 ▶/⏸ 버튼을 사용하세요";
  if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert("", msg);
}
```

Instead, the result of operating the video's own buttons (play/pause events) stays in sync with the cassette's reel rotation and elapsed time. If you pause on the video, the reel stops and the tape time freezes right there too; resuming picks back up from where it stopped. FF/REW stayed on the app's buttons as before, since that's a "winding the tape" action — this path uses `injectJavaScript`, which I'd already confirmed works reliably.

Instead of a perfect unified integration, I drew an honest boundary: "this button definitely works here, and that button definitely works there." I also made sure to note in the release notes up front that YouTube playback stops when the screen turns off (background playback isn't possible, per YouTube's policy). Local file tracks keep playing as before even with the screen off.

## Tape Sharing — Hermes Doesn't Have `btoa`

I also added a feature to export and import a tape (the Side A/B track list) as a single piece of text. It's a simple format — a `CT2:` prefix plus base64-encoded JSON — but React Native's JS engine (Hermes) doesn't have the browser's `btoa`/`atob`, so I had to write a UTF-8-safe base64 encoder myself (a simple `charCodeAt` approach won't do, since Korean tape names must not get mangled).

```typescript
function utf8Encode(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i)!;
    if (code > 0xffff) i++; // surrogate pair
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}
```

For importing, I assumed the scenario where a user copy-pastes an entire KakaoTalk message as-is. I used a regex to extract just the `CT2:` code, but parsed it in two stages to also handle cases where the messenger wraps a long string with line breaks.

```typescript
export function decodeTapeShare(text: string): Tape | null {
  const strict = text.match(/CT2:([A-Za-z0-9+/=]+)/)?.[1];
  const loose = text.match(/CT2:\s*([A-Za-z0-9+/=\s]+)/)?.[1]?.replace(/\s+/g, "");
  for (const candidate of [strict, loose]) {
    if (!candidate) continue;
    const tape = tapeFromBase64(candidate);
    if (tape) return tape;
  }
  return null;
}
```

Local file tracks can't be played on another device, so they're automatically excluded when sharing, with a note indicating how many songs were left out. I also made the paste text input show a live preview the instant you type — something like "「Tape Name」 · 3 tracks on A / 2 on B" — so you can confirm what's about to come in before hitting Import.

## Wrap-Up

1. **YouTube metadata**: oEmbed for the title, the Innertube WEB client for the duration, with iframe `getDuration()` as a fallback correction if the lookup fails
2. **Lost play/pause**: `react-native-webview` 13.x sends messages via `document`, while the library only listens on `window` → relayed with a bridge script
3. **Lost REW seek**: `onReady` doesn't fire again on a track switch → fixed by trying immediately on request plus confirming on the `playing` event, as a double safety net
4. **Final UX**: YouTube play/pause is the official control on the video button, FF/REW stays on the app button — only exposing the paths that reliably work
5. **Share format**: hand-rolled a UTF-8-safe base64 since Hermes doesn't have it; importing handles pasting the full message plus recovering from line-break wrapping

The biggest thing I took away from this project is that, without real-device logs, it would have been hard to pin down the cause of a half-broken bug like "FF/REW works, but play/pause alone doesn't." The two features were going through completely different communication paths (`injectJavaScript` vs. `postMessage`) even within the same library, and that difference lined up exactly with the boundary of the symptom. Printing state at every function entry point with `adb logcat` ended up being the fastest path in the end.
