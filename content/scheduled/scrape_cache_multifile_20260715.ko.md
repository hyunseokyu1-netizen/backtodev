---
title: '유저가 늘면 API 비용도 늘어야 할까 — 공유 스크래핑 캐시와 Supabase Storage 다중 업로드 작업기'
date: '2026-07-15'
publish_date: '2026-09-01'
description: 여러 유저가 같은 데이터를 요청할 때 Supabase JSONB 캐시로 스크래핑을 공유하고, Storage와 서명 URL로 공고당 최대 5개 서류 업로드를 구현한 실전 기록
tags:
  - Supabase
  - Next.js
  - 캐싱
  - Supabase Storage
  - Server Actions
---

## 유저 100명이 같은 버튼을 누르면, 스크래핑도 100번 해야 할까?

사이드 프로젝트 매치다(MatchDa)에는 "추천 기업 바로 수집" 기능이 있다. Stripe, Anthropic 같은 회사 칩을 클릭하면 그 회사 채용페이지에서 공고를 긁어와 내 이력서와의 매칭 점수를 매겨주는 기능이다.

그런데 이 구조를 가만히 보다가 이상한 점을 발견했다. **유저 A가 Stripe를 수집하고, 10분 뒤 유저 B가 똑같이 Stripe를 클릭하면 — 처음부터 다시 긁는다.** 네트워크 요청, 경우에 따라 헤드리스 브라우저 기동, 일반 페이지면 AI 추출까지. 같은 데이터를 위해 같은 비용을 유저 수만큼 반복 지불하는 구조였던 거다.

유저가 나 혼자일 땐 문제가 아니었다. 하지만 홍보를 앞두고 "유저 10명이 오픈 첫날 다 같이 인기 회사를 클릭하면?"을 상상해보니 아찔했다. 오늘은 이걸 **공유 캐시**로 고친 이야기와, 함께 작업한 **다중 파일 업로드**(Supabase Storage + 서명 URL) 이야기다.

## Step 1. 캐시 설계 — 무엇이 공유 가능하고 무엇이 아닌가

캐시를 붙이기 전에 먼저 답해야 할 질문이 있다. **"이 파이프라인에서 유저별로 다른 데이터는 뭐고, 모두에게 같은 데이터는 뭔가?"**

수집 파이프라인을 분해해보면:

| 단계 | 비용 | 유저별로 다른가? |
|---|---|---|
| ① 채용페이지 스크래핑 (공고 제목·URL 목록) | 네트워크·브라우저·AI 추출 (비쌈) | **아니오** — 누가 긁어도 같은 결과 |
| ② 키워드 프리필터 | 무료 (코드 레벨) | 예 — 내 스킬 기준 |
| ③ AI 매칭 채점 | Haiku 배치 (저렴) | 예 — 내 이력서 기준 점수 |

답이 명확해진다. **①만 공유 캐시에 넣고, ②③은 유저별로 그대로 둔다.** 매칭 점수까지 캐시하고 싶은 유혹이 있지만, "나와 이 공고의 궁합"은 애초에 공유 불가능한 데이터다. 캐시는 만능이 아니라 "같은 입력 → 같은 출력"인 구간에만 정직하게 적용해야 한다.

## Step 2. 구현 — 테이블 하나, 함수 하나

거창한 캐시 인프라(Redis 등)를 붙일 것 없이, 이미 쓰고 있는 Supabase(PostgreSQL)에 테이블 하나면 충분했다.

```sql
CREATE TABLE IF NOT EXISTS discover_scrape_cache (
  source_url   TEXT PRIMARY KEY,                    -- 정규화된 채용페이지 URL
  source_type  TEXT NOT NULL DEFAULT 'generic',
  postings     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 공고 목록 통째로
  scraped_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS를 켜고 정책을 안 만들면 = service role(서버)만 접근 가능
ALTER TABLE discover_scrape_cache ENABLE ROW LEVEL SECURITY;
```

포인트 세 가지:

**1) JSONB 한 방 저장.** 공고를 행 단위로 정규화해 저장할 수도 있지만, 이 캐시의 용도는 "최근 수집 결과 재사용"뿐이다. URL당 한 행, `postings` 컬럼에 배열 통째로. 코드가 극적으로 단순해진다.

**2) RLS 켜고 정책 없음 = 서버 전용 테이블.** Supabase에서 RLS만 켜고 정책을 하나도 안 만들면 anon/authenticated 키로는 아무것도 못 한다. 서버 액션의 service role 클라이언트만 접근하는 내부 테이블을 만드는 가장 짧은 방법이다.

**3) URL 정규화.** 같은 페이지가 `https://jobs.lever.co/spotify`와 `https://jobs.lever.co/spotify/`로 따로 캐시되면 반쪽짜리다. 호스트 소문자화 + 끝 슬래시 제거 정도의 정규화를 키에 적용했다.

읽기/쓰기 로직은 함수 하나로 감쌌다:

```ts
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 채용공고는 하루 몇 번 안 바뀐다

export async function getPostingsWithCache(sourceUrl: string, sourceType: AtsType) {
  const key = normalizeSourceUrl(sourceUrl)

  // 1) 신선한 캐시가 있으면 그대로 (스크래핑 생략)
  try {
    const { data: hit } = await supabaseAdmin
      .from('discover_scrape_cache')
      .select('postings, scraped_at')
      .eq('source_url', key)
      .maybeSingle()
    if (hit && Date.now() - new Date(hit.scraped_at).getTime() < CACHE_TTL_MS) {
      return { postings: hit.postings, fromCache: true }
    }
  } catch (e) {
    console.error('캐시 읽기 실패 (직접 스크래핑으로 폴백):', e)
  }

  // 2) 미스/만료 → 실제 스크래핑
  const postings = await scrapeJobSource(sourceUrl, sourceType)

  // 3) 캐시 갱신 (베스트 에포트 — 실패해도 결과는 반환)
  try {
    await supabaseAdmin.from('discover_scrape_cache')
      .upsert({ source_url: key, source_type: sourceType, postings, scraped_at: new Date().toISOString() })
  } catch (e) {
    console.error('캐시 쓰기 실패 (무시):', e)
  }

  return { postings, fromCache: false }
}
```

여기서 제일 중요한 설계 결정은 **캐시 계층의 모든 실패를 try/catch로 삼키는 것**이다. 캐시는 최적화지 기능이 아니다. 테이블이 아직 없어도(마이그레이션 전 배포), DB가 순간적으로 흔들려도, 유저는 그냥 "캐시 없던 시절"의 동작을 겪을 뿐 기능이 죽으면 안 된다. 실제로 이번에 코드 배포와 DB 마이그레이션 적용 시점이 하루 이상 어긋났는데, 이 폴백 덕에 아무 문제가 없었다.

UI에는 `fromCache`를 받아서 "✓ 137건 발견 · 137건 추가 · **빠른 수집**"이라고 표시했다. 유저 입장에선 두 번째 사람부터 수집이 몇 초 만에 끝나는 걸 체감하게 된다.

## Step 3. 프리셋 확장 — 추측하지 말고 curl로 검증하기

캐시가 생기니 프리셋 기업을 늘릴 명분도 생겼다(어차피 첫 1명만 비용을 낸다). 14개 → 36개로 늘리면서 지킨 원칙 하나: **공개 ATS API로 실제 응답을 확인한 슬러그만 넣는다.**

Greenhouse, Lever, Ashby는 모두 공개 JSON API가 있어서 curl로 바로 검증된다:

```bash
# greenhouse: 회사 슬러그가 유효하면 공고 배열이 온다
curl -s "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=false"

# lever
curl -s "https://api.lever.co/v0/postings/spotify?mode=json"

# ashby
curl -s "https://api.ashbyhq.com/posting-api/job-board/openai"
```

실제로 돌려보니 재밌는 결과가 나왔다. "Canva는 당연히 Lever 쓰겠지"라고 넣으려던 슬러그들이 줄줄이 실패했다:

- `lever/canva` → 없음. greenhouse도 없음. 자체 채용 사이트라 프리셋에서 제외
- `xero` → lever엔 없지만 **ashby에 73건** 존재
- `airwallex` → ashby에 595건

훈련된 직감("이 회사는 이 ATS를 쓸 것")은 자주 틀린다. 30초짜리 curl 검증이 "클릭했는데 공고 0건"이라는 최악의 첫인상을 막아준다.

## Step 4. 다중 파일 업로드 — Storage + JSONB 메타데이터

두 번째 작업. 기존에는 공고마다 "제출한 이력서" 파일 1개만 기록할 수 있었는데, 실제 지원에는 포트폴리오·경력기술서 등 여러 파일이 필요하다. **공고당 최대 5개**로 확장했다.

설계는 "파일 원본과 메타데이터의 분리":

- **원본**: Supabase Storage 비공개 버킷 `application-docs`, 경로는 `{유저ID}/{공고ID}/{타임스탬프}.{확장자}`
- **메타데이터**: 기존 `matches` 테이블에 JSONB 컬럼 하나 추가

```sql
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS applied_documents JSONB NOT NULL DEFAULT '[]'::jsonb;
-- [{ "name": "포트폴리오.pdf", "path": "...", "size": 1048576, "uploadedAt": "..." }]
```

파일 목록 전용 테이블을 만들 수도 있지만, "공고당 최대 5개"짜리 목록에 조인 테이블은 과하다. JSONB 배열이면 조회도 한 번, 코드도 짧다.

### 소유권 검증 — 서명 URL을 아무에게나 주면 안 된다

비공개 버킷의 파일은 서명 URL(signed URL)로만 다운로드할 수 있는데, 서버 액션이 경로만 받고 URL을 발급해주면 **남의 파일 경로를 추측해서 요청하는 공격**에 뚫린다. 그래서 모든 액션에 같은 검증을 깔았다:

```ts
export async function getApplicationDocumentUrl(jobId: string, path: string) {
  // 1) 로그인 유저 확인 → 2) 본인 match 행의 서류 목록 조회
  const docs = await getOwnedMatchDocs(profile.id, jobId)

  // 3) 요청한 path가 "본인 목록"에 있을 때만 발급
  if (docs === null || !docs.some(d => d.path === path)) {
    return { error: '해당 서류를 찾을 수 없습니다.' }
  }
  const { data } = await supabaseAdmin.storage
    .from('application-docs').createSignedUrl(path, 60) // 60초 유효
  return { url: data.signedUrl }
}
```

경로 문자열을 파싱해서 `{유저ID}`가 맞는지 비교하는 방식도 있지만, "DB에 기록된 본인 목록에 있는 경로인가"를 확인하는 쪽이 path traversal(`../`) 같은 꼼수까지 원천 차단한다. 삭제도 동일한 검증을 거친다. 그리고 업로드 후 DB 반영이 실패하면 방금 올린 파일을 지워서 **고아 파일**이 남지 않게 했다.

### 버킷 자동 생성 트릭

버킷을 대시보드에서 미리 만들어두는 대신, 첫 업로드에서 `Bucket not found` 에러가 나면 만들고 재시도하는 패턴을 썼다:

```ts
let { error } = await doUpload()
if (error?.message?.includes('Bucket not found')) {
  await supabaseAdmin.storage.createBucket('application-docs', { public: false })
  ;({ error } = await doUpload())
}
```

환경(로컬/프로덕션)마다 버킷 만들었는지 기억할 필요가 없어진다.

## 트러블슈팅: 'use server' 파일은 async 함수만 export할 수 있다

모달 UI에서 "최대 5개" 제한을 표시하려고 서버 액션 파일에서 상수를 export했더니:

```ts
// src/app/actions.ts ('use server')
export const MAX_APPLIED_DOCUMENTS = 5  // ❌ 빌드 에러!
```

Next.js의 `'use server'` 파일은 **async 함수만 export할 수 있다.** export된 것들이 전부 클라이언트에서 호출 가능한 RPC 엔드포인트로 변환되기 때문에, 상수나 동기 함수가 끼어들 자리가 없는 것이다. (참고로 `export interface` 같은 타입은 컴파일 때 지워지므로 괜찮다.)

해결은 공용 모듈로 분리:

```ts
// src/lib/applied-documents.ts (일반 모듈)
export interface AppliedDocument { name: string; path: string; size: number; uploadedAt: string }
export const MAX_APPLIED_DOCUMENTS = 5
```

서버 액션과 클라이언트 컴포넌트가 둘 다 여기서 import한다. 서버 액션을 쓰다 보면 반드시 한 번은 만나는 제약이니 기억해두자.

## 덤: 자잘하지만 체감 큰 UX 세 가지

- **칸반 최신순 정렬**: 보드 카드가 점수순이었는데, 방금 추가한 공고가 중간에 파묻혀서 "추가가 안 됐나?" 싶은 순간이 생긴다. `created_at` 내림차순으로 변경 — 방금 넣은 게 맨 위에.
- **뒤로가기 동선 일치**: 워크스페이스의 "← 대시보드" 버튼. 그런데 유저는 지원 현황 보드에서 카드를 눌러 들어온다. 온 길로 돌려보내는 게 맞다 — "← 지원 현황"으로 수정. 뒤로가기는 "홈으로"가 아니라 "왔던 곳으로".
- **드롭다운 서브뷰 패턴**: `⋯` 메뉴에 "지원 상태 변경"을 추가하면서, 중첩 드롭다운 대신 메뉴 내용이 상태 목록으로 전환되고 "← 뒤로"로 돌아오는 방식을 썼다. 모바일에서 중첩 메뉴는 재앙인데, 뷰 전환은 상태 하나(`menuView: 'main' | 'status'`)로 끝난다.

## 정리

| 작업 | 핵심 결정 |
|---|---|
| 공유 스크래핑 캐시 | 유저별 데이터(점수)와 공유 데이터(공고 원본)를 구분해 후자만 캐시 |
| 캐시 안정성 | 모든 캐시 실패는 폴백 — 캐시는 최적화지 기능이 아니다 |
| 프리셋 확장 | 직감 대신 공개 API를 curl로 검증한 슬러그만 등록 |
| 다중 업로드 | 원본은 Storage, 메타데이터는 JSONB — 5개짜리 목록에 조인 테이블은 과함 |
| 다운로드 보안 | 서명 URL은 "본인 소유 목록에 있는 경로"에만 발급 |
| 'use server' 제약 | 상수·타입은 일반 모듈로 분리해 양쪽에서 import |

유저가 늘어도 비용이 그만큼 늘지 않는 구조를 만드는 것 — 사이드 프로젝트가 "혼자 쓰는 도구"에서 "서비스"로 넘어가는 길목에서 한 번은 해야 하는 숙제였다.
