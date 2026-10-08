---
title: 'Fixing a Bug in My GitHub-Synced Note App (2/2) — Testing the Repository Without a Network or an Emulator'
date: '2026-09-24'
publish_date: '2027-01-03'
description: How I made a Flutter Repository that juggles a database, the GitHub API, and the file system testable in 11 seconds flat using an in-memory drift database, a fake API client, and injected cache paths, and how I confirmed the tests were actually catching real bugs
tags:
  - Flutter
  - drift
  - flutter_test
  - Test Automation
  - RepoNote
---

## "I Tried It on My Phone Once and It Worked"

[Part 1](/posts/reponote_stale_note_sync_20260919) covered this bug: move a note to a different folder in
desktop Obsidian, push it, and the phone app would **leave the note sitting in its old location too.** The
cause was that the app was merging every "local file not on the server list" into the screen without
distinguishing sync status, and the fix was to only wipe local traces for files that were `synced` with no
pending edit draft.

The app works fine stopping there. The harder part is confirming that **the fixed logic doesn't also delete
things it shouldn't.** When a file turns up missing from the server, the app can be facing one of five
different situations.

- A file moved or deleted on the PC → **should be deleted**
- A file created on the phone that hasn't been uploaded yet → should survive
- A file edited on the phone and waiting to be uploaded → should survive
- A file deleted on the phone and waiting for the server to catch up → should survive
- A file in conflict state, waiting for the user to resolve it → should survive

Delete even one of these wrong, and something the user wrote on their phone vanishes. Checking this by
hand every time means bouncing between a PC and a phone to reproduce all five cases, and having to redo it
all from scratch the next time the code gets touched. So this time I added tests. Except this app's
Repository wasn't shaped in a way that made testing easy.

## What Was Blocking Me

`NotesRepository` depends on three things. And none of the three can be used as-is in `flutter test`.

| Dependency | What it actually does | Problem in tests |
|---|---|---|
| `AppDatabase` (drift) | Creates a SQLite file in the app's documents folder | Needs a platform channel to resolve the file path; tests end up sharing DBs |
| `GitHubApiClient` | Makes real HTTP requests | Needs a token, needs network, and I can't freely change repo state at will |
| `LocalFileCache` | Gets a cache folder via `getApplicationSupportDirectory()` | No platform channels in `flutter test`, so this throws `MissingPluginException` |

`flutter test` runs in a plain Dart VM with no emulator. So plugins like `path_provider` have no native
side at all, and calling them throws the instant they're invoked. This is exactly where the impression
that "testing a Repository in Flutter is a pain" comes from.

I set the goal like this.

> Without a network, without an emulator, and without leaving any trace on disk, **reproduce the "move it
> on the PC → refresh the app" scenario entirely in code.**

## Step 1: Constructor Injection Was Already in Place, Thankfully

The starting point wasn't bad. `NotesRepository` didn't build its own dependencies — it took them through
its constructor.

```dart
class NotesRepository {
  NotesRepository({
    required this._db,
    required this._api,
    required this._cache,
  });

  final AppDatabase _db;
  final GitHubApiClient _api;
  final LocalFileCache _cache;
```

Actually wiring these up in the app is the job of a Riverpod provider.

```dart
final notesRepositoryProvider = Provider<NotesRepository>((ref) {
  return NotesRepository(
    db: ref.watch(databaseProvider),
    api: ref.watch(gitHubApiClientProvider),
    cache: ref.watch(localFileCacheProvider),
  );
});
```

The benefit of this structure shows up in testing. A test doesn't need the provider at all — it can just
**call the constructor directly** and plug in whatever fake parts it wants. I didn't even need to reach
for Riverpod's `overrideWith`.

```dart
repo = NotesRepository(
  db: db,       // in-memory
  api: api,     // fake
  cache: LocalFileCache(baseDir: tempDir),  // temp folder
);
```

From here it was just a matter of building the three parts one at a time.

## Step 2: The DB — drift In-Memory

drift is built to let you swap out the executor for exactly this situation. `AppDatabase` already had a
constructor meant for testing.

```dart
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());   // app: file-backed DB

  AppDatabase.forTesting(super.executor);     // test: inject whatever
}
```

In tests, I pass in `NativeDatabase.memory()` — a SQLite instance that lives purely in memory, no disk
file.

```dart
import 'package:drift/native.dart';

db = AppDatabase.forTesting(NativeDatabase.memory());
```

The important part is putting this in `setUp`. Since every test gets a fresh DB, rows left behind by a
previous test can't leak into the next one. drift generates the schema automatically from the code, so
there's no need to prepare separate migration files either.

```dart
setUp(() async {
  db = AppDatabase.forTesting(NativeDatabase.memory());
  // ...
});

tearDown(() async {
  await db.close();
  await tempDir.delete(recursive: true);
});
```

If you forget `db.close()`, open connections pile up as the number of tests grows. It's worth getting
into the habit of always pairing it with `tearDown`.

## Step 3: The Network — Reusing a Fake API That Already Existed

My first thought was to pull in a mocking library, but digging around the project turned up a **fake API
client already built for store screenshots** — made so screenshots would show pretty demo data instead of
my actual personal repository.

```dart
/// 스크린샷 전용 가짜 GitHub API. 실제 네트워크 요청을 보내지 않는다.
class FakeGitHubApiClient extends GitHubApiClient {
  FakeGitHubApiClient({required this.tree, required this.contents})
    : super(tokenProvider: () async => 'demo');

  /// 폴더 경로 → 항목 목록. 폴더는 'dir:이름', 파일은 '이름.md'.
  final Map<String, List<String>> tree;

  /// 파일 경로 → Markdown 본문.
  final Map<String, String> contents;
```

It overrides `listContents()` to turn this `tree` map into the shape of a GitHub Contents API response.
The SHA is derived from the path's `hashCode`. In other words, **editing one line of the map changes the
server's state.**

```dart
api = FakeGitHubApiClient(
  tree: {
    '': ['dir:inbox', 'dir:archive', 'root.md'],
    'inbox': ['note.md'],
    'archive': [],
  },
  contents: {'inbox/note.md': '# note'},
);
```

There was a reason this beat a mocking library.

| | Constructor-stubbed Fake class | A mockito-style mock |
|---|---|---|
| Representing server state | `tree` map = the repo tree, directly | Specify the return value for every single call |
| Expressing "moved it on the PC" | Edit two lines of the map | Rewrite several `when(...)` setups |
| Code generation | Not needed | Sometimes requires running build_runner |
| Maintenance | API signature changes surface immediately as compile errors | Can drift out of sync and only fail at runtime |

The second row was the deciding factor. What I'm trying to reproduce isn't "the result of a call" — it's
**"a change in the state of the repository."** Writing it in the test body makes the intent read naturally.

```dart
// PC에서 inbox/note.md → archive/note.md 로 이동 후 push
api.tree['inbox'] = [];
api.tree['archive'] = ['note.md'];
```

Code built for screenshots turned into a test harness. If you ever build something to generate demo data,
it's worth leaving room to reuse it like this.

## Step 4: The File System — A 5-Line Injection

The last piece was `LocalFileCache`. It caches raw note content to files, and it resolves the storage
location via `path_provider`.

```dart
Future<Directory> _base() async {
  if (_baseDir != null) return _baseDir!;
  final support = await getApplicationSupportDirectory();   // ← blows up in tests
  final dir = Directory(p.join(support.path, 'note_cache'));
  ...
}
```

There were two ways to go about it.

1. Intercept `path_provider`'s platform channel in the test and have it respond with a fake path
2. Open a door that lets the cache class use a **given** path instead of the default one

Option 1 bloats the test-side setup code and depends on internal details like plugin channel names.
I went with option 2. `_base()` already falls back to using `_baseDir` whenever it's non-null, so all I
needed was to add a constructor.

```dart
/// [baseDir]를 넘기면 앱 지원 디렉토리 대신 그 경로를 사용한다 (테스트용).
LocalFileCache({Directory? baseDir}) {
  _baseDir = baseDir;
}
```

That's the entire production code change — these 5 lines. If you don't pass an argument, the behavior is
100% identical to before. In tests, I pass a system temp folder and delete it in `tearDown`.

```dart
tempDir = await Directory.systemTemp.createTemp('repo_note_test');
```

You might wonder whether it's really okay to change production code "just for the sake of testing" — but
something this small, an optional constructor argument with a default, actually makes the class more
honest. The job of this class is "write a cache to a given folder," not "go find the app's support
directory."

## The Finished Harness

Once all three parts come together, `setUp` ends up looking like this. This is the real, practical output
of this whole effort.

```dart
late AppDatabase db;
late Directory tempDir;
late FakeGitHubApiClient api;
late NotesRepository repo;

setUp(() async {
  db = AppDatabase.forTesting(NativeDatabase.memory());
  tempDir = await Directory.systemTemp.createTemp('repo_note_test');
  api = FakeGitHubApiClient(
    tree: {
      '': ['dir:inbox', 'dir:archive', 'root.md'],
      'inbox': ['note.md'],
      'archive': [],
    },
    contents: {'inbox/note.md': '# note'},
  );
  repo = NotesRepository(db: db, api: api, cache: LocalFileCache(baseDir: tempDir));
});
```

Now the body of each test talks only about the **user scenario**, not internal app mechanics. The tests
for "shouldn't be deleted" cases get especially short.

```dart
test('수정 중인 초안이 있는 파일은 서버에 없어도 유지된다', () async {
  await repo.listRemote(vault, 'inbox');
  final id = NotesRepository.fileIdFor(vault.id, 'inbox/note.md');
  await repo.saveDraft(vault, id, '# edited locally');

  api.tree['inbox'] = [];   // PC에서 지워버림

  final inbox = await repo.listRemote(vault, 'inbox');
  expect(inbox.map((e) => e.fullPath), contains('inbox/note.md'));
  expect(await localPaths(), contains('inbox/note.md'));
});
```

I ended up writing 6 tests this way — the five scenarios above, plus one for `markDelete` behavior.

## How to Check That the Harness Is Actually Real

There's one more step needed here. **A test built on fake parts can turn green without verifying
anything at all.** That happens if the fake API behaves differently from the real one, or if the
assertions are too loose.

The way to check is simple. Revert the fixed code and see whether the tests **turn red.**

```bash
git checkout dcc1096^ -- lib/features/file_browser/data/notes_repository.dart
flutter test test/features/file_browser/notes_repository_test.dart
```

The result: 2 of the 6 fail. The two that fail are exactly the ones corresponding to this bug (moving a
file, moving a folder), and the other 4 — the ones that are supposed to "survive" — pass even against the
pre-fix code. That's a sign the harness and assertions are doing their job. The detailed failure log is in
Part 1.

```bash
git checkout HEAD -- lib/features/file_browser/data/notes_repository.dart
flutter test    # 35개 전부 통과, 약 11초
```

The test count went from 29 to 35, and the total run time is still around 11 seconds. Cutting out the
network and disk is what makes that possible. At this speed, running it after every code change isn't a
burden at all.

## A Summary of the Patterns I Keep Reaching For

Here's a rundown of what I used this time around when testing the Repository layer in Flutter.

| What's blocking you | Fix | Code needed |
|---|---|---|
| File-backed SQLite | drift in-memory | `AppDatabase.forTesting(NativeDatabase.memory())` |
| HTTP calls | A Fake subclassing the API client | `class FakeX extends X { @override ... }` |
| `path_provider` and similar plugins | Inject the path as an optional constructor argument | `LocalFileCache({Directory? baseDir})` |
| State leaking between tests | Create fresh in `setUp` every time | `late` variables + `setUp`/`tearDown` |
| Disk leftovers | System temp folder | `Directory.systemTemp.createTemp()` + delete in `tearDown` |
| Tests becoming meaningless | Revert to the pre-fix commit and confirm failure | `git checkout <commit>^ -- <file>` |

## Troubleshooting

**Tests pass but `tearDown` throws an error** — `tempDir.delete(recursive: true)` throws if the folder is
already gone. If something inside the test calls a `clearAll()`-style method, it's safer to wrap it with
`if (await tempDir.exists())`.

**Only the DB-related tests fail intermittently** — Putting the in-memory DB in `setUpAll` means tests end
up sharing rows with each other. Results then depend on execution order, so move it into `setUp` (per
test) instead.

**The Fake class won't compile** — When a method gets added to the original API client, the Fake has to
keep up. This is a feature, not a bug — a mock would only have surfaced that mismatch at runtime; this
catches it at compile time instead.

**`flutter test` throws a plugin exception** — This means some piece of the code under test is still
calling a plugin directly. Follow the stack trace to that spot and open the same kind of door (injection)
there too.

## Wrap-Up

| Stage | One-line summary |
|---|---|
| Problem | Repository is tangled up with the DB, network, and file system, so verifying scenarios is manual |
| Part 1 | drift's `NativeDatabase.memory()` keeps the DB in memory |
| Part 2 | Reused the `FakeGitHubApiClient` built for screenshots, representing server state through a `tree` map |
| Part 3 | Added a 5-line `baseDir` injection to `LocalFileCache` |
| Verification | Reverted to the pre-fix commit, confirmed 2 failures — proof the harness is actually doing work |
| Result | Tests went from 29 to 35, total run time still 11 seconds, no network or emulator needed |

The lesson I took from this is that "a testable structure" doesn't have to mean a dramatic refactor. The
only production code I actually changed was **one optional constructor argument.** Everything else was
just finding and reusing things that already existed — constructor injection, drift's testing constructor,
the Fake built for screenshots.

Coming back to development after a long break, it's easy to freeze up thinking "I should set up proper
testing first before doing anything else." But the order can run the other way just fine. Hit a bug, open
just enough doors to write one test that reproduces that bug, and repeat. Do that enough times and it adds
up into a harness.
