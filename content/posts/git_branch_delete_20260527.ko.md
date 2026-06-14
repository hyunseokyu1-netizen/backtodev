---
title: '머지한 피처 브랜치, 왜 지워야 할까? — 로컬·원격 삭제 방법 정리'
date: '2026-05-27'
publish_date: '2026-06-15'
description: 머지 후 피처 브랜치를 삭제해야 하는 이유와 로컬·원격 브랜치 삭제 명령어를 정리
tags:
  - git
  - branch
  - 협업
  - 버전관리
---

## 브랜치, 머지했으면 지워도 되는 거 아닌가요?

git을 쓰다 보면 한 번쯤 이런 생각이 든다.

> "머지 완료된 브랜치를 그냥 둬도 문제없지 않나? 히스토리 남기려고 놔두는 거 아닌가?"

나도 그렇게 생각했다. 근데 막상 프로젝트가 진행되다 보면 `git branch` 명령어 결과가 이렇게 된다.

```
  feature/v1-init
  feature/v2-i18n
  feature/v3-folder-management
  feat/rename-folder-to-chain
  fix/keyboard-issue
  main
```

어느 게 살아있는 작업이고, 어느 게 이미 머지된 브랜치인지 한눈에 안 보인다. 여기서부터 슬슬 귀찮아지기 시작한다.

---

## 피처 브랜치를 지워야 하는 이유

### 1. 히스토리는 브랜치가 아니라 커밋에 있다

브랜치는 그냥 특정 커밋을 가리키는 포인터다. 머지가 완료되면 그 커밋들은 main에 그대로 남는다. 브랜치를 삭제해도 작업 이력은 사라지지 않는다.

```bash
git log --oneline main
# 머지된 커밋들이 그대로 보인다
```

### 2. 살아있는 작업과 끝난 작업을 구분할 수 없다

브랜치 목록이 늘어나면 "이 브랜치 아직 작업 중인 건가?" 하는 혼란이 생긴다. 특히 나중에 혼자 보더라도, 팀이면 더더욱.

### 3. 원격 브랜치는 모두에게 보인다

로컬이야 나만 보면 되지만, `origin`에 올라간 브랜치는 팀원 모두의 `git branch -a` 목록에 쌓인다.

---

## 브랜치 삭제 방법

### 로컬 브랜치 삭제

```bash
git branch -d 브랜치명
```

`-d` 옵션은 **이미 머지된 브랜치만** 삭제한다. 안전한 옵션.

```bash
git branch -d feat/rename-folder-to-chain
# feat/rename-folder-to-chain 브랜치 삭제 (과거 4f5e866)
```

머지 안 된 브랜치를 강제로 지우고 싶다면 `-D` (대문자).

```bash
git branch -D 브랜치명   # 강제 삭제, 미머지 커밋 날아감 — 주의
```

### 원격 브랜치 삭제

```bash
git push origin --delete 브랜치명
```

```bash
git push origin --delete feat/rename-folder-to-chain
# To https://github.com/...
#  - [deleted]         feat/rename-folder-to-chain
```

### 한 번에 로컬 + 원격 삭제

```bash
git branch -d 브랜치명 && git push origin --delete 브랜치명
```

---

## 자주 쓰는 패턴 요약

| 상황 | 명령어 |
|---|---|
| 머지된 로컬 브랜치 삭제 | `git branch -d 브랜치명` |
| 미머지 로컬 브랜치 강제 삭제 | `git branch -D 브랜치명` |
| 원격 브랜치 삭제 | `git push origin --delete 브랜치명` |
| 로컬 브랜치 목록 | `git branch` |
| 로컬 + 원격 브랜치 목록 | `git branch -a` |
| 머지 완료된 브랜치 목록 | `git branch --merged main` |

---

## 트러블슈팅

### "remote ref does not exist" 에러

```
error: unable to delete 'feat/something': remote ref does not exist
```

원격에 해당 브랜치가 처음부터 없을 때 나온다. 로컬에서만 작업하고 푸시 안 한 브랜치를 원격 삭제하려 하면 이 에러가 뜬다. 로컬 삭제만 하면 된다.

### 삭제했는데 `git branch -a`에 아직 보인다

원격 브랜치 삭제 후에도 로컬 캐시에 남아 있는 경우가 있다. 아래 명령으로 정리하면 된다.

```bash
git fetch --prune
# 또는 줄여서
git fetch -p
```

---

## 정리

머지한 피처 브랜치는 **바로 지우는 게 맞다.** 커밋 이력은 main에 남으니까 히스토리 걱정은 없다.

```bash
# 머지 후 브랜치 정리 루틴
git checkout main
git merge feat/my-feature
git push origin main
git branch -d feat/my-feature           # 로컬 삭제
git push origin --delete feat/my-feature # 원격 삭제
```

브랜치 목록이 깔끔해야 지금 뭘 작업 중인지 한눈에 보인다. 나중에 한꺼번에 정리하는 것보다 머지할 때마다 바로 지우는 습관이 훨씬 편하다.
