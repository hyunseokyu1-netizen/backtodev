---
title: 'JobRadar 4편: Playwright 버리고 cheerio로 갈아탄 이유 — 4일차 방향 전환기'
date: '2026-04-23'
publish_date: '2026-04-26'
description: 3일 동안 Playwright와 씨름하다 포기했다. 4일차에 접어들어 방향을 완전히 바꿨다. 자동 수집 대신 URL 기반 on-demand 스크래핑, cheerio + JSON-LD 구현까지.
tags:
  - JobRadar
  - cheerio
  - 스크래핑
  - Vercel
---

3편까지의 이야기를 한 줄로 요약하면 이렇다.

> Playwright + Vercel = 3일 동안 에러만 봤다.

`@sparticuz/chromium`으로 겨우 배포에 성공했는데, 막상 긁어온 공고를 확인하니 봇 감지를 완전히 피하지 못했다. 그리고 더 근본적인 문제가 있었다.

**매일 Cron으로 대량 수집해봤자, 내가 관심 없는 공고가 대부분이었다.**

4일차에 접어들면서 생각을 바꿨다.

---

## 왜 바꿨나

### 봇 차단 — 지쳐가는 싸움

Playwright로 headless Chrome을 띄워도 Cloudflare나 자체 봇 감지에 걸리는 경우가 잦았다. User-Agent 바꾸고, stealth 수동 설정하고, 딜레이 넣고... 이걸 반복하다 보면 이걸 왜 하고 있나 싶어진다.

### Vercel Lambda — Playwright가 살기 너무 힘든 환경

3편에서 겪은 문제들만 정리해도 이렇다:

| 문제 | 내용 |
|------|------|
| 번들 크기 | Playwright + Chromium은 수백 MB |
| 실행 시간 | 브라우저 기동 + 스크래핑이 60초 초과하기 쉬움 |
| `ETXTBSY` | Lambda에서 Chromium 바이너리 동시 실행 충돌 |
| 봇 감지 | stealth 제거 후 완전한 대응 어려움 |

### 결론

"자동 수집"의 낭만을 버리기로 했다.

생각해보면 — 내가 실제로 지원하고 싶은 공고는 내가 직접 보고 판단한다. 랜덤으로 수집된 100개보다 내가 고른 10개가 훨씬 낫다.

```
기존: Cron → Playwright → 대량 수집 → DB
변경: 사용자 URL 입력 → fetch + cheerio → 단건 스크래핑 → DB
```

on-demand 방식으로 전환. 서버 부하도 없고, Lambda 제약도 없다.

---

## 구현 개요

```
[URL 입력창] → addJobByUrl() → jobs 테이블에 저장
                                     ↓
                           /api/scrape-url 자동 호출
                                     ↓
                    플랫폼 감지 → 전용 스크래퍼 실행
                                     ↓
                           title, company, description 등 업데이트
```

---

## Step 1 — 플랫폼 자동 감지 유틸

URL만 보고 어느 사이트인지 알아야 스크래퍼를 분기할 수 있다.

```typescript
// src/lib/detect-platform.ts
export type Platform = 'seek' | 'indeed' | 'linkedin' | 'other'

const PLATFORM_PATTERNS: { platform: Platform; pattern: RegExp }[] = [
  { platform: 'seek',     pattern: /seek\.com\.au/i },
  { platform: 'indeed',  pattern: /indeed\.com/i },
  { platform: 'linkedin', pattern: /linkedin\.com\/jobs/i },
]

export function detectPlatform(url: string): Platform {
  for (const { platform, pattern } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform
  }
  return 'other'
}

export const PLATFORM_STYLE: Record<Platform, { label: string; className: string }> = {
  seek:     { label: 'Seek',     className: 'bg-blue-100 text-blue-700' },
  indeed:   { label: 'Indeed',   className: 'bg-orange-100 text-orange-700' },
  linkedin: { label: 'LinkedIn', className: 'bg-sky-100 text-sky-700' },
  other:    { label: 'Other',    className: 'bg-zinc-100 text-zinc-500' },
}
```

플랫폼별 뱃지 색상까지 같이 정의해 뒀다. UI에서 `PLATFORM_STYLE[source].className`만 꺼내 쓰면 된다.

---

## Step 2 — URL 입력 폼 (AddJobForm)

잡 목록 상단에 URL 입력창을 붙였다. 붙여넣고 추가 누르면 끝.

```tsx
'use client'

export default function AddJobForm() {
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData()
    fd.append('url', url)
    const result = await addJobByUrl(fd)

    if (result.error) {
      setLoading(false)
      return
    }

    // DB 저장 후 즉시 스크래핑 트리거
    if (result.jobId) {
      await fetch('/api/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: result.jobId }),
      })
    }

    setLoading(false)
    setUrl('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="채용공고 URL 붙여넣기 (Seek, Indeed, LinkedIn...)"
        disabled={loading}
      />
      <button type="submit" disabled={loading || !url}>
        {loading ? '추가 중...' : '추가'}
      </button>
    </form>
  )
}
```

저장(`addJobByUrl`)과 스크래핑(`/api/scrape-url`)을 분리한 이유: 저장은 빠르게 하고, 스크래핑은 실패해도 나중에 재시도할 수 있게.

---

## Step 3 — Seek 스크래퍼: `__NEXT_DATA__` 파싱

Seek은 Next.js로 만들어져 있어서 페이지 HTML 안에 `<script id="__NEXT_DATA__">` 태그가 있다. 서버사이드 props가 JSON으로 통째로 들어있어서, 이걸 파싱하면 DOM 셀렉터 없이 깔끔하게 데이터를 꺼낼 수 있다.

```typescript
export async function scrapeSeekUrl(url: string): Promise<ScrapedJob> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-AU,en;q=0.9',
    },
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  // 1순위: __NEXT_DATA__ JSON 파싱
  const nextDataRaw = $('#__NEXT_DATA__').text()
  if (nextDataRaw) {
    const nextData = JSON.parse(nextDataRaw)
    const job = nextData?.props?.pageProps?.jobDetails?.job
      ?? nextData?.props?.pageProps?.job
      ?? nextData?.props?.pageProps?.jobViewDetails

    if (job) {
      return {
        title:       job.title ?? job.header?.jobTitle ?? '',
        company:     job.advertiser?.description ?? job.companyName ?? '',
        location:    job.location ?? job.locationLabel ?? '',
        description: job.content ?? job.description ?? '',
        posted_at:   job.listingDate ?? null,
      }
    }
  }

  // 2순위: cheerio fallback
  const title = $('h1[data-automation="job-detail-title"]').text() || $('h1').first().text()
  // ...
}
```

`??` 체이닝이 많은 이유: Seek의 JSON 구조가 공고 유형에 따라 다르기 때문이다. 어느 경로에 데이터가 있는지 공고마다 달라서 다 체크해야 한다.

---

## Step 4 — Indeed 스크래퍼: JSON-LD 구조화 데이터

Indeed는 `<script type="application/ld+json">` 태그에 `JobPosting` 스키마로 데이터를 넣어둔다. Google SEO 목적으로 넣어둔 걸 그대로 활용하는 거다.

```typescript
export async function scrapeIndeedUrl(url: string): Promise<ScrapedJob> {
  const $ = cheerio.load(html)

  let ldJob: ScrapedJob | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (ldJob) return
    try {
      const data = JSON.parse($(el).text())
      if (data['@type'] === 'JobPosting') {
        ldJob = {
          title:       data.title ?? '',
          company:     data.hiringOrganization?.name ?? '',
          location:    data.jobLocation?.address?.addressLocality ?? '',
          description: data.description ?? '',
          posted_at:   data.datePosted ?? null,
        }
      }
    } catch { /* JSON 파싱 실패 시 다음으로 */ }
  })
  if (ldJob) return ldJob

  // 2순위: cheerio fallback
}
```

사이트 UI가 바뀌어도 구조화 데이터는 유지되는 경우가 많아서 DOM 파싱보다 훨씬 안정적이다.

---

## Step 5 — Generic 스크래퍼: 단계적 fallback

LinkedIn이나 그 외 사이트는 하나의 Generic 스크래퍼로 처리한다. JSON-LD → Open Graph → meta 태그 순서로 시도한다.

```typescript
export async function scrapeGenericUrl(url: string): Promise<ScrapedJob> {
  const $ = cheerio.load(html)

  // 1순위: JSON-LD JobPosting
  // ...

  // 2순위: Open Graph 메타 태그
  const ogTitle = $('meta[property="og:title"]').attr('content') ?? ''
  const ogDesc  = $('meta[property="og:description"]').attr('content')
    ?? $('meta[name="description"]').attr('content') ?? ''

  // description은 페이지에서 가장 긴 텍스트 블록으로
  let description = ogDesc
  if (!description) {
    let maxLen = 0
    $('div, article, section').each((_, el) => {
      const text = $(el).text().trim()
      if (text.length > maxLen) { maxLen = text.length; description = text }
    })
  }

  return {
    title: ogTitle.trim(),
    description: description.slice(0, 5000),
    // ...
  }
}
```

---

## Step 6 — /api/scrape-url API Route

```typescript
export const maxDuration = 30  // Playwright 기반 300초에서 30초로 줄었다

export async function POST(request: Request) {
  const { jobId } = await request.json()
  const { data: job } = await supabaseAdmin
    .from('jobs').select('id, url, source').eq('id', jobId).single()

  try {
    const source = job.source as Platform
    const scraped =
      source === 'seek'   ? await scrapeSeekUrl(job.url) :
      source === 'indeed' ? await scrapeIndeedUrl(job.url) :
                            await scrapeGenericUrl(job.url)

    await supabaseAdmin.from('jobs').update({
      title:       scraped.title,
      company:     scraped.company,
      description: scraped.description,
      scraped_at:  new Date().toISOString(),
    }).eq('id', job.id)

    return NextResponse.json({ ok: true, title: scraped.title })
  } catch (e) {
    await supabaseAdmin.from('jobs').update({ title: '스크래핑 실패' }).eq('id', job.id)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
```

`maxDuration = 30`으로 설정했는데, fetch + cheerio는 대부분 3~5초 안에 끝난다. 3편에서 300초를 써도 불안하던 것과 비교하면 완전히 딴 세상이다.

---

## 플랫폼별 전략 요약

| 플랫폼 | 1순위 전략 | 2순위 fallback |
|--------|-----------|----------------|
| Seek | `__NEXT_DATA__` JSON 파싱 | cheerio DOM 셀렉터 |
| Indeed | JSON-LD (`JobPosting` 스키마) | cheerio DOM 셀렉터 |
| LinkedIn / Other | JSON-LD (`JobPosting` 스키마) | Open Graph / meta 태그 |

---

## 트러블슈팅

**fetch가 403을 반환하는 경우**

User-Agent를 실제 브라우저처럼 설정하는 것만으로 상당수 해결된다.

```typescript
headers: {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
  'Accept-Language': 'en-AU,en;q=0.9',
}
```

**`__NEXT_DATA__` 경로가 달라지는 경우**

Seek의 JSON 구조는 공고 유형에 따라 달라진다. `??` 체이닝으로 여러 경로를 커버하는 것 외에 방법이 없다.

**JSON-LD 파싱 실패**

`JSON.parse`를 `try-catch`로 감싸고, 실패하면 다음 전략으로 넘어가게 했다. JSON-LD가 있어도 불완전한 경우가 있어서 파싱 성공 + 필수 필드 체크까지 같이 해줘야 한다.

---

## 정리 — 핵심 흐름 한눈에

```
사용자 URL 붙여넣기
    ↓
detectPlatform(url) → 'seek' | 'indeed' | 'other'
    ↓
DB에 저장 (jobId 반환)
    ↓
POST /api/scrape-url { jobId }
    ↓
플랫폼별 스크래퍼 실행
  Seek:    __NEXT_DATA__ → cheerio
  Indeed:  JSON-LD → cheerio
  Generic: JSON-LD → Open Graph → meta
    ↓
DB 업데이트 (title, company, description ...)
```

3일 동안 Playwright와 씨름하다가 방향을 바꿨는데, 결과적으로 코드가 더 단순해지고 Vercel에서도 아무 문제 없이 돌아간다.

자동 수집이 더 멋있어 보이지만, 실용성은 반대인 경우도 있다. 내가 직접 고른 공고 10개가 자동 수집된 100개보다 훨씬 유용하다는 걸 4일차에 깨달았다.

다음 단계는 이렇게 쌓인 공고들을 Claude API로 매칭하는 것이다. 5편에서 계속.
