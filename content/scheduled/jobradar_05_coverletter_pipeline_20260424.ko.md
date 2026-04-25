---
title: 'JobRadar 개발기 5편: 자동화의 환상을 버리고 현실적인 파이프라인을 만들었다'
date: '2026-04-24'
publish_date: '2026-04-27'
description: Playwright 자동 스크래핑을 포기하고, URL 붙여넣기 → JD 스크래핑 → AI 매칭 → 커버레터 생성까지 이어지는 on-demand 파이프라인을 구축한 과정.
tags:
  - JobRadar
  - NextJS
  - Playwright
  - cheerio
  - AI
  - 사이드프로젝트
---

처음 JobRadar를 기획할 때 로드맵은 단순했다.

> "Vercel Cron으로 매일 새벽에 Indeed/Seek를 긁어오고, AI가 점수 매기고, 아침에 이메일로 받아본다."

멋있다. 근데 막상 만들어보니 현실은 달랐다.

- **Seek/Indeed 봇 차단**: User-Agent를 바꿔봤지만 403, 429가 연속으로 떴다.
- **Playwright on Vercel Lambda**: 번들 크기가 터지고, 타임아웃 10초에 ETXTBSY 에러까지 났다.
- **Cloudflare 차단**: Glassdoor는 아예 fetch조차 못 했다.

3편에서 Playwright + Vercel 조합을 어떻게든 붙여보려고 이틀을 날렸다. 결국 내린 결론은 하나였다.

> "자동 수집이 막히면 사용자가 직접 URL을 붙여넣으면 되지 않나?"

방향 전환은 오히려 단순하고 강력했다. 사용자가 관심 있는 공고만 넣으니까 쓰레기 데이터가 없고, on-demand라서 서버 비용도 거의 없다. 이번 글은 그 전환 이후 이틀 동안 만든 것들을 정리한다.

---

## 만든 것들 한눈에

| 기능 | 내용 |
|------|------|
| URL 입력 UI | 잡 목록 상단에 URL 입력창, 플랫폼 자동 감지 뱃지 |
| JD 스크래퍼 | Seek / Indeed / Glassdoor / Generic 각각 구현 |
| 즉시 파이프라인 | URL 추가 → 스크래핑 → AI 매칭 자동 순차 실행 |
| 잡 목록 UX | 드래그 순서 변경, 삭제, 재매칭 |
| 커버레터 생성 | JD + 이력서 기반 AI 생성, 편집, 클립보드 복사 |
| 이력서 경력 요약 | 이력서 텍스트 → Claude Haiku → 영문 요약 자동 입력 |

---

## Step 1. URL 입력창과 플랫폼 자동 감지

가장 먼저 만든 건 입력창이다. 사용자가 URL을 붙여넣으면 어느 사이트인지 즉시 판별해서 색상 뱃지를 보여준다.

```typescript
// src/lib/detect-platform.ts
export type Platform = 'seek' | 'indeed' | 'linkedin' | 'glassdoor' | 'other'

export function detectPlatform(url: string): Platform {
  if (url.includes('seek.com')) return 'seek'
  if (url.includes('indeed.com')) return 'indeed'
  if (url.includes('linkedin.com')) return 'linkedin'
  if (url.includes('glassdoor.com')) return 'glassdoor'
  return 'other'
}

export const PLATFORM_STYLE: Record<Platform, { label: string; className: string }> = {
  seek:      { label: 'Seek',      className: 'bg-blue-100 text-blue-700' },
  indeed:    { label: 'Indeed',    className: 'bg-yellow-100 text-yellow-700' },
  linkedin:  { label: 'LinkedIn',  className: 'bg-sky-100 text-sky-700' },
  glassdoor: { label: 'Glassdoor', className: 'bg-green-100 text-green-700' },
  other:     { label: 'Other',     className: 'bg-zinc-100 text-zinc-500' },
}
```

URL을 입력하는 순간 뱃지 색이 바뀌는 게 생각보다 UX에서 꽤 도움이 됐다. "내가 제대로 붙여넣었구나"라는 피드백.

---

## Step 2. cheerio 기반 JD 스크래퍼 구현

Playwright 없이 JD를 가져오려면 `fetch` + HTML 파싱이다. 라이브러리는 **cheerio**를 썼다. Node.js용 jQuery 같은 거라서 배우기 쉽고, 서버 번들에도 부담이 없다.

```bash
npm install cheerio
```

각 플랫폼마다 스크래핑 전략이 달랐다.

### Seek: `__NEXT_DATA__` JSON 파싱

Seek는 Next.js로 만들어져 있어서 `<script id="__NEXT_DATA__">` 안에 공고 데이터가 통째로 들어있다. HTML을 파싱하는 것보다 훨씬 깔끔하다.

```typescript
// src/lib/scrapers/seek-url.ts
const nextDataRaw = $('#__NEXT_DATA__').text()
if (nextDataRaw) {
  const nextData = JSON.parse(nextDataRaw)
  const job = nextData?.props?.pageProps?.jobDetails?.job
    ?? nextData?.props?.pageProps?.job
    ?? nextData?.props?.pageProps?.jobViewDetails

  if (job) {
    return {
      title: job.title ?? job.header?.jobTitle ?? '',
      company: job.advertiser?.description ?? job.companyName ?? '',
      // ...
    }
  }
}

// JSON 파싱 실패 시 cheerio fallback
const title = $('h1[data-automation="job-detail-title"]').text()
  || $('h1').first().text()
```

`__NEXT_DATA__` 구조는 Seek가 배포할 때마다 바뀔 수 있어서, 키 경로를 `??` 체인으로 여러 개 걸어뒀다. 그래도 안 되면 cheerio로 HTML 직접 파싱하는 fallback을 둔다.

### Indeed: JSON-LD 구조화 데이터

Indeed는 `<script type="application/ld+json">`에 `JobPosting` 스키마 데이터를 넣어준다. 표준 구조라서 파싱이 편하다.

```typescript
// src/lib/scrapers/indeed-url.ts
$('script[type="application/ld+json"]').each((_, el) => {
  const data = JSON.parse($(el).text())
  if (data['@type'] === 'JobPosting') {
    ldJob = {
      title: data.title ?? '',
      company: data.hiringOrganization?.name ?? '',
      location: data.jobLocation?.address?.addressLocality ?? '',
      description: data.description ?? '',
      posted_at: data.datePosted ?? null,
    }
  }
})
```

JSON-LD가 없으면 `data-testid` 셀렉터로 cheerio fallback.

### Generic: 3단 fallback

Seek/Indeed/LinkedIn/Glassdoor가 아닌 사이트는 순서대로 시도한다.

```
JSON-LD (JobPosting)
  → Open Graph (og:title, og:description)
    → meta 태그 (description)
```

---

## Step 3. Glassdoor 삽질기 — Cloudflare 차단 우회

Glassdoor는 Cloudflare 봇 보호가 걸려 있어서 `fetch` 자체가 안 됐다. 403도 아니고 연결이 그냥 막힌다.

처음엔 stealth 모드 테스트도 해봤다.

```javascript
// test-stealth.js (결국 폐기)
const browser = await chromium.launch({ headless: false })
// ... 결국 Cloudflare에 막힘
```

그때 URL을 자세히 보다가 발견했다.

```
/job-listing/group-product-manager-deepl-JV_IC5023222_KO0,49_KE50,55.htm
```

`KO0,49`와 `KE50,55`가 있다. KO는 직함 범위, KE는 회사명 범위를 슬러그 문자열의 인덱스로 인코딩한 거였다.

```typescript
// src/lib/scrapers/glassdoor-url.ts
export function parseGlassdoorUrl(url: string): ScrapedJob {
  const pathname = new URL(url).pathname
  const slugMatch = pathname.match(/\/job-listing\/(.+?)(?:-JV_|-GD_|\.htm)/i)
  const slug = slugMatch?.[1] ?? ''

  const koMatch = pathname.match(/_KO\d+,(\d+)/)   // 직함 끝 인덱스
  const keMatch = pathname.match(/_KE(\d+),(\d+)/) // 회사명 시작, 끝 인덱스

  if (koMatch && keMatch) {
    const titleEnd = parseInt(koMatch[1])
    const companyStart = parseInt(keMatch[1])
    const companyEnd = parseInt(keMatch[2])
    title = slug.slice(0, titleEnd).replace(/-/g, ' ')
    company = slug.slice(companyStart, companyEnd).replace(/-/g, ' ')
  }
  // ...
}
```

fetch 없이, URL만 파싱해서 제목과 회사명을 뽑아낸다. JD 전문은 못 가져오지만, 매칭에 필요한 최소한의 정보는 확보했다. 이게 가장 기억에 남는 순간이었다.

---

## Step 4. URL 추가 즉시 파이프라인

URL을 저장하는 순간 자동으로 스크래핑 → AI 매칭이 순차 실행된다. `AddJobForm`에서 단계별 상태를 보여준다.

```typescript
// 저장 → 스크래핑 → 매칭 순차 실행
const saved = await addJobUrl(formData)           // 1. DB 저장
setStatus('스크래핑 중...')
await fetch('/api/scrape-url', {                   // 2. JD 스크래핑
  method: 'POST',
  body: JSON.stringify({ jobId: saved.id, url }),
})
setStatus('AI 매칭 중...')
await matchSingleJob(saved.id)                     // 3. AI 매칭
setStatus('완료')
```

사용자 입장에서는 URL 하나 붙여넣으면 10초 안에 매칭 점수가 붙어서 나타난다.

---

## Step 5. 잡 목록 UX 개선

### 드래그로 순서 변경 (@dnd-kit)

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

```typescript
// src/components/JobList.tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (over && active.id !== over.id) {
    setItems(prev => arrayMove(prev,
      prev.findIndex(i => i.id === active.id),
      prev.findIndex(i => i.id === over.id),
    ))
  }
}
```

`arrayMove`가 인덱스 교환을 알아서 해줘서 생각보다 구현이 간단했다. 순서는 클라이언트 상태로만 관리하고 DB엔 저장하지 않았다 (MVP니까).

### 매칭 점수 클릭으로 재매칭

점수 뱃지를 클릭하면 해당 공고만 단건 재매칭된다.

```typescript
<button
  onClick={() => rematch(job.id)}
  className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200"
>
  {job.match_score ?? '미매칭'}
</button>
```

"미매칭"을 클릭하면 즉시 단건 매칭을 실행한다. 배치 매칭을 기다릴 필요가 없다.

---

## Step 6. 커버레터 생성 파이프라인

핵심 기능이다. 잡 카드에서 "커버레터" 버튼을 누르면 모달이 열리고, JD + 내 이력서를 기반으로 Claude가 커버레터를 작성해준다.

```typescript
// src/app/actions.ts - generateCoverLetter
export async function generateCoverLetter(jobId: string) {
  const [job, profile] = await Promise.all([
    getJobById(jobId),
    getMyProfile(),
  ])

  const prompt = `
당신은 채용 전문 작가입니다.

[지원자 프로파일]
${profile.experience_summary}

[채용 공고]
회사: ${job.company}
직책: ${job.title}
JD: ${job.description}

위 내용을 바탕으로 영문 커버레터를 작성해주세요.
`

  const message = await claude.messages.create({
    model: 'claude-haiku-20240307',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  await upsertCoverLetter(jobId, content)
  return { content }
}
```

모달에서는 생성된 내용을 바로 편집할 수 있고, 클립보드 복사 버튼도 있다. 재생성도 가능.

```
[커버레터 작성 모달]
┌─────────────────────────────────────┐
│ 커버레터 작성                         │
│ Senior Product Manager · Atlassian  │
├─────────────────────────────────────┤
│                                     │
│  Dear Hiring Manager,               │
│                                     │
│  I am writing to express my...      │
│  [편집 가능한 textarea]               │
│                                     │
├─────────────────────────────────────┤
│ ↺ 재생성          [클립보드 복사]    │
└─────────────────────────────────────┘
```

---

## Step 7. 이력서 기반 경력 요약 AI 자동 입력

프로파일 페이지에서 이력서를 업로드해두면, "AI 자동 입력" 버튼 하나로 경력 요약이 자동 생성된다.

```typescript
// src/app/profile/actions.ts
export async function autoFillExperience() {
  const profile = await getMyProfile()
  if (!profile.resume_text) return { error: '이력서를 먼저 업로드해주세요.' }

  const message = await claude.messages.create({
    model: 'claude-haiku-20240307',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `다음 이력서를 바탕으로 3~4문장의 영문 경력 요약을 작성해주세요:\n\n${profile.resume_text}`,
    }],
  })

  const summary = message.content[0].type === 'text' ? message.content[0].text : ''
  await updateExperienceSummary(summary)
  return { summary }
}
```

이 요약이 커버레터 생성 프롬프트에 들어가기 때문에, 요약 품질이 커버레터 품질을 직접 결정한다.

---

## 트러블슈팅

### Glassdoor KO/KE 파라미터가 없는 URL

일부 Glassdoor URL은 KO/KE 인코딩이 없다. 이 경우 슬러그의 마지막 단어를 회사명으로 추정하는 fallback이 동작한다. 정확도가 떨어지지만 "파싱 불가"보다는 낫다.

```typescript
// KO/KE 없을 때 fallback
company = parts[parts.length - 1] ?? ''
title = parts.slice(0, -1).join(' ')
```

### Seek `__NEXT_DATA__` 구조 변경

Seek는 배포할 때마다 `pageProps` 하위 키가 바뀌는 경우가 있다. `??` 체인으로 여러 경로를 시도하고, 그래도 안 되면 cheerio fallback이 동작한다. 스크래핑 실패 시 에러 메시지를 DB에 저장하고 카드에 표시하도록 해서 디버깅이 쉬워졌다.

### Vercel 서버리스 함수 타임아웃

스크래핑 + AI 매칭을 순차 실행하면 10초를 넘길 수 있다. `next.config.js`에서 API 라우트 타임아웃을 늘리거나, 스크래핑과 매칭을 분리해서 호출하는 방식으로 해결했다.

---

## 전체 파이프라인 한눈에

```
사용자가 URL 붙여넣기
        ↓
플랫폼 자동 감지 (Seek/Indeed/Glassdoor/Other)
        ↓
DB에 저장 (제목/URL/플랫폼)
        ↓
/api/scrape-url 호출
  ├── Seek    → __NEXT_DATA__ JSON 파싱 → cheerio fallback
  ├── Indeed  → JSON-LD → cheerio fallback
  ├── Glassdoor → URL 슬러그 파싱 (KO/KE 인코딩)
  └── Generic → JSON-LD → Open Graph → meta 태그
        ↓
AI 매칭 (Claude Sonnet, 0~100점 + 매칭 근거)
        ↓
잡 카드에 점수 표시
        ↓
"커버레터" 버튼 클릭
        ↓
JD + 이력서 기반 AI 커버레터 생성
        ↓
편집 → 클립보드 복사
```

---

## 정리

처음에 Playwright 자동화를 고집했을 때는 "봇 차단쯤이야 User-Agent 바꾸면 되지"라고 생각했다. 하지만 Cloudflare는 그렇게 호락호락하지 않았고, Vercel Lambda 환경도 생각보다 제약이 많았다.

on-demand 방식으로 바꾸면서 오히려 코드가 단순해졌다. 배치 스케줄러도 없고, 에러 재시도 로직도 없고, 그냥 "요청이 오면 처리한다"다. Glassdoor 삽질에서 배운 것처럼, 막히면 다른 방법을 찾으면 된다. URL 슬러그에 답이 있었던 것처럼.

다음 편에서는 이메일 다이제스트 — 매일 아침 저장한 공고 중 매칭 점수 높은 것들을 Resend로 이메일 발송하는 기능을 만들 예정이다.

---

*JobRadar 개발기 시리즈*
- [1편: Next.js + Supabase 프로젝트 셋업](jobradar_01_setup_20260420.ko.md)
- [2편: cheerio 기반 JD 스크래퍼 첫 시도](jobradar_02_scraper_20260421.ko.md)
- [3편: Playwright + Vercel의 현실](jobradar_03_vercel_playwright_20260422.ko.md)
- [4편: URL 입력 방식으로 전환](jobradar_04_url_scraper_20260423.ko.md)
- **5편: on-demand 파이프라인 완성 (현재)**
