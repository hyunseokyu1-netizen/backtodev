---
title: "Fixing Inherited Code (3/5): Why You Can't Trust a User-Supplied URL"
date: '2026-07-17'
publish_date: '2026-12-18'
description: Closing an SSRF hole in a feature that fetches user-submitted job page URLs, and building out the background auto-scrape cron job
tags:
  - SSRF
  - Security
  - Vercel Cron
  - Next.js
---

## "Isn't It Enough if the URL Is Just... Valid?"

MatchDa has a feature where you register the URL of a company's careers page, and the server fetches that page and extracts job postings from it. Up until now, this was the entirety of its URL validation.

```ts
try {
  new URL(url)
} catch {
  return { error: '유효하지 않은 URL입니다.' }
}
```

As long as `new URL()` could parse it, it passed. But that's only a format check — it never verifies **where the request actually goes.** If someone registers `http://169.254.169.254/latest/meta-data/` (a cloud metadata address) as their careers page, our server will happily send a request straight to it. That's SSRF (Server-Side Request Forgery).

## Why This Is Dangerous

MatchDa fetches user URLs through three different paths.

1. A direct `fetch()` — fast, but weak against bot blocking
2. A headless browser (Playwright) — for bypassing Cloudflare challenges
3. A reader proxy (r.jina.ai) — the last fallback

All three paths use the user-supplied URL as the destination, unmodified. If this server runs on the cloud (Vercel → AWS Lambda), that means an outside party could trigger a request capable of reaching an internal network or a metadata endpoint.

## Defense Design: at Registration, at Request Time, and on Every Redirect

The most common mistake is assuming "checking once at registration time should be enough." Two bypass scenarios explain exactly why that's not enough.

**Scenario 1 — a domain that looks public on the surface.** Say someone registers `evil.com`, but has rigged its DNS so the A record points to `169.254.169.254`. There's no way to catch that just by looking at the URL string. **You only find out by actually resolving the DNS.**

**Scenario 2 — bypassing via redirect.** The URL looked perfectly public at registration time, but when the request is actually made, the server issues a 302 redirect to an internal address. `fetch()`'s default behavior (`redirect: 'follow'`) will happily follow it.

So I put up three layers of defense.

### 1. Classify IP Ranges

```ts
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  const [a, b] = parts
  return (
    a === 0 ||                            // 0.0.0.0/8
    a === 10 ||                           // 10.0.0.0/8 사설
    a === 127 ||                          // 127.0.0.0/8 루프백
    (a === 100 && b >= 64 && b <= 127) ||  // 100.64.0.0/10 CGNAT
    (a === 169 && b === 254) ||           // 169.254.0.0/16 링크로컬 (메타데이터 포함!)
    (a === 172 && b >= 16 && b <= 31) ||   // 172.16.0.0/12 사설
    (a === 192 && b === 168) ||           // 192.168.0.0/16 사설
    a >= 224                              // 멀티캐스트 + 예약 + 브로드캐스트
  )
}
```

I handled IPv6 with the same logic. The interesting case was IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`) — `new URL()` normalizes these into hex-group notation (`::ffff:7f00:1`), so I had to catch both the dotted-decimal form and the hex form.

### 2. Re-Check After DNS Resolution

```ts
export async function findUrlViolationWithDns(raw: string): Promise<string | null> {
  const policyError = findUrlPolicyViolation(raw) // 형식·리터럴 IP 먼저
  if (policyError) return policyError

  const host = new URL(raw).hostname
  if (isIP(host)) return null

  const addrs = await lookup(host, { all: true, verbatim: true })
  if (addrs.some(a => isPrivateIp(a.address))) {
    return '내부 네트워크로 연결되는 주소는 사용할 수 없어요.'
  }
  return null
}
```

`{ all: true }` is the crucial part. A domain can have multiple A records, and if **even one** of them is a private IP, it has to be blocked. This closes off the bypass where someone mixes a public IP with a private one.

### 3. Follow Redirects Manually and Re-Verify Every Hop

This was the most labor-intensive part. I turned off `fetch()`'s automatic redirect handling and ran my own loop, verifying every single hop.

```ts
async function fetchWithGuard(url: string, headers: Record<string, string>): Promise<Response> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current)  // 홉마다 DNS까지 재검증
    const res = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(20_000) })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return res
      current = new URL(location, current).toString()
      continue
    }
    return res
  }
  throw new UrlGuardError('리다이렉트가 너무 많습니다.')
}
```

To confirm this logic actually blocks the bypass, I wrote a test that mocks `fetch`.

```ts
it('공개 URL → 내부 주소 리다이렉트를 홉 검증에서 차단', async () => {
  fetchMock.mockImplementation(async (input) => {
    if (String(input).includes('evil.example.com')) {
      return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/' } })
    }
  })
  await expect(fetchHtml('https://evil.example.com/jobs')).rejects.toThrow()
  // 핵심 검증: 내부 주소로는 fetch 자체가 호출되지 않아야 한다
  expect(fetchMock.mock.calls.some(c => String(c[0]).includes('169.254'))).toBe(false)
})
```

It's not enough to just confirm "an error occurred" — you need to confirm **"a request never actually went out to the internal address"** in the first place. Even a convincing error message is a failed defense if packets had already gone out to the internal network before it.

## Don't Forget the Headless Browser and the Proxy

Fixing only `fetchHtml` isn't the end of it. Sites with strong bot protection automatically fall back to a headless browser (Playwright) or an external reader proxy, and those paths receive the exact same user URL.

```ts
export async function fetchHtmlWithBrowser(url: string): Promise<string> {
  await assertPublicUrl(url) // 브라우저 기동 전에 먼저 검증

  const browser = await chromium.launch({ ... })
  const page = await browser.newPage()

  // 페이지 안의 JS가 유발하는 서브요청도 내부 주소면 차단
  await page.route('**/*', route => {
    const violation = findUrlPolicyViolation(route.request().url())
    if (violation) return route.abort()
    return route.continue()
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  return await page.content()
}
```

There's a tradeoff here. The check on sub-requests inside the page does **only a synchronous policy check, no DNS lookup.** Doing a DNS lookup on every single request would make page rendering painfully slow. It's not a perfect defense — it still can't catch A-record manipulation on an attacker-owned domain — but since the initial `page.goto` navigation does verify through DNS, the practical risk is cut down significantly. **Security is always a string of these kinds of tradeoffs.**

## While I Was at It: I Also Built the Auto-Scrape Cron

While doing this work, I noticed something. The landing page claims that registering a company you're interested in will **automatically collect** new postings, but in reality, updates only happened when the user manually pressed the collect button. The copy was lying.

Since I was already building the SSRF defenses, I went ahead and added real background auto-scraping too. A Vercel Cron job sweeps through registered sources once a day.

```ts
// vercel.json
{
  "crons": [{ "path": "/api/cron/scrape-sources", "schedule": "0 20 * * *" }]
}
```

Failure handling mattered a lot here. If the cron just kept retrying a failing source every time, it would burn resources for nothing. So I added exponential backoff.

```ts
function backoffUntil(failures: number): string {
  const delay = Math.min(SCRAPE_INTERVAL_MS * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_MS)
  return new Date(Date.now() + delay).toISOString()
  // 24h → 48h → 96h → ... 최대 7일
}
```

After 5 consecutive failures, auto-scraping stops entirely and the user sees an "auto-scrape stopped" indicator — so it doesn't keep retrying a dead careers page forever.

There was also a concurrency issue. If cron runs overlap, the same source could get scraped twice, so I prevented that with a database-level lock.

```ts
const { data: locked } = await supabaseAdmin
  .from('job_sources')
  .update({ scrape_lock_at: nowIso })
  .eq('id', source.id)
  .or(`scrape_lock_at.is.null,scrape_lock_at.lt.${staleBefore}`)
  .select('id')
if (!locked?.length) continue // 다른 실행이 이미 잠갔으면 건너뛴다
```

A single PostgREST `UPDATE` is atomic at the row level, so even if two runs try to grab the same source at the same time, only one succeeds. It becomes a compare-and-swap pattern without needing a separate distributed lock.

## Summary — the SSRF Checklist

If you're building a feature where the server requests a user-supplied URL, check at least this much.

- [ ] Only allow `http`/`https` (block `file://`, `gopher://`, etc.)
- [ ] Reject URLs that include credentials (`user:pass@host`)
- [ ] Block private/loopback/link-local/metadata ranges for literal IPs
- [ ] For domains, re-check for private IPs **after DNS resolution** (across all A records)
- [ ] Follow redirects manually and re-verify on **every hop**
- [ ] Set a request timeout and a response-size cap
- [ ] Apply the same policy to fallback paths too (headless browser, proxy)

The next post is a bit of an embarrassing one — after hardening security this thoroughly, it turns out the UI still had buttons that did absolutely nothing when clicked.
