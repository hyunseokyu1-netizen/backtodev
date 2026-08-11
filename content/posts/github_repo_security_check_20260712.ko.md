---
title: '개인 프로젝트 GitHub에 올리기 전, 로그인 쿠키까지 털리지 않으려면 — 저장소 보안 점검 체크리스트'
date: '2026-07-12'
publish_date: '2026-08-12'
description: 브라우저 자동화 프로젝트를 GitHub에 올리기 전에 실제로 진행한 시크릿 검사, 개인정보 플레이스홀더 처리, 안전한 초기 커밋 과정을 단계별로 정리
tags:
  - Git
  - GitHub
  - gitignore
  - 보안
  - Playwright
---

## "이 소스, GitHub에 올려도 되나?"

개인 프로젝트를 어느 정도 만들고 나면 자연스럽게 드는 생각이 있습니다.

> "이제 GitHub에 올려서 백업해 둘까?"

저도 최근에 블로그 자동 발행 프로젝트를 만들면서 똑같은 생각을 했는데,
`git init`을 치려다가 손이 멈췄습니다. 이 프로젝트는 **Playwright 브라우저
자동화**로 티스토리/네이버에 글을 발행하는 물건이라, 프로젝트 폴더 안에
이런 것들이 굴러다니고 있었거든요.

- `profiles/` — 크롬 브라우저 프로필 통째로. 그 안에 `Cookies`, `Login Data` 파일이 그대로
- `profiles/tistory-state.json` — Playwright의 `storageState`, 즉 **로그인 쿠키 그 자체**
- `dashboard/.env.local` — Redis 접속 토큰
- 소스 곳곳의 예시 문구에 박힌 **내 실제 블로그 아이디**
- 문서(`CLAUDE.md`, `USAGE.md`)에 적힌 **이메일 주소와 배포 URL**

이 중 `storageState` 파일은 유출되면 사실상 **계정 탈취**입니다. 비밀번호가
없어도 그 쿠키로 로그인된 상태를 그대로 재현할 수 있으니까요. API 키는
재발급이라도 되지, 로그인 세션이 털리면 남이 내 블로그에 글을 쓸 수 있습니다.

그래서 올리기 전에 점검부터 했습니다. 이 글은 그때 실제로 진행한 과정을
체크리스트로 정리한 것입니다.

## 사전 준비

- `gh` CLI (GitHub CLI) — repo 생성과 푸시에 사용. `brew install gh` 후 `gh auth login`
- 점검 대상 프로젝트 폴더

## Step 1 — 민감 파일부터 찾는다

코드를 읽기 전에, 파일 이름만으로 위험한 것들을 먼저 찾습니다.

```bash
find . -maxdepth 3 \( -name ".env*" -o -name "*session*" -o -name "*storageState*" \
  -o -name "*cookie*" -o -name "credentials*" \) -not -path "*/node_modules/*"
```

제 경우 `.env.local` 하나와 세션 관련 파일이 나왔습니다. 여기서 나온 파일은
전부 다음 질문을 통과해야 합니다: **".gitignore에 걸려 있는가?"**

```bash
cat .gitignore
cat dashboard/.gitignore   # 하위 폴더에도 .gitignore가 있다면 같이 확인
```

참고로 하위 폴더의 `.gitignore`도 그 폴더 기준으로 정상 동작합니다.
루트에서 저장소를 만들어도 `dashboard/.gitignore`의 `.env*` 규칙은 유효합니다.

## Step 2 — 소스에 하드코딩된 시크릿 검사

파일 이름은 멀쩡한데 내용물에 키가 박혀 있는 경우가 진짜 위험합니다.
자주 쓰이는 시크릿 패턴으로 한 번 훑습니다.

```bash
grep -rn -E "(AKIA|sk-[a-zA-Z0-9]{20}|AIza[0-9A-Za-z_-]{30}|Bearer [A-Za-z0-9_-]{20,}|redis://|rediss://)" \
  --include="*.ts" --include="*.js" --include="*.json" --include="*.md" \
  --exclude-dir=node_modules .
```

그리고 하나 더 — **환경변수 fallback에 실제 값을 박아둔 경우**입니다.
개발하다 보면 이런 코드를 무심코 쓰게 되는데요.

```ts
// 이런 코드가 지뢰입니다
const blogName = process.env.TISTORY_BLOG_NAME ?? 'my-real-blog-id';
```

저도 1회성 마이그레이션 스크립트에서 딱 이 패턴이 나왔습니다. 환경변수가
없으면 **내 실제 블로그 아이디**로 동작하게 되어 있었죠. 이런 건 fallback을
지우고, 값이 없으면 해당 단계를 건너뛰거나 에러를 내도록 고쳤습니다.

```ts
const blogName = process.env.TISTORY_BLOG_NAME;
if (blogName) {
  // 값이 있을 때만 진행
} else {
  console.log('- TISTORY_BLOG_NAME 미설정, 건너뜀');
}
```

```bash
# fallback 패턴 찾기
grep -rn -E "process\.env\.[A-Z_]+ (\|\||\?\?) ['\"]" --include="*.ts" src/
```

## Step 3 — 이미 git 히스토리에 들어간 건 없는지

여기가 많이들 놓치는 부분입니다. **git은 히스토리를 기억합니다.**
지금 워킹 트리에서 지워도, 과거 커밋에 한 번이라도 들어갔다면
`git log`를 뒤지면 그대로 나옵니다.

```bash
# 과거에 추가된 적 있는 민감 파일 이름 검색
git log --all --diff-filter=A --name-only --format="%h" | sort -u \
  | grep -iE "\.env|secret|credential|session|cookie"

# 지금 추적 중인 파일 중 민감한 것
git ls-files | grep -iE "\.env|secret|cookie|state"
```

저는 여기서 재미있는 걸 발견했는데, 하위 폴더 `dashboard/`에 **저도 모르는
`.git`이 있었습니다.** 범인은 `create-next-app` — 상위 폴더가 git 저장소가
아니면 스캐폴딩하면서 자동으로 `git init` + 초기 커밋까지 해줍니다.
커밋이 "Initial commit from Create Next App" 하나뿐이라 히스토리는
깨끗했지만, 이걸 모르고 루트에서 `git init` 하면 하위 폴더가 중첩
저장소(서브모듈 취급)가 되어 **내용이 통째로 안 올라가는** 사고가 납니다.

```bash
# 히스토리 확인 후 문제 없으면 제거
cd dashboard && git log --oneline   # 뭐가 커밋됐었는지 반드시 먼저 확인
rm -rf dashboard/.git
```

만약 히스토리에 시크릿이 이미 들어가 있다면? 그 저장소 히스토리는 포기하고
새로 시작하는 게 제일 깔끔합니다. 그리고 **해당 키는 무조건 재발급**하세요.
히스토리에서 지우는 도구(`git filter-repo` 등)가 있긴 하지만, 이미 푸시된
적이 있다면 유출로 간주하는 게 안전합니다.

## Step 4 — 시크릿은 아니지만 개인정보인 것들

`.gitignore`로 막을 수 없는 유형이 하나 더 있습니다. **커밋되어야 하는 파일
안에 든 개인정보**입니다. 제 프로젝트에서는 이런 것들이 나왔습니다.

| 위치 | 내용 | 처리 |
|---|---|---|
| 설정 페이지 UI의 예시 문구 | `예: 내블로그ID.tistory.com` | 일반 예시(`myblog`)로 교체 |
| 마이그레이션 스크립트 주석 | 내 계정 언급 | 일반 표현으로 교체 |
| 프로젝트 문서 | 이메일 2개, 배포 URL, 블로그 주소 | 플레이스홀더로 교체 |

문서 쪽은 플레이스홀더 방식을 썼습니다.

```markdown
<!-- Before -->
- 사용자 계정: real.email@gmail.com (주 계정)
- 대시보드: https://my-real-deploy-url.vercel.app

<!-- After -->
- 사용자 계정: [mainEmail] (주 계정)
- 대시보드: https://[mainDashboardUrl].vercel.app
```

한 가지 팁: 이렇게 지운 실제 값들은 **저장소 밖 어딘가에 따로 기록**해
두세요. 문서에서 지웠다고 운영할 때 안 쓰는 값이 아니니까요. 저는 로컬
전용 메모에 "플레이스홀더 → 실제 값" 매핑을 남겨뒀습니다.

검색은 자기 자신을 키워드로 넣고 돌리면 됩니다.

```bash
grep -rn -iE "내아이디|내이메일|내블로그명|@gmail" \
  --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.next .
```

이게 **아무것도 출력하지 않을 때까지** 반복합니다.

## Step 5 — .gitignore 마지막 점검

정리하면서 추가한 항목들입니다.

```gitignore
node_modules/
dist/
profiles/              # 브라우저 프로필 (쿠키, 로그인 데이터!)
.env
config/accounts.json   # 개인 계정 설정
*.log
.DS_Store
.claude/               # AI 도구의 로컬 설정
```

`profiles/` 같은 폴더는 gitignore에 있어도 마음이 놓이지 않았습니다.
`.gitignore`는 실수 한 번(`git add -f`, 규칙 수정)이면 뚫리는 방어선이라,
**공개 저장소로 갈 계획이 있다면 이런 파일은 아예 저장소 폴더 밖으로**
옮기는 걸 권합니다.

## Step 6 — 안전하게 초기 커밋 & private repo 푸시

이제 올립니다. 포인트는 두 가지입니다.

**첫째, `git add -A`를 쓰지 않고 올릴 것을 명시적으로 나열합니다.**

```bash
git init -b main
git add .gitignore README.md src dashboard config package.json package-lock.json tsconfig.json
```

**둘째, 커밋 전에 스테이징된 파일 목록에서 민감 파일을 다시 검사합니다.**

```bash
git diff --cached --name-only | grep -iE "\.env|profiles/|accounts\.json$" \
  || echo "민감 파일 없음 ✓"
```

이 한 줄이 마지막 안전망입니다. gitignore를 믿되, 검증은 따로 하는 거죠.
통과하면 커밋하고, `gh` CLI로 **private** repo를 만들면서 바로 푸시합니다.

```bash
git commit -m "feat: 초기 커밋"
gh repo create my-project --private --source . --remote origin --push
```

푸시 후 공개 범위가 진짜 PRIVATE인지 확인까지 해야 끝입니다.

```bash
gh repo view --json name,visibility
# "visibility": "PRIVATE" ✓
```

## 자주 쓰는 명령어 요약

```bash
# 1. 민감 파일 이름 검색
find . -name ".env*" -o -name "*session*" -o -name "*cookie*" | grep -v node_modules

# 2. 하드코딩 시크릿/개인정보 검색 (출력 0이 될 때까지)
grep -rn -iE "패턴들" --exclude-dir=node_modules .

# 3. git 히스토리 점검
git log --all --diff-filter=A --name-only | grep -iE "\.env|secret"

# 4. 스테이징 검증 후 푸시
git diff --cached --name-only | grep -iE "\.env|민감패턴" || echo OK
gh repo create <이름> --private --source . --push
```

## 트러블슈팅

**Q. 하위 폴더에 정체불명의 `.git`이 있어요.**
`create-next-app`, `create-vite` 같은 스캐폴딩 도구가 만든 겁니다. 히스토리를
확인해서(`git log --oneline`) 초기 커밋뿐이면 지워도 됩니다. 안 지우고 루트에서
`git init` 하면 해당 폴더가 빈 껍데기(gitlink)로 올라가니 주의하세요.

**Q. 빈 폴더가 저장소에 안 올라가요.**
git은 빈 폴더를 추적하지 않습니다. 정상입니다. 폴더 구조를 유지하고 싶으면
안에 `.gitkeep` 파일을 하나 넣어주세요.

**Q. 시크릿을 이미 푸시해 버렸어요.**
순서가 중요합니다. ① **키부터 재발급/무효화** ② 그다음에 히스토리 정리
(`git filter-repo` 또는 저장소 새로 만들기). 히스토리를 지워도 이미 누군가
클론했을 수 있으니, 키 재발급이 항상 먼저입니다.

## 정리 — 올리기 전 5분 체크리스트

1. **파일 이름 검색** — `.env`, session, cookie, credentials 계열이 gitignore에 걸리는지
2. **내용 검색** — 하드코딩된 키, `?? '실제값'` fallback, 내 아이디/이메일이 grep에 안 걸릴 때까지
3. **히스토리 점검** — 과거 커밋에 들어간 민감 파일 없는지, 정체불명의 중첩 `.git` 없는지
4. **명시적 add + 스테이징 검증** — `git add -A` 대신 나열, `git diff --cached --name-only`로 재확인
5. **private로 시작** — 공개는 나중에 언제든 할 수 있지만, 유출은 되돌릴 수 없습니다

특히 브라우저 자동화 프로젝트처럼 **로그인 세션을 파일로 들고 있는**
프로젝트라면, API 키보다 그 세션 파일이 더 위험하다는 걸 기억하세요.
API 키는 재발급하면 그만이지만, 세션 유출은 곧 계정 탈취입니다.
