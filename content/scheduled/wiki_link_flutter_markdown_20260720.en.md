---
title: 'Turning [[Wiki Links]] into Tappable Chips in a Flutter Markdown Preview'
date: '2026-07-20'
publish_date: '2026-12-31'
description: Rendering Obsidian wiki links as tappable chips in a Flutter markdown preview, using flutter_markdown_plus's custom InlineSyntax and ElementBuilder without touching the source text, plus a UX call to make preview mode the default
tags:
  - Flutter
  - Markdown
  - Obsidian
  - flutter_markdown
  - UX
---

## Wiki Links Just Show Up as Plain Bracket Text

[RepoNote](https://github.com/hyunseokyu1-netizen/repo-note) is a note-taking app that treats a GitHub
repo like an Obsidian Vault. I've been adding features to it one by one, and there was one thing that kept
bugging me every time I looked at the preview screen.

Obsidian notes frequently contain syntax like this.

```markdown
관련 노트: [[독서 노트]] [[앱 아이디어|아이디어 모음]]
```

In Obsidian this renders as a clickable link, but since it's not standard Markdown syntax, a regular
markdown renderer **prints the brackets and everything inside them as plain text.** My app's preview did
the exact same thing. The literal characters `[[독서 노트]]` just sit there making the note look messy,
and worse, **tapping it does absolutely nothing.**

This time I fixed it properly. In the preview, wiki links now show up as rounded chips, and tapping one
jumps straight to that note. There was one core constraint — **not a single character of the source
markdown gets touched.** The same file also gets opened in desktop Obsidian, so only the rendering should
change; the source has to stay exactly as it is.

## Background: Two Extension Points in flutter_markdown

The package commonly used to render markdown in Flutter — `flutter_markdown` (I use
`flutter_markdown_plus`, a fork that's still actively maintained) — internally parses with Dart's
`markdown` package. This combination offers two official extension points for plugging in custom syntax.

| Extension point | Role | How I used it |
|---|---|---|
| `md.InlineSyntax` | Matches text with a regex and produces a custom AST node | Converts `[[...]]` into a `wikilink` element |
| `MarkdownElementBuilder` | Renders a specific tag's AST node as a widget | Draws the `wikilink` element as a chip widget |

So the pipeline flows like this.

```text
원문 텍스트
  → InlineSyntax가 [[...]] 매칭 → <wikilink target="...">표시명</wikilink> 노드
  → ElementBuilder가 wikilink 노드를 만나면 → 칩 위젯 반환
```

Nothing about the source text changes at the parsing stage — it's just **adding one custom node to the
resulting parse tree** — so the source file stays completely untouched.

## Step 1. Matching [[...]] With InlineSyntax

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

The single regex `!?\[\[([^\[\]]+)\]\]` packs in three pieces of Obsidian syntax.

1. `[[독서 노트]]` — a basic link. Target and display are the same.
2. `[[앱 아이디어|아이디어 모음]]` — the alias syntax. Whatever's before the `|` is the navigation target,
   and after it is the display name.
3. `![[이미지.png]]` — the embed syntax. Caught up front by the `!?`, and distinguished afterward via the
   `embed` attribute.

A node created with `md.Element.text('wikilink', display)` is, in HTML terms, something like a virtual
`<wikilink>` tag. The original target name needed for navigation gets carried separately in
`attributes`. This separation is necessary because the display name and the navigation target can differ
(the alias syntax).

## Step 2. Drawing the Chip Widget With ElementBuilder

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

Using `ColorScheme.secondaryContainer` instead of a hardcoded color means the chip automatically follows
along when the theme switches between light and dark. Embeds (`![[...]]`) get an attachment icon instead
of a document icon, for a small visual distinction.

Wiring it up just means registering both classes on the `Markdown` widget.

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

## Step 3. Where Does Tapping It Go — Matching It Obsidian's Way

What file should open when you tap a chip? I followed Obsidian's own rule here.
`[[독서 노트]]` is matched **by filename (basename), not by path.** Whether it lives in `책/독서 노트.md`
or at the root, matching names is all that's needed to connect them.

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

I set up a 3-tier priority.

1. **Full path match** — for cases like `[[책/독서 노트]]` that specify the whole path
2. **Filename match** — the most common case, `[[독서 노트]]`
3. **Path suffix match** — for when `[[하위폴더/노트]]` actually lives in a deeper folder

Whether or not the `.md` extension is written out, both are accepted. If no matching note is found,
instead of navigating anywhere, it just shows a "Note not found" snackbar — this preserves the Obsidian
habit of linking to a note you haven't written yet.

## A Bonus Decision: Making View Mode the Default

There was one more thing I changed alongside building this feature. Previously, opening a note started
you in **edit mode**, and I flipped that to **view (preview) mode as the default.**

The reason is simple. Looking back at my own usage patterns on the phone, **8 out of 10 times I open a
note, it's to read it.** Checking a to-do list on the subway, skimming notes before a meeting — all
reading. But opening in edit mode meant:

- The cursor grabs focus and the keyboard pops up, covering half the screen
- Checkboxes and blockquotes show up unrendered, as raw markdown
- And naturally, the wiki-link chips I just built don't show up either

If reading is the default use case and writing is the exception, the default behavior should match that.

That said, I kept one exception. **A note with no content opens in edit mode.**

```dart
// 내용이 없는 새 노트는 바로 쓸 수 있게 편집 모드로 연다.
if (note.content.trim().isEmpty) _preview = false;
```

Showing an empty preview for a note you just created by tapping "New note" is pointless. In that exact
moment, the user's intent is 100% "writing." When deciding on a default, follow "what people do on
average," but **carve out exceptions for moments where intent is obvious** — that's the lesson on default
design I came away with this time.

## Wrap-Up

| Item | Choice | Reason |
|---|---|---|
| Syntax recognition | `md.InlineSyntax` + regex | Intervenes only in the parse tree, never touches the source |
| Rendering | `MarkdownElementBuilder` → chip widget | Hooks into theme colors, attaches a tap event |
| Alias/embed | Split `[[target\|alias]]`, distinguish `![[...]]` with an icon | Compatible with Obsidian syntax |
| Note matching | Path match → filename match → suffix match | Matches Obsidian's basename-matching behavior |
| Unlinked targets | Snackbar notice only | Respects the habit of linking ahead of time |
| Default mode | View mode (edit only for empty notes) | Reading happens more often than writing on mobile |

Adding custom syntax to a markdown renderer looks intimidating at first, but in the end it boils down to
"**one regex (InlineSyntax) + one widget (ElementBuilder).**" The same pattern can handle not just
Obsidian wiki links but other non-standard syntax too, like `#tag` highlighting or `==highlighter==`
marks. As long as you hold to the rule of never touching the source text, you can decorate the rendering
with confidence, even when you're sharing files with other apps.
