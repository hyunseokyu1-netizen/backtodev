---
title: '홍보 시작 전 마지막 점검 — OG 이미지, 크론 이중화, 관리자 화면 다듬기'
date: '2026-07-17'
publish_date: '2026-09-09'
description: 커뮤니티에 노가리를 알리기 전에 공유 카드를 살리고 크론 결측을 막고 관리자 화면의 묵은 신고와 글자 수 제한을 정리한 실전 체크리스트
tags:
  - Next.js
  - Vercel
  - GitHub Actions
  - Supabase
  - OG 이미지
---

## "홍보는 어떻게 하지?"에서 시작된 점검 목록

노가리를 슬슬 커뮤니티에 알려볼 때가 됐다는 생각이 들어서 홍보 방법을 고민했다. 이메일로 기자들에게 스팸을 보내는 것보다는, 커뮤니티에 자연스럽게 시딩하고 카톡으로 공유했을 때 그럴듯하게 보이는 게 먼저라는 결론이 나왔다. 그래서 "OG 작업부터 하자"는 걸 시작으로 홍보 전 마지막 점검을 하루 동안 쭉 이어갔다.

이 글은 그날 처리한 네 가지를 묶은 것이다.

1. 카톡 공유 카드(OG 이미지)에 방 사진과 활동량 표시
2. Vercel 크론이 하루씩 빼먹는 문제를 GitHub Actions로 이중화
3. 댓글 도배를 막기 위한 글자 수 제한 조정
4. 관리자 신고 화면에 필터·검색 추가

각각은 작아 보여도, "누군가 실제로 들어와서 쓴다"는 걸 전제하고 보면 하나같이 빠지면 안 되는 것들이었다.

## Step 1: OG 이미지에 방 사진과 댓글 수 넣기

카톡으로 링크를 공유하면 뜨는 미리보기 카드가 텍스트만 있어서 밋밋했다. 방 사진(정치인 프로필 사진 포함)을 원형으로 넣고, 활동 중인 방이면 "지금까지 노가리 N개"라는 문구로 이미 대화가 굴러가는 곳이라는 걸 보여주기로 했다.

여기서 중요한 건 **원격 이미지를 OG 렌더링에 그대로 박아넣으면 안 된다**는 점이다. satori(Next.js OG 이미지 생성기)에 살아있지 않을 수도 있는 외부 URL을 그대로 넘기면, 그 URL이 어느 순간 죽었을 때 OG 이미지 전체가 500 에러로 깨진다. 카드 하나가 안 뜨는 게 아니라 그 방의 공유 자체가 통째로 망가지는 것이다.

그래서 이미지를 서버에서 미리 fetch해서 data URI로 변환하고, 실패하면 조용히 사진 없는 레이아웃으로 넘어가게 만들었다.

```ts
// src/app/topics/[id]/opengraph-image.tsx

/**
 * 방 사진을 미리 받아 data URI로 변환한다. satori에 원격 URL을 그대로 주면
 * 그 URL이 죽었을 때 OG 이미지 전체가 500으로 깨지므로, 실패하면 사진 없는
 * 레이아웃으로 넘어가게 null을 반환한다.
 */
async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentTypeHeader = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentTypeHeader.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    // OG 응답이 너무 무거워지지 않게 원본 4MB 초과는 사진 생략
    if (buffer.byteLength > 4 * 1024 * 1024) return null;
    return `data:${contentTypeHeader};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
```

댓글 수는 활성 방일 때만 조회해서 서브 문구를 바꿔치기했다.

```ts
const sub = isPending
  ? "함께 동의하면 방이 열려요"
  : commentCount > 0
    ? `지금까지 노가리 ${commentCount}개 · 익명으로 참여`
    : "익명으로 노가리 까는 곳";
```

핵심 원칙은 하나다. **외부 의존성이 들어가는 순간, 그 의존성이 실패했을 때 전체가 죽지 않고 일부만 생략되게 만든다.** OG 이미지처럼 "안 뜨면 그냥 안 예쁜 것"으로 끝나야 할 기능이 "링크 자체가 깨진다"로 번지면 안 된다. 로컬에서 사진 있는 방과 없는 방을 각각 렌더링해서 확인한 뒤 배포했다.

## Step 2: 크론이 하루씩 빼먹는 걸 발견하고 이중화하기

"크론 돌았어?"라고 무심코 확인하다가 진짜 문제를 하나 발견했다. 7월 16일 정오분 시드 크론이 실행이 안 됐던 것이다. Vercel Hobby 플랜의 크론은 정확히 그 시각에 안 돌 수도 있다는 걸 직접 겪은 셈이다.

해결책은 "Vercel이랑 GitHub Actions에 같이 걸어서 이중화하자"였다. 그런데 여기서 단순히 두 스케줄러를 병렬로 걸면 새로운 문제가 생긴다 — **둘 다 성공하는 날에는 시드가 두 번 들어간다.** 그래서 실행 여부를 기록하고 중복 실행을 막는 가드가 먼저 필요했다.

기존에 있던 `rate_limit_events` 테이블(원래는 유저 요청 빈도 제한용)을 재활용해서, "최근 20시간 내 실행 기록이 있으면 스킵"하는 로직을 엔드포인트에 추가했다.

```ts
// src/app/api/cron/seed-comments/route.ts

// Vercel Hobby 크론이 하루씩 빼먹는 일이 있어 GitHub Actions가 40분 뒤에
// 백업으로 같은 엔드포인트를 호출한다. 둘 다 성공한 날 시드가 두 번 들어가지
// 않도록, 실행 기록(rate_limit_events 재활용)을 남기고 최근 20시간 내
// 기록이 있으면 스킵한다. 수동 테스트는 ?force=1로 가드를 우회할 수 있다.
const force = request.nextUrl.searchParams.get("force") === "1";
const GUARD_HOURS = 20;
if (!force) {
  const since = new Date(Date.now() - GUARD_HOURS * 3_600_000).toISOString();
  const { count } = await admin
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("device_hash", "cron:seed-comments")
    .eq("action", "CRON_SEED")
    .gte("created_at", since);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: "already ran recently" });
  }
}
// 기록은 시드 시작 전에 남긴다 — 두 스케줄러가 거의 동시에 호출해도
// 뒤따라온 쪽이 가드에 걸릴 확률을 최대화
await admin
  .from("rate_limit_events")
  .insert({ device_hash: "cron:seed-comments", action: "CRON_SEED" });
```

**실행 기록을 시드 작업 시작 "전"에 남긴다**는 점이 포인트다. 만약 시드 작업이 다 끝난 뒤에 기록을 남기면, 두 스케줄러가 거의 동시에 들어왔을 때 둘 다 기록을 못 본 채로 통과해버릴 수 있다. 먼저 기록부터 찍어두면 뒤따라온 쪽이 가드에 걸릴 확률이 훨씬 높아진다.

GitHub Actions 쪽은 Vercel 크론 시각(UTC 03:00)보다 40분 늦은 UTC 03:40에 같은 엔드포인트를 호출하도록 워크플로우를 만들었다.

```yaml
# .github/workflows/cron-seed-backup.yml
name: cron-seed-backup

on:
  schedule:
    - cron: "40 3 * * *" # UTC 03:40 = KST 12:40
  workflow_dispatch: # 수동 실행용

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Call seed-comments endpoint
        run: |
          code=$(curl -s -o /tmp/res.json -w "%{http_code}" \
            --max-time 290 \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "https://nogari.org/api/cron/seed-comments")
          echo "HTTP $code"
          cat /tmp/res.json
          test "$code" = "200"
```

`CRON_SECRET`은 `gh secret set`으로 등록해서 리포지토리에 노출되지 않게 했다. 그리고 만들고 끝낸 게 아니라 `workflow_dispatch`로 수동 트리거를 해봐서, 가드가 "이미 최근에 실행됨" 스킵 응답을 실제로 돌려주는 것까지 눈으로 확인했다. 이중화 장치는 "평소엔 안 보이다가 진짜 필요할 때 조용히 실패하는" 게 제일 무섭기 때문에, 만들고 나서 반드시 강제로 발동시켜보는 게 맞다고 생각한다.

## Step 3: 댓글 글자 수 제한, 정답이 없어서 빠르게 조정한 이야기

도배성 테스트 댓글(로렘입숨 스타일로 화면을 통째로 채우는 긴 텍스트)을 스크린샷으로 보다가 "1000자는 너무 많은 것 같다"는 생각이 들었다. 그래서 500자로 줄였다. 근데 화면에서 다시 보니 500자도 여전히 많아 보였다. 그래서 다시 333자로 줄였다. 커밋 로그를 그대로 옮기면 이렇다.

```
42ebc3e feat: 댓글 입력창 글자 수 카운터 + 소개 페이지에 1,000자 제한 안내
abc1b76 fix: 댓글 글자 수 제한 1000자 → 500자로 축소
ff3c40d fix: 댓글 글자 수 제한 500자 → 333자
0878924 fix: 댓글 글자 수 카운터를 처음부터 상시 노출
```

30분 안에 두 번 연속으로 숫자를 줄였다. 처음엔 좀 민망했는데, 생각해보면 **"적당한 글자 수 제한"은 계산으로 나오는 값이 아니라 실제 화면에서 눈으로 보면서 감을 잡아가는 값**이다. "노가리는 짧게 치고 빠지는 수다가 컨셉"이라는 방향성만 있으면, 정확한 숫자는 몇 번 부딪혀보면서 찾는 게 오히려 빠르다.

바꿀 때마다 서버 검증, 입력창 `maxLength`, 소개 페이지 안내 문구까지 세 곳을 같이 고쳐야 했다.

```ts
// src/app/api/comments/route.ts
// 1000자로 시작했다가 한 댓글이 모바일 화면을 통째로 차지하는 걸 보고 축소.
// 짧게 치고 빠지는 수다가 컨셉이라 333자로 제한한다.
const MAX_CONTENT_LENGTH = 333;
```

```tsx
// src/components/topic/CommentInput.tsx
const MAX_LENGTH = 333; // /api/comments의 MAX_CONTENT_LENGTH와 동일해야 함
```

글자 수 카운터도 처음엔 "짧은 댓글에서는 방해되지 않게 절반(167자)부터 노출"하도록 만들었는데, "처음부터 보여줄까?"라는 질문에 답하다 보니 한도 자체가 333자로 짧아졌으니 굳이 숨길 이유가 없다는 결론이 나서 상시 노출로 바꿨다.

```tsx
// 카운터는 maxLength로 조용히 잘리기 시작할 때 유저가 이유를 알 수
// 있게 붙였다 — 한도가 짧아서(333자) 처음부터 상시 노출
<p
  className={
    content.length >= MAX_LENGTH
      ? "shrink-0 text-xs font-medium text-destructive"
      : "shrink-0 text-xs text-meta"
  }
>
  {content.length}/{MAX_LENGTH}
</p>
```

여기서 얻은 교훈은, **제한값처럼 정답이 없는 UX 수치는 처음부터 완벽한 숫자를 찾으려 하지 말고 빠르게 좁혀가는 게 낫다**는 것이다. 대신 그 값이 쓰이는 곳(서버 검증, 클라이언트 제한, 안내 문구)을 한 군데도 안 빠뜨리고 같이 바꾸는 게 더 중요했다.

## Step 4: 관리자 신고 화면, 처리된 신고에 파묻히지 않게

신고 관리 페이지를 스크린샷으로 보다가 또 다른 문제를 발견했다. 처리된 신고가 계속 쌓이다 보니 정작 봐야 할 미처리 신고가 아래로 밀려서 안 보이는 상황이었다. 기존엔 "검토 대기" 섹션과 "처리 이력" 섹션을 위아래로 나눠뒀는데, 이력이 길어지면 스크롤이 계속 늘어나는 구조였다.

기본 화면은 미처리만 보여주고, 필요할 때만 처리됨/전체로 전환하고 키워드로 찾아볼 수 있게 바꿨다.

```tsx
// src/app/admin/reports/page.tsx
const FILTER_TABS = [
  { value: "open", label: "미처리" },
  { value: "done", label: "처리됨" },
  { value: "all", label: "전체" },
] as const;
```

검색은 신고 대상, 사유, 처리 결과, AI 판단 근거까지 한꺼번에 훑는다.

```tsx
const visibleReports = reports.filter((r) => {
  const isOpen = STATUS_META[r.status].open;
  if (filter === "open" && !isOpen) return false;
  if (filter === "done" && isOpen) return false;
  if (q) {
    const haystack = [
      r.targetLabel,
      r.reason,
      r.resolution,
      r.ai_reason,
      STATUS_META[r.status].label,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q.toLowerCase())) return false;
  }
  return true;
});
```

필터 상태는 쿼리스트링(`?f=done&q=검색어`)으로 관리해서 링크를 그대로 공유하거나 새로고침해도 상태가 유지되게 했다. 화면이 하나 더 생긴 게 아니라, 원래 있던 화면이 "관리자가 실제로 매일 들여다볼 만한" 화면이 된 셈이다.

## 그 외 자잘한 것: 유형 칩 줄바꿈 → 가로 스크롤

같은 날 처리한 자잘한 수정도 하나 있다. 홈 화면의 "핫한 노가리방" 유형 필터 칩이 6개(전체 포함)인데, 좁은 화면에서 줄바꿈되면 마지막 칩(기타)만 혼자 다음 줄에 떨어져 보이는 문제가 있었다. 줄바꿈 대신 가로 스크롤로 바꿔서 항상 한 줄을 유지하게 했다. 코드 몇 줄짜리 수정이지만, 이런 것도 "실제로 스마트폰으로 눌러보다가" 발견하는 문제라 목록에 남겨둔다.

## 정리

홍보를 시작하기 전에 손댄 네 가지는 결이 다 달랐다.

| 작업 | 문제 | 해결 원칙 |
|---|---|---|
| OG 이미지 | 카드가 텍스트뿐이라 밋밋함 | 외부 이미지는 미리 fetch해서 data URI로, 실패해도 전체가 깨지지 않게 |
| 크론 이중화 | Vercel Hobby 크론이 하루씩 빼먹음 | 백업 스케줄러 추가 + 실행 기록 기반 중복 방지 가드 |
| 글자 수 제한 | 도배성 긴 댓글이 화면을 채움 | 정답 없는 값은 빠르게 좁혀가고, 쓰이는 곳을 빠짐없이 동기화 |
| 신고 필터 | 처리된 신고에 미처리가 파묻힘 | 기본값을 "지금 봐야 할 것"으로, 나머지는 필터·검색으로 |

공통점은 하나였다. 전부 "이미 만들어둔 기능이 실제로 사람들이 쓸 때도 잘 버티는가"를 점검하는 작업이었다는 것. 화려한 신규 기능보다 이런 마감 작업들이 실제로 서비스를 오픈해도 되는지를 결정한다는 걸 다시 느꼈다.
