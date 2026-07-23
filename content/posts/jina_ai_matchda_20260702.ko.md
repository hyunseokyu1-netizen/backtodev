---
title: 'Jina AI 써보기: 채용 공고를 LLM이 읽게 만들고, 이력서와 매칭하기'
date: '2026-07-02'
publish_date: '2026-07-24'
description: URL을 마크다운으로 바꾸는 Reader부터 임베딩·리랭커까지, Jina AI를 matchda 채용 매칭에 쓰려는 이유와 실사용법
tags:
  - Jina AI
  - LLM
  - Embeddings
  - 스크래핑
  - matchda
---

## 스크래핑에 지쳐서 다른 길을 찾다

채용 매칭 서비스 **matchda**를 만들면서 가장 먼저 부딪힌 벽은 늘 똑같았다. **채용 공고 페이지를 읽어오는 일.**

공고 URL 하나를 받아서 "직무, 자격요건, 우대사항"을 뽑아내야 하는데, 막상 긁어보면:

- 로컬에선 되던 게 서버에선 **403**으로 막히고
- **Cloudflare** 봇 차단에 걸리고
- 요즘 채용 사이트는 대부분 **SPA**라 HTML을 받아도 본문이 비어 있다 (JS 렌더링 후에야 내용이 채워짐)

Playwright로 헤드리스 브라우저를 띄우는 방법도 써봤지만, 서버 비용과 유지보수가 만만치 않았다. "공고 텍스트 하나 읽자고 이렇게까지 해야 하나" 싶던 차에 찾은 게 **Jina AI**다.

이 글은 Jina AI의 핵심 API들을 직접 써본 기록이자, matchda가 왜 이걸 도입하려는지에 대한 정리다.

## Jina AI가 뭔데

Jina AI는 "검색과 LLM을 위한 인프라"를 API로 제공하는 서비스다. 여러 제품이 있는데, matchda 입장에서 눈여겨본 건 네 가지다.

| API | 하는 일 | matchda에서의 쓸모 |
|-----|---------|---------------------|
| **Reader** (`r.jina.ai`) | URL → 깔끔한 마크다운 | 채용 공고 페이지 읽기 (스크래핑 대체) |
| **Search** (`s.jina.ai`) | 검색어 → 상위 결과 마크다운 | 회사/공고 정보 보강 |
| **Embeddings** | 텍스트 → 벡터 | 이력서 ↔ 공고 의미 매칭 |
| **Reranker** | 후보 목록 재정렬 | 매칭 결과 정밀 정렬 |

즉 matchda의 파이프라인 **"공고 읽기 → 후보 매칭 → 정렬"** 이 Jina 제품 라인과 거의 1:1로 맞아떨어진다. 이게 도입을 검토한 결정적 이유다.

## 사전 준비: API 키

Reader와 Search는 **키 없이도** 바로 써볼 수 있다(rate limit이 낮을 뿐). Embeddings·Reranker는 키가 필요하다. [jina.ai](https://jina.ai)에서 가입하면 API 키를 발급해 주고, 무료 티어 토큰도 준다. 키는 이렇게 헤더에 넣는다.

```
Authorization: Bearer jina_xxxxxxxxxxxxxxxx
```

> 정확한 무료 한도와 가격은 수시로 바뀌니 [가격 페이지](https://jina.ai)에서 확인하는 게 좋다. 이 글에선 "무료로 충분히 테스트할 수 있다" 정도로만 짚어둔다.

## Step 1. Reader — URL을 마크다운으로 (핵심)

matchda가 가장 반긴 기능. 사용법이 어이없을 만큼 간단하다. **읽고 싶은 URL 앞에 `https://r.jina.ai/`만 붙이면 된다.**

```bash
curl "https://r.jina.ai/https://example.com/jobs/12345"
```

응답은 그 페이지의 본문을 **LLM이 먹기 좋은 마크다운**으로 정리해서 준다. 광고, 네비게이션, 사이드바 같은 노이즈는 걷어내고 제목·본문 위주로.

핵심은 Jina 쪽에서 **렌더링과 봇 차단 대응을 대신 해준다**는 점이다. SPA도 JS 실행 후 결과를 주기 때문에, 내가 Playwright를 직접 돌리지 않아도 본문이 나온다. 내 서버가 403에 막히던 문제를 Jina의 인프라로 우회하는 셈이다.

키를 넣으면 rate limit이 올라가고, 헤더로 동작을 조절할 수도 있다.

```bash
curl "https://r.jina.ai/https://example.com/jobs/12345" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-Return-Format: markdown" \
  -H "X-Target-Selector: main"          # 특정 CSS 영역만 추출
```

- `X-Return-Format`: `markdown` / `text` / `html` 중 선택
- `X-Target-Selector`: 공고 본문 영역의 selector를 주면 더 정확하게 뽑힌다

matchda에선 이렇게 받은 마크다운을 그대로 LLM(Claude)에 넘겨 "직무명/자격요건/우대사항"을 구조화한다. **스크래핑 코드가 통째로 사라지고 URL 한 줄로 대체된 것**이 가장 큰 변화다.

## Step 2. Search — 검색 결과를 통째로 마크다운으로

회사명만 있고 정보가 부족할 때, 검색 결과를 긁어오는 것도 URL 하나로 된다. `https://s.jina.ai/` 뒤에 검색어를 붙인다.

```bash
curl "https://s.jina.ai/?q=matchda+채용+회사소개" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

상위 검색 결과 몇 개를 **각각 본문 마크다운까지** 정리해서 준다. 일반 검색 API가 링크·스니펫만 주는 것과 달리, 본문을 바로 LLM에 넘길 수 있는 형태라 편하다. matchda에선 공고에 안 적힌 회사 정보(규모, 도메인)를 보강하는 용도로 검토 중이다.

## Step 3. Embeddings — 이력서와 공고를 "의미"로 잇기

여기서부터가 matchda의 진짜 심장부다. 매칭은 키워드가 겹치는지가 아니라 **의미가 통하는지**로 해야 한다. "React 개발자"와 "프론트엔드 엔지니어"는 단어가 다르지만 같은 직무니까.

이때 텍스트를 벡터로 바꾸는 게 임베딩이다.

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jina-embeddings-v3",
    "input": [
      "React, TypeScript로 3년간 웹 프론트엔드 개발",
      "프론트엔드 엔지니어 — Next.js 기반 서비스 개발"
    ]
  }'
```

응답으로 각 문장의 벡터가 나온다. 이력서 벡터와 공고 벡터의 **코사인 유사도**를 구하면, 둘이 얼마나 잘 맞는지가 숫자로 나온다. 한국어·영어 섞인 이력서도 다국어 모델이라 한 번에 처리된다. matchda의 "이 공고가 당신과 82% 맞아요" 같은 지표가 여기서 나온다.

## Step 4. Reranker — 매칭 결과를 정밀하게 정렬

임베딩으로 후보 공고 100개를 추렸다고 하자. 이걸 사용자에게 보여줄 순서로 다시 정렬해야 하는데, 임베딩 유사도만으로는 미세한 순위가 아쉬울 때가 있다. 리랭커는 "질의 하나 + 후보 여러 개"를 받아 **관련도 순으로 다시 매긴다.**

```bash
curl https://api.jina.ai/v1/rerank \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jina-reranker-v2-base-multilingual",
    "query": "React 프론트엔드 3년차, 스타트업 선호",
    "documents": [
      "프론트엔드 엔지니어 (React) — 시리즈A 스타트업",
      "백엔드 개발자 (Java) — 대기업",
      "웹 퍼블리셔 — 에이전시"
    ],
    "top_n": 3
  }'
```

각 문서에 `relevance_score`가 붙어 정렬돼 나온다. matchda의 최종 매칭 리스트를 "임베딩으로 후보 추림 → 리랭커로 정밀 정렬"하는 2단 구조로 짜려는 이유가 이것이다.

## matchda가 Jina를 쓰려는 이유, 한 줄 정리

| 문제 | 기존 방식 | Jina 도입 후 |
|------|-----------|--------------|
| 공고 페이지 읽기 | Playwright + 403/Cloudflare 싸움 | Reader URL 한 줄 |
| 회사 정보 보강 | 검색 API + 본문 재크롤링 | Search 한 번 |
| 이력서-공고 매칭 | 키워드 매칭(부정확) | Embeddings 의미 매칭 |
| 결과 정렬 | 단순 점수순 | Reranker 정밀 정렬 |

결국 matchda의 파이프라인 전체가 Jina 제품 하나하나에 대응된다. 특히 **스크래핑 지옥에서 벗어나는 Reader** 하나만으로도 도입 가치가 충분했다.

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| Reader가 빈 내용 반환 | 로그인/페이월 뒤 콘텐츠 | 공개 URL만 가능. 인증 필요 페이지는 못 읽음 |
| 429 Too Many Requests | 무키 rate limit 초과 | API 키 발급해 헤더에 추가 |
| 본문에 잡다한 게 섞임 | selector 미지정 | `X-Target-Selector`로 본문 영역 지정 |
| 매칭 점수가 이상함 | 문장이 너무 김 | 이력서/공고를 항목 단위로 쪼개 임베딩 |

## 정리

- **Reader** (`r.jina.ai/<URL>`): 스크래핑을 URL 한 줄로 대체 — matchda 도입의 핵심
- **Search** (`s.jina.ai`): 검색 결과를 본문 마크다운으로
- **Embeddings** (`jina-embeddings-v3`): 이력서 ↔ 공고 의미 매칭
- **Reranker** (`jina-reranker-v2`): 매칭 결과 정밀 정렬
- Reader/Search는 키 없이도 테스트 가능, Embeddings/Reranker는 키 필요

matchda를 만들며 "채용 공고를 읽는 것"부터 "사람과 공고를 잇는 것"까지가 전부 하나의 서비스로 해결된다는 게 매력이었다. 스크래핑과 씨름하던 시간을 매칭 로직 자체에 쓸 수 있게 됐다는 것, 그게 Jina를 도입하려는 진짜 이유다.
