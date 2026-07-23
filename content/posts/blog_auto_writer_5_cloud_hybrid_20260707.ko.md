---
title: '블로그 발행을 자동화해보자 (5) 로컬 도구를 클라우드로 - Vercel Blob이 배신했다'
date: '2026-07-07'
publish_date: '2026-08-16'
description: 로컬 대시보드로 충분하다고 결론 냈던 도구를 결국 Vercel에 올리면서 겪은 이야기와, Vercel Blob의 최종 일관성 문제로 Upstash Redis로 갈아탄 과정
tags:
  - Vercel
  - Redis
  - Upstash
  - 서버리스
  - 아키텍처
---

지난 편에서 "발행은 로컬 세션이 있어야만 가능하니 클라우드 배포는 불가능하다, 로컬 대시보드로 충분하다"고 결론 냈습니다. 그런데 막상 써보니 생각이 바뀌었습니다. 주제를 등록하고 초안을 검토하는 건 꼭 맥 앞에 앉아 있을 때만 하는 일이 아니었습니다. 밖에서 폰으로 주제만 던져놓고, 초안도 확인하고 싶어졌습니다. 그래서 "발행은 로컬에서, 나머지는 클라우드에서"라는 하이브리드 구조를 실제로 만들었습니다.

## 무엇을 클라우드로 옮기고, 무엇을 남겼나

4편에서 이미 답은 나와 있었습니다. 발행(브라우저 자동화 + 로그인 세션)만 로컬에 묶여 있을 뿐, 주제 등록과 AI 초안 생성은 클라우드에서 못 할 이유가 없었습니다.

```
[Vercel 대시보드] 주제 등록, 초안 생성/수정, 발행 버튼
      → Redis에 "발행 요청" 기록
      → [내 맥의 워커] 15초마다 요청 확인
      → 로그인 세션으로 실제 발행 → 결과를 Redis에 기록
      → 대시보드가 자동 갱신
```

핵심은 **발행 버튼을 눌렀을 때 클라우드가 직접 브라우저를 조작하지 않는다**는 점입니다. 클라우드는 "발행해 달라"는 요청만 큐에 남기고, 실제 실행은 항상 로컬 워커가 맡습니다.

## Next.js 대시보드는 큰 고민이 없었다

Next.js App Router + Route Handler로 API를 짜는 건 이번 시리즈에서 유일하게 순탄했던 부분입니다.

```typescript
// app/api/publish/route.ts
export async function POST(req: Request) {
  const { date, platform, topic } = await req.json();
  const topics = await getTopics();
  const entry = topics.find((t) => t.date === date && t.topic === topic);
  entry.requestedPlatforms = [...new Set([...(entry.requestedPlatforms ?? []), platform])];
  entry.status = 'publish_requested';
  await saveTopics(topics);
  return Response.json({ ok: true });
}
```

발행 API가 하는 일은 실제 발행이 아니라 **"요청 기록"** 뿐입니다. 이 비대칭이 하이브리드 구조의 전부라고 해도 될 만큼 단순합니다.

## Vercel Blob에 저장했다가 데이터가 널뛰기 시작했다

처음엔 별생각 없이 Vercel Blob에 JSON 파일 하나(`topics.json`)를 두고, 읽고 → 수정하고 → 다시 쓰는 방식으로 짰습니다. 그런데 이상한 현상이 생겼습니다. 주제를 등록한 직후 목록을 새로고침하면 방금 등록한 항목이 사라져 있다가, 몇 초 뒤 다시 고치면 나타나는 식이었습니다.

```typescript
// 이렇게 짜면 read-modify-write 패턴이 된다
const topics = await getTopics();      // Blob에서 읽기
topics.push(newEntry);
await saveTopics(topics);              // Blob에 쓰기
// → 바로 이어서 getTopics()를 호출하면 옛 데이터가 나올 수 있다
```

원인은 **Vercel Blob이 최종 일관성(eventually consistent) 스토리지**라는 점이었습니다. 쓰기가 끝났다고 응답을 받아도, 바로 뒤이은 읽기가 최신 값을 보장하지 않습니다. 파일 하나를 계속 덮어쓰는 read-modify-write 패턴에는 애초에 맞지 않는 저장소를 고른 셈입니다. 정적 자산 저장에는 적합하지만, "지금 막 바뀐 상태를 바로 읽어야 하는" 상태 저장소로 쓰면 안 되는 도구였습니다.

## Upstash Redis로 전면 교체

강한 일관성(strong consistency)이 필요했으므로, Vercel Marketplace를 통해 Upstash Redis를 새로 붙였습니다.

```bash
vercel integration add upstash/upstash-kv
```

붙이고 나니 환경변수(`KV_REST_API_URL`, `KV_REST_API_TOKEN`)가 자동으로 프로젝트에 주입됐고, 코드도 Blob보다 오히려 더 단순해졌습니다.

```typescript
// lib/store.ts
const redis = Redis.fromEnv();

export async function getTopics(): Promise<TopicEntry[]> {
  return (await redis.get<TopicEntry[]>('topics')) ?? [];
}

export async function saveTopics(topics: TopicEntry[]): Promise<void> {
  await redis.set('topics', topics);
}
```

교체 후 로컬과 프로덕션 양쪽에서 "쓰고 바로 읽기"를 반복 테스트해서 값이 튀지 않는 걸 확인했습니다. Blob 스토어는 삭제하고 `@vercel/blob` 의존성도 걷어냈습니다.

> **교훈**: "서버리스 + 파일 하나짜리 상태"라는 조합을 보면 일관성 모델을 제일 먼저 확인해야 합니다. 정적 파일 서빙과 상태 저장은 요구사항이 다른 문제입니다.

## 로컬 워커 — 클라우드의 요청을 받아 실제로 발행하는 쪽

워커는 특별한 게 없습니다. Redis를 15초마다 훑어서 `requestedPlatforms`가 있는 항목을 처리하고, 끝나면 결과를 다시 써넣습니다.

```typescript
export function startWorker(): void {
  const tick = async () => {
    if (processing) return; // 이전 발행이 끝나기 전에 겹쳐 돌지 않도록
    processing = true;
    try {
      await pollOnce();
    } finally {
      processing = false;
    }
  };
  void tick();
  setInterval(tick, 15_000);
}
```

`processing` 플래그로 겹침을 막은 이유는, 발행 자체가 브라우저를 띄우고 페이지를 옮겨다니는 데 몇 초에서 몇십 초가 걸리는 작업이라 두 번째 폴링 타이머가 돌기 전에 끝나지 않을 수 있기 때문입니다. 처리 하나가 끝날 때마다 즉시 Redis에 저장하도록 해서, 대시보드 쪽에서 "발행 중 → 완료/실패"가 실시간으로 바뀌는 걸 볼 수 있게 했습니다.

## 실제로 붙여서 확인한 순간

대시보드에서 발행 버튼을 누르고, 맥에 켜둔 워커 터미널을 보고 있으니 15초 안에 로그가 찍히면서 브라우저가 뜨고 실제로 글이 올라갔습니다. 클라우드에서 누른 버튼이 집에 있는 맥을 원격으로 조종하는 걸 눈으로 보는 경험은 생각보다 뿌듯했습니다.

```
▶ [worker] 2026-07-07 / tistory / "장마철 음식관리"
  클라우드 초안 사용: 장마철 음식관리, 냉장고만 믿으면 안 되는 이유
  [tistory] 발행 완료: https://내블로그.tistory.com/manage/posts/
```

다만 이 로그를 보고 "발행 성공"이라고 믿었던 게 다음 편에서 다시 문제가 됩니다. 관리 페이지로 리다이렉트됐다는 사실만으로는, 본문까지 제대로 올라갔는지는 확인되지 않았기 때문입니다.

## 정리

| 단계 | 위치 | 이유 |
|---|---|---|
| 주제 등록 / 초안 생성 | 클라우드 (Vercel + Redis) | 로그인 세션이 필요 없는 작업 |
| 발행 요청 기록 | 클라우드 (Redis) | 상태만 남기면 되는 가벼운 작업 |
| 실제 발행 (브라우저 자동화) | 로컬 (내 맥의 워커) | 로그인 세션이 로컬에만 있음 |

"클라우드 배포는 불가능하다"는 4편의 결론은 틀리지 않았습니다. 다만 **발행과 나머지를 분리**하면 "불가능"이 "하이브리드로 가능"으로 바뀐다는 걸 놓치고 있었던 겁니다. 다음 편에서는 이 구조로 신나게 발행 버튼을 눌렀다가 마주친, 조금 부끄러운 버그 이야기를 다루겠습니다.
