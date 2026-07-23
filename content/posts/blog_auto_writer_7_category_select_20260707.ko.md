---
title: '블로그 발행을 자동화해보자 (7) 자동 발행 글에 카테고리 지정하기'
date: '2026-07-07'
publish_date: '2026-08-18'
description: 발행 글마다 카테고리 없이 올라가던 문제를 해결하기 위해 티스토리 카테고리 선택 드롭다운의 실제 구조를 뜯어보고 자동 선택 로직을 붙인 과정
tags:
  - Playwright
  - 티스토리
  - 브라우저 자동화
  - 트러블슈팅
---

지금까지 6편에 걸쳐 발행 자체는 잘 되게 만들었지만, 정작 올라간 글들은 전부 카테고리가 지정 안 된 상태였습니다. 30개 주제를 한 번에 등록해두고 나니 이 문제가 눈에 밟혔습니다. 발행할 때마다 특정 카테고리(이번엔 "생활상식")로 자동 분류되게 만들기로 했습니다.

## 설정 필드는 이미 있었다

계정 설정 타입을 보니 `category` 필드는 처음부터 존재했습니다.

```typescript
export interface PlatformConfig {
  enabled: boolean;
  category?: string;
}
```

`config/accounts.json`에도 `"category": ""`로 자리는 잡혀 있었는데, 정작 발행 스크립트(`tistory.ts`) 어디에도 이 값을 실제로 사용하는 코드가 없었습니다. 설정값은 있는데 아무도 읽지 않는, 이름만 걸어둔 필드였던 셈입니다.

## 카테고리 드롭다운의 실제 구조 확인하기

티스토리 글쓰기 화면에서 카테고리를 어떻게 선택하는지부터 확인해야 했습니다. 이번에도 3편의 교훈대로, 짐작하지 않고 실제 DOM을 찍어봤습니다.

```typescript
const info = await page.evaluate(() => {
  const candidates = Array.from(
    document.querySelectorAll('[id*="categor" i], [class*="categor" i]'),
  );
  return candidates.map((el) => ({ tag: el.tagName, id: el.id, text: el.textContent?.slice(0, 60) }));
});
```

결과로 `#category-btn`이라는 버튼 하나가 잡혔습니다. 이 버튼을 클릭했더니 카테고리 목록이 `.mce-menu-item` 클래스를 가진 `<div>` 요소들로 펼쳐졌습니다.

```json
{ "id": "category-item-957160", "text": "Tyson잡학다식" }
{ "id": "category-item-1543532", "text": "- 생활상식" }
```

여기서 특이한 점이 하나 있었습니다. **하위 카테고리는 이름 앞에 "- "가 붙어서 표시**됩니다. "생활상식"은 "Tyson잡학다식"이라는 상위 카테고리 밑에 딸린 하위 카테고리였고, 목록에는 "- 생활상식"이라는 텍스트로 나와 있었습니다. 설정값(`"생활상식"`)과 실제 DOM 텍스트(`"- 생활상식"`)를 그대로 비교하면 매칭에 실패하는 구조였습니다.

## 매칭 로직: 접두어를 떼고 비교

카테고리 이름을 하드코딩된 ID로 클릭하는 대신, **설정에 적은 이름과 목록의 텍스트를 비교해서 찾는 방식**으로 짰습니다. ID로 고정하면 티스토리에서 카테고리를 재구성할 때마다(하위 카테고리를 옮기거나 새로 만들 때) ID가 바뀌어 다시 깨질 수 있기 때문입니다.

```typescript
if (config.category) {
  await page.click('#category-btn');
  await page.waitForSelector('.mce-menu-item:visible', { timeout: 5000 });
  const items = page.locator('.mce-menu-item:visible');
  const count = await items.count();
  let matched = false;
  for (let i = 0; i < count; i++) {
    const text = (await items.nth(i).textContent())?.trim().replace(/^-\s*/, '');
    if (text === config.category) {
      await items.nth(i).click();
      matched = true;
      break;
    }
  }
  if (!matched) {
    console.warn(`  [tistory] 카테고리 "${config.category}"를 찾지 못해 건너뜁니다.`);
    await page.keyboard.press('Escape').catch(() => {});
  }
}
```

`.replace(/^-\s*/, '')`로 하위 카테고리 접두어를 떼어내고 비교하면, 설정 파일에는 사용자가 실제로 보는 카테고리 이름("생활상식")만 적으면 됩니다. 상위/하위 구분 문법을 사용자가 알 필요가 없어집니다.

`.mce-menu-item:visible`로 **화면에 보이는 항목만** 골라낸 것도 의도적입니다. 같은 클래스(`mce-menu-item`)를 마크다운/HTML 에디터 모드 전환 메뉴도 공유하고 있어서, 보이지 않는 다른 드롭다운의 항목까지 섞여 들어올 수 있었습니다.

## 하나 더: 카테고리를 못 찾아도 발행은 막지 않는다

카테고리 이름이 나중에 바뀌거나 오타가 있으면 매칭에 실패할 수 있습니다. 이때 발행 자체를 멈추는 대신, 경고만 남기고 카테고리 없이 계속 진행하도록 했습니다.

```typescript
if (!matched) {
  console.warn(`  [tistory] 카테고리 "${config.category}"를 찾지 못해 건너뜁니다.`);
  await page.keyboard.press('Escape').catch(() => {});
}
```

6편에서 "본문이 비어도 발행 로그는 성공으로 뜨는" 조용한 실패를 겪은 뒤라, 이번엔 반대로 **부가 기능(카테고리) 하나가 실패했다고 핵심 기능(발행)까지 막아서는 안 된다**고 판단했습니다. 실패의 무게가 다른 두 기능을 같은 예외 처리로 묶지 않은 겁니다.

## 검증: 발행 없이 카테고리 선택만 먼저 테스트

이번엔 실제 글을 발행하기 전에, 카테고리 선택 로직만 따로 떼어서 먼저 확인했습니다. 로그인된 세션으로 글쓰기 페이지를 열고, 카테고리를 선택한 뒤 버튼 텍스트가 바뀌는지만 봤습니다.

```typescript
console.log('매칭 성공 여부:', matched);        // true
console.log('최종 카테고리 버튼 텍스트:', btnText); // "생활상식더보기"
```

버튼 텍스트가 "카테고리 선택"에서 "생활상식더보기"로 바뀐 걸 확인한 뒤에야 실제 발행 코드에 반영했습니다. 6편을 겪고 나서 생긴 습관인데, **화면에 값이 반영되는 것과 실제로 선택이 적용되는 것을 분리해서 확인하는 절차**를 이제는 기본으로 넣게 됐습니다.

## 정리

| 항목 | 내용 |
|---|---|
| 설정 | `config/accounts.json` → `tistory.category: "생활상식"` |
| 매칭 방식 | ID 하드코딩 대신 표시 텍스트로 비교 (하위 카테고리 접두어 `- ` 제거) |
| 실패 처리 | 카테고리를 못 찾아도 발행은 계속 진행 (경고만 출력) |
| 적용 범위 | 로컬 발행(`npm run publish`)과 클라우드 워커(`npm run worker`) 모두 같은 설정을 공유 |

이번 건은 여섯 편에 걸쳐 겪은 문제들보다는 훨씬 가벼웠지만, 접근 방식은 똑같았습니다. 짐작 대신 `page.evaluate()`로 실제 DOM을 찍어보고, 값이 화면에 반영되는지 코드로 직접 확인한 다음에야 발행 파이프라인에 끼워 넣었습니다. 이제 앞서 등록해둔 한 달 치 생활정보 주제들이 발행될 때마다 "생활상식" 카테고리로 자동 분류됩니다.
