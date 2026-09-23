---
title: '노가리 리뉴얼 (2/5) — AI에게 "사실 판정"은 절대 시키지 않는 이유'
date: '2026-07-19'
publish_date: '2026-09-24'
description: Claude Haiku로 방마다 댓글 흐름을 요약해주는 기능을 만들면서 캐싱 전략과 면책 문구를 함께 설계한 기록
tags:
  - Claude API
  - Anthropic
  - Next.js
  - Supabase
  - AI 요약
---

## "이 방 지금 뭔 얘기해?"를 3초 안에 알려주기

1편에서 트렌드 점수를 실시간 산식으로 바꿨다면, 이번엔 그 위에 올라가는 화면 얘기다. 신규 방문자가 어떤 방에 처음 들어왔을 때 댓글 100개를 처음부터 읽지 않고도 "지금 여기서 무슨 얘기가 오가는지" 파악할 수 있어야 한다는 게 지시서의 요구였다.

```text
지금 이 방에서는

- 손흥민의 이적 가능성이 가장 많이 언급되고 있어요.
- 새로운 팀에서의 출전 기회를 기대하는 의견이 많아요.
- 잔류가 더 안정적이라는 반대 의견도 있어요.
```

이런 식으로 최근 댓글을 3~4줄로 요약해서 보여주는 기능이다. 여기서 신경 써야 할 게 두 가지였다. 첫째는 **AI가 사실을 판정하는 뉘앙스를 절대 쓰지 않게 하는 것**, 둘째는 **매 페이지 로딩마다 LLM을 호출하지 않는 것**이었다.

## Step 1: 프롬프트에서부터 "판정 금지"를 명시하기

익명 커뮤니티의 댓글은 사실도 있고 억측도 있고 농담도 있다. AI 요약이 "손흥민이 이적한다"처럼 단정하는 순간, 이건 커뮤니티 여론 요약이 아니라 AI가 만든 허위정보가 된다. 그래서 시스템 프롬프트에 이 원칙을 못박았다.

```ts
// src/lib/anthropic.ts
export async function summarizeTopicComments(
  topicTitle: string,
  comments: { nickname: string; content: string }[],
): Promise<string[]> {
  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL, // claude-haiku-4-5
    system:
      "너는 익명 커뮤니티 '노가리'의 대화 요약 담당자다. ... " +
      "규칙: 댓글에 나온 '의견'을 요약할 뿐 사실 여부를 판정하는 표현을 절대 " +
      "쓰지 마라('~라고 해요', '~라는 의견이 많아요'처럼 전달 형식으로). " +
      "욕설이나 개인정보는 요약에 옮기지 마라. 각 문장은 60자 이내로 간결하게.",
    messages: [{ role: "user", content: `...` }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { points: { type: "array", items: { type: "string" } } },
          required: ["points"],
        },
      },
    },
  });
  ...
}
```

`output_config`로 JSON 스키마를 강제해서 항상 `points: string[]` 형태로만 응답받게 했다. 그리고 화면에는 이 요약 바로 아래 면책 문구를 **항상, 조건 없이** 붙였다.

```tsx
<p className="mt-2.5 text-xs text-muted-foreground">
  AI가 최근 댓글을 요약한 내용이며 사실과 다를 수 있습니다.
</p>
```

프롬프트로 판정 표현을 막는 것과, 화면에서 면책 문구로 한 번 더 감싸는 것 — 이 둘은 서로 대체재가 아니라 **이중 안전장치**다. 프롬프트가 아무리 잘 짜여도 LLM이 100% 그대로 따르리라는 보장은 없기 때문이다.

## Step 2: 매번 부르면 안 된다 — 캐시 조건 설계

두 번째 문제는 비용과 속도였다. 방에 사람이 들어올 때마다 최근 댓글 50개를 모아 Haiku를 호출하면, 트래픽이 조금만 늘어도 감당이 안 된다. 그래서 캐시 테이블을 만들고 재생성 조건을 명확히 정했다.

```sql
create table ai_summaries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  key_points jsonb not null,
  source_comment_count integer not null, -- 생성 시점의 댓글 수 스냅샷
  created_at timestamptz not null default now()
);
```

노출 조건과 재생성 조건을 이렇게 나눴다.

- **노출 조건**: 최근 24시간 댓글 10개 이상, 또는 전체 댓글 30개 이상 (너무 조용한 방에는 안 보여줌)
- **재생성 조건**: 마지막 생성 이후 댓글 20개가 새로 쌓였거나, 30분이 지났을 때

```ts
// src/app/api/topics/[id]/summary/route.ts
const cacheFresh =
  cached &&
  Date.now() - new Date(cached.created_at).getTime() < REGEN_INTERVAL_MS &&
  totalCount - cached.source_comment_count < REGEN_COMMENT_DELTA;

if (cached && cacheFresh) {
  return NextResponse.json({ points: cached.key_points });
}
```

`source_comment_count`라는 스냅샷 컬럼이 핵심이다. "몇 분 지났나"만 보면 활발한 방에서 캐시가 너무 오래 우려먹히고, "댓글 몇 개 늘었나"만 보면 한산한 방은 영영 재생성이 안 된다. 두 조건을 **OR**로 걸어서 어느 쪽이든 걸리면 새로 만들게 했다.

실패 대응도 신경 썼다. LLM 호출이 실패하면 새로 만들지 못하더라도 **직전 캐시라도 보여준다.**

```ts
} catch (e) {
  console.error("AI 요약 생성 실패:", e);
  if (cached) {
    return NextResponse.json({ points: cached.key_points, createdAt: cached.created_at });
  }
  return NextResponse.json({ points: null });
}
```

지시서에도 "AI 호출 실패 시 기존 캐시 또는 기본 문구를 표시한다"는 원칙이 있었는데, 이건 AI 기능을 프로덕션에 넣을 때 거의 항상 필요한 패턴이라고 본다. **AI 호출은 언젠가 반드시 실패한다는 전제로 설계해야 한다.**

## Step 3: 페이지 로딩을 막지 않기

마지막으로, 요약을 서버 컴포넌트에서 미리 fetch해서 내려주지 않고 **클라이언트에서 마운트 후 비동기로 불러오게** 했다.

```tsx
// src/components/topic/TopicAiSummary.tsx
export function TopicAiSummary({ topicId }: { topicId: string }) {
  const [points, setPoints] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/topics/${topicId}/summary`)
      .then((res) => (res.ok ? res.json() : { points: null }))
      .then((data) => {
        if (!cancelled && data.points?.length > 0) setPoints(data.points);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [topicId]);

  if (!points) return null;
  return ( /* ... */ );
}
```

캐시가 신선하면 응답이 금방 오지만, 재생성이 필요한 경우 Haiku 호출까지 몇백 ms가 더 걸린다. 이 지연 때문에 방 상세 페이지 전체 로딩이 늦어지면 안 된다는 게 원칙이었다. 요약 박스는 늦게 뜨더라도 댓글 목록과 입력창은 즉시 보여야 한다.

## 덤: 댓글 정렬 4종과 중복 방 안내도 같은 날 붙였다

AI 요약과 함께, 댓글을 실시간/최신순/공감순/논쟁순으로 정렬하는 기능도 넣었다. 논쟁순은 이런 산식이다.

```ts
// 공감·비공감이 모두 많은 댓글을 우선 노출
function controversyScore(c: Comment): number {
  return Math.min(c.like_count, c.dislike_count) + (c.like_count + c.dislike_count) * 0.2;
}
```

`min(공감, 비공감)`을 쓰는 이유는 명확하다. 공감만 200개인 댓글은 "다들 동의하는 댓글"이지 "논쟁적인 댓글"이 아니다. 공감과 비공감이 **둘 다** 많아야 진짜 의견이 갈리는 댓글이다.

그리고 방 제안 시 유사한 방이 이미 있으면 "기존 방으로 이동" 버튼과 함께, 그래도 새로 만들고 싶다면 사유를 5자 이상 적게 하는 흐름도 추가했다. 사유는 삭제하지 않고 `topic_meta`에 남겨서, 나중에 관리자가 "이 사람이 왜 굳이 새 방을 만들었는지" 판단할 근거로 쓸 수 있게 했다.

## 정리

| 기능 | 핵심 설계 |
|---|---|
| AI 요약 | 프롬프트 + 화면 면책 문구 이중 안전장치, 판정 표현 금지 |
| 캐시 전략 | 댓글 20개 증가 OR 30분 경과 → 재생성, 실패 시 이전 캐시 폴백 |
| 로딩 전략 | 서버에서 미리 안 부르고 클라이언트 비동기 fetch — 늦게 뜨는 건 괜찮지만 페이지는 안 막음 |
| 댓글 정렬 | 논쟁순 = min(공감, 비공감) + 전체 반응 × 0.2 |
| 중복 방 UX | 유사 방 발견 시 "이동" 버튼 + 사유 입력 후 강행 가능 |

다음 편은 댓글 하나를 이미지 카드로 만들어 SNS에 공유하는 기능을 만들다가 만난 500 에러 이야기다. 원인이 꽤 낯설어서 트러블슈팅만으로 한 편을 채웠다.
