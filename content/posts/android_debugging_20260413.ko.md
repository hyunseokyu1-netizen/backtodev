---
title: 앱 테스트시 빠르게 폰에서 하는법 (무선디버깅 사용법)
date: '2026-04-13'
description: 안드로이드 무선디버깅 하는법
tags:
  - android
---
# 맥북 ↔ 안드로이드 무선 디버깅 설정하기 (케이블 없이 APK 설치)

> 개발하다 보면 APK를 폰에 설치할 일이 자주 생긴다.  
> USB 케이블 꽂았다 뺐다 하기 귀찮지 않았나? 나도 그랬다.  
> ADB 무선 디버깅을 설정해두면 맥북에서 명령어 한 줄로 바로 설치할 수 있다.

---

## ADB가 뭐야?

**ADB(Android Debug Bridge)** 는 안드로이드 기기와 개발 PC를 연결해주는 커맨드라인 도구다.  
보통은 USB 케이블로 연결해서 사용하는데, **Android 11부터 Wi-Fi로도 연결**할 수 있게 됐다.

---

## 사전 준비

### 맥북

Android Studio를 설치했다면 ADB가 이미 있다.  
터미널에서 확인해보자:

```bash
adb version
```

`Android Debug Bridge version 1.x.x` 이런 출력이 나오면 OK.  
없다면 Android Studio를 설치하거나 Homebrew로 설치한다:

```bash
brew install android-platform-tools
```

### 안드로이드 폰 - 개발자 옵션 활성화

개발자 옵션은 기본적으로 숨겨져 있다. 아래 순서로 활성화한다:

1. **설정** → **휴대폰 정보**
2. **빌드 번호**를 **7번 연속 탭**
3. "개발자가 되었습니다" 메시지 확인

---

## 무선 디버깅 연결 순서

### Step 1. 폰에서 무선 디버깅 켜기

**설정 → 개발자 옵션 → 무선 디버깅** 을 **ON**으로 켠다.

> ⚠️ 맥북과 안드로이드 폰이 **같은 Wi-Fi**에 연결되어 있어야 한다.

### Step 2. IP 주소와 포트 확인

무선 디버깅을 켠 상태에서 해당 메뉴를 탭해서 들어가면:

```
IP 주소 및 포트
192.168.x.x:xxxxx
```

이 주소를 메모해둔다.

> 💡 포트 번호는 무선 디버깅을 껐다 켤 때마다 바뀐다.  
> 연결이 안 될 때는 다시 확인하자.

### Step 3. 맥북 터미널에서 연결

```bash
adb connect 172.30.1.12:45831
```

성공하면:

```
connected to 172.30.1.12:45831
```

연결된 기기 목록을 확인하려면:

```bash
adb devices
```

```
List of devices attached
172.30.1.12:45831    device
```

### Step 4. APK 설치

```bash
adb -s 172.30.1.12:45831 install -r /path/to/app-release.apk
```

- `-s 172.30.1.12:45831` : 여러 기기 연결 시 대상 지정
- `-r` : 기존 앱이 있으면 덮어쓰기 (reinstall)

성공하면:

```
Performing Streamed Install
Success
```

폰에 앱이 바로 설치된다. 🎉

---

## 자주 쓰는 ADB 명령어

```bash
# 연결된 기기 목록
adb devices

# APK 설치
adb install -r app.apk

# 앱 로그 보기 (특정 태그)
adb logcat -s "MyTag"

# 파일 전송 (폰 → 맥)
adb pull /sdcard/file.txt ./

# 파일 전송 (맥 → 폰)
adb push ./file.txt /sdcard/
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `Connection refused` | 포트가 바뀜 | 폰에서 무선 디버깅 IP:포트 다시 확인 |
| `device offline` | 연결 끊김 | `adb connect IP:포트` 재실행 |
| `adb: not found` | ADB 미설치 | `brew install android-platform-tools` |
| 연결은 됐는데 install 실패 | USB 디버깅 권한 | 폰 화면에 나오는 권한 팝업 허용 |

---

## 정리

케이블 없이 무선으로 APK를 설치하는 흐름은 이렇다:

```
폰: 설정 → 개발자 옵션 → 무선 디버깅 ON → IP:포트 확인
맥: adb connect IP:포트
맥: adb install -r app.apk
```

한 번 설정해두면 같은 Wi-Fi 환경에서는 두 번째 줄부터만 실행하면 된다.  
빌드하고 바로 폰에서 확인하는 개발 사이클이 훨씬 빨라진다.

---

> **참고**  
> - Android 공식 문서: [Run apps on a hardware device](https://developer.android.com/studio/run/device)  
> - ADB는 Android Studio 설치 시 `~/Library/Android/sdk/platform-tools/` 에 포함됨
