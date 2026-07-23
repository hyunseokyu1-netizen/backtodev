---
title: '매치다 안전하게 만들기 ②: git-filter-repo로 히스토리에서 비밀번호 완전히 없애기'
date: '2026-07-07'
publish_date: '2026-08-20'
description: 공개 GitHub 리포에 박힌 평문 비밀번호를 git-filter-repo로 전체 커밋 히스토리에서 치환하고 force-push까지 진행한 기록
tags:
  - git
  - git-filter-repo
  - GitHub
  - 보안
  - 히스토리재작성
---

## 지난 편 요약 — 왜 이 작업이 필요했나

지난 편에서 보안 점검을 하다가, 공개 GitHub 리포에 커밋된 시드 SQL 파일 안에 평문 비밀번호가 박혀 있는 걸 발견했습니다.

```sql
crypt('MyPassword2026!', gen_salt('bf')),
```

바로 든 생각은 "그럼 이 줄만 지우고 다시 커밋하면 되는 거 아냐?"였습니다. 근데 이건 완전히 틀린 생각입니다. **git은 파일의 현재 상태만 저장하는 게 아니라 모든 커밋의 스냅샷을 영구히 남깁니다.** 지금 파일에서 비밀번호를 지워도, `git log`로 과거 커밋을 열어보면 그 줄이 그대로 남아 있습니다. 공개 리포라면 누구나 `git checkout <옛날커밋>`으로 그 시점의 파일을 볼 수 있죠.

즉 "파일 수정 + 새 커밋"으로는 절대 해결이 안 되고, **히스토리 자체를 다시 써야** 합니다. 이번 편은 그 과정을 정리한 기록입니다.

## 사전 준비 — 되돌릴 수 없는 작업이니 백업부터

히스토리 재작성은 모든 커밋의 해시가 바뀌는, 사실상 되돌리기 매우 어려운 작업입니다. 시작 전에 반드시 전체 히스토리를 번들로 백업해뒀습니다.

```bash
# 브랜치·태그 포함 전체 히스토리를 파일 하나로 백업
git bundle create backup-$(date +%Y%m%d-%H%M%S).bundle --all

# 확인
git bundle verify backup-20260705-095702.bundle
```

`.bundle` 파일 하나면 나중에 `git clone backup.bundle`로 그대로 복원할 수 있어서 안심하고 진행할 수 있었습니다.

## Step 1. `git-filter-repo` 설치

git에 내장된 `git filter-branch`도 있지만, 공식 문서에서부터 "느리고 위험하니 `git-filter-repo`를 쓰라"고 권장합니다. Homebrew로 바로 설치됩니다.

```bash
brew install git-filter-repo
git filter-repo --version
```

## Step 2. 치환 규칙 파일 작성

`git-filter-repo`는 `--replace-text` 옵션으로 특정 문자열을 히스토리 전체에서 치환할 수 있습니다. 규칙은 텍스트 파일 하나로 정의합니다.

```
# replacements.txt
MyPassword2026!==>REDACTED_SEED_PASSWORD
```

형식은 `찾을문자열==>바꿀문자열`입니다. `==>`를 기준으로 좌우를 나눕니다.

## Step 3. 워킹트리 정리

`filter-repo`는 커밋되지 않은 변경사항이 있으면 실행을 거부합니다(안전장치입니다). 실행 전에 미커밋 변경을 stash로 잠시 치워뒀습니다.

```bash
git stash push -u -m "pre-filter-repo"
git status --short   # 깨끗한지 확인
```

## Step 4. 실행

```bash
git filter-repo --replace-text replacements.txt --force
```

`--force`가 필요한 이유는 `git-filter-repo`가 기본적으로 "새로 clone한 리포에서만 실행하라"고 강제하기 때문입니다. 기존 작업 디렉터리에서 바로 실행하려면 이 플래그가 있어야 합니다. (그만큼 위험한 작업이라는 뜻이니, 백업 없이 `--force`를 붙이는 일은 없어야 합니다.)

실행하면 이런 로그가 나옵니다.

```
NOTICE: Removing 'origin' remote; see 'Why is my origin removed?'
        in the manual if you want to push back there.
Parsed 174 commits
New history written in 0.54 seconds; now repacking/cleaning...
Completely finished after 0.95 seconds.
```

여기서 눈여겨볼 부분 — **`origin` remote가 자동으로 제거됩니다.** 히스토리를 재작성한 상태로 실수로 origin에 그냥 push되는 걸 막기 위한 안전장치입니다. 다시 push하려면 remote를 수동으로 추가해야 합니다.

## Step 5. 검증 — 정말 지워졌는지 확인

말로만 "지워졌다"고 믿지 않고, 전체 히스토리를 다시 훑어서 확인했습니다.

```bash
# 모든 커밋에서 원래 비밀번호 검색 → 아무것도 안 나와야 정상
git grep -c "MyPassword2026" $(git rev-list --all) 2>/dev/null

# 치환된 문자열이 잘 들어갔는지 확인
git grep -c "REDACTED_SEED_PASSWORD" $(git rev-list --all) 2>/dev/null | head -3
```

첫 번째 명령이 아무 결과도 안 내면 성공입니다. 실제로 174개 커밋 전부에서 원래 문자열이 사라지고, 치환된 문자열이 해당 커밋들에 남아있는 걸 확인했습니다.

## Step 6. 원격에 반영 — force-push

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git push origin main --force
```

일반 push가 아니라 `--force`가 필요합니다. 원격의 커밋 해시들과 로컬의 새 해시들이 완전히 다른 히스토리이기 때문입니다. force-push 후 원격 히스토리까지 다시 스캔해서 최종 확인했습니다.

```bash
git fetch origin
git grep -c "MyPassword2026" $(git rev-list origin/main) 2>/dev/null
# → 결과 없음 (원격도 깨끗함)
```

## 마무리 — stash 복원

작업 전에 치워뒀던 미커밋 변경사항을 다시 꺼냈습니다.

```bash
git stash pop
```

## 자주 쓰는 패턴 요약

| 목적 | 명령어 |
|---|---|
| 전체 히스토리 백업 | `git bundle create backup.bundle --all` |
| 문자열 전역 치환 | `git filter-repo --replace-text rules.txt --force` |
| 히스토리 전체에서 문자열 검색 | `git grep -c "패턴" $(git rev-list --all)` |
| 재작성 후 원격 반영 | `git remote add origin <url>` → `git push origin main --force` |

## 트러블슈팅

**Q. `git filter-repo: command not found`**
A. pip로 설치하려다 "externally-managed-environment" 에러를 겪었습니다(최근 macOS/Homebrew Python 환경에서 흔합니다). `brew install git-filter-repo`로 우회하는 게 가장 깔끔합니다.

**Q. push했더니 거부당했다**
A. 히스토리를 재작성했으면 일반 `git push`는 100% 거부됩니다(원격과 로컬의 커밋 그래프가 다르니까요). `--force`가 필요합니다. 다만 force-push는 협업 중인 브랜치에서는 다른 사람의 작업을 날릴 수 있으니, 팀 리포라면 반드시 사전 공지가 필요합니다.

**Q. 그래도 완전히 안전한가?**
A. 아닙니다. GitHub이 이전 커밋 객체를 얼마간 캐시할 수 있고, 누군가 이미 fork·clone을 해뒀다면 그쪽엔 남아 있습니다. 정말 확실히 하려면 GitHub 지원팀에 캐시 정리를 요청하거나, 최악의 경우 리포를 삭제 후 재생성하는 방법도 있습니다. **애초에 시크릿을 커밋하지 않는 게 최선**이라는 결론에 다시 도달하게 됩니다.

## 정리

이번 작업의 핵심 흐름은 이렇습니다.

```
백업(bundle) → 워킹트리 정리(stash) → git-filter-repo로 치환
  → 히스토리 전체 재검증(grep) → force-push → 원격도 재검증
```

가장 중요한 교훈 하나만 남긴다면: **"커밋 지우기"와 "히스토리에서 지우기"는 완전히 다른 작업**이라는 것. 그리고 시크릿은애초에 안 만드는 게 최선이지만, 이미 만들어졌다면 파일 수정이 아니라 히스토리 재작성으로 대응해야 한다는 걸 직접 겪으며 배웠습니다.

다음 편에서는 방향을 조금 바꿔서, 그동안 마이그레이션 파일 15개로 조각나 있던 DB 스키마를 하나로 통합하고 실제 운영 DB와 자동 대조 검증한 이야기를 다룹니다.
