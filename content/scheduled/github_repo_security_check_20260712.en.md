---
title: "Before You Push a Personal Project to GitHub — A Repo Security Checklist So Your Login Cookies Don't Leak Too"
date: '2026-07-12'
publish_date: '2026-11-12'
description: A step-by-step walkthrough of the secret scanning, PII placeholder cleanup, and safe initial commit process I actually ran before pushing a browser automation project to GitHub
tags:
  - Git
  - GitHub
  - gitignore
  - Security
  - Playwright
---

## "Is It Okay to Push This Code to GitHub?"

Once a personal project reaches some level of completion, a thought naturally comes up.

> "Should I push this to GitHub and back it up now?"

I had the exact same thought recently while building an automated blog-publishing project, and my hand froze right before typing `git init`. This project uses **Playwright browser automation** to publish posts to Tistory/Naver, and these things were just sitting loose inside the project folder.

- `profiles/` — an entire Chrome browser profile, with the actual `Cookies` and `Login Data` files sitting right inside
- `profiles/tistory-state.json` — Playwright's `storageState`, which is **the login cookie itself**
- `dashboard/.env.local` — a Redis connection token
- My **real blog ID**, baked into example text scattered through the source
- An **email address and deployment URL** written into documentation (`CLAUDE.md`, `USAGE.md`)

If the `storageState` file leaks, that's effectively **account takeover.** Even without the password, that cookie can reproduce the logged-in state exactly. An API key can at least be reissued — but if a login session leaks, someone else can post to my blog.

So I ran a check before pushing anything. This post is a checklist of the process I actually went through.

## Prerequisites

- `gh` CLI (GitHub CLI) — used for creating the repo and pushing. `brew install gh`, then `gh auth login`
- The project folder to be checked

## Step 1 — Find the Sensitive Files First

Before reading any code, find the dangerous ones by filename alone first.

```bash
find . -maxdepth 3 \( -name ".env*" -o -name "*session*" -o -name "*storageState*" \
  -o -name "*cookie*" -o -name "credentials*" \) -not -path "*/node_modules/*"
```

In my case, this turned up one `.env.local` and some session-related files. Every file that shows up here has to pass one question: **"is it caught by `.gitignore`?"**

```bash
cat .gitignore
cat dashboard/.gitignore   # 하위 폴더에도 .gitignore가 있다면 같이 확인
```

For reference, a subfolder's `.gitignore` works fine relative to that folder. Even if you create the repo at the root, the `.env*` rule in `dashboard/.gitignore` is still valid.

## Step 2 — Check the Source for Hardcoded Secrets

A file with a totally innocent name but a key baked into its content is the genuinely dangerous case. Sweep through with common secret patterns.

```bash
grep -rn -E "(AKIA|sk-[a-zA-Z0-9]{20}|AIza[0-9A-Za-z_-]{30}|Bearer [A-Za-z0-9_-]{20,}|redis://|rediss://)" \
  --include="*.ts" --include="*.js" --include="*.json" --include="*.md" \
  --exclude-dir=node_modules .
```

And one more thing — the case where an actual value is baked into an environment variable fallback. You end up writing code like this without thinking while developing.

```ts
// 이런 코드가 지뢰입니다
const blogName = process.env.TISTORY_BLOG_NAME ?? 'my-real-blog-id';
```

I had exactly this pattern in a one-off migration script. If the environment variable was missing, it would fall back to **my actual real blog ID.** I fixed it by removing the fallback, so it skips that step or throws an error when the value is missing.

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

## Step 3 — Checking Whether Anything Already Made It Into git History

This is a spot a lot of people miss. **Git remembers its history.** Even if you delete something from the working tree now, if it was ever committed in the past even once, it still shows up when you dig through `git log`.

```bash
# 과거에 추가된 적 있는 민감 파일 이름 검색
git log --all --diff-filter=A --name-only --format="%h" | sort -u \
  | grep -iE "\.env|secret|credential|session|cookie"

# 지금 추적 중인 파일 중 민감한 것
git ls-files | grep -iE "\.env|secret|cookie|state"
```

I found something interesting here — a subfolder, `dashboard/`, had a **`.git` I didn't even know existed.** The culprit was `create-next-app` — if the parent folder isn't a git repo, scaffolding it automatically runs `git init` plus an initial commit for you. There was only one commit ("Initial commit from Create Next App"), so the history was clean, but if you don't know about this and run `git init` at the root, the subfolder becomes a **nested repository (treated as a submodule)** and its contents **don't get pushed at all** — a nasty surprise.

```bash
# 히스토리 확인 후 문제 없으면 제거
cd dashboard && git log --oneline   # 뭐가 커밋됐었는지 반드시 먼저 확인
rm -rf dashboard/.git
```

What if a secret has already made it into the history? The cleanest move is to give up on that repo's history and start fresh. And **always reissue the key**, no matter what. There are tools for scrubbing history (`git filter-repo` and the like), but if it's ever been pushed once, it's safest to treat it as leaked.

## Step 4 — Things That Aren't Secrets, but Are Personal Data

There's one more category `.gitignore` can't catch: **personal data inside files that are supposed to be committed.** In my project, these turned up:

| Location | Content | Fix |
|---|---|---|
| Example text in settings-page UI | `예: 내블로그ID.tistory.com` | Replaced with a generic example (`myblog`) |
| Comments in migration scripts | References to my account | Replaced with generic phrasing |
| Project docs | 2 email addresses, a deployment URL, a blog address | Replaced with placeholders |

For the docs, I used a placeholder approach.

```markdown
<!-- Before -->
- 사용자 계정: real.email@gmail.com (주 계정)
- 대시보드: https://my-real-deploy-url.vercel.app

<!-- After -->
- 사용자 계정: [mainEmail] (주 계정)
- 대시보드: https://[mainDashboardUrl].vercel.app
```

One tip: keep the real values you stripped out **recorded somewhere outside the repository.** Removing them from the docs doesn't mean you stop needing them operationally. I kept a "placeholder → real value" mapping in a local-only note.

For searching, just run it with yourself as the keyword.

```bash
grep -rn -iE "내아이디|내이메일|내블로그명|@gmail" \
  --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.next .
```

Repeat this **until it outputs nothing.**

## Step 5 — One Last Pass on .gitignore

Entries I added while cleaning up.

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

A folder like `profiles/` being in gitignore still didn't fully put my mind at ease. `.gitignore` is a line of defense that one mistake (`git add -f`, an edited rule) can punch right through, so **if there's any plan to go public, I'd recommend moving files like this entirely outside the repo folder.**

## Step 6 — Making a Safe Initial Commit & Pushing to a Private Repo

Time to push. Two things matter.

**First, don't use `git add -A` — explicitly list what gets added.**

```bash
git init -b main
git add .gitignore README.md src dashboard config package.json package-lock.json tsconfig.json
```

**Second, before committing, re-check the staged file list for sensitive files.**

```bash
git diff --cached --name-only | grep -iE "\.env|profiles/|accounts\.json$" \
  || echo "민감 파일 없음 ✓"
```

This one line is the last safety net. Trust the gitignore, but verify separately. Once it passes, commit, and use the `gh` CLI to create a **private** repo and push in one go.

```bash
git commit -m "feat: 초기 커밋"
gh repo create my-project --private --source . --remote origin --push
```

You're not done until you've confirmed the visibility is actually PRIVATE after pushing.

```bash
gh repo view --json name,visibility
# "visibility": "PRIVATE" ✓
```

## Commands I Keep Coming Back To

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

## Troubleshooting

**Q. There's some mystery `.git` inside a subfolder.**
That's from scaffolding tools like `create-next-app` or `create-vite`. Check the history (`git log --oneline`), and if it's just the initial commit, it's fine to delete. If you don't delete it and run `git init` at the root, that folder gets pushed up as an empty shell (a gitlink) — watch out for this.

**Q. An empty folder isn't showing up in the repo.**
Git doesn't track empty folders. That's normal. If you want to preserve the folder structure, drop a `.gitkeep` file inside it.

**Q. I already pushed a secret.**
The order matters. ① **Reissue/revoke the key first.** ② Then clean up the history (`git filter-repo` or start a new repo). Even if you scrub the history, someone may have already cloned it, so reissuing the key always comes first.

## Wrap-Up — The 5-Minute Pre-Push Checklist

1. **Search filenames** — check whether `.env`, session, cookie, credentials-type files are caught by gitignore
2. **Search content** — until grep comes back empty for hardcoded keys, `?? 'real-value'` fallbacks, and your own ID/email
3. **Check history** — no sensitive files in past commits, no mystery nested `.git`
4. **Explicit add + staging verification** — list files instead of `git add -A`, double-check with `git diff --cached --name-only`
5. **Start private** — you can always go public later, but a leak can't be undone

Especially for a project like a browser-automation one that **holds a login session as a file**, remember that the session file is more dangerous than an API key. An API key can just be reissued — a leaked session is account takeover.
