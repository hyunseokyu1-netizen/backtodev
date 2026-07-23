---
title: '인수받은 코드 개선하기 (5/5) — lint 0, Next.js 16 마이그레이션, 그리고 처음 붙인 테스트'
date: '2026-07-17'
publish_date: '2026-09-18'
description: 12개 lint 에러를 근본 원인부터 고치고, Next.js 16의 middleware→proxy 전환과 Vitest 도입으로 리팩토링 시리즈를 마무리한 기록
tags:
  - ESLint
  - Next.js
  - Vitest
  - React
---

## 시리즈를 마무리하며

4편에 걸쳐 데이터 무결성 버그를 고치고, AI 결과를 검증하고, SSRF를 막고, 죽은 버튼을 정리했다. 마지막 편은 화려하진 않지만 꼭 필요한 작업 — **품질 기반을 다지는 것**이다. lint 경고를 없애고, 프레임워크 버전 경고를 해결하고, 이 모든 리팩토링을 지켜줄 테스트를 처음으로 붙였다.

## lint 12 에러 — 근본 원인 없이 끄지 않는다

```
npm run lint
✖ 19 problems (12 errors, 7 warnings)
```

에러를 안 보이게 하는 제일 쉬운 방법은 규칙을 끄거나 `// eslint-disable-next-line`을 붙이는 거다. 근데 그건 문제를 숨기는 거지 고치는 게 아니다. 하나씩 원인을 봤다.

### React Hooks 에러 — "effect 안에서 setState하지 마라"

```
Error: Calling setState synchronously within an effect can trigger cascading renders
```

이건 React 19+에서 강화된 규칙이다. 흔한 패턴이었던 "props가 바뀌면 effect에서 state를 동기화"하는 코드가 걸렸다.

```tsx
// before — effect에서 즉시 setState (캐스케이딩 리렌더 유발)
useEffect(() => { setJobs(initialJobs) }, [initialJobs])
```

React 공식 문서가 권장하는 "derived state from props" 패턴으로 바꿨다. effect 없이, **렌더 중에** 이전 값과 비교해서 필요할 때만 상태를 갱신한다.

```tsx
// after — 렌더 중 비교, effect 없음
const [prevInitial, setPrevInitial] = useState(initialJobs)
if (initialJobs !== prevInitial) {
  setPrevInitial(initialJobs)
  setJobs(initialJobs)
}
```

처음 보면 "렌더 함수 안에서 setState를 부른다고?" 싶어서 불안한데, React는 이 패턴을 공식적으로 지원한다. 렌더 중 호출된 setState가 같은 렌더 사이클에서 바로 반영되기 때문에, 화면 깜빡임 없이 즉시 최신 상태로 렌더링된다. effect 한 틱을 아예 건너뛰는 셈이라 오히려 더 빠르다.

온보딩 채팅 컴포넌트에도 비슷한 패턴이 있었다. 마운트 시 `localStorage`에서 임시저장된 답변을 복원하는 로직이 effect 안에 있었는데, 이걸 **state의 lazy 초기화**로 옮겼다.

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

`useState(() => ...)`처럼 함수를 넘기면, React가 첫 렌더링 때만 그 함수를 실행하고 이후엔 무시한다. effect가 필요 없는 이유다. `initialized` ref로 "한 번만 실행"을 흉내 내던 코드보다 훨씬 짧고 명확해졌다.

### `any` 타입 4개 — 제네릭으로 대체

```ts
// before
async function fetchJson(url: string): Promise<any> { ... }
return (data.jobs ?? []).map((j: any) => ({ title: j.title, ... }))
```

외부 ATS(Greenhouse, Lever, Ashby, SmartRecruiters) API 응답을 받는 함수들이었다. `any`를 없애려면 응답 타입을 알아야 한다.

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

외부 API 응답이라 필드를 전부 optional로 선언했다. 실제로 오지 않는 필드에 접근하면 `undefined`가 나오는 게 `any`로 아무 타입이나 통과시키는 것보다 훨씬 안전하다.

### require() 2개 — 스크립트를 lint 대상에서 명확히 분리

프로젝트 루트에 예전에 만든 일회성 디버깅 스크립트(`test-glassdoor.js`)가 CommonJS `require()`를 쓰고 있어서 걸렸다. 이건 진짜 앱 코드가 아니라 수동 실행용 스크립트니까, `scripts/` 폴더로 옮기고 lint 대상에서 제외했다.

```js
// eslint.config.mjs
globalIgnores([
  ".next/**", "out/**", "build/**", "next-env.d.ts",
  "scripts/**",  // 일회성 수동 실행 스크립트 — 앱 번들에 포함되지 않음
]),
```

**규칙을 끄는 것과 "이 코드는 애초에 이 규칙의 대상이 아니다"라고 명시하는 건 다르다.** 후자는 왜 제외했는지가 코드에 남는다.

## Next.js 16 — middleware가 deprecated됐다

빌드할 때마다 이 경고가 떴다.

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

이럴 때 습관적으로 "예전 방식으로도 어차피 돌아가니까" 하고 넘어가기 쉬운데, 이번엔 공식 문서부터 확인했다. Next.js 패키지 안에 문서가 번들돼 있어서(`node_modules/next/dist/docs/`) 최신 가이드를 바로 볼 수 있었다.

> "middleware"라는 이름이 Express.js의 미들웨어와 혼동을 일으켜서 오용을 유발한다. "proxy"라는 이름이 실제 동작(네트워크 경계에 있는 프록시)을 더 정확히 설명한다.

이름만 바뀐 거라 공식 코드모드가 있었다.

```bash
npx @next/codemod@canary middleware-to-proxy .
```

```diff
// middleware.ts -> proxy.ts
- export function middleware() {
+ export function proxy() {
```

한 줄 명령으로 파일명과 함수명이 바뀌고, 로직은 그대로 유지됐다. 빌드 경고도 사라졌다. **버전 업그레이드 경고를 볼 때마다 공식 마이그레이션 도구가 있는지부터 확인하는 습관**이 여기서 시간을 많이 아껴줬다.

## 처음 붙인 테스트 — scratchpad에서 정식 스위트로

지금까지 4편에 걸쳐 SSRF 방어, 사실 검증 로직, 매칭 채점 같은 걸 만들 때마다, 매번 임시 스크립트로 검증하고 버렸다. "된다"는 걸 그 순간엔 확인했지만, 다음에 코드를 건드리면 다시 깨질 수도 있는 상태였다.

Vitest를 도입해서 이 검증들을 정식 테스트로 승격했다.

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

핵심은 **네트워크·DB·API 키 없이 도는 것**이었다. 그래야 CI에서도, 아무 환경에서도 바로 돌릴 수 있다. 그래서 외부 의존성은 전부 모킹했다.

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

2편에서 "AI 실패가 0점으로 위장되면 안 된다"고 코드를 고쳤는데, 이걸 테스트로 박아두면 **누군가 나중에 실수로 되돌려도 테스트가 바로 알려준다.** 이게 테스트의 진짜 가치다 — 지금 맞다는 걸 증명하는 게 아니라, 나중에 틀려지는 걸 막는 것.

### 모킹하다가 만난 함정 하나

테스트를 짜다가 이상한 실패를 만났다. 분명 로직은 맞는데 특정 테스트만 죽었다.

```ts
beforeEach(() => lookupMock.mockReset())  // 화살표 함수가 mockReset()의 반환값을 그대로 반환
```

`mockReset()`은 `Mock` 인스턴스를 반환하는데, 화살표 함수가 이걸 그대로 리턴하면서 Vitest가 이걸 **정리(cleanup) 함수**로 오인했다. 테스트가 끝난 뒤 그 "정리 함수"(사실은 mock 객체 자체)가 호출되면서 이상한 부작용이 생긴 거다. 중괄호로 감싸서 명시적으로 `undefined`를 반환하게 하니 해결됐다.

```ts
beforeEach(() => {
  lookupMock.mockReset()
})
```

작은 함정이지만, "화살표 함수의 암묵적 반환이 테스트 프레임워크의 의미 있는 반환값으로 오인될 수 있다"는 건 기억해둘 만하다.

## 최종 결과

```bash
npm run lint   # 0 errors, 0 warnings
npx tsc --noEmit  # 통과
npm test       # 88 passed (88)
npx next build # 경고 없이 통과
```

## 시리즈 전체를 돌아보며

5편에 걸쳐 한 일을 한 문장으로 요약하면 — **AI가 준 인수인계 문서를 그대로 믿지 않고, 하나하나 코드로 검증하며 우선순위대로 고쳤다.**

- 1편: 가장 위험한 데이터 무결성 버그(마스터/공고별 이력서 혼동)
- 2편: AI 결과를 사용자가 신뢰할 수 있게 만드는 UX(신뢰도 표시, 사실 검증)
- 3편: 외부 입력을 다룰 때의 보안(SSRF)과 약속 이행(자동 수집)
- 4편: 화면의 시각적 약속과 실제 동작 일치시키기
- 5편: 이 모든 걸 지켜줄 코드 품질 기반(lint, 프레임워크 최신화, 테스트)

작업 순서도 의도적이었다. 데이터가 안전하지 않은 상태에서 UX를 다듬는 건 의미가 없고, 보안 구멍이 있는 채로 마케팅 문구를 다듬는 것도 순서가 안 맞다. **위험도 순으로, 그리고 서로 의존하지 않는 선에서 작은 단위로 쪼개 커밋했다**는 게 이 시리즈 전체를 관통하는 원칙이었다.
