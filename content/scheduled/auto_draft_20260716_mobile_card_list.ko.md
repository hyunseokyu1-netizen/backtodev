---
title: '"카드가 좀 큰거 같아" 스크린샷 한 장에서 시작된 모바일 리스트 개편'
date: '2026-07-16'
publish_date: '2026-09-03'
description: 세로형 카드가 모바일에서 왜 헐렁해 보였는지, sm:hidden / hidden sm:flex로 데스크톱 그리드는 그대로 두고 모바일만 가로형 리스트로 바꾼 과정
tags:
  - Next.js
  - Tailwind CSS
  - 반응형 UI
  - 모바일
---

기능을 만들 때는 로직에 집중하다 보니 정작 "실제로 보면 어떤지"를 놓치기 쉽습니다. 노가리방 목록 카드도 그랬습니다. 데스크톱 그리드에서는 멀쩡해 보였는데, 모바일 스크린샷을 받아보고서야 문제를 알아챘습니다.

> "노가리방 카드 크기가 좀 큰거 같아. 빈 공간도 많은거 같고. 이미지를 좀 더 키우고 칸 높이를 좀 줄일까?"

기존 카드는 사진이 위, 텍스트가 아래에 오는 세로형 구조였습니다. 데스크톱 그리드(한 줄에 2~4개)에서는 정사각형에 가까운 카드가 잘 어울리는데, 모바일에서는 그 카드가 한 줄로 쌓이면서 사진과 텍스트 사이, 텍스트와 통계 사이에 남는 여백이 그대로 다 눈에 보였습니다. 카드 하나가 세로로 길어서 스크롤도 많이 해야 했고요.

## 왜 그냥 줄이지 않고 레이아웃을 바꿨나

처음엔 padding이나 폰트 크기만 줄일까 싶었는데, 근본 문제는 "사진 위 + 텍스트 아래"라는 구조 자체가 모바일 세로 스크롤 리스트와 안 맞는다는 거였습니다. 트위터나 레딧 피드를 떠올려보면 답이 나옵니다. 왼쪽에 큰 원형 프로필 사진, 오른쪽에 텍스트가 두 줄로 압축된 가로형 리스트죠. 그래서 방향을 아예 가로형으로 바꾸기로 했습니다.

- 왼쪽: 큰 원형 사진 (아바타)
- 오른쪽 첫 줄: 배지 + 제목
- 오른쪽 둘째 줄: 부제(소속/정당) + 통계(댓글·공감·비공감)

## Step 1 — 통계 블록을 공통 변수로 뽑기

가로형 카드와 세로형 카드가 댓글·공감·비공감 통계를 똑같이 보여줘야 해서, 먼저 이 부분을 변수로 뽑아 두 레이아웃에서 재사용했습니다.

```tsx
const stats = (
  <>
    <span className="inline-flex items-center gap-1">
      <MessageCircle className="size-3.5" strokeWidth={2} />
      {topic.comment_count}
    </span>
    <span className="inline-flex items-center gap-1">
      <ThumbsUp className="size-3.5" strokeWidth={2} />
      {topic.like_count}
    </span>
    <span className="inline-flex items-center gap-1">
      <ThumbsDown className="size-3.5" strokeWidth={2} />
      {topic.dislike_count}
    </span>
  </>
);
```

## Step 2 — 모바일 전용 가로형 카드 추가

`TopicCard.tsx` 하나 안에 가로형 마크업을 새로 추가했습니다. 사진을 `size-20` 원형 아바타로 왼쪽에 크게 두고, 오른쪽은 배지+제목 한 줄, 부제+통계 한 줄로 정보 밀도를 확 높였습니다.

```tsx
<div className="flex items-center gap-4 rounded-[18px] border-2 border-ink bg-card px-4 py-3.5 ... sm:hidden">
  {topic.image_url ? (
    <Avatar className="size-20 shrink-0 border-[1.5px] border-ink">
      <AvatarImage src={topic.image_url} alt={topic.title} />
      <AvatarFallback className="text-xl">{topic.title.slice(0, 1)}</AvatarFallback>
    </Avatar>
  ) : (
    <NogariIcon strokeWidth={14} eye={false} className="w-14 shrink-0 text-ink opacity-25" />
  )}
  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant="outline" className="shrink-0 px-2 py-0.5 text-[11px]">
        {TYPE_LABELS[topic.topic_type]}
      </Badge>
      <span className="truncate text-[17px] font-bold text-ink">{topic.title}</span>
    </div>
    <div className="flex min-w-0 items-center gap-2.5 text-[12.5px] text-meta">
      {sub && <span className="truncate">{sub}</span>}
      {stats}
    </div>
  </div>
</div>
```

제목이 길어질 수 있는 자리라 `truncate`를 꼭 넣어야 했습니다. 안 그러면 정치인 이름 뒤에 긴 수식어가 붙는 방에서 레이아웃이 깨졌을 거예요.

## Step 3 — 반응형 클래스로 두 레이아웃을 한 컴포넌트에서 분기

새 컴포넌트를 따로 만들지 않고, `sm:hidden`(모바일에서만 보임)과 `hidden sm:flex`(sm 이상에서만 보임) 조합으로 같은 `TopicCard` 안에서 분기했습니다.

```tsx
{/* 모바일 — 가로형 리스트 카드 */}
<div className="flex items-center gap-4 ... sm:hidden">
  {/* ... */}
</div>

{/* sm 이상(그리드) — 기존 세로 카드 */}
<div className="hidden h-full flex-col gap-3.5 ... sm:flex">
  {/* ... */}
  <div className="mt-auto flex items-center gap-3 border-t-[1.5px] border-divider pt-3 text-[13px] text-meta">
    {stats}
  </div>
</div>
```

컴포넌트를 둘로 쪼개는 것도 고민했는데, 데이터를 받아서 렌더링만 다르게 하는 수준이라 마크업 두 벌을 CSS로 스위칭하는 쪽이 더 단순했습니다. `topic`을 두 번 넘길 필요도 없고, 상태 관리도 하나로 끝나니까요.

## 트레이드오프

- **데스크톱은 그대로 유지**: 그리드에서는 세로 카드가 이미 잘 맞았기 때문에, 모바일만 바꾸고 데스크톱 UI에는 손대지 않았습니다. 굳이 전체를 통일할 이유는 없었습니다.
- **긴 제목 처리**: 가로형은 한 줄에 배지+제목이 같이 들어가다 보니 공간이 좁아서 `truncate` 처리가 필수였습니다.
- **마크업이 두 벌 존재**: 유지보수 관점에서는 통계 표시 같은 공통 부분을 변수로 뽑아 중복을 최소화했지만, 레이아웃 구조 자체는 두 벌을 유지하는 트레이드오프를 받아들였습니다.

## 검증 — 두 뷰포트 스크린샷으로 확인

레이아웃 변경은 코드만 봐서는 실제 느낌을 알기 어려워서, Playwright로 두 뷰포트를 각각 스크린샷 찍어 비교했습니다.

- 모바일 뷰포트(390px): 가로형 리스트로 카드 높이가 눈에 띄게 줄어든 것을 확인
- 데스크톱 뷰포트(1280px): 기존 그리드 레이아웃이 그대로 유지되는 것을 확인

수정 전/후 스크린샷을 나란히 놓고 보니 카드 하나당 세로 공간이 확실히 줄어서, 같은 화면에 더 많은 방이 들어오는 걸 눈으로 확인할 수 있었습니다.

## 정리

1. **스크린샷 한 장이 가장 정확한 버그 리포트다** — "빈 공간이 많다"는 말보다 실제 화면을 보는 게 문제를 훨씬 빨리 짚어준다
2. **모바일과 데스크톱은 다른 레이아웃이 맞을 수 있다** — 억지로 하나의 구조를 우겨넣기보다, 필요하면 반응형 분기로 아예 다른 마크업을 쓴다
3. **공통 부분은 변수로, 구조는 과감히 분기** — 통계 블록처럼 중복될 부분만 뽑아내고, 레이아웃 자체는 `sm:hidden` / `hidden sm:flex`로 깔끔하게 나눈다
4. **레이아웃 변경은 반드시 뷰포트별로 스크린샷 검증** — 코드 리뷰만으로는 "실제로 얼마나 줄었는지" 알 수 없다

작은 요청 하나("카드 좀 큰거 같아")가 실제로는 레이아웃 구조 자체를 다시 생각하게 만든 케이스였습니다. 사용자 피드백을 받으면 코드 레벨의 미세 조정보다 "이 구조가 애초에 맞는가"부터 되짚어보는 습관이 결과적으로 더 빠른 길이었습니다.
