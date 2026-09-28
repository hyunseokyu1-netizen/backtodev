---
title: 'Flutter 텍스트 선택 툴바 손보기 — 전체 선택하면 사라지는 복사 버튼 고치기'
date: '2026-07-26'
publish_date: '2026-10-07'
description: 안드로이드에서 전체 선택 후 복사 툴바가 사라지고 키보드에 가려지는 문제를 Flutter contextMenuBuilder로 해결하고, 오버플로 위치까지 다잡은 과정
tags:
  - Flutter
  - Android
  - TextField
  - UX
  - contextMenuBuilder
---

## 복사하려고 전체 선택을 눌렀는데, 복사 버튼이 사라진다

[RepoNote](https://github.com/hyunseokyu1-netizen/repo-note) 메모 앱을 쓰다가
사소하지만 은근히 짜증나는 걸 발견했다. 긴 메모를 통째로 복사하려고 이렇게 했다.

1. 글자를 길게 눌러 선택 → 툴바 등장 (잘라내기 / 복사 / 붙여넣기 / 공유 / 전체 선택)
2. **"전체 선택"** 탭
3. 그런데 **툴바가 사라졌다.** 복사를 하려면 다시 화면을 눌러 툴바를 띄워야 했다.

한 번이면 넘어가는데, 글 전체를 복사·잘라내기 하려는 상황은 자주 있다. 그때마다
"전체 선택 → (툴바 사라짐) → 다시 탭 → 복사" 두 단계를 거쳐야 하니 계속 걸렸다.

찾아보니 이건 내 앱만의 문제가 아니라 **안드로이드에서 Flutter TextField의 기본
동작**이었다. "전체 선택"을 누르면 선택 영역은 확장되는데, 그 과정에서 툴바가
닫히고 자동으로 다시 열리지 않는다. 여기에 문제가 두 개 더 얽혀 있었다.

- 전체 선택을 하면 선택 영역이 화면 맨 아래까지 걸치는데, 그러면 **툴바가 키보드에
  가려서** 보이질 않았다.
- 요즘 폰엔 번역·AI 앱(Claude, DeepL, ChatGPT, Grok, Perplexity…)이 잔뜩 깔려
  있어서, 이 앱들이 텍스트 선택 메뉴에 자동으로 끼어든다. 그 바람에 **"더보기"
  목록이 화면 밖으로 잘려** 스크롤도 안 됐다.

결국 Flutter의 `contextMenuBuilder`로 이 툴바를 직접 손보기로 했다.

## 사전 지식: contextMenuBuilder가 뭔가

`TextField`(그리고 `SelectableText`, `EditableText`)에는 `contextMenuBuilder`라는
콜백이 있다. 텍스트를 선택했을 때 뜨는 그 툴바를 **내가 원하는 위젯으로 바꿔
그릴 수 있게** 해주는 통로다.

```dart
TextField(
  controller: _controller,
  contextMenuBuilder: (context, editableTextState) {
    // 여기서 원하는 툴바 위젯을 반환한다
    return AdaptiveTextSelectionToolbar.buttonItems(
      anchors: editableTextState.contextMenuAnchors,
      buttonItems: editableTextState.contextMenuButtonItems,
    );
  },
)
```

두 번째 인자 `editableTextState`가 핵심이다. 여기서 지금 필요한 걸 다 꺼낼 수 있다.

| 꺼낼 수 있는 것 | 용도 |
|---|---|
| `contextMenuButtonItems` | 잘라내기·복사·전체 선택 등 버튼 목록(각각 label·onPressed 보유) |
| `contextMenuAnchors` | 툴바가 뜰 위치(선택 영역 기준 좌표) |
| `textEditingValue` | 현재 텍스트와 선택 범위(selection) |
| `showToolbar()` / `hideToolbar()` | 툴바를 코드로 열고 닫기 |

위 기본 코드는 원래 툴바를 그대로 재현할 뿐이다. 여기서부터 하나씩 고쳐 나갔다.

## Step 1. 전체 선택 후에도 툴바를 다시 띄우기

가장 거슬렸던 "전체 선택하면 툴바가 사라지는" 문제부터. 버튼 목록을 돌면서
**"전체 선택" 버튼만** 골라, 원래 동작을 실행한 뒤 다음 프레임에 `showToolbar()`를
호출하도록 감쌌다.

```dart
final items = editableTextState.contextMenuButtonItems.map((item) {
  if (item.type != ContextMenuButtonType.selectAll) return item;

  // 전체 선택 버튼만 동작을 감싼다
  return ContextMenuButtonItem(
    label: item.label,
    type: item.type,
    onPressed: () {
      item.onPressed?.call(); // 원래 "전체 선택" 실행
      // 선택이 반영된 다음 프레임에 툴바를 다시 연다
      Future.delayed(const Duration(milliseconds: 50), () {
        if (editableTextState.mounted) editableTextState.showToolbar();
      });
    },
  );
}).toList();
```

`ContextMenuButtonType.selectAll`로 어떤 버튼이 전체 선택인지 판별하고, 나머지
버튼은 원본 그대로 넘긴다. `Future.delayed`로 한 박자 늦추는 이유는, 전체 선택이
반영되어 툴바가 닫히는 처리가 끝난 다음에 다시 열어야 하기 때문이다. 곧바로
호출하면 방금 닫히는 동작에 묻혀 효과가 없다. `mounted` 체크는 그 사이 화면을
벗어났을 때 죽지 않도록 하는 안전장치다.

이걸로 "전체 선택 → 바로 복사"가 한 번에 됐다.

## Step 2. 전체 선택하면 툴바를 화면 위로 올리기

그런데 전체 선택을 하니 새 문제가 드러났다. 선택 영역이 문서 끝(화면 아래)까지
걸치면 툴바가 그 근처, 즉 **키보드 위 아슬아슬한 곳이나 아예 키보드 뒤에** 떠서
안 보였다.

해결은 발상을 바꾸는 것이었다. 선택 영역을 따라가지 말고, **전체 선택일 때는
툴바를 화면 상단(앱바 바로 아래)에 고정**하자.

먼저 지금이 전체 선택 상태인지 판별한다. 선택 범위가 0부터 글자 수 끝까지면
전체 선택이다.

```dart
final value = editableTextState.textEditingValue;
final selection = value.selection;
final isSelectAll = selection.isValid &&
    selection.start == 0 &&
    selection.end == value.text.length &&
    value.text.isNotEmpty;
```

그리고 툴바 위치를 정하는 `TextSelectionToolbarAnchors`를, 전체 선택일 때만
화면 위쪽 좌표로 직접 지정한다.

```dart
final TextSelectionToolbarAnchors anchors;
if (isSelectAll) {
  final media = MediaQuery.of(context);
  // 상태바 + 앱바 높이만큼 내려온 지점 = 앱바 바로 아래
  final topY = media.viewPadding.top + kToolbarHeight + 12;
  anchors = TextSelectionToolbarAnchors(
    primaryAnchor: Offset(media.size.width / 2, topY),
  );
} else {
  // 부분 선택은 기존대로 선택 영역 근처에 띄운다
  anchors = editableTextState.contextMenuAnchors;
}

return AdaptiveTextSelectionToolbar.buttonItems(
  anchors: anchors,
  buttonItems: items,
);
```

`primaryAnchor`는 툴바가 붙을 기준점이다. `viewPadding.top`(상태바 높이)에
`kToolbarHeight`(앱바 기본 높이 56)를 더해서, 앱바 바로 아래에 뜨도록 했다.
가로는 화면 중앙(`width / 2`).

포인트는 **부분 선택은 건드리지 않은 것**이다. 문장 하나만 골랐을 땐 그 근처에
툴바가 뜨는 게 자연스럽다. "전체 선택처럼 화면을 크게 덮는 경우"에만 위로
올리는 게 맞다.

## Step 3. 시행착오 — 바텀시트를 만들었다가 도로 걷어냈다

세 번째 문제가 남아 있었다. 번역·AI 앱이 많이 깔린 폰에서는 "더보기(⋮)" 목록이
10개 가까이 되는데, 이게 화면 밖으로 잘려서 아래 항목이 안 보였다.

**처음 접근**: 넘치는 항목(표준 편집 버튼 외의 것들)을 따로 떼어내서, ⋮를 누르면
화면 아래에서 올라오는 **커스텀 바텀시트(스크롤 목록)**로 보여주게 만들었다.
표준 버튼(잘라내기~전체 선택)만 툴바에 남기고, AI 앱들은 시트로 몰아넣는 방식이다.

```dart
// 표준 버튼과 그 외 앱을 나눠서, 그 외는 바텀시트로
void _showExtraTextActions(List<ContextMenuButtonItem> items) {
  showModalBottomSheet(
    context: context,
    constraints: const BoxConstraints(maxHeight: 360),
    builder: (ctx) => ListView(/* 스크롤되는 앱 목록 */),
  );
}
```

동작은 했다. 그런데 만들고 보니 **과했다.** Step 2에서 툴바를 화면 위로 올리고
나니, ⋮ 목록이 아래로 펼쳐질 공간이 화면 전체만큼 생겼다. 즉 **Flutter 기본
오버플로 메뉴가 이미 잘 보일 자리**가 확보된 거였다. 굳이 바텀시트라는 다른
UI를 새로 띄울 이유가 없어졌다.

그래서 바텀시트와 항목 분리 로직을 **전부 걷어냈다.** 표준 버튼이든 AI 앱이든
그냥 다 넘기고, 넘치는 건 Flutter가 알아서 ⋮ 뒤에 모아 드롭다운으로 보여주게
맡겼다. 최종 코드는 오히려 처음보다 단순해졌다.

> 교훈: 한 곳(툴바 위치)을 고치면 다른 문제(목록 잘림)가 저절로 풀리기도 한다.
> 증상마다 개별 UI를 덧붙이기 전에, **근본 원인 하나를 옮기면 몇 개가 같이
> 해결되는지** 먼저 보는 게 낫다.

## 보너스: 하단 여백도 넣었다가 뺐다

툴바가 키보드에 가리는 걸 처음엔 다른 방법으로도 시도했었다. 편집 영역 하단에
큰 패딩(약 96px + 내비게이션 바 높이)을 줘서, 마지막 줄 아래에 툴바가 펼쳐질
공간을 억지로 확보하는 방식이다.

```dart
// 처음 시도 — 하단에 큰 여백을 강제로 넣음
padding: EdgeInsets.fromLTRB(
  12, 0, 12,
  96 + MediaQuery.of(context).viewPadding.bottom,
),
```

이건 부작용이 있었다. 평소에 글을 쓸 때도 **마지막 줄과 키보드 사이에 늘 빈
흰 여백**이 생겨서 어색했다. 툴바 문제를 Step 2(상단 앵커)로 제대로 풀고 나니
이 패딩도 필요 없어져서, 그냥 좌우 여백만 남기고 걷어냈다.

```dart
// 최종 — 자연스러운 좌우 여백만
padding: const EdgeInsets.symmetric(horizontal: 12),
```

"증상을 가리는 임시방편(여백 강제 삽입)"과 "원인을 옮기는 해법(툴바 위치 변경)"의
차이가 딱 드러난 대목이었다.

## 정리

| 문제 | 원인 | 해결 |
|---|---|---|
| 전체 선택하면 툴바가 사라짐 | 안드로이드 기본 동작, 자동 재표시 안 함 | 전체 선택 버튼 `onPressed`를 감싸 다음 프레임에 `showToolbar()` |
| 툴바가 키보드에 가림 | 선택 영역이 화면 아래까지 걸침 | 전체 선택 감지 → `TextSelectionToolbarAnchors`를 화면 상단에 고정 |
| 더보기 목록이 잘림 | AI·번역 앱이 많아 목록이 길어짐 | 상단 앵커로 공간 확보 → Flutter 기본 오버플로 그대로 사용 |
| 마지막 줄~키보드 사이 빈 여백 | 임시로 넣은 큰 하단 패딩 | 상단 앵커로 근본 해결 후 패딩 제거 |

`contextMenuBuilder`는 처음엔 낯설지만, `editableTextState` 하나만 이해하면
버튼 동작·위치·표시를 전부 내 마음대로 바꿀 수 있는 강력한 확장점이다. 모바일
텍스트 편집기를 직접 만든다면, 기본 툴바를 그대로 두지 말고 한 번쯤 이렇게
사용자 흐름에 맞게 다듬어 보길 권한다. 작은 부분이지만 매번 쓰는 동작이라
체감이 크다.
