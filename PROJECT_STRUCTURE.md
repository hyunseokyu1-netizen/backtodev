# backtodev — 프로젝트 구조 문서

## 프로젝트 개요
- **사이트**: https://backtodev.com
- **성격**: 개발자 개인 블로그 (개발 재시작 기록)
- **배포**: Vercel (GitHub 연동 자동 배포)
- **저장소**: github.com/hyunseokyu1-netizen/backtodev

## 기술 스택
| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript, React 19 |
| 스타일 | globals.css (CSS 변수 기반, Tailwind 일부) |
| 다국어 | next-intl (ko / en) |
| 콘텐츠 | Markdown (gray-matter, @next/mdx) |
| 인증 | JWT (jose) — admin 전용 |
| 배포 | Vercel |
| GitHub API | GraphQL API (포스트 읽기), REST Contents API (admin 쓰기) |

---

## 폴더 구조

```
backtodev/
├── app/
│   ├── [locale]/               # 공개 페이지 (ko/en 라우팅)
│   │   ├── layout.tsx          # 공통 레이아웃 + generateStaticParams (locales)
│   │   ├── page.tsx            # 홈 (최신 포스트 6개)
│   │   ├── posts/
│   │   │   ├── page.tsx        # 포스트 목록 (검색/태그 필터)
│   │   │   └── [slug]/page.tsx # 포스트 상세
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── portfolio/page.tsx
│   │   └── privacy/page.tsx
│   │
│   ├── admin/                  # 어드민 (인증 필요, /admin/login 제외)
│   │   ├── layout.tsx
│   │   ├── page.tsx            # 포스트 목록 관리
│   │   ├── login/page.tsx
│   │   ├── posts/
│   │   │   ├── new/page.tsx    # 새 글 작성
│   │   │   └── [slug]/page.tsx # 글 수정
│   │   └── _components/
│   │       ├── AdminPostList.tsx
│   │       └── PostEditor.tsx  # 마크다운 에디터 (이미지 업로드 포함)
│   │
│   ├── api/
│   │   └── admin/
│   │       ├── auth/login/route.ts   # POST — JWT 발급
│   │       ├── auth/logout/route.ts  # POST — 쿠키 삭제
│   │       ├── images/route.ts       # POST — 이미지 → GitHub public/images/ 업로드 (파일당 커밋 1개)
│   │       ├── posts/route.ts        # GET(목록) / POST(새글)
│   │       ├── posts/[slug]/route.ts # GET / PUT(수정) / DELETE
│   │       └── translate/route.ts    # POST — DeepL API 번역
│   │
│   ├── globals.css             # 전역 스타일 (CSS 변수, 다크 테마)
│   ├── robots.ts
│   └── sitemap.ts
│
├── components/
│   ├── Nav.tsx                 # 상단 네비게이션 (다국어 전환 포함)
│   ├── PostCard.tsx            # 홈 포스트 카드
│   ├── PostsClient.tsx         # 포스트 목록 클라이언트 (검색/태그 필터 — "use client")
│   ├── PostContent.tsx         # 포스트 본문 렌더러
│   ├── MarkdownContent.tsx     # 마크다운 → HTML
│   ├── BackButton.tsx
│   └── DecorativeBlobs.tsx
│
├── content/
│   ├── posts/                  # 라이브 포스트 (96개, ko/en 쌍)
│   │   └── {slug}.{ko|en}.md  # 파일명 규칙: slug.lang.md
│   └── scheduled/             # 예약 포스트 (publish_date 도달 시 GitHub Actions가 posts/로 이동)
│       └── {slug}.ko.md
│
├── lib/
│   ├── posts.ts               # 포스트 읽기 (IS_PROD: GitHub GraphQL / 로컬: fs)
│   ├── github.ts              # GitHub REST Contents API 래퍼 (getFile, putFile, deleteFile 등)
│   └── auth.ts                # JWT verifyToken (jose)
│
├── i18n/
│   ├── routing.ts             # locales: ["en","ko"], defaultLocale: "ko"
│   ├── request.ts             # next-intl 서버 설정
│   └── navigation.ts          # next-intl Link, redirect 등
│
├── messages/
│   ├── ko.json                # 번역 키: nav, home, posts, post, about
│   └── en.json
│
├── public/
│   ├── images/                # 블로그 포스트 이미지 (admin에서 업로드)
│   └── portfolio/             # 포트폴리오 이미지
│
├── docs/
│   ├── DEPLOYMENT.md
│   ├── design-system.md
│   └── jobradar_style_guide.md
│
├── .github/workflows/
│   └── scheduled-post.yml     # 매일 00:05 KST — content/scheduled/ → content/posts/ 이동
│
├── proxy.ts                   # Next.js 미들웨어 (admin 인증 + next-intl 처리)
├── next.config.ts             # MDX + next-intl 플러그인
├── AGENTS.md                  # Claude 작업 지침 (이 파일 참조됨)
└── PROJECT_STRUCTURE.md       # ← 이 파일
```

---

## 핵심 데이터 흐름

### 포스트 읽기 (공개 페이지)
```
요청 → lib/posts.ts → getAllPosts() / getPost()
  └── IS_PROD (process.env.VERCEL)?
      ├── true  → GitHub GraphQL API (1번 호출로 전체 파일+내용)
      └── false → 로컬 fs (content/posts/)
```
- `IS_PROD = !!process.env.VERCEL`
- GraphQL endpoint: `https://api.github.com/graphql`
- 파일명 파싱: `slug.ko.md` / `slug.en.md` / `slug.md`(레거시=ko)
- locale 없는 경우 fallback: ko→en, en→ko

### 포스트 쓰기 (admin)
```
Admin Editor → /api/admin/posts → lib/github.ts → GitHub REST Contents API
  └── putFile() → PUT /repos/{owner}/{repo}/contents/{path} (커밋 1개)
```

### 이미지 업로드 (admin)
```
이미지 선택 → /api/admin/images → putFileBinary() → public/images/ 에 커밋
  └── 현재 이슈: 파일 1개당 커밋 1개 생성됨
```

### 예약 포스트 배포
```
content/scheduled/{slug}.md (publish_date 필드)
  → GitHub Actions (매일 00:05 KST)
  → publish_date <= 오늘 이면 content/posts/로 mv + git push
  → Vercel 자동 재배포
```

---

## 인증 (Admin)
- 미들웨어 (`proxy.ts`): `/admin/*` 접근 시 `admin_token` 쿠키 JWT 검증
- `/admin/login` 과 `/api/admin/auth/*` 는 인증 없이 허용
- JWT: `lib/auth.ts` (`jose` 라이브러리)

---

## 환경 변수
| 변수 | 용도 |
|------|------|
| `GITHUB_TOKEN` | GitHub API 인증 (GraphQL + REST) |
| `GITHUB_OWNER` | 저장소 소유자 (`hyunseokyu1-netizen`) |
| `GITHUB_REPO` | 저장소 이름 (`backtodev`) |
| `ADMIN_PASSWORD_HASH` | admin 로그인 비밀번호 해시 |
| `JWT_SECRET` | JWT 서명 키 |
| `DEEPL_API_KEY` | 번역 API |
| `VERCEL` | Vercel 환경 여부 (자동 주입, IS_PROD 판단에 사용) |

> ⚠️ Vercel CLI로 환경변수 설정 시 `echo` 대신 `printf` 사용 (`echo`는 `\n` 자동 추가)

---

## 다국어 (i18n)
- `next-intl` 사용, locales: `["en", "ko"]`, defaultLocale: `"ko"`
- URL 구조: `/{locale}/posts`, `/{locale}/posts/{slug}`
- 메시지 파일: `messages/ko.json`, `messages/en.json`
- 서버 컴포넌트: `getTranslations("namespace")` 사용
- `[locale]` 라우트에서 locale은 `await params`로 꺼낼 것 (`getLocale()` 금지 — 정적 렌더링 충돌)

---

## 주의 사항 (트러블슈팅 이력)
- **`getLocale()` 사용 금지**: `headers()` 내부 호출 → `DYNAMIC_SERVER_USAGE` 에러. `params.locale` 사용
- **GitHub REST API Rate Limit**: 파일 수만큼 N+1 호출 → 포스트 읽기는 GraphQL로 전환 완료
- **Vercel 환경변수 개행**: `echo` → `printf`로 설정해야 `\n` 없음
- **YAML apostrophe**: title/description에 `'` 포함 시 `"..."` 큰따옴표 사용 (Vercel 빌드 실패 방지)
- **이미지 업로드**: 현재 파일 1개당 커밋 1개 (개선 대상: GitHub Tree API로 배치 커밋)
