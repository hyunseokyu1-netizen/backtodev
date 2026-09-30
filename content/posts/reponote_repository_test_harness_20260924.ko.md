---
title: 'GitHub 동기화 메모 앱 버그 잡기 (2/2) — 네트워크도 에뮬레이터도 없이 Repository 테스트하기'
date: '2026-09-24'
publish_date: '2026-10-01'
description: DB·GitHub API·파일 시스템을 전부 끼고 도는 Flutter Repository를 drift 인메모리 DB와 가짜 API 클라이언트, 캐시 경로 주입만으로 11초 안에 검증하게 만든 과정과 그 테스트가 진짜인지 확인한 방법
tags:
  - Flutter
  - drift
  - flutter_test
  - 테스트 자동화
  - RepoNote
---

## "폰으로 한 번 해봤는데 되던데요"

[1편](/posts/reponote_stale_note_sync_20260919)에서 고친 버그는 이거였다. PC 옵시디언에서
노트를 다른 폴더로 옮기고 push하면, 폰 앱에서는 **옛 위치에도 노트가 그대로 남아있는** 문제.
원인은 "서버 목록에 없는 로컬 파일"을 동기화 상태 구분 없이 전부 화면에 합치고 있었던 것이고,
고친 방법은 `synced`이면서 수정 초안이 없는 파일만 골라 로컬 흔적을 지우는 것이었다.

여기서 끝내도 앱은 동작한다. 문제는 **고친 로직이 지우면 안 되는 것까지 지우지 않는다**는 걸
확인하는 쪽이다. 서버에 없는 파일이 나왔을 때 앱이 마주치는 경우가 다섯 가지다.

- PC에서 옮기거나 지운 파일 → **지워야 함**
- 폰에서 만들고 아직 안 올린 파일 → 살려야 함
- 폰에서 고쳐서 업로드 대기 중인 파일 → 살려야 함
- 폰에서 지우고 서버 반영 대기 중인 파일 → 살려야 함
- 충돌 상태로 사용자 해결을 기다리는 파일 → 살려야 함

하나라도 잘못 지우면 사용자가 폰에서 쓴 글이 날아간다. 이걸 매번 손으로 확인하려면 PC와 폰을
번갈아 만지며 다섯 번을 재현해야 하고, 다음에 코드를 또 건드리면 처음부터 다시 해야 한다.
그래서 이번엔 테스트를 붙였다. 그런데 이 앱의 Repository는 테스트하기 좋은 모양이 아니었다.

## 무엇이 막고 있었나

`NotesRepository`는 세 가지에 의존한다. 그리고 세 개 전부 `flutter test`에서 그대로 쓸 수 없다.

| 의존성 | 실제 동작 | 테스트에서 생기는 문제 |
|---|---|---|
| `AppDatabase` (drift) | 앱 문서 폴더에 SQLite 파일 생성 | 파일 경로를 잡으려면 플랫폼 채널이 필요, 테스트끼리 DB가 섞임 |
| `GitHubApiClient` | 진짜 HTTP 요청 | 토큰 필요, 네트워크 필요, 저장소 상태를 마음대로 못 바꿈 |
| `LocalFileCache` | `getApplicationSupportDirectory()`로 캐시 폴더 확보 | `flutter test`엔 플랫폼 채널이 없어 `MissingPluginException` |

`flutter test`는 에뮬레이터 없이 순수 Dart VM에서 돈다. 그래서 `path_provider` 같은 플러그인은
네이티브 쪽이 아예 없어서 호출하는 순간 예외가 난다. 이게 "Flutter에서 Repository 테스트는
귀찮다"는 인상의 정체다.

목표를 이렇게 잡았다.

> 네트워크 없이, 에뮬레이터 없이, 디스크에 흔적을 남기지 않고, **"PC에서 옮기고 → 앱에서
> 새로고침"이라는 시나리오를 코드로 재현**한다.

## Step 1: 다행히 생성자 주입은 이미 되어 있었다

시작점이 나쁘지 않았다. `NotesRepository`는 의존성을 직접 만들지 않고 생성자로 받고 있었다.

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

앱에서 실제로 조립하는 건 Riverpod provider 쪽이다.

```dart
final notesRepositoryProvider = Provider<NotesRepository>((ref) {
  return NotesRepository(
    db: ref.watch(databaseProvider),
    api: ref.watch(gitHubApiClientProvider),
    cache: ref.watch(localFileCacheProvider),
  );
});
```

이 구조의 장점이 테스트에서 드러난다. 테스트는 provider를 쓰지 않고 **생성자를 직접 호출해서**
원하는 가짜 부품을 끼워 넣으면 된다. Riverpod의 `overrideWith`까지 갈 필요도 없다.

```dart
repo = NotesRepository(
  db: db,       // 인메모리
  api: api,     // 가짜
  cache: LocalFileCache(baseDir: tempDir),  // 임시 폴더
);
```

여기서부터는 세 부품을 하나씩 만드는 작업이다.

## Step 2: DB — drift 인메모리

drift는 이 경우를 위해 실행기(executor)를 갈아끼울 수 있게 되어 있다. `AppDatabase`에 이미
테스트용 생성자가 있었다.

```dart
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());   // 앱: 파일 DB

  AppDatabase.forTesting(super.executor);     // 테스트: 뭐든 넣어라
}
```

테스트에서는 `NativeDatabase.memory()`를 넣는다. 디스크 파일 없이 메모리에서만 사는 SQLite다.

```dart
import 'package:drift/native.dart';

db = AppDatabase.forTesting(NativeDatabase.memory());
```

중요한 건 이걸 `setUp`에 두는 것이다. 테스트마다 새 DB가 생기니 앞 테스트가 넣어둔 행이
다음 테스트에 새어 나가지 않는다. 스키마는 drift가 코드에서 자동으로 만들어 주므로 마이그레이션
파일을 따로 준비할 필요도 없다.

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

`db.close()`를 빼먹으면 테스트가 늘어날수록 열린 연결이 쌓인다. `tearDown`은 습관적으로 같이
쓰는 게 낫다.

## Step 3: 네트워크 — 이미 있던 가짜 API를 재활용

원래는 mock 라이브러리를 붙일까 했는데, 프로젝트를 뒤져보니 **스토어 스크린샷용으로 만들어둔
가짜 API 클라이언트**가 이미 있었다. 스크린샷 찍을 때 내 실제 저장소가 아니라 예쁜 데모
데이터를 보여주려고 만든 것이다.

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

`listContents()`를 오버라이드해서 이 `tree` 맵을 GitHub Contents API 응답 모양으로 바꿔 돌려준다.
SHA는 경로의 `hashCode`로 만들어 쓴다. 즉 **맵 한 줄 고치면 서버 상태가 바뀐다.**

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

이게 mock 라이브러리보다 나았던 이유가 있다.

| | 생성자 스텁(Fake 클래스) | mockito 같은 mock |
|---|---|---|
| 서버 상태 표현 | `tree` 맵 = 저장소 트리 그대로 | 호출마다 반환값을 일일이 지정 |
| "PC에서 옮겼다" 표현 | 맵 두 줄 수정 | `when(...)`을 다시 여러 개 |
| 코드 생성 | 필요 없음 | build_runner 돌려야 하는 경우 있음 |
| 유지보수 | API 시그니처 바뀌면 컴파일 에러로 바로 알려줌 | 런타임에 어긋날 수 있음 |

특히 두 번째 줄이 결정적이었다. 내가 재현하려는 건 "호출 결과"가 아니라 **"저장소 상태의 변화"**
이기 때문이다. 테스트 본문에서 이렇게 쓰면 의도가 그대로 읽힌다.

```dart
// PC에서 inbox/note.md → archive/note.md 로 이동 후 push
api.tree['inbox'] = [];
api.tree['archive'] = ['note.md'];
```

스크린샷용으로 만든 코드가 테스트 하네스가 됐다. 데모 데이터를 만들 일이 있다면 이렇게 재사용할
여지를 남겨두는 게 이득이다.

## Step 4: 파일 시스템 — 5줄짜리 주입

마지막이 `LocalFileCache`다. 노트 원문을 파일로 캐시하는데, 저장 위치를 `path_provider`로 잡는다.

```dart
Future<Directory> _base() async {
  if (_baseDir != null) return _baseDir!;
  final support = await getApplicationSupportDirectory();   // ← 테스트에서 터짐
  final dir = Directory(p.join(support.path, 'note_cache'));
  ...
}
```

방법은 두 가지였다.

1. 테스트에서 `path_provider`의 플랫폼 채널을 가로채 가짜 경로를 응답하게 만든다
2. 캐시 클래스가 기본 경로 대신 **주어진 경로**를 쓸 수 있게 문을 하나 낸다

1번은 테스트 쪽 설정 코드가 길어지고, 플러그인 채널 이름 같은 내부 사정에 의존한다. 2번을 골랐다.
`_base()`가 이미 `_baseDir != null`이면 그대로 쓰도록 되어 있어서, 생성자만 추가하면 끝이었다.

```dart
/// [baseDir]를 넘기면 앱 지원 디렉토리 대신 그 경로를 사용한다 (테스트용).
LocalFileCache({Directory? baseDir}) {
  _baseDir = baseDir;
}
```

프로덕션 코드 변경은 이 5줄이 전부다. 인자를 안 넘기면 기존과 100% 같은 동작이다. 테스트에서는
시스템 임시 폴더를 넘기고 `tearDown`에서 지운다.

```dart
tempDir = await Directory.systemTemp.createTemp('repo_note_test');
```

"테스트를 위해 프로덕션 코드를 바꾸는 게 맞나" 싶을 수 있는데, 이 정도 — 기본값이 있는 선택적
인자 하나 — 는 오히려 클래스를 정직하게 만든다. 이 클래스가 하는 일은 "정해진 폴더에 캐시를
쓴다"이지 "앱 지원 디렉토리를 찾아낸다"가 아니기 때문이다.

## 완성된 하네스

세 부품이 모이면 `setUp`이 이렇게 된다. 여기까지가 이번 작업의 실질적 결과물이다.

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

이제 테스트 본문은 앱 내부 사정이 아니라 **사용자 시나리오**만 이야기한다. "지우면 안 되는"
쪽 테스트가 특히 짧아진다.

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

이런 식으로 6개를 썼다. 앞의 다섯 가지 경우 + `markDelete` 동작 하나.

## 하네스가 진짜인지 확인하는 법

여기서 한 단계가 더 필요하다. **가짜 부품으로 짠 테스트는 아무것도 검증하지 않으면서 초록불만
켤 수 있다.** 가짜 API가 실제 API와 다르게 동작하거나, 단언이 느슨하면 그렇게 된다.

확인 방법은 간단하다. 고친 코드를 되돌리고 테스트가 **빨갛게 되는지** 본다.

```bash
git checkout dcc1096^ -- lib/features/file_browser/data/notes_repository.dart
flutter test test/features/file_browser/notes_repository_test.dart
```

결과는 6개 중 2개 실패. 실패한 게 정확히 이번 버그(이동·폴더 이동)에 해당하는 둘이고, "살아남아야
하는" 나머지 4개는 수정 전 코드에서도 통과한다. 하네스와 단언이 제 일을 하고 있다는 뜻이다.
자세한 실패 로그는 1편에 실어뒀다.

```bash
git checkout HEAD -- lib/features/file_browser/data/notes_repository.dart
flutter test    # 35개 전부 통과, 약 11초
```

29개였던 테스트가 35개가 됐고, 전체 실행 시간은 여전히 11초대다. 네트워크와 디스크를 뺀 덕분이다.
이 속도면 코드를 고칠 때마다 돌리는 데 부담이 없다.

## 자주 쓰는 패턴 요약

Flutter에서 Repository 계층을 테스트할 때 이번에 쓴 것들을 정리하면 이렇다.

| 막는 것 | 해결 | 필요한 코드 |
|---|---|---|
| 파일 SQLite | drift 인메모리 | `AppDatabase.forTesting(NativeDatabase.memory())` |
| HTTP 호출 | API 클라이언트를 상속한 Fake | `class FakeX extends X { @override ... }` |
| `path_provider` 등 플러그인 | 경로를 선택적 생성자 인자로 주입 | `LocalFileCache({Directory? baseDir})` |
| 테스트 간 상태 오염 | `setUp`에서 매번 새로 생성 | `late` 변수 + `setUp`/`tearDown` |
| 디스크 잔여물 | 시스템 임시 폴더 | `Directory.systemTemp.createTemp()` + `tearDown` 삭제 |
| 테스트가 무의미해지는 것 | 수정 전 커밋으로 되돌려 실패 확인 | `git checkout <커밋>^ -- <파일>` |

## 트러블슈팅

**테스트가 통과하는데 `tearDown`에서 에러가 난다** — `tempDir.delete(recursive: true)`는 폴더가
이미 없으면 예외를 던진다. 테스트 안에서 `clearAll()` 같은 걸 호출했다면 `if (await
tempDir.exists())`로 감싸는 게 안전하다.

**DB 관련 테스트만 간헐적으로 실패한다** — 인메모리 DB를 `setUpAll`에 두면 테스트끼리 행을
공유하게 된다. 순서에 따라 결과가 달라지므로 `setUp`(매 테스트)으로 옮긴다.

**Fake 클래스가 컴파일되지 않는다** — 원본 API 클라이언트에 메서드가 추가되면 Fake도 따라가야
한다. 이건 단점이 아니라 장점이다. mock이었다면 런타임에야 알았을 불일치를 컴파일 시점에
알려준다.

**`flutter test`가 플러그인 예외를 던진다** — 테스트 대상 코드 어딘가가 여전히 플러그인을
직접 호출하고 있다는 뜻이다. 스택트레이스를 따라가서 그 지점도 같은 방식(주입)으로 열어준다.

## 정리

| 단계 | 한 줄 요약 |
|---|---|
| 문제 | Repository가 DB·네트워크·파일 시스템에 묶여 있어 시나리오 검증이 수동 |
| 부품 1 | drift `NativeDatabase.memory()`로 DB를 메모리에 |
| 부품 2 | 스크린샷용으로 만들어둔 `FakeGitHubApiClient` 재활용, `tree` 맵으로 서버 상태 표현 |
| 부품 3 | `LocalFileCache`에 `baseDir` 주입 5줄 추가 |
| 검증 | 수정 전 커밋으로 되돌려 2개 실패 확인 → 하네스가 진짜 일한다는 증거 |
| 결과 | 테스트 29 → 35개, 전체 11초, 네트워크·에뮬레이터 불필요 |

이번에 얻은 교훈은 "테스트 가능한 구조"라는 게 거창한 리팩터링이 아니라는 것이다. 실제로 바꾼
프로덕션 코드는 **선택적 생성자 인자 하나**가 전부였다. 나머지는 이미 있던 것(생성자 주입,
drift의 테스트 생성자, 스크린샷용 Fake)을 찾아 쓴 것뿐이다.

오래 쉬었다가 개발로 돌아오면 "테스트부터 제대로 깔고 가야지"라는 생각에 시작도 못 하는 경우가
있는데, 순서는 반대여도 된다. 버그를 하나 만나고, 그 버그를 재현하는 테스트 하나를 위해 필요한
만큼만 문을 열면 된다. 그게 쌓여서 하네스가 된다.
