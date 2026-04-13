---
title: '[클로드 코드] 스킬(Skill) 만들고 사용하는 법 — 나만의 슬래시 커맨드'
date: '2026-04-13'
description: Claude Code에서 반복 작업을 자동화하는 스킬(Skill)을 직접 만들고 사용하는 방법을 실습과 함께 정리합니다.
tags:
  - Claude Code
  - Skill
  - 자동화
  - 슬래시 커맨드
---
## 같은 프롬프트를 매번 다시 쓰고 있다면

Claude Code를 쓰다 보면 이런 상황이 생긴다.

> "블로그 포스트 써줘. 아, 근데 항상 이 스타일로 써야 하는데... 또 설명해야 하나?"

매번 "한국어로, 개발자 톤으로, 이런 구조로 써줘" 같은 긴 컨텍스트를 반복 입력하는 건 번거롭다. 거기에 실수라도 하면 전혀 다른 스타일의 결과물이 나온다.

바로 이럴 때 **스킬(Skill)** 을 쓰면 된다.

스킬은 Claude Code의 **사용자 정의 슬래시 커맨드**다. 자주 쓰는 프롬프트 패턴을 파일에 저장해두면, `/blog-write` 처럼 짧은 명령어 한 줄로 꺼내쓸 수 있다. 직접 만들어서 쓰다 보니 "이거 진작에 알았으면 좋았을 텐데" 싶었다.

---

## 스킬이 뭔지 한 줄로

> 스킬 = 프롬프트 템플릿을 담은 마크다운 파일 + 슬래시 커맨드 등록

복잡한 설정 없이, **파일 하나만 만들면 슬래시 커맨드가 된다.**

---

## 사전 준비

스킬 파일이 저장되는 위치를 먼저 알아두자.

```
~/.claude/skills/
└── 스킬이름/
    └── skill.md     ← 이 파일 하나가 스킬의 전부
```

- `~/.claude/skills/` 는 전역 스킬 디렉토리다. 어느 프로젝트에서든 사용 가능.
- 스킬 폴더 이름이 곧 슬래시 커맨드 이름이 된다.
  - `~/.claude/skills/blog-write/` → `/blog-write`
  - `~/.claude/skills/gitpush/` → `/gitpush`

---

## Step 1. skill.md 파일 만들기

스킬 폴더와 파일을 직접 만들어보자. 예시로 간단한 커밋 메시지 생성기를 만든다.

```bash
mkdir -p ~/.claude/skills/commit-msg
```

그리고 `~/.claude/skills/commit-msg/skill.md` 파일을 생성한다.

```markdown
---
name: commit-msg
description: git diff를 보고 한국어 conventional commit 메시지를 작성한다.
user-invocable: true
---

현재 변경사항을 분석해서 한국어로 conventional commit 메시지를 작성해줘.

## 규칙
- `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `chore:` 중 하나로 시작
- 제목은 50자 이내
- 변경된 파일이 여러 개면 핵심 변경 위주로 요약
- 영어 기술 용어는 그대로 유지, 설명은 한국어로

## 출력 형식
커밋 메시지만 출력. 설명 없이 바로.
```

파일 구조를 보면 크게 두 부분으로 나뉜다.

| 구분 | 내용 |
|------|------|
| **프론트매터** (`---` 사이) | 스킬 메타정보. `name`, `description`, `user-invocable` 설정 |
| **본문** | 실제 프롬프트. Claude에게 전달되는 내용 |

### 프론트매터 필드 설명

```yaml
---
name: commit-msg          # 슬래시 커맨드 이름 (/commit-msg)
description: 한 줄 설명   # /로 목록에서 보이는 설명
user-invocable: true      # 슬래시 커맨드로 쓸 수 있게 등록
---
```

`user-invocable: true` 가 없으면 슬래시 목록에 나타나지 않는다. 꼭 넣어야 한다.

---

## Step 2. 스킬 사용하기

Claude Code 프롬프트에서 `/` 를 입력하면 등록된 스킬 목록이 뜬다.

```
/commit-msg
```

엔터를 치면 skill.md의 본문 프롬프트가 자동으로 Claude에게 전달된다. 현재 git diff를 분석해서 커밋 메시지를 바로 만들어준다.

---

## Step 3. $ARGUMENTS로 인자 받기

스킬에 추가 입력을 받고 싶다면 `$ARGUMENTS` 변수를 사용한다.

예를 들어 블로그 포스트 작성 스킬에서 주제를 인자로 받는다면:

```markdown
---
name: blog-write
description: 개발자 블로그 포스트를 마크다운으로 작성한다.
user-invocable: true
---

다음 주제로 블로그 포스트를 작성해줘.

## 스타일
- 한국어, 친근하고 실용적인 톤
- 코드 예시 포함
- 독자 대상: 처음 접하는 개발자

## 주제
$ARGUMENTS
```

사용할 때는 이렇게 입력한다.

```
/blog-write Claude Code에서 스킬 만들고 사용하는 법
```

`$ARGUMENTS` 자리에 "Claude Code에서 스킬 만들고 사용하는 법"이 치환되어 전달된다.

---

## Step 4. skill-creator 스킬로 만들기 (더 쉬운 방법)

Claude Code에는 `skill-creator`라는 내장 스킬이 있다. 스킬을 만드는 스킬이다.

```
/skill-creator blog-write: 개발자 블로그 포스트 작성 스킬 만들어줘
```

Claude가 스킬 설명을 듣고 skill.md 파일을 자동으로 작성해준다. 프롬프트 구조를 어떻게 잡아야 할지 막막할 때 이 방법이 빠르다.

---

## 자주 쓰는 패턴 요약

### 1. 기본 스킬 구조

```markdown
---
name: 스킬이름
description: 한 줄 설명
user-invocable: true
---

여기에 프롬프트를 작성한다.
```

### 2. 인자 받는 스킬

```markdown
---
name: 스킬이름
description: 설명 ($ARGUMENTS 인자 받음)
user-invocable: true
---

주제: $ARGUMENTS

위 주제로 ... 작성해줘.
```

### 3. 파일 경로 구조

```
~/.claude/skills/
├── blog-write/
│   └── skill.md
├── commit-msg/
│   └── skill.md
└── gitpush/
    └── skill.md
```

### 스킬 vs 반복 프롬프트 비교

| | 매번 직접 입력 | 스킬 |
|---|---|---|
| 입력량 | 긴 프롬프트 전체 | `/스킬명` 한 줄 |
| 일관성 | 매번 달라질 수 있음 | 항상 동일한 프롬프트 |
| 인자 지원 | 없음 | `$ARGUMENTS`로 가능 |
| 공유 | 어려움 | 파일로 공유 가능 |

---

## 트러블슈팅

### `/스킬명`을 입력해도 목록에 안 뜬다

- `user-invocable: true` 가 프론트매터에 있는지 확인
- 파일 경로가 `~/.claude/skills/스킬이름/skill.md` 인지 확인 (대소문자 포함)
- Claude Code를 재시작해보기

### 프롬프트가 의도대로 안 된다

- `$ARGUMENTS` 주변에 불필요한 설명이 붙으면 Claude가 헷갈릴 수 있다
- 출력 형식을 구체적으로 명시할수록 결과가 안정된다
- "~해줘" 보다 "~를 출력해" 처럼 명령형이 더 일관된 결과를 낸다

### skill.md 수정 후 반영이 안 된다

- 파일 저장 후 Claude Code에서 새 대화를 시작하면 반영된다
- 기존 대화에서는 바로 반영되지 않을 수 있다

---

## 정리 — 핵심 흐름 한눈에

```
1. 폴더 만들기
   ~/.claude/skills/스킬이름/

2. skill.md 작성
   ---
   name: 스킬이름
   description: 설명
   user-invocable: true
   ---
   [프롬프트 내용]
   [필요하면 $ARGUMENTS 사용]

3. Claude Code에서 슬래시로 호출
   /스킬이름 [선택적 인자]
```

반복되는 작업이 있다면 스킬로 만들어두는 게 이득이다. 처음 파일 하나 만드는 데 5분이면 충분하고, 그 이후엔 `/스킬명` 한 줄로 끝난다.

이 블로그 포스트도 `/blog-write` 스킬로 작성했다. 주제만 넣으면 구조와 스타일이 일관되게 나온다. 이런 게 쌓이면 점점 편해진다.
