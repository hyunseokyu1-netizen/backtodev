---
title: '새 노트북으로 React Native(Expo) 프로젝트 옮겨서 빌드하기 — 내가 만난 4가지 함정'
date: '2026-06-22'
publish_date: '2026-07-03'
description: node_modules와 android 폴더를 복사해 온 새 맥에서 RN 앱을 빌드·설치할 때 겪은 JDK·node·Gradle 캐시·런처 문제를 차례로 해결한 기록
tags:
  - React Native
  - Expo
  - Android
  - Gradle
  - 트러블슈팅
---

## 노트북을 바꿨더니 빌드가 안 된다

개발하다 보면 노트북을 바꾸는 순간이 옵니다. 저도 작업하던 React Native(Expo) 앱을 새 맥으로 옮겼습니다. 보통 이럴 때 가장 무거운 `node_modules`는 다시 받으면 되니까 빼고, 나머지를 통째로 복사하죠. 저도 그렇게 했습니다. 정확히는 `node_modules`를 뺀다고 했는데 결과적으로 `node_modules`와 네이티브 `android/` 폴더가 같이 따라왔습니다.

그리고 평소처럼 빌드를 돌렸더니... 한 번에 네 개의 벽에 차례로 부딪혔습니다.

1. Java(JDK)가 없다
2. Gradle이 `node`를 못 찾는다
3. `No variants exist` 라는 정체불명의 Gradle 에러
4. 설치는 됐는데 앱 목록에 앱이 안 보인다

하나하나가 처음 보면 "이게 뭐지?" 싶은 것들이라, 같은 상황을 만날 분들을 위해 진단부터 해결까지 순서대로 정리해 봤습니다. 환경은 **macOS + Expo SDK 54 + React Native 0.81 + Android 실기기(USB 디버깅)** 기준입니다.

> 📌 이 글은 **빌드편(2편)**입니다. `node_modules`를 빼고 옮긴 프로젝트의 JS 의존성을 먼저 복원하는 과정은 [1편 — node_modules 없이 옮긴 프로젝트 복원하기](/posts/move_rn_project_20260621)를 참고하세요.

---

## 사전 상황 정리

먼저 제 출발점은 이랬습니다.

- 프로젝트 폴더를 새 맥으로 복사 (`node_modules`, `android/` 포함)
- Android Studio는 설치돼 있음
- 안드로이드 폰을 USB로 연결 (`adb devices`에 정상으로 잡힘)
- 릴리스 서명용 keystore(.jks)는 별도 백업 폴더에 보관

빌드 명령은 단순합니다. 프로젝트의 `android/` 폴더에서 Gradle을 돌리는 거죠.

```bash
cd android && ./gradlew assembleRelease
```

그런데 이 한 줄이 끝까지 가는 데 한참 걸렸습니다.

---

## Step 1. "Unable to locate a Java Runtime" — JDK가 없다

첫 에러는 이거였습니다.

```
The operation couldn't be completed. Unable to locate a Java Runtime.
Please visit http://www.java.com for information on installing Java.
```

새 노트북이라 JDK가 아예 없었던 겁니다. 그렇다고 java.com에서 JDK를 따로 받을 필요는 없습니다. **Android Studio를 설치했다면 그 안에 JDK(JBR, JetBrains Runtime)가 이미 들어 있거든요.**

맥에서는 보통 이 경로에 있습니다.

```bash
ls "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

이걸 `JAVA_HOME`으로 지정해서 Gradle을 돌리면 됩니다.

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
./gradlew assembleRelease
```

> 💡 시스템에 JDK가 있는지 한 번에 보고 싶다면: `/Library/Java/JavaVirtualMachines/` 폴더를 보거나, Homebrew로 깔았다면 `/opt/homebrew/opt/openjdk*` 를 확인하면 됩니다. 둘 다 없으면 Android Studio JBR이 가장 손쉬운 답입니다.

---

## Step 2. "Cannot run program node" — Gradle이 node를 못 찾는다

JDK를 잡아주니 이번엔 이 에러가 나왔습니다.

```
Cannot run program "node" ... error=2 (No such file or directory)
```

당황스러웠던 건, 분명 제 노트북엔 node가 깔려 있었다는 점입니다. `node -v`도 잘 됐고요. 그런데 왜 Gradle은 못 찾을까요?

이유는 **Expo의 autolinking 때문**입니다. RN 0.81 + Expo의 `android/settings.gradle`을 열어보면 이런 코드가 있습니다.

```groovy
providers.exec {
  commandLine("node", "--print",
    "require.resolve('@react-native/gradle-plugin/...')")
}
```

빌드 과정에서 Gradle이 직접 `node`를 실행해 의존성 경로를 알아내는 구조입니다. 즉, **Gradle을 실행하는 셸의 PATH에 node가 있어야** 합니다.

제가 node를 못 잡은 진짜 원인은 **nvm**이었습니다. nvm으로 node를 설치하면, node 실행 파일은 `~/.nvm/versions/node/<버전>/bin` 안에 있는데, 이 경로는 `~/.zshrc`에서 nvm 초기화 스크립트를 불러올 때 비로소 PATH에 올라옵니다. 새 노트북의 `.zshrc`엔 그 초기화 구문이 빠져 있었던 거죠.

급한 대로는 node 경로를 직접 PATH에 끼워 넣어 해결했습니다.

```bash
PATH="$HOME/.nvm/versions/node/v24.17.0/bin:$PATH" \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
./gradlew assembleRelease
```

근본적인 해결은 뒤에서 `.zshrc`에 정리합니다.

---

## Step 3. "No matching variant... No variants exist" — 진짜 함정

이제 진짜 골치 아픈 에러가 나왔습니다. 네이티브 모듈마다 이런 메시지가 줄줄이 떴습니다.

```
> Could not resolve project :react-native-screens.
   > No matching variant of project :react-native-screens was found.
     ... No variants exist.
```

`react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-webview`... 거의 모든 RN 라이브러리에서 "variant가 하나도 없다"고 합니다. 마치 라이브러리들이 빈 껍데기 프로젝트로 인식되는 모양새였죠.

### 첫 번째 의심: node_modules가 깨졌나?

복사해 온 `node_modules`가 불완전한가 싶어서, 먼저 `package-lock.json` 기준으로 깨끗하게 다시 받았습니다.

```bash
npm ci
```

`npm ci`는 기존 `node_modules`를 지우고 lock 파일 그대로 설치하기 때문에 "복사하다 일부 누락됐을지 모를" 상황에 딱 맞습니다. 그런데... 다시 빌드해도 **같은 에러**가 났습니다. 범인은 node_modules가 아니었던 겁니다.

### 진짜 원인: 복사돼 온 stale 빌드 캐시

핵심 단서는 `android/` 폴더가 **Git에 추적되지 않는다**는 점이었습니다. `.gitignore`에 `/android`가 들어 있었거든요.

```bash
git ls-files android/ | wc -l   # → 0
```

즉 `android/`는 `expo prebuild`로 만들어지는 순수 생성물이고, 그 안에는 이전 노트북에서 만들어진 **빌드 캐시 폴더**까지 함께 복사돼 온 상태였습니다.

```bash
ls -d android/.gradle android/build android/app/build
# 셋 다 존재 → 이전 환경의 절대 경로가 박제된 캐시
```

이 캐시 안에는 이전 노트북의 절대 경로가 그대로 들어 있습니다. 새 노트북에선 경로가 안 맞으니 Gradle이 라이브러리 프로젝트를 제대로 구성하지 못하고 "variant가 없다"고 뱉은 것이었죠.

여기서 한 가지 함정이 더 있습니다. **`./gradlew clean`으로는 `.gradle` 캐시가 안 지워집니다.** `clean`은 `build/` 산출물만 정리할 뿐이거든요. 그래서 직접 지웠습니다.

```bash
rm -rf android/.gradle android/build android/app/build android/.cxx
```

그리고 다시 빌드.

```bash
cd android && ./gradlew assembleRelease
```

```
BUILD SUCCESSFUL in 3m 13s
```

드디어 성공했습니다. 빌드된 APK는 여기에 떨어집니다.

```
android/app/build/outputs/apk/release/app-release.apk
```

이어서 USB로 연결된 기기에 설치했습니다.

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
# → Success
```

> ✅ 교훈: **프로젝트를 복사해서 옮길 때 `android/.gradle`, `android/build`, `android/app/build`는 가져오지 마세요.** 어차피 생성물이고, 오히려 이런 식으로 발목을 잡습니다. 깔끔하게 하려면 `npx expo prebuild --clean`으로 android 폴더 자체를 새로 만드는 방법도 있습니다(이 경우 keystore와 서명 설정은 다시 넣어줘야 합니다).

---

## Step 4. 설치는 됐는데 앱 목록에 안 보인다

`Success`가 떴으니 끝났겠거니 했는데, 폰의 앱 서랍을 아무리 뒤져도 앱 아이콘이 안 보였습니다. 분명 설치는 됐는데 말이죠.

먼저 정말 설치가 됐는지부터 확인했습니다.

```bash
adb shell pm list packages | grep chainplay
# → package:com.backdev.chainplay  (설치돼 있음)
```

설치는 분명히 됐습니다. 그럼 런처에서 실행할 메인 액티비티가 등록이 안 됐나 싶어 확인했더니, 이상한 결과가 나왔습니다.

```bash
adb shell cmd package resolve-activity --brief \
  -c android.intent.category.LAUNCHER com.backdev.chainplay
# → No activity found
```

그런데 `dumpsys`로 자세히 보니 `MainActivity`엔 `MAIN` + `LAUNCHER` 인텐트 필터가 멀쩡히 등록돼 있었습니다. 등록은 됐는데 런처에서 못 찾는다? 결정적 단서는 이 줄이었습니다.

```bash
adb shell dumpsys package com.backdev.chainplay | grep -i enabled
# ... enabled=3 ...
# lastDisabledCaller: com.lge.launcher3
```

`enabled=3`은 안드로이드에서 **`DISABLED_USER`**, 즉 "사용자에 의해 비활성화됨" 상태를 뜻합니다. 그리고 `lastDisabledCaller`가 `com.lge.launcher3` — **LG 런처가 이 앱을 비활성화**시켜 둔 상태였습니다. 아마 예전에 구버전 앱을 "사용 안 함" 처리했던 게 재설치 후에도 그대로 남아 있었던 것 같습니다.

해결은 간단합니다. 앱을 다시 활성화해 주면 됩니다.

```bash
adb shell pm enable com.backdev.chainplay
# → new state: enabled
```

이러고 나니 런처 액티비티도 정상으로 잡히고, 앱 서랍에도 아이콘이 떴습니다. `monkey`로 바로 실행도 확인했고요.

```bash
adb shell monkey -p com.backdev.chainplay \
  -c android.intent.category.LAUNCHER 1
```

> 참고로 안드로이드의 `enabled` 상태 값은 이렇게 나뉩니다.
>
> | 값 | 의미 |
> |---|---|
> | 0 | DEFAULT |
> | 1 | ENABLED |
> | 2 | DISABLED |
> | 3 | DISABLED_USER (사용자/런처가 비활성화) |
> | 4 | DISABLED_UNTIL_USED |

---

## 한 번 더 안 겪으려면: `.zshrc`에 환경 박아두기

매번 `JAVA_HOME=...`, `PATH=...`를 손으로 붙이는 건 고역입니다. 새 노트북에 정착할 거라면 셸 설정에 한 번 넣어두는 게 깔끔합니다. `~/.zshrc`에 이렇게 추가했습니다.

```bash
# --- Android / React Native 빌드 환경 ---
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# Gradle용 JDK (Android Studio 내장 JBR)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# nvm (node를 PATH에 올림 — Gradle autolinking이 node 필요)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
```

새 터미널을 열고 확인해 보면(또는 `source ~/.zshrc`):

```bash
node -v       # v24.17.0
which adb      # .../platform-tools/adb
java -version  # openjdk 21
```

이제 빌드는 환경 변수 없이 이 한 줄로 끝납니다.

```bash
cd android && ./gradlew assembleRelease && \
  adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## 자주 쓴 진단 명령어 모음

이번에 트러블슈팅하면서 유용했던 `adb`/Gradle 명령들을 정리해 둡니다.

| 목적 | 명령 |
|---|---|
| 연결 기기 확인 | `adb devices` |
| 설치된 패키지 검색 | `adb shell pm list packages \| grep <키워드>` |
| 설치 경로 확인 | `adb shell pm path <패키지명>` |
| 런처 액티비티 조회 | `adb shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER <패키지명>` |
| enabled/상태 확인 | `adb shell dumpsys package <패키지명> \| grep -i enabled` |
| 앱 활성화 | `adb shell pm enable <패키지명>` |
| 앱 실행 | `adb shell monkey -p <패키지명> -c android.intent.category.LAUNCHER 1` |
| Gradle 캐시 완전 삭제 | `rm -rf android/.gradle android/build android/app/build android/.cxx` |

---

## 정리 — 핵심 흐름 한눈에

새 노트북으로 RN/Expo 프로젝트를 옮겨 빌드하면서 배운 걸 순서대로 요약하면 이렇습니다.

1. **JDK는 Android Studio 내장 JBR로 충분하다** — `JAVA_HOME`만 잡아주면 됨
2. **Gradle은 빌드 중 `node`를 직접 실행한다** — 셸 PATH에 node가 없으면 실패. nvm 쓰면 `.zshrc` 초기화 필수
3. **`No variants exist`는 복사돼 온 stale 빌드 캐시가 범인일 수 있다** — `android/.gradle`·`build`·`app/build`를 통째로 지우면 해결. `gradlew clean`으론 부족함
4. **설치됐는데 앱이 안 보이면 `enabled` 상태를 의심하라** — `adb shell pm enable`로 부활

결국 네 가지 문제 모두 "새 환경인데 옛 환경의 흔적이 남아 있어서" 생긴 일이었습니다. 프로젝트를 옮길 땐 **생성물(빌드 캐시)과 환경 의존 설정(PATH, JAVA_HOME)을 새 환경 기준으로 다시 만든다**는 원칙만 기억하면, 다음번엔 훨씬 덜 헤맬 수 있을 겁니다.
