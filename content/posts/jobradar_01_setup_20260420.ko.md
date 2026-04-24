---
title: '[JobRadar 1편] 프로젝트 세팅 — 내 취업을 위해 AI 툴을 직접 만들었다'
date: '2026-04-20'
description: >-
  채용공고 자동 수집부터 AI 매칭까지 — JobRadar 사이드 프로젝트 1편. Next.js + Supabase + Vercel 초기
  세팅을 단계별로 정리했다.
tags:
  - JobRadar
  - NextJS
  - Vercel
  - 사이드프로젝트
---

취업 준비를 하다 보면 매일 반복되는 일이 있다.

1. Indeed, Glassdoor 열기
2. 키워드 검색 (`React Native`, `Fullstack`, `Node.js`...)
3. 공고 하나하나 열어서 읽기
4. "나한테 맞나?" 판단하기
5. 맞으면 커버레터 쓰기
6. 회사마다 톤 맞춰 다듬기
7. 반복

하루에 이 사이클을 3~5번 하다 보면 지친다. 특히 커버레터가 문제다. 비슷한 내용인데 회사마다 다르게 써야 하고, 쓰다 보면 나도 내가 누군지 헷갈린다.

그래서 생각했다. **이거 AI한테 맡기면 어떨까?**

공고 자동 수집 → AI가 나한테 맞는 공고 골라줌 → 커버레터 자동 생성 → 아침에 이메일로 요약 받기.

이게 **JobRadar** 프로젝트의 시작이다.

이 시리즈는 JobRadar를 처음부터 만드는 과정을 기록한다. 1편인 오늘은 프로젝트 초기 세팅 — Next.js 생성부터 Vercel 배포까지다.

---

## 기술 스택 한눈에 보기

본격적으로 시작하기 전에 전체 스택을 정리해두면 이해가 편하다.

| 역할 | 기술 | 선택 이유 |
|------|------|-----------|
| 프레임워크 | Next.js (TypeScript + App Router) | 프론트 + API Route를 하나로 |
| 스타일 | Tailwind CSS | 빠른 UI 작업 |
| DB | Supabase (PostgreSQL) | 무료 tier, 실시간 기능 |
| AI | Claude API (Anthropic) | 매칭 점수 + 커버레터 생성 |
| 스크래핑 | Playwright | JS 렌더링 페이지 대응 |
| 이메일 | Resend | 무료 3,000건/월 |
| 배포 | Vercel | Next.js 최적화, 무료 |
| 스케줄러 | Vercel Cron Jobs | 매일 자동 스크래핑 + 이메일 |

**MVP 기간 동안 비용은 0원**이다. 모든 서비스가 무료 tier 범위 안에 들어온다.

---

## 사전 준비

- Node.js 18 이상
- GitHub 계정
- Vercel 계정 (GitHub 계정으로 가입하면 편함)
- 터미널 기본 사용법

---

## Step 1 — Next.js 프로젝트 생성

`create-next-app`으로 프로젝트를 만든다. 옵션을 하나씩 골라야 하는데, 아래처럼 맞추면 된다.

```bash
npx create-next-app@latest jobradar
```

설치 중 나오는 질문들:

```
✔ Would you like to use TypeScript? › Yes
✔ Would you like to use ESLint? › Yes
✔ Would you like to use Tailwind CSS? › Yes
✔ Would you like your code inside a `src/` directory? › Yes
✔ Would you like to use App Router? (recommended) › Yes
✔ Would you like to use Turbopack for next dev? › No
✔ Would you like to customize the import alias? › No
```

`src/` 구조와 App Router를 선택하는 게 포인트다. 폴더를 깔끔하게 분리할 수 있고, 나중에 API Route 관리하기도 편하다.

생성이 끝나면 이런 구조가 만들어진다:

```
jobradar/
├── src/
│   └── app/
│       ├── favicon.ico
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── public/
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── eslint.config.mjs
└── tsconfig.json
```

실행해서 확인해보자:

```bash
cd jobradar
npm run dev
```

`http://localhost:3000`에 Next.js 기본 화면이 뜨면 성공이다.

---

## Step 2 — 폴더 구조 설계

기본 구조에 도메인별 폴더를 추가한다. 나중에 파일이 늘어날 때 길을 잃지 않으려면 처음부터 잡아두는 게 낫다.

```
src/
├── app/
│   ├── page.tsx              # 메인 대시보드
│   ├── jobs/[id]/page.tsx    # 잡 상세 페이지
│   ├── profile/page.tsx      # 내 프로파일 설정
│   └── api/
│       ├── scrape/route.ts   # 스크래핑 API (Cron 트리거)
│       ├── match/route.ts    # AI 매칭 API
│       ├── cover/route.ts    # 커버레터 생성 API
│       └── digest/route.ts   # 이메일 발송 API
├── components/
│   ├── jobs/                 # 잡 관련 컴포넌트
│   ├── cover/                # 커버레터 관련 컴포넌트
│   └── ui/                   # 공통 UI 컴포넌트
├── lib/
│   ├── scrapers/             # 스크래퍼 (Indeed, Glassdoor)
│   ├── claude.ts             # Claude API 클라이언트
│   ├── supabase.ts           # Supabase 클라이언트
│   └── email.ts              # Resend 이메일
└── types/
    └── index.ts              # 공통 TypeScript 타입
```

`lib/`는 외부 서비스 클라이언트를 모아두는 곳이다. **Supabase 클라이언트는 `lib/supabase.ts`에서만, Claude API는 `lib/claude.ts`에서만 import하는 규칙**을 처음부터 잡아두면 나중에 관리가 훨씬 편하다.

---

## Step 3 — 환경변수 설정

API 키나 DB 접속 정보는 코드에 직접 넣으면 절대 안 된다. `.env.local`에 따로 관리하고, `.gitignore`에 추가해서 GitHub에 올라가지 않도록 한다.

```bash
# .env.example
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
RESEND_API_KEY=
```

`.gitignore`에서 반드시 확인:

```bash
.env*
!.env.example   # .env.example은 예외 — 커밋 대상
```

`!.env.example`을 빠뜨리면 `.env.example`도 gitignore에 걸려버린다.

---

## Step 4 — CLAUDE.md 작성

이 프로젝트는 Claude Code와 함께 개발한다. AI 에디터가 프로젝트 맥락을 이해할 수 있도록 `CLAUDE.md` 파일을 루트에 만들어준다.

```markdown
# JobRadar — CLAUDE.md

## 프로젝트
AI 기반 잡 매칭 & 커버레터 자동화.
호주/NZ IT 채용공고 자동 수집 → Claude API 매칭 → 맞춤 커버레터 생성 → 이메일 다이제스트.

## 기술 스택
- 프레임워크: Next.js 14 App Router + TypeScript
- 스타일: Tailwind CSS
- DB: Supabase (PostgreSQL)
- AI: Claude API (Anthropic SDK)
- 스크래핑: Playwright
- 이메일: Resend
- 배포: Vercel + Vercel Cron

## 코딩 규칙
- TypeScript strict mode 사용
- Supabase 클라이언트는 src/lib/supabase.ts 에서만 import
- Claude API는 src/lib/claude.ts 에서만 import
- 환경변수는 .env.local 사용, 절대 커밋 금지
- 서버 컴포넌트 기본, 클라이언트 상태 필요 시에만 'use client'
```

`CLAUDE.md`가 잘 작성돼 있으면, AI한테 "Supabase 클라이언트 만들어줘"라고만 해도 알아서 `src/lib/supabase.ts`에 맞게 만들어준다.

---

## Step 5 — GitHub 레포 생성 및 push

```bash
git init
git add src/ public/ next.config.ts package.json tsconfig.json
git add eslint.config.mjs postcss.config.mjs .gitignore .env.example CLAUDE.md
git commit -m "Initial commit from Create Next App"
git remote add origin https://github.com/your-username/jobradar.git
git branch -M main
git push -u origin main
```

`git add -A`나 `git add .`는 쓰지 않는다. `.env.local` 같은 민감한 파일이 실수로 올라갈 수 있다.

---

## Step 6 — Vercel 배포

1. [vercel.com](https://vercel.com)에 접속해서 GitHub 계정으로 로그인
2. `Add New Project` 클릭
3. 방금 push한 `jobradar` 레포 선택
4. 설정은 Next.js 자동 감지로 기본값 유지
5. `Deploy` 클릭

2~3분 뒤에 `https://jobradar-xxxx.vercel.app` 형태의 URL이 생긴다. 이후 `main` 브랜치에 push할 때마다 자동으로 재배포된다.

---

## 자주 쓰는 명령어 요약

```bash
npm run dev        # 개발 서버 실행
npm run build      # 빌드 확인 (배포 전 로컬에서 먼저 검증)
npx tsc --noEmit   # 타입 체크
npm run lint       # 린트
```

---

## 트러블슈팅

**`.env.example`이 gitignore에 걸리는 경우**

`.gitignore`에 `.env*`만 써두면 `.env.example`도 같이 무시된다.

```
.env*
!.env.example
```

**Vercel 배포 후 환경변수 오류**

로컬 `.env.local`에 있는 값들은 Vercel에 자동으로 올라가지 않는다. Vercel 대시보드 → Settings → Environment Variables에서 직접 등록해야 한다.

---

## 정리 — 핵심 흐름 한눈에

```
npx create-next-app → 폴더 구조 설계 → 환경변수 설정
→ CLAUDE.md 작성 → GitHub push → Vercel 배포
```

다음 편에서는 Playwright로 Indeed · Seek를 스크래핑하면서 만난 것들을 다룬다.

전체 코드: [github.com/hyunseokyu1-netizen/jobradar](https://github.com/hyunseokyu1-netizen/jobradar)
