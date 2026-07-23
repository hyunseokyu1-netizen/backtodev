---
title: '빈 커뮤니티 문제를 Vercel Cron + AI로 풀기 — 그리고 들통난 가짜 티'
date: '2026-07-14'
publish_date: '2026-08-27'
description: 실제 유저가 오기 전 커뮤니티를 조용하지 않게 유지하는 자동 댓글 시드 파이프라인을 만들고, 타임스탬프가 전부 같아서 티가 났던 문제까지 고친 기록
tags:
  - Vercel Cron
  - Claude API
  - Supabase
  - Next.js
  - 콜드스타트
---

## 빈 커뮤니티는 아무도 안 온다

커뮤니티 서비스를 만들어본 사람이라면 다 아는 문제가 있습니다. **사람이 있어야 사람이 오는데, 사람이 없으면 아무도 안 옵니다.** 방문자가 들어왔는데 게시판이 텅 비어있으면 그 자리에서 나갑니다. 그런데 첫 유저는 그 텅 빈 곳에 처음 글을 써야 하는 사람이죠. 이 악순환을 콜드스타트 문제라고 부릅니다.

제 사이드 프로젝트(익명 커뮤니티 "노가리")는 이미 국회의원 300여 명 + 물건·브랜드·사건 방을 시드해놨는데, 방 제목만 있고 댓글이 없으면 여전히 죽은 공간처럼 보입니다. 매일 제가 손으로 댓글 몇 개씩 써넣을 수도 있지만, 그건 지속 가능한 방법이 아니에요. 그래서 **정해진 시간에 자동으로 조용한 방에 댓글을 채워주는 파이프라인**을 만들었습니다.

## 설계 — "가짜 활동"이지만 안전하게

이 기능은 태생적으로 조심스럽습니다. AI가 무인으로, 정기적으로, 실제 서비스 DB에 콘텐츠를 씁니다. 잘못 설계하면 이상한 내용이 자동으로 올라갈 수 있죠. 그래서 안전장치를 겹겹이 뒀습니다:

1. **실존 인물 방은 대상에서 제외.** 정치인·아이돌 방(`POLITICIAN`, `PERSON`)은 자동 생성 대상에서 아예 빼고, 물건·브랜드·사건(`OBJECT`, `BRAND`, `EVENT`)만 건드립니다. 실존 인물에 대해 AI가 무감독으로 뭔가를 계속 생성하다 보면 언젠가 사실과 다르거나 명예훼손 소지가 있는 문장이 나올 위험이 있는데, 그 위험을 아예 카테고리 단위로 차단한 겁니다.
2. **생성한 콘텐츠도 실제 유저 댓글과 똑같이 검열을 통과시킨다.** 기존에 만들어둔 2단계 모더레이션(`moderateContent`)을 그대로 재사용합니다. AI가 쓴 글이라고 봐주는 거 없습니다.
3. **CRON_SECRET으로 인증.** Vercel Cron이 요청에 실어주는 시크릿 값을 확인하지 않으면 외부에서 아무나 이 엔드포인트를 두드려 댓글을 무한 생성시킬 수 있습니다.
4. **끄는 스위치를 먼저 만든다.** 실제 유저가 늘면 이 기능은 꺼야 합니다. 환경변수 하나(`SEED_CRON_ENABLED=false`)로 즉시 멈출 수 있게 미리 심어뒀습니다.

## Step 1 — 댓글 생성 함수

기존 `src/lib/anthropic.ts`에 짧은 댓글 하나를 생성하는 함수를 추가했습니다:

```ts
export async function generateSeedComment(
  topicTitle: string,
  topicType: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODERATION_MODEL,
    max_tokens: 200,
    system:
      "너는 익명 커뮤니티에서 잡담을 남기는 평범한 유저다. " +
      "주제에 대해 짧은 댓글 하나를 한국어 반말/구어체로 자연스럽게 써라.\n" +
      "규칙: 1~2문장, 이모지 금지, 실존 인물 명예훼손·허위사실 금지, " +
      "광고성 문구 금지, 평범한 개인 의견 수준으로.",
    messages: [{ role: "user", content: `주제 유형: ${topicType}\n주제: ${topicTitle}` }],
  });
  // ...텍스트 블록 추출
}
```

포인트는 시스템 프롬프트에 **"평범한 개인 의견 수준으로"**를 못박은 것입니다. 과장된 밈체나 극단적 의견을 배제해야, 나중에 진짜 유저 댓글 사이에 섞였을 때 이질감이 없습니다.

## Step 2 — cron 라우트: 조용한 방부터 골라서

```ts
// app/api/cron/seed-comments/route.ts
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.SEED_CRON_ENABLED === "false") {
    return NextResponse.json({ skipped: "disabled" });
  }

  const { data: topics } = await admin
    .from("topics")
    .select("id, title, topic_type")
    .eq("status", "ACTIVE")
    .in("topic_type", ["OBJECT", "BRAND", "EVENT"])
    .order("last_comment_at", { ascending: true, nullsFirst: true })  // 가장 오래 조용했던 방부터
    .limit(3);

  for (const topic of topics ?? []) {
    const content = await generateSeedComment(topic.title, topic.topic_type);
    const decision = await moderateContent(content);          // 재검열
    if (decision.blocked) continue;

    const deviceHash = `cron-seed:${randomUUID()}`;
    const nickname = deriveAnonNickname(topic.id, deviceHash); // 기존 로직 재사용

    await admin.from("comments").insert({ topic_id: topic.id, anon_nickname: nickname, content });
    await admin.from("comment_authors").insert({ comment_id: comment.id, device_hash: deviceHash });
  }
}
```

`last_comment_at` 오름차순 정렬이 은근히 중요합니다. 매번 같은 인기 방만 채우는 게 아니라, **가장 오래 조용했던 방부터 골고루 살려주는 로테이션**이 됩니다.

닉네임은 새로 짓지 않고 기존 `deriveAnonNickname(topicId, deviceHash)`를 그대로 씁니다 — 실제 익명 유저 시스템과 완전히 같은 규칙으로 닉네임이 나오니, 겉보기엔 진짜 유저와 구분이 안 됩니다.

## Step 3 — Vercel Cron 등록과 플랜 제약

`vercel.json`에 스케줄을 적으면 끝입니다:

```json
{
  "crons": [{ "path": "/api/cron/seed-comments", "schedule": "0 3 * * *" }]
}
```

여기서 하나 주의할 점 — **Vercel의 개인(Hobby) 플랜은 크론이 하루 1회로 제한**됩니다. `*/30 * * * *`처럼 자주 돌리는 설정을 개인 플랜에 올리면 배포 단계에서 막힙니다. 확신이 안 서면 일단 하루 1회로 시작하고, 필요하면 나중에 플랜을 올려서 빈도를 늘리는 게 안전합니다.

CRON_SECRET은 코드에 넣지 않고 CLI로 바로 프로덕션 환경변수에 등록했습니다:

```bash
openssl rand -hex 32 | vercel env add CRON_SECRET production
```

배포 후 실제로 크론이 등록됐는지는 `vercel crons ls`로 확인할 수 있습니다:

```
$ vercel crons ls
  Path                       Schedule
  /api/cron/seed-comments    0 3 * * *
```

인증 없이 엔드포인트를 두드리면 401이 나오는 것도 로컬·프로덕션 양쪽에서 확인했습니다. 배포하고 "잘 되겠지"로 끝내지 않고, 실제로 성공 경로와 실패 경로를 둘 다 찔러보는 게 이런 무인 자동화에서는 특히 중요합니다.

## Step 4 — 완성한 줄 알았는데, 티가 났다

기능을 배포하고 방을 둘러보다가 이상한 걸 발견했습니다. 어떤 방은 댓글 5개가 전부 **같은 1분 안에** 달려 있었습니다. DB를 까보니 더 심했습니다:

```
2026-07-13T13:42 -> 25 개
2026-07-12T05:46 -> 23 개
2026-07-12T14:22 -> 14 개
```

한 시드 스크립트를 실행하면 댓글 10~20개가 몇 초 안에 순식간에 INSERT되니까, `created_at`이 전부 "지금"으로 찍힌 겁니다. 사람이 보면 5초 만에 티가 나는 문제였어요 — **진짜 커뮤니티는 댓글이 몰아서 달리지 않습니다.**

해결은 백필 스크립트로 `created_at`을 그럴듯하게 흩뿌리는 것이었습니다:

```ts
const rand = (min: number, max: number) => min + Math.random() * (max - min);

for (const [topicId, topicComments] of byTopic) {
  const topicStart = now - rand(1, 14) * 86_400_000; // 방마다 1~14일 전 중 랜덤 시작점
  let cursor = topicStart;
  const newTimeById = new Map<string, number>();

  for (const c of topicComments) {
    let t: number;
    if (c.parent_id && newTimeById.has(c.parent_id)) {
      const parentTime = newTimeById.get(c.parent_id)!;
      // 답글은 반드시 부모보다 뒤 시간
      t = Math.max(cursor + rand(15, 600) * 60_000, parentTime + rand(3, 360) * 60_000);
    } else {
      t = cursor + rand(15, 600) * 60_000; // 다음 댓글까지 15분~10시간 랜덤 간격
    }
    newTimeById.set(c.id, t);
    cursor = Math.max(cursor, t);
    // updates 배열에 push...
  }
}
```

여기서 신경 쓴 것 두 가지:

- **답글은 항상 부모 댓글보다 나중 시간이어야 한다.** 안 그러면 "답글이 원댓글보다 3시간 먼저 달린" 시간 역행 버그가 생깁니다. `parentTime + 랜덤 간격`으로 하한선을 걸어서 방지했습니다.
- **방마다 독립적인 "활동 시작 시점"을 랜덤으로 잡는다.** 모든 방이 똑같은 날 활동을 시작한 것처럼 보이면 그것도 티가 나니까요.

`comments.created_at`만 바꾸고 끝이 아닙니다. 방 목록의 "오늘 N개" 카운트나 트렌딩 정렬은 `topics.last_comment_at`을 기준으로 하는데, 이건 댓글 INSERT 시점에 트리거가 자동으로 채워둔 값이라 백필 이후에도 그대로 "방금"으로 남아있습니다. 그래서 타임스탬프를 흩뿌린 뒤 **방별 최신 댓글 시각을 다시 집계해서 `last_comment_at`도 같이 갱신**해야 앞뒤가 맞습니다.

작업 후 검증은 두 가지로 했습니다:

```
서로 다른 '분' 단위 개수: 84 / 전체 84   ← 완전히 해소
✅ 모든 답글이 부모보다 뒤 시간          ← 무결성 확인
```

## 트러블슈팅 요약

| 증상 | 원인 | 해결 |
|---|---|---|
| 크론 배포 실패 (스케줄 반려) | 개인 플랜은 크론 1일 1회 제한 | 우선 `0 3 * * *`로 시작, 필요 시 플랜 업그레이드 |
| 같은 방 댓글 N개가 같은 분에 몰림 | 시드 스크립트가 반복문으로 순식간에 INSERT | 방마다 랜덤 시작점 + 누적 랜덤 간격으로 재분산 |
| 답글이 부모보다 이른 시간으로 찍힘 | 랜덤 재분산 시 부모-자식 관계 미고려 | `parentTime + 여유시간`을 하한선으로 강제 |
| "오늘 N개" 카운트가 안 맞음 | `last_comment_at`이 트리거로만 갱신, 백필 후 방치 | 백필 후 방별 최신 시각 재계산해서 별도 업데이트 |

## 정리

1. **콜드스타트는 사람 손이 아니라 파이프라인으로 풀어야 지속 가능하다** — 매일 손으로 채우는 건 확장이 안 됨
2. **무인 자동화일수록 안전장치를 먼저 설계한다** — 실존 인물 제외, 재검열, 인증, 끄는 스위치를 기능보다 먼저 정함
3. **기존 로직을 재사용하면 가짜와 진짜가 구분 안 된다** — 닉네임 생성, 모더레이션 모두 실제 유저 경로와 동일한 함수를 그대로 태움
4. **가짜 데이터의 가장 큰 약점은 타임스탬프다** — 내용은 그럴듯해도 "몰아서 생성됨"이 시간에서 드러난다
5. **파생 데이터(집계 컬럼)도 같이 손봐야 한다** — `created_at`만 고치고 `last_comment_at`을 잊으면 절반만 고친 것

지금은 이 파이프라인이 하루 세 자리 방을 순환하며 조용히 방을 채우고 있고, 실제 유저가 들어오기 시작하면 환경변수 하나로 끌 계획입니다. "가짜로 시작해서 진짜로 넘어가는" 이 다리를 최대한 매끄럽게 놓는 게 이번 작업의 목표였습니다.
