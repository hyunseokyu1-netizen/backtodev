---
title: 'GitHub Actions 자동 커밋이 잔디에 안 심어지는 이유 — KST timezone 설정으로 해결'
date: '2026-05-04'
publish_date: '2026-05-04'
description: GitHub Actions가 자동으로 커밋해도 잔디에 반영이 안 되는 timezone 문제. TZ=Asia/Seoul 한 줄로 해결하는 방법을 정리했다.
tags:
  - GitHub
  - GitHubActions
  - 잔디
  - 자동화
---

GitHub Actions로 자동 커밋을 설정해두고 나서 이상한 점을 발견했다.

커밋은 분명히 올라가 있는데, 잔디에는 안 심어져 있다. 아니면 오늘 날짜가 아닌 어제 날짜에 찍혀 있다.

```
커밋 목록: April 26, 2026 — 2 commits  ✅
잔디:      April 26, 2026 — 1 commit   ❌ (Actions 커밋 하나가 빠짐)
```

분명히 같은 날 커밋인데 왜 잔디엔 하나만 반영됐을까.

---

## 원인 — UTC vs KST 타임스탬프 차이

GitHub는 커밋 타임스탬프의 **timezone offset**을 기준으로 잔디 날짜를 결정한다.

내가 로컬에서 직접 커밋할 때는 맥의 시스템 타임존(KST)으로 타임스탬프가 찍힌다.

```
로컬 커밋 (KST 01:00):  2026-04-26 01:00:00 +0900  → 잔디: April 26 ✅
```

반면 GitHub Actions는 Ubuntu 러너에서 실행되는데, 이 러너의 기본 타임존은 **UTC**다.

```
Actions 커밋 (KST 00:00): 2026-04-25 15:00:00 +0000  → 잔디: April 25 ❌
```

KST 자정(00:00)에 Actions가 실행되면, UTC 기준으로는 전날 15시다. 그러니 커밋 목록엔 April 26으로 보여도, 잔디는 April 25에 찍히는 것이다.

---

## 해결 — `export TZ='Asia/Seoul'`

git commit 전에 타임존을 KST로 설정하면 된다.

```yaml
- name: Publish scheduled posts
  shell: bash
  run: |
    # ...

    if [ "$PUBLISHED" -gt 0 ]; then
      export TZ='Asia/Seoul'          # ← 이 한 줄 추가
      git config user.name "이름"
      git config user.email "이메일"
      git add ...
      git commit -m "..."
      git push
    fi
```

이렇게 하면 커밋 타임스탬프가 이렇게 찍힌다:

```
2026-04-26 00:05:32 +0900  → 잔디: April 26 ✅
```

`export TZ` 선언 이후에 실행되는 모든 명령어가 KST 기준으로 동작하기 때문에, git commit의 author date와 committer date 모두 KST로 찍힌다.

---

## 전체 워크플로우 예시

```yaml
name: Publish Scheduled Posts

on:
  schedule:
    - cron: '5 15 * * *'  # 매일 00:05 KST (= UTC 15:05)
  workflow_dispatch:

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
          PUBLISHED=0

          for file in content/scheduled/*.md; do
            [ -f "$file" ] || continue
            # ... 날짜 체크 로직 ...
            mv "$file" "content/posts/$(basename $file)"
            PUBLISHED=$((PUBLISHED + 1))
          done

          if [ "$PUBLISHED" -gt 0 ]; then
            export TZ='Asia/Seoul'
            git config user.name "your-name"
            git config user.email "your@email.com"
            git add content/posts/ content/scheduled/
            git commit -m "post: 예약 포스트 $PUBLISHED 개 발행 ($TODAY)"
            git pull --rebase origin main
            git push
          fi
```

---

## 포인트 정리

| 항목 | 설정값 | 이유 |
|---|---|---|
| cron | `5 15 * * *` | UTC 15:05 = KST 00:05 |
| `TODAY` 변수 | `TZ='Asia/Seoul' date` | 발행 날짜 계산을 KST 기준으로 |
| git commit | `export TZ='Asia/Seoul'` | 커밋 타임스탬프를 KST로 |
| user.email | 본인 GitHub 이메일 | 잔디 반영 필수 조건 |

---

## 트러블슈팅

### 이메일은 맞는데 잔디에 반영이 안 된다

`TZ` 설정 없이 UTC로 커밋되면 날짜가 하루 밀린다. `export TZ='Asia/Seoul'`을 git config 앞에 추가했는지 확인한다.

### 커밋은 있는데 잔디 날짜가 다르다

GitHub 잔디는 실시간이 아니라 캐시가 있다. 보통 몇 분에서 몇 시간 이내에 업데이트된다. 바로 반영되지 않아도 잠시 기다려보면 된다.

### 잔디 반영 조건을 다시 확인하고 싶다

GitHub 잔디(Contribution graph)에 반영되려면 세 가지 조건이 모두 충족돼야 한다:

1. 커밋의 author email이 GitHub 계정에 **등록 + 인증**된 이메일일 것
2. 커밋이 **default 브랜치**(main)에 있을 것
3. **fork된 레포가 아닐** 것

---

## 정리 — 핵심 흐름 한눈에

```
문제:
  Actions 러너는 UTC 타임존
  → KST 자정 커밋이 UTC 기준 전날로 찍힘
  → 잔디에 하루 전 날짜로 반영됨

해결:
  git commit 전에 export TZ='Asia/Seoul' 추가
  → 커밋 타임스탬프에 +0900 붙음
  → GitHub이 KST 날짜로 인식
  → 잔디 정확히 반영 ✅
```

`export TZ='Asia/Seoul'` 한 줄짜리 수정인데, 잔디가 제대로 쌓이는 게 생각보다 기분이 좋다.