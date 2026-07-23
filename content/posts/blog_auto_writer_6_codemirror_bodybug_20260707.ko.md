---
title: '블로그 발행을 자동화해보자 (6) 제목만 올라가고 본문이 사라진 이유 - CodeMirror가 숨긴 함정'
date: '2026-07-07'
publish_date: '2026-08-17'
description: 발행 로그도 정상, RSS 제목도 정상인데 실제 글 본문이 계속 비어 있던 문제를 CodeMirror와 React 상태 동기화 관점에서 추적하고 고친 과정
tags:
  - Playwright
  - CodeMirror
  - React
  - 트러블슈팅
  - 티스토리
---

3편에서 "본문 입력 실패"를 해결했다고 썼습니다. 클릭 안 되는 문제를 셀렉터로 잡고, `CodeMirror.setValue()`로 값을 직접 넣어서 발행까지 됐다고요. 문제는, 그때도 지금도 검증 방법이 딱 하나였습니다 — **RSS 피드에 제목이 뜨는지**만 봤습니다. 본문은 한 번도 제대로 확인한 적이 없었습니다.

## 사용자가 캡처 한 장을 보내왔다

클라우드 대시보드로 발행 버튼을 누르고 며칠이 지난 뒤, "티스토리에 블로그 제목만 올라갔어"라는 메시지와 함께 스크린샷이 왔습니다. 제목과 태그는 말끔하게 잘 올라가 있는데, 본문 자리가 텅 비어 있었습니다.

가장 먼저 의심한 건 초안 데이터 자체였습니다. Redis에 저장된 초안을 직접 꺼내봤습니다.

```typescript
const draft = await redis.get('blog-auto-writer:draft:2026-07-07_tistory_장마철-음식관리');
console.log(draft.title, draft.body.length);
// "장마철 음식관리, 냉장고만 믿으면 안 되는 이유" 1621
```

본문은 1621자, 내용도 정상이었습니다. 데이터는 이상이 없었고, 문제는 **발행 스크립트가 그 데이터를 티스토리에 밀어넣는 지점**에 있었습니다.

## 의심 지점: 3편에서 "해결"했다고 믿었던 그 코드

```typescript
await page.waitForSelector('.CodeMirror.cm-s-tistory-markdown', { timeout: 15000 });
await page.evaluate((text) => {
  const cmEl = document.querySelector('.CodeMirror.cm-s-tistory-markdown') as any;
  cmEl.CodeMirror.setValue(text);
}, draft.body);
```

이 코드는 분명히 CodeMirror 에디터 **화면**에는 텍스트를 채워 넣습니다. 헤드리스가 아니라 화면을 보면서 실행하면 본문이 눈에 보이게 들어갑니다. 그런데 발행을 누르면 서버로 넘어가는 값은 비어 있었습니다. 화면에 보이는 것과 실제로 제출되는 값이 다르다는 게 이 버그의 핵심이었습니다.

## 원인: setValue는 CodeMirror만 알고, React는 모른다

티스토리의 에디터는 CodeMirror를 감싼 `ReactCodemirror`라는 래퍼 컴포넌트로 구현돼 있습니다. 이런 래퍼는 보통 이렇게 동작합니다.

```jsx
// React 래퍼 컴포넌트의 전형적인 구조 (개념적 예시)
function ReactCodemirror({ onChange }) {
  useEffect(() => {
    const cm = CodeMirror(el, options);
    cm.on('change', () => onChange(cm.getValue())); // 사용자 입력 이벤트에만 반응
  }, []);
}
```

`cm.on('change', ...)`는 CodeMirror 내부의 **입력 이벤트 파이프라인**을 통해서만 발생합니다. 그런데 `CodeMirror.setValue()`는 이 파이프라인을 우회해서 문서 내용을 직접 갈아치우는 저수준 API입니다. 화면(CodeMirror 자체의 렌더링)은 바뀌지만, `change` 이벤트가 사용자가 타이핑했을 때와 완전히 같은 방식으로 발생하지 않을 수 있고, React 쪽 `onChange` → 상위 state → 발행 시 실제로 서버에 보내는 값까지 이어지는 연결고리가 끊겨버립니다. 결국 화면에는 보이는데 React가 들고 있는 "진짜" 본문 상태는 빈 문자열로 남는 상황이 만들어진 겁니다.

3편에서 이 코드로 셀렉터 문제(숨겨진 HTML 에디터를 잘못 집던 문제)는 확실히 해결됐습니다. 그런데 그 검증을 "발행이 에러 없이 끝나고 RSS에 제목이 뜨는가"로만 했기 때문에, 본문이 안 들어가는 훨씬 조용한 실패를 몇 주 동안 못 보고 지나간 겁니다.

## 고친 방법: 진짜 입력 이벤트로 넣기

해결책은 CodeMirror API를 우회하지 않고, **사람이 타이핑하는 것과 같은 경로**로 입력하는 것이었습니다. Playwright의 `keyboard.insertText`는 실제 입력 이벤트를 발생시킵니다.

```typescript
const cmScroll = page.locator('.CodeMirror.cm-s-tistory-markdown .CodeMirror-scroll').first();
await cmScroll.click();                      // 실제 포커스
await page.keyboard.press('ControlOrMeta+a'); // 기존 내용 전체 선택
await page.keyboard.press('Delete');
await page.keyboard.insertText(draft.body);   // 진짜 입력 이벤트로 주입
```

여기에 한 가지를 더 추가했습니다. **주입한 값이 실제로 CodeMirror 문서에 반영됐는지 코드로 직접 확인**하는 검증 단계입니다.

```typescript
const injectedLen = await page.evaluate(() => {
  const cmEl = document.querySelector('.CodeMirror.cm-s-tistory-markdown') as any;
  return cmEl?.CodeMirror?.getValue()?.length ?? -1;
});
if (injectedLen <= 0) {
  throw new Error('티스토리 본문 주입에 실패했습니다 (CodeMirror가 비어 있음).');
}
```

이 검증이 없었다면, 다음에 에디터 구조가 또 바뀌었을 때도 지금과 똑같이 "발행은 성공, 본문은 없음" 상황을 몇 주 뒤에야 스크린샷으로 알게 될 뻔했습니다. 이제는 본문이 비면 그 자리에서 에러를 던지고 멈춥니다.

## 고치고 나서 검증한 방법

이번엔 RSS 제목만 보지 않았습니다. 실제 발행 후 RSS의 `description`을 파싱해서 **본문 텍스트 길이와 내용**까지 확인했습니다.

```bash
curl -s "https://내블로그.tistory.com/rss" | python3 -c "
import sys, re, html
data = sys.stdin.read()
desc = re.search(r'<description>(.*?)</description>', data, re.S).group(1)
text = re.sub(r'<[^>]+>', '', html.unescape(desc))
print('본문 길이:', len(text.strip()))
print('본문 앞부분:', text.strip()[:100])
"
```

```
본문 길이: 1537
본문 앞부분: 작년 장마철에 냉장고에 넣어둔 반찬을 별생각 없이 먹었다가 하루 종일 고생한 적이 있습니다...
```

이번에는 제목뿐 아니라 본문까지 실제로 들어간 걸 확인했습니다.

## 정리 - "성공 로그"와 "진짜로 성공"은 다르다

| 확인한 것 | 실제로 보장하는 것 |
|---|---|
| 발행 함수가 에러 없이 리턴 | 페이지 이동까지는 성공했다는 것뿐 |
| RSS에 제목이 보임 | 글이 목록에 등록됐다는 것뿐 |
| RSS `description`의 본문 길이 | **실제로 사용자가 볼 내용이 들어갔는지** |

이번 버그가 특히 뼈아팠던 이유는, 3편에서 "해결했다"고 썼던 코드가 사실 절반만 해결한 코드였다는 걸 몇 주 동안 몰랐다는 점입니다. 브라우저 자동화에서 저수준 API로 값을 "밀어넣는" 방식은 화면상으로는 그럴듯해 보이지만, 그 값이 애플리케이션의 실제 상태(이 경우 React state)까지 도달하는지는 별개의 문제입니다. 이후로는 발행 자동화의 성공 기준을 "에러 없음"이 아니라 "주입한 값과 실제 반영된 값이 같은가"로 바꿨습니다.

## 여섯 편을 거쳐 얻은 전체 그림

```
주제 등록 (로컬 YAML 또는 클라우드 대시보드)
   → Claude API로 초안 생성 (스타일 가이드 + 프롬프트 캐싱)
      → Redis에 발행 요청 기록 (클라우드에서 눌렀다면)
         → 로컬 워커가 감지 → Playwright로 로그인 세션 재사용해 발행
            → 입력값이 실제로 반영됐는지 검증 후 완료
```

여섯 편에 걸쳐 겪은 문제들을 돌아보면 전부 같은 패턴이었습니다. **"이 정도면 됐다"고 넘긴 지점에 다음 버그가 숨어 있었습니다.** 세션이 저장된 줄 알았는데 세션 쿠키였고, 셀렉터를 고친 줄 알았는데 값 주입 방식이 문제였고, 스토리지를 붙인 줄 알았는데 일관성 모델이 안 맞았습니다. 결국 이런 종류의 자동화에서는 "동작하는 것처럼 보인다"와 "실제로 끝까지 동작한다" 사이의 간극을 얼마나 좁게 검증하느냐가 전부라는 걸 다시 배웠습니다.
