---
title: 'Android 백그라운드 재생이 왜 이렇게 어렵냐 — Doze, WakeLock, Foreground Service 삽질기'
date: '2026-04-29'
publish_date: '2026-05-03'
description: 카세트 뮤직 플레이어 앱에서 화면 꺼지면 트랙 전환이 안 되는 버그를 Foreground Service + PARTIAL_WAKE_LOCK으로 해결한 과정
tags:
  - Android
  - React Native
  - Expo
  - 백그라운드 재생
  - WakeLock
---

카세트 테이프 느낌의 뮤직 플레이어 앱을 만들고 있다. expo-av로 오디오 재생은 잘 되는데, 이상한 증상이 생겼다.

**재생 버튼 → 화면 켜져 있는 동안은 완벽하게 동작. 화면 끄면? 현재 곡이 끝난 뒤 다음 곡으로 안 넘어감.**

처음엔 단순히 "다음 곡 전환 로직에 버그가 있겠지" 싶었다. 그런데 화면을 켜는 순간 바로 다음 곡이 재생된다. 즉, 전환 로직 자체는 멀쩡한데 **화면이 꺼진 동안 실행이 안 되는** 것이었다. 범인은 Android의 **Doze 모드**였다.

---

## Doze 모드가 뭔데?

Android는 배터리를 아끼기 위해 화면이 꺼지고 일정 시간이 지나면 앱의 CPU 사용을 제한한다. 이걸 **Doze 모드**라고 한다.

React Native 앱은 JavaScript 엔진 위에서 돌아간다. Doze가 켜지면 JS 스레드가 **스로틀링**되어 타이머나 콜백이 아예 실행이 안 된다. 그래서 `didJustFinish` 콜백이 와도 다음 곡 재생 코드가 실행되지 않았던 것이다.

```
[화면 켜짐] 곡 A 재생 → 곡 B → 곡 C → 정상
[화면 꺼짐] 곡 A 재생 → ... (Doze 진입) → JS 멈춤 → 곡 B 전환 안 됨
→ [화면 켜짐] 그제서야 전환 실행됨
```

---

## 해결 방법: 두 가지 레이어

Android에서 백그라운드 재생을 제대로 하려면 두 가지가 필요하다.

| 레이어 | 역할 |
|--------|------|
| **PARTIAL_WAKE_LOCK** | CPU가 꺼지지 않도록 유지 (JS 스레드 스로틀링 방지) |
| **Foreground Service** | 앱이 "활성 상태"임을 시스템에 알림 (Doze 대상에서 제외) |

둘 다 있어야 한다. Foreground Service만 있어도 Doze에 걸릴 수 있고, WakeLock만 있으면 Android 8+ 에서 앱이 백그라운드 진입 시 아예 종료될 수 있다.

---

## Step 1 — PARTIAL_WAKE_LOCK 네이티브 모듈 작성

expo-keep-awake라는 패키지가 있긴 한데, 이건 화면을 켜둬서 배터리를 소모하는 방식(`SCREEN_DIM_WAKE_LOCK`)이다. 우리가 원하는 건 화면은 꺼져도 되고 CPU만 살려두는 것 — `PARTIAL_WAKE_LOCK`.

React Native 네이티브 모듈을 직접 만들어야 한다.

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
                PowerManager.PARTIAL_WAKE_LOCK,   // ← 핵심
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

> **주의**: `FULL_WAKE_LOCK`은 Play Store 정책 위반이다. 반드시 `PARTIAL_WAKE_LOCK`을 사용할 것.

JS 쪽 브릿지는 간단하다.

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

## Step 2 — Foreground Service 작성

**`CassettePlayerService.kt`** — 재생 중임을 시스템에 알리는 서비스

```kotlin
class CassettePlayerService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startForegroundNotification(intent.getStringExtra("title") ?: "재생 중")
            ACTION_STOP  -> { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundNotification(title: String) {
        val channel = NotificationChannel(CHANNEL_ID, "Cassette Player",
            NotificationManager.IMPORTANCE_LOW)   // ← LOW가 중요 (아래 설명)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Cassette Player")
            .setContentText(title)
            .setOngoing(true)
            .setSilent(true)
            .build()

        // Android 10+: 미디어 재생 타입으로 선언
        startForeground(NOTIFICATION_ID, notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    }
}
```

`AndroidManifest.xml`에도 권한과 서비스 선언이 필요하다.

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<service android:name=".CassettePlayerService"
    android:foregroundServiceType="mediaPlayback" />
```

---

## Step 3 — 재생 흐름에 WakeLock 연결

```ts
// 트랙 재생 시작
const { sound } = await Audio.Sound.createAsync(...)
setIsPlaying(true);
acquireWakeLock();                   // CPU 유지
startForegroundService(item.title); // Doze 제외

// 일시정지 / 정지
wasPlayingRef.current = false;
releaseWakeLock();       // CPU 해제
stopForegroundService();
```

WakeLock은 acquire → release 짝을 반드시 맞춰야 한다. 재생이 끝났는데 release를 안 하면 배터리가 계속 소모된다.

---

## 함정 1 — 알림 채널 importance를 HIGH로 하면 안 된다

처음에 알림 채널을 `IMPORTANCE_HIGH`로 설정했다가 이상한 버그가 생겼다.

**트랙 1이 끝나고 트랙 2가 시작되면, 트랙 2가 즉시 일시정지됨.**

원인을 추적해보니, HIGH importance 알림이 표시될 때 **오디오 포커스를 빼앗는다**는 것이었다. 재생 알림을 업데이트할 때마다 트랙이 멈추는 셈이었다.

**해결**: 채널 importance를 `IMPORTANCE_LOW`로 낮추면 알림이 떠도 오디오 포커스에 영향을 안 준다.

---

## 함정 2 — 화면 켜질 때 다다음 곡으로 점프하는 버그

AppState가 `active`로 바뀔 때 트랙 상태를 복구하는 로직이 있다. 그런데 화면을 켜면 현재 곡이 아니라 그 **다다음 곡**이 재생되는 증상이 발생했다.

문제는 복구 로직에서 "트랙이 자연스럽게 끝났는지" vs "오디오 포커스 손실로 멈췄는지"를 구분하지 못하고 무조건 `advance()`를 호출했기 때문이다. `didJustFinish`가 발생하면 이미 `advance()`가 한 번 호출된 상태인데, AppState 복구에서 또 호출하니 두 번 넘어가는 것이었다.

```ts
// trackEndedRef로 구분
const trackEndedRef = useRef(false);

// 트랙이 자연 종료될 때
if (status.didJustFinish && !cancelRef.current) {
  trackEndedRef.current = true;   // 종료 표시
  advance();
}

// AppState 복구 시
if (soundRef.current) {
  const status = await soundRef.current.getStatusAsync();
  if (status.isLoaded && !status.isPlaying) {
    if (trackEndedRef.current) {
      // didJustFinish가 왔지만 advance가 미완료 → 다음 곡
      trackEndedRef.current = false;
      advance();
    } else {
      // 오디오 포커스 손실로 멈춘 것 → 재개
      await soundRef.current.playAsync();
    }
  }
}
```

---

## 함정 3 — position 체크로 "트랙 끝났는지" 판단하면 안 된다

초기 구현에서 `positionMillis >= durationMillis - 300` 조건으로 "트랙이 거의 끝났으니 다음 곡 재생"을 판단했다.

그런데 expo-av는 트랙 종료 후 `positionMillis`를 **0으로 리셋**하는 경우가 있다. 그러면 조건이 항상 false가 되어 복구가 안 된다.

**해결**: position 체크를 아예 제거하고, `wasPlayingRef`(재생 의도 상태)만 보는 것이다.

```ts
// 명시적으로 정지된 상태면 복구 불필요
if (!wasPlayingRef.current) return;
// → 이후 로직 진행
```

---

## Play Store 빌드 자동화

버그를 다 잡고 나니 스토어에 올려야 했다. 매번 `cd android && ./gradlew bundleRelease` 치는 게 귀찮아서 스크립트로 만들었다.

**`tools/build-store.sh`** (AAB 빌드 — Play Store용)

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/../artifacts/cassette-player/android"
OUTPUT="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

echo ">>> AAB 빌드 시작 (Play Store용)..."
cd "$ANDROID_DIR"
./gradlew bundleRelease

echo ""
echo ">>> 완료!"
echo ">>> 파일 위치: $OUTPUT"
ls -lh "$OUTPUT"
```

**`tools/build-apk.sh`** (APK 빌드 — 직접 설치용)

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/../artifacts/cassette-player/android"
OUTPUT="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

echo ">>> APK 빌드 시작..."
cd "$ANDROID_DIR"
./gradlew assembleRelease

echo ""
echo ">>> 완료!"
echo ">>> 파일 위치: $OUTPUT"
ls -lh "$OUTPUT"
```

```bash
chmod +x tools/build-apk.sh tools/build-store.sh

./tools/build-store.sh   # 스토어 등록용
./tools/build-apk.sh     # 기기 직접 설치용
```

> Play Store는 APK가 아니라 **AAB(Android App Bundle)** 포맷을 요구한다. APK로 올리려고 하면 오류가 난다.

---

## 트러블슈팅

**versionCode가 이미 사용됨**

Play Console 업로드 시 "Version code 1 is already used" 에러가 나면 `android/app/build.gradle`에서 버전 코드를 올려야 한다.

```groovy
defaultConfig {
    versionCode 2      // ← 1 → 2로 변경
    versionName "1.0.1"
}
```

`app.json`도 맞춰서 변경해두면 관리가 편하다.

```json
{ "expo": { "version": "1.0.1" } }
```

**Foreground Service 알림이 안 뜸**

`AndroidManifest.xml`에 `<service>` 선언이 없으면 서비스가 실행되지 않는다. `android:foregroundServiceType="mediaPlayback"` 속성도 함께 있어야 한다.

---

## 정리 — 핵심 흐름 한눈에

```
expo-av (staysActiveInBackground: true)
    ↓ 오디오는 계속 재생되지만 JS 스레드는 멈출 수 있음
PARTIAL_WAKE_LOCK
    ↓ CPU 유지, JS 스레드 스로틀링 방지
Foreground Service (FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    ↓ 시스템이 앱을 "활성 미디어 재생 중"으로 인식 → Doze 대상 제외
AppState 복구 로직 (wasPlayingRef + trackEndedRef)
    ↓ JS가 잠깐 멈췄을 때 화면 켜지면 자동 복구
```

다 합쳐야 비로소 "화면 꺼도 다음 곡이 넘어가는" 뮤직 플레이어가 완성된다. 하나라도 빠지면 특정 기기나 Android 버전에서 재생이 깨진다.
