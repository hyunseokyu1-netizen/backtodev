---
title: 'Obsidian Git 플러그인 설정하다가 xcrun 에러 만난 이야기'
date: '2026-05-01'
description: Obsidian을 GitHub에 연결하고 Git 플러그인을 설정하는 과정에서 만난 xcrun 에러 해결법
tags:
  - Obsidian
  - Git
  - macOS
  - GitHub
  - xcode
---

LLM Wiki를 시작하면서 Obsidian을 쓰기로 했다. 마크다운 기반이라 개발자한테 친숙하고, 노트끼리 링크로 연결하는 구조가 위키랑 잘 맞는다.

그런데 로컬에만 저장하면 불안하다. 맥이 날아가면? 그래서 GitHub에 연결해서 자동 백업까지 설정했다. 과정은 간단했는데, 마지막에 예상치 못한 에러가 하나 튀어나왔다.

---

## 왜 Obsidian + Git인가

Obsidian은 마크다운 기반이라 파일이 전부 텍스트다. Git으로 버전 관리하기에 딱 좋은 구조다. 게다가 여러 기기에서 쓴다면 GitHub를 중간 저장소로 쓰면 Obsidian Sync(유료) 없이도 동기화가 가능하다.

---

## 사전 준비

- Obsidian 설치
- GitHub 계정 + 빈 레포지토리 생성
- 맥 터미널 기본 사용법

---

## Step 1 — GitHub 레포 연결

먼저 볼트 폴더를 Git 레포로 초기화하고 GitHub에 연결한다.

```bash
cd ~/Documents/Obsidian\ Vault
git init
git remote add origin https://github.com/유저명/obsidian-vault.git
git add .
git commit -m "Initial vault commit"
git push -u origin main
```

---

## Step 2 — Obsidian Git 플러그인 설치

Obsidian 앱 안에서 설치한다.

1. `설정(⚙️)` → `커뮤니티 플러그인` → `커뮤니티 플러그인 탐색`
2. **"Obsidian Git"** 검색 → 설치 → 활성화

설치하면 `.obsidian/plugins/obsidian-git/` 폴더가 생기고, `data.json`에 설정이 저장된다.

---

## Step 3 — 자동 동기화 설정

기본 설치 상태에서는 자동 커밋/푸시/풀이 전부 꺼져 있다. 아래처럼 설정하면 편하다.

| 항목 | 권장값 | 설명 |
|---|---|---|
| Auto save interval | 10분 | 10분마다 자동 커밋+푸시 |
| Auto pull interval | 10분 | 10분마다 원격에서 풀 |
| Pull on startup | 켜짐 | 앱 시작 시 최신 상태로 |
| Disable popups for no changes | 켜짐 | 변경 없으면 알림 생략 |

Obsidian 설정 UI에서 바꾸거나, `data.json`을 직접 수정해도 된다.

```json
"autoSaveInterval": 10,
"autoPushInterval": 10,
"autoPullInterval": 10,
"autoPullOnBoot": true,
"disablePopupsForNoChanges": true
```

---

## Step 4 — GitHub 인증 설정

HTTPS로 연결했다면 GitHub Personal Access Token(PAT)이 필요하다.

**토큰 발급:**
1. GitHub → `Settings` → `Developer settings` → `Personal access tokens` → `Tokens (classic)`
2. `Generate new token` → `repo` 권한 체크 → 생성

**macOS Keychain에 저장 (터미널):**

```bash
git config --global credential.helper osxkeychain
```

이후 처음 push/pull 할 때 GitHub 계정과 토큰을 입력하면 Keychain에 저장돼서 이후엔 자동 인증된다.

> **주의:** 토큰은 절대 채팅, 코드, 공개 저장소에 올리지 말 것. 유출되면 즉시 폐기하고 재발급해야 한다.

---

## 트러블슈팅 — xcrun 에러

설정 다 끝내고 Obsidian을 켰더니 이런 팝업이 떴다.

```
xcrun: error: invalid active developer path (/Library/Developer/CommandLineTools),
missing xcrun at: /Library/Developer/CommandLineTools/usr/bin/xcrun
```

Git이 내부적으로 `xcrun`을 호출하는데, Xcode Command Line Tools가 제대로 설치되지 않아서 발생하는 에러다. macOS를 업그레이드하거나 클린 설치한 후 자주 나타난다.

**해결법:**

터미널에서 아래 두 명령어를 순서대로 실행한다.

```bash
# 1. Command Line Tools 설치 (팝업 뜨면 "설치" 클릭)
xcode-select --install

# 2. 설치 완료 후 경로 리셋
sudo xcode-select --reset
```

설치에는 몇 분 정도 걸린다. 완료 후 Obsidian을 재시작하면 에러가 사라진다.

---

## 정리 — 전체 흐름 한눈에

```
GitHub 레포 생성
    ↓
볼트 폴더에서 git init + remote 연결
    ↓
Obsidian에서 Git 플러그인 설치 + 활성화
    ↓
자동 커밋/풀 간격 설정 (10분 권장)
    ↓
GitHub PAT 발급 + Keychain 저장
    ↓
(에러 발생 시) xcode-select --install + --reset
    ↓
Obsidian 재시작 → 자동 동기화 완료
```

한 번만 세팅해두면 이후엔 신경 안 써도 10분마다 알아서 백업된다. PC 설정이 끝났다면, 안드로이드에서도 같은 볼트를 연결하는 방법은 [다음 포스트](/posts/obsidian_git_mobile_20260501)에서 이어진다.
