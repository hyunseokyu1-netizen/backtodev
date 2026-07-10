---
title: '봇 차단에 막힌 채용공고 스크래핑, 3단 폴백으로 뚫기 (직접 fetch → stealth 브라우저 → 리더 프록시 + AI 추출)'
date: '2026-07-03'
publish_date: '2026-07-30'
description: Seek의 Kasada 봇 차단 때문에 403만 받던 공고 수집을 r.jina.ai 리더 프록시와 Claude Haiku 구조화 추출로 살려낸 과정과, "차단"과 "만료"를 헷갈려 헤맨 디버깅 기록
tags:
  - 스크래핑
  - Jina AI
  - Claude API
  - Playwright
  - Next.js
---

> **MatchDa 개발기 시리즈 (1/3)**
> 하루치 커밋 4개를 풀어 쓴 시리즈입니다.
> **1편: 봇 차단 스크래핑 3단 폴백 (이 글)** · 2편: React 자동완성 칩 입력 직접 만들기 · 3편: 리브랜딩 마이그레이션에서 놓친 화면 찾기

## 로컬 IP에서도 403이 뜬다

호주 구직 사이트 **Seek**의 채용공고를 수집하는 기능이 어느 날부터 완전히 죽었다. 처음엔 "Vercel 데이터센터 IP라 막혔겠지" 했는데, 로컬 맥북에서 curl을 날려봐도 똑같이 **403**이 돌아왔다.

```bash
curl -I "https://www.seek.com.au/job/12345678"
# HTTP/2 403
```

Seek은 **Kasada**라는 상용 봇 차단 솔루션을 쓴다. Cloudflare 챌린지 수준이 아니라, 브라우저 핑거프린팅 + JS 챌린지를 통과해야 본문을 내준다. 그래서 이런 것들이 전부 막힌다.

| 시도 | 결과 |
|---|---|
| `fetch` / `curl` (헤더 위장 포함) | 403 |
| Playwright 헤드리스 | 403 또는 빈 페이지 |
| playwright-extra + stealth 플러그인 | 간헐적 성공, 대부분 차단 |

여기서 선택지는 두 가지였다. 유료 스크래핑 API(월 구독)를 쓰거나, 다른 우회로를 찾거나.

## 우회로: 리더 프록시 + AI 추출

찾은 답은 **r.jina.ai 리더 프록시**였다. URL 앞에 `https://r.jina.ai/`만 붙이면, Jina 쪽 브라우저 팜이 페이지를 대신 렌더링해서 **마크다운으로 변환한 결과**를 돌려준다. 봇 차단을 내가 뚫는 게 아니라, 이미 뚫는 인프라를 가진 쪽에 위임하는 것이다.

다만 돌려받는 건 구조화된 JSON이 아니라 페이지 전체 마크다운이다. 네비게이션, 푸터, 추천 공고까지 섞여 있다. 그래서 한 단계를 더 붙였다. **마크다운을 Claude Haiku에게 주고 공고 필드만 JSON으로 추출**하게 했다.

최종 구조는 3단 폴백이다.

```
1단: 직접 fetch (가장 싸고 빠름)
  └ 실패 → 2단: stealth 헤드리스 브라우저
      └ 실패 → 3단: 리더 프록시(r.jina.ai) + Haiku 구조화 추출
```

싼 방법부터 시도하고, 비싼 방법은 최후에만 쓴다. 대부분의 사이트는 1단에서 끝나므로 비용은 거의 늘지 않는다.

## Step 1: 리더 프록시 fetcher

```ts
// src/lib/scrapers/reader.ts
export async function fetchReaderMarkdown(url: string): Promise<string> {
  const headers: Record<string, string> = { 'X-Return-Format': 'markdown' }
  // 키가 있으면 요청 한도가 크게 늘어난다 (없어도 저빈도 사용은 동작)
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`

  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`리더 프록시 실패: ${res.status}`)

  const text = await res.text()
  // 차단·에러 페이지가 그대로 변환된 경우 방어 (정상 공고면 본문이 이보다 길다)
  if (text.trim().length < 200) throw new Error('리더 프록시가 빈 내용을 반환했습니다.')
  return text
}
```

포인트 세 가지:

- `X-Return-Format: markdown` — HTML이 아니라 마크다운으로 받는다. LLM에 넣기 좋다
- `AbortSignal.timeout(45_000)` — 프록시 쪽 렌더링이 느릴 수 있어 타임아웃을 넉넉히
- **길이 방어** — 차단 페이지도 "마크다운 변환은 성공"으로 돌아오므로, 내용이 너무 짧으면 실패 처리

## Step 2: Haiku로 구조화 추출

마크다운에서 필드를 뽑는 건 정규식으로는 무리다. 사이트마다 구조가 다르고, 리더 프록시 출력은 셀렉터가 없는 평문이기 때문이다. 이럴 때가 소형 모델이 제일 잘하는 일이다.

```ts
const message = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 3000,
  messages: [{
    role: 'user',
    content: `아래는 채용공고 페이지를 마크다운으로 변환한 것입니다. 공고 정보를 추출해 JSON으로만 응답하세요.

형식: {"title": "직무명", "company": "회사명", "location": "근무지", "salary": "급여(없으면 null)", "description": "JD 본문 전체(평문, 원어 유지)", "posted_at": "게시일 ISO 날짜(없으면 null)"}

규칙:
- description 은 JD 본문을 최대한 온전히 담을 것 (네비게이션·푸터·추천 공고 제외)
- JD 본문이 없더라도 문서 상단의 "Title:" 줄에서 직무명·근무지를 알 수 있으면 title/location 을 채우고 description 은 "" 로 둘 것
- 채용공고와 무관한 페이지면 {"title": ""} 만 출력

마크다운:
${markdown.slice(0, 40_000)}`,
  }],
})
```

프롬프트에서 신경 쓴 부분:

1. **"JSON으로만 응답"** + 응답에서 `{...}` 정규식 매칭 — 잡담이 섞여도 파싱 가능
2. **Title 줄 구제 규칙** — 뒤에서 설명할 만료 공고 때문에 넣은 규칙. 본문이 없어도 `"Senior Engineer Job in Sydney NSW - SEEK"` 같은 페이지 타이틀에서 직무명과 근무지는 건질 수 있다
3. **`slice(0, 40_000)`** — 마크다운이 아무리 길어도 입력 비용 상한을 고정

## Step 3: API 라우트에 폴백 연결

기존 스크래퍼가 어떤 이유로든 throw하면 리더 폴백으로 넘어간다.

```ts
// src/app/api/scrape-url/route.ts
let scraped
try {
  scraped =
    source === 'seek'   ? await scrapeSeekUrl(job.url) :
    source === 'indeed' ? await scrapeIndeedUrl(job.url) :
                          await scrapeGenericUrl(job.url)
} catch (directError) {
  console.warn(`[scrape-url] 직접 수집 실패, 리더 프록시로 우회: ${job.url}`)
  scraped = await scrapeJobViaReader(job.url)
}
```

그리고 저장할 때 한 줄이 중요하다.

```ts
// 리더 폴백이 제목만 건진 경우(빈 JD), 기존/수동 입력 JD를 지우지 않는다
description: scraped.description || job.description || null,
```

폴백이 title만 건지고 description이 빈 문자열일 수 있는데, 이걸 그대로 저장하면 **유저가 수동으로 붙여넣은 JD를 빈 값으로 덮어쓰는** 사고가 난다. 폴백 경로는 항상 "기존 데이터보다 나쁜 결과로 덮어쓰지 않는가"를 점검해야 한다.

Vercel 함수 타임아웃도 폴백 시간을 감안해 올렸다.

```ts
export const maxDuration = 90  // 리더 프록시(최대 45초) + Haiku 추출 감안
```

## 디버깅 반전: 차단당한 게 아니라 만료된 거였다

여기서 이 글의 진짜 교훈이 나온다.

폴백을 다 만들고 테스트했는데, 리더 프록시로 받아온 마크다운에 JD가 없었다. "리더 프록시도 Kasada에 막히나?" 하고 한참 헤맸는데, 마크다운을 직접 읽어보니 이런 내용이 있었다.

> This job is no longer advertised

**테스트에 쓴 공고가 만료된 공고였다.** Seek은 만료 공고에 `expiredJobPage`를 보여주는데, 차단 페이지와 만료 페이지 모두 "JD가 없다"는 증상은 동일하다. 원인은 완전히 다른데 말이다.

| 증상 | 차단 (403) | 만료 (expiredJobPage) |
|---|---|---|
| JD 본문 | 없음 | 없음 |
| HTTP 상태 | 403 | **200** |
| 페이지 타이틀 | 챌린지 문구 | **직무명·근무지 포함** |

살아있는 공고로 다시 테스트하니 리더 프록시로 **JD 전문까지 깔끔하게** 수집됐다. 처음부터 응답 본문을 읽어봤으면 30분은 아꼈을 것이다. "안 된다"는 결과가 같아도 원인이 다르면 대응도 달라진다 — 차단이면 우회를, 만료면 타이틀에서 직무명이라도 구제하고 상태를 표시해야 한다. 위 프롬프트의 "Title 줄 구제 규칙"이 바로 이 경험에서 나왔다.

## 프로덕션 검증

로컬에서 되는 것과 Vercel에서 되는 것은 다르다(특히 스크래핑은). 배포 후 실제 살아있는 Seek 공고를 API로 등록해 확인했다.

- 직접 fetch 403 → 리더 프록시 폴백 발동
- **13초 만에** 제목·회사·근무지·**JD 4,291자** 수집 성공
- DB에 정상 저장, 기존 데이터 덮어쓰기 없음

## 정리

```
직접 fetch (0원, ~1초)
  → 실패 시 stealth 브라우저 (무료, ~5초, 성공률 낮음)
    → 실패 시 리더 프록시 + Haiku (소액, ~15초, 성공률 높음)
```

- 봇 차단은 정면 돌파보다 **렌더링을 위임**하는 게 유지보수가 싸다
- 비정형 텍스트 → 구조화 JSON은 **소형 LLM(Haiku)** 이 정규식보다 견고하다
- 폴백 결과가 **기존 데이터를 덮어쓰지 않게** 방어하라
- "안 된다"의 원인을 확인하라 — **차단과 만료는 증상이 같고 원인이 다르다**

다음 편에서는 같은 날 만든 React 자동완성 칩 입력 컴포넌트 이야기를 다룬다.
