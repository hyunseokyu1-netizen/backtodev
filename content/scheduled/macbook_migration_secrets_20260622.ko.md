---
title: '맥북 바꿀 때 진짜 챙겨야 할 건 코드가 아니라 키값이다'
date: '2026-06-22'
publish_date: '2026-07-11'
description: git clone으로는 안 따라오는 서명키·환경변수·인증 정보를 새 맥북으로 안전하게 옮기는 법
tags:
  - git
  - macOS
  - Android
  - 시크릿관리
  - 개발환경
---

새 맥북을 받았다. 신난다. "코드는 다 GitHub에 있으니까 `git clone`만 하면 끝이지" 하고 가볍게 생각했다.

그런데 막상 옮기고 나니 앱 릴리스 빌드가 안 됐다. 서명키가 없어서다. 알고 보니 그 키 파일은 `.gitignore`에 걸려 있어서 **clone으로는 절대 안 따라오는** 파일이었다.

개발 환경을 옮길 때 진짜 위험한 건 코드가 아니다. **git에 안 올라가는 것들**이다. 이번에 직접 겪으면서 정리한, "이건 꼭 따로 챙겨야 한다"는 목록을 공유한다.

## 핵심 원칙: "git에 있는 것 vs 없는 것"으로 나눠라

옮길 대상을 딱 두 분류로 나누면 머리가 정리된다.

| 분류 | 예시 | 옮기는 법 |
|------|------|-----------|
| **git에 있는 것** | 소스코드, 커밋된 설정 파일 | `git clone` 하면 끝 |
| **git에 없는 것** | 서명키, `.env`, 인증 정보 | **수동으로 챙겨야 함** ← 여기가 함정 |

clone만 믿고 있다가 사고 나는 건 전부 아래쪽이다. 하나씩 보자.

## Step 1. 제일 위험한 것 — Android 릴리스 서명키

결론부터 말하면 이게 제일 위험하다. **잃어버리면 구글도 복구해주지 않는다.**

Android 앱을 Play Store에 올리려면 릴리스 키(`.jks` 또는 `.keystore`)로 서명해야 한다. 그런데 이 키는 보안상 거의 항상 `.gitignore`에 등록돼 있다. 즉 **git 저장소에 없다.** 직접 확인해보자.

```bash
# 이 키가 git에 추적되는지 확인
git check-ignore android/app/내릴리스키.jks
# → 경로가 출력되면 = gitignore됨 = clone으로 안 따라옴!

git ls-files android/app/내릴리스키.jks
# → 아무것도 안 나오면 = git에 없음 = 수동 백업 필수
```

내 경우 `check-ignore`에 경로가 그대로 찍혔다. clone 방식으로 옮겼다면 이 키를 통째로 날릴 뻔했다.

### 키만 챙기면 안 된다 — 비밀번호도 세트다

키스토어 파일만 있고 서명 비밀번호를 모르면 **그 키는 무용지물**이다. 비밀번호는 보통 `build.gradle`이나 `gradle.properties`에 들어 있다.

```gradle
// android/app/build.gradle
signingConfigs {
    release {
        storeFile file('내릴리스키.jks')
        storePassword "..."   // ← 이것도 같이 백업해야 함
        keyAlias "..."
        keyPassword "..."     // ← 이것도
    }
}
```

그래서 백업할 때는 **키 파일 + 비밀번호가 든 설정 파일**을 한 세트로 묶었다.

```bash
BK=~/Desktop/release-keys-backup
mkdir -p "$BK"
cp android/app/내릴리스키.jks       "$BK/"
cp android/app/build.gradle         "$BK/"   # 비밀번호 포함
cp android/gradle.properties        "$BK/"
```

> ⚠️ 서명키는 분실 대비해 **2벌 이상** 두는 게 정석이다. 맥북 1대 + 외장 SSD처럼 물리적으로 분리해서 보관하자. 비밀번호가 평문으로 들어 있으니 암호 건 zip이나 1Password 같은 곳에 넣어두면 더 안전하다.

### 반대로, 백업 안 해도 되는 것

전부 챙기려고 욕심내면 오히려 헷갈린다. **자동으로 재생성되는 건 그냥 버려도 된다.**

| 파일 | 백업? | 이유 |
|------|:----:|------|
| `release.jks` / `.keystore` | ✅ 필수 | 잃으면 복구 불가 |
| `~/.android/debug.keystore` | ❌ 불필요 | 첫 빌드 때 자동 생성 (디버그 전용) |
| `~/.android/adbkey` | ❌ 불필요 | adb 기기 인증키, 재생성됨 |
| `~/.android/avd`, `cache` | ❌ 불필요 | 에뮬레이터·캐시 |

`~/.android/` 폴더는 통째로 안 옮겨도 개발에 지장 없다. **딱 릴리스 서명키만** 신경 쓰면 된다.

## Step 2. 환경변수 — `.env.local`

두 번째 함정은 `.env` 파일이다. 이것도 거의 항상 `.gitignore`에 들어 있다. API 키, DB 비밀번호, 토큰이 다 여기 있는데 clone하면 빈손으로 시작하게 된다.

```bash
# 프로젝트에 숨어 있는 env 파일 찾기
ls -la | grep -E "\.env"
# .env.local, .envrc 등이 보이면 이건 따로 옮겨야 함
```

내 프로젝트의 `.env.local`에는 `GITHUB_TOKEN`, `JWT_SECRET`, `DEEPL_API_KEY` 같은 게 들어 있었다. 이게 없으면 앱의 절반이 동작을 안 한다.

`.env` 파일은 **평문 시크릿 덩어리**라 전송 경로가 중요하다. AirDrop이나 USB로 직접 옮기고, 메신저·이메일·공개 클라우드는 피하자.

> 💡 폴더째로 AirDrop하면 `.env.local` 같은 숨김파일도 같이 따라간다. Finder에서 숨김파일이 안 보이면 `Cmd + Shift + .` 를 누르면 보인다.

## Step 3. git / GitHub 인증 — 복사하지 말고 다시 로그인

여기서 많이 헷갈린다. "git 인증 정보도 파일로 복사해야 하나?" 답은 **대부분 아니오**다.

macOS에서 git 인증은 파일이 아니라 **Keychain(키체인)** 에 저장된다. `~/.gitconfig`를 열어보면 이렇게 돼 있다.

```bash
git config --global --list | grep credential
# credential.helper=osxkeychain   ← 인증은 Keychain에 있다는 뜻
```

`gh` CLI 토큰도 마찬가지로 keyring(Keychain)에 들어간다. 그래서 **파일을 복사해서 옮기는 것보다, 새 맥북에서 다시 로그인하는 게 더 간단하고 안전하다.**

```bash
# 새 맥북에서 — git 기본 설정 (3줄이면 끝)
git config --global user.name "내이름"
git config --global user.email "내이메일"

# GitHub 인증은 재로그인 (토큰 새로 발급됨)
gh auth login
```

정리하면 git 관련은 이렇게 나뉜다.

| 항목 | 위치 | 옮기는 법 |
|------|------|-----------|
| `~/.gitconfig` (이름·이메일·설정) | 파일 | 복사 가능, 또는 3줄로 재설정 |
| git/gh **인증 토큰** | macOS Keychain | **복사 X → 재로그인** |
| SSH 키 `~/.ssh/id_rsa` | 파일 | 복사하거나 새로 만들어 GitHub에 등록 |

SSH 키만 실제 파일이라, 복사하든 새로 생성해서 등록하든 선택하면 된다.

## 자주 쓰는 점검 명령어 모음

옮기기 전에 "뭐가 git에 없는지" 한 번에 훑는 명령어들이다.

```bash
# 1. 프로젝트 안 숨은 env 파일 찾기
ls -la | grep -E "\.env"

# 2. 워크스페이스 전체에서 서명키 검색
find ~/workspace -type f \( -name "*.keystore" -o -name "*.jks" \) | grep -v node_modules

# 3. 특정 키가 gitignore됐는지 확인
git check-ignore 경로/내키.jks

# 4. git 인증 방식 확인
git config --global --list | grep credential
```

## 트러블슈팅

**Q. 폴더를 통째로 AirDrop했는데 너무 느려요.**
A. 십중팔구 `node_modules` 때문이다. 보내기 전에 `rm -rf node_modules` 하고, 새 맥북에서 `npm install`로 다시 깔면 훨씬 빠르다.

**Q. `.env.local`을 분명히 복사했는데 새 맥북에 안 보여요.**
A. 숨김파일이라 그렇다. Finder에서 `Cmd + Shift + .` 로 숨김파일 표시를 켜자.

**Q. 서명키 비밀번호를 어디다 적어놨는지 모르겠어요.**
A. `android/app/build.gradle`이나 `gradle.properties`에서 `storePassword` / `keyPassword`를 찾아보자. 보통 여기 평문으로 들어 있다.

## 정리

맥북 교체에서 진짜 챙겨야 할 건 코드가 아니라 **git에 안 올라가는 것들**이다.

1. **Android 릴리스 서명키** (`.jks`/`.keystore`) — gitignore돼서 clone으로 안 따라옴. **키 + 비밀번호 세트로 백업**. 잃으면 복구 불가
2. **`.env.local`** — 평문 시크릿. AirDrop/USB로 직접 전송
3. **git/gh 인증** — Keychain에 있으니 복사 말고 **재로그인**. SSH 키만 파일로 챙기기
4. **`~/.android/debug.keystore` 같은 건 백업 불필요** — 자동 재생성됨

clone은 코드만 옮겨준다. 나머지는 직접 챙겨야 한다는 걸 기억하면, 새 맥북에서 "왜 빌드가 안 되지?" 하며 당황할 일이 없다.
