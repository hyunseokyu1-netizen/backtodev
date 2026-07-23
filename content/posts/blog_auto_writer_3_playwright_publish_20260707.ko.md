---
title: '블로그 발행을 자동화해보자 (3) Playwright로 티스토리 자동 발행하기 - 세 번 실패한 이야기'
date: '2026-07-07'
publish_date: '2026-08-14'
description: 티스토리 로그인 세션이 자꾸 사라지던 문제와 마크다운 에디터 셀렉터를 잘못 잡아 발행이 안 되던 문제를 실제로 고쳐가며 정리
tags:
  - Playwright
  - 브라우저 자동화
  - Node.js
  - 트러블슈팅
  - 티스토리
---

앞선 두 편에서 주제 등록과 AI 초안 생성까지 다뤘습니다. 이론상으로는 이제 브라우저를 열어서 붙여넣고 발행 버튼만 누르면 끝나는 단순한 작업처럼 보였습니다. 실제로는 **로그인 세션 저장에서 두 번, 에디터 조작에서 한 번, 총 세 번 실패**했습니다. 이번 편은 그 실패와 해결 과정을 그대로 기록한 트러블슈팅 노트에 가깝습니다.

## 왜 Playwright인가

티스토리 Open API와 네이버 블로그 글쓰기 API는 모두 종료된 상태입니다. 그래서 발행은 사람이 브라우저로 하는 행동, 즉 **로그인 → 에디터 열기 → 내용 입력 → 발행 버튼 클릭**을 그대로 자동화하는 방식으로 갈 수밖에 없었습니다. Playwright를 고른 이유는 단순합니다.

- 요소가 로딩될 때까지 자동으로 기다려주는 auto-wait이 있어서 안정적입니다.
- `launchPersistentContext`로 프로필 디렉터리를 지정하면 로그인 세션을 재사용할 수 있습니다 (적어도 이론상으로는).

## 시도 1: 그냥 창을 닫으면 세션이 저장될 줄 알았다

처음 로그인 자동화는 이렇게 짰습니다.

```typescript
export async function interactiveLogin(platform: Platform): Promise<void> {
  const context = await openContext(platform, false);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(LOGIN_URLS[platform]);
  console.log('로그인이 끝나면 브라우저 창을 닫으세요.');
  await new Promise<void>((resolve) => context.on('close', () => resolve()));
}
```

브라우저를 띄우고, 사용자가 로그인한 뒤 창을 닫으면 프로세스가 끝나는 구조입니다. `launchPersistentContext`를 쓰고 있으니 당연히 쿠키가 프로필 디렉터리에 저장될 거라고 생각했습니다.

로그인 후 창을 닫고, 헤드리스 모드로 세션이 유효한지 확인해봤습니다.

```
SESSION_INVALID: https://www.tistory.com/auth/login?redirectUrl=...
```

세션이 사라졌습니다. 원인을 추적해보니, 제가 로그인 확인 절차 중 프로세스를 `kill`로 강제 종료했던 게 문제였습니다. **강제 종료하면 쿠키가 디스크에 완전히 기록(flush)되기 전에 브라우저가 죽어버립니다.** 정상 종료 경로를 타야 한다는 걸 이때 알았습니다.

## 시도 2: 로그인 감지 후 정상 종료하도록 고쳤는데도 안 됐다

그래서 로그인 완료를 자동으로 감지해서 `context.close()`로 정상 종료하도록 바꿨습니다.

```typescript
const poll = setInterval(async () => {
  const cookies = await context.cookies();
  if (cookies.some((c) => c.name === 'TSSESSION')) {
    clearInterval(poll);
    await context.close(); // 정상 종료
  }
}, 3000);
```

`TSSESSION` 쿠키가 생기면 로그인이 끝난 걸로 보고, 정상적으로 컨텍스트를 닫도록 했습니다. 이번엔 강제 종료가 아니니 될 줄 알았는데, 다시 헤드리스로 확인해보니 여전히 로그인 페이지로 리다이렉트됐습니다.

여기서 알게 된 사실이 하나 있습니다. **티스토리(그리고 카카오)의 로그인 쿠키는 세션 쿠키(session cookie)** 라는 점입니다. 세션 쿠키는 브라우저가 완전히 종료되면 (정상 종료든 아니든) 만료되도록 설계된 쿠키입니다. `launchPersistentContext`의 프로필 디렉터리는 영구 쿠키(persistent cookie)만 안정적으로 보존하지, 세션 쿠키는 브라우저를 껐다 켜면 사라지는 게 정상 동작이었던 겁니다.

## 해결: storageState로 쿠키를 명시적으로 저장

Playwright에는 `context.storageState()`라는 API가 있습니다. 현재 컨텍스트의 쿠키·로컬스토리지를 통째로 JSON 파일로 스냅샷 떠주는 기능입니다. 이걸 쓰면 세션 쿠키든 영구 쿠키든 상관없이 그 시점의 상태를 그대로 저장할 수 있습니다.

```typescript
// 로그인 감지 시점에 storageState로 저장
if (cookies.some((c) => c.name === cookieName)) {
  await context.storageState({ path: stateFilePath(platform) });
  await context.close();
}
```

그리고 다음에 브라우저를 열 때는 저장해둔 쿠키를 명시적으로 주입합니다.

```typescript
export async function openContext(platform: Platform, headless: boolean) {
  const context = await chromium.launchPersistentContext(profileDir, { headless, ... });

  const stateFile = stateFilePath(platform);
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    if (state.cookies?.length) {
      await context.addCookies(state.cookies);
    }
  }
  return context;
}
```

이렇게 바꾸고 나서야 헤드리스 모드에서도 `SESSION_OK`가 떴습니다. 발행이 끝난 뒤에도 세션을 다시 한번 갱신 저장하도록 `saveState()`를 발행 함수 끝에 붙여서, 세션이 오래돼도 계속 유지되도록 했습니다.

> **교훈**: 로그인 자동화를 만들 때 "브라우저 프로필 = 세션 유지"라고 가정하지 마세요. 세션 쿠키인지 영구 쿠키인지에 따라 동작이 다르고, 확실하게 하려면 `storageState`로 명시적으로 스냅샷을 뜨는 게 안전합니다.

## 시도 3: 에디터에 붙여넣기가 안 된다

세션 문제를 해결하고 나니 다음 관문은 **본문 입력**이었습니다. 처음엔 클립보드에 텍스트를 복사한 뒤 `Cmd+V`로 붙여넣는 방식을 썼습니다.

```typescript
const editor = page.locator('.CodeMirror textarea, .cm-content').first();
await editor.click();
await page.evaluate(async (text) => {
  await navigator.clipboard.writeText(text);
}, draft.body);
await page.keyboard.press('Meta+V');
```

실행해보니 이런 에러가 났습니다.

```
locator.click: Timeout 30000ms exceeded.
- element is not visible
```

티스토리의 마크다운 에디터는 CodeMirror 기반인데, 확인해보니 페이지 안에 **CodeMirror 인스턴스가 두 개** 있었습니다. 하나는 HTML 모드용(`cm-s-tistory-html`), 하나는 마크다운 모드용(`cm-s-tistory-markdown`)입니다. 제 셀렉터 `.CodeMirror textarea`는 이 둘을 구분하지 못하고 첫 번째(숨겨진 HTML 모드) 요소를 집어서 클릭을 시도하고 있었습니다.

실제 DOM을 스크립트로 찍어보고 나서야 원인을 확인했습니다.

```typescript
const info = await page.evaluate(() => {
  const cms = Array.from(document.querySelectorAll('.CodeMirror'));
  return cms.map((el) => ({
    className: el.className,
    visible: (el as HTMLElement).getBoundingClientRect().width > 0,
  }));
});
// → [{className: "... tistory-html", visible: false}, {className: "... tistory-markdown", visible: true}]
```

해결책은 두 가지를 함께 적용했습니다. 첫째, 셀렉터를 `.CodeMirror.cm-s-tistory-markdown`으로 정확히 지정. 둘째, 클립보드 붙여넣기 대신 **CodeMirror 인스턴스에 직접 `setValue()`를 호출**하는 방식으로 바꿨습니다.

```typescript
await page.waitForSelector('.CodeMirror.cm-s-tistory-markdown', { timeout: 15000 });
await page.evaluate((text) => {
  const cmEl = document.querySelector('.CodeMirror.cm-s-tistory-markdown') as any;
  cmEl.CodeMirror.setValue(text);
}, draft.body);
```

클립보드 방식은 눈에 보이는 요소를 클릭할 수 있어야 동작하는데, 숨겨진 요소 문제와 결합하면 실패 지점이 하나 더 늘어납니다. CodeMirror API를 직접 호출하는 방식은 요소가 화면에 보이는지 여부와 무관하게 값을 넣을 수 있어서 더 견고했습니다.

## 마크다운 모드 전환 시 뜨는 confirm 다이얼로그

한 가지 더 있습니다. 티스토리 에디터를 마크다운 모드로 전환하면 "작성 모드를 변경하시겠습니까?" 확인창이 뜹니다. 이건 Playwright에서 `page.on('dialog', ...)`로 처리해야 하는데, 순서가 중요했습니다.

```typescript
await page.click('#editor-mode-layer-btn-open');
page.on('dialog', (dialog) => dialog.accept().catch(() => {})); // 클릭 전에 등록
await page.click('#editor-mode-markdown');
```

다이얼로그 핸들러를 **클릭 이전에** 등록해야 합니다. 클릭한 뒤에 등록하면 다이얼로그가 이미 뜬 상태라 핸들러가 따라잡지 못하고 타임아웃이 나기 쉽습니다.

## 최종 결과

이 세 가지를 모두 고친 뒤 실제로 발행을 실행했더니 정상적으로 완료됐습니다.

```
▶ 2026-07-06 / tistory / "Playwright로 블로그 글 자동 발행하기..."
  [tistory] 발행 완료: https://내블로그.tistory.com/manage/posts/
```

발행이 진짜로 됐는지는 블로그 관리 페이지 대신 **RSS 피드**로 확인했습니다.

```bash
curl -s "https://내블로그.tistory.com/rss" | grep -o "<title>[^<]*</title>"
```

RSS 최상단에 방금 발행한 글 제목이 정확히 떠 있는 걸 보고 나서야 안심할 수 있었습니다. (관리 페이지 DOM은 구조가 또 달라서, 검증 스크립트로는 오히려 RSS가 더 확실한 방법이었습니다.)

## 정리 - 브라우저 자동화에서 얻은 교훈

이번 편에서 겪은 세 가지 실패를 한 줄씩 요약하면:

| 문제 | 원인 | 해결 |
|---|---|---|
| 로그인 세션이 저장 안 됨 (1차) | 프로세스 강제 종료로 쿠키 flush 실패 | 정상 종료 경로 사용 |
| 로그인 세션이 저장 안 됨 (2차) | 로그인 쿠키가 세션 쿠키라 프로필만으로 안 남음 | `storageState`로 명시적 저장/주입 |
| 본문 입력 실패 | CodeMirror 인스턴스가 2개, 숨겨진 요소를 클릭 시도 | 정확한 셀렉터 + `setValue()` 직접 호출 |

브라우저 자동화는 "이론상 되어야 하는 일"과 "실제 웹사이트 DOM의 구체적인 사정"이 자주 어긋납니다. 에러 메시지만 보고 고치기보다, `page.evaluate()`로 실제 DOM 구조를 직접 찍어보는 게 훨씬 빨랐습니다.

다음 편에서는 CLI 명령어만으로는 주제 등록하고 초안 확인하는 게 번거로워서 만든 **로컬 웹 대시보드**를 다뤄보겠습니다.
