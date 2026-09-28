---
title: '"발견됨 - 색인 생성 안 됨" 317개의 정체 — 빈 페이지를 색인해달라고 조르고 있었다'
date: '2026-07-28'
publish_date: '2026-10-14'
description: 구글 서치 콘솔에 쌓인 색인 안 된 317개 페이지의 원인을 DB 집계로 추적하고 sitemap과 noindex로 얇은 콘텐츠를 걷어낸 기록
tags:
  - SEO
  - Next.js
  - Search Console
  - sitemap
  - Supabase
---

## 서치 콘솔을 열었더니 317개가 빨간불

노가리(익명 커뮤니티 사이드 프로젝트)를 배포하고 한동안 지난 뒤, 구글 서치 콘솔을 열어봤다. 색인 현황이 궁금했는데, 화면을 보고 좀 당황했다. "페이지 색인이 생성되지 않는 이유" 목록에 이런 게 떠 있었다.

| 사유 | 소스 | 페이지 |
|---|---|---|
| 발견됨 - 현재 색인이 생성되지 않음 | Google 시스템 | **317** |
| 크롤링됨 - 현재 색인이 생성되지 않음 | Google 시스템 | 2 |
| 리디렉션이 포함된 페이지 | 웹사이트 | 2 |
| 적절한 표준 태그가 포함된 대체 페이지 | 웹사이트 | 1 |

"발견됨 - 현재 색인이 생성되지 않음(Discovered – currently not indexed)"이 **317개**. 목록을 눌러보니 전부 `https://nogari.org/topics/{uuid}` 형태의 방 상세 페이지였고, "최종 크롤링"은 죄다 "해당사항 없음"이었다. 즉 구글이 sitemap을 통해 URL 존재는 알았지만, **크롤링조차 하지 않고 색인을 미뤄둔** 상태였다.

사실 노가리 초기에 [Next.js SEO 기초 작업](/ko/posts/nextjs_seo_foundation_20260713)을 하면서 개설 대기·만료된 방에는 이미 noindex를 걸어 두었다. 그런데 이번 317개는 전부 멀쩡한 ACTIVE 방이었다. 방 상태만으로는 걸러지지 않는 문제였던 거다.

처음엔 "메타 태그가 잘못됐나? sitemap이 깨졌나? robots가 막고 있나?" 하고 버그를 의심했다. 그런데 파고들수록 이건 코드 버그가 아니라, **내가 구글에게 잘못된 걸 요청하고 있던** 문제였다. 이 글은 그 원인을 추적하고 고친 과정이다.

## Step 1: "발견됨 - 색인 안 됨"이 뭘 뜻하는지부터

먼저 이 상태 메시지의 의미를 정확히 알아야 했다. 구글의 색인 파이프라인은 대략 이렇게 흐른다.

```
발견(Discovered) → 크롤링(Crawled) → 색인(Indexed)
```

- **발견됨 - 색인 안 됨**: URL은 알지만(주로 sitemap으로) 아직 크롤링을 안 했다. 구글이 "이 페이지, 지금 굳이 가볼 만한가?"를 저울질하다 미룬 상태.
- **크롤링됨 - 색인 안 됨**: 크롤링은 했는데 색인은 안 했다. "가봤는데 색인할 가치가 없더라"에 가까운, 더 강한 부정 신호.

핵심은 "발견됨 - 색인 안 됨"이 **에러가 아니라 판단**이라는 점이다. 구글이 크롤링 예산(crawl budget)을 아끼려고, 가치가 낮아 보이는 페이지는 뒤로 미룬다. 특히 **도메인이 새로 생겨 신뢰도가 낮을 때**, 그리고 **비슷비슷한 페이지가 잔뜩 있을 때** 이 상태가 무더기로 생긴다.

여기서 "비슷비슷한 페이지가 잔뜩"이라는 대목이 걸렸다. 노가리의 방 상세 페이지는 구조가 다 똑같다. 제목, 카테고리, 한 줄 설명, 오늘의 질문, 그리고 댓글 목록. 만약 댓글이 없는 방이라면? 페이지에 남는 건 제목과 설명, "아직 아무도 노가리를 시작하지 않았어요"라는 안내뿐이다. 서로 거의 구별이 안 되는 얇은(thin) 페이지가 되는 거다.

## Step 2: DB로 가설 검증 — 숫자가 정확히 맞아떨어졌다

가설은 "빈 방이 너무 많아서 얇은 콘텐츠로 찍힌 것"이었다. 이건 추측으로 끝낼 게 아니라 데이터로 확인할 수 있다. 활성 방이 몇 개고, 그중 댓글이 하나라도 있는 방이 몇 개인지 세어봤다.

```bash
# 활성 방 총 개수
curl -s ".../rest/v1/topics?select=id&status=eq.ACTIVE" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  | python3 -c "import json,sys; print('활성 방:', len(json.load(sys.stdin)))"

# 방별 댓글 수 분포
curl -s ".../rest/v1/comments?select=topic_id&deleted_at=is.null" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  | python3 -c "
import json,sys
from collections import Counter
c = Counter(r['topic_id'] for r in json.load(sys.stdin))
print('댓글 1개 이상 방:', len(c))
print('방당 댓글수 분포:', dict(sorted(Counter(c.values()).items())))"
```

결과가 이랬다.

```
활성 방: 378
댓글 1개 이상 방: 61
방당 댓글수 분포: {1:9, 2:13, 3:3, 4:6, 5:2, ... 33:1}
```

계산해보면 **378 − 61 = 317**. 댓글이 하나도 없는 빈 방이 정확히 **317개**였다. 서치 콘솔의 "발견됨 - 색인 안 됨" 317개와 **소수점 하나 안 틀리고 일치**했다.

이 순간 진단이 끝났다. 구글이 색인 안 한 317개 = 노가리의 빈 방 317개. 우리는 sitemap에 빈 방까지 전부 밀어넣어서 "이 317개 페이지 색인해주세요"라고 광고하고 있었고, 구글은 "다 똑같이 비어 있는데요?"라며 거절한 거다. 활성 방의 84%가 빈 페이지였으니, 사이트 전체가 "얇은 사이트"로 보이기 딱 좋았다.

## Step 3: sitemap에서 빈 방 걷어내기

원인을 알았으니 고치는 방향은 명확했다. **실제로 대화가 쌓인 방만 색인 대상으로 광고하자.** 빈 방은 sitemap에서 빼고, 혹시 내부 링크로 발견되더라도 색인되지 않게 `noindex`를 건다.

먼저 색인 기준이 되는 최소 댓글 수를 상수 하나로 정의했다. 두 군데(sitemap, 방 상세)에서 같은 값을 써야 하니 단일 소스로 뒀다.

```ts
// src/lib/seo.ts
export const MIN_COMMENTS_FOR_INDEX = 3;
```

3으로 정한 이유는, 댓글이 3개는 있어야 "최소한 주고받는 대화"가 성립한다고 봤기 때문이다. 1~2개짜리는 여전히 얇다. 이 값은 나중에 상황 봐서 조정하면 된다 — 낮추면 더 많은 방이 색인되지만 얇은 페이지 비율이 올라가고, 높이면 확실히 알찬 방만 남는다.

sitemap에서는 방별 댓글 수를 집계해서 임계값 이상인 방만 넣도록 바꿨다.

```ts
// src/app/sitemap.ts
const [{ data: topics }, { data: commentRows }] = await Promise.all([
  admin.from("topics")
    .select("id, last_comment_at, activated_at")
    .eq("status", "ACTIVE")
    .eq("room_mode", "PERMANENT"),
  admin.from("comments").select("topic_id").is("deleted_at", null),
]);

// 방별 (미삭제) 댓글 수 집계
const commentCounts = new Map<string, number>();
for (const row of commentRows ?? []) {
  commentCounts.set(row.topic_id, (commentCounts.get(row.topic_id) ?? 0) + 1);
}

const topicPages = (topics ?? [])
  .filter((t) => (commentCounts.get(t.id) ?? 0) >= MIN_COMMENTS_FOR_INDEX)
  .map((t) => ({
    url: `${BASE_URL}/topics/${t.id}`,
    lastModified: t.last_comment_at ?? t.activated_at ?? undefined,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
```

댓글 전체를 한 번에 가져와 `Map`으로 집계하는 방식이다. 댓글이 수백 개 수준이라 이 정도는 부담이 없고, 방마다 count 쿼리를 N번 날리는 것보다 훨씬 낫다. 나중에 댓글이 수만 개로 늘면 DB 뷰나 집계 컬럼으로 옮기면 된다.

## Step 4: 방 상세 페이지에 noindex 동적으로 걸기

sitemap에서 빼는 것만으로는 부족하다. 구글은 sitemap뿐 아니라 사이트 내부 링크(홈의 방 목록, 관련 방 추천 등)를 타고도 빈 방을 발견할 수 있다. 그래서 방 상세 페이지 자체에서, 댓글이 기준 미달이면 `noindex` 메타 태그를 붙이도록 했다.

Next.js App Router에서는 `generateMetadata`에서 `robots` 필드를 반환하면 된다.

```ts
// src/app/topics/[id]/page.tsx
export async function generateMetadata({ params }) {
  const { id } = await params;
  const topic = await getTopic(id);
  // ...

  // 색인 대상: ACTIVE + 영구(대나무숲 제외) + 댓글이 최소치 이상인 방만.
  let indexable = topic.status === "ACTIVE" && topic.room_mode !== "BAMBOO_24H";
  if (indexable) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", id)
      .is("deleted_at", null);
    indexable = (count ?? 0) >= MIN_COMMENTS_FOR_INDEX;
  }

  return {
    title,
    description,
    alternates: { canonical: `/topics/${id}` },
    robots: indexable ? undefined : { index: false },
    // ...
  };
}
```

여기서 `head: true`로 count만 가져오는 게 포인트다. 실제 댓글 데이터는 필요 없고 개수만 알면 되니, 행을 전부 끌어오지 않고 카운트만 받는다. 그리고 이건 **동적**이라, 빈 방이 나중에 댓글 3개를 채우면 다음 크롤 때 `robots`가 사라져서 자동으로 색인 대상으로 바뀐다. 한 번 noindex 걸었다고 영영 막히는 게 아니다.

기존에 있던 조건(대기중 방·만료 방·대나무숲 제외)은 그대로 유지하면서, "댓글 수 미달" 조건만 얹은 형태다.

## Step 5: 로컬에서 진짜 걸러지는지 확인

배포 전에 로컬에서 실제로 동작하는지 봤다. sitemap의 방 URL 개수가 기대대로 줄었는지부터.

```bash
# sitemap의 topic URL 개수
curl -s http://localhost:3457/sitemap.xml | grep -c "/topics/"
# → 39

# 댓글 3개 이상인 방 수 (기대값)
# → 39
```

317개에서 **39개**로 딱 맞게 줄었다. 개별 페이지의 robots 태그도 확인했다.

| 대상 | robots 메타 | 결과 |
|---|---|---|
| 댓글 많은 방 | 없어야 함(색인 허용) | 태그 없음 ✅ |
| 빈 방 | `noindex` | `<meta name="robots" content="noindex"/>` ✅ |

두 케이스 다 의도대로 나왔다. 색인시킬 방은 열어주고, 빈 방은 막는다.

## 트러블슈팅: 이건 "고치면 바로 되는" 문제가 아니다

한 가지 착각하기 쉬운 게 있다. 이렇게 고쳤다고 해서 다음 날 317개가 우르르 색인되는 게 아니다. 몇 가지 현실을 짚어두면:

1. **"발견됨 - 색인 안 됨"은 새 도메인에서 원래 흔하다.** 도메인 신뢰도(authority)가 쌓여야 구글이 크롤링에 예산을 더 쓴다. 이건 코드로 못 당긴다. 시간과 실제 트래픽, 외부 링크가 해결한다.
2. **우리가 할 수 있는 건 "얇은 콘텐츠 신호를 없애는 것"까지다.** 84%가 빈 페이지인 사이트에서, 알찬 39개만 광고하는 사이트로 바꾼 거다. 이건 우리 쪽에서 통제 가능한 부분이었고, 그걸 정리했다.
3. **sitemap 재제출로 재크롤을 앞당길 수 있다.** 서치 콘솔에서 sitemap을 다시 제출하거나 URL 검사 → 색인 요청을 하면 크롤 우선순위가 조금 올라간다.

즉 이번 작업은 "구글아 이게 문제였어, 고쳤으니 봐줘"가 아니라, "적어도 우리가 스스로 발등을 찍던 부분은 치웠다"에 가깝다.

## 정리

이번 색인 문제 해결의 흐름을 한눈에 정리하면 이렇다.

| 단계 | 한 일 | 근거/결과 |
|---|---|---|
| 진단 | 서치 콘솔 "발견됨-색인 안 됨" 317개 확인 | 전부 `/topics/{uuid}`, 최종 크롤링 없음 |
| 원인 확정 | DB로 방별 댓글 분포 집계 | 빈 방 317개 = 색인 안 된 317개 (정확히 일치) |
| 수정 1 | sitemap에서 댓글 3개 미만 방 제외 | 317 → 39개로 축소 |
| 수정 2 | 방 상세 `generateMetadata`에 조건부 noindex | 빈 방 `noindex`, 댓글 쌓이면 자동 해제 |
| 검증 | sitemap URL 수·robots 메타 로컬 확인 | 39개 / noindex 정상 부착 |

돌아보면 배운 건 두 가지다.

첫째, **"색인이 안 된다"는 증상을 보면 코드 버그부터 의심하게 되는데, SEO에서는 "구글의 판단"인 경우가 많다.** robots나 canonical 같은 기술적 실수도 있지만, "발견됨 - 색인 안 됨"은 대개 콘텐츠 품질과 도메인 신뢰도 신호다. 무작정 메타 태그를 뒤지기 전에, "구글 입장에서 이 페이지가 색인할 가치가 있나?"를 먼저 물어야 했다.

둘째, **가설은 데이터로 확정하자.** "빈 방이 많아서 그런가?"라는 막연한 추측을, DB 집계 한 방으로 "빈 방 317개 = 색인 안 된 317개"라는 정확한 일치로 바꾸니 진단이 끝났다. 숫자가 딱 맞아떨어지는 순간만큼 확신을 주는 건 없다.

새 사이트를 운영하면서 "색인이 왜 안 되지?"는 누구나 한 번쯤 만나는 벽이다. 그럴 때 sitemap에 뭘 밀어넣고 있는지, 그중 실제로 색인할 가치가 있는 페이지가 얼마나 되는지부터 세어보길 권한다. 의외로 답이 그 숫자 안에 있다.
