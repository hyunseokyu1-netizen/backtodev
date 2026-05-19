---
title: 'Obsidian Git 모바일 설정 — 안드로이드에서 GitHub 동기화하기'
date: '2026-05-01'
description: 안드로이드에서 Obsidian Git 플러그인으로 GitHub 레포를 클론하고 자동 동기화까지 설정하는 방법
tags:
  - Obsidian
  - Git
  - Android
  - GitHub
  - 모바일
---

요즘 **LLM Wiki**라는 개념이 유행하고 있다. LLM을 공부하면서 배운 것들을 위키처럼 쌓아두는 방식인데, 나도 한번 해보고 싶었다. 어떤 툴을 쓸까 찾아보다가 자연스럽게 **Obsidian**으로 모였다. 마크다운 기반이라 개발자한테 익숙하고, 링크로 노트를 연결하는 방식이 위키 구조와 딱 맞는다.

PC에서 세팅을 마치고 GitHub에 연결해서 잘 쓰다 보니, 이번엔 이런 생각이 들었다.

> "이동 중에 생각난 것도 바로 기록하고 싶은데, 폰에서도 되지 않을까?"

Obsidian Git 플러그인은 모바일에서도 동작한다. 단, PC와 설정 방법이 조금 다르다. 모바일엔 시스템 git이 없기 때문에 플러그인이 자체적으로 내장된 git(isomorphic-git)을 사용한다. 덕분에 별도 앱 설치 없이 플러그인만으로 동작한다.

---

## 사전 준비

- 안드로이드 폰에 **Obsidian** 설치
- GitHub 계정 + 기존 볼트가 올라간 레포지토리
- **GitHub Personal Access Token (PAT)** — 없으면 아래에서 발급

### PAT 발급 방법

1. GitHub → `Settings` → `Developer settings`
2. `Personal access tokens` → `Tokens (classic)`
3. `Generate new token` 클릭
4. **repo** 권한 체크 → 생성
5. 토큰 복사해두기 (한 번만 보임)

> 토큰은 비밀번호와 같다. 메모장이나 채팅에 그냥 붙여넣기 금지.

---

## Step 1 — Obsidian 설치 + 볼트 생성

1. Play Store에서 **Obsidian** 설치
2. 앱 실행 → **새 볼트 만들기**
3. 이름은 PC와 동일하게 맞추는 게 혼란이 없음 (예: `Obsidian Vault`)

> 아직 비어있는 볼트여도 괜찮다. 어차피 GitHub에서 클론해올 거라.

---

## Step 2 — Obsidian Git 플러그인 설치

1. `설정(⚙️)` → `커뮤니티 플러그인`
2. **"제한 모드 해제"** 클릭 (안 하면 커뮤니티 플러그인 못 씀)
3. `커뮤니티 플러그인 탐색` → **"Obsidian Git"** 검색
4. 설치 → 활성화

---

## Step 3 — 인증 정보 입력 (중요)

모바일은 시스템 Keychain이 없어서 플러그인 설정에 직접 입력해야 한다.

`설정` → `Obsidian Git` 스크롤 내려서:

| 항목 | 입력값 |
|---|---|
| **Username** | GitHub 아이디 |
| **Password/Token** | 발급한 PAT |
| **Author name** | 커밋에 표시될 이름 |
| **Author email** | GitHub 계정 이메일 |

> Author name/email을 입력 안 하면 커밋할 때 에러가 난다. 꼭 채워둘 것.

---

## Step 4 — GitHub 레포 클론

여기서 많이 막힌다. 볼트를 만들었다고 Git 연결이 되는 게 아니라, **직접 클론 명령을 실행**해야 한다.

1. 하단 툴바 `≡` 메뉴 탭
2. 상단 검색창에 **"Clone"** 입력
3. **"Clone an existing remote repo"** 선택
4. URL 입력:
   ```
   https://github.com/유저명/레포이름.git
   ```
5. Vault 내 저장 경로: **비워두기** (루트에 바로 클론)
6. 확인 → 클론 시작

클론이 완료되면 GitHub에 올라간 모든 노트가 폰으로 내려온다.

---

## Step 5 — 자동 동기화 설정

`설정` → `Obsidian Git`에서 아래 값으로 설정:

| 항목 | 권장값 |
|---|---|
| Auto save interval | 10 (분) |
| Auto pull interval | 10 (분) |
| Pull on startup | 켜짐 |
| Disable popups for no changes | 켜짐 |

이렇게 하면 앱 켤 때 자동으로 최신 내용을 받아오고, 10분마다 변경사항을 푸시한다.

---

## 트러블슈팅

### "Can't find a valid git repository" 에러

가장 흔한 에러. 볼트를 새로 만들었는데 클론을 안 해서 발생한다.

→ **Step 4의 클론 과정을 실행하면 해결**

### 클론 중 인증 실패

PAT가 틀렸거나 입력을 안 한 경우. Step 3으로 돌아가서 Username과 Token 재확인.

### 커밋은 되는데 푸시가 안 됨

Author name/email 누락인 경우가 많다. 설정에서 채워주면 해결.

---

## 정리 — 전체 흐름 한눈에

```
Obsidian 설치 + 새 볼트 생성
    ↓
Obsidian Git 플러그인 설치 + 활성화
    ↓
플러그인 설정에 GitHub 인증 정보 입력
(Username / PAT / Author name / email)
    ↓
"Clone an existing remote repo" 실행
    ↓
GitHub URL 입력 → 클론 완료
    ↓
자동 동기화 간격 설정 (10분 권장)
    ↓
PC ↔ 폰 양방향 자동 동기화 완료
```

LLM Wiki를 쌓다 보면 이동 중에 생각나는 것들이 생긴다. 한 번 설정해두면 폰에서 메모하고 PC에서 이어 쓰고, 그냥 노트에만 집중할 수 있다.
