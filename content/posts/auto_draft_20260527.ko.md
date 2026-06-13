---
title: '앱 개념어를 바꿨다 — Folder에서 Chain으로, 전면 리네이밍 작업기'
date: '2026-05-27'
publish_date: '2026-06-14'
description: ChainPlay 앱에서 Folder 개념을 Chain으로 전면 리네이밍하면서 겪은 과정과 TypeScript 타입 주도 리팩토링 방법
tags:
  - React Native
  - TypeScript
  - 리팩토링
  - ChainPlay
---

# 앱 개념어를 바꿨다 — Folder에서 Chain으로, 전면 리네이밍 작업기

> ChainPlay v3.0 작업 로그. "폴더"라는 단어가 계속 마음에 걸렸다.

---

## 왜 이름을 바꿨나

처음 플레이리스트 그룹 기능을 만들 때 가장 직관적인 단어를 골랐다. "폴더". 영상 묶음을 담는 그릇이니 틀린 말은 아니다.

그런데 쓰면 쓸수록 어색했다. ChainPlay의 핵심 UX는 "영상을 순서대로 이어 재생한다"는 것인데, 폴더는 그냥 담는 용기 느낌이다. 체인(Chain)은 다르다. 고리가 연결되는 이미지 — 영상이 하나씩 이어지는 흐름이 바로 체인이다.

앱 이름도 **ChainPlay**인데 내부 개념어가 폴더면 통일감이 없다. 그래서 오늘 폴더를 체인으로 전면 교체했다.

---

## 어떤 작업이었나

이런 리네이밍 작업은 생각보다 범위가 넓다. 단순히 UI 텍스트 몇 군데를 바꾸는 게 아니라, 타입 정의부터 훅, 컴포넌트, 파일명, i18n 텍스트까지 전부 손대야 한다.

이번에 바뀐 파일 목록은 이렇다.

| 변경 전 | 변경 후 |
|---|---|
| `src/hooks/useFolders.ts` | `src/hooks/useChains.ts` |
| `src/components/FolderNameModal.tsx` | `src/components/ChainNameModal.tsx` |
| `src/components/MoveToFolderModal.tsx` | `src/components/MoveToChainModal.tsx` |
| `src/screens/FolderListScreen.tsx` | `src/screens/ChainListScreen.tsx` |
| `interface Folder` | `interface Chain` |

총 12개 파일, 424줄 추가 / 352줄 삭제.

---

## 리네이밍 작업 흐름

### Step 1: 타입부터 바꾼다

가장 먼저 손댈 곳은 `src/types/index.ts`다. 여기서 인터페이스 이름이 바뀌면, TypeScript 컴파일러가 나머지 깨진 곳을 모두 알려준다.

```ts
// 변경 전
export interface Folder {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: number;
}

// 변경 후
export interface Chain {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: number;
}
```

타입 이름 하나 바꾸면 프로젝트 전체가 빨간 줄로 가득 찬다. 겁먹을 필요 없다. 이게 오히려 좋은 신호다 — 어디를 고쳐야 하는지 컴파일러가 전부 가르쳐준다.

### Step 2: 훅(Hook) 파일을 새로 만든다

`useFolders.ts`를 `useChains.ts`로 교체했다. 내부 로직은 동일하고 이름만 바뀐다.

```ts
// useChains.ts 핵심 구조
export function useChains() {
  const [chains, setChains] = useState<Chain[]>([]);

  // 체인 생성
  const createChain = useCallback((name: string) => { ... }, [save]);

  // 체인 간 영상 이동
  const moveItemBetweenChains = useCallback(
    (itemId: string, fromChainId: string, toChainId: string) => { ... },
    [save]
  );

  return {
    chains,
    createChain,
    renameChain,
    deleteChain,
    addUrlToChain,
    removeItemFromChain,
    moveItemInChain,
    moveItemBetweenChains,
  };
}
```

파일을 새로 만들고 기존 파일을 삭제하는 방식을 택했다. git은 이를 rename으로 추적한다 (`similarity index 100%`).

### Step 3: i18n 텍스트 교체

한/영 다국어를 지원하다 보니 UI 텍스트도 두 벌씩 바꿔야 한다.

```ts
// 변경 전
folderListTitle: isKorean ? '폴더' : 'Folders',
newFolder: isKorean ? '+ 새 폴더' : '+ New Folder',
noFolders: isKorean ? '폴더가 없습니다' : 'No folders yet',

// 변경 후
chainListTitle: isKorean ? '체인' : 'Chains',
newChain: isKorean ? '+ 새 체인' : '+ New Chain',
noChains: isKorean ? '체인이 없습니다' : 'No chains yet',
```

### Step 4: 컴포넌트, 스크린 파일 순서대로

i18n까지 바꾸면 나머지는 기계적인 작업이다. 컴포넌트와 스크린 파일에서 `folder` → `chain`, `Folder` → `Chain`으로 전부 교체한다. StyleSheet 키 이름도 빠짐없이 바꿨다 (`folderRow` → `chainRow` 등).

---

## 오늘 추가된 것 — 첫 진입 안내 배너

리네이밍만 한 게 아니라, 새로운 UX도 하나 넣었다. "체인이 뭔지 모르는 사용자를 위한 첫 진입 안내 배너"다.

앱을 처음 실행하면 체인 목록 상단에 한 줄짜리 설명이 뜬다.

```
체인 — 영상을 순서대로 묶어 연속 재생하는 목록  [✕]
```

✕를 누르면 `AsyncStorage`에 플래그를 저장해서 다시는 안 보인다.

```tsx
// ChainListScreen.tsx — 배너 노출 로직
const INTRO_SEEN_KEY = '@chain_intro_seen';

useEffect(() => {
  AsyncStorage.getItem(INTRO_SEEN_KEY).then((val) => {
    if (!val) setShowIntro(true);
  });
}, []);

const dismissIntro = () => {
  setShowIntro(false);
  AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
};
```

구현이 단순하지만 실용적이다. 온보딩 라이브러리 같은 걸 끌어오지 않아도, AsyncStorage 하나면 충분하다.

배너 UI도 별도 컴포넌트 없이 인라인 StyleSheet로 처리했다.

```tsx
{showIntro && (
  <View style={styles.introBanner}>
    <Text style={styles.introText}>{t.chainIntroDesc}</Text>
    <TouchableOpacity onPress={dismissIntro} hitSlop={8}>
      <Text style={styles.introClose}>✕</Text>
    </TouchableOpacity>
  </View>
)}
```

---

## 리네이밍 작업에서 놓치기 쉬운 것들

이런 전면 리네이밍을 해보면 은근히 빠뜨리는 곳이 생긴다. 체크해야 할 포인트를 정리해두면 다음에 유용하다.

- **StyleSheet 키**: 로직 코드는 잘 바꿨는데 `StyleSheet.create({})` 안의 키 이름을 빠뜨리는 경우가 많다. TypeScript가 잡아주지 않으므로 직접 확인해야 한다.
- **i18n 함수형 키**: `folderVideoCount: (n: number) => ...` 처럼 함수인 것들도 전부 교체 대상이다.
- **AsyncStorage 키 상수**: `CHAINS_KEY = '@yt_folders'` — 이번에는 스토리지 키 이름 자체는 바꾸지 않았다. 이미 기기에 저장된 데이터 마이그레이션이 필요하기 때문이다. 개념어는 바꾸되 스토리지 키는 호환성을 위해 그대로 유지하는 전략도 있다.
- **주석**: 코드 주석 안의 용어도 빠뜨리지 않도록 한다.

---

## 정리

오늘 작업을 한 줄로 요약하면: **개념어를 정리하면 코드가 읽기 쉬워진다.**

Folder라는 단어가 주는 모호함 — "그냥 담는 그릇" — 을 Chain으로 바꾸면서 앱이 하려는 일이 더 명확해졌다. 영상들이 체인처럼 엮여서 순서대로 재생된다는 것.

리네이밍 자체는 단순한 작업이지만, 타입 → 훅 → 컴포넌트 → 스크린 → i18n 순서로 계층을 따라가면서 하면 빠뜨리는 게 없다. TypeScript를 쓰고 있다면 타입부터 바꾸는 게 제일 빠른 방법이다 — 컴파일러가 나머지를 알아서 찾아준다.

---

**오늘 작업한 것**
- `Folder` → `Chain` 전면 리네이밍 (타입, 훅, 컴포넌트, 스크린, i18n, 파일명)
- 첫 진입 안내 배너 추가 (AsyncStorage로 영구 숨김 처리)
- ChainPlay v3.0 CHANGELOG 업데이트
