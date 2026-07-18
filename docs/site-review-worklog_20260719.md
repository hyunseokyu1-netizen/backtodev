# 사이트 리뷰 및 개선 작업 기록

- 작업일: 2026-07-19
- 대상: `backtodev.com` 블로그 및 포트폴리오
- 저장 구조: 별도 DB 없이 GitHub 저장소의 Markdown/JSON 콘텐츠 사용
- 배포 구조: `main` 브랜치 푸시 시 Vercel 배포

## 작업 목적

포트폴리오 페이지를 먼저 검토한 뒤 사이트 전체의 성능, 콘텐츠 조회 구조, SEO, 접근성, 다국어, 보안, 예약 발행, 방명록, 정적 자산을 점검했다.

변경 사항은 필요한 경우 하나씩 되돌릴 수 있도록 작업 단위별 독립 커밋으로 나눴다.

## 최초 점검에서 확인한 문제

### 포트폴리오

- 한 페이지에 프로젝트 설명과 이미지가 모두 노출되어 내용이 지나치게 길었다.
- 초기 HTML이 약 272KB였고 이미지 태그가 약 50개 생성됐다.
- 대표 작업과 기타 작업의 시각적 우선순위가 명확하지 않았다.
- 내용을 줄인 뒤에는 기타 프로젝트의 기존 설명과 이미지에 접근할 방법이 사라졌다.

### 성능 및 콘텐츠 조회

- 공개 글 목록이 프로덕션 요청마다 GitHub GraphQL API를 `no-store`로 조회했다.
- 로컬 프로덕션 측정에서 글 목록 응답에 약 1.2~2.4초가 걸렸다.
- 홈 진입 시 Three.js 기반 픽셀 마을 오버레이가 자동으로 로드됐다.
- 홈 초기 JavaScript가 약 1.245MB였다.

### SEO

- 하위 페이지가 루트 Open Graph 정보를 일부 상속해 공유 제목과 URL이 부정확했다.
- 공유용 대표 이미지가 없었다.
- 사이트맵에 포트폴리오, 픽셀 마을, 앱 개인정보처리방침 일부가 빠져 있었다.
- `www`와 루트 도메인의 중복 접근 가능성이 있었다.
- 관리자 페이지에 검색 엔진 차단 메타데이터가 없었다.

### 품질 및 운영

- 한국어 화면에 영어 고정 문구가 남아 있었다.
- 글 읽기 시간이 항상 1분으로 표시됐다.
- 라이트박스와 모바일 메뉴의 키보드·스크린리더 처리가 부족했다.
- ESLint 오류와 경고가 남아 있었다.
- 의존성 보안 취약점이 있었다.
- 예약 발행 워크플로우가 중복 실행, 잘못된 날짜, 동일 파일 덮어쓰기에 취약했다.
- 방명록 JSON을 동시에 저장하면 GitHub SHA 충돌로 한 요청이 실패할 수 있었다.
- 손상된 방명록 JSON을 빈 배열로 읽어 다음 저장에서 기존 데이터를 덮어쓸 가능성이 있었다.
- 코드와 콘텐츠에서 참조하지 않는 대용량 이미지가 남아 있었다.

## 적용한 변경

### 1. 의존성 보안 업데이트

- 커밋: `6639443 chore: 보안 취약 의존성 업데이트`
- Next.js, `@next/mdx`, `eslint-config-next`, `next-intl`을 호환 버전으로 업데이트했다.
- `postcss` 보안 버전을 override로 고정했다.
- `npm audit` 취약점을 0개로 정리했다.

### 2. 포트폴리오 정보 구조 정리

- 커밋: `d538e02 feat: 포트폴리오 대표 프로젝트 중심으로 재구성`
- 파일: `app/[locale]/portfolio/page.tsx`
- RepoNote, Blog Auto-Publisher SaaS, Matchda를 대표 프로젝트로 배치했다.
- 나머지 프로젝트는 기술 스택과 링크 중심의 간결한 카드로 변경했다.
- 실제 이미지 크기와 `sizes`를 지정하고 불필요한 priority preload를 제거했다.
- 1차 변경 후 초기 HTML은 약 189KB, 이미지 태그는 13개, 이미지 preload는 0개가 됐다.

### 3. 공개 포스트를 빌드 콘텐츠에서 조회

- 커밋: `6f1cda0 perf: 공개 포스트를 빌드 콘텐츠에서 조회`
- 파일: `lib/posts.ts`
- 공개 글 조회가 프로덕션에서도 `content/posts/`를 직접 읽도록 변경했다.
- 공개 페이지의 런타임 GitHub GraphQL 호출을 제거했다.
- slug 경로를 검증해 허용되지 않은 경로 접근을 차단했다.
- 로컬 프로덕션 warm 요청 기준 글 목록 응답이 약 0.03초로 줄었다.
- Next.js 파일 추적 경고도 제거됐다.

### 4. 홈 픽셀 마을 선택 진입 방식 적용

- 커밋: `2de6d4a perf: 홈 픽셀 마을을 선택 진입 방식으로 변경`
- 홈 진입 시 자동으로 열리던 전체 화면 Village 오버레이를 제거했다.
- 포트폴리오와 글 목록을 주 CTA로 배치하고 픽셀 마을은 명시적인 링크로 진입하게 했다.
- 홈 초기 JavaScript는 약 1.245MB에서 685KB로 감소했다.
- 홈 HTML은 약 106KB에서 76KB로 감소했다.

### 5. 페이지별 SEO와 공유 이미지 개선

- 커밋: `1101968 feat: 페이지별 SEO 메타데이터와 공유 이미지 개선`
- 주요 파일:
  - `lib/metadata.ts`
  - `app/og/route.ts`
  - `components/OpenGraphImage.tsx`
  - `app/sitemap.ts`
  - `app/robots.ts`
  - `proxy.ts`
- locale별 canonical, hreflang, Open Graph, Twitter 메타데이터를 통합했다.
- 1200×630 공유 이미지를 `/og`에서 생성하도록 추가했다.
- 사이트맵에 포트폴리오, 픽셀 마을, 앱 개인정보처리방침과 언어 대체 URL을 추가했다.
- `/admin`, `/api`를 robots에서 차단하고 관리자 페이지를 `noindex`로 설정했다.
- `www.backtodev.com` 요청을 루트 도메인으로 308 리다이렉트하도록 했다.

### 6. 다국어와 읽기 시간 개선

- 커밋: `f6099ab fix: 한국어 화면 번역과 읽기 시간 계산 개선`
- 내비게이션, 홈, 글 목록, 검색, 토픽, 빈 결과 문구를 locale에 맞게 표시한다.
- 한국어 날짜 형식을 적용했다.
- 고정된 1분 대신 실제 본문 단어 수를 기준으로 읽기 시간을 계산한다.

### 7. 접근성과 ESLint 정리

- 커밋: `d5bc52f fix: 키보드 접근성과 탐색 경험 개선`
- 본문 바로가기 링크와 전역 `focus-visible` 스타일을 추가했다.
- `prefers-reduced-motion` 사용자의 애니메이션과 전환 효과를 축소했다.
- 모바일 메뉴에 `aria-expanded`, `aria-controls`, 현재 페이지 정보를 추가했다.
- 라이트박스에 dialog 의미, 포커스 고정, ESC 닫기, 트리거 포커스 복귀를 추가했다.
- 관리자 내부 링크를 Next.js `Link`로 변경했다.
- ESLint 오류와 경고를 모두 제거했다.

### 8. 기본 보안 응답 헤더 추가

- 커밋: `e49d7a8 chore: 기본 보안 응답 헤더 추가`
- 파일: `next.config.ts`
- `X-Powered-By` 응답 헤더를 제거했다.
- 다음 헤더를 전체 경로에 적용했다.
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
- Google AdSense 외부 스크립트와 충돌할 수 있어 CSP는 이번 작업에서 추가하지 않았다.

### 9. 예약 발행 워크플로우 안정화

- 커밋: `d29f30b ci: 예약 발행 워크플로우 안정성 개선`
- 파일: `.github/workflows/scheduled-post.yml`
- 동일 예약 발행 워크플로우가 동시에 실행되지 않도록 concurrency group을 추가했다.
- main 브랜치에서만 발행하도록 제한했다.
- `actions/checkout@v6`, 전체 Git 이력, 10분 timeout을 적용했다.
- 잘못된 날짜 형식은 건너뛰고 로그에 남긴다.
- `content/posts/`에 동일 이름 파일이 있으면 덮어쓰지 않는다.
- 작업 시작과 push 직전에 원격 main 변경 사항을 반영한다.
- 커밋 작성자를 `github-actions[bot]`으로 변경했다.

### 10. 방명록 저장 안정성 및 요청 검증

- 커밋: `a45b7f3 fix: 방명록 저장 충돌과 요청 검증 강화`
- 주요 파일:
  - `app/api/guestbook/route.ts`
  - `lib/guestbook.ts`
  - `lib/github.ts`
- GitHub Contents API가 `409 Conflict`를 반환하면 최신 JSON을 다시 읽고 최대 3회 저장을 재시도한다.
- 재시도할 때 빈 좌표를 다시 계산해 같은 위치에 나무가 겹치지 않도록 했다.
- JSON이 손상됐거나 배열이 아니면 빈 방명록으로 처리하지 않고 저장을 중단한다.
- JSON Content-Type만 허용하고 요청 본문을 2KB로 제한했다.
- UUID 기반 방명록 ID와 한국어·영어 오류 응답을 적용했다.
- 저장 성공 이후에만 IP throttle 시간을 기록한다.

### 11. 게시글 이미지 링크 복구

- 커밋: `a7d5c5c fix: Google Play 게시글 이미지 링크 복구`
- Google Play 관련 한글·영문 게시글에서 타임스탬프 한 자리가 잘못된 이미지 URL을 실제 파일명으로 수정했다.

### 12. 미사용 이미지 정리

- 커밋: `bdfc1ee chore: 미사용 이미지 자산 정리`
- 추적 파일 전체를 검색해 참조가 0건인 이미지 9개를 제거했다.
- 약 4.37MB의 저장소 용량을 정리했다.
- 삭제한 이미지는 Git 이력에 남아 있어 커밋을 되돌리면 복구할 수 있다.

### 13. 기타 프로젝트 상세 모달 복원

- 커밋: `d5a73df feat: 포트폴리오 프로젝트 상세 모달 추가`
- 주요 파일:
  - `components/ExpandableProjectList.tsx`
  - `components/PortfolioProjectDetails.tsx`
  - `app/[locale]/portfolio/page.tsx`
- 기타 프로젝트 카드에 `자세히 보기 · 사진 N` 버튼을 추가했다.
- 버튼을 누르면 해당 프로젝트의 기존 설명, 전체 기술 스택, 링크, 대표 이미지, 스크린샷 갤러리가 모달에 표시된다.
- 선택한 프로젝트 한 개의 상세 내용과 이미지만 렌더링한다.
- 모달은 ESC, 배경 클릭, 닫기 버튼을 지원한다.
- 모달 내부 포커스를 순환시키고 닫은 뒤 원래 버튼으로 복귀한다.
- 상세 이미지에서는 기존 라이트박스를 계속 사용할 수 있다.
- 모바일 화면에서는 viewport 높이에 맞춰 모달 내부가 스크롤된다.
- 최종 초기 HTML은 약 167KB이며 초기 이미지 태그는 13개로 유지된다.

## 작업 중 자동 발행된 콘텐츠

- `0280341 post: 예약 포스트 2 개 발행 (2026-07-19)`
- `github_grass_backdate_20260701.ko.md`
- `github_grass_backdate_20260701.en.md`

이 커밋은 사이트 개선 작업이 아니라 예약 발행 워크플로우가 예정된 글을 `content/scheduled/`에서 `content/posts/`로 옮긴 커밋이다. 이후 원격 main과 병합한 커밋은 `eb7a509`이다.

## 최종 검증 결과

다음 검증을 완료했다.

```bash
npm run lint
npm run build
npm audit --audit-level=moderate
git diff --check
```

- ESLint: 오류·경고 없음
- Next.js 프로덕션 빌드: 성공
- 정적 페이지 생성: 최종 확인 시 300개 성공
- npm audit: 취약점 0개
- Next.js 파일 추적 경고: 없음
- 포트폴리오 초기 이미지 태그: 13개
- 포트폴리오 상세 버튼: 12개
- 보안 응답 헤더: 로컬 프로덕션 서버 응답에서 확인
- 방명록 잘못된 Content-Type: 415 확인
- 방명록 잘못된 JSON: 400 확인
- 방명록 과대 요청: 413 확인

자동 브라우저 연결을 사용할 수 없어 상세 모달의 자동 시각 회귀 테스트는 실행하지 못했다. 빌드, TypeScript, ESLint, 서버 렌더링 HTML과 접근성 로직은 검증했다.

## 되돌리기 방법

이미 원격 main에 반영된 커밋이므로 `reset`보다 `revert` 사용을 권장한다.

```bash
git revert <commit-hash>
git push origin main
```

여러 작업을 되돌릴 때는 최신 커밋부터 역순으로 처리하는 편이 안전하다.

예시:

```bash
# 포트폴리오 상세 모달만 제거
git revert d5a73df

# 미사용 이미지 복구
git revert bdfc1ee

# 방명록 API 강화만 되돌리기
git revert a45b7f3
```

## 남은 구조적 과제

### 방명록 저장 위치 분리

방명록은 여전히 `content/guestbook.json`을 main 브랜치에 커밋한다. 따라서 방문객이 나무를 심을 때마다 Vercel 배포가 발생할 수 있다.

DB 없이 유지하려면 다음 중 하나를 선택할 수 있다.

1. 같은 저장소의 `guestbook` 전용 브랜치에 JSON 저장
2. 별도 비공개 또는 공개 데이터 저장소에 JSON 저장
3. GitHub Discussions를 방명록 데이터 소스로 사용

전용 브랜치나 별도 저장소로 분리할 때는 읽기 ref, 쓰기 branch, GitHub token 권한, 백업·복구 방식을 함께 정해야 한다.

### Content Security Policy

현재 기본 보안 헤더는 적용됐지만 CSP는 없다. Google AdSense가 사용하는 script, frame, connect, image 도메인을 확인하고 report-only 정책부터 적용하는 방식이 안전하다.

### 실제 기기 시각 점검

다음 화면은 실제 브라우저와 모바일 기기에서 한 번 더 확인하는 것이 좋다.

- 포트폴리오 상세 모달의 긴 설명과 이미지 갤러리
- 320~390px 폭에서 카드 상태 배지와 날짜 배치
- 라이트박스를 닫은 뒤 상세 모달이 유지되는지
- 키보드 Tab 순환과 ESC 동작
- Google AdSense가 보안 헤더 적용 후 정상 표시되는지

## 현재 상태

- 개선 커밋은 `origin/main`에 반영됐다.
- 마지막 기능 커밋: `d5a73df`
- 포트폴리오 상세 모달까지 배포 대상에 포함됐다.
