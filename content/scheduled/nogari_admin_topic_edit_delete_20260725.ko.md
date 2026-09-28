---
title: '관리자 화면에 "카테고리 수정"과 "방 삭제"를 붙이며 배운 것들'
date: '2026-07-25'
publish_date: '2026-10-06'
description: 잘못 분류된 방을 바로잡고 잘못 만든 방을 지우는 관리자 기능을 만들며 겪은 cascade 삭제, FK 참조 정리, 인증/검증 가드 설계
tags:
  - Next.js
  - Supabase
  - PostgreSQL
  - Route Handler
  - 관리자 도구
---

## "ChatGPT가 왜 '물건'이지?"에서 시작됐다

노가리(익명 커뮤니티 사이드 프로젝트)를 스마트폰으로 훑어보다가 이상한 걸 발견했다. "ChatGPT" 방이 **'물건'** 카테고리로 분류돼 있었다. 이 방은 며칠 전 뉴스 트렌드를 보고 크론이 자동으로 만든 방인데, AI가 유형을 뽑을 때 ChatGPT를 소프트웨어 제품으로 보고 `OBJECT`(물건)로 넣어버린 거다. 사람 기준으로는 '브랜드'나 '기타'가 더 맞는데 말이다.

문제는, 이걸 **고칠 방법이 없었다**는 거다. 관리자 화면(`/admin/topics`)에는 방 제목·설명·사진·오늘의 질문을 고치는 폼은 있었지만, 정작 카테고리(유형)를 바꾸거나 방 자체를 지우는 버튼은 없었다. 자동 생성 기능을 붙이면서 "잘못 만들어진 걸 사람이 치우는" 뒷정리 도구를 안 만들어둔 셈이다.

자동화를 넣으면 반드시 오작동이 따라온다. 그리고 오작동한 결과물을 손으로 치울 수단이 없으면, 자동화는 오히려 관리 부담을 늘린다. 그래서 이날은 두 가지를 붙였다.

1. **유형(카테고리) 변경** — 잘못 분류된 방을 올바른 유형으로
2. **방 삭제** — 잘못 만들어졌거나 스팸인 방을 완전히 제거

작아 보이는 기능이지만, "삭제"는 되돌릴 수 없는 작업이라 생각보다 신경 쓸 게 많았다. 이 글은 그 과정을 정리한 것이다.

## 사전 확인: 삭제하면 딸린 데이터는 어떻게 되나

방을 지우기 전에 가장 먼저 확인한 건 **하위 데이터의 운명**이다. 노가리의 `topics` 테이블에는 여러 테이블이 매달려 있다. 댓글, 투표, AI 요약, 공유 기록, 댓글 작성자 정보 등. 방을 지웠는데 이것들이 고아(orphan) 레코드로 남으면 DB가 지저분해진다.

다행히 마이그레이션을 짤 때 외래 키에 `on delete cascade`를 걸어뒀는지 확인부터 했다.

```bash
grep -rn "on delete cascade" supabase/migrations/*.sql | grep topics
```

결과를 보니 대부분 잘 걸려 있었다.

| 테이블 | 참조 | 삭제 시 동작 |
|---|---|---|
| `comments` | `topic_id → topics(id)` | `cascade` (함께 삭제) |
| `topic_votes` | `topic_id → topics(id)` | `cascade` |
| `topic_meta` | `topic_id → topics(id)` | `cascade` |
| `ai_summaries` | `topic_id → topics(id)` | `cascade` |
| `share_events` | `topic_id → topics(id)` | `cascade` |
| `politician_profiles` | `topic_id → topics(id)` | `cascade` |
| `topics.merged_into_id` | `→ topics(id)` | **지정 안 됨 (기본값 = 막힘)** |

여기서 마지막 줄이 함정이었다. `merged_into_id`는 "이 방이 다른 방으로 병합됐다"를 표시하는 **자기 참조** 컬럼인데, 이 FK에는 `on delete` 규칙을 지정하지 않았다. PostgreSQL에서 `on delete`를 안 적으면 기본값은 `NO ACTION`이다. 즉, 어떤 방 A가 방 B를 `merged_into_id`로 가리키고 있으면, **B를 지우려 할 때 "아직 참조하는 놈이 있다"며 삭제가 실패한다.**

이걸 미리 발견한 덕에, 삭제 API에서 이 참조를 먼저 끊어주는 처리를 넣을 수 있었다. 안 그랬으면 "병합 이력이 있는 방만 삭제가 안 되는" 이상한 버그를 나중에 마주쳤을 거다.

## Step 1: 유형 변경 — PATCH에 필드 하나 추가

유형 변경은 상대적으로 쉬웠다. 기존 방 수정 API(`PATCH /api/admin/topic`)에 `topicType` 필드를 하나 더 받게 하면 된다. 다만 아무 값이나 받으면 안 되니, 관리자가 손으로 지정할 수 있는 유형 목록을 화이트리스트로 정의했다.

```ts
// src/app/api/admin/topic/route.ts
import type { TopicType } from "@/types/database.types";

// 관리자가 손으로 지정할 수 있는 유형. POLITICIAN은 정치인 시드
// (politician_profiles 조인)에만 쓰는 내부 유형이라 수동 선택 대상에서 제외.
const EDITABLE_TYPES: TopicType[] = [
  "PERSON",
  "OBJECT",
  "BRAND",
  "EVENT",
  "OTHER",
];
```

`POLITICIAN`을 뺀 게 포인트다. 이 유형은 정치인 방을 시드할 때만 쓰는 내부용이고, `politician_profiles`라는 별도 테이블과 조인해서 정당·사진 같은 걸 관리한다. 관리자가 아무 방이나 `POLITICIAN`으로 바꾸면 그 프로필 데이터가 없어서 화면이 깨질 수 있으니, 애초에 선택지에서 빼는 게 안전했다.

검증을 통과하면, `topicType`이 넘어온 경우에만 업데이트 객체에 끼워 넣는다.

```ts
const topicType = body?.topicType;
if (topicType && !EDITABLE_TYPES.includes(topicType as TopicType)) {
  return NextResponse.json(
    { error: "유효하지 않은 유형입니다." },
    { status: 400 },
  );
}

const { error } = await admin
  .from("topics")
  .update({
    title,
    description,
    person_title: personTitle,
    image_url: imageUrl,
    today_question: todayQuestion,
    // topicType이 있을 때만 스프레드로 끼워 넣는다 — 안 넘어오면 기존 유형 유지
    ...(topicType ? { topic_type: topicType as TopicType } : {}),
  })
  .eq("id", topicId);
```

`...(topicType ? { topic_type: ... } : {})` 이 패턴이 편했다. 유형을 안 바꾸는 요청(제목만 고칠 때 등)에서는 `topic_type`을 아예 update 대상에서 빼버려서, 기존 값이 그대로 유지된다. 굳이 별도 분기 없이 조건부 스프레드 한 줄로 해결된다.

## Step 2: 삭제 — DELETE 핸들러 신설과 FK 선정리

같은 라우트 파일에 `DELETE` 핸들러를 새로 추가했다. Next.js의 Route Handler는 HTTP 메서드별로 함수를 export하면 되니, `PATCH` 옆에 `DELETE`를 하나 더 두면 끝이다.

```ts
export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    topicId?: string;
  } | null;

  const topicId = body?.topicId;
  if (!topicId) {
    return NextResponse.json({ error: "topicId가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 이 방을 merged_into_id로 가리키는 다른 방이 있으면 FK 제약에 걸리므로
  // 먼저 그 참조를 끊는다(병합 대상이 삭제돼도 남은 방은 정상 동작해야 함).
  await admin
    .from("topics")
    .update({ merged_into_id: null })
    .eq("merged_into_id", topicId);

  const { error } = await admin.from("topics").delete().eq("id", topicId);

  if (error) {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

핵심은 `delete()` 호출 **직전**에 `merged_into_id` 참조를 먼저 `null`로 밀어주는 부분이다. 사전 확인 단계에서 발견한 그 FK 함정을 여기서 방어한다. 이 방을 병합 대상으로 가리키던 다른 방이 있어도, 참조만 끊고 그 방 자체는 멀쩡히 살려둔다.

나머지 하위 데이터(댓글·공감·공유 기록 등)는 `cascade`가 알아서 지워주니 손댈 게 없다. **DB 제약을 제대로 걸어두면 애플리케이션 코드가 그만큼 단순해진다**는 걸 다시 느낀 지점이다. cascade가 없었으면 이 핸들러 안에서 테이블마다 `delete`를 6~7번 호출하고 순서까지 신경 써야 했을 거다.

### 하드 삭제 vs 소프트 삭제

여기서 잠깐 고민한 게 있다. 진짜로 `delete`로 지울까(하드 삭제), 아니면 `status`만 바꿔서 숨길까(소프트 삭제)?

노가리에는 이미 [방 병합 기능](/ko/posts/nogari_haiku_ab_test_topic_merge_20260717)에서 소프트 삭제를 쓴다(`status = 'EXPIRED'`로 닫고 `merged_into_id`로 옮겨간 방 안내). 하지만 이번 삭제 대상은 성격이 다르다. **잘못 만들어진 방, 스팸, 오분류된 자동 생성 방** — 즉 "존재 자체가 실수인 방"이다. 이런 건 이력을 남길 가치가 없고, 오히려 DB에 계속 쌓이면 통계나 트렌드 산식에 노이즈만 된다. 그래서 하드 삭제를 택했다. 대신 되돌릴 수 없으니 UI에서 확인 절차를 반드시 끼웠다(다음 단계).

## Step 3: 폼 UI — 유형 셀렉트와 삭제 버튼

API가 준비됐으니 관리자 폼(`TopicEditForm.tsx`)에 UI를 붙인다. 유형은 셀렉트 박스로, 삭제는 확인 창이 뜨는 버튼으로 만들었다.

셀렉트 옵션도 API의 화이트리스트와 똑같이 `POLITICIAN`을 뺐다.

```tsx
const TYPE_OPTIONS: { value: TopicType; label: string }[] = [
  { value: "PERSON", label: "인물" },
  { value: "OBJECT", label: "물건" },
  { value: "BRAND", label: "브랜드" },
  { value: "EVENT", label: "사건" },
  { value: "OTHER", label: "기타" },
];
```

그런데 여기서 작은 엣지 케이스가 있었다. 만약 편집하려는 방이 원래 `POLITICIAN` 유형이면? 셀렉트에는 그 옵션이 없으니 표시가 애매해진다. 그래서 초기값을 정규화해서, `POLITICIAN`이면 화면상 `PERSON`(인물)으로 보여주되, **유형을 건드리지 않으면 저장 시 아예 안 넘겨서 원래 값이 유지**되게 했다.

```tsx
// POLITICIAN 방을 수동 편집하는 경우, 셀렉트에 없는 값이라 인물(PERSON)로
// 기본 노출하되, 저장하지 않으면 유형은 넘기지 않아 원래 값이 유지된다.
const normalizedInitialType: TopicType =
  initialTopicType === "POLITICIAN" ? "PERSON" : initialTopicType;
```

삭제 버튼은 `window.confirm`으로 되돌릴 수 없다는 걸 명확히 경고했다.

```tsx
async function handleDelete() {
  if (deleting) return;
  const ok = window.confirm(
    `"${initialTitle}" 방을 완전히 삭제할까요?\n` +
    `댓글·공감·공유 기록도 함께 삭제되며 되돌릴 수 없습니다.`,
  );
  if (!ok) return;

  setDeleting(true);
  try {
    const res = await fetch("/api/admin/topic", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId }),
    });
    // ...성공 시 router.refresh()로 목록 갱신
  } finally {
    setDeleting(false);
  }
}
```

버튼은 빨간 테두리로 다른 버튼과 시각적으로 구분하고, 저장 버튼과 멀찍이 떨어뜨려(`ml-auto`) 실수로 누르지 않게 배치했다. 파괴적인 액션은 **눈에 띄되, 손이 잘 안 가는 자리**에 두는 게 원칙이다.

## Step 4: 로컬에서 실제로 눌러보고 검증하기

"만들었다"와 "동작한다"는 다르다. 특히 삭제처럼 되돌릴 수 없는 기능은 배포 전에 반드시 실제로 밟아봐야 한다. 로컬 dev 서버를 띄우고, 관리자 로그인 쿠키를 받은 다음, service-role 키로 테스트용 방을 하나 만들어서 시나리오를 돌렸다.

```bash
# 1) 테스트용 방 생성 (service-role로 직접 insert)
TID=$(curl -s ".../rest/v1/topics" -X POST \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Prefer: return=representation" \
  -d '{"title":"__TEST_DELETE_ME__","topic_type":"OBJECT","status":"ACTIVE"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")

# 2) 유형 변경 (OBJECT -> BRAND)
curl -s -b cookies.txt -X PATCH .../api/admin/topic \
  -d "{\"topicId\":\"$TID\",\"title\":\"__TEST_DELETE_ME__\",\"topicType\":\"BRAND\"}"

# 3) 삭제
curl -s -b cookies.txt -X DELETE .../api/admin/topic \
  -d "{\"topicId\":\"$TID\"}"
```

각 단계마다 DB를 직접 조회해서 결과를 눈으로 확인했다.

| 테스트 | 기대 | 결과 |
|---|---|---|
| 유형 변경 `OBJECT → BRAND` | `topic_type = BRAND` | `[{"topic_type":"BRAND"}]` ✅ |
| 삭제 | 행이 사라짐 | `[]` (빈 배열) ✅ |
| 인증 없이 DELETE | 403 | `{"error":"권한이 없습니다."}` `[403]` ✅ |
| 잘못된 유형 `POLITICIAN` | 400 | `{"error":"유효하지 않은 유형입니다."}` `[400]` ✅ |

특히 마지막 두 줄이 중요했다. 관리자용 파괴적 API는 **인증이 없으면 막히는가**, **화이트리스트 밖의 값을 거부하는가**를 반드시 확인해야 한다. 프론트엔드 셀렉트에서 `POLITICIAN`을 뺐어도, 누군가 API를 직접 호출하면 넘길 수 있으니 서버에서 한 번 더 막는 게 정석이다. 실제로 400이 떨어지는 걸 눈으로 보고 나서야 배포했다.

## 정리

이번 작업의 핵심 흐름을 한눈에 정리하면 이렇다.

| 단계 | 무엇을 | 왜 |
|---|---|---|
| 사전 확인 | `on delete cascade` 여부, `merged_into_id` FK 규칙 점검 | 삭제 시 고아 레코드 방지, FK 제약 걸림 예방 |
| 유형 변경 | PATCH에 `topicType` + 화이트리스트 검증 | 오분류 방 교정, POLITICIAN 오용 차단 |
| 삭제 | DELETE 핸들러 + `merged_into_id` 참조 선정리 | 잘못 만든 방 완전 제거, FK 함정 회피 |
| UI | 유형 셀렉트 + 확인 창 삭제 버튼 | 실수 방지, 파괴적 액션 격리 |
| 검증 | 유형/삭제/403/400 4개 시나리오 로컬 E2E | "동작한다"를 눈으로 확인 후 배포 |

돌아보면 이번 작업에서 배운 건 세 가지로 요약된다.

1. **자동화에는 반드시 뒷정리 도구를 짝지어라.** AI가 방을 자동 생성하는 기능을 붙였으면, 그 결과가 틀렸을 때 사람이 고치고 지우는 수단도 같이 있어야 한다. 자동화만 있고 교정 수단이 없으면 관리 부담이 오히려 늘어난다.
2. **DB 제약을 제대로 걸면 코드가 단순해진다.** `on delete cascade` 덕분에 삭제 핸들러가 `delete` 한 줄로 끝났다. 다만 규칙을 지정 안 한 FK(`merged_into_id`) 하나가 함정이 될 수 있으니, 삭제 전에 참조 관계를 한 번 훑는 습관이 필요하다.
3. **파괴적 API는 서버에서 이중으로 막아라.** 프론트에서 선택지를 빼는 것과, 서버에서 화이트리스트로 거부하는 것은 별개다. 인증 가드(403)와 검증 가드(400)가 실제로 작동하는지 배포 전에 직접 호출해서 확인하는 게 맞다.

관리자 도구는 화려하지 않아서 자꾸 미루게 되는데, 자동화 기능을 붙일수록 "치우는 손"의 중요성이 커진다는 걸 다시 느낀 작업이었다.
