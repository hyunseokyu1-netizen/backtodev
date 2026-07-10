---
title: 'Sharing App Content Without a Server — GitHub Pages + Android Deep Links'
date: '2026-06-11'
publish_date: '2026-06-23'
description: How I added a chain-sharing feature to ChainPlay using nothing but GitHub Pages and deep links, with no server involved
tags:
  - Android
  - GitHub Pages
  - Deep Link
  - React Native
  - Expo
---

## How do you share app content?

ChainPlay is an app that groups YouTube videos and plays them back-to-back. Using it myself, the thought naturally came up: "I'd like to send this video list to someone else."

The problem: the app is entirely local. Data lives in AsyncStorage, and there's no server whatsoever. Adding a share feature usually means a "save to server → generate a short link" flow, and I didn't want to run a server.

So the approach I found was **GitHub Pages + deep links combined**. The core idea is simple:

> Put the chain data inside the URL itself, so the web page never stores anything — it's purely a passthrough.

---

## The overall flow

```
[When sharing]
App → base64-encode the chain data → generate a URL
→ https://hyunseokyu1-netizen.github.io/chainplay/?c=BASE64DATA

[When receiving]
Tap the link
 ├─ App installed → opens via chainplay:// deep link → chain imported automatically
 └─ App not installed → shows the GitHub Pages page in the browser
               ├─ displays the video list
               └─ Google Play Store install button
```

No server required — the data lives inside the URL.

---

## Step 1. Encoding the chain data

Encoding the entire chain into a URL makes it far too long. So I encode **only the minimum required fields**.

- Needed: `chain name`, `videoId`, `title`
- Reconstructable: `thumbnail` → `https://img.youtube.com/vi/{videoId}/mqdefault.jpg`
- Reconstructable: `url` → `https://youtu.be/{videoId}`

```typescript
// src/utils/share.ts

const SHARE_BASE_URL = 'https://hyunseokyu1-netizen.github.io/chainplay/';
const MAX_SHARE_ITEMS = 20; // URL length limit

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

**Watch out for non-ASCII titles**: `btoa()` only supports ASCII. Feed it Unicode characters (like Korean) directly and it throws. You need `encodeURIComponent` → convert to binary → `btoa`, in that order.

The 20-item cap exists because URLs with more videos than that stretch into the thousands of characters. 20 items keeps it around a safe 1,600 characters.

---

## Step 2. The GitHub Pages landing page

Create a `docs/` folder in the repo and write `index.html`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <!-- OG tags (for chat app link previews) -->
  <meta property="og:title" content="ChainPlay — Share a YouTube Chain">
  <meta property="og:description" content="You received a YouTube video chain. Open it in the app.">
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
    // payload.n = chain name, payload.v = video list

    // Attempt the deep link
    function tryOpenApp() {
      window.location.href = 'chainplay://import?data=' + encodeURIComponent(c);
    }
  </script>
</body>
</html>
```

Set the GitHub repo's Settings → Pages source to the `/docs` folder on the `main` branch, and it deploys immediately. Free, no server required.

---

## Step 3. Registering the Android deep link

Add an intent filter to `AndroidManifest.xml` so the app can handle the `chainplay://` scheme.

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity android:name=".MainActivity" ...>
  <!-- existing launcher intent -->
  <intent-filter>
    <action android:name="android.intent.action.MAIN"/>
    <category android:name="android.intent.category.LAUNCHER"/>
  </intent-filter>

  <!-- added deep link handling -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="chainplay"/>
  </intent-filter>
</activity>
```

> **Expo caveat**: adding `intentFilters` to `app.json` doesn't get reflected automatically. You need to either run `npx expo prebuild` to regenerate native code, or edit `AndroidManifest.xml` directly. Since my `android/` folder is in `.gitignore`, I edited it directly.

---

## Step 4. Receiving the deep link in the app

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
      'Import chain',
      `Import "${decoded.name}" (${decoded.videos.length} videos) as a new chain?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => importChain(decoded.name, decoded.videos) },
      ]
    );
  }

  // Case where the app was launched from a cold start via the deep link
  Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

  // Case where a deep link arrives while the app is already running
  const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
  return () => sub.remove();
}, [importChain]);
```

Both `Linking.getInitialURL()` and `addEventListener` need to be handled, to cover both the cold-start and already-running cases.

---

## Handling duplicate names

Importing chains with the same name repeatedly makes the list messy. The `importChain` function checks for name collisions and appends a number automatically.

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

## Troubleshooting

### The "Open in app" button does nothing

This means `AndroidManifest.xml` has no intent filter. If you only edited `app.json` without running `prebuild`, it never gets applied. Open the manifest file directly and check whether the `chainplay` scheme is registered.

```bash
grep -A 5 "chainplay" android/app/src/main/AndroidManifest.xml
```

### Non-ASCII titles get mangled

Never pass non-ASCII text (like Korean) directly into `btoa()`. Both the app (encoding) and the web page (decoding) need to use the same UTF-8 handling.

- App: `encodeURIComponent` → binary → `btoa`
- Web: `atob` → `Uint8Array` → `TextDecoder`

### Only the URL shows up in a chat app preview

This happens if the OG tags are missing, or GitHub Pages hasn't gone live yet. Wait 1–2 minutes after configuring Pages. Chat apps also cache OG tags, so a first share might not preview correctly right away.

---

## Summary

| Component | Role |
|---|---|
| `share.ts` | chain → base64 URL encoding (max 20 items) |
| `docs/index.html` | GitHub Pages landing page — shows the video list, attempts the deep link, links to the Play Store |
| `AndroidManifest.xml` | registers the `chainplay://` scheme |
| `App.tsx` | receives the deep link → confirmation dialog → saves the chain |
| OG tags | chat app link previews |

I managed to build a genuinely decent share feature with no server, for free. Since the data lives entirely in the URL, there's no DB and no upkeep cost. Of course, if you need more than 20 videos or want to preview the chain name too, server-side rendering becomes necessary. That's a problem for later.
