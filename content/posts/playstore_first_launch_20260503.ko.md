---
title: 'React Native 앱 Play Store 첫 출시 — 빌드부터 소개글 카피라이팅까지'
date: '2026-05-03'
publish_date: '2026-05-27'
description: AAB 빌드 자동화, versionCode 오류 해결, 스토어 소개글 작성, Play Console 권장 조치 분석까지 첫 출시에서 겪은 것들 정리
tags:
  - Android
  - Play Store
  - React Native
  - Expo
  - ASO
---

## 앱을 만들었다. 이제 올려야 한다

백그라운드 재생 버그도 잡고, 기능도 어느 정도 완성됐다. 이제 Play Store에 올릴 차례.

처음 출시라 모르는 게 많았다. AAB 파일이 뭔지, versionCode가 왜 오류가 나는지, 소개글은 어떻게 쓰는 건지. 하나씩 부딪히면서 알게 된 것들을 정리해봤다.

---

## APK vs AAB — 뭘 올려야 하나?

처음엔 APK를 빌드해서 올리려고 했다. 근데 Play Console이 AAB를 요구한다.

| 형식 | 용도 |
|------|------|
| **APK** | 기기에 직접 설치 (테스트, 사이드로드) |
| **AAB** | Play Store 업로드 전용 |

2021년 8월부터 신규 앱은 AAB(Android App Bundle)만 받는다. APK로 올리려 하면 오류가 난다.

### AAB 빌드 명령어

```bash
cd android
./gradlew bundleRelease
```

출력 파일 위치:
```
android/app/build/outputs/bundle/release/app-release.aab
```

빌드 시간이 처음엔 15~20분 걸렸다. C++ 네이티브 라이브러리(Reanimated, Gesture Handler)를 모두 컴파일하기 때문이다. 두 번째부터는 캐시 덕분에 1~2분으로 줄어든다.

### 매번 명령어 치기 귀찮으면 — sh 스크립트

```bash
#!/bin/bash
# tools/build-store.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/../artifacts/cassette-player/android"
OUTPUT="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

echo ">>> AAB 빌드 시작 (Play Store용)..."
cd "$ANDROID_DIR"
./gradlew bundleRelease

echo ">>> 완료!"
echo ">>> 파일 위치: $OUTPUT"
ls -lh "$OUTPUT"
```

```bash
chmod +x tools/build-store.sh
./tools/build-store.sh
```

APK용도 비슷하게 만들어두면 편하다 (`./gradlew assembleRelease`).

---

## 트러블슈팅: versionCode 1 is already used

Play Console에 파일을 업로드하니 이런 오류가 떴다.

> **Version code 1 is already used. Please use a different version code.**

처음 올렸을 때 검토에서 거절됐거나, 이전에 테스트 트랙에 올린 적이 있으면 versionCode 1은 이미 소진된 것으로 취급된다.

**해결법**: `android/app/build.gradle`에서 버전 코드를 올린다.

```groovy
defaultConfig {
    versionCode 2       // 1 → 2
    versionName "1.0.1"
}
```

`app.json`도 맞춰두는 게 관리가 편하다.

```json
{
  "expo": {
    "version": "1.0.1"
  }
}
```

수정 후 다시 `./gradlew bundleRelease` 실행하면 끝. 이번엔 캐시가 있어서 1분 12초 걸렸다.

---

## 스토어 소개글 — 기능 나열은 누구도 안 읽는다

처음 작성한 소개글:

> Classic cassette-style UI • Smooth and simple music playback • Retro-inspired design

읽고 나서 아무 느낌이 없다. 기능 나열은 독자의 마음을 건드리지 못한다.

**소개글에서 중요한 건 세 가지다:**
1. "왜 이 앱이 필요한지" 공감부터
2. 제약을 단점이 아닌 특징으로 표현
3. 마지막 문장에 여운

이 앱의 핵심 컨셉은 **"스킵 불가"**다. 요즘 음악 서비스에서 앞부분 조금 듣다 넘기는 습관에 대한 반작용으로 만든 앱이다. 카세트 테이프 시절처럼, 싫어도 끝까지 들어야 한다.

### 수정 후 소개글 (영문)

```
Remember when you actually listened to a whole song?

Cassette Player brings back the era when music wasn't something you scrolled 
through — it was something you sat with.

Load your own music onto Side A or Side B (30 minutes each, just like a real tape).
Hit play. And stay with it.

No skip button.
Want to move forward? Hold FF — just like the real thing.

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

### 수정 후 소개글 (한국어)

```
요즘 음악, 제대로 들은 적 있으세요?

앞부분 조금 듣다가 넘기고, 또 넘기고.
재생목록은 수백 곡인데 정작 끝까지 들은 노래는 몇 곡 안 되는 그 느낌.

카세트 테이프 시절엔 달랐습니다.
싫어도 끝까지 들었고, 그러다 어느 순간 그 노래가 좋아졌습니다.

스킵 버튼이 없습니다.
넘기고 싶으면 FF 버튼을 꾹 누르고 있어야 합니다. 진짜 테이프처럼.

트랙 사이마다 테이프 노이즈가 납니다.
그 지직거리는 소리까지 듣는 게 이 앱의 경험입니다.

Side A, Side B. 각 30분.
스트리밍 없이, 내 핸드폰에 있는 음악 파일만 담을 수 있습니다.

한 시간, 알고리즘 없이 내가 고른 노래만 들어보세요.
생각보다 훨씬 오래 기억에 남을 겁니다.
```

**바꾼 포인트 정리:**

| 기존 | 수정 |
|------|------|
| 기능 나열 | 공감 문장으로 시작 |
| "스킵할 수 없습니다" | "스킵 버튼이 없습니다" (능동적 선택처럼) |
| 노이즈 언급 없음 | "hiss is not a bug" — 단점을 특징으로 전환 |
| 설명으로 끝 | 여운 있는 마지막 문장 |

---

## 앱 이름 고민

기존 이름: **Cassette Tape Player: Retro**

문제는 레트로 앱이 다 쓰는 단어라 차별점이 없다는 것. 이 앱의 진짜 USP는 "스킵 못 함"이니 이름에서 그게 튀어야 한다.

| 이름 | 인상 |
|------|------|
| **Cassette — No Skip** | "No Skip"이 도발적. 스토어 목록에서 눈에 띔 |
| **Side A** | 단 6글자. 카세트 아는 사람은 바로 감이 오고, 모르는 사람은 호기심 유발 |
| **Cassette** | 깔끔하지만 다른 앱과 묻힐 수 있음 |

`Cassette — No Skip` / `카세트 — 스킵 없음` 조합이 가장 임팩트 있다. 이름만 봐도 "이게 무슨 뜻이지?" 하고 클릭하게 만드는 힘이 있다.

---

## 출시 노트 — 첫 출시는 철학을 담아라

첫 출시라 변경사항이 없다. 이럴 때 출시 노트는 앱의 철학을 짧게 담는 게 가장 좋다.

```
<en-US>
First release.

Cassette Player is a music player with no skip button.
Load your own music files onto Side A or Side B (30 min each).
Fast-forward by holding FF — just like a real tape.
Tape noise included.

Slow down. Stay with the music.
</en-US>
<ko-KR>
첫 출시입니다.

카세트 플레이어는 스킵 버튼이 없는 뮤직 앱입니다.
내 음악 파일을 Side A / B에 담고 (각 30분), FF 버튼을 꾹 눌러야 넘어갑니다.
트랙 사이 테이프 노이즈도 그대로입니다.

천천히, 끝까지 들어보세요.
</ko-KR>
```

출시 노트는 기존 사용자가 보는 글이지만, 첫 출시에는 새 사용자가 앱 페이지에서 읽는 경우도 많다. 기능 설명보다 한 번 써보고 싶게 만드는 게 더 중요하다.

---

## Play Console 권장 조치 2개 — 무시해도 될까?

앱을 올리고 나면 Play Console에서 "권장 조치"가 뜨는 경우가 있다. **권장(Recommended)** 이지 **필수(Required)** 가 아니라 출시를 막지는 않는다.

### 경고 1: Deprecated API 사용

```
android.view.Window.setStatusBarColor
android.view.Window.setNavigationBarColor
LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
...
```

Android 15에서 지원 중단된 API들인데, 출처를 보면:

```
com.facebook.react.modules.statusbar.StatusBarModule  ← React Native 내부
com.google.android.material.bottomsheet.*             ← Material 라이브러리
```

**직접 작성한 코드가 아니다.** Expo/React Native 프레임워크 내부에서 쓰는 API들이라 손댈 수가 없다. Expo SDK가 업그레이드되면 자동으로 해결된다. 지금 당장 고칠 필요 없다.

### 경고 2: screenOrientation 방향 제한

```xml
<activity android:name="com.hscassette.player.MainActivity"
    android:screenOrientation="PORTRAIT" />
```

Android 16부터 폴더블/태블릿에서 방향 고정이 무시된다는 경고인데, 카세트 플레이어 UI는 세로 고정이 당연히 맞다. 폴더블/태블릿이 이 앱의 주요 타겟도 아니다. 그냥 두면 된다.

**두 경고 모두 심사 통과에 영향 없다.**

---

## 정리: 첫 출시 체크리스트

```
빌드
├── ./gradlew bundleRelease (AAB 생성)
├── versionCode가 이전에 쓰인 번호면 +1
└── tools/build-store.sh 만들어두면 다음부터 편함

스토어 등록
├── 기능 나열 말고 공감 → USP → 여운 순서로 소개글 작성
├── 앱 이름: 제약이나 철학이 담긴 이름이 기능 설명 이름보다 기억에 남음
└── 출시 노트: 첫 출시엔 앱 철학 한 문단

Play Console 경고
├── Recommended = 필수 아님, 심사 통과에 영향 없음
├── RN 내부 Deprecated API → Expo SDK 업그레이드 때 자동 해결
└── screenOrientation → 의도적 설정이면 그냥 두면 됨
```

앱 하나 만드는 것보다 스토어에 올리는 과정에서 배운 게 더 많았다. 코드는 테스트하면 되지만, 소개글은 사람 마음을 테스트해야 하니까.
