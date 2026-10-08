---
title: "Why You Can't Download YouTube Audio for Offline Use Anymore (a Troubleshooting Log)"
date: '2026-07-17'
publish_date: '2026-12-21'
description: "Trying to add offline YouTube playback to a personal app, and rolling it back after running into YouTube's stream throttling policy"
tags:
  - YouTube
  - ReactNative
  - Expo
  - Debugging
  - youtube-dl
---

## Why I Tried This

I tried adding an "offline playback" feature to ChainPlay, a YouTube playlist app I built. The idea was to let you listen to videos you'd saved to a playlist as audio, even without an internet connection. To cut to the conclusion: **I couldn't build it.** But what I learned along the way was interesting enough that I wanted to write it down.

This post isn't a "here's how to do it" tutorial — it's closer to a "here's what I tried and why it didn't work" troubleshooting log. If you're thinking about attempting something similar, this should save you some time.

> For reference, downloading YouTube videos violates YouTube's Terms of Service, and shipping this in a store-released app risks getting it pulled for a policy violation. I kept this work confined to a separate build used only on my own personal device.

## Attempt 1: youtubei.js

The first thing I tried was a library called `youtubei.js`. It's a package that wraps YouTube's internal API (Innertube), letting you fetch video info and stream URLs. To use it in a React Native environment, you need to polyfill browser globals like `ReadableStream` and `TextEncoder`.

```ts
// 폴리필 예시 (index.ts 최상단)
import 'react-native-url-polyfill/auto';
import 'event-target-polyfill';
import { ReadableStream } from 'web-streams-polyfill';
```

After setting up all the polyfills and trying to extract a stream URL, I hit this error.

```
No valid URL to decipher
```

Digging into the cause, it turned out to be YouTube's recently introduced **SABR + PO Token** policy. YouTube now hands back an empty stream URL entirely unless you provide a bot-prevention token (PO Token). I even wired in a PO Token generation library (`bgutils-js`), but it still wouldn't unlock on the WEB client.

## Attempt 2: Plain fetch + Multiple Client Combinations

I gave up on youtubei.js and switched to calling Innertube's `/player` endpoint directly with fetch. The key insight was that **the response differs depending on the client.**

```ts
const body = {
  context: {
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.65.10',
      // ...
    },
  },
  videoId,
};

const res = await fetch(
  'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
  { method: 'POST', headers, body: JSON.stringify(body) }
);
```

Requesting with the `ANDROID_VR` client would sometimes return a directly playable URL, with no cipher transformation or PO Token needed. In fact, for a handful of videos (official music videos, mostly), I successfully extracted an audio URL this way.

The problem was that **which client worked varied from video to video.** Some videos came back `UNPLAYABLE` on `ANDROID_VR` but were playable through the `IOS` or `ANDROID` client instead. So I wrote fallback logic that tried multiple clients in sequence.

```ts
const CLIENTS = ['ANDROID_VR', 'IOS', 'ANDROID'];

for (const client of CLIENTS) {
  const data = await callPlayer(client, videoId);
  if (data.playabilityStatus?.status === 'OK') {
    const format = pickAudioFormat(data);
    if (format) return format;
  }
}
```

On top of that, if the first request got caught by the bot check (`LOGIN_REQUIRED`), I needed a second-stage step that re-requested with the `visitorData` from the response carried in the header. With all of this in place, I could get an audio URL for most videos.

## Problem 3: I Had the URL, But Couldn't Download It

I'd succeeded in getting the URL, but when I actually tried to download, I got a `403 Forbidden`. I narrowed down the cause step by step.

- Fetching the whole thing at once with no Range header → 403
- Fetching in small Range chunks (1MB or less) → succeeds
- But from the second chunk onward → 403 again

In other words, YouTube's server **won't even hand things over sequentially past a certain amount.** This is related to the `n` parameter YouTube embeds in the URL. If you use a "raw" URL where this parameter hasn't been properly decoded, the server deliberately throttles the download speed.

```
정상 URL: ...&n=UgoOL6QotfzybA...   ← 이 상태면 앞부분만 받히고 끊김
디코딩된 URL: ...&n=3ZNtQantXvmgrw... ← 이래야 끊김 없이 전체 다운로드 가능
```

## Attempt 4: Decoding the n Parameter Myself

Unlocking the `n` parameter requires running the transform function embedded in YouTube's own player script (`base.js`). I tried validating an approach that runs this script in a real JS engine, lifting the value straight from YouTube's own code doing the computation.

```js
import vm from 'node:vm';

const sandbox = { window: {}, document: {} };
vm.createContext(sandbox);
vm.runInContext(baseJs, sandbox); // base.js를 통째로 실행
```

Loading and running `base.js` itself worked fine. The problem was **figuring out which function inside it was the n-transform function.** I tried several regex patterns meant to locate it, but all of them failed against the current version of YouTube's player.

On the off chance it would help, I also tested a well-established open-source library dedicated to this exact problem (`@distube/ytdl-core`), and got the same error.

```
WARNING: Could not parse n transform function.
```

In other words, **it wasn't just me failing to find it — the entire surrounding ecosystem hadn't caught up with YouTube's current player structure yet.** The only tool that was keeping up with the latest structure was the Python-based `yt-dlp`, and that's not something you can embed inside a mobile app.

## Why I Stopped Here

Technically, it's not entirely impossible. I could build the logic for finding the n-transform function completely from scratch, the way `yt-dlp` does. But even if I did:

1. It would break again every time YouTube changes its player structure — as often as every few weeks.
2. Each time, I'd have to personally analyze the latest player script and patch it myself.
3. This would effectively mean continuously maintaining the core logic of a YouTube downloader.

I decided that was too much cost to put into a small app I build as a personal hobby project. So I rolled everything back — the code, the build, even the installed app — to its original state.

## Summary

| Attempt | Result |
|---|---|
| youtubei.js | Couldn't get a stream URL at all (SABR policy) |
| Generating a PO Token and retrying | Still couldn't unlock the URL |
| Plain fetch + client fallback | Got the URL, but hit throttling |
| Decoding the n parameter myself | Even an established library failed; a from-scratch implementation cost too much |
| **Final decision** | **Roll back the feature** |

The lesson left over from this whole exercise is this: any feature that works around an external service's unofficial API will see its maintenance cost explode the moment that service changes its policy. This was a day that reconfirmed how important it is to quickly validate whether something works, and to walk away without regret if it doesn't.
