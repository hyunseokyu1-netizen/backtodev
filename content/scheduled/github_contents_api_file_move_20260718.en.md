---
title: "There's No \"Move File\" in the GitHub API — Adding Drag-and-Drop Folder Moves to RepoNote"
date: '2026-07-18'
publish_date: '2026-12-22'
description: How I implemented file moves as create-then-delete since the GitHub Contents API has no move endpoint, plus a long-press gesture conflict and the design behind folder moves
tags:
  - Flutter
  - GitHub API
  - Drag and Drop
  - UX
  - Git
---

## I Wanted to Move Files Like Obsidian Does

After using [RepoNote](https://github.com/hyunseokyu1-netizen/repo-note) for a few days, I ran into something quietly annoying. I have a habit of just dropping notes into whatever folder and organizing them later, but moving a note meant opening the rename dialog and retyping the entire path by hand. Obsidian on mobile lets you long-press a file and drag it to move it instantly, and I missed that experience.

So I decided to build it in myself. Along the way I ran into two unexpected walls — one a fundamental limitation of the GitHub API, the other purely my own mistake.

## Step 1. There's No "Move" in the GitHub Contents API

I pulled up the REST API docs again. There's create (`PUT`), read (`GET`), and delete (`DELETE`), but **there's no endpoint at all for rename or move.** That's because Git itself treats a file as just a path string — it doesn't have a separate concept of "move" to begin with.

So there's only one way to do it: **create a file with the same content at the new path, then delete the file at the old path.**

```dart
// 1) 새 경로에 생성
final put = await _api.putFile(
  owner: vault.owner,
  repo: vault.repository,
  path: newPath,
  message: 'Move $oldPath to $newPath from mobile',
  contentBase64: GitHubContentCodec.encode(content),
  branch: vault.branch,
);

// 2) 기존 경로 삭제
await _api.deleteFile(
  owner: vault.owner,
  repo: vault.repository,
  path: oldPath,
  message: 'Move $oldPath to $newPath from mobile',
  sha: oldSha,
  branch: vault.branch,
);
```

The real problem with splitting this into two steps is that **it can fail midway.** If the new file gets created but the delete fails, the user ends up seeing "the file exists in two places." So when deletion fails, instead of silently moving past the old file, I mark it with a `pendingDelete` status and leave it in a queue so the next sync attempts the delete again.

```dart
} on AppFailure {
  // 부분 실패: 새 파일은 생성됨. 기존 파일은 삭제 대기로 남긴다.
  await _db.upsertFile(
    oldFile.toCompanion(true).copyWith(
      isDeletedLocally: const Value(true),
      syncStatus: const Value(SyncStatus.pendingDelete),
    ),
  );
  throw const ValidationFailure(ValidationErrorKind.renamePartialFailure);
}
```

For what it's worth, this pattern wasn't actually new — I'd already run into the exact same problem while building the rename feature, since renaming a file is ultimately just "creating the same file at a different path" too. So this time I merged everything into a single shared function, `_movePath(oldPath, newPath)`, and made renaming, folder moves, and file moves all route through this one function. The same problem only needs to be solved in one place.

## Step 2. Long-Pressing Opens a Menu Instead of Starting a Drag

After building the whole feature and testing it on the phone, no matter how long I held down on a file, the drag never started — the rename/delete menu popped up first.

The cause was obvious. The same widget had **two long-press gestures attached.**

```dart
// Before — 제스처가 충돌한다
InkWell(
  onTap: () => _openFile(entry),
  onLongPress: () => _showEntryActions(entry),  // 메뉴
  child: ...,
)
```

On top of that, wrapping it in `LongPressDraggable` to add the drag feature meant the menu and the drag were both competing for the same long-press event. Flutter grabbed the inner `InkWell`'s gesture first, so the event never reached the drag.

The fix was to split the gestures apart entirely. **Hand long-press over to the drag exclusively, and move the menu to a visible button.**

```dart
// After — 역할을 분리
InkWell(
  onTap: () => _openFile(entry),
  // onLongPress 제거
  child: Row(
    children: [
      /* ...파일명... */
      InkWell(
        onTap: () => _showEntryActions(entry),  // 메뉴는 여기로
        child: Icon(Icons.more_vert),
      ),
    ],
  ),
)
```

```dart
return LongPressDraggable<BrowserEntry>(
  data: entry,
  feedback: /* 드래그 중 손가락 따라다니는 카드 */,
  child: content,
);
```

After adding a `⋮` button to the right of each file row, things got much clearer. Long-press means "move," tapping the three dots means "menu" — the two actions no longer overlap. I relearned that when designing gestures, you should first list out how many distinct inputs a widget needs to respond to, and if any overlap, unconditionally split them onto different triggers.

## Step 3. Deciding Not to Make Folders Draggable

File dragging worked fine, but I had to think about whether to make folders draggable too. Obsidian lets you drag folders too, so it seemed like the natural thing to do. But thinking it through, moving a folder carries a different risk than moving a file.

Moving a folder ultimately means creating and deleting every single file in it, one by one, at the new path. Move a folder with 20 files in it, and you get 40 commits (20 creates + 20 deletes). It's also awkward to cancel partway through an accidental drag, and it's easy to hit GitHub's rate limit. I wanted to avoid a situation where "an accidental bump kicks off a huge operation."

So instead of drag, I made folder moves an **explicit menu action.**

1. Long-pressing a folder opens a menu (unlike files, folders keep their long-press menu)
2. Select **"Move to folder…"** from the menu
3. A dialog for picking a target folder appears (browsing the repo live)
4. A confirmation message like **"This will move 12 files. A commit will be created for each file"** is shown, and you have to consent
5. Only once confirmed does it recursively move every file underneath

```dart
Future<int> moveFolder(
  VaultConfig vault,
  String folderPath,
  String targetParentDir, {
  List<String>? files,
}) async {
  // 자기 자신이나 하위 폴더로는 옮길 수 없다
  if (targetParentDir == folderPath ||
      targetParentDir.startsWith('$folderPath/')) {
    throw const ValidationFailure(ValidationErrorKind.moveIntoSelf);
  }

  final list = files ?? await filesUnder(vault, folderPath);
  for (final oldPath in list) {
    final rel = oldPath.substring(folderPath.length);
    await _movePath(vault, oldPath, '$newFolderPath$rel');
  }
  return list.length;
}
```

The principle I came away confident about this time is that, even within the same app, "light, easily-reversed actions" and "heavy, hard-to-reverse actions" should use different triggers. Moving a single file is kept light via drag, while moving an entire folder goes through several steps to guard against mistakes.

## Bonus: Recovering an Old Version's Build File I Thought I'd Deleted

After finishing the feature and getting ready to upload to the store, I later realized I'd accidentally deleted the build file for an old version (1.0.1). I needed to rebuild it, but the problem was that my current working directory had already moved on to the latest code (1.0.2). I could just `git checkout` back to the old commit and come back, but that risks scrambling the files I was working on (generated code, build cache).

This is a good situation for **`git worktree`.** It lets you check out the same repository into a different folder, simultaneously.

```bash
# 1.0.1 커밋을 찾는다
git log --oneline -- pubspec.yaml
# 82f32a8 chore: 버전 1.0.1+2 및 CHANGELOG 추가

# 별도 폴더에 그 시점을 통째로 체크아웃
git worktree add /tmp/reponote-1.0.1-build 82f32a8

# 거기서 독립적으로 빌드
cd /tmp/reponote-1.0.1-build
flutter pub get
flutter build appbundle --release

# 끝나면 정리
git worktree remove /tmp/reponote-1.0.1-build --force
```

I could build the old version in a completely separate folder without touching the branch I'd originally been working on at all. No need for the tedious back-and-forth of stash → checkout → build → checkout back → stash pop. I really felt this time that `git worktree` is the answer for situations like "leave what I'm currently working on exactly as it is, and just briefly build code from a different point in time."

## Wrap-Up

| Problem | Cause | Fix |
|---|---|---|
| GitHub has no file-move API | The Contents API only supports create/read/delete | Create at the new path → delete the old path, queue a pending delete on failure |
| Long-press doesn't start a drag | The menu (`onLongPress`) and the drag compete for the same trigger | Long-press goes exclusively to drag; menu moved to a `⋮` button |
| Should folders be draggable too? | Moving a folder = 2 commits per file, hard to undo | A menu action instead of drag + a file-count confirmation dialog |
| Recovering a deleted old build file | Need to rebuild an old version while the current code has already moved on | Check out the old commit into a separate folder with `git worktree` and build there |

What I learned from all of this boils down to one thing: whether it's an API constraint or a UI gesture, don't force your way around something overlapping or missing — **split the structure apart first.** Splitting a move into create + delete, splitting a gesture into drag and tap, splitting file moves and folder moves into light and heavy actions — it was all the same principle.
