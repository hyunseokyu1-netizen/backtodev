---
title: 'AI 디자인 핸드오프를 코드로 옮기며 배운 것들 — 모노크롬 디자인 시스템, Tailwind 토큰 함정, 트렌딩 알고리즘'
date: '2026-07-12'
publish_date: '2026-08-14'
description: HTML 디자인 핸드오프 재구현부터 Tailwind 4 @theme inline 함정, 중복 CTA 정리, Wikimedia 이미지 시드까지 — 사이드 프로젝트 리뉴얼 하루의 기록
tags:
  - Tailwind CSS
  - Next.js
  - 디자인 시스템
  - Supabase
  - Claude Code
---

사이드 프로젝트로 만들고 있는 익명 커뮤니티 "노가리"에 드디어 제대로 된 디자인을 입혔습니다. 오늘 하루 동안 디자인 핸드오프 번들을 받아서 사이트 전체를 리뉴얼했는데, 그 과정에서 겪은 삽질과 배운 것들을 정리해 봅니다.

## 디자인 핸드오프라는 물건

지금까지 노가리는 shadcn 기본 스타일 그대로였습니다. 기능은 다 돌아가는데 어딘가 "개발자가 만든 티"가 나는 상태였죠. 이번에 받은 건 HTML로 만들어진 디자인 레퍼런스 번들이었습니다. 구성이 흥미로웠어요:

- `README.md` — 디자인 토큰(색상 5개, 타이포, 테두리, 그림자)을 스펙으로 정리
- `*.dc.html` — 브라우저에서 열어볼 수 있는 실제 디자인 (메인/상세/스타일 가이드)
- `nogari-icon.svg` — 로고 원본 SVG
- `screenshots/` — 완성 화면 캡처

핵심은 README에 있는 이 문장이었습니다. **"프로덕션 코드가 아니며 그대로 복사해 쓰는 용도가 아닙니다. 기존 코드베이스의 패턴과 라이브러리로 재구현하세요."** 즉 HTML을 복붙하는 게 아니라, 디자인 토큰과 규칙을 읽고 기존 컴포넌트 구조에 스타일만 갈아입히는 작업입니다.

디자인 컨셉은 꽤 과감했습니다:

| 규칙 | 내용 |
|---|---|
| 색상 | ink(#1A1A1A), paper(#F4F3F1), card(#FFF), muted, line — **딱 5개만** |
| 금지 | 그라디언트, 이모지 전부 금지 |
| 테두리 | 모든 카드·버튼에 2px 검정 실선 |
| 그림자 | `4px 4px 0` hard shadow만, hover 시 `translate(-2px,-2px)` |
| 폰트 | IBM Plex Sans KR 400/500/600/700 |

## Step 1 — 디자인 토큰부터: Tailwind 4의 `@theme inline` 함정

가장 먼저 한 일은 `globals.css`에 토큰을 정의하는 것이었습니다. 프로젝트가 Tailwind CSS 4라서 설정 파일 없이 CSS의 `@theme` 블록에 토큰을 선언하면 유틸리티 클래스가 자동 생성됩니다.

그런데 여기서 오늘의 가장 큰 삽질이 나왔습니다. 기존 파일에 shadcn이 만들어둔 `@theme inline { ... }` 블록이 있길래, 거기에 그냥 토큰을 추가했습니다:

```css
/* ❌ 이렇게 하면 안 됩니다 */
@theme inline {
  --color-ink: #1a1a1a;      /* 리터럴 값 토큰 */
  --color-paper: #f4f3f1;

  --color-background: var(--background);  /* 기존 shadcn 매핑 */
  /* ... */
}
```

타입 체크 통과, 린트 통과, 빌드 통과. 그런데 브라우저를 열어보니 `bg-ink`, `border-ink` 클래스가 **전부 무시**되고 페이지가 밋밋한 회색으로 나왔습니다. 에러가 한 줄도 없어서 원인을 찾는 데 시간이 꽤 걸렸어요. 생성된 CSS를 직접 grep해보고 나서야 `.bg-ink` 유틸리티 자체가 만들어지지 않았다는 걸 확인했습니다.

원인은 `inline` 키워드였습니다. `@theme inline`은 **`var()` 참조를 인라인으로 풀어주는 용도**의 블록이라, 리터럴 값으로 선언한 커스텀 토큰이 조용히 무시됩니다. 해결은 간단합니다 — 리터럴 토큰은 별도의 일반 `@theme` 블록으로 분리:

```css
/* ✅ 리터럴 토큰은 일반 @theme 블록에 */
@theme {
  --color-ink: #1a1a1a;
  --color-paper: #f4f3f1;
  --color-line2: #c9c6c0;
  --shadow-hard: 4px 4px 0 rgba(26, 26, 26, 0.15);
}

/* var() 매핑은 기존대로 @theme inline에 */
@theme inline {
  --color-background: var(--background);
  /* ... */
}
```

이렇게 나누고 dev 서버를 재시작하니 `bg-ink`, `shadow-hard` 같은 유틸리티가 정상 생성됐습니다. **조용히 실패하는 버그**라서, 새 토큰을 추가하면 생성된 CSS에서 해당 클래스가 실제로 있는지 한 번 확인해보는 습관이 필요하겠더라고요:

```bash
curl -s "http://localhost:3000/_next/static/chunks/____.css" | grep -c '\.bg-ink'
```

## Step 2 — 폰트와 아이콘

폰트는 `next/font`로 교체했습니다. Google Fonts를 빌드 타임에 셀프 호스팅해주기 때문에 런타임에 구글 서버로 요청이 나가지 않습니다:

```tsx
import { IBM_Plex_Sans_KR } from "next/font/google";

const ibmPlexSansKR = IBM_Plex_Sans_KR({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});
```

로고는 핸드오프에 SVG 패스가 그대로 들어 있어서, `currentColor` 기반의 React 컴포넌트 하나로 감쌌습니다. 재미있는 디테일: 디자인 스펙에 **stroke-width를 렌더 크기에 반비례**시키라고 되어 있었습니다. 큰 히어로 아이콘은 얇게(10), 작은 파비콘은 두껍게(18~20). SVG는 viewBox 기준으로 stroke가 같이 스케일되기 때문에, 작게 그릴수록 선이 가늘어져 뭉개지는 걸 보정하는 규칙입니다. 이런 걸 스펙에 명시해주는 핸드오프는 처음 봤는데 확실히 결과물 품질이 달랐습니다.

## Step 3 — 브랜치로 디자인 A/B 비교하기

전체 리뉴얼을 적용하고 보니 댓글 영역이 애매했습니다. 새 디자인은 댓글마다 2px 테두리 카드 + "공감/비공감" pill 버튼인데, 댓글이 몇 개만 쌓여도 화면이 테두리로 가득 차서 무겁게 느껴졌어요.

이럴 때 유용한 패턴이 **비교용 브랜치**입니다. main은 새 디자인을 유지한 채, 브랜치에서 댓글 영역만 이전 디자인(얇은 구분선 리스트 + 👍/👎 엄지 버튼)으로 되돌려서 나란히 비교했습니다:

```bash
git checkout -b design/comment-old-style
# 댓글 컴포넌트만 이전 스타일로 복원
git push -u origin design/comment-old-style
```

Vercel을 쓰면 브랜치 푸시만으로 프리뷰 URL이 생겨서, 두 디자인을 실제 배포 환경에서 번갈아 보고 결정할 수 있습니다. 결론은 "댓글은 이전 디자인이 낫다"였고, 브랜치를 main에 머지했습니다. 전체 리뉴얼을 갈아엎는 게 아니라 **부분만 선택적으로 되돌리는** 결정을 부담 없이 할 수 있었던 건 순전히 브랜치 덕분입니다.

한 가지 타협도 있었습니다. 디자인 규칙상 이모지가 금지인데, 트렌딩 랭킹의 🔥 점수 표시는 이전 버전의 직관성이 그리웠어요. 절충안으로 lucide의 `Flame` 아이콘에 빨강·주황을 입혀서 "모노크롬 페이지의 유일한 포인트 컬러"로 남겼습니다. 규칙은 지키되 예외는 의도적으로 하나만.

## Step 4 — 트렌딩 랭킹: Hacker News 공식과 집계 창의 현실

노가리의 "핫한 노가리방" 랭킹은 Postgres 뷰 하나로 계산합니다. Hacker News 랭킹 공식을 단순화한 형태입니다:

```sql
create or replace view v_trending_topics as
select
  t.id,
  t.title,
  coalesce(r.cnt, 0) as recent_comment_count,
  coalesce(r.cnt, 0)
    / power(extract(epoch from (now() - t.activated_at)) / 3600.0 + 2, 1.5)
    as trending_score
from topics t
left join lateral (
  select count(*) as cnt
  from comments c
  where c.topic_id = t.id
    and c.created_at > now() - interval '30 days'
    and c.deleted_at is null
) r on true
where t.status = 'ACTIVE';
```

공식을 풀면 `점수 = 최근 댓글 수 / (방 나이(시간) + 2)^1.5` 입니다.

- **분모의 `+2`**: 갓 개설된 방은 나이가 0에 가까워서, 보정 없이는 댓글 하나로 점수가 폭발합니다
- **지수 `1.5`**: 시간이 지날수록 점수가 가파르게 감쇠해서, 오래된 방은 활동량이 많아야만 상위에 남습니다
- **동점 처리**: 점수가 같으면 `last_comment_at` 내림차순 — 마지막 대화가 최근인 방이 위로

원래 집계 창은 "최근 1시간"이었습니다. 실시간 트렌드라는 취지에는 맞는데, **초기 서비스에는 치명적인 문제**가 있었어요. 사용자가 적으니 최근 1시간 댓글이 있는 방이 거의 없고, 랭킹 점수가 전부 0이 되어 순위가 무의미해집니다. 그래서 집계 창을 30일로 완화했습니다. 사용자가 늘면 다시 줄일 계획인데, 뷰 정의만 바꾸면 되니 마이그레이션 파일 하나로 끝납니다.

알고리즘을 설계할 때 "이론적으로 맞는 공식"과 "지금 데이터 규모에서 동작하는 공식"이 다를 수 있다는 걸 체감한 순간이었습니다.

트렌딩 뷰는 이후에도 두 번 더 진화했습니다. 유형 필터(인물/물건/브랜드/사건)를 붙이려고 `topic_type`을, 랭킹에 사진을 보여주려고 `image_url`을 추가했는데, PostgreSQL의 `CREATE OR REPLACE VIEW`는 **컬럼을 끝에만 추가할 수 있다**는 제약이 있어서 마이그레이션마다 뷰 전체를 다시 선언하되 새 컬럼을 항상 마지막에 붙이는 식으로 진행했습니다. 이미지는 `coalesce(t.image_url, p.photo_url)`로 유저 업로드 이미지가 우선, 없으면 정치인 프로필 사진 폴백이라는 우선순위를 뷰 안에서 처리했습니다.

## Step 5 — CTA 다이어트: 버튼은 눈에 보이는 대안이 없을 때만

리뉴얼 직후의 화면에는 버튼이 많았습니다. 헤더에 "익명으로 시작", 히어로에 "노가리방 둘러보기"와 "방 개설 신청", 방 상세 타이틀 바에 "노가리 까기". 그런데 하나씩 따져보니 대부분 **바로 옆에 같은 기능이 이미 보이는** 중복 CTA였어요.

- "노가리방 둘러보기" → 누르면 바로 아래 목록으로 스크롤. 근데 목록이 이미 화면에 보임 → **제거**
- "익명으로 시작" → 로그인이 없는 사이트라 갈 곳이 애매한 버튼 → **제거**
- "노가리 까기" → 댓글 입력창으로 가는 앵커인데, 입력창이 sticky로 항상 하단에 떠 있음 → **제거**

결국 살아남은 건 "방 개설 신청" 하나입니다. 모달을 여는, 다른 방법으로는 대체가 안 되는 버튼이죠. 히어로도 이 참에 확 줄였습니다 — 큰 타일 박스 대신 물고기 아이콘을 opacity 7% 워터마크로 배경에 깔고, 세로 높이를 절반으로 줄여서 첫 화면에서 랭킹 목록이 5위까지 보이게 했습니다. **버튼이 하는 일이 '스크롤'이라면, 그 버튼은 레이아웃이 대신할 수 있다**는 게 오늘의 결론입니다.

## Step 6 — 샘플 데이터 시드: Wikimedia 이미지와 두 개의 함정

디자인이 자리 잡으니 이번엔 콘텐츠가 문제였습니다. 물건/브랜드/사건 방이 제목만 덩그러니 있어서, Wikimedia Commons에서 라이선스 걱정 없는 이미지를 받아 대표 사진을 달고 테스트 댓글을 시드하는 스크립트를 만들었습니다:

```ts
// Wikimedia Commons 파일명 → 640px 썸네일 리다이렉트 URL
function commonsThumb(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=640`;
}
```

여기서 함정 두 개를 밟았습니다.

1. **Wikimedia는 User-Agent 없는 요청을 429로 차단**합니다. `fetch`에 UA 헤더를 명시하고 요청 사이에 1초 딜레이를 넣으니 해결됐습니다. 공용 API를 스크립트로 긁을 때의 기본 예의이기도 하고요.
2. **Supabase Storage는 한글 파일 키를 거부**합니다 (`Invalid key: topics/seed-쿠팡.png`). 방 제목을 그대로 키로 쓰지 말고 ASCII 슬러그(`coupang`, `stanley-tumbler`)를 별도로 두는 걸로 우회했습니다.

댓글 공감 수를 넣을 때는 `like_count`를 직접 UPDATE하지 않고 `comment_reactions` 테이블에 행을 넣어 **DB 트리거가 카운터를 올리게** 했습니다. 시드 데이터라도 실제 유저와 같은 경로로 넣어야 정합성이 깨지지 않으니까요. 스크립트는 이미지·댓글 모두 중복 체크를 넣어 재실행해도 안전하게 만들었습니다.

## 트러블슈팅 요약

| 증상 | 원인 | 해결 |
|---|---|---|
| 커스텀 색 유틸리티가 조용히 미생성 | 리터럴 토큰을 `@theme inline`에 선언 | 별도 `@theme` 블록으로 분리 |
| globals.css 수정이 반영 안 됨 | Turbopack HMR이 테마 변경을 놓침 | dev 서버 재시작 |
| 활성 탭 hover 시 글씨가 사라짐 | 기본 컴포넌트의 `hover:text-foreground`가 커스텀 `text-paper`를 덮어씀 | `data-active:hover:text-paper`로 명시 |
| 트렌딩 점수가 전부 0 | 집계 창(1시간)이 서비스 규모 대비 너무 짧음 | 창을 30일로 완화, 성장 시 재조정 |
| Wikimedia 이미지 다운로드 429 | User-Agent 없는 요청 차단 정책 | UA 헤더 명시 + 요청 간 1초 딜레이 |
| Storage 업로드 `Invalid key` | 파일 키에 한글 사용 불가 | 방 제목 대신 ASCII 슬러그를 키로 사용 |

## 정리

하루 동안의 흐름을 한눈에:

1. 디자인 핸드오프의 README에서 토큰·규칙을 읽고 `@theme` 블록으로 이식
2. `@theme inline` 함정에 빠졌다가 생성 CSS를 grep해서 탈출
3. `next/font`로 폰트 셀프 호스팅, SVG 로고를 `currentColor` 컴포넌트화
4. 전체 리뉴얼 적용 후, 애매한 댓글 영역만 비교 브랜치로 A/B 해서 이전 디자인 복원
5. 트렌딩 집계 창을 데이터 규모에 맞게 1시간 → 30일로 조정, 유형 필터·대표 이미지까지 뷰로 확장
6. 중복 CTA 3개(둘러보기/익명으로 시작/노가리 까기)를 걷어내고 히어로를 워터마크 스타일로 슬림화
7. Wikimedia Commons 이미지 + 테스트 댓글 시드 스크립트로 빈 화면 채우기

디자인 시스템을 "색상 5개, 테두리 2px, 그림자는 hard shadow만"처럼 강한 제약으로 정의하면, 구현하는 입장에서 오히려 결정할 게 줄어들어 속도가 납니다. 확신이 없는 디자인 결정은 머리로 고민하지 말고 브랜치 + 프리뷰 배포로 눈으로 비교하는 게 훨씬 빠르다는 것, 그리고 버튼 하나도 "이게 없으면 사용자가 못 하는 일이 있나?"를 물어보면 의외로 대부분 지워도 된다는 것도요.
