---
title: 'GitHub Actions로 블로그 포스트 예약 배포하기'
date: '2026-04-17'
description: GitHub Actions 워크플로우를 만들어 특정 날짜에 블로그 포스트가 자동으로 발행되도록 설정하는 방법을 실제 구현 경험 기반으로 설명합니다.
tags:
  - GitHub Actions
  - 자동화
  - CI/CD
  - Vercel
  - 블로그
---

## "포스트 써뒀는데 오늘 올려야 하는데..."

블로그를 운영하다 보면 이런 상황이 생긴다. 포스트는 이미 다 써뒀는데, 매일 직접 들어와서 올려야 한다. 며칠치를 한꺼번에 써놓고 하루에 하나씩 발행하고 싶은데 방법이 없다.

그래서 예약 발행 기능을 직접 만들었다.

**GitHub Actions**를 이용하면 맥이 꺼져 있어도 지정한 날짜에 자동으로 포스트를 커밋하고 배포할 수 있다. Vercel이 GitHub main 브랜치 push를 감지해서 자동 배포하는 구조를 그대로 활용하는 방식이다.

---

## GitHub Actions가 뭔가

GitHub에서 제공하는 **자동화 도구**다. 코드가 push되거나, PR이 열리거나, 특정 시간이 되면 지정한 작업을 자동으로 실행해준다. GitHub 서버에서 실행되기 때문에 내 컴퓨터가 꺼져 있어도 작동한다는 게 핵심이다.

무료 플랜도 월 2,000분의 실행 시간을 제공하기 때문에 블로그 자동화 용도로는 평생 무료라고 봐도 된다.

---

## 사전 준비

- GitHub에 올라간 프로젝트 (public/private 무관)
- Vercel 자동 배포 연결된 상태 (Vercel이 GitHub push 감지 → 자동 배포)
- 블로그 포스트가 마크다운 frontmatter에 `date` 필드 포함

```yaml
---
title: '포스트 제목'
date: '2026-04-20'   ← 발행하고 싶은 날짜
description: '설명'
---
```

---

## Step 1. 폴더 구조 만들기

두 가지 폴더가 필요하다.

```
content/
├── posts/       ← 발행된 포스트 (현재)
└── scheduled/   ← 예약된 포스트 (새로 만들기)
```

`scheduled/` 폴더를 만들고 `.gitkeep` 파일을 넣어서 빈 폴더도 Git에 올라가게 해준다.

```bash
mkdir content/scheduled
touch content/scheduled/.gitkeep
```

---

## Step 2. 워크플로우 파일 만들기

`.github/workflows/` 폴더를 만들고 `scheduled-post.yml` 파일을 생성한다.

```bash
mkdir -p .github/workflows
```

**`.github/workflows/scheduled-post.yml`:**

```yaml
name: Publish Scheduled Posts

on:
  schedule:
    - cron: '0 15 * * *'  # 매일 00:00 KST (= UTC 15:00)
  workflow_dispatch:        # 수동 실행 버튼도 추가

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # 커밋 권한

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Publish scheduled posts
        run: |
          TODAY=$(date -u '+%Y-%m-%d')
          echo "오늘 날짜: $TODAY"
          PUBLISHED=0

          for file in content/scheduled/*.md content/scheduled/*.mdx; do
            [ -f "$file" ] || continue

            # frontmatter에서 date 값 추출
            POST_DATE=$(grep -m1 '^date:' "$file" | sed "s/date: *['\"]//;s/['\"].*//;s/ *//")

            if [ -z "$POST_DATE" ]; then
              echo "날짜 없음, 건너뜀: $file"
              continue
            fi

            echo "확인: $file → date: $POST_DATE"

            # 날짜가 오늘 이하면 발행
            if [[ "$POST_DATE" <= "$TODAY" ]]; then
              FILENAME=$(basename "$file")
              mv "$file" "content/posts/$FILENAME"
              echo "발행됨: $FILENAME"
              PUBLISHED=$((PUBLISHED + 1))
            fi
          done

          if [ "$PUBLISHED" -gt 0 ]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add content/posts/ content/scheduled/
            git commit -m "post: 예약 포스트 ${PUBLISHED}개 발행 ($TODAY)"
            git push
            echo "✅ $PUBLISHED 개 발행 완료"
          else
            echo "오늘 발행할 포스트 없음"
          fi
```

---

## Step 3. 예약 포스트 등록하기

이제부터 포스트를 예약할 때는 `content/posts/` 대신 `content/scheduled/`에 저장하면 된다.

```bash
# 예약 등록
cp 새포스트.ko.md content/scheduled/새포스트.ko.md
git add content/scheduled/새포스트.ko.md
git commit -m "post: 새포스트 예약 등록 (2026-04-20 발행)"
git push
```

포스트의 frontmatter `date`가 발행일 기준이 된다. `2026-04-20`으로 설정하면 그날 자정에 자동으로 `content/posts/`로 이동되고 Vercel이 배포한다.

---

## Step 4. 수동 테스트

워크플로우가 잘 작동하는지 확인하려면 수동으로 실행해볼 수 있다.

1. GitHub → 프로젝트 → **Actions** 탭
2. 왼쪽에서 `Publish Scheduled Posts` 선택
3. **Run workflow** 버튼 클릭
4. 로그 확인 → `content/posts/`로 이동됐는지 확인
5. Vercel 대시보드에서 배포 완료 확인

---

## cron 표현식 이해하기

`'0 15 * * *'` 이게 뭔지 처음엔 헷갈린다.

```
분  시  일  월  요일
0   15  *   *   *
```

| 필드 | 값 | 의미 |
|------|-----|------|
| 분 | `0` | 0분 (정각) |
| 시 | `15` | UTC 15시 = KST 00시 |
| 일 | `*` | 매일 |
| 월 | `*` | 매월 |
| 요일 | `*` | 매요일 |

**KST 기준 자주 쓰는 패턴:**

| 원하는 시간 | cron 표현식 |
|---|---|
| 매일 자정 (00:00 KST) | `0 15 * * *` |
| 매일 오전 9시 (KST) | `0 0 * * *` |
| 매주 월요일 오전 9시 (KST) | `0 0 * * 1` |
| 매월 1일 자정 (KST) | `0 15 1 * *` |

---

## 트러블슈팅

### 워크플로우가 실행됐는데 커밋이 안 됐다

```yaml
permissions:
  contents: write   ← 이게 빠지면 push 권한이 없어서 실패
```

`jobs:` 아래에 `permissions` 블록을 추가했는지 확인.

### 날짜가 맞는데 발행이 안 됐다

GitHub Actions의 cron은 UTC 기준이다. KST 04월 18일 00:00은 UTC 04월 17일 15:00이다.

`date -u` 로 UTC 날짜를 사용하고 있으므로, 포스트 `date`가 `2026-04-18`이면 KST 04월 18일 00:00에 발행된다. 의도대로 작동하는 게 맞다.

### `content/scheduled/` 폴더가 Git에 안 올라간다

Git은 빈 폴더를 추적하지 않는다. 폴더 안에 `.gitkeep` 파일을 하나 만들어서 함께 push하면 해결된다.

```bash
touch content/scheduled/.gitkeep
git add content/scheduled/.gitkeep
```

---

## 정리 — 핵심 흐름 한눈에

```
1. 폴더 생성
   content/scheduled/   ← 예약 포스트 보관

2. 워크플로우 파일 생성
   .github/workflows/scheduled-post.yml
   → cron: '0 15 * * *' (매일 00:00 KST)
   → date <= 오늘인 파일 → content/posts/로 이동 → 커밋 → 푸시

3. 예약 등록
   파일 frontmatter에 date 설정 → content/scheduled/ 에 저장 → git push

4. 자동 발행
   GitHub Actions → content/posts/ 이동 → Vercel 자동 배포
```

한 번 설정해두면 이후엔 포스트를 `content/scheduled/`에 넣고 push하는 것만으로 예약이 완료된다. 며칠치 포스트를 한꺼번에 써두고 하루에 하나씩 발행하는 패턴이 가능해진다.
