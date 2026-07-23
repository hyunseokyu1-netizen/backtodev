---
title: 'Cloudflare Pages로 pages.dev 무료 도메인 배포하기 — Workers 화면에 낚이지 않는 법'
date: '2026-07-23'
description: Create application을 누르면 Pages가 아니라 Worker 생성 화면이 뜬다. 숨어 있는 Pages 진입점을 찾아 Next.js 정적 사이트를 무료 도메인에 올린 전 과정
tags:
  - Cloudflare
  - Cloudflare Pages
  - Next.js
  - 배포
  - GitHub
---

## 왜 Cloudflare Pages였나

아이들용 웹 게임을 하나 만들었다. 처음에는 개발 도구가 자동으로 붙여준 임시 주소로 돌아가고 있었는데, 주소가 이랬다.

```
kidsplay-little-playground.hyunseok-yu1.chatgpt.site
```

49자다. 아내에게 카톡으로 보내주기도 민망하고, 로그인까지 필요했다. 아이가 쓸 기기 북마크에 넣어두면 그만이긴 한데, 이왕이면 짧고 로그인 없는 주소가 갖고 싶었다.

도메인을 사려니 굳이 싶었다. 개인 프로젝트에 매년 도메인 비용을 내기는 아깝다. 그래서 **무료 서브도메인**을 주는 호스팅을 찾았고, 몇 군데를 비교했다.

| 서비스 | 무료 주소 | 대역폭 | 상업적 이용 |
|---|---|---|---|
| **Cloudflare Pages** | `이름.pages.dev` | 무제한 | 가능 |
| Vercel | `이름.vercel.app` | 100GB/월 | 무료 플랜은 불가 |
| Netlify | `이름.netlify.app` | 100GB/월 | 가능 |
| GitHub Pages | `계정명.github.io/저장소명` | 소프트 100GB/월 | 가능 |

Cloudflare Pages로 정한 이유는 세 가지였다.

1. **대역폭 무제한.** 무료 플랜에 월 전송량 제한이 없다. 개인 프로젝트가 갑자기 떠서 요금 폭탄을 맞을 걱정이 없다.
2. **주소가 짧다.** GitHub Pages는 `계정명.github.io/저장소명` 형태라 오히려 더 길어진다.
3. **전 세계 CDN.** Cloudflare 본업이 CDN이다. 아이 태블릿에서 첫 로딩이 빠른 게 체감된다.

그런데 실제로 해보니, **가장 큰 난관은 기술이 아니라 Cloudflare 대시보드 UI였다.** 이 글은 그 함정을 포함한 전체 과정 기록이다.

## 사전 준비

- GitHub 저장소에 코드가 올라가 있을 것
- Cloudflare 계정 (무료 가입)
- 정적 파일로 빌드되는 프로젝트

세 번째가 중요하다. Cloudflare Pages는 기본적으로 **정적 파일 호스팅**이다. 서버 사이드 렌더링이 필요하면 이야기가 복잡해진다. 내 경우엔 게임 로직이 전부 브라우저에서 도는 클라이언트 사이드 앱이라 정적 빌드로 충분했다.

## Step 1. Next.js를 정적 파일로 빌드하기

Next.js는 기본적으로 서버를 띄우는 구조라, 정적 파일로 뽑아내려면 `output: "export"` 설정이 필요하다.

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const isCloudflarePagesBuild = process.env.CLOUDFLARE_PAGES_BUILD === "1";

const nextConfig: NextConfig = {
  output: isCloudflarePagesBuild ? "export" : undefined,
  images: isCloudflarePagesBuild ? { unoptimized: true } : undefined,
};

export default nextConfig;
```

**환경변수로 분기한 이유**가 있다. `output: "export"`를 항상 켜두면 로컬 개발 서버에서 쓸 수 있는 기능이 제약된다. 그래서 Cloudflare 빌드일 때만 켜지도록 플래그를 뒀다.

`images: { unoptimized: true }`도 필수다. Next.js의 이미지 최적화는 **런타임에 서버가 이미지를 변환**하는 기능이다. 서버가 없는 정적 배포에서는 동작할 수 없어서, 이 옵션을 안 켜면 빌드 단계에서 바로 에러가 난다.

`package.json`에 전용 빌드 스크립트를 추가했다.

```json
{
  "scripts": {
    "build": "vinext build",
    "build:pages": "CLOUDFLARE_PAGES_BUILD=1 next build"
  }
}
```

로컬에서 먼저 돌려본다.

```bash
npm run build:pages
```

성공하면 프로젝트 루트에 `out/` 디렉터리가 생긴다. 안에 `index.html`이 있는지 꼭 확인하자.

```bash
ls out/
# index.html  _next/  favicon.svg  manifest.webmanifest  sw.js ...
```

**여기서 미리 확인하는 게 중요하다.** 로컬에서 안 되는 빌드는 Cloudflare에서도 안 된다. 클라우드 빌드 로그를 보며 디버깅하는 건 한 번 돌리는 데 1~2분씩 걸려서 훨씬 답답하다.

## Step 2. 여기서 다들 한 번 낚인다

이제 Cloudflare 대시보드로 간다. 왼쪽 메뉴에서 **Compute → Workers & Pages**로 들어가면, 오른쪽 위에 파란 **Create application** 버튼이 보인다. 당연히 이걸 누른다.

그런데 나오는 화면이 이렇다.

```
                        Create a Worker

              ┌─────────────────────────────────┐
              │  Ship something new             │
              │                                 │
              │  [🐙 Continue with GitHub  →]   │
              │  [🦊 Connect GitLab        ]    │
              │  [🌐 Start with Hello World!]   │
              │  [🧭 Select a template      ]   │
              │  [📁 Upload your static files]  │
              └─────────────────────────────────┘

           Looking to deploy Pages?  Get started
```

**제목이 "Create a Worker"다. Pages가 아니다.**

여기서 `Continue with GitHub`를 누르면 GitHub 저장소를 연결하는 화면이 나오고, 겉보기엔 잘 진행되는 것 같다. 하지만 이렇게 만들면 **Pages 프로젝트가 아니라 Worker가 만들어진다.** 그러면 주소도 이렇게 나온다.

```
프로젝트명.내계정서브도메인.workers.dev
```

내 계정 기준으로는 `repotape.backdev.workers.dev` 같은 형태다. `pages.dev`가 아니다. 그리고 계정 서브도메인(`backdev`)이 중간에 끼어서 주소가 한 마디 더 길어진다.

Pages로 만들려면 **화면 맨 아래 회색 작은 글씨**를 찾아야 한다.

> Looking to deploy Pages? **Get started**

이 `Get started` 링크를 눌러야 Pages 쪽으로 넘어간다. 화면 정중앙의 커다란 카드들 아래, 눈에 잘 안 띄는 위치에 있다.

### 왜 이렇게 되어 있나

Cloudflare가 Workers와 Pages를 통합하는 방향으로 가고 있어서다. 신규 프로젝트는 Workers(정적 자산 호스팅 포함)로 유도하고, Pages는 유지보수 모드에 가깝게 두는 흐름이다.

그래서 이런 의문이 생긴다. **그냥 Workers로 하면 안 되나?**

| 항목 | Cloudflare Pages | Workers (Static Assets) |
|---|---|---|
| 무료 주소 | `이름.pages.dev` | `이름.계정서브도메인.workers.dev` |
| 주소 길이 | 짧다 | 계정 서브도메인이 끼어 길다 |
| PR 프리뷰 댓글 | 자동으로 달림 | 없음 |
| 정적 사이트 설정 | 클릭 몇 번 | `wrangler.toml` 설정 필요 |
| 서버 로직 | 불가 (Functions 별도) | 자유롭게 가능 |

**정적 사이트를 짧은 주소로 올리는 게 목적이면 Pages가 여전히 낫다.** 주소가 짧고, 설정할 게 적고, PR을 올리면 봇이 프리뷰 URL을 댓글로 달아준다. 서버 로직이 필요해지면 그때 Workers로 옮겨도 늦지 않다.

## Step 3. Pages 진입점 찾아 들어가기

`Get started`를 누르면 드디어 Pages 화면이 나온다.

```
                          Get started
             Get started with Pages. How would you like to begin?

    ┌────────────────────────────────────────────────────────┐
    │ 🔀 Import an existing Git repository    [Get started]  │
    │    Start by importing an existing Git repository.      │
    ├────────────────────────────────────────────────────────┤
    │ ☁️  Drag and drop your files            [Get started]  │
    │    Upload your site's assets including HTML, CSS, JS.  │
    └────────────────────────────────────────────────────────┘
```

두 가지 방식이 있다.

- **Import an existing Git repository** — GitHub/GitLab 저장소 연결. push하면 자동 재배포된다.
- **Drag and drop your files** — 빌드된 폴더를 그냥 끌어다 놓는다. Git 연동 없음.

두 번째는 정말 간단하지만, 코드를 고칠 때마다 직접 빌드해서 다시 올려야 한다. **한 번 쓰고 말 게 아니라면 Git 연동을 강력히 추천한다.** 나는 첫 번째를 골랐다.

## Step 4. GitHub 저장소 연결

`Import an existing Git repository`의 Get started를 누르면 저장소 선택 화면이 뜬다.

```
                  Deploy a site from your account

    Select a repository to connect as your project's source code.
    New commits will trigger Cloudflare to automatically build and
    deploy your changes.

    [ GitHub ]  [ GitLab ]

    GitHub account
    ┌──────────────────────┐
    │ 내계정명          ▼  │
    └──────────────────────┘
    + Add account

    Select a repository
    ┌─────────────────────────────────────────────┐
    │ 🔍 Search repositories...                   │
    └─────────────────────────────────────────────┘
    ┌──────────────────┐  ┌──────────────────┐
    │ kidsplay         │  │ chain-play-privacy│
    └──────────────────┘  └──────────────────┘

                                  [Cancel]  [Begin setup]
```

처음이라면 여기서 GitHub 인증 창이 뜬다. **Cloudflare Workers and Pages**라는 GitHub App을 설치하는 절차다. 이 앱이 하는 일은 이렇다.

- 커밋이 올라오면 Cloudflare가 자동으로 빌드·배포
- 배포 상태를 GitHub의 체크(check run)로 표시
- PR마다 프리뷰 URL을 댓글로 달아줌 (Pages 전용 기능)

설치할 때 **All repositories**와 **Only select repositories** 중에 고르라고 나온다. 필요한 저장소만 고르는 쪽을 권한다. 나중에 저장소를 추가하고 싶으면 GitHub의 Settings → Applications에서 언제든 권한을 넓힐 수 있다.

> **저장소가 목록에 안 보인다면** 화면 아래의 "configure repository access" 링크로 가서 GitHub App의 접근 권한에 해당 저장소를 추가하면 된다. 권한을 안 준 저장소는 아예 목록에 뜨지 않는다.

저장소를 고르고 **Begin setup**을 누른다.

## Step 5. 빌드 설정 — 여기가 진짜 핵심

이 화면의 값들이 배포 성공 여부를 결정한다. 내가 넣은 값은 이렇다.

| 항목 | 입력값 | 설명 |
|---|---|---|
| **Project name** | `kidsnara` | **이게 그대로 주소가 된다** |
| **Production branch** | `main` | 이 브랜치에 push하면 프로덕션 배포 |
| **Framework preset** | `None` | 아래 설명 참고 |
| **Build command** | `npm install && npm run build:pages` | 설치 + 빌드 |
| **Build output directory** | `out` | 빌드 결과 폴더 |

### 프로젝트 이름이 곧 도메인이다

`kidsnara`를 넣으면 `kidsnara.pages.dev`가 된다. 여기서 알아야 할 게 두 가지다.

**첫째, 이름은 전 세계에서 유일해야 한다.** 나도 처음엔 `kidsplay`로 하고 싶었는데 이미 누가 쓰고 있었다. 그래서 `kidsnara`(키즈나라)로 바꿨다. 흔한 단어는 거의 다 선점되어 있다고 보면 된다. 후보를 2~3개 미리 생각해두자.

**둘째, 나중에 이름을 바꿀 수 없다.** 정확히는 프로젝트를 지우고 새로 만들어야 한다. 처음에 마음에 드는 걸로 정하는 게 좋다.

### Framework preset은 None으로

드롭다운에 `Next.js`가 있다. 하지만 **고르면 안 된다.**

프리셋의 `Next.js`는 서버 사이드 렌더링을 전제로 한 설정이라, `@cloudflare/next-on-pages` 같은 어댑터를 함께 쓰는 걸 가정한다. 우리는 `output: "export"`로 이미 정적 파일을 만들었으니 그럴 필요가 없다. `Next.js (Static HTML Export)` 프리셋이 보이면 그건 써도 되지만, **`None`으로 두고 명령어를 직접 넣는 게 가장 확실하다.** 프리셋이 뒤에서 뭘 바꾸는지 알 수 없는 것보다, 내가 적은 명령어가 그대로 도는 편이 디버깅하기 훨씬 편하다.

### 설치 명령어는 어디에 넣나

Pages 빌드 설정에는 **설치 명령어만 따로 넣는 칸이 없다.** 기본적으로 Cloudflare가 lock 파일을 보고 알아서 의존성을 설치한다.

| lock 파일 | 자동 실행되는 명령 |
|---|---|
| `package-lock.json` | `npm clean-install` |
| `yarn.lock` | `yarn install --frozen-lockfile` |
| `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |

대부분은 그냥 두면 된다. 그래도 명시하고 싶거나, 자동 감지가 어긋날 때는 **Build command 칸에 `&&`로 이어 붙이면 된다.**

```bash
npm install && npm run build:pages
```

CI 환경에서는 `npm install`보다 `npm ci`가 더 낫다는 얘기가 있는데, 맞는 말이다. lock 파일과 정확히 일치하는 버전만 설치하고 속도도 빠르다.

```bash
npm ci && npm run build:pages
```

다만 `npm ci`는 **`package.json`과 `package-lock.json`이 조금이라도 어긋나면 그 자리에서 실패한다.** 의존성을 추가하고 lock 파일 커밋을 깜빡했다면 빌드가 통째로 깨진다. 처음 배포할 때는 `npm install`로 시작해서 성공을 확인하고, 나중에 `npm ci`로 조여도 된다.

### Node 버전 지정

**Environment variables (advanced)** 를 펼쳐서 추가한다.

```
NODE_VERSION = 22.13.0
```

내 프로젝트는 `package.json`에 이렇게 걸려 있었다.

```json
"engines": { "node": ">=22.13.0" }
```

Cloudflare Pages(v3 빌드 시스템)의 기본 Node 버전은 **22.16.0**이라 사실 그냥 둬도 통과한다. 하지만 명시해두는 걸 권한다. **Cloudflare가 기본 버전을 올리면 어느 날 갑자기 빌드가 깨질 수 있기 때문이다.** 내가 정한 버전이 박혀 있으면 그럴 일이 없다.

환경변수 대신 프로젝트 루트에 파일로 넣어도 된다.

```bash
echo "22.13.0" > .nvmrc
```

`.nvmrc` 또는 `.node-version` 둘 다 인식한다. **환경변수가 파일보다 우선순위가 높다.** 로컬 개발자들끼리 Node 버전을 맞추는 용도로도 쓰이니, 개인적으로는 `.nvmrc`를 커밋해두는 쪽을 좋아한다.

> 한 가지 주의: v3 빌드 시스템에서는 `lts/hydrogen` 같은 코드네임을 못 쓴다. `22.13.0`처럼 숫자로 정확히 적어야 한다.

설정을 다 넣었으면 **Save and Deploy**를 누른다.

## Step 6. 배포 확인

빌드 로그가 실시간으로 흘러간다. 보통 1~2분이면 끝난다. 완료되면 `https://프로젝트명.pages.dev` 링크가 뜬다.

터미널에서도 확인해봤다.

```bash
curl -s -o /dev/null -w "HTTP %{http_code} | %{time_total}s\n" -L https://kidsnara.pages.dev/
# HTTP 200 | 0.057102s
```

57ms. CDN 덕을 확실히 본다.

주요 파일이 다 올라갔는지도 한 번에 확인했다.

```bash
for p in / /manifest.webmanifest /sw.js /favicon.svg; do
  printf "%-24s " "$p"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" -L "https://kidsnara.pages.dev$p"
done
```

```
/                        HTTP 200
/manifest.webmanifest    HTTP 200
/sw.js                   HTTP 200
/favicon.svg             HTTP 200
```

주소 길이도 비교해보면 이렇다.

```
이전: kidsplay-little-playground.hyunseok-yu1.chatgpt.site  (49자, 로그인 필요)
이후: kidsnara.pages.dev                                     (18자, 로그인 불필요)
```

## 트러블슈팅

### HTTP 522가 뜬다

배포 직후에 접속하면 **522 (Connection Timed Out)** 가 나올 수 있다. 나도 처음에 이걸 보고 뭔가 잘못됐나 싶었는데, 대부분 **아직 첫 배포가 안 끝난 것**이다.

대시보드의 **Deployments** 탭에서 상태를 확인하자.

| 상태 | 대응 |
|---|---|
| Building / Deploying | 정상. 1~2분 기다린다 |
| Failed | 빌드 로그를 열어 에러를 확인한다 |
| 목록이 비어 있음 | 빌드가 트리거되지 않았다. Create deployment를 누른다 |

### 빌드는 성공했는데 404가 뜬다

**Build output directory**가 틀렸을 가능성이 높다. 프레임워크마다 결과 폴더 이름이 다르다.

| 프레임워크 | 출력 디렉터리 |
|---|---|
| Next.js (`output: "export"`) | `out` |
| Vite / SvelteKit | `dist` |
| Create React App | `build` |
| Astro | `dist` |
| Gatsby | `public` |

로컬에서 빌드한 뒤 `index.html`이 실제로 어느 폴더에 생기는지 확인하고 그 이름을 적으면 된다.

### 특정 경로만 404가 뜬다

내 경우 `/coloring/`이 404였다. 잠깐 당황했는데, 확인해보니 그 폴더는 페이지가 아니라 **SVG 이미지만 들어 있는 에셋 폴더**였다. 정적 호스팅은 `index.html`이 없는 디렉터리에 대해 자동으로 목록을 만들어주지 않는다. `/coloring/butterfly.svg` 같은 개별 파일은 정상적으로 200이 나왔다.

**디렉터리 자체가 404인 것과 그 안의 파일이 404인 것은 완전히 다른 문제다.** 개별 파일부터 찔러보자.

### 잘못 만든 Worker가 남아 있다

`Get started` 링크를 못 찾아서 Worker로 먼저 만들었다면, Workers & Pages 목록에 쓸모없는 프로젝트가 하나 남는다. 오른쪽 `...` 메뉴에서 삭제하면 된다. 이름을 점유하고 있을 수 있으니 지워두는 게 좋다.

## 자주 쓰는 명령어 정리

대시보드 대신 CLI로도 할 수 있다. 급하게 한 번 올릴 때 유용하다.

```bash
# Cloudflare 로그인 (브라우저가 열린다)
npx wrangler login

# 빌드된 폴더를 바로 배포
npx wrangler pages deploy out --project-name=kidsnara

# 배포 목록 확인
npx wrangler pages deployment list --project-name=kidsnara

# 프로젝트 목록
npx wrangler pages project list
```

다만 **일상적으로는 Git 연동이 훨씬 편하다.** push만 하면 알아서 배포되고, 실패하면 GitHub에서 빨간 체크로 바로 보인다.

## 배포하고 나서 놓치기 쉬운 것

배포가 끝나고 나서 발견한 게 하나 있다. 코드에 사이트 주소가 하드코딩되어 있었다.

```ts
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kidsplay.pages.dev";
```

`kidsplay`로 만들려다 이름이 선점돼서 `kidsnara`로 바꿨는데, 코드의 기본값은 그대로였다. 이러면 **OG 이미지 URL이 존재하지 않는 도메인을 가리킨다.** 카톡이나 슬랙에 링크를 붙여도 썸네일이 안 뜬다.

프로젝트 이름을 바꿨다면 아래 항목들을 한 번씩 훑어보자.

- `metadataBase`, OG 태그의 사이트 URL
- `manifest.webmanifest`의 `start_url`, `scope`
- README의 데모 링크
- 서비스 워커에 캐싱 대상 URL을 절대 경로로 적어뒀다면 그것도

## 정리

전체 흐름을 한눈에.

1. **로컬에서 정적 빌드부터 성공시킨다** — `output: "export"` + `images.unoptimized`, `out/index.html` 확인
2. **Workers & Pages → Create application** — 여기서 Worker 화면이 뜬다
3. **화면 맨 아래 "Looking to deploy Pages? Get started"** — 이걸 못 찾으면 `workers.dev` 주소가 된다
4. **Import an existing Git repository** — GitHub App 설치하고 저장소 선택
5. **빌드 설정** — 프로젝트 이름(=도메인), Framework preset은 `None`, Build command에 설치 명령어까지 `&&`로 연결, 출력 디렉터리 정확히
6. **`NODE_VERSION` 환경변수 또는 `.nvmrc`** — 기본값에 의존하지 말고 명시
7. **Save and Deploy** — 1~2분 뒤 `이름.pages.dev`

가장 큰 함정은 **Create application이 Pages가 아니라 Worker 생성 화면으로 간다**는 점이었다. 기술적으로 어려운 건 하나도 없었는데, 이 링크 하나를 못 찾아서 시간을 꽤 썼다.

나중에 진짜 도메인을 사면 프로젝트의 **Custom domains** 탭에서 몇 번 클릭으로 연결할 수 있고, 기존 `pages.dev` 주소도 그대로 살아 있다. 일단 무료로 올려두고 필요해지면 도메인을 붙이는 순서를 권한다.

이렇게 올린 결과물은 [kidsnara.pages.dev](https://kidsnara.pages.dev)에 있다. 무엇을 왜 만들었는지는 [결제 팝업 없는 아이 전용 놀이터를 직접 만들었다](/ko/posts/kidsplay_fullscreen_kiosk_20260723)에 따로 적었다.
