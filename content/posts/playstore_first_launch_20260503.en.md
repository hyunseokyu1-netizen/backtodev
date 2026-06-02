---
title: 'Launching a React Native app on the Play Store - from build to intro copywriting'
date: '2026-05-03'
publish_date: '2026-05-27'
description: A recap of our first launch, including automating AAB builds, resolving versionCode errors, writing store intro copy, and analyzing Play Console recommended actions.
tags:
  - Android
  - play store
  - React Native
  - Expo
  - ASO
---

## We've created our app. Now we need to publish it

We've got the background playback bugs out of the way, and the functionality is pretty much complete. Now it's time to push it to the Play Store.

Since this was my first release, there were a lot of things I didn't know. What is an AAB file, why is the versionCode giving an error, how to write an introduction, and so on. Here's what I learned as I went along.

---

## APK vs AAB - What should I upload?

Initially, I wanted to build and upload an APK. But Play Console is asking for AAB.

| Format | Purpose |
|------|------|
| **APK** | Install directly on device (test, sideload) |
| **AAB** | Play Store upload only |

As of August 2021, new apps only receive Android App Bundles (AAB). I get an error when I try to upload as APK.

### AAB build command

```bash
cd android
./gradlew bundleRelease
```

Output file location:
```
android/app/build/outputs/bundle/release/app-release.aab
```

The build time initially took 15-20 minutes. This is because it compiles all the C++ native libraries (Reanimated, Gesture Handler). The second time around, it's down to 1-2 minutes thanks to the cache.

### If you don't want to type commands every time - sh script

```bash
#!/bin/bash
# tools/build-store.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/../artifacts/cassette-player/android"
OUTPUT="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

echo ">>> Start building AAB (for Play Store)..."
cd "$ANDROID_DIR"
./gradlew bundleRelease

echo ">>> Done!"
echo ">>> File Location: $OUTPUT"
ls -lh "$OUTPUT"
```

```bash
chmod +x tools/build-store.sh
./tools/build-store.sh
```

You can create a similar one for your APK (`./gradlew assembleRelease`).

---

## Troubleshooting: versionCode 1 is already used

When I uploaded the file to Play Console, I got this error.

> **Version code 1 is already used. Please use a different version code.**

VersionCode 1 is treated as exhausted if it was rejected by review the first time it was uploaded, or if it was previously uploaded to a test track.

**Workaround**: Upload the version code from `android/app/build.gradle`.

```groovy
defaultConfig {
    versionCode 2 // 1 → 2
    versionName "1.0.1"
}
```

It's more manageable to match the `app.json` as well.

```json
{
  "expo": {
    "version": "1.0.1"
  }
}
```

After making the changes, run `./gradlew bundleRelease` again and you're done. This time it took 1 minute and 12 seconds because of the cache.

---

## Store intro - no one reads feature lists

The first introduction you write:

> > Classic cassette-style UI - Smooth and simple music playback - Retro-inspired design

I don't feel anything after reading it. A list of features doesn't touch the reader's heart.

**Three things are important in an introduction:**
1. empathize with "why do I need this app?"
2. present limitations as features, not drawbacks
3. a closing sentence with a hook

The core concept of this app is "unskippable". The app was created as a reaction to the habit of skipping ahead in music services. Just like in the days of cassette tapes, you have to listen to the whole thing, even if you don't like it.

### Edit to intro (English)

```
Remember when you actually listened to a whole song?

Cassette Player brings back the era when music wasn't something you scrolled
through - it was something you sat with.

Load your own music onto Side A or Side B (30 minutes each, just like a real tape).
Hit play. And stay with it.

No skip button.
Want to move forward? Hold FF - just like the real thing.

Tape noise between tracks.
That hiss isn't a bug. It's the texture of analog.

Side A + Side B. 60 minutes total.
Curate what actually matters to you.

Your files only.
No streaming. No algorithm deciding what you hear next.

In a world of infinite playlists and 10-second attention spans,
Cassette Player dares you to slow down.

You might rediscover a song you always used to skip past.
```

### ì'¬ìš©í-˜ëŠ" ìžˆìŠµë'ˆë'¤ (í-œêµ¬)

```
Have you been listening to music lately?

You listen to the beginning, then flip through it, then flip through it again.
You have hundreds of songs on your playlist, but only a few you actually listen to all the way through.

Back in the days of cassette tapes, it was different.
You listened to the whole thing, even if you didn't like it, and at some point you grew to love it.

There's no skip button.
If you want to skip ahead, you have to hold down the FF button. Just like a real tape.

There's tape noise between tracks.
Hearing that crackle is part of the app experience.

Side A, Side B. 30 minutes each.
No streaming, just the music files on my phone.

One hour, no algorithms, just songs I picked.
It'll stay with you longer than you think.
```

**Transformative takeaways:**

| Existing | Fixed |
|------|------|
| List features | Start with empathetic sentence |
| "You can't skip" | "There is no skip button" (like an active choice) |
| Don't mention noise | "hiss is not a bug" - turns a con into a feature
| End with an explanation | Last sentence with impact |

---

## Thinking about app name

Former name: **Cassette Tape Player: Retro**

The problem is that retro is a word that's used by every retro app, so it's not very distinctive. The real USP of this app is "unskippable", so the name needs to stand out.

| Name | Impression |
|------|------|
| **Cassette - No Skip** | "No Skip" is provocative. Stand out in the store listing |
| **Side A** | Only six letters. Cassette instantly recognizable to those who know it, curious to those who don't |
| **Cassette** | Neat, but can get buried with other apps |

The combination `Cassette - No Skip` / `Cassette - No Skip` is the most impactful. The name alone has the power to make you click "What does this mean?".

---

## Release Notes - Make your first release a philosophy

This is your first release and nothing has changed. In this case, it's best to keep the release notes short and capture the philosophy of the app.

```
<en-US>
First release.

Cassette Player is a music player with no skip button.
Load your own music files onto Side A or Side B (30 min each).
Fast-forward by holding FF - just like a real tape.
Tape noise included.

Slow down. Stay with the music.
</en-US>
<en-US>
First release.

Cassette Player is a music app without a skip button.
I put my music files on Side A / B (30 minutes each), and you have to hold down the FF button to move on.
The tape noise between tracks is still there.

Listen slowly, all the way through.
</en-US>
```

The release notes are for existing users, but new users often read them on the app page during the initial launch. It's more important to make them want to give it a try than to explain features.

---

## 2 Play Console recommended actions - can I ignore them?

After publishing your app, you may see a "Recommended Action" in the Play Console. These are **Recommended**, not **Required**, and will not prevent you from publishing.

### Warning 1: Using Deprecated APIs

```
android.view.Window.setStatusBarColor
android.view.Window.setNavigationBarColor
layout_in_display_cutout_mode_short_edges
...
```

These APIs are deprecated in Android 15, according to the source:

```
com.facebook.react.modules.statusbar.StatusBarModule ← React Native internal
com.google.android.material.bottomsheet.* ← Material library
```

**This is not my own code.** These are APIs used by the Expo/React Native framework, so I can't touch them. This will be fixed automatically when the Expo SDK is upgraded. No need to fix it now.

### Warning 2: screenOrientation orientation restriction

```xml
<activity android:name="com.hscassette.player.MainActivity"
    android:screenOrientation="PORTRAIT" />
```

This is a warning that as of Android 16, orientation pinning is ignored on foldables/tablets, but the cassette player UI is naturally portrait oriented. Foldables/tablets are not the primary target of this app, so leave it alone.

**Both warnings do not affect the review.**

---

## Summary: First Release Checklist

```
Build
├── ./gradlew bundleRelease (generate AAB)
├── If versionCode is a previous number, set it to +1
└── Create tools/build-store.sh for ease of reference

Register your store
├── Don't list features, write an introduction in the following order: Empathy → USP → Afterword
├── App name: Names with constraints or philosophy are more memorable than feature descriptions
└── Release notes: a paragraph of app philosophy for the first release

Play Console warnings
├── Recommended = not required, does not affect review passage
├── Deprecated API inside RN → auto-resolved on Expo SDK upgrade
└── screenOrientation → If it's intentional, leave it alone
```

I learned more in the process of getting the app to the store than I did in the creation of the app itself. You can test code, but you have to test the human mind.
