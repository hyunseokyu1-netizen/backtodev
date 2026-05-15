---
title: 'Claude Code로 블로그 운영하는 법 — 작성부터 예약 배포까지 자동화'
date: '2026-04-25'
publish_date: '2026-05-16'
description: 포스트 작성, 번역, 등록, 예약 배포까지 Claude Code와 함께 블로그를 운영하는 전체 워크플로우를 정리했다.
tags:
  - ClaudeCode
  - 블로그
  - 자동화
---

블로그를 꾸준히 쓰는 게 생각보다 귀찮다. 글 쓰는 것 자체도 그렇지만, 작성 후에 해야 하는 것들이 많다.

- 파일 형식 맞추기 (frontmatter, 태그...)
- 영문 버전 번역
- posts 폴더에 복사하고 커밋
- 배포 확인

이걸 매번 수동으로 하다 보면 글 쓰는 것보다 관리에 더 시간이 든다. 그래서 Claude Code와 함께 이 과정을 전부 자동화했다.

지금은 이런 흐름으로 돌아간다:

```
Claude Code에게 주제 던지기
    → 블로그 형식 포스트 작성
    → 영문 번역 파일 생성
    → 스케줄 폴더에 복사
    → 지정한 날짜에 자동 배포
```

이 글은 그 전체 워크플로우를 처음부터 설명한다.

---

## 사전 준비

- Claude Code CLI 설치 (`claude` 명령어 사용 가능한 상태)
- Next.js 기반 블로그 (또는 마크다운 파일 기반 블로그)
- GitHub + Vercel 연결된 레포

---

## Step 1 — 블로그 스킬 만들기

Claude Code의 **스킬(Skill)** 은 반복 작업을 명령어 하나로 줄여주는 도구다. 스킬 파일을 한 번 만들어두면 `/스킬명`으로 호출할 수 있다.

스킬 파일 위치:

```
~/.claude/skills/스킬명/SKILL.md      # 글로벌 (모든 프로젝트)
.claude/skills/스킬명/SKILL.md        # 로컬 (현재 프로젝트)
```

### blog-write 스킬

포스트 초안을 자동으로 작성해주는 스킬이다. `~/.claude/skills/blog-write/SKILL.md`에 만들었다.

```markdown
---
name: blog-write
description: "주어진 주제로 개발자 블로그 포스트를 작성하고 지정 경로에 저장한다."
user-invocable: true
---

다음 주제로 개발자 블로그 포스트를 마크다운 형식으로 작성해줘.

## 블로그 배경
- 블로그 성격: 개발자 블로그 (기술 포스트)
- 필자 배경: 개발을 다시 시작한 개발자
- 독자 대상: 해당 기술을 처음 접하는 개발자
- 언어: 한국어

## 작성 스타일
- 딱딱하지 않고 실용적인 톤
- "왜 이게 필요한지"부터 시작
- 직접 해본 경험 기반 (1인칭 사용 가능)
- 코드 블록, 표, 순서 목록 적극 활용

## 저장 경로
/Users/hy/Documents/workspace/claude_code/blog_doc_temp/
파일명: 주제_YYYYMMDD.ko.md

## 작성 주제
$ARGUMENTS
```

호출 방법:

```
/blog-write DeepL API로 번역 자동화하기
```

Claude가 주제를 받아서 블로그 형식에 맞는 마크다운 파일을 작성하고 저장한다.

---

## Step 2 — post-register 스킬 만들기

작성된 파일을 블로그에 등록하고 배포까지 해주는 스킬이다. `~/.claude/skills/post-register/SKILL.md`:

```markdown
---
name: post-register
description: "지정한 파일을 블로그 posts 폴더에 등록하고 배포한다. 완료 후 원본 파일에 ff_ 접두사를 붙인다."
user-invocable: true
---

아래 순서로 포스트를 등록해줘.

1. 파일 복사: `$ARGUMENTS` 경로의 파일을 `content/posts/` 에 복사
2. 커밋 & 배포:
   - git status, git diff HEAD 로 변경사항 확인
   - 복사한 파일만 명시적으로 git add
   - 한국어 conventional commit 메시지로 커밋
   - git pull --rebase origin main 후 git push origin main
3. 원본 파일 이름 변경: 푸시 완료 후 원본 파일 앞에 ff_ 접두사 추가
```

호출 방법:

```
/post-register /Users/hy/Documents/workspace/claude_code/blog_doc_temp/deepl_api_20260418.ko.md
```

`ff_` 접두사는 "filed/finished"의 약자다. blog_doc_temp 폴더에서 이미 등록된 파일을 구분하는 용도로 쓴다.

---

## Step 3 — 예약 발행 설정 (GitHub Actions)

포스트를 미리 써두고 특정 날짜에 자동으로 배포하고 싶다면 GitHub Actions를 활용한다.

### 폴더 구조

```
content/
├── posts/      ← 현재 발행된 포스트
└── scheduled/  ← 예약된 포스트
```

### 워크플로우 파일

`.github/workflows/scheduled-post.yml`:

```yaml
name: Publish Scheduled Posts

on:
  schedule:
    - cron: '0 15 * * *'  # 매일 00:00 KST
  workflow_dispatch:        # 수동 실행 가능

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Publish scheduled posts
        shell: bash
        run: |
          TODAY=$(TZ='Asia/Seoul' date '+%Y-%m-%d')

          for file in content/scheduled/*.md; do
            [ -f "$file" ] || continue

            # publish_date 우선, 없으면 date 사용
            PUBLISH_DATE=$(grep -m1 '^publish_date:' "$file" | sed "s/publish_date: *['\"]//;s/['\"].*//")
            if [ -z "$PUBLISH_DATE" ]; then
              PUBLISH_DATE=$(grep -m1 '^date:' "$file" | sed "s/date: *['\"]//;s/['\"].*//")
            fi

            POST_NUM=$(echo "$PUBLISH_DATE" | tr -d '-')
            TODAY_NUM=$(echo "$TODAY" | tr -d '-')

            if [ "$POST_NUM" -le "$TODAY_NUM" ]; then
              mv "$file" "content/posts/$(basename $file)"
            fi
          done

          git config user.name "hs"
          git config user.email "your@email.com"
          git add content/posts/ content/scheduled/
          git commit -m "post: 예약 포스트 발행 ($TODAY)" || exit 0
          git pull --rebase origin main
          git push
```

### publish_date 필드 활용

파일의 `date`(포스트 날짜)는 그대로 두고, 배포 날짜만 별도로 지정할 수 있다:

```yaml
---
title: '...'
date: '2026-04-20'         ← 포스트에 표시되는 날짜
publish_date: '2026-04-25' ← 실제 배포될 날짜
---
```

`publish_date`가 없으면 기존처럼 `date` 기준으로 동작한다.

---

## 실제 운영 흐름

이걸 다 세팅하고 나면 하루 작업이 이렇게 바뀐다.

### 즉시 발행

```
/blog-write Playwright로 스크래핑하는 법
    → 파일 작성됨
/post-register /blog_doc_temp/playwright_20260425.ko.md
    → posts/ 복사 → 커밋 → 배포 → 원본에 ff_ 붙음
```

### 예약 발행

```
/blog-write JobRadar 프로젝트 세팅
    → 파일 작성됨
파일 frontmatter에 publish_date: '2026-04-28' 추가
content/scheduled/ 폴더에 복사
git add → git push
    → 4월 28일 자정에 자동 배포
```

---

## 자주 쓰는 패턴 요약

| 작업 | 방법 |
|---|---|
| 포스트 초안 작성 | `/blog-write 주제명` |
| 즉시 등록 & 배포 | `/post-register 파일경로` |
| 예약 배포 | frontmatter에 `publish_date` 추가 후 scheduled/ 에 복사 |
| 등록 완료 파일 구분 | `ff_` 접두사 (post-register 스킬이 자동으로 붙임) |
| 영문 포스트 등록 | 동일하게 `/post-register` 호출 |

---

## 트러블슈팅

**스킬이 호출되지 않는다**

`~/.claude/skills/스킬명/SKILL.md` 경로가 맞는지 확인. 파일명이 반드시 `SKILL.md`여야 한다.

**GitHub Actions push 실패**

Actions 워크플로우에 `permissions: contents: write`가 있는지 확인. 없으면 push 권한이 없어서 실패한다.

**예약 포스트가 발행되지 않는다**

`publish_date` 형식이 `'2026-04-25'`처럼 따옴표 포함 YYYY-MM-DD인지 확인. 형식이 다르면 날짜 비교가 제대로 안 된다.

**잔디에 반영이 안 된다**

Actions 워크플로우의 `git config user.email`이 GitHub 계정 이메일과 일치하는지 확인. `github-actions[bot]` 이메일로 설정하면 본인 계정 잔디에 반영되지 않는다.

---

## 정리 — 핵심 흐름 한눈에

```
1. ~/.claude/skills/ 에 blog-write, post-register 스킬 생성
2. content/scheduled/ 폴더 생성
3. .github/workflows/scheduled-post.yml 작성
4. 포스트 작성: /blog-write 주제
5. 즉시 배포: /post-register 파일경로
   예약 배포: publish_date 추가 → scheduled/ 복사 → push
```

처음 세팅에 한 시간 정도 들지만, 이후엔 포스트 하나 올리는 데 명령어 몇 줄로 끝난다. 글 쓰는 데만 집중할 수 있게 되는 게 제일 큰 변화다.
