---
title: '인수받은 코드 개선하기 (3/5) — 유저가 준 URL을 그대로 믿으면 안 되는 이유'
date: '2026-07-17'
publish_date: '2026-09-16'
description: 유저가 등록한 채용페이지 URL을 서버가 요청할 때 생기는 SSRF 취약점을 막고, 백그라운드 자동 수집 크론을 만든 기록
tags:
  - SSRF
  - 보안
  - Vercel Cron
  - Next.js
---

## "URL만 유효하면 되는 거 아닌가?"

매치다에는 관심 있는 회사의 채용페이지 URL을 등록하면 서버가 그 페이지를 가져와서 공고를 추출하는 기능이 있다. 지금까지 URL 검증이라곤 이게 전부였다.

```ts
try {
  new URL(url)
} catch {
  return { error: '유효하지 않은 URL입니다.' }
}
```

`new URL()`이 파싱만 성공하면 통과. 그런데 이건 형식 검사일 뿐, **어디로 요청이 나가는지**는 전혀 확인하지 않는다. 누군가 `http://169.254.169.254/latest/meta-data/`(클라우드 메타데이터 주소)를 채용페이지로 등록하면, 우리 서버가 그대로 그 주소에 요청을 보낸다. 이게 SSRF(Server-Side Request Forgery)다.

## 왜 위험한가

매치다는 유저 URL을 세 가지 경로로 요청한다.

1. 직접 `fetch()` — 빠르지만 봇 차단에 약함
2. 헤드리스 브라우저(Playwright) — Cloudflare 챌린지 우회용
3. 리더 프록시(r.jina.ai) — 마지막 우회 수단

세 경로 모두 유저가 준 URL을 그대로 목적지로 쓴다. 만약 이 서버가 클라우드(Vercel → AWS Lambda) 위에서 돈다면, 내부 네트워크나 메타데이터 엔드포인트에 접근할 수 있는 요청을 외부인이 트리거할 수 있다는 뜻이다.

## 방어 설계: 등록 시점 + 요청 시점 + 리다이렉트마다

가장 흔한 실수는 "등록할 때 한 번만 검사하면 되겠지"라고 생각하는 거다. 이게 왜 부족한지 두 가지 우회 시나리오로 설명할 수 있다.

**시나리오 1 — 겉보기엔 공개 도메인.** `evil.com`이라는 도메인을 등록했는데, 이 도메인의 A 레코드가 `169.254.169.254`를 가리키도록 DNS를 조작해뒀다면? URL 문자열만 봐선 절대 못 잡는다. **DNS 해석까지 해봐야** 안다.

**시나리오 2 — 리다이렉트로 우회.** 등록 시점엔 멀쩡한 공개 URL이었는데, 실제 요청했을 때 서버가 302로 내부 주소로 리다이렉트시키면? `fetch()`의 기본 동작(`redirect: 'follow'`)은 이걸 그대로 따라간다.

그래서 방어를 세 겹으로 뒀다.

### 1. IP 대역 판정

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

IPv6도 같은 원리로 처리했다. 재밌었던 건 IPv4-mapped IPv6 주소(`::ffff:127.0.0.1`)였는데, `new URL()`이 이걸 16진 그룹 표기(`::ffff:7f00:1`)로 정규화해버려서, 점-십진 표기와 16진 표기 두 형태를 다 잡아야 했다.

### 2. DNS 해석 후 재검사

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

`{ all: true }`가 핵심이다. 도메인이 여러 A 레코드를 가질 수 있는데, 그중 **하나라도** 사설 IP면 차단해야 한다. 공개 IP 하나 + 사설 IP 하나를 섞어서 등록하는 우회를 막기 위해서다.

### 3. 리다이렉트를 수동으로 따라가며 홉마다 재검증

이게 제일 손이 많이 간 부분이다. `fetch()`의 자동 리다이렉트를 끄고, 직접 루프를 돌면서 매 홉마다 검증했다.

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

이 로직이 실제로 우회를 막는지 확인하려고 `fetch`를 모킹해서 테스트를 만들었다.

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

"에러가 났다"만 확인하는 게 아니라 "**실제로 내부 주소에 요청이 안 나갔다**"는 것까지 확인하는 게 중요하다. 에러 메시지가 그럴듯해도 그 전에 이미 내부망에 패킷이 나갔다면 방어는 실패한 거니까.

## 헤드리스 브라우저와 프록시도 빠뜨리면 안 된다

`fetchHtml` 하나만 고치고 끝내면 안 된다. 봇 차단이 강한 사이트는 자동으로 헤드리스 브라우저(Playwright)나 외부 리더 프록시로 폴백하는데, 이 경로들도 똑같은 유저 URL을 받는다.

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

여기서 트레이드오프가 하나 있다. 페이지 내 서브요청 검사는 **DNS 조회 없이 동기 정책 검사만** 한다. 매 요청마다 DNS를 조회하면 페이지 렌더링이 심하게 느려지기 때문이다. 완벽한 방어는 아니지만(공격자 소유 도메인의 A 레코드 조작까진 못 잡음), 초기 `page.goto` 내비게이션은 DNS까지 검증하니 실질적 위험은 크게 줄어든다. **보안은 항상 이런 트레이드오프의 연속**이다.

## 겸사겸사: 자동 수집 크론도 만들었다

이 작업을 하면서 발견한 게 있다. 랜딩 페이지엔 "관심 회사를 등록하면 새 공고를 **자동 수집**한다"고 써있는데, 실제로는 유저가 수집 버튼을 눌러야만 갱신됐다. 문구가 거짓말을 하고 있었던 거다.

SSRF 방어를 만든 김에, 진짜 백그라운드 자동 수집도 붙였다. Vercel Cron으로 매일 한 번 등록된 소스를 훑는다.

```ts
// vercel.json
{
  "crons": [{ "path": "/api/cron/scrape-sources", "schedule": "0 20 * * *" }]
}
```

여기엔 실패 처리가 중요했다. 크론이 실패하는 소스를 매번 재시도하면 리소스만 태운다. 그래서 지수 백오프를 넣었다.

```ts
function backoffUntil(failures: number): string {
  const delay = Math.min(SCRAPE_INTERVAL_MS * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_MS)
  return new Date(Date.now() + delay).toISOString()
  // 24h → 48h → 96h → ... 최대 7일
}
```

연속 5회 실패하면 자동 수집을 아예 멈추고 유저에게 "자동 수집 중지" 표시를 띄운다. 죽은 채용페이지를 영원히 재시도하지 않도록.

동시 실행 문제도 있었다. 크론이 겹쳐 돌면 같은 소스를 두 번 긁을 수 있으니, DB 레벨 잠금으로 막았다.

```ts
const { data: locked } = await supabaseAdmin
  .from('job_sources')
  .update({ scrape_lock_at: nowIso })
  .eq('id', source.id)
  .or(`scrape_lock_at.is.null,scrape_lock_at.lt.${staleBefore}`)
  .select('id')
if (!locked?.length) continue // 다른 실행이 이미 잠갔으면 건너뛴다
```

PostgREST의 단일 UPDATE는 행 단위로 원자적이라, 두 실행이 동시에 같은 소스를 잡으려 해도 하나만 성공한다. 별도 분산 락 없이도 compare-and-swap 패턴이 된다.

## 정리 — SSRF 체크리스트

유저 입력 URL을 서버가 요청하는 기능을 만든다면, 최소 이 정도는 확인하자.

- [ ] `http`/`https`만 허용 (file://, gopher:// 등 차단)
- [ ] credentials(`user:pass@host`) 포함 URL 거부
- [ ] IP 리터럴의 사설/루프백/링크로컬/메타데이터 대역 차단
- [ ] 도메인은 **DNS 해석 후** 사설 IP 여부 재검사 (모든 A 레코드)
- [ ] 리다이렉트는 수동으로 따라가며 **홉마다** 재검증
- [ ] 요청 타임아웃·응답 크기 상한 설정
- [ ] 우회 폴백 경로(헤드리스 브라우저, 프록시)에도 동일 정책 적용

다음 편은 이렇게 열심히 보안을 다졌는데, 정작 화면엔 눌러도 아무 일도 안 일어나는 버튼들이 있었다는 부끄러운 이야기다.
