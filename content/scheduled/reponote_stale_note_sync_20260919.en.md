---
title: 'Fixing a Bug in My GitHub-Synced Note App (1/2) — Notes I Moved on Desktop Kept Lingering in the App'
date: '2026-09-19'
publish_date: '2027-01-01'
description: Tracking down why a note moved to a different folder on desktop kept showing up in both places on the phone app, and fixing it by checking sync status instead of just whether a local file is missing from the server
tags:
  - Flutter
  - drift
  - GitHub API
  - Sync
  - RepoNote
---

## Gone After Clearing the Cache, but Still There Before That

[RepoNote](https://github.com/hyunseokyu1-netizen/repo-note) is an app for viewing and editing, on your
phone, Obsidian notes that live in a GitHub repo. I write in Obsidian on the PC, read or make quick edits
in this app on the phone, and the two sides meet through GitHub.

But something odd started showing up a while back.

1. In desktop Obsidian, drag `inbox/idea.md` into the `archive/` folder
2. Commit and push with Git
3. Open the app on the phone and refresh (sync)
4. **The note now exists in `archive/` too — but it's still sitting in `inbox/`**

The same note showing up in two places. Only hitting "Clear cache" in settings would make the `inbox/`
copy disappear. In other words, the server (GitHub) was fine — **the local metadata the app was holding
onto just wasn't getting cleaned up.**

This happens often enough that "just clear the cache" isn't an acceptable answer. Tidying up note folders
in Obsidian is something I do all the time, and it makes no sense to have to clear the cache and re-check
the login state on the phone every time I do. This 1.0.5 update fixes it.

## Background: Why Does This App Keep a Local DB at All?

Understanding the cause requires knowing a bit about the app's structure. RepoNote pulls the file list
and contents through the GitHub Contents API, but instead of rendering that directly to the screen, it
**writes it once into a local SQLite DB (drift) first.** There are three reasons for this.

| Why a local DB is needed | What would happen without it |
|---|---|
| The list and content need to show up even offline | Blank screen on the subway |
| Edits made on the phone need to be kept as a "draft" until uploaded to the server | Kill the app and your edits vanish |
| Files whose state differs from the server (newly created on the phone, scheduled for deletion, etc.) still need to be shown | They wouldn't appear in the list before being uploaded |

So every file gets tagged with a `syncStatus`.

| Status | Meaning |
|---|---|
| `synced` | Matches the server. No local edits |
| `localOnly` | Created on the phone and not on the server yet |
| `pendingUpload` | Exists on the server too, but there's an edit made on the phone |
| `pendingDelete` | Deleted on the phone, waiting for the server to catch up |
| `conflict` | The phone and the server diverged |

This structure itself isn't the problem. The problem was in the part that merges the "server list" and
the "local DB" together to draw the screen.

## Step 1: Tracing the Code That Builds the Folder List

When the file browser opens a folder, it calls `NotesRepository.listRemote()`. The flow goes like this.

1. Get the list of entries for that folder from the GitHub API
2. For every `.md` file, insert it as `synced` if it's missing from the DB, or just refresh its SHA if it's already there
3. Then — and this is where the culprit is — **merge local DB files that aren't on the server list into the result**

The code before the fix looked like this.

```dart
// 서버 목록에 없는 로컬 전용/삭제 대기 파일 병합
final locals = await _listLocalFiles(vault, dirPath);
final remotePaths = result.map((e) => e.fullPath).toSet();
for (final l in locals) {
  if (!remotePaths.contains(l.fullPath)) result.add(l);
}
return result;
```

The intent is right there in the comment. A `localOnly` file created on the phone isn't on the server, so
relying only on the server list would make it invisible. Hence: "also show local files that aren't on the
server."

But the condition is only **"not on the server"** — nothing else. It doesn't look at status. A `synced`
file that disappeared from the server because it got moved on the PC is, by this logic, also "a local
file not on the server," so it goes straight into the result. And since nothing ever deletes the DB row,
it keeps showing up on the next refresh, and the one after that. "Clear cache" happened to wipe out
`synced` rows wholesale, which is the only reason it ever went away.

## Step 2: So When Should It Actually Be Deleted?

The fact alone that "it's not on the server" isn't enough — I needed to distinguish **why** it's not on
the server, by status.

| Status of a local file missing from the server | Interpretation | Handling |
|---|---|---|
| `synced` + no edit draft | Moved or deleted somewhere else (the PC) | **Clean it up locally** |
| `localOnly` | Created on the phone, not uploaded yet | Keep |
| `pendingUpload` | Gone from the server, but there's an edit on the phone | Keep (handle as a conflict at sync time) |
| `pendingDelete` | Deleted on the phone, waiting on the server | Keep (hide from the list) |
| `conflict` | Not yet resolved by the user | Keep |

The key is the first row. `synced` means "it matched the server the last time it was checked," and if a
file like that is now missing from the server, it's the server side that changed. There's nothing edited
on the phone, so there's nothing to lose by deleting it.

Everything else, on the other hand, is a state where **the phone still holds information that hasn't
made it to the server yet.** Delete those and the user's own content disappears. So they're left alone.

## Step 3: Fixing the Code

I started with a judgment function. A file only counts as "safe to clean up" if it's `synced` and has no
dirty draft.

```dart
/// 서버에는 없지만 로컬에 동기화 완료로 남아 있고 수정 초안도 없는 파일인지.
Future<bool> _isStaleSynced(String fileId) async {
  final file = await _db.getFile(fileId);
  if (file == null || file.syncStatus != SyncStatus.synced) return false;
  final draft = await _db.getDraft(fileId);
  return draft == null || !draft.isDirty;
}
```

The cleanup function wipes the cached file, draft, sync jobs, conflict record, and metadata row all at
once. Code like this already existed separately in `markDelete()`, so I consolidated it into one place.

```dart
/// 파일의 로컬 흔적(캐시·초안·작업·충돌·메타데이터)을 모두 지운다.
Future<void> _purgeLocal(String fileId) async {
  final file = await _db.getFile(fileId);
  if (file == null) return;
  await _cache.delete(file.vaultId, file.path);
  await _db.deleteDraft(fileId);
  await _db.deleteJobsForFile(fileId);
  await _db.deleteConflict(fileId);
  await _db.deleteFileRow(fileId);
}
```

And I added the condition into the merge loop.

```dart
final remotePaths = result.map((e) => e.fullPath).toSet();
final remoteDirs = result.where((e) => e.isDir).map((e) => e.name).toSet();
final locals = await _listLocalFiles(vault, dirPath);
for (final l in locals) {
  if (remotePaths.contains(l.fullPath)) continue;
  final id = l.fileId;
  if (id != null && await _isStaleSynced(id)) {
    await _purgeLocal(id);   // 서버에서 사라진 synced 파일 → 정리
    continue;
  }
  result.add(l);             // 그 외(로컬 전용·대기 중)는 그대로 표시
}
await _purgeStaleInMissingDirs(vault, dirPath, remoteDirs);
```

### When a Whole Folder Gets Moved

There was one more thing I had to account for here. What happens when, instead of a single file, an
entire folder gets moved — `inbox/` → `archive/inbox/`?

Refreshing the root means the server list no longer has an `inbox` folder in it. The loop above only looks
at "direct children of that folder," so a nested file like `inbox/idea.md` never even gets checked. On
screen the folder just disappears, so at a glance everything looks fine — but it's still sitting in the
DB, so **search and `[[wiki link]]` navigation keep pointing at the stale path.**

So I added a function that also cleans up "`synced` files that belong to a subfolder that's gone from the
server."

```dart
Future<void> _purgeStaleInMissingDirs(
  VaultConfig vault, String dirPath, Set<String> remoteDirs,
) async {
  final prefix = dirPath.isEmpty ? '' : '$dirPath/';
  final files = await _db.filesInVault(vault.id);
  for (final f in files) {
    if (!f.path.startsWith(prefix)) continue;
    final rest = f.path.substring(prefix.length);
    final slash = rest.indexOf('/');
    if (slash < 0) continue;                              // 직접 자식은 위에서 처리됨
    if (remoteDirs.contains(rest.substring(0, slash))) continue; // 폴더가 서버에 있으면 통과
    if (await _isStaleSynced(f.id)) await _purgeLocal(f.id);
  }
}
```

If the path's first segment (`inbox`) isn't in the server's folder list, every `synced` file underneath
it is fair game for cleanup. This also goes through `_isStaleSynced`, so files still being edited on the
phone stay safe.

## Step 4: How Did I Confirm the Fix Actually Worked?

Trying it once on the phone after the fix tells you "yes, it works." The harder part is confirming, by
hand, that this logic **doesn't delete things it shouldn't.** A file with an edit draft in progress, a
local-only file not uploaded yet, a file scheduled for deletion... there are five possible cases, and
getting even one of them wrong means the user's own writing disappears.

So I wrote 6 tests that reproduce "move it on the PC → refresh in the app" in code. They run without any
real network and without any real SQLite file.

| Test | What it checks |
|---|---|
| A note moved to a different folder | Does it disappear from its old location |
| A whole folder moved | Does refreshing just the parent folder also clean up nested file metadata |
| A file with an edit draft | Does it **survive** even if missing from the server |
| A local-only file | Does it survive even if missing from the server |
| A file pending deletion | Is it hidden from the list but still present in the DB |
| `markDelete` | Does a local-only file get its draft fully cleaned up too |

One of the tests looks like this. The line that touches `api.tree` is the equivalent of "moved it on the
PC and pushed."

```dart
test('PC에서 다른 폴더로 옮긴 노트는 목록 갱신 시 이전 위치에서 사라진다', () async {
  await repo.listRemote(vault, 'inbox');
  expect(await localPaths(), contains('inbox/note.md'));

  // PC에서 inbox/note.md → archive/note.md 로 이동 후 push
  api.tree['inbox'] = [];
  api.tree['archive'] = ['note.md'];

  final inbox = await repo.listRemote(vault, 'inbox');
  expect(inbox.map((e) => e.fullPath), isNot(contains('inbox/note.md')));
  expect(await localPaths(), isNot(contains('inbox/note.md')));

  final archive = await repo.listRemote(vault, 'archive');
  expect(archive.map((e) => e.fullPath), contains('archive/note.md'));
});
```

What mattered was confirming that this test **actually catches this bug.** I reverted just the one fixed
file back to the pre-fix commit and ran it.

```bash
git checkout dcc1096^ -- lib/features/file_browser/data/notes_repository.dart
flutter test test/features/file_browser/notes_repository_test.dart
```

The 2 move-related tests fail, exactly as expected.

```text
00:00 +0 -1: PC에서 다른 폴더로 옮긴 노트는 … [E]
  Expected: not contains 'inbox/note.md'
    Actual: MappedListIterable<BrowserEntry, String>:['inbox/note.md']

00:00 +0 -2: 폴더째 옮긴 경우 상위 폴더 갱신 시 … [E]
  Expected: not contains 'inbox/note.md'
    Actual: Set:['inbox/note.md', 'root.md']
```

The other 4 ("should survive") tests pass even before the fix. In other words, these two failures point
precisely at this bug. Restoring the file makes all 6 pass. This one check is what separates "the test
passes" from "the test actually means something."

Setting up an environment where these tests **can even run** — an in-memory DB, a fake GitHub API, and
injecting the file cache path — is a long enough story that I covered it separately in
[Part 2](/posts/reponote_repository_test_harness_20260924).

## Troubleshooting: Signature Mismatch When Installing on My Phone

I hit a wall trying to push the fixed build straight onto my phone.

```text
adb: failed to install app-release.apk: Failure
[INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.backdev.reponote
 signatures do not match newer version; ignoring!]
```

What was installed on the phone was **the version downloaded from the Play Store.** With Play App
Signing, Google re-signs the AAB I upload with its own key before distributing it. So even a local APK
built with the same keystore counts, from the phone's perspective, as "a different signature," and the
install gets rejected as an overwrite attempt.

`dumpsys package` makes this obvious right away.

```bash
adb shell dumpsys package com.backdev.reponote | grep installer
#   installerPackageName=com.android.vending   ← Play 스토어 설치본
```

The only fix is to uninstall and reinstall, which means **all app data (tokens, settings, unsynced
drafts) gets wiped.** Since all my notes live on GitHub anyway, all I had to do was log back in — but if
there had been any unsynced drafts, I would have lost them. It's more convenient to just never install
the Play Store version on a device you're using for local test builds in the first place.

## Wrap-Up

| Stage | One-line summary |
|---|---|
| Symptom | A note moved on the PC lingers in the app list; only clearing the cache makes it disappear |
| Cause | Local files "missing from the server" were all merged into the list regardless of status |
| Decision rule | `synced` + no edit draft = gone from the server → clean up / everything else = has info not yet reflected on the phone → keep |
| Extra handling | Also cleans up nested file metadata when a whole folder is moved (prevents search/wiki-link pollution) |
| Verification | 6 scenario tests with an in-memory drift DB + Fake API, confirmed failures against the pre-fix code |

There's one lesson in this bug. **When merging a local cache with the server, don't just look at
"missing" — look at "why it's missing."** Whether something is missing from the server because "it
hasn't been uploaded yet" or because "it was deleted over there" calls for exactly opposite handling, and
I had a status field for exactly that purpose but wasn't reading it. If you ever build an offline-first
app, this is a trap you'll run into somewhere along the way.

1.0.5 is on its way to the Play Store now. Tidying up folders in Obsidian no longer takes anything more
than a single refresh on the phone.

[The next part (2/2)](/posts/reponote_repository_test_harness_20260924) covers the part this post glossed
over in a single line — "I wrote 6 tests." It's the story of how I built a test harness that verifies a
Repository entangled with a DB, a network, and a file system, in 11 seconds, with no emulator and no
network at all.
