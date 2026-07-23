---
title: 'React 자동완성 칩(Chip) 입력 컴포넌트 직접 만들기 — blur보다 먼저 클릭 잡기'
date: '2026-07-03'
publish_date: '2026-07-28'
description: 라이브러리 없이 자동완성 칩 입력을 직접 구현하면서 부딪힌 mousedown vs blur 순서 문제, 미커밋 텍스트 유실 방지 같은 디테일 정리
tags:
  - React
  - TypeScript
  - UI 컴포넌트
  - Tailwind CSS
---

> **MatchDa 개발기 시리즈 (2/3)**
> 1편: 봇 차단 스크래핑 3단 폴백 · **2편: React 자동완성 칩 입력 직접 만들기 (이 글)** · 3편: 리브랜딩 마이그레이션에서 놓친 화면 찾기

## 쉼표로 스킬 입력받는 UX의 한계

MatchDa에서 유저 프로필의 스킬은 매칭 품질에 직결된다. 그런데 기존 입력은 이랬다.

```
스킬: [ React, TypeScript, AWS____________ ]  ← 그냥 텍스트 인풋
```

문제가 줄줄이 나온다.

- `React` / `ReactJS` / `react.js` — 표기가 제각각이라 매칭 정확도가 떨어진다
- 오타(`Typescirpt`)가 그대로 저장된다
- 뭘 입력했는지 시각적으로 구분이 안 된다

원하는 건 이메일 수신자 입력처럼 **타이핑하면 자동완성이 뜨고, 선택하면 칩으로 박히는** UI다. 라이브러리(react-select 등)를 쓸 수도 있지만, 필요한 기능이 명확하고 온보딩 채팅과 프로필 폼 두 곳에서 조금 다르게 써야 해서 직접 만들었다. **183줄**이면 끝난다.

## 설계: 하나의 컴포넌트, 두 가지 모드

쓰이는 곳이 두 군데다.

| 위치 | 필요한 것 |
|---|---|
| 온보딩 채팅 | 칩 입력 + **전송 버튼** (스킬 목록을 채팅 답변으로 전송) |
| 프로필 폼 | 순수 컨트롤드 필드 (폼 제출은 바깥에서) |

`onSend` prop의 유무로 모드를 가른다.

```tsx
export default function SkillChipInput({
  value,          // string[] — 선택된 스킬 (controlled)
  onChange,       // (skills: string[]) => void
  onSend,         // 있으면 전송 버튼 렌더 (온보딩용), 없으면 순수 필드 (프로필용)
  placeholder = '예: React, TypeScript, AWS',
  disabled = false,
}: Props) {
```

내부 상태는 세 개뿐이다: 입력 중 텍스트(`text`), 드롭다운 하이라이트 인덱스(`highlight`), 포커스 여부(`focused`).

## Step 1: 자동완성 매칭 — 접두 일치 우선

스킬 카탈로그(~200개 상수 배열)에서 매칭하되, **접두 일치를 부분 일치보다 앞에** 둔다. `re`를 치면 `React`가 `Firebase`보다 먼저 나와야 하니까.

```tsx
const matches = useMemo(() => {
  const q = text.trim().toLowerCase()
  if (!q) return []
  const starts: string[] = []
  const includes: string[] = []
  for (const s of SKILL_SUGGESTIONS) {
    const l = s.toLowerCase()
    if (lowerSelected.has(l)) continue   // 이미 선택한 건 제외
    if (l.startsWith(q)) starts.push(s)
    else if (l.includes(q)) includes.push(s)
  }
  return [...starts, ...includes].slice(0, 8)
}, [text, lowerSelected])
```

이미 선택된 스킬은 `Set`으로 걸러서 중복 칩을 원천 차단한다. 카탈로그에 없는 스킬도 Enter나 쉼표로 자유 입력할 수 있게 해서, 자동완성은 어디까지나 "보조"다.

## Step 2: 키보드 인터랙션

이런 컴포넌트의 완성도는 키보드 처리에서 갈린다.

```tsx
function handleKeyDown(e: React.KeyboardEvent) {
  if (e.key === 'ArrowDown' && matches.length) {
    e.preventDefault()
    setHighlight(h => (h + 1) % matches.length)        // 순환
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (matches.length && text.trim()) {
      addSkill(matches[highlight])                     // 자동완성 선택
    } else if (text.trim()) {
      addSkill(text)                                   // 자유 입력 커밋
    } else if (onSend && value.length) {
      onSend(value)                                    // 빈 입력 + Enter = 전송
    }
  } else if (e.key === ',') {
    e.preventDefault()
    if (text.trim()) addSkill(text)                    // 쉼표로도 커밋
  } else if (e.key === 'Backspace' && !text && value.length) {
    removeSkill(value[value.length - 1])               // 빈 입력에서 백스페이스 = 마지막 칩 삭제
  }
}
```

Enter가 문맥에 따라 세 가지 일을 한다는 점이 핵심이다. 자동완성이 떠 있으면 선택, 텍스트만 있으면 커밋, 둘 다 없으면 전송. 실제 써보면 이게 가장 자연스럽다.

## 트러블슈팅 1: 드롭다운을 클릭하면 아무 일도 안 일어난다

첫 구현에서 드롭다운 항목에 `onClick`을 달았더니, 클릭해도 스킬이 추가되지 않았다. 원인은 이벤트 순서다.

```
마우스 클릭 → ① mousedown → ② (input에서 blur 발생) → ③ mouseup → ④ click
```

드롭다운은 `focused` 상태일 때만 렌더링되는데, **②에서 blur가 나면서 `focused`가 false가 되고, ④ click이 도착하기 전에 드롭다운이 언마운트**된다. 클릭 대상이 사라졌으니 클릭 핸들러가 안 불린다.

해결은 `click` 대신 `mousedown`을 쓰고 `preventDefault`로 blur 자체를 막는 것이다.

```tsx
<button
  type="button"
  // blur 전에 선택되도록 mousedown 사용
  onMouseDown={e => { e.preventDefault(); addSkill(s) }}
  onMouseEnter={() => setHighlight(i)}
>
  {s}
</button>
```

`e.preventDefault()`가 input의 포커스 이탈을 막아주므로, 선택 후에도 계속 타이핑할 수 있다. 자동완성 드롭다운을 만들 때 거의 반드시 만나는 문제라 기억해둘 만하다.

## 트러블슈팅 2: 입력하다 만 텍스트가 증발한다

온보딩 채팅에서 `React, Type`까지 치고 (Enter 없이) 바로 **전송 버튼**을 누르면? 칩으로 커밋된 `React`만 전송되고 `Type`은 사라진다. 유저 입장에선 분명 입력했는데 없어진 것이다.

두 군데서 방어했다.

**전송 시**: 입력칸에 남은 텍스트까지 합쳐 최종 목록을 만든다.

```tsx
// 입력칸에 남은 텍스트까지 포함해 최종 스킬 목록을 만든다 (전송 시 유실 방지)
function commitAll(): string[] {
  const pending = text.split(',').map(s => s.trim())
    .filter(s => s && !lowerSelected.has(s.toLowerCase()))
  const all = [...value, ...pending]
  if (pending.length) onChange(all)
  setText('')
  return all
}

// 전송 버튼
onClick={() => {
  const all = commitAll()
  if (all.length) onSend(all)
}}
```

`commitAll`이 목록을 **반환**하는 게 포인트다. `onChange`로 상태를 올리고 나서 `value`를 읽으면 아직 이전 값이다(setState는 비동기). 그래서 반환값을 바로 `onSend`에 넘긴다.

**blur 시**: 프로필 폼에서는 다른 필드로 이동하다 텍스트가 남을 수 있으니, blur에서도 커밋한다.

```tsx
onBlur={() => {
  setFocused(false)
  if (text.trim()) addSkill(text)  // 입력하다 만 텍스트도 칩으로 커밋
}}
```

## 자주 쓰는 패턴 요약

| 문제 | 해법 |
|---|---|
| 드롭다운 클릭이 blur에 씹힘 | `onMouseDown` + `preventDefault()` |
| 전송/제출 시 미커밋 텍스트 유실 | commit 함수가 최종 목록을 **반환**하게 하고 그걸 사용 |
| 중복 칩 | 소문자 `Set`으로 사전 필터 |
| 자동완성 정렬 | 접두 일치 → 부분 일치 순 |
| 빈 입력 + Backspace | 마지막 칩 삭제 |

## 정리

- 필요한 동작이 명확하면 칩 입력은 **200줄 이내로 직접 구현**할 만하다. 의존성 하나를 아끼고, 두 화면의 요구 차이는 `onSend?` 하나로 흡수했다
- 이런 컴포넌트의 버그는 대부분 **이벤트 순서**(mousedown → blur → click)와 **상태 타이밍**(setState 직후 stale 값)에서 나온다
- "유저가 입력한 것은 절대 조용히 버리지 않는다"를 blur와 전송 두 지점에서 보장하는 것이 체감 품질을 만든다

다음 편은 Tailwind zinc 팔레트를 브랜드 토큰으로 갈아엎는 리브랜딩 마이그레이션, 그리고 그 과정에서 조용히 사라졌던 화면을 찾은 이야기다.
