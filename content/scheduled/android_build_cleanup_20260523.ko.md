---
title: 'Android 빌드 파일 정리하는 법 — 디스크 수 GB를 한 방에'
date: '2026-05-23'
publish_date: '2026-06-12'
description: 안드로이드 프로젝트 빌드 파일이 디스크를 잡아먹을 때, 안전하게 정리하는 방법 총정리
tags:
  - Android
  - Gradle
  - 개발환경
  - 디스크관리
---

## 어느 날 디스크가 꽉 찼다

개발하다 보면 어느 순간 맥이 "저장 공간이 부족합니다"를 외치기 시작한다. 파일을 뒤져봐도 뭐가 문제인지 딱히 보이지 않는데, 용량 분석 앱을 돌려보면 범인이 드러난다.

```
~/.gradle/caches    →  8.3 GB
~/AndroidStudioProjects/앱A/build  →  1.2 GB
~/AndroidStudioProjects/앱B/build  →  900 MB
~/AndroidStudioProjects/앱C/build  →  700 MB
```

Gradle 캐시와 각 프로젝트 빌드 폴더가 쌓이고 쌓여서 총 10GB 넘게 차지하고 있는 경우가 흔하다. 심지어 몇 달째 건드리지 않은 프로젝트도 여전히 자리를 차지하고 있다.

다 지워도 될까? 어떤 건 지우면 안 될까? 이걸 정리해본다.

---

## 빌드 파일이 뭔데 이렇게 클까

Android 프로젝트를 빌드하면 Gradle이 두 군데 파일을 쌓는다.

| 위치 | 역할 | 크기 |
|------|------|------|
| `~/.gradle/caches/` | 전역 Gradle 캐시 (라이브러리, 플러그인) | ★★★ 가장 큼 |
| `프로젝트/build/` | 프로젝트 루트 빌드 산출물 | ★★ |
| `프로젝트/app/build/` | APK, DEX, 중간 컴파일 파일 | ★★ |
| `프로젝트/.gradle/` | 프로젝트별 Gradle 래퍼 캐시 | ★ |
| `~/.gradle/wrapper/dists/` | Gradle 버전별 바이너리 | ★ |

`~/.gradle/caches/`가 주범인 경우가 많다. 여러 프로젝트에서 다운받은 라이브러리, 빌드 메타데이터가 전부 여기 쌓이는데 자동으로 지워지지 않는다.

---

## Step 1: 얼마나 쌓였는지 먼저 확인

무턱대고 지우기 전에 규모를 파악하자.

```bash
# Gradle 전역 캐시 크기
du -sh ~/.gradle/caches

# Gradle 전체 폴더 크기 (캐시 + 래퍼 포함)
du -sh ~/.gradle

# 특정 폴더 안의 모든 build 폴더 크기 확인
find ~/AndroidStudioProjects -name "build" -type d 2>/dev/null \
  | xargs du -sh 2>/dev/null \
  | sort -h
```

결과를 보면 뭐가 얼마나 차지하는지 한눈에 들어온다.

---

## Step 2: 프로젝트별 빌드 파일 정리

### 방법 A — Gradle 명령어로 clean

프로젝트 폴더 안에서 실행한다.

```bash
cd ~/AndroidStudioProjects/내프로젝트
./gradlew clean
```

`app/build/`, `build/` 폴더의 빌드 산출물을 삭제한다. 소스 코드는 건드리지 않는다. 다음에 빌드하면 다시 생긴다.

### 방법 B — Android Studio에서

**Build > Clean Project** 메뉴를 쓰면 같은 효과다. 현재 열린 프로젝트에만 적용된다.

### 방법 C — 한꺼번에 모든 프로젝트 정리

여러 프로젝트를 한 번에 정리하고 싶을 때:

```bash
# 먼저 어떤 폴더들이 있는지 확인
find ~/AndroidStudioProjects -name "build" -type d 2>/dev/null

# 확인 후 한꺼번에 삭제
find ~/AndroidStudioProjects -name "build" -type d -exec rm -rf {} + 2>/dev/null
```

> **주의**: `2>/dev/null`은 이미 지워진 하위 폴더 때문에 나오는 에러 메시지를 숨기는 옵션이다. 정상 동작이니 걱정 안 해도 된다.

---

## Step 3: Gradle 전역 캐시 정리 (핵심)

여기서 가장 많은 용량이 회수된다.

```bash
rm -rf ~/.gradle/caches
```

이걸 지우면 다음 빌드 시 라이브러리를 다시 인터넷에서 받아온다. 빌드 시간이 처음 한 번은 느리지만, 이후엔 다시 캐시되어 빨라진다. **소스 코드나 설정에는 영향 없다.**

---

## 정리해도 괜찮은 것 vs 조심할 것

| 경로 | 삭제 여부 | 이유 |
|------|----------|------|
| `~/.gradle/caches/` | ✅ 안전 | 다음 빌드 때 재생성 |
| `프로젝트/build/` | ✅ 안전 | 다음 빌드 때 재생성 |
| `프로젝트/app/build/` | ✅ 안전 | 다음 빌드 때 재생성 |
| `프로젝트/.gradle/` | ✅ 안전 | 래퍼 캐시, 재생성 가능 |
| `~/.gradle/wrapper/dists/` | ⚠️ 주의 | Gradle 바이너리 재다운로드 필요 |
| `~/.android/avd/` | ❌ 위험 | 에뮬레이터 설정 날아감 |
| `~/.android/sdk/` | ❌ 위험 | SDK 전체 삭제됨 |

`avd`와 `sdk`는 절대 건드리지 말 것. 에뮬레이터 설정이나 SDK가 통째로 날아간다.

---

## 한 방에 정리하는 스크립트

자주 쓸 것 같으면 쉘 함수로 만들어두면 편하다. `~/.zshrc` 또는 `~/.bashrc`에 추가:

```bash
android-clean() {
  echo "🧹 Gradle 캐시 정리 중..."
  rm -rf ~/.gradle/caches
  echo "🧹 프로젝트 build 폴더 정리 중..."
  find ~/AndroidStudioProjects -name "build" -type d -exec rm -rf {} + 2>/dev/null
  echo "✅ 완료! 현재 디스크 여유 공간:"
  df -h /
}
```

저장 후 `source ~/.zshrc` 실행하면 `android-clean` 명령어로 바로 쓸 수 있다.

---

## 정리 후 확인

```bash
df -h /
```

몇 GB씩 확보되는 걸 볼 수 있다. 나는 이번에 `.gradle/caches` 하나만 지웠는데 392MB였던 `.next` 캐시까지 합쳐서 디스크 여유 공간이 150MB에서 540MB로 늘었다.

---

## 정리

```
빌드 파일 정리 순서:

1. 규모 파악   → du -sh ~/.gradle/caches
2. 프로젝트 clean → ./gradlew clean (프로젝트별)
3. 전역 캐시 삭제 → rm -rf ~/.gradle/caches
4. 확인         → df -h /

건드리면 안 되는 것: ~/.android/avd/, ~/.android/sdk/
```

개발 환경은 쓰다 보면 꼭 이렇게 쌓인다. 분기에 한 번쯤 점검해주는 게 정신건강에 좋다.
