---
title: 'Building a Share Feature Without a Database — Shrinking a URL That Got Too Long'
date: '2026-06-11'
publish_date: '2026-06-24'
description: How I fixed a share-link URL that ballooned past 1,300 characters, by dropping titles and listing only videoIds, bringing it down to 266
tags:
  - React Native
  - Expo
  - oEmbed
  - GitHub Pages
  - Deep Link
---

## I want a share feature, but there's no server

I'm building a personal project called ChainPlay — a YouTube playlist app. It's simple: group videos into a "chain" and play them back-to-back. Using it, an obvious want emerged naturally: **I want to share the chains I make with friends.**

The problem: this app has no server. All the data lives entirely in AsyncStorage on the device. Building a share feature usually looks like this.

1. Store the chain data on a server
2. Issue a short ID (`/share/abc123`)
3. The recipient looks up the data using that ID

But the moment you bolt a server onto a hobby app, cost, operations, and incident response all become your problem. So I went a different route: **put the data inside the URL itself.**

## Step 1: First attempt — JSON to base64

I turned the chain data into JSON, base64-encoded it, and stuffed it into a URL parameter.

```ts
// chain → JSON → base64 → URL
const payload = {
  n: chain.name,                    // chain name
  v: chain.items.map((item) => ({
    i: item.videoId,                // YouTube video ID
    t: item.title,                  // video title
  })),
};
const base64 = toBase64(JSON.stringify(payload));
const url = `https://.../chainplay/?c=${base64}`;
```

The recipient side is a single static HTML page hosted on GitHub Pages. It decodes the `?c=` URL parameter, shows the video list, and calls the deep link (`chainplay://import?...`) via an "Open in app" button. GitHub Pages is free, and since it's static, there's no server-operation burden.

This worked fine — until I sent a link over a chat app and realized something. **The URL was way too long.**

```
https://hyunseokyu1-netizen.github.io/chainplay/?c=eyJuIjoi7Lyg7J24...
(around 1,351 characters for 10 videos)
```

A link that eats up several screens in a chat window looks like spam to anyone. It technically worked, but became a share link nobody would want to share.

## Step 2: Why is it this long — the culprit is non-ASCII titles

Break down the payload and the answer's right there. Each video carries data like this.

```json
{ "i": "dQw4w9WgXcQ", "t": "A Very Long YouTube Video Title in Korean" }
```

- `videoId`: always a fixed **11 characters**
- Title: non-ASCII characters like Korean take **3 bytes per character** in UTF-8, and base64 inflates 3 bytes into 4 characters. In other words, **a single non-ASCII character eats 4 characters in the URL**

A single video with a 30-character title chews up roughly 150 characters in the URL, versus the videoId's 11. **90% of the URL length was the title.**

The key question here: does the title really need to ride along in the link?

## Step 3: Drop the title, reconstruct it on the receiving end

Given just a videoId, everything else about a YouTube video can be reconstructed.

| Data | How to reconstruct | Note |
|---|---|---|
| Thumbnail | `img.youtube.com/vi/{id}/mqdefault.jpg` | just an image URL pattern |
| Title | oEmbed API | **no API key needed** |

oEmbed is surprisingly under-known, but it's YouTube's own officially supported, free metadata API.

```
https://www.youtube.com/oembed?url=https://youtu.be/dQw4w9WgXcQ&format=json
```

```json
{ "title": "Video Title", "thumbnail_url": "...", "author_name": "..." }
```

So I stripped the title out of the payload entirely. That revealed something else: a videoId's character set is `[a-zA-Z0-9_-]` — **URL-safe on its own**. It doesn't even need base64 encoding. Just join them with commas.

```ts
// New format: ?n=<chain name>&v=<videoId,videoId,...>
export function buildShareUrl(chain: Chain): string {
  const ids = chain.items.slice(0, MAX_SHARE_ITEMS).map((item) => item.videoId);
  return `${SHARE_BASE_URL}?n=${encodeURIComponent(chain.name)}&v=${ids.join(',')}`;
}
```

Here's the result.

```
Before: ?c=eyJuIjoi7Lyg7J24...                    → 1,351 characters
After:  ?n=Kids&v=c_VRfwoiW2Q,yI_VFVxEdYI,...     →   266 characters
```

**Same information, about a fifth of the length.** Each additional video adds exactly 12 characters (11-character ID + comma), and the URL becomes something a human can roughly parse at a glance.

## Step 4: The receiving end — landing page and app

### Landing page (GitHub Pages)

Thumbnails can be rendered immediately since they're just a URL pattern, so those render first, while titles load asynchronously via oEmbed. Even if title loading fails, thumbnails and links still work — not a fatal failure.

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

For reference, before building this, I checked with curl whether YouTube's oEmbed endpoint allows browser CORS. If it didn't, this entire design would be a non-starter.

```bash
curl -sI "https://www.youtube.com/oembed?url=..." -H "Origin: https://my-domain" \
  | grep -i access-control
# access-control-allow-origin: https://my-domain  ← passes
```

### App (importing via deep link)

The app receives the `chainplay://import?n=...&v=...` deep link and imports the chain. Once the user confirms the import, titles get filled in via oEmbed at that point.

```ts
const videos = await Promise.all(
  decoded.videos.map(async (v) => {
    const info = await fetchVideoInfo(`https://youtu.be/${v.videoId}`);
    return { ...v, title: info?.title ?? 'Untitled' };
  })
);
importChain(decoded.name, videos);
```

Old-format links (`?c=base64`) that had already been shared out in the wild still need to keep working, so the parser tries the new format first and falls back to the old one on failure. **Once a link is shared, you can't take it back.** Backward compatibility isn't optional when you change formats — it's mandatory.

## Troubleshooting

Things I actually ran into.

### 1. "Invalid share link"

I installed a fresh APK and happily sent out a link, only for the landing page to throw an error. The cause was simple: **the app was generating links in the new format, but the deployed landing page still had the old parser.** In a setup where the client and the static page have to move as one unit, deploy order matters. Deploy the receiving side (the landing page) first, and roll out the sending side (the app) second — that's the safe order.

### 2. React Native's URLSearchParams trap

The landing page parses cleanly with `new URLSearchParams(location.search)`, but using the same code in React Native throws a runtime error, since **`URLSearchParams.get()` isn't implemented**. I parsed it with a regex on the RN side instead.

```ts
const n = url.match(/[?&]n=([^&]+)/);
const v = url.match(/[?&]v=([^&]+)/);
```

### 3. Bumped the app.json version, but it didn't show up in the build

Once Expo prebuild generates an `android/` folder, it lives separately from `app.json` from then on. Bump the version and only edit `app.json`, and **`versionCode` in `android/app/build.gradle` stays untouched** — the Play Store upload then gets rejected for a duplicate versionCode. Both need to be bumped by hand.

## Summary

| Stage | Detail |
|---|---|
| Design | Put data in the URL instead of a server (GitHub Pages + deep link) |
| First implementation | JSON → base64 → `?c=` parameter. Works, but 1,351 characters |
| Diagnosis | Most of the URL length was non-ASCII titles (UTF-8 3 bytes × base64's 4/3 expansion) |
| Core idea | **Don't carry reconstructable data in the link** — with just a videoId, title and thumbnail can be restored via oEmbed |
| Second implementation | `?n=name&v=id,id,...` — videoIds are URL-safe, no encoding needed. 266 characters |
| Wrap-up | Kept backward compatibility with the old format, deployed the landing page first |

You can absolutely build a share feature without a server. But URLs get long faster than you'd expect. Before reaching for a compression library or a URL shortener service, asking **"does this data really need to ride in the link?"** sometimes turns out to have a surprisingly simple answer.
