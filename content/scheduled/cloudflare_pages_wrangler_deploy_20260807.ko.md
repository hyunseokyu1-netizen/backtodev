---
title: 'wrangler로 Cloudflare Pages에 배포하기 — 정적 사이트부터 엣지 함수까지, 그리고 세 가지 함정'
date: '2026-08-07'
publish_date: '2026-10-16'
description: 명령어 한 줄로 정적 사이트를 배포하면서 Functions가 조용히 누락되는 함정, 엣지 전파 지연, 계정 캐시가 배포 폴더에 섞이는 문제를 겪고 정리한 실전 기록
tags:
  - Cloudflare Pages
  - wrangler
  - 배포
  - GitHub Pages
  - CLI
---

## 정적 페이지 하나 올리는 데 뭐가 이렇게 많이 필요한가

카세트 앱의 공유 페이지는 `index.html` 파일 딱 하나다. 서버도, 빌드도, 프레임워크도 없다. 이걸 어디에 올릴까 하다가 처음엔 GitHub Pages를 썼는데, 주소에 내 GitHub 아이디가 그대로 노출되는 게 걸려서 Cloudflare Pages로 옮겼다.

옮기고 나서는 대시보드에서 파일을 드래그해서 올리고 있었다. 파일이 하나일 땐 그럭저럭 괜찮았는데, 이번에 페이지에 엣지 함수와 이미지 8장이 붙으면서 더는 그렇게 못 하게 됐다. 그래서 CLI로 배포 방식을 정리했다.

이 글은 Cloudflare의 CLI인 **wrangler**로 정적 사이트를 배포하는 전 과정과, 그 과정에서 실제로 걸린 세 가지 함정에 대한 기록이다. 마지막에는 같은 날 GitHub Pages 쪽에서 겪은 일과 비교도 붙였다.

## 사전 준비

wrangler는 Node 패키지다. 전역 설치를 해도 되지만, 나는 버전 관리가 귀찮아서 `npx`로 그때그때 최신을 쓴다.

```bash
npx wrangler@latest --version
# ⛅️ wrangler 4.119.0
```

Cloudflare 계정은 무료 플랜이면 충분하다. Pages는 무료 플랜에서도 정적 호스팅 무제한, Functions 요청 하루 10만 건까지 준다. 개인 프로젝트 공유 페이지 수준이면 한도 근처도 못 간다.

## Step 1. 로그인

```bash
npx wrangler login
```

브라우저가 열리고 OAuth 인증 화면이 뜬다. 권한을 승인하면 터미널로 돌아온다.

```
Attempting to login via OAuth...
Opening a link in your default browser: https://dash.cloudflare.com/oauth2/auth?...
Successfully logged in.
```

이건 브라우저가 필요한 인터랙티브 과정이라 CI 환경에서는 못 쓴다. CI에서는 API 토큰을 발급받아 `CLOUDFLARE_API_TOKEN` 환경변수로 넘긴다.

로그인 상태는 이렇게 확인한다.

```bash
npx wrangler whoami
```

로그인이 안 되어 있으면 이렇게 나온다.

```
You are not authenticated. Please run `wrangler login`.
```

## Step 2. 프로젝트 확인

이미 만들어둔 Pages 프로젝트가 있는지 본다.

```bash
npx wrangler pages project list
```

```
┌──────────────┬────────────────────┬──────────────┬───────────────┐
│ Project Name │ Project Domains    │ Git Provider │ Last Modified │
├──────────────┼────────────────────┼──────────────┼───────────────┤
│ kidsnara     │ kidsnara.pages.dev │ Yes          │ 1 week ago    │
│ repotape     │ repotape.pages.dev │ No           │ 2 weeks ago   │
└──────────────┴────────────────────┴──────────────┴───────────────┘
```

`Git Provider` 열이 중요하다.

- **Yes**: GitHub 저장소에 연결되어 있어서 푸시하면 자동 배포된다
- **No**: 직접 업로드 방식. `wrangler pages deploy`로 올린다

내 `repotape`는 `No`, 즉 직접 업로드 방식이다.

배포 이력도 볼 수 있는데, 여기서 **프로덕션 브랜치 이름**을 확인해두는 게 중요하다.

```bash
npx wrangler pages deployment list --project-name=repotape
```

```
│ Id       │ Environment │ Branch │ Deployment                          │ Status      │
│ 7cbed18a │ Production  │ main   │ https://7cbed18a.repotape.pages.dev │ 2 weeks ago │
```

`Environment: Production`, `Branch: main`. 배포할 때 브랜치를 이 이름과 맞춰야 프로덕션 도메인(`repotape.pages.dev`)에 반영된다. 다른 이름을 쓰면 프리뷰 배포로 들어가서 임시 URL에만 뜨고 실제 주소는 안 바뀐다. 이걸 모르면 "배포는 성공했다는데 사이트는 그대로"인 상황에 빠진다.

## Step 3. 배포

```bash
npx wrangler pages deploy . \
  --project-name=repotape \
  --branch=main \
  --commit-dirty=true
```

```
✨ Success! Uploaded 9 files (1.25 sec)
🌎 Deploying...
✨ Deployment complete! Take a peek over at https://c0411afa.repotape.pages.dev
```

옵션 정리.

| 옵션 | 의미 |
|---|---|
| `.` | 배포할 디렉토리 (현재 위치) |
| `--project-name` | Pages 프로젝트 이름 |
| `--branch=main` | 프로덕션 브랜치. 안 맞으면 프리뷰로 들어감 |
| `--commit-dirty=true` | git 변경사항이 커밋 안 됐어도 진행 |

배포에 걸린 시간은 파일 9개에 **1.25초**. 그리고 배포마다 `c0411afa.repotape.pages.dev` 같은 고유 URL이 생겨서, 프로덕션에 영향 없이 그 버전만 따로 확인할 수 있다. 이게 꽤 유용하다.

## 함정 1: Functions가 조용히 누락된다

가장 오래 헤맨 부분이다.

공유 페이지에 엣지 함수(`functions/_middleware.js`)를 추가하고 배포했다. 성공 메시지가 떴다. 그런데 사이트를 확인하니 함수가 전혀 동작하지 않았다.

로그를 다시 봤다.

```
✨ Success! Uploaded 0 files (1 already uploaded) (0.39 sec)
🌎 Deploying...
✨ Deployment complete!
```

정상처럼 보인다. 에러도 경고도 없다. 그런데 Functions가 제대로 올라갔을 때의 로그와 비교하면 차이가 명확했다.

```
✨ Compiled Worker successfully          ← 이 줄
Uploading... (1/1)
✨ Success! Uploaded 0 files (1 already uploaded)
✨ Uploading Functions bundle             ← 이 줄
🌎 Deploying...
```

`Compiled Worker successfully`와 `Uploading Functions bundle` 두 줄이 없으면 **Functions 없이 정적 파일만 배포된 것**이다.

원인은 실행 위치였다. `wrangler pages deploy <디렉토리>`는 **배포 대상 디렉토리가 아니라 명령을 실행한 현재 작업 디렉토리(cwd) 기준으로 `functions/`를 찾는다.**

```bash
# ❌ 프로젝트 루트에서 실행 — 루트의 functions/를 찾다가 없으니 조용히 건너뜀
cd ~/myproject
npx wrangler pages deploy ./web_dist --project-name=repotape

# ✅ 배포 폴더로 이동해서 실행
cd ~/myproject/web_dist
npx wrangler pages deploy . --project-name=repotape
```

처음엔 프로젝트 루트에서 배포 폴더 경로를 넘기는 식으로 썼는데, 그러면 루트에 `functions/`가 없으니 Functions 없이 배포된다. **에러 없이 조용히** 넘어가는 게 특히 나빴다. 배포는 성공했다고 하니 코드나 캐시를 의심하며 한참 돌아갔다.

교훈은 두 가지다. 배포는 **배포 폴더 안에서** 실행할 것, 그리고 Functions를 쓴다면 **로그에 `Compiled Worker successfully`가 있는지 매번 확인**할 것.

## 함정 2: 엣지 전파에 시차가 있다

배포 직후 이미지 8장이 잘 올라갔는지 확인했다.

```bash
for c in FF9A44 E0705F 44DE80 4AC8E0 5B79C9 B48EE0 C9A227 default; do
  printf "tape-%-8s → " "$c"
  curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
    "https://repotape.pages.dev/og/tape-$c.png"
done
```

```
tape-FF9A44   → 200 image/png
tape-E0705F   → 200 text/html; charset=utf-8     ← ???
tape-44DE80   → 200 image/png
...
```

한 장이 PNG가 아니라 HTML을 반환했다. 파일이 없어서 fallback으로 `index.html`이 나간 것이다. 파일 목록에는 분명히 있었는데.

다시 돌리니 이번엔 **다른 파일**이 HTML로 나왔다. 즉 특정 파일 문제가 아니라, 요청이 닿는 **엣지 노드마다 자산 전파 시점이 다른** 것이었다. Cloudflare는 전 세계 엣지에 파일을 뿌리는데 그게 완전히 동시가 아니다.

그래서 검증을 "한 번 확인"이 아니라 "전부 정상일 때까지 반복"으로 바꿨다.

```bash
for round in $(seq 1 6); do
  bad=0
  for c in FF9A44 E0705F 44DE80 4AC8E0 5B79C9 B48EE0 C9A227 default; do
    ct=$(curl -s -o /dev/null -w "%{content_type}" \
      "https://repotape.pages.dev/og/tape-$c.png")
    [ "$ct" = "image/png" ] || bad=$((bad+1))
  done
  [ $bad -eq 0 ] && { echo "✓ 8장 전부 정상 (${round}회차)"; break; }
  echo "미전파 ${bad}장 (${round}회차) — 대기"
  sleep 15
done
```

HTML 응답도 마찬가지였다. 배포 직후엔 옛 내용이 오다가, 몇 십 초 뒤부터 새 내용이 나왔다. **배포 직후 한 번 보고 "반영이 안 됐다"고 판단하면 안 된다.**

## 함정 3: `.wrangler` 폴더에 계정 정보가 쌓인다

로컬에서 Functions를 테스트하려고 개발 서버를 띄웠다.

```bash
npx wrangler pages dev . --port 8899 --ip 127.0.0.1
```

이건 정말 유용하다. 실제 엣지 런타임(miniflare)을 로컬에서 흉내 내서 Functions까지 그대로 돌려준다. 배포하기 전에 미들웨어 동작을 다 확인할 수 있다.

```bash
curl -s 'http://127.0.0.1:8899/?n=Test&a=x1&c=E0705F' | grep og:image
# <meta property="og:image" content="http://127.0.0.1:8899/og/tape-E0705F.png">
```

문제는 이걸 돌리고 나면 배포 폴더에 `.wrangler/` 디렉토리가 생긴다는 것이다.

```
.wrangler/cache/wrangler-account.json      ← 계정 정보
.wrangler/cache/cf.json
.wrangler/state/v3/cache/miniflare-CacheObject/metadata.sqlite
...
```

**계정 정보 파일이 배포 대상 폴더 안에** 들어 있다. wrangler가 배포 시 자동으로 제외해주긴 하지만(업로드 파일 수를 세보면 포함되지 않는다), 이런 건 운에 맡길 게 아니다. 배포 전에 지우는 습관을 들였다.

```bash
rm -rf .wrangler
npx wrangler pages deploy . --project-name=repotape --branch=main
```

git으로 관리하는 폴더라면 `.gitignore`에 `.wrangler/`를 넣어두는 게 좋다.

## 자주 쓰는 명령어 정리

| 명령 | 용도 |
|---|---|
| `wrangler login` | 브라우저 OAuth 로그인 |
| `wrangler whoami` | 로그인 상태 확인 |
| `wrangler pages project list` | 프로젝트 목록 + Git 연동 여부 |
| `wrangler pages deployment list --project-name=X` | 배포 이력, 프로덕션 브랜치 확인 |
| `wrangler pages dev .` | 로컬 개발 서버 (Functions 포함) |
| `wrangler pages deploy . --project-name=X --branch=main` | 프로덕션 배포 |

배포 전 체크리스트로 굳어진 것.

1. 배포 폴더 **안에서** 명령 실행 (`cd` 먼저)
2. `.wrangler/` 삭제
3. `--branch`를 프로덕션 브랜치와 일치시키기
4. Functions를 쓴다면 로그에서 `Compiled Worker successfully` 확인
5. 배포 후 검증은 몇 십 초 간격으로 반복

## 비교: 같은 날 GitHub Pages는

공교롭게 같은 날, 예전에 쓰던 GitHub Pages 쪽도 내용을 갱신할 일이 있었다. 옛 버전 앱이 만든 링크가 아직 그 주소로 가기 때문에 폴백으로 살려둬야 했다.

커밋하고 푸시했는데 사이트가 안 바뀌었다. 빌드 상태를 API로 확인했다.

```bash
gh api repos/OWNER/REPO/pages/builds/latest \
  --jq '.status + " " + .commit[0:8]'
# building 3d02cb0b
```

`building` 상태인데 커밋 해시가 **내 커밋이 아니라 이전 커밋**이었다. 생성 시각을 보니 하루 전부터 그 상태로 멈춰 있었다. 멈춘 빌드가 큐를 막아서 새 빌드가 아예 시작되지 않은 것이다.

빌드를 강제로 요청해봤다.

```bash
gh api -X POST repos/OWNER/REPO/pages/builds
```

실패했다. 로그를 열어보니 원인은 이랬다.

```
Getting action download info
Failed to resolve action download info. Error: Service Unavailable
Retrying in 18.01 seconds
Failed to resolve action download info. Error: Service Unavailable
##[error]Service Unavailable
```

내 코드나 커밋과 무관한 **GitHub Actions 인프라 장애**였다. 재시도해도 빌드가 몇 분씩 `building`에서 진행되지 않았다.

두 서비스를 나란히 놓고 보니 차이가 뚜렷했다.

| | Cloudflare Pages (직접 업로드) | GitHub Pages (legacy 빌드) |
|---|---|---|
| 배포 소요 | 1~2초 | 정상일 때 40초~1분 |
| 실패 시 원인 파악 | CLI 로그에 즉시 | Actions 로그를 따로 조회 |
| 빌드 큐 | 없음 (직접 업로드) | 있음, 막히면 후속 빌드 대기 |
| 엣지 전파 | 수십 초 시차 있음 | 비교적 즉시 |
| 서버 로직 | Functions 지원 | 불가 (정적 전용) |

GitHub Pages가 나쁘다는 얘기는 아니다. 저장소에 푸시만 하면 되는 편의는 여전히 크고, 이번 장애는 어쩌다 걸린 일이다. 다만 **빌드 파이프라인을 거치는 방식은 그 파이프라인이 남의 인프라**라는 걸 체감했다. 직접 업로드는 그 의존이 하나 적다.

## 정리

1. `npx wrangler login` → `pages project list`로 프로젝트와 Git 연동 방식 확인
2. `pages deployment list`로 **프로덕션 브랜치 이름** 확인 후 `--branch`에 지정
3. 배포는 반드시 **배포 폴더 안에서** — `functions/`는 cwd 기준으로 탐색된다
4. Functions를 쓴다면 로그의 `Compiled Worker successfully`를 확인 (없으면 조용히 누락)
5. `pages dev`로 로컬에서 먼저 검증, 배포 전 `.wrangler/` 삭제
6. 배포 후 검증은 엣지 전파 시차를 감안해 반복 확인

파일 하나짜리 정적 페이지에 이 정도 절차가 필요한가 싶기도 한데, 엣지 함수가 붙는 순간 그냥 정적 사이트가 아니게 된다. 그래도 배포 자체가 1초대라서, 한 번 흐름을 잡아두니 고치고 올리는 사이클이 아주 가볍다.
