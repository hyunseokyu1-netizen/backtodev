---
title: '노가리 개발기 — 익명 커뮤니티 플랫폼을 하루 만에 기획부터 배포까지'
date: '2026-07-12'
publish_date: '2026-08-13'
description: Next.js 16 + Supabase + Claude API로 집단지성 기반 익명 커뮤니티 '노가리'를 만들면서 겪은 설계 결정과 시행착오 정리
tags:
  - Next.js
  - Supabase
  - Claude API
  - PWA
  - Vercel
---

## "노가리 깐다"를 서비스로 만들면 어떨까

한국말에 "노가리 깐다"라는 표현이 있다. 편하게 수다 떨고, 뒷담화하는 것. 이 정서를 그대로 서비스로 옮겨보면 어떨까 하는 생각에서 시작한 프로젝트가 **노가리**다.

처음 아이디어는 단순했다. 정치인 목록을 보여주고 사람들이 익명으로 댓글을 남기는 것. 그런데 그러면 너무 한정적이다. 그래서 방향을 틀었다 — **누구나 사람이든 물건이든 사건이든 주제를 제안하고, 일정 수 이상이 동의하면 게시판(노가리방)이 열리는** 구조로. 운영자가 게시판을 만드는 게 아니라 사용자들의 집단 동의로 만들어지는, 일종의 DAO 방식이다.

핵심 흐름을 정리하면 이렇다:

```
[주제 제안] → [AI 유사 주제 검토 (중복 방지)]
    → [72시간 내 30명 동의] → [정식 노가리방 개설]
    → [익명 댓글로 자유로운 소통]
```

여기에 몇 가지 양념을 얹었다:

- **대나무숲 모드**: 개설 후 24시간 동안만 불타오르다 폭파되는 휘발성 방
- **트렌딩 랭킹**: 지금 가장 핫한 방을 실시간으로 보여주기
- **완전 익명 + 최소한의 안전장치**: 겉으로는 완벽한 익명이지만, 신고가 들어오면 악성 유저를 제재할 수 있는 구조

이 글은 이 서비스를 기획서 한 장에서 시작해 실제 배포(https://nogari.vercel.app)까지 만든 과정의 기록이다.

## 기술 스택 — 뭘로 만들까

MVP를 빠르게 만드는 게 목표라서 스택은 과감하게 골랐다.

| 영역 | 선택 | 이유 |
|---|---|---|
| 프론트+백엔드 | Next.js 16 (App Router) | API Route까지 한 프로젝트에서 해결 |
| UI | Tailwind CSS v4 + shadcn/ui | 반응형 모바일 대응 필수라 유틸리티 CSS |
| DB/인증/실시간 | Supabase | Postgres + 익명 인증 + Realtime을 한 번에 |
| AI | Claude API (Anthropic) | 유사 주제 판단 + 댓글 필터링 |
| PWA | Serwist | Turbopack 호환되는 서비스워커 (뒤에서 자세히) |
| 배포 | Vercel + GitHub 연동 | push하면 자동 배포 |

### 임베딩 없이 중복 검토하기

원래 기획서에는 "제목을 임베딩 벡터로 변환해서 pgvector로 코사인 유사도 0.85 이상이면 중복" 같은 내용이 있었다. 그런데 여기서 첫 번째 현실적인 문제를 만났다. **Anthropic은 임베딩 API를 제공하지 않는다.** 임베딩을 쓰려면 OpenAI나 Voyage AI 키를 하나 더 발급받아야 했다.

그래서 접근을 바꿨다. 임베딩+벡터DB 대신, **기존 주제 목록을 통째로 Claude에게 주고 "이거 중복이야?"라고 직접 물어보는 방식**이다.

```typescript
// 신규 제목 + 기존 주제 목록(JSON)을 Claude에게 전달
const response = await anthropic.messages.create({
  model: "claude-opus-4-8",
  system: "단순 표기 차이(띄어쓰기, 영문/한글, 약칭)뿐 아니라 " +
          "같은 인물/사물/사건을 가리키는 경우도 중복으로 간주해라.",
  messages: [{ role: "user", content: `신규: ${title}\n기존: ${JSON.stringify(topics)}` }],
  output_config: {
    format: { type: "json_schema", schema: /* is_duplicate, similar_topics */ },
  },
});
```

실제로 테스트해보니 `__TEST_아이폰17__`을 등록한 뒤 "아이폰 17"을 제안하면 *"동일한 제품을 가리키며 띄어쓰기 차이만 있을 뿐 사실상 같은 대상"*이라는 이유까지 달아서 정확히 막아냈다. 주제가 수천 개로 늘면 컨텍스트에 다 못 넣으니 그때 임베딩으로 갈아타면 되고, MVP에서는 이게 훨씬 단순하다. API 키도 하나로 끝난다.

## DB 설계 — 익명 커뮤니티의 딜레마

익명 커뮤니티 DB 설계에서 제일 고민한 지점은 이거다. **"유저에게는 완벽한 익명으로 보이되, 신고가 들어오면 악성 유저를 밴할 수 있어야 한다."**

### device_hash: 추적 가능하지만 식별 불가능한 값

가입 없이 쓰는 서비스라 Supabase의 **익명 인증(Anonymous Sign-in)**을 썼다. 첫 방문 시 미들웨어(Next.js 16에서는 `proxy.ts`)가 자동으로 익명 세션을 발급한다. 그리고 이 세션의 `user.id`를 그대로 DB에 저장하지 않고, 서버 전용 비밀값(pepper)으로 HMAC 해싱한 `device_hash`를 저장한다.

```typescript
export function deriveDeviceHash(userId: string): string {
  return createHmac("sha256", process.env.DEVICE_HASH_PEPPER!)
    .update(userId)
    .digest("hex");
}
```

이 값으로 "주제당 동의 1회", "분당 댓글 5회 제한", "신고 누적 시 제재"를 전부 처리할 수 있으면서, 해시라서 역으로 누군지 알아낼 수는 없다.

### Realtime 때문에 테이블을 쪼갠 이유

Supabase Realtime의 `postgres_changes`는 **컬럼 단위가 아니라 행 전체를 브로드캐스트**한다. 즉 comments 테이블에 device_hash 컬럼을 넣고 실시간 구독을 켜면, 모든 접속자에게 작성자의 device_hash가 그대로 뿌려진다. 익명성이 깨진다.

그래서 민감한 값은 물리적으로 다른 테이블로 분리했다:

| 공개 테이블 (Realtime 구독 OK) | 비공개 테이블 (service-role 전용) |
|---|---|
| `topics` (제목, 상태, 동의수) | `topic_meta` (제안자 device_hash) |
| `comments` (닉네임, 내용, 좋아요수) | `comment_authors` (작성자 device_hash) |
| `categories` | `topic_votes`, `reports`, `rate_limit_events` |

비공개 테이블은 RLS(Row Level Security)를 켜되 **정책을 아예 만들지 않는 방식**으로 잠갔다. 정책이 없으면 anon 키로는 아무것도 못 읽고, RLS를 우회하는 service-role 키(서버 전용)로만 접근된다.

### 쓰기는 전부 서버를 거친다

클라이언트가 Supabase에 직접 INSERT하는 걸 허용하지 않았다. 모든 쓰기(제안/투표/댓글/신고)는 Next.js Route Handler를 거쳐 service-role로 실행된다. 덕분에 rate limit, AI 필터링, 유효성 검증을 한 곳에서 강제할 수 있다. 클라이언트가 "유사도 검토 통과했어요"라고 주장해도 서버는 믿지 않고 다시 검증한다.

### 동의 → 자동 승격은 DB 트리거로

"30명째 동의가 들어오는 순간 PENDING → ACTIVE로 전환"을 애플리케이션 코드로 하면 동시 투표 시 경쟁 상태(race condition)가 생긴다. 그래서 Postgres 트리거로 내렸다:

```sql
create or replace function fn_after_vote_insert() returns trigger as $$
begin
  update topics set votes_count = votes_count + 1 where id = new.topic_id;
  update topics
    set status = 'ACTIVE', activated_at = now(),
        -- 대나무숲이면 승격 순간부터 24시간 시한부
        expires_at = case when room_mode = 'BAMBOO_24H'
                          then now() + interval '24 hours' else null end
    where id = new.topic_id and status = 'PENDING'
      and votes_count >= required_votes;
  return new;
end; $$ language plpgsql security definer;
```

같은 트랜잭션 안에서 row lock이 걸리니 딱 임계치를 넘는 순간 한 번만 전환된다. "제안 시 새 카테고리 이름을 함께 적으면 승격 순간 카테고리도 자동 생성"되는 것도 같은 방식의 트리거다. 별도 카테고리 투표 시스템을 만드는 대신, **주제에 대한 30명의 동의가 곧 카테고리에 대한 동의**라고 본 것이다.

### 만료/폭파 배치는 pg_cron으로

72시간 내 동의 미달 제안 만료, 대나무숲 24시간 폭파, 48시간 무댓글 방 아카이브 — 이런 배치 작업은 외부 워커 없이 Supabase에 내장된 `pg_cron`으로 DB 안에서 돌린다.

```sql
select cron.schedule('explode-bamboo-rooms', '0 * * * *', $$
  update topics set status = 'EXPIRED'
  where room_mode = 'BAMBOO_24H' and status = 'ACTIVE' and expires_at < now();
$$);
```

## 구현한 기능들

### 익명 닉네임 — 방마다 다른 얼굴

댓글을 쓰면 "격분한 국회의원", "수줍은 편의점알바" 같은 닉네임이 붙는다. 포인트는 **(방 ID + device_hash)를 시드로 한 결정론적 생성**이라는 것. 같은 방 안에서는 항상 같은 닉네임이라 대화가 이어지고, 다른 방에서는 완전히 달라져서 방을 넘나드는 추적이 불가능하다.

```typescript
export function deriveAnonNickname(topicId: string, deviceHash: string) {
  const digest = createHash("sha1").update(`${topicId}:${deviceHash}`).digest();
  return `${ADJECTIVES[digest[0] % ADJECTIVES.length]} ${NOUNS[digest[1] % NOUNS.length]}`;
}
```

### 2단계 댓글 필터링

1차는 정규식이다. 주민등록번호, 전화번호, 이메일 패턴이 보이면 LLM 호출도 없이 즉시 차단하고 DB에 저장조차 하지 않는다. 1차를 통과한 것만 Claude에게 넘겨 "심각한 패드립/살해협박/명백한 허위사실인지, 아니면 일반적인 비판·풍자·해학 수준인지"를 판단시킨다. 익명 커뮤니티 특유의 거친 표현 자체는 차단 사유가 아니라고 명시한 게 포인트다. 노가리 서비스에서 뒷담화를 다 막으면 안 되니까.

### 실시간 — Realtime과 Presence

- 댓글: SSR로 초기 목록을 그리고, `postgres_changes`의 INSERT/UPDATE 이벤트를 구독해 새 댓글과 좋아요 수를 실시간 반영
- 투표 게이지: 제안 카드의 동의 게이지가 다른 사람 투표에 따라 실시간으로 차오름
- 동시 접속자: Supabase Presence로 "지금 N명 노가리 까는 중" 표시 — 서버에 저장되지 않는 휘발성 상태라 익명성에도 영향이 없다

### 트렌딩 랭킹과 "안철수가 사라진" 버그

트렌딩 점수는 기획서 공식 그대로 SQL 뷰로 구현했다:

```
Score = (최근 1시간 내 댓글 수) / (개설 후 경과시간 + 2)^1.5
```

그런데 실사용에서 재밌는 버그가 나왔다. 안철수 방에 댓글을 달았는데 1시간이 지나자 **트렌딩 목록에서 방이 통째로 사라진 것**. 원인은 최근 1시간 창이 비면 점수가 0이 되는데, 0점짜리 방이 300개(시드한 국회의원 전원)라 정렬이 임의가 되면서 상위 20위 밖으로 밀려난 것이었다. 뷰에 `last_comment_at`을 추가하고 "점수 → 마지막 댓글 시각" 2차 정렬을 넣어서, 활동했던 방은 창이 비어도 위에 남도록 고쳤다.

### 국회의원 300명 시드

"정치인 뒷담"이 초기 앵커 콘텐츠라서 실제 데이터가 필요했다. 참여연대가 운영하는 공개 DB '열려라국회'에서 22대 국회의원 300명의 이름/정당/공식 프로필 사진을 수집했다. 목록 페이지에는 정당이 색상 점으로만 표시돼 있어서, 고유 색상 8개를 뽑아 각 색상의 대표 의원 상세페이지를 한 번씩만 조회해 색상→정당명 매핑을 만들었다. 수집 후 정당별 분포(민주 161, 국힘 110, 조국혁신 12…)가 실제 의석수와 일치하는지로 검증했다.

### 유형별 브라우징 + 검색 + 이미지 업로드

정치인만 있으면 재미없으니 메인을 **인물/물건/브랜드/사건/기타** 유형 칩으로 개편하고(정치인은 '인물'에 통합), 유형별 검색을 붙였다. 검색은 서버에서 `ilike`로 처리하는데, 검색어의 `%`, `_` 같은 패턴 문자는 이스케이프해야 한다는 걸 잊으면 안 된다.

이미지 업로드는 Supabase Storage 공개 버킷으로. 보안 포인트 하나 — 제안 등록 시 imageUrl을 받을 때 **우리 Storage에서 발급된 URL인지 prefix를 검증**한다. 안 그러면 아무 외부 URL이나 밀어넣을 수 있다.

### 관리자 신고 페이지

신고가 쌓이면 어디서 보나? 처음엔 `/admin/reports?key=비밀키` 방식으로 만들었는데, URL에 키가 노출되면 브라우저 히스토리에 남는 게 찜찜해서 **비밀번호 로그인 방식**으로 바꿨다. 비밀번호를 `timingSafeEqual`로 비교해 httpOnly 쿠키를 발급하고, 이후 요청은 쿠키로 인증한다. 틀린 키로 접근하면 404를 던져 페이지 존재 자체를 숨긴다.

## 삽질 기록

### Next.js 16: middleware가 proxy로 바뀌었다

`middleware.ts`를 만들었더니 deprecated 경고가 떴다. Next.js 16부터는 `proxy.ts`로 파일명과 export 이름이 바뀌었다. 기능은 동일하다.

### next-pwa는 Turbopack에서 안 돌아간다

PWA를 붙이려고 `next-pwa`를 설치했는데, Next.js 16의 기본 번들러인 Turbopack과 충돌했다(webpack 전용). 해결책은 **Serwist의 Turbopack 전용 패키지**(`@serwist/turbopack`)였다. webpack 플러그인 대신 서비스워커를 `/serwist/sw.js` 라우트로 동적 서빙하는 방식이라 번들러와 충돌하지 않는다.

```typescript
// app/serwist/[path]/route.ts — 서비스워커를 라우트로 서빙
export const { GET, generateStaticParams, ... } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
});
```

### supabase CLI가 말없이 멈춘다면

`supabase db push`가 아무 출력 없이 멈춰 있길래 한참 헤맸는데, 백그라운드로 실행하면서 **DB 비밀번호 입력 프롬프트를 기다리고 있었던 것**. `--password` 플래그로 넘기면 해결된다. 참고로 Personal Access Token(로그인용)과 DB 비밀번호(Postgres 접속용)는 별개다.

### 긴 텍스트가 모바일 레이아웃을 뚫는다

Playwright로 360/390/430px 뷰포트 스크린샷을 찍어보니, 공백 없는 긴 문자열이 화면 밖으로 삐져나갔다. 사용자 입력이 렌더링되는 모든 곳(댓글, 제목, 설명)에 `break-words`를, 순위 배지와 한 줄에 있는 트렌딩 제목에는 `truncate` + `min-w-0`을 적용했다. flex 자식에서 `min-w-0`이 없으면 truncate가 안 먹는다는 고전적인 함정도 다시 만났다.

## 배포

GitHub private 저장소를 만들어 push하고, Vercel CLI로 프로젝트를 링크하니 GitHub 연동까지 자동으로 걸렸다. 환경변수 5종(Supabase URL/키 2개, Anthropic 키, device_hash pepper)을 `vercel env add`로 등록하고 `vercel --prod` 한 번으로 끝. 이후로는 main에 push할 때마다 자동 배포된다.

## 정리 — 핵심 설계 결정 요약

| 결정 | 내용 |
|---|---|
| 쓰기 경로 단일화 | 모든 INSERT는 Route Handler + service-role. rate limit/필터링을 한 곳에서 강제 |
| 민감정보 테이블 분리 | Realtime이 행 전체를 브로드캐스트하므로 device_hash는 물리적으로 다른 테이블에 |
| 정합성은 DB에 | 동의→승격, 카운트 집계는 트리거로. 경쟁 상태를 Postgres 락으로 해결 |
| 배치는 pg_cron | 외부 워커 없이 만료/폭파/아카이브를 DB 안에서 |
| 임베딩 대신 LLM 직접 판단 | MVP 규모에선 Claude에게 목록을 주고 물어보는 게 더 단순 |
| 익명이되 추적 가능 | HMAC(user.id, pepper) = device_hash. 식별은 불가, 제재는 가능 |

기획서 한 장에서 시작해 마이그레이션 17개, API 라우트 12개, 실서비스 URL까지. "집단 동의로 게시판이 열린다"는 컨셉이 실제로 트리거 한 방에서 돌아가는 걸 봤을 때가 제일 짜릿했다. 다음 단계는 실제 유저를 받아보면서 required_votes 같은 숫자들을 현실에 맞게 튜닝하는 것이다.
