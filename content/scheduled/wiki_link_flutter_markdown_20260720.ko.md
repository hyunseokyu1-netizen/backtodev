---
title: 'Flutter 마크다운 미리보기에서 [[위키링크]]를 탭 가능한 칩으로 만들기'
date: '2026-07-20'
publish_date: '2026-09-29'
description: flutter_markdown_plus의 커스텀 InlineSyntax와 ElementBuilder로 Obsidian 위키링크를 원문 수정 없이 칩 UI로 렌더링하고 노트 간 이동까지 붙인 구현기, 그리고 보기 모드를 기본값으로 바꾼 UX 판단
tags:
  - Flutter
  - Markdown
  - Obsidian
  - flutter_markdown
  - UX
---

## 위키링크가 그냥 대괄호 텍스트로 보인다

[RepoNote](https://github.com/hyunseokyu1-netizen/repo-note)는 GitHub 저장소를
Obsidian Vault처럼 쓰는 메모 앱이다. 그동안 기능을 하나씩 붙여왔는데, 미리보기
화면을 볼 때마다 거슬리는 게 하나 있었다.

Obsidian 노트에는 이런 문법이 자주 나온다.

```markdown
관련 노트: [[독서 노트]] [[앱 아이디어|아이디어 모음]]
```

Obsidian에서는 이게 클릭 가능한 링크로 보이지만, 표준 마크다운 문법이 아니라서
일반 마크다운 렌더러는 **대괄호까지 통째로 그냥 텍스트로** 출력한다. 내 앱의
미리보기도 마찬가지였다. `[[독서 노트]]`라는 글자가 그대로 박혀 있으니 노트가
지저분해 보이고, 무엇보다 **탭해도 아무 일도 일어나지 않는다.**

이번에 이걸 제대로 만들었다. 미리보기에서 위키링크가 둥근 칩(chip)으로 보이고,
탭하면 그 노트로 바로 이동한다. 핵심 제약은 하나 — **원문 마크다운은 한 글자도
건드리지 않는다.** 같은 파일을 PC의 Obsidian에서도 여니까, 렌더링만 바꾸고
소스는 그대로 둬야 한다.

## 사전 지식: flutter_markdown의 확장 포인트 두 개

Flutter에서 마크다운을 그릴 때 흔히 쓰는 `flutter_markdown`(나는 유지보수가
이어지는 fork인 `flutter_markdown_plus`를 쓴다)은 내부적으로 Dart의
`markdown` 패키지로 파싱한다. 이 조합에는 커스텀 문법을 끼워 넣는 공식 통로가
두 개 있다.

| 확장 포인트 | 역할 | 내가 쓴 용도 |
|---|---|---|
| `md.InlineSyntax` | 정규식으로 텍스트를 매칭해 커스텀 AST 노드 생성 | `[[...]]`을 `wikilink` 엘리먼트로 변환 |
| `MarkdownElementBuilder` | 특정 태그의 AST 노드를 위젯으로 렌더링 | `wikilink` 엘리먼트를 칩 위젯으로 그리기 |

즉 파이프라인은 이렇게 흐른다.

```text
원문 텍스트
  → InlineSyntax가 [[...]] 매칭 → <wikilink target="...">표시명</wikilink> 노드
  → ElementBuilder가 wikilink 노드를 만나면 → 칩 위젯 반환
```

파서 단계에서 원문을 바꾸는 게 아니라 **파싱 결과 트리에 커스텀 노드를 하나
추가**하는 것뿐이라, 소스 파일은 완전히 무사하다.

## Step 1. InlineSyntax로 [[...]] 매칭하기

```dart
import 'package:markdown/markdown.dart' as md;

class WikiLinkSyntax extends md.InlineSyntax {
  WikiLinkSyntax() : super(r'!?\[\[([^\[\]]+)\]\]');

  @override
  bool onMatch(md.InlineParser parser, Match match) {
    final inner = match[1]!.trim();
    final parts = inner.split('|');
    final target = parts.first.trim();
    final display = (parts.length > 1 ? parts[1] : parts.first).trim();

    final element = md.Element.text('wikilink', display);
    element.attributes['target'] = target;
    element.attributes['embed'] = match[0]!.startsWith('!') ? '1' : '0';
    parser.addNode(element);
    return true;
  }
}
```

정규식 `!?\[\[([^\[\]]+)\]\]` 하나에 Obsidian 문법 세 가지가 담겨 있다.

1. `[[독서 노트]]` — 기본 링크. target과 display가 같다.
2. `[[앱 아이디어|아이디어 모음]]` — 별칭 문법. `|` 앞이 이동 대상, 뒤가 표시명.
3. `![[이미지.png]]` — 임베드 문법. 맨 앞 `!?`로 잡아서 `embed` 속성으로 구분해둔다.

`md.Element.text('wikilink', display)`로 만든 노드는 HTML로 치면
`<wikilink>` 같은 가상 태그다. 이동에 필요한 원래 대상 이름은 `attributes`에
따로 실어 보낸다. 표시명과 이동 대상이 다를 수 있기 때문에(별칭 문법) 이 분리가
필요하다.

## Step 2. ElementBuilder로 칩 위젯 그리기

```dart
class WikiLinkBuilder extends MarkdownElementBuilder {
  WikiLinkBuilder({required this.colorScheme, required this.onTap});

  final ColorScheme colorScheme;
  final void Function(String target) onTap;

  @override
  Widget? visitElementAfter(md.Element element, TextStyle? preferredStyle) {
    final target = element.attributes['target'] ?? element.textContent;
    final isEmbed = element.attributes['embed'] == '1';

    return GestureDetector(
      onTap: () => onTap(target),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: colorScheme.secondaryContainer,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isEmbed ? Icons.attachment_outlined : Icons.description_outlined,
              size: 14,
              color: colorScheme.onSecondaryContainer,
            ),
            const SizedBox(width: 4),
            Text(element.textContent,
                style: TextStyle(
                  color: colorScheme.onSecondaryContainer,
                  fontWeight: FontWeight.w600,
                )),
          ],
        ),
      ),
    );
  }
}
```

색을 하드코딩하지 않고 `ColorScheme.secondaryContainer`를 쓰면 라이트/다크
테마 전환 시 칩도 자연스럽게 따라간다. 임베드(`![[...]]`)는 문서 아이콘 대신
첨부 아이콘을 보여줘서 살짝 구분했다.

연결은 `Markdown` 위젯에 두 클래스를 등록하면 끝이다.

```dart
Markdown(
  data: noteContent,
  inlineSyntaxes: [WikiLinkSyntax()],
  builders: {
    'wikilink': WikiLinkBuilder(
      colorScheme: Theme.of(context).colorScheme,
      onTap: _openWikiLink,
    ),
  },
)
```

## Step 3. 탭하면 어느 노트로 갈지 — Obsidian 방식의 매칭

칩을 탭했을 때 어떤 파일을 열어야 할까? Obsidian의 규칙을 따라갔다.
`[[독서 노트]]`는 **경로가 아니라 파일명(basename) 기준**으로 매칭된다.
`책/독서 노트.md`에 있든 루트에 있든 이름만 맞으면 연결된다.

```dart
Future<NoteFile?> findByWikiName(VaultConfig vault, String target) async {
  final t = target.toLowerCase();
  final tMd = t.endsWith('.md') ? t : '$t.md';
  final files = await _db.filesInVault(vault.id);

  NoteFile? nameMatch;
  for (final f in files) {
    if (f.isDeletedLocally) continue;
    final path = f.path.toLowerCase();
    if (path == tMd || path == t) return f;        // 1순위: 전체 경로 일치
    final name = f.name.toLowerCase();
    if (name == tMd || name == t) nameMatch ??= f;  // 2순위: 파일명 일치
    if (t.contains('/') && path.endsWith('/$tMd')) nameMatch ??= f; // 경로 접미사
  }
  return nameMatch;
}
```

우선순위를 3단계로 뒀다.

1. **전체 경로 일치** — `[[책/독서 노트]]`처럼 경로째 쓴 경우
2. **파일명 일치** — 가장 흔한 `[[독서 노트]]` 케이스
3. **경로 접미사 일치** — `[[하위폴더/노트]]`가 더 깊은 폴더 안에 있는 경우

`.md` 확장자는 붙였든 안 붙였든 다 받아준다. 매칭되는 노트가 없으면 화면 이동
대신 "노트를 찾을 수 없습니다" 스낵바만 띄운다 — 아직 안 만든 노트를 링크만
먼저 걸어두는 Obsidian 습관을 깨뜨리지 않기 위해서다.

## 보너스 판단: 보기 모드를 기본값으로

이 기능을 만들면서 같이 바꾼 게 하나 더 있다. 원래는 노트를 열면 **편집 모드**로
시작했는데, 이걸 **보기(미리보기) 모드 기본**으로 뒤집었다.

이유는 단순하다. 폰에서 내 사용 패턴을 되짚어 보니 **노트를 여는 10번 중 8번은
읽으려고 여는 것**이었다. 지하철에서 할 일 목록 확인하기, 회의 전에 메모 훑기 —
전부 읽기다. 그런데 편집 모드로 열리면:

- 커서가 잡히면서 키보드가 올라와 화면 절반을 가리고
- 체크박스도 인용문도 렌더링 안 된 날 것의 마크다운이 보이고
- 이번에 만든 위키링크 칩도 당연히 안 보인다

읽기가 기본이고 쓰기가 예외라면, 기본값도 거기에 맞추는 게 맞다.

단, 예외를 하나 뒀다. **내용이 빈 노트는 편집 모드로 연다.**

```dart
// 내용이 없는 새 노트는 바로 쓸 수 있게 편집 모드로 연다.
if (note.content.trim().isEmpty) _preview = false;
```

방금 "새 메모"를 눌러 만든 빈 노트에서 빈 미리보기를 보여주는 건 의미가 없다.
그 순간만큼은 사용자의 의도가 100% "쓰기"니까. 기본값을 정할 때는 "평균적으로
뭘 하러 오는가"를 따르되, **의도가 명백한 순간에는 예외를 두는 것** — 이번에
체감한 기본값 설계의 요령이다.

## 정리

| 항목 | 선택 | 이유 |
|---|---|---|
| 문법 인식 | `md.InlineSyntax` + 정규식 | 원문 수정 없이 파스 트리에만 개입 |
| 렌더링 | `MarkdownElementBuilder` → 칩 위젯 | 테마 색 연동, 탭 이벤트 부착 |
| 별칭/임베드 | `[[대상\|별칭]]` 분리, `![[...]]` 아이콘 구분 | Obsidian 문법 호환 |
| 노트 매칭 | 경로 일치 → 파일명 일치 → 접미사 일치 | Obsidian의 basename 매칭 방식 |
| 링크 없는 대상 | 스낵바 안내만 | "미리 걸어두는 링크" 습관 존중 |
| 기본 모드 | 보기 모드 (빈 노트만 편집) | 모바일에서는 읽기가 쓰기보다 잦다 |

마크다운 렌더러에 커스텀 문법을 넣는 일은 처음엔 막막해 보이지만, 결국
"**정규식 하나(InlineSyntax) + 위젯 하나(ElementBuilder)**"의 조합이다.
Obsidian 위키링크뿐 아니라 `#태그` 하이라이트, `==형광펜==` 같은 비표준 문법도
같은 패턴으로 전부 붙일 수 있다. 원문을 절대 건드리지 않는다는 원칙만 지키면,
다른 앱과 파일을 공유하는 상황에서도 안심하고 렌더링을 꾸밀 수 있다.
