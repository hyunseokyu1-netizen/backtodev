---
title: '스크래핑을 포기할 줄 아는 것도 실력: Cloudflare + SPA와 싸우다 클릭 폴백으로 착지하기'
date: '2026-06-24'
publish_date: '2026-07-12'
description: Canva 채용 페이지 수집을 stealth 브라우저까지 동원해 시도하다 포기하고, 진단 로그로 진짜 원인을 찾아 실용적 폴백으로 마무리한 기록
tags:
  - 웹스크래핑
  - Cloudflare
  - Playwright
  - Vercel
  - 디버깅
---

사이드 프로젝트로 채용공고를 자동 수집하는 서비스를 만들고 있다. 회사 채용 페이지 URL을 등록하면 공고 목록을 긁어와 내 이력과의 매칭 점수를 매겨준다. Greenhouse·Lever 같은 표준 ATS는 공개 API가 있어서 쉬웠는데, **자체 구축 채용 페이지**가 문제였다. 그래서 "HTML을 통째로 가져와 AI(Claude Haiku)로 공고 목록을 추출"하는 범용 폴백을 만들었다.

대부분 잘 됐다. 그런데 **Canva** 하나가 끝까지 속을 썩였다. 이 글은 그 한 사이트를 뚫으려고 별짓을 다 하다가, 결국 **"포기하고 실용적인 대안으로 넘어간"** 과정의 기록이다. 그리고 그 과정에서 내가 내린 **틀린 결론 두 개**와, 그걸 바로잡아준 **진단 로그**에 대한 이야기다.

## 1라운드: 403, 그리고 stealth 브라우저

처음엔 단순한 `fetch`로 HTML을 가져왔다. Canva는 `403 Forbidden`을 던졌다. 전형적인 봇 차단이다.

1차 대응은 **브라우저처럼 보이는 헤더**였다. User-Agent, `Sec-Fetch-*`, `Accept-Language` 등을 채워 넣으니 Trivago 같은 사이트는 통과했다(403 → 200). 하지만 Canva는 여전히 403. 응답 헤더를 보니 답이 나왔다.

```
server: cloudflare
cf-ray: ...
```

**Cloudflare 봇 매니지먼트**다. 헤더 스푸핑 정도로는 안 뚫린다. 그래서 **헤드리스 브라우저(Playwright)** 폴백을 붙였다. 실제 브라우저로 페이지를 렌더링하면 JS 챌린지를 통과할 수 있으니까.

bare Playwright로는 "Attention Required" 차단 페이지가 떴지만, 이미 설치돼 있던 **`playwright-extra` + `puppeteer-extra-plugin-stealth`**(자동화 지문을 숨겨주는 플러그인)를 붙이니 로컬에서 **3번 시도 3번 모두 통과**했다. 109KB짜리 진짜 Canva 페이지가 들어왔다.

"됐다!" 싶었다. 배포했다. 그리고 **두 번 연속으로 헛다리를 짚기 시작했다.**

## 헛다리 1: "모듈을 못 찾는다" (의존성 트레이싱 지옥)

배포 후 수집을 누르니 새로운 에러가 떴다.

```
Cannot find module 'is-plain-object'
Require stack:
  - .../clone-deep/utils.js
  - .../merge-deep/index.js
  - .../puppeteer-extra-plugin-stealth/index.js
```

이건 Vercel 서버리스 환경의 함정이다. stealth 플러그인은 내부적으로 `evasions/*` 모듈을 **동적 require**로 불러오고, 그 의존성 트리가 `merge-deep → clone-deep → is-plain-object`처럼 깊다. Next.js의 번들러(NFT, node-file-trace)는 **동적 require를 따라가지 못해서**, 이 깊은 의존성들을 람다(serverless function)에 포함시키지 못한다.

해결은 `next.config.ts`의 `outputFileTracingIncludes`에 **의존성 폐포(closure) 전체를 명시**하는 것이었다. 처음엔 글로브 하나로 퉁치려 했지만 실패했고, 결국 의존성 트리를 스크립트로 재귀 수집해서 40개 패키지를 전부 나열했다.

```ts
// next.config.ts
const STEALTH_DEP_TREE = [
  'playwright-extra', 'puppeteer-extra-plugin-stealth',
  'merge-deep', 'clone-deep', 'is-plain-object', 'kind-of', /* ...40개 */
]
const BROWSER_TRACE_GLOBS = STEALTH_DEP_TREE.map(p => `./node_modules/${p}/**`)

export default {
  serverExternalPackages: ['playwright-core', 'puppeteer-extra-plugin-stealth', /* ... */],
  outputFileTracingIncludes: {
    '/discover': BROWSER_TRACE_GLOBS,  // 서버 액션이 도는 라우트
  },
}
```

> 포인트: 서버 액션(Server Action)은 **그 액션을 호출하는 페이지 라우트의 함수**에서 실행된다. 그래서 `/api/scrape`가 아니라 `/discover`에 트레이싱을 걸어야 했다.

모듈 에러는 사라졌다. 그런데 — **여전히 0건**이었다. 에러도 없고, 그냥 공고 0개. 여기서 두 번째 헛다리를 짚는다.

## 헛다리 2: "데이터센터 IP라 차단당하는 거야"

에러 없이 0건. 나는 이렇게 결론 내렸다.

> "stealth가 자동화 지문은 숨겨주지만, **Cloudflare는 IP 평판도 본다.** Vercel 같은 데이터센터 IP는 점수가 낮아서, 지문이 완벽해도 차단 페이지를 받는다. 그래서 빈 페이지에서 0건이 나오는 거다. 이건 코드로는 못 뚫는다."

그럴듯했다. 로컬(가정용 IP)에선 통과하고 Vercel(데이터센터 IP)에선 막힌다는 게 논리적으로 맞아 보였으니까. 그래서 **"차단 페이지를 감지해서 '수집 불가'로 표시"**하는 코드까지 짰다.

그런데 그것도 안 먹혔다. 여전히 "0건"으로만 떴다. 두 번 연속 추측이 빗나가자, 나는 추측을 멈추기로 했다.

## 진단 로그가 모든 걸 바꿨다

더 이상 머리로 추측하지 않고, **프로덕션이 실제로 무엇을 받는지** 찍어보기로 했다. 딱 한 줄.

```ts
const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
console.log(`[scrapeGeneric] url=${url} htmlLen=${html.length} title="${title}"`)
```

배포하고, 수집을 누르고, `vercel logs`로 확인했다. 결과는 충격이었다.

```
[scrapeGeneric] url=...canva... htmlLen=109427 title="Find your dream job | Canva Careers"
```

**차단 페이지가 아니었다.** 109KB짜리 진짜 Canva 채용 페이지였다. 제목까지 정확했다. 즉 **프로덕션의 stealth 브라우저는 Cloudflare를 뚫고 있었다.** 내 "데이터센터 IP 차단" 결론은 완전히 틀렸다.

그럼 왜 0건이지? 문제는 수집이 아니라 **그 다음 단계, AI 추출**에 있었던 거다.

## 진짜 원인: AI가 SPA를 못 읽는다

이번엔 전체 파이프라인을 로컬에서 그대로 재현했다. 진짜 Canva HTML을 stealth로 가져와서, 똑같은 전처리(스크립트 제거 → 압축 → 슬라이스)를 거쳐 Haiku에 넣었다.

```
htmlLen=109460  strippedLen=69903
href 전체=116 / 40000자내=51
Haiku 응답: {"jobs": []}   ← 0건
```

href가 51개나 들어있는 멀쩡한 HTML을 줬는데도 **Haiku가 공고를 0개**라고 했다. Canva는 무거운 **SPA(클라이언트 렌더링)**라, 공고가 의미 있는 `<a>` 태그가 아니라 난독화된 div와 해시된 클래스명으로 렌더링된다. 사람 눈엔 보이지만, 텍스트로 뽑아낸 HTML에서 AI가 "이게 채용공고다"라고 인식할 단서가 없었던 거다.

게다가 로컬에서 한 번 더 시도했더니 이번엔 Cloudflare가 **5xx 에러 페이지**를 던졌다. 즉 stealth 통과율은 **불규칙**했다. 정리하면 Canva는:

1. **Cloudflare가 운에 따라 뚫린다** (매번 보장 안 됨)
2. **뚫려도 SPA라 AI가 공고를 못 읽는다**

두 겹의 벽이었다. 코드로 짜낼 수 있는 영역이 아니었다.

## 결정: 포기하고, 클릭 폴백으로

여기서 중요한 판단을 했다. **"이걸 더 파는 게 가치가 있나?"**

- Canva 하나를 위해 유료 스크래핑 API(주거용 IP + JS 렌더링)를 붙이는 건 오버다.
- 대부분의 자체 구축 사이트(Trivago 등)는 이미 잘 된다.
- 사용자가 진짜 원하는 건 "그 회사 공고를 보는 것"이지 "내 DB에 공고가 꽂히는 것"이 아니다.

그래서 가장 단순한 답으로 갔다. **수집이 안 되는 사이트는, 회사명을 클릭하면 원본 채용 페이지를 새 탭으로 열어준다.**

```tsx
<a href={s.url} target="_blank" rel="noreferrer"
   className="text-sm font-semibold hover:text-blue-600 hover:underline"
   title="채용 페이지 열기">
  {s.name}
</a>
```

코드 몇 줄. 끝. "AI 추출"이 실패해도 사용자는 한 번의 클릭으로 진짜 페이지에 도달한다. 덤으로, AI 추출이 페이지 뒤쪽 공고를 잘라먹던 다른 사이트들을 위해 슬라이스 상한도 40k→100k로 올렸다(Haiku는 200K 컨텍스트라 여유 있다).

## 정리: 이 삽질에서 배운 것

기능 하나를 만들며 헛다리를 두 번 짚고 결국 "포기"로 끝났지만, 남는 교훈은 분명하다.

1. **추측을 멈추고 찍어봐라.** "데이터센터 IP라 차단"이라는 그럴듯한 가설로 이틀을 날릴 뻔했다. `console.log` 한 줄이 진실(차단이 아니라 AI 추출 실패)을 5분 만에 보여줬다. **로그는 가장 싸고 강력한 디버거다.**

2. **에러가 없다고 성공이 아니다.** "에러 없이 0건"이 가장 헷갈렸다. 실패가 조용히 성공처럼 보일 때를 조심하자.

3. **포기도 설계다.** 모든 사이트를 100% 긁는 건 불가능하다. 노력 대비 효과가 꺾이는 지점을 인정하고, **"실패했을 때 사용자가 막히지 않는 길"**(클릭 폴백)을 열어두는 게 더 나은 제품이다.

4. **서버리스에선 동적 require를 조심하라.** stealth 플러그인처럼 `require`를 동적으로 하는 패키지는 번들러가 못 따라가니, `outputFileTracingIncludes`로 의존성 트리를 직접 챙겨줘야 한다.

가장 큰 교훈은 첫 번째다. **막히면, 머리로 시나리오를 짜지 말고 일단 찍어봐라.** 내가 만든 "그럴듯한 이야기"보다 로그 한 줄이 훨씬 정직하다.
