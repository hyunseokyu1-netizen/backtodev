---
title: 'GitHub에 AAB 올렸다가 용량 경고 받은 후 — 빌드 파일 로컬 버전관리로 전환하기'
date: '2026-05-13'
publish_date: '2026-06-04'
description: Android 릴리즈 빌드 파일(AAB/APK)을 GitHub에 올리면 안 되는 이유와, 로컬 폴더로 버전 관리하는 방법
tags:
  - Android
  - AAB
  - GitHub
  - Git
  - ReactNative
---

## 왜 이 글을 쓰게 됐냐면

앱을 Play Store에 올리려고 AAB 파일을 빌드했다. 그리고 "버전 관리는 git으로!"라는 생각에 `store/v1.0/app-release.aab`를 커밋해서 GitHub에 올렸다.

그랬더니 푸시하자마자 이런 경고가 떴다.

```
remote: warning: File store/v2.0/app-release.aab is 63.80 MB;
remote: this is larger than GitHub's recommended maximum file size of 50.00 MB
remote: warning: GH001: Large files detected.
remote: You may want to try Git Large File Storage - https://git-lfs.github.com.
```

64MB짜리 파일 두 개를 올렸더니 GitHub에서 바로 노란불이 켜졌다.

사실 AAB/APK는 **빌드 결과물**이다. 소스코드가 아니라 컴파일된 바이너리다. 이런 파일은 git에 올리는 게 맞지 않다. `.gitignore`에 넣어야 할 대표적인 케이스다.

---

## 빌드 파일을 git에 올리면 안 되는 이유

| 이유 | 설명 |
|------|------|
| 용량 | AAB는 보통 50~100MB. 버전이 쌓이면 repo 크기가 폭증 |
| 불필요한 diff | 바이너리 파일은 git diff가 의미 없음 |
| 재현 가능 | 소스코드가 있으면 언제든 다시 빌드 가능 |
| GitHub 제한 | 100MB 초과 시 push 자체가 거부됨 |

---

## 해결 방법: 로컬 전용 폴더에서 버전 관리

GitHub에 올리지 않고, 로컬 폴더를 따로 만들어서 버전별로 정리하는 방식을 선택했다.

### 폴더 구조

```
~/Documents/workspace/apk_build_files/
└── tilt/
    ├── v1.0/
    │   └── app-release.aab   ← 초기 릴리즈
    └── v2.0/
        └── app-release.aab   ← 튜토리얼 추가 버전
```

프로젝트별로 폴더를 나누고, 그 안에 버전 폴더를 만들었다. 단순하지만 충분하다.

---

## 실제 작업 순서

### Step 1 — 로컬 보관 폴더 생성 및 파일 이동

```bash
# 폴더 생성
mkdir -p ~/Documents/workspace/apk_build_files/tilt/v1.0
mkdir -p ~/Documents/workspace/apk_build_files/tilt/v2.0

# git 저장소에 있던 AAB 파일을 로컬 폴더로 이동
mv store/v1.0/app-release.aab ~/Documents/workspace/apk_build_files/tilt/v1.0/
mv store/v2.0/app-release.aab ~/Documents/workspace/apk_build_files/tilt/v2.0/
```

### Step 2 — git에서 파일 제거

이미 커밋된 파일은 `git rm`으로 추적을 끊어야 한다. 로컬에서 파일을 지운 게 아니라 git 추적 목록에서만 빼는 것이다.

```bash
git rm -r store/v1.0/ store/v2.0/
```

### Step 3 — .gitignore에 추가

앞으로 실수로 다시 올라가지 않게 `.gitignore`에 등록한다.

```bash
echo "store/v1.0/" >> .gitignore
echo "store/v2.0/" >> .gitignore

# 또는 패턴으로 한 번에
echo "store/v*/" >> .gitignore
```

### Step 4 — 커밋 & 푸시

```bash
git add .gitignore
git commit -m "chore: AAB 빌드 파일 git에서 제거, 로컬 관리로 전환"
git push origin main
```

---

## 앞으로 새 버전 빌드할 때

```bash
# 빌드
./gradlew bundleRelease

# 결과물 복사
mkdir -p ~/Documents/workspace/apk_build_files/tilt/v3.0
cp android/app/build/outputs/bundle/release/app-release.aab \
   ~/Documents/workspace/apk_build_files/tilt/v3.0/
```

Play Store 업로드할 때는 `apk_build_files/tilt/v3.0/app-release.aab`를 쓰면 된다.

---

## .gitignore에 미리 넣으면 좋은 것들 (Android/Expo 기준)

```gitignore
# 빌드 결과물
android/app/build/
*.apk
*.aab
*.keystore   # 서명 키도 절대 올리면 안 됨

# 로컬 버전 관리 폴더
store/v*/
```

특히 `.keystore` 파일은 GitHub에 올라가면 보안 사고로 이어질 수 있다. 빌드 결과물과 함께 반드시 gitignore에 포함시키자.

---

## 정리

| 항목 | 방법 |
|------|------|
| 빌드 파일 보관 | 로컬 전용 폴더 (`apk_build_files/`) |
| 버전 구분 | 폴더명으로 (`v1.0/`, `v2.0/`) |
| git 추적 제거 | `git rm -r` |
| 재발 방지 | `.gitignore`에 패턴 추가 |

소스코드는 git으로, 빌드 결과물은 로컬로. 이게 기본 원칙이다.
