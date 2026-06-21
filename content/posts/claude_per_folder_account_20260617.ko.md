---
title: 'direnv로 특정 폴더에서만 Claude Code를 다른 계정으로 로그인하기'
date: '2026-06-17'
publish_date: '2026-06-22'
description: CLAUDE_CONFIG_DIR과 direnv를 조합해 프로젝트 폴더별로 Claude Code 로그인 계정을 분리하는 방법
tags:
  - Claude Code
  - direnv
  - 개발환경
  - macOS
---

회사 계정과 개인 계정을 따로 쓰는 사람이라면 한 번쯤 겪는 문제가 있다. Claude Code는 한 번 로그인하면 모든 폴더에서 같은 계정을 쓴다. 그런데 "이 프로젝트만큼은 다른 계정으로 작업하고 싶다"는 순간이 온다. 회사 일은 회사 계정으로, 개인 블로그는 개인 계정으로 분리하고 싶은 것이다.

결론부터 말하면, **"폴더를 열면 자동으로 다른 계정"** 같은 기본 기능은 없다. Claude Code의 로그인은 폴더 단위가 아니라 **설정 디렉터리(config dir) 단위**로 관리되기 때문이다. 하지만 `CLAUDE_CONFIG_DIR` 환경변수와 `direnv`를 조합하면, 특정 폴더에 들어갈 때만 자동으로 다른 계정 세션을 쓰도록 만들 수 있다. 오늘 내 블로그 프로젝트에 실제로 적용해봤다.

## 원리부터 짚고 가기

핵심은 두 가지다.

- Claude Code는 기본적으로 `~/.claude` 디렉터리를 설정/세션 저장소로 쓴다. 로그인 세션도 여기에 묶인다.
- `CLAUDE_CONFIG_DIR` 환경변수로 이 경로를 다른 곳으로 바꾸면, 그 경로 기준으로 **완전히 별개의 로그인 상태**를 갖는다.

즉 "이 폴더에서 실행할 땐 다른 config dir를 가리키게 → 다른 계정" 이 되는 것이다. 그럼 폴더에 들어갈 때마다 환경변수를 누가 자동으로 바꿔주느냐? 여기서 `direnv`가 등장한다.

`direnv`는 특정 폴더에 들어가면 그 폴더의 `.envrc` 파일을 읽어 환경변수를 자동으로 적용하고, 폴더를 벗어나면 원래대로 되돌려주는 도구다. 폴더별 환경 분리에 딱 맞는 도구다.

## 사전 준비

macOS 기준이고 Homebrew가 깔려 있다고 가정한다. `direnv`만 있으면 된다.

```bash
brew install direnv
direnv --version   # 2.37.1 같은 버전이 찍히면 OK
```

## Step 1. 셸에 direnv hook 등록

`direnv`는 설치만 한다고 동작하지 않는다. 셸이 폴더 이동을 감지할 때마다 `direnv`를 호출하도록 hook을 등록해야 한다. zsh 기준으로 `~/.zshrc` 맨 아래에 한 줄 추가한다.

```bash
# direnv
eval "$(direnv hook zsh)"
```

bash를 쓴다면 `~/.bashrc`에 `eval "$(direnv hook bash)"`를 넣으면 된다. 추가한 뒤에는 터미널을 새로 열거나 `source ~/.zshrc`로 다시 읽어야 적용된다.

## Step 2. 이 프로젝트 전용 config 디렉터리 만들기

기본 `~/.claude`와 섞이지 않게, 이 프로젝트만 쓸 별도 디렉터리를 하나 판다. 이름은 알아보기 쉽게 프로젝트명을 붙였다.

```bash
mkdir -p ~/.claude-backtodev
```

이 폴더가 "다른 계정"의 세션과 설정을 담을 공간이다.

## Step 3. 프로젝트 루트에 .envrc 작성

이제 프로젝트 폴더에 들어왔을 때 `CLAUDE_CONFIG_DIR`이 위에서 만든 디렉터리를 가리키도록 `.envrc`를 만든다.

```bash
# 프로젝트 루트에서
echo 'export CLAUDE_CONFIG_DIR="$HOME/.claude-backtodev"' > .envrc
```

파일 내용은 딱 한 줄이다.

```bash
export CLAUDE_CONFIG_DIR="$HOME/.claude-backtodev"
```

## Step 4. .gitignore에 추가하기

`.envrc`는 로컬 개발 환경 설정이라 저장소에 올라가면 안 된다. `.direnv/` 캐시 폴더까지 함께 무시하도록 `.gitignore`에 추가한다.

```bash
# direnv (per-folder Claude account)
.envrc
.direnv/
```

## Step 5. direnv allow로 승인하기

`direnv`는 보안을 위해, 신뢰하지 않은 `.envrc`는 자동으로 실행하지 않는다. 처음 만들거나 내용이 바뀌면 명시적으로 승인해야 한다.

```bash
direnv allow
```

이걸 깜빡하면 폴더에 들어가도 환경변수가 안 먹고 아래 같은 경고만 뜬다.

```
direnv: error .envrc is blocked. Run `direnv allow` to approve its content
```

승인이 끝나면 폴더에 들어갈 때 이런 로그가 보인다.

```
direnv: loading ~/.../backtodev/.envrc
direnv: export +CLAUDE_CONFIG_DIR
```

적용됐는지는 이렇게 확인할 수 있다.

```bash
echo $CLAUDE_CONFIG_DIR
# /Users/hy/.claude-backtodev
```

## Step 6. 그 상태에서 다른 계정으로 로그인

이제 끝났다. 새 터미널에서 프로젝트 폴더로 이동하면 `direnv`가 자동으로 환경변수를 적용한다.

```bash
cd ~/Documents/workspace/claude_code/backtodev   # direnv loading...
claude                                            # 새 세션 → 다른 계정으로 로그인
```

`CLAUDE_CONFIG_DIR`이 빈 디렉터리를 가리키니, Claude Code는 "처음 실행"으로 인식하고 로그인 화면을 띄운다. 여기서 원하는 다른 계정으로 로그인하면 된다. 이 폴더를 벗어나면 환경변수가 사라지면서 원래 계정으로 돌아간다.

## 자주 쓰는 명령어 요약

| 명령어 | 용도 |
|--------|------|
| `brew install direnv` | direnv 설치 |
| `eval "$(direnv hook zsh)"` | 셸 hook 등록 (.zshrc) |
| `direnv allow` | 현재 폴더의 .envrc 승인 |
| `direnv reload` | .envrc 변경 후 다시 로드 |
| `direnv exec . <cmd>` | .envrc 적용된 상태로 명령 1회 실행 |
| `echo $CLAUDE_CONFIG_DIR` | 적용 여부 확인 |

## 트러블슈팅: macOS 키체인 공유 문제

여기서 한 가지 주의할 점이 있다. macOS에서는 Claude Code의 OAuth 로그인 자격증명이 config 디렉터리가 아니라 **시스템 키체인**(`Claude Code-credentials` 항목)에 저장되는 경우가 있다. 이러면 `CLAUDE_CONFIG_DIR`만 바꿔도 키체인은 공유되기 때문에, 새 디렉터리로 띄웠는데 **로그인 화면 없이 기존 계정으로 그냥 들어가지는** 증상이 생길 수 있다.

증상별 대처는 이렇다.

- **새 config dir인데 기존 계정으로 바로 로그인됨** → 키체인을 공유하는 상태다. 그 세션 안에서 `/login`(또는 `/logout` 후 재로그인)으로 다른 계정으로 전환한다.
- **더 확실하게 분리하고 싶다** → OAuth 대신 API 키 기반 인증으로 가는 방법도 있다. `.envrc`에 `export ANTHROPIC_API_KEY=...`를 추가하면 폴더별로 키 자체가 갈리므로 키체인 공유 이슈에서 자유롭다.

## 되돌리기: direnv 해제하는 법

분리 설정이 더는 필요 없어지면 깔끔하게 되돌릴 수 있다. 범위에 따라 단계가 다르다.

**1) 이 폴더만 분리 해제 (direnv는 계속 사용)**

`.envrc`만 지우거나 비활성화하면 된다. 폴더에 들어가도 `CLAUDE_CONFIG_DIR`이 더는 적용되지 않는다.

```bash
rm .envrc                 # 분리 설정 제거
# 또는 잠깐만 끄고 싶다면
direnv deny               # .envrc를 차단(allow 취소). 나중에 direnv allow로 재활성화
```

`.envrc`를 지운 뒤에도 폴더에 들어갈 때 `direnv: error` 같은 잔여 로그가 보이면 한 번 더 폴더를 나갔다 들어오면 정리된다. 전용 config 디렉터리(`~/.claude-backtodev`)도 필요 없으면 같이 지운다.

```bash
rm -rf ~/.claude-backtodev
```

**2) direnv 자체를 완전히 제거**

다른 프로젝트에서도 안 쓴다면 hook과 패키지까지 걷어낸다.

```bash
# 1. ~/.zshrc 에서 아래 줄 삭제
#    eval "$(direnv hook zsh)"

# 2. 패키지 제거
brew uninstall direnv

# 3. 새 터미널을 열어 적용
```

hook 줄을 안 지우고 패키지만 지우면 셸 시작 때 `direnv: command not found`가 뜨니, **hook 줄 삭제 → uninstall** 순서를 지키자.

## 전체(기본) 계정으로 다시 로그인하기

폴더 분리와 별개로, 기본 `~/.claude` 계정 자체를 바꾸거나 다시 로그인하고 싶을 때가 있다. 이건 `CLAUDE_CONFIG_DIR`이 적용되지 **않은** 일반 터미널에서 작업하면 된다.

```bash
# 분리 폴더 바깥(예: 홈 디렉터리)에서 실행해 기본 config dir를 쓰도록 함
cd ~
echo $CLAUDE_CONFIG_DIR   # 비어 있으면 기본 ~/.claude 사용 중

claude                    # 실행 후
/logout                   # 현재 계정 로그아웃
/login                    # 다시 로그인 (계정 선택)
```

핵심은 **로그인하려는 위치가 어느 config dir를 가리키는지** 확인하는 것이다. `echo $CLAUDE_CONFIG_DIR`이 비어 있으면 기본 계정, `~/.claude-backtodev` 등이 찍히면 분리된 계정을 건드리는 중이다.

> macOS에서 키체인을 공유하는 경우, `/logout` 후 다시 로그인해도 같은 계정으로 붙을 수 있다. 이때는 키체인 앱에서 `Claude Code-credentials` 항목을 삭제한 뒤 재로그인하면 확실하게 초기화된다.

## 정리

전체 흐름을 한눈에 보면 이렇다.

1. `brew install direnv` → 설치
2. `~/.zshrc`에 `eval "$(direnv hook zsh)"` → hook 등록
3. `mkdir -p ~/.claude-<프로젝트명>` → 전용 config 디렉터리 생성
4. 프로젝트 루트에 `.envrc` 작성 (`export CLAUDE_CONFIG_DIR=...`)
5. `.gitignore`에 `.envrc`, `.direnv/` 추가
6. `direnv allow` → 승인
7. 폴더 진입 후 `claude` 실행 → 다른 계정으로 로그인

`direnv`는 이번 케이스 말고도 프로젝트별 환경변수 분리에 두루 쓸 수 있어서, 한 번 셋업해두면 두고두고 쓸모가 많다. 회사·개인 계정을 오가며 작업해야 한다면, 매번 로그아웃·재로그인하는 대신 폴더로 자동 전환되게 만들어두자. 손이 훨씬 편해진다.
