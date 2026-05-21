---
title: '안드로이드 앱 직접 설치하는 방법들 — APK부터 USB 디버깅까지'
date: '2026-05-04'
publish_date: '2026-05-28'
description: 구글 플레이 없이 안드로이드 앱을 설치하는 방법들과 ADB USB 디버깅으로 바로 설치하는 법까지 한 번에 정리
tags:
  - Android
  - ADB
  - React Native
  - Expo
  - 앱개발
---

앱을 만들고 나서 "이걸 어떻게 핸드폰에 넣지?"라는 생각이 든 적 있을 것이다.

구글 플레이에 올리자니 개발자 계정 등록에 심사에 시간이 걸린다. 테스트 목적인데 그 과정을 거치기엔 너무 번거롭다. 특히 내가 직접 만든 앱을 바로 써보고 싶을 때는 더더욱.

이 글에서는 안드로이드 앱을 플레이스토어 없이 설치하는 방법들을 단계별로 정리한다. 마지막엔 USB 디버깅으로 터미널에서 `adb install` 한 줄로 바로 설치하는 방법까지.

---

## 방법 1: APK 파일을 직접 전송해서 설치

가장 기본적인 방법이다. APK 파일을 핸드폰으로 옮기고 직접 실행하면 된다.

### APK란?

APK(Android Package)는 안드로이드 앱의 설치 파일이다. 윈도우의 `.exe`, 맥의 `.dmg` 같은 것이라고 생각하면 된다.

Expo나 React Native 프로젝트라면 아래 명령어로 APK를 만들 수 있다.

```bash
# Expo 프로젝트 → 네이티브 Android 프로젝트 생성
npx expo prebuild --platform android

# Gradle로 APK 빌드
cd android && ./gradlew assembleRelease
```

빌드가 완료되면 APK 파일은 여기 생긴다.

```
android/app/build/outputs/apk/release/app-release.apk
```

### APK를 핸드폰으로 옮기는 방법들

| 방법 | 설명 | 장단점 |
|---|---|---|
| 카카오톡 | 나한테 파일 전송 | 쉽지만 용량 제한 있음 |
| Google Drive / iCloud | 드라이브에 올리고 다운로드 | 업로드 시간 걸림 |
| AirDrop (맥 → 안드로이드) | 직접 안 됨, 중간 앱 필요 | 불편함 |
| USB 파일 전송 | 케이블 연결 후 직접 복사 | 빠르고 확실 |
| **adb install** | 터미널 명령어 한 줄 | 가장 빠름 (이 글의 핵심) |

### 설치 전 필수 설정: 알 수 없는 앱 허용

구글 플레이 외에서 받은 APK는 기본적으로 설치가 막혀 있다. 아래 경로에서 허용해줘야 한다.

**안드로이드 12 이상:**
```
설정 → 앱 → 오른쪽 상단 점 세 개 → 특별한 앱 접근 → 알 수 없는 앱 설치
→ 설치에 사용할 앱 선택 → 허용
```

**안드로이드 11 이하:**
```
설정 → 보안 → 알 수 없는 소스 → 허용
```

설정이 되면 APK 파일을 탭해서 설치하면 된다.

---

## 방법 2: EAS Build (Expo Application Services)

Expo 프로젝트라면 EAS를 써서 클라우드에서 APK를 빌드할 수 있다. 로컬 Android SDK 없이도 가능하다.

```bash
# EAS CLI 설치
npm install -g eas-cli

# Expo 계정 로그인
eas login

# 프로젝트 초기화
eas build:configure

# APK 빌드 (preview 프로파일 = APK, production = AAB)
eas build --platform android --profile preview
```

빌드가 끝나면 다운로드 URL이 나온다. QR 코드로 핸드폰에서 바로 다운로드도 가능.

**장점**: 로컬 환경 설정 없이 클라우드에서 빌드  
**단점**: 빌드 시간이 10~20분 걸림, 무료 플랜은 월 빌드 횟수 제한 있음

---

## 방법 3: ADB (Android Debug Bridge) — USB 디버깅

여기서부터가 핵심이다. ADB는 안드로이드 SDK에 포함된 커맨드라인 도구로, PC와 안드로이드 기기를 연결해서 다양한 작업을 할 수 있다.

APK 설치, 로그 확인, 파일 전송, 앱 강제 종료까지 전부 터미널에서 처리 가능하다.

### Step 1: Android SDK 설치 확인

Android Studio를 설치했다면 SDK는 이미 있다.

```bash
# 맥 기준 SDK 위치
ls ~/Library/Android/sdk/platform-tools/adb

# adb 버전 확인
~/Library/Android/sdk/platform-tools/adb version
```

없다면 Android Studio를 설치하거나, `sdk/platform-tools`만 별도로 다운로드할 수 있다.

**PATH에 추가해두면 편하다** (`~/.zshrc` 또는 `~/.bashrc`에 추가):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

```bash
source ~/.zshrc  # 적용
adb version      # 이제 adb만 입력해도 됨
```

### Step 2: 핸드폰에서 개발자 옵션 활성화

USB 디버깅은 개발자 옵션 안에 있다. 기본적으로 숨겨져 있어서 먼저 활성화해야 한다.

```
설정 → 휴대전화 정보 → 소프트웨어 정보 → 빌드 번호를 7번 빠르게 탭
```

"개발자가 되었습니다" 메시지가 뜨면 성공.

이제 개발자 옵션이 생긴다.

```
설정 → 개발자 옵션 → USB 디버깅 → 켜기
```

### Step 3: USB로 연결하고 기기 확인

케이블로 PC와 핸드폰을 연결한다. 핸드폰에 "USB 디버깅을 허용하시겠습니까?" 팝업이 뜨면 **확인** (또는 "이 컴퓨터에서 항상 허용" 체크 후 확인).

```bash
adb devices
```

출력 예시:
```
List of devices attached
R5KYA01JSXA    device
```

`device` 상태면 연결 성공. `unauthorized`면 핸드폰에서 팝업을 허용하지 않은 것.

### Step 4: APK 설치

```bash
adb install 앱이름.apk

# 기존 앱 덮어쓰기 (-r 옵션)
adb install -r 앱이름.apk
```

출력:
```
Performing Streamed Install
Success
```

`Success`가 뜨면 핸드폰 앱 목록에서 바로 확인할 수 있다.

---

## 자주 쓰는 ADB 명령어 모음

APK 설치 외에도 ADB로 할 수 있는 게 많다.

```bash
# 연결된 기기 목록
adb devices

# APK 설치
adb install -r app.apk

# 앱 제거 (패키지명 필요)
adb uninstall com.example.myapp

# 로그캣 (앱 로그 실시간 확인)
adb logcat

# 특정 태그만 필터
adb logcat -s ReactNativeJS

# 스크린샷 찍어서 PC로 저장
adb exec-out screencap -p > screenshot.png

# 파일 PC → 핸드폰으로 복사
adb push localfile.txt /sdcard/

# 파일 핸드폰 → PC로 복사
adb pull /sdcard/somefile.txt ./

# 앱 강제 종료
adb shell am force-stop com.example.myapp

# 앱 재시작
adb shell monkey -p com.example.myapp 1
```

---

## 트러블슈팅

### adb devices에 기기가 안 뜸

1. 케이블을 다시 꽂는다 (충전 전용 케이블이면 데이터 전송이 안 됨)
2. 핸드폰에서 USB 연결 방식을 확인한다 → "파일 전송(MTP)" 또는 "USB 디버깅"으로 설정
3. 팝업 재승인: `adb kill-server && adb start-server` 후 다시 연결

### unauthorized 상태

```bash
adb kill-server
adb start-server
adb devices
```

핸드폰에 팝업이 다시 뜬다. "이 컴퓨터에서 항상 허용" 체크 후 확인.

### 설치 실패: INSTALL_FAILED_VERSION_DOWNGRADE

기존에 설치된 앱보다 낮은 버전을 설치하려 할 때 발생.

```bash
# 기존 앱 먼저 제거 후 설치
adb uninstall com.example.myapp
adb install app.apk
```

### 설치 실패: INSTALL_PARSE_FAILED_NO_CERTIFICATES

릴리즈 APK는 서명이 필요하다. `assembleRelease`로 빌드했는데 서명 설정이 없으면 발생.

Expo prebuild 기본 설정으로 빌드하면 디버그 키로 자동 서명된다. 이 경우 테스트용으로는 문제없다.

---

## 정리: 상황별 추천 방법

| 상황 | 추천 방법 |
|---|---|
| 빠른 테스트 (케이블 있음) | `adb install` |
| 케이블 없이 지인에게 전달 | APK 파일 카카오톡/드라이브 전송 |
| 로컬 Android SDK 없음 | EAS Build |
| 팀원 여러 명에게 배포 | EAS Build + 다운로드 링크 공유 |
| 실서비스 배포 | 구글 플레이스토어 |

`adb install`이 익숙해지면 빌드 → 설치를 스크립트로 묶어서 한 번에 실행할 수 있다.

```bash
# build_and_install.sh
cd android && \
ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleRelease && \
~/Library/Android/sdk/platform-tools/adb install -r \
  app/build/outputs/apk/release/app-release.apk && \
echo "✅ 설치 완료"
```

`sh build_and_install.sh` 한 줄로 끝.
