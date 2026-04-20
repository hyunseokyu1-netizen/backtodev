---
title: 'Claude Code Hooks — "이 작업 끝나면 자동으로 해줘"를 설정하는 법'
date: '2026-04-20'
description: 파일 저장 시 자동 포맷, 응답 완료 알림, 승인 요청 알림까지 — Claude Code Hooks로 반복 작업을 자동화하는 방법을 단계별로 정리했다.
tags:
  - ClaudeCode
  - Hooks
  - 자동화
---

Claude Code를 쓰다 보면 이런 생각이 들 때가 있다.

> "파일 저장할 때마다 자동으로 포맷터 돌려주면 안 되나?"  
> "Claude 응답 끝나면 알림 좀 울려줬으면…"  
> "승인 요청 왔는데 딴 창 보다가 놓쳤다…"

이걸 매번 수동으로 하거나, "나중에 설정해야지" 하고 미루고 있었다면 — Hooks가 바로 그 답이다.

---

## Hooks가 뭔데?

Claude Code의 Hooks는 특정 **이벤트가 발생할 때 자동으로 실행되는 셸 명령어**다.

예를 들어:

- Claude가 파일을 편집한 직후 → `prettier` 자동 실행
- Claude 응답이 끝난 직후 → macOS 알림 팝업 + 효과음
- Claude가 승인을 기다릴 때 → 다른 소리로 알림
- Bash 명령어 실행 전 → 로그 파일에 기록

Claude Code 자체가 실행하는 거라서, 내가 직접 명령어를 치지 않아도 된다. 한 번 설정하면 그냥 돌아간다.

---

## 어디에 설정하나?

Hooks는 `settings.json`에 작성한다. 파일 위치는 세 가지다:

| 파일 경로 | 범위 | Git 커밋 |
|---|---|---|
| `~/.claude/settings.json` | 전체 프로젝트 공통 (글로벌) | X |
| `.claude/settings.json` | 현재 프로젝트 (팀 공유) | O |
| `.claude/settings.local.json` | 현재 프로젝트 (개인용) | X |

개인 편의 기능(알림, 포맷터 등)은 글로벌 설정에, 팀 전체가 써야 하는 규칙은 프로젝트 설정에 넣는 게 좋다.

---

## Hook 구조 한눈에 보기

```json
{
  "hooks": {
    "이벤트명": [
      {
        "matcher": "툴이름",
        "hooks": [
          {
            "type": "command",
            "command": "실행할 셸 명령어"
          }
        ]
      }
    ]
  }
}
```

- **이벤트명**: 언제 실행할지 (`Stop`, `Notification`, `PostToolUse`, `PreToolUse` 등)
- **matcher**: 어떤 툴에 반응할지 (`Write`, `Edit`, `Bash` 등). Stop/Notification 이벤트는 matcher 불필요
- **command**: 실제로 실행할 셸 명령어

---

## 주요 이벤트 종류

| 이벤트 | 언제 발생하나 |
|---|---|
| `Stop` | Claude가 응답을 마치고 대기 상태로 전환될 때 |
| `Notification` | 승인 요청 등 Claude Code가 알림을 발생시킬 때 |
| `PostToolUse` | 툴(Write, Edit, Bash 등) 실행 성공 후 |
| `PreToolUse` | 툴 실행 직전 |
| `SessionStart` | 세션이 시작될 때 |
| `PreCompact` | 컨텍스트 압축 직전 |

---

## 실습 Step by Step

### Step 1 — 글로벌 설정 파일 열기

```bash
# 터미널에서 직접 열거나
open ~/.claude/settings.json

# 또는 Claude Code 안에서
# ! open ~/.claude/settings.json
```

파일이 없으면 새로 만들면 된다:

```json
{}
```

### Step 2 — Stop 훅: 응답 완료 알림 + 효과음 (macOS)

Claude가 응답을 끝냈을 때 macOS 알림 팝업과 효과음이 울리게 해보자.

처음엔 `osascript`의 `sound name` 옵션으로 소리를 붙이려 했는데, 실제로 써보니 알림은 뜨지만 **소리가 안 나는 경우**가 있었다. 알림 설정이나 macOS 버전에 따라 동작이 달라지는 것 같다.

그래서 알림과 소리를 아예 분리하는 방식으로 바꿨다. `osascript`는 팝업만 담당하고, 효과음은 `afplay`로 직접 재생한다.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude가 응답을 완료했습니다. 입력 대기 중.\" with title \"Claude Code\"' 2>/dev/null; afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true",
            "async": true
          }
        ]
      }
    ]
  }
}
```

**포인트:**
- `async: true` — 알림이 Claude 응답을 블로킹하지 않도록 비동기 실행
- `osascript` — 알림 팝업만 담당 (sound name 사용 안 함)
- `afplay` — 효과음 직접 재생. macOS 내장 사운드 파일 경로를 그대로 넘김
- `;`로 두 명령어 연결 — 앞이 실패해도 뒤가 실행됨
- `2>/dev/null || true` — 에러가 나도 Hook이 실패로 처리되지 않도록

**사용 가능한 macOS 내장 사운드:**

```
/System/Library/Sounds/Glass.aiff
/System/Library/Sounds/Ping.aiff
/System/Library/Sounds/Funk.aiff
/System/Library/Sounds/Basso.aiff
/System/Library/Sounds/Hero.aiff
/System/Library/Sounds/Purr.aiff
```

취향껏 바꿔서 쓰면 된다.

### Step 3 — Notification 훅: 승인 요청 알림

Claude Code는 파일 편집, 명령어 실행 등 민감한 작업을 할 때 사용자 승인을 요청한다. 문제는 딴 창 보다가 이걸 놓치면 Claude가 아무것도 못 하고 그냥 멈춰 있다는 것.

`Notification` 이벤트를 쓰면 승인 요청이 왔을 때 바로 알림을 받을 수 있다.

```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"승인이 필요합니다. Claude가 대기 중입니다.\" with title \"Claude Code\"' 2>/dev/null; afplay /System/Library/Sounds/Ping.aiff 2>/dev/null || true",
            "async": true
          }
        ]
      }
    ]
  }
}
```

Stop 훅과 소리를 다르게 설정한 게 포인트다.

- **Stop** → `Glass.aiff` : "응답 완료, 이제 입력해도 돼"
- **Notification** → `Ping.aiff` : "잠깐, 승인이 필요해"

소리만 들어도 어떤 상황인지 바로 구분이 된다.

### Step 4 — PostToolUse 훅: 파일 저장 후 자동 포맷

Claude가 파일을 편집하면 자동으로 `prettier`를 실행하는 훅이다.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path // .tool_response.filePath' | { read -r f; prettier --write \"$f\" --ignore-unknown; } 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

**어떻게 동작하나:**
1. Hook은 실행 시 JSON을 stdin으로 받는다
2. `jq`로 파일 경로를 꺼낸다
3. 그 파일에 prettier를 실행한다

### Step 5 — PreToolUse 훅: Bash 명령어 로그 남기기

Claude가 실행하는 모든 Bash 명령어를 로그 파일에 기록해두고 싶다면:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '\"[\" + (now | strftime(\"%Y-%m-%d %H:%M:%S\")) + \"] \" + .tool_input.command' >> ~/.claude/bash-history.log"
          }
        ]
      }
    ]
  }
}
```

이러면 `~/.claude/bash-history.log` 에 타임스탬프와 함께 명령어가 쌓인다.

### Step 6 — 모두 합치기

지금까지 만든 훅을 하나의 설정 파일에 합치면 이렇게 된다:

```json
{
  "language": "Korean",
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"승인이 필요합니다. Claude가 대기 중입니다.\" with title \"Claude Code\"' 2>/dev/null; afplay /System/Library/Sounds/Ping.aiff 2>/dev/null || true",
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude가 응답을 완료했습니다. 입력 대기 중.\" with title \"Claude Code\"' 2>/dev/null; afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true",
            "async": true
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path // .tool_response.filePath' | { read -r f; prettier --write \"$f\" --ignore-unknown; } 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

**기존 설정을 절대 날리지 말 것.** 항상 읽고 → 병합하고 → 저장하는 순서로.

---

## 훅 설정 후 적용하기

설정 파일을 저장한 뒤, Claude Code가 이미 실행 중이라면 바로 반영이 안 될 수 있다.

```
/hooks
```

Claude Code 안에서 `/hooks`를 입력하면 설정 창이 뜬다. 닫기만 해도 설정이 리로드된다.  
또는 세션을 재시작하면 확실하게 반영된다.

---

## 자주 쓰는 패턴 요약

| 목적 | 이벤트 | matcher | 사운드 |
|---|---|---|---|
| 응답 완료 알림 | `Stop` | 없음 | `Glass.aiff` |
| 승인 요청 알림 | `Notification` | 없음 | `Ping.aiff` |
| 파일 편집 후 포맷터 실행 | `PostToolUse` | `Write\|Edit` | — |
| Bash 명령어 로그 | `PreToolUse` | `Bash` | — |
| 세션 시작 시 메시지 | `SessionStart` | 없음 | — |

---

## 트러블슈팅

### 훅이 실행되지 않는다

1. **JSON 문법 오류** — 가장 흔한 원인. 아래 명령어로 확인:
   ```bash
   jq . ~/.claude/settings.json
   ```
   오류 없이 JSON이 출력되면 정상.

2. **설정이 아직 리로드 안 됨** — `/hooks` 입력 후 닫기 또는 세션 재시작

3. **matcher가 안 맞음** — `Write`, `Edit`, `Bash`는 대소문자를 정확히 써야 함

### `osascript`로 소리를 설정했는데 소리가 안 난다

`sound name "Glass"` 옵션은 macOS 알림 설정이나 버전에 따라 동작하지 않는 경우가 있다.

**해결책:** `afplay`로 분리해서 재생한다.

```bash
# 소리만 테스트하고 싶다면
afplay /System/Library/Sounds/Glass.aiff
```

이 명령어가 직접 실행됐을 때 소리가 나면, 훅에도 그대로 쓸 수 있다.

### 훅이 Claude 응답을 느리게 만든다

- `async: true`를 추가하면 훅이 백그라운드로 실행되어 응답을 블로킹하지 않는다
- 오래 걸리는 작업(테스트 실행 등)은 반드시 async로

### jq를 찾을 수 없다

```bash
brew install jq
```

macOS라면 Homebrew로 설치. 대부분의 Linux 배포판은 `apt install jq` 또는 `yum install jq`.

---

## 정리 — 핵심 흐름 한눈에

```
1. ~/.claude/settings.json (또는 .claude/settings.json) 파일 열기
2. "hooks" 키 아래에 이벤트명 → matcher → command 순으로 작성
3. jq . 파일경로  →  JSON 문법 검증
4. /hooks 입력 후 닫기  →  설정 리로드
5. 동작 확인
```

처음엔 Stop 훅 하나부터 시작해보는 걸 추천한다. Claude가 응답을 끝낼 때마다 "딩" 하고 소리가 나는 게 생각보다 꽤 편하다.

그 다음엔 Notification 훅. 승인 요청을 놓쳐서 Claude가 멈춰 있던 경험이 한 번이라도 있었다면 꼭 추가해두자. Stop이랑 소리를 다르게 해두면 귀로 상황을 구분할 수 있어서 더 좋다.

`osascript`의 `sound name`이 말을 안 들으면 당황하지 말고 `afplay`로 바꾸면 된다. 직접 부딪혀보면서 하나씩 고쳐가는 게 결국 제일 빠른 방법이다.
