---
title: 'Fixing Inherited Code (5/5): Zero Lint Errors, the Next.js 16 Migration, and My First Tests'
date: '2026-07-17'
publish_date: '2026-12-20'
description: Fixing 12 lint errors at the root cause, migrating from middleware to proxy for Next.js 16, and adding Vitest to close out the refactor series
tags:
  - ESLint
  - Next.js
  - Vitest
  - React
---

## Wrapping Up the Series

Over four posts, I fixed the data-integrity bug, verified AI output, closed off SSRF, and cleaned up dead buttons. This final post is less flashy but just as necessary — **shoring up the quality foundation.** I cleared out lint warnings, resolved framework version warnings, and added tests for the first time to guard everything this refactor touched.

## 12 Lint Errors — No Fixing Without the Root Cause

```
npm run lint
✖ 19 problems (12 errors, 7 warnings)
```

The easiest way to make an error disappear is to turn off the rule, or slap on an `// eslint-disable-next-line`. But that just hides the problem instead of fixing it. I looked at the root cause of each one.

### a React Hooks Error — "Don't setState Inside an Effect"

```
Error: Calling setState synchronously within an effect can trigger cascading renders
```

This is a rule tightened up in React 19+. It flagged a common pattern — "when props change, sync state inside an effect."

```tsx
// before — effect에서 즉시 setState (캐스케이딩 리렌더 유발)
useEffect(() => { setJobs(initialJobs) }, [initialJobs])
```

I switched to the "derived state from props" pattern recommended by React's own docs. No effect — it compares against the previous value **during render** and only updates state when needed.

```tsx
// after — 렌더 중 비교, effect 없음
const [prevInitial, setPrevInitial] = useState(initialJobs)
if (initialJobs !== prevInitial) {
  setPrevInitial(initialJobs)
  setJobs(initialJobs)
}
```

The first time you see it, "wait, you're calling setState inside the render function?" feels alarming — but React officially supports this pattern. A setState call made during render takes effect within that same render cycle, so it renders the latest state immediately with no flicker. It effectively skips a whole effect tick, making it faster, if anything.

The onboarding chat component had a similar pattern. The logic that restores draft answers from `localStorage` on mount lived inside an effect — I moved it to a **lazy state initializer** instead.

```tsx
// before
useEffect(() => {
  if (initialized.current) return
  initialized.current = true
  const saved = localStorage.getItem(DRAFT_KEY)
  if (saved) setAnswers({ ...EMPTY_ANSWERS, ...JSON.parse(saved) })
}, [])

// after — useState의 초기화 함수는 첫 렌더에 딱 한 번만 실행된다
const [answers, setAnswers] = useState<OnboardingAnswers>(() => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) return { ...EMPTY_ANSWERS, ...JSON.parse(saved) }
    } catch {}
  }
  return EMPTY_ANSWERS
})
```

When you pass a function to `useState(() => ...)`, React only runs it on the very first render and ignores it afterward — which is why no effect is needed. It ended up much shorter and clearer than the old code that used an `initialized` ref to fake "run only once."

### Four `any` Types — Replaced With Generics

```ts
// before
async function fetchJson(url: string): Promise<any> { ... }
return (data.jobs ?? []).map((j: any) => ({ title: j.title, ... }))
```

These were functions receiving responses from external ATS (Greenhouse, Lever, Ashby, SmartRecruiters) APIs. Getting rid of `any` means knowing the shape of the response.

```ts
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, ...)
  return res.json() as Promise<T>
}

interface GreenhouseJob {
  title?: string
  absolute_url?: string
  location?: { name?: string }
}

const data = await fetchJson<{ jobs?: GreenhouseJob[] }>(`https://boards-api.greenhouse.io/...`)
```

Since these come from an external API, I declared every field as optional. Getting `undefined` when you access a field that didn't actually come through is far safer than letting `any` wave anything through unchecked.

### Two `require()` Calls — Clearly Excluding Scripts From Lint

An old one-off debugging script at the project root (`test-glassdoor.js`) was using CommonJS `require()` and getting flagged. Since it's not actual app code but a manually-run script, I moved it into a `scripts/` folder and excluded it from lint.

```js
// eslint.config.mjs
globalIgnores([
  ".next/**", "out/**", "build/**", "next-env.d.ts",
  "scripts/**",  // 일회성 수동 실행 스크립트 — 앱 번들에 포함되지 않음
]),
```

**Turning off a rule is different from explicitly declaring "this code was never meant to be subject to this rule in the first place."** The latter leaves a record of why it was excluded, right there in the code.

## Next.js 16 — middleware Is Deprecated

This warning showed up on every build.

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

It's tempting to just shrug this off with "the old way still works anyway," but this time I checked the official docs first. The docs ship bundled right inside the Next.js package (`node_modules/next/dist/docs/`), so I could read the latest guide immediately.

> The name "middleware" causes confusion with Express.js middleware and leads to misuse. The name "proxy" more accurately describes what it actually does — sit at the network boundary, as a proxy.

Since it was just a rename, there was an official codemod for it.

```bash
npx @next/codemod@canary middleware-to-proxy .
```

```diff
// middleware.ts -> proxy.ts
- export function middleware() {
+ export function proxy() {
```

One command renamed the file and the function while keeping the logic exactly the same. The build warning disappeared too. **Making it a habit to check for an official migration tool the moment you see a version-upgrade warning** saved a lot of time here.

## My First Tests — From Scratch Scripts to a Real Suite

Across the previous four posts, every time I built something — SSRF defenses, fact-checking logic, match scoring — I verified it with a throwaway script and discarded it. I confirmed "it works" in the moment, but it could break again the next time someone touched the code.

I introduced Vitest to promote all of these checks into real tests.

```bash
npm install -D vitest
```

```ts
// vitest.config.ts
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
```

The key requirement was that it **run without a network, a database, or API keys.** Only then could it run instantly in CI, or in any environment at all. So I mocked out every external dependency.

```ts
// DNS 조회를 모킹해서 리바인딩 시나리오를 재현
vi.mock('node:dns/promises', () => ({
  lookup: (...args) => lookupMock(...args),
}))

it('공개+사설 혼합 A레코드도 차단', async () => {
  lookupMock.mockResolvedValue([
    { address: '104.16.0.1', family: 4 },      // 공개
    { address: '169.254.169.254', family: 4 }, // 사설 — 하나라도 있으면 차단
  ])
  expect(await findUrlViolationWithDns('https://mixed.example.com')).toContain('내부 네트워크')
})
```

```ts
// Claude API도 모킹해서 파싱 실패 케이스를 확실히 검증
it('JSON 파싱 실패 시 해당 배치는 점수 null (0점으로 위장하지 않음)', async () => {
  createMock.mockResolvedValueOnce({ content: [{ type: 'text', text: 'not json at all' }] })
  const results = await scorePostings([{ title: 'Backend Engineer', url: '...' }], profile)
  expect(results[0].score).toBeNull()  // 2편에서 고친 바로 그 회귀를 테스트로 고정
})
```

In part 2, I fixed the code so that "an AI failure must never be disguised as a score of 0." Pinning that down with a test means **if someone accidentally reverts it later, the test catches it immediately.** That's the real value of a test — not proving something is correct right now, but preventing it from becoming wrong later.

### a Trap I Ran Into While Mocking

While writing tests, I ran into a strange failure. The logic was clearly correct, but one specific test kept dying.

```ts
beforeEach(() => lookupMock.mockReset())  // 화살표 함수가 mockReset()의 반환값을 그대로 반환
```

`mockReset()` returns a `Mock` instance, and since the arrow function returned that value directly, Vitest mistook it for a **cleanup function.** After the test finished, that "cleanup function" (actually just the mock object itself) got invoked, producing a weird side effect. Wrapping it in braces so it explicitly returns `undefined` fixed it.

```ts
beforeEach(() => {
  lookupMock.mockReset()
})
```

It's a small trap, but worth remembering: an arrow function's implicit return can get mistaken by a test framework for a meaningful return value.

## Final Results

```bash
npm run lint   # 0 errors, 0 warnings
npx tsc --noEmit  # 통과
npm test       # 88 passed (88)
npx next build # 경고 없이 통과
```

## Looking Back on the Whole Series

If I sum up what these five posts covered in one sentence — **I didn't just take the AI's handoff document at face value; I verified each item against the code and fixed them in priority order.**

- Part 1: the most dangerous data-integrity bug (master vs. per-posting resume confusion)
- Part 2: UX that makes AI output trustworthy (confidence labeling, fact-checking)
- Part 3: security when handling external input (SSRF), and following through on promises (auto-scraping)
- Part 4: matching the UI's visual promises to what actually happens
- Part 5: the code-quality foundation that protects all of it (lint, framework updates, tests)

The order of work was deliberate, too. Polishing the UX while the data isn't safe is pointless, and polishing marketing copy while a security hole is still open is out of order too. **Working in order of risk, and splitting changes into small, independent commits** was the principle running through this entire series.
