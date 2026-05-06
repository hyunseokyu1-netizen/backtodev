---
title: 'Why Is Android Background Playback So Hard — Doze, WakeLock, and Foreground Service'
date: '2026-04-29'
publish_date: '2026-05-09'
description: How I fixed a bug where track transitions stopped working when the screen turned off in a cassette music player app, using Foreground Service + PARTIAL_WAKE_LOCK
tags:
  - Android
  - React Native
  - Expo
  - BackgroundAudio
  - WakeLock
---

I'm building a music player app with a cassette tape aesthetic. Audio playback with expo-av was working fine, but then a weird symptom appeared.

**Play button → works perfectly while the screen is on. Turn the screen off? When the current track ends, it doesn't advance to the next one.**

At first I figured it was just a bug in the track transition logic. But the moment I turned the screen back on, the next track started playing immediately. The transition logic itself was fine — the issue was that **it wasn't executing while the screen was off**. The culprit was Android's **Doze mode**.

---

## What Is Doze Mode?

To save battery, Android limits CPU usage for apps when the screen has been off for a while. This is called **Doze mode**.

React Native apps run on top of a JavaScript engine. When Doze kicks in, the JS thread gets **throttled** — timers and callbacks simply don't execute. That's why even when the `didJustFinish` callback fired, the code to play the next track never ran.

```
[Screen on]  Track A → Track B → Track C → works fine
[Screen off] Track A → ... (Doze kicks in) → JS stalls → Track B never plays
→ [Screen on] transition finally executes
```

---

## The Fix: Two Layers

Proper background playback on Android requires two things working together.

| Layer | Purpose |
|-------|---------|
| **PARTIAL_WAKE_LOCK** | Keeps the CPU alive (prevents JS thread throttling) |
| **Foreground Service** | Tells the system the app is "active" (excluded from Doze) |

Both are needed. A Foreground Service alone can still be Dozed, and a WakeLock alone can get the app killed on Android 8+ when it goes to the background.

---

## Step 1 — Writing a Native Module for PARTIAL_WAKE_LOCK

There's a package called expo-keep-awake, but it keeps the screen on (`SCREEN_DIM_WAKE_LOCK`) which drains battery. What we want is the CPU alive while the screen is off — `PARTIAL_WAKE_LOCK`.

That means writing a React Native native module directly.

**`android/app/src/main/java/com/hscassette/player/WakeLockModule.kt`**

```kotlin
class WakeLockModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var wakeLock: PowerManager.WakeLock? = null

    override fun getName(): String = "WakeLock"

    @ReactMethod
    fun acquire() {
        if (wakeLock == null) {
            val pm = reactApplicationContext
                .getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,   // ← key part
                "CassettePlayer::AudioWakeLock"
            )
        }
        if (wakeLock?.isHeld == false) wakeLock?.acquire()
    }

    @ReactMethod
    fun release() {
        if (wakeLock?.isHeld == true) wakeLock?.release()
    }

    @ReactMethod fun startService(title: String) { ... }
    @ReactMethod fun stopService() { ... }
}
```

> **Note**: `FULL_WAKE_LOCK` violates Play Store policy. Always use `PARTIAL_WAKE_LOCK`.

The JS bridge is simple:

**`utils/wakeLock.ts`**

```ts
import { NativeModules, Platform } from "react-native";

const { WakeLock } = NativeModules;

export function acquireWakeLock() {
  if (Platform.OS === "android" && WakeLock) WakeLock.acquire();
}

export function releaseWakeLock() {
  if (Platform.OS === "android" && WakeLock) WakeLock.release();
}

export function startForegroundService(title: string) {
  if (Platform.OS === "android" && WakeLock) WakeLock.startService(title);
}

export function stopForegroundService() {
  if (Platform.OS === "android" && WakeLock) WakeLock.stopService();
}
```

---

## Step 2 — Writing the Foreground Service

**`CassettePlayerService.kt`** — tells the system that playback is active

```kotlin
class CassettePlayerService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startForegroundNotification(intent.getStringExtra("title") ?: "Playing")
            ACTION_STOP  -> { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundNotification(title: String) {
        val channel = NotificationChannel(CHANNEL_ID, "Cassette Player",
            NotificationManager.IMPORTANCE_LOW)   // ← LOW matters (see below)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Cassette Player")
            .setContentText(title)
            .setOngoing(true)
            .setSilent(true)
            .build()

        // Android 10+: declare as media playback type
        startForeground(NOTIFICATION_ID, notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    }
}
```

`AndroidManifest.xml` also needs permissions and a service declaration:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<service android:name=".CassettePlayerService"
    android:foregroundServiceType="mediaPlayback" />
```

---

## Step 3 — Wiring WakeLock into the Playback Flow

```ts
// Start track playback
const { sound } = await Audio.Sound.createAsync(...)
setIsPlaying(true);
acquireWakeLock();                   // keep CPU alive
startForegroundService(item.title); // exclude from Doze

// Pause / stop
wasPlayingRef.current = false;
releaseWakeLock();       // release CPU
stopForegroundService();
```

WakeLock acquire and release must always be paired. If you forget to release after playback ends, the battery keeps draining.

---

## Trap 1 — Don't Set Notification Channel Importance to HIGH

I originally set the notification channel to `IMPORTANCE_HIGH` and got a bizarre bug.

**Track 1 ends, Track 2 starts, then Track 2 immediately pauses.**

Tracing the cause revealed that a HIGH importance notification **steals audio focus** when it appears. Every time the playback notification updated, the track paused.

**Fix**: Lowering the channel importance to `IMPORTANCE_LOW` means the notification appears without affecting audio focus.

---

## Trap 2 — Jumping to the Track After Next When Screen Turns On

There was logic to restore track state when AppState changed to `active`. But when turning the screen on, it was playing the track **after** the current one instead of the current one.

The problem was that the recovery logic couldn't distinguish between "track ended naturally" vs "paused due to audio focus loss," so it always called `advance()`. When `didJustFinish` fired, `advance()` already ran once — then AppState recovery called it again, skipping two tracks.

```ts
// distinguish using trackEndedRef
const trackEndedRef = useRef(false);

// when track ends naturally
if (status.didJustFinish && !cancelRef.current) {
  trackEndedRef.current = true;   // mark as ended
  advance();
}

// on AppState recovery
if (soundRef.current) {
  const status = await soundRef.current.getStatusAsync();
  if (status.isLoaded && !status.isPlaying) {
    if (trackEndedRef.current) {
      // didJustFinish fired but advance wasn't complete → go to next
      trackEndedRef.current = false;
      advance();
    } else {
      // stopped due to audio focus loss → resume
      await soundRef.current.playAsync();
    }
  }
}
```

---

## Trap 3 — Don't Use Position to Detect Track End

The initial implementation used `positionMillis >= durationMillis - 300` to determine "track is nearly done, play next."

But expo-av sometimes **resets `positionMillis` to 0** after a track ends. That makes the condition always false, so recovery never fires.

**Fix**: Remove the position check entirely and rely only on `wasPlayingRef` (the intent-to-play state).

```ts
// if explicitly stopped, no recovery needed
if (!wasPlayingRef.current) return;
// → proceed with logic
```

---

## Play Store Build Automation

After fixing all the bugs, it was time to upload to the store. Typing `cd android && ./gradlew bundleRelease` every time got old fast, so I scripted it.

**`tools/build-store.sh`** (AAB build — for Play Store)

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/../artifacts/cassette-player/android"
OUTPUT="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

echo ">>> Starting AAB build (Play Store)..."
cd "$ANDROID_DIR"
./gradlew bundleRelease

echo ""
echo ">>> Done!"
echo ">>> File location: $OUTPUT"
ls -lh "$OUTPUT"
```

**`tools/build-apk.sh`** (APK build — for direct install)

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/../artifacts/cassette-player/android"
OUTPUT="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

echo ">>> Starting APK build..."
cd "$ANDROID_DIR"
./gradlew assembleRelease

echo ""
echo ">>> Done!"
echo ">>> File location: $OUTPUT"
ls -lh "$OUTPUT"
```

```bash
chmod +x tools/build-apk.sh tools/build-store.sh

./tools/build-store.sh   # for store upload
./tools/build-apk.sh     # for direct device install
```

> Play Store requires **AAB (Android App Bundle)** format, not APK. Uploading an APK will fail.

---

## Troubleshooting

**versionCode already in use**

If you get "Version code 1 is already used" when uploading to Play Console, bump the version code in `android/app/build.gradle`:

```groovy
defaultConfig {
    versionCode 2      // ← 1 → 2
    versionName "1.0.1"
}
```

Update `app.json` to match for easier tracking:

```json
{ "expo": { "version": "1.0.1" } }
```

**Foreground Service notification not appearing**

If `<service>` is missing from `AndroidManifest.xml`, the service won't start. The `android:foregroundServiceType="mediaPlayback"` attribute must also be present.

---

## Summary — The Core Flow

```
expo-av (staysActiveInBackground: true)
    ↓ audio keeps playing but JS thread can stall
PARTIAL_WAKE_LOCK
    ↓ keeps CPU alive, prevents JS thread throttling
Foreground Service (FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    ↓ system recognizes app as "active media" → excluded from Doze
AppState recovery logic (wasPlayingRef + trackEndedRef)
    ↓ auto-recovers when screen turns on after JS was paused
```

All of these pieces together are what makes a music player that actually advances tracks when the screen is off. Leave any one out and playback breaks on certain devices or Android versions.
