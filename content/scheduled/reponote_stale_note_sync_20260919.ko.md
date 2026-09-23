---
title: 'GitHub 동기화 메모 앱 버그 잡기 (1/2) — PC에서 옮긴 노트가 앱에 그대로 남아있다'
date: '2026-09-19'
publish_date: '2026-09-30'
description: 옵시디언 저장소를 GitHub로 동기화하는 Flutter 앱에서 PC에서 폴더를 옮긴 노트가 앱 목록에 계속 남던 원인을 추적하고, "서버에 없는 로컬 파일"을 동기화 상태별로 구분해 정리하도록 고친 과정
tags:
  - Flutter
  - drift
  - GitHub API
  - 동기화
  - RepoNote
---

## 캐시를 비우면 사라지는데, 그 전엔 남아있다

[RepoNote](https://github.com/hyunseokyu1-netizen/repo-note)는 GitHub 저장소에
올려둔 옵시디언 노트를 폰에서 보고 고치는 앱이다. PC에서는 옵시디언으로 쓰고,
폰에서는 이 앱으로 읽거나 짧게 손보고, 양쪽은 GitHub로 만난다.

그런데 얼마 전부터 이상한 게 보였다.

1. PC 옵시디언에서 `inbox/아이디어.md`를 `archive/` 폴더로 드래그해서 옮긴다
2. Git 커밋하고 push
3. 폰에서 앱을 열고 새로고침(동기화)
4. **`archive/`에도 노트가 생겼는데, `inbox/`에도 그대로 남아있다**

같은 노트가 두 군데 보이는 상태. 설정에서 "캐시 삭제"를 누르면 그제야 `inbox/`
쪽이 사라졌다. 즉, 서버(GitHub)는 정상인데 **앱이 들고 있는 로컬 메타데이터가
안 지워지는** 문제였다.

"캐시 지우면 되잖아"로 넘기기엔 너무 자주 겪는 일이다. 옵시디언에서 노트 폴더
정리는 늘 하는 일이고, 그때마다 폰에서 캐시를 비우고 다시 로그인 상태를 확인하는
건 말이 안 된다. 이번 1.0.5 업데이트에서 이걸 잡았다.

## 사전 지식: 이 앱은 왜 로컬 DB를 들고 있나

원인을 이해하려면 앱 구조를 조금 알아야 한다. RepoNote는 GitHub Contents API로
파일 목록과 내용을 가져오는데, 그걸 그대로 화면에 뿌리지 않고 **로컬 SQLite
DB(drift)에 한 번 적어둔다.** 이유는 세 가지다.

| 로컬 DB가 필요한 이유 | 없으면 어떻게 되나 |
|---|---|
| 오프라인에서도 목록·본문을 보여줘야 한다 | 지하철에서 앱이 빈 화면 |
| 폰에서 고친 내용을 서버에 올리기 전까지 "초안"으로 보관해야 한다 | 앱 껐다 켜면 수정 날아감 |
| 폰에서 새로 만든 노트, 삭제 예약한 노트처럼 서버와 상태가 다른 파일을 표시해야 한다 | 업로드 전엔 목록에서 안 보임 |

그래서 파일마다 `syncStatus`라는 상태를 붙여둔다.

| 상태 | 의미 |
|---|---|
| `synced` | 서버와 같음. 로컬 수정 없음 |
| `localOnly` | 폰에서 만들었고 아직 서버에 없음 |
| `pendingUpload` | 서버에도 있지만 폰에서 고친 내용이 있음 |
| `pendingDelete` | 폰에서 삭제했고 서버 반영 대기 중 |
| `conflict` | 폰과 서버가 서로 다르게 바뀜 |

이 구조 자체는 문제가 없다. 문제는 "서버 목록"과 "로컬 DB"를 합쳐서 화면에
그리는 부분에 있었다.

## Step 1: 폴더 목록을 만드는 코드 따라가기

파일 브라우저가 폴더를 열 때 호출하는 건 `NotesRepository.listRemote()`다.
흐름은 이렇다.

1. GitHub API로 그 폴더의 항목 목록을 받는다
2. `.md` 파일이면 DB에 없을 때 `synced`로 새로 넣고, 있으면 SHA만 갱신한다
3. 그 다음 — 여기가 범인이다 — **서버 목록에 없는 로컬 DB 파일을 결과에 합친다**

수정 전 코드는 이랬다.

```dart
// 서버 목록에 없는 로컬 전용/삭제 대기 파일 병합
final locals = await _listLocalFiles(vault, dirPath);
final remotePaths = result.map((e) => e.fullPath).toSet();
for (final l in locals) {
  if (!remotePaths.contains(l.fullPath)) result.add(l);
}
return result;
```

주석에 의도가 그대로 적혀 있다. 폰에서 새로 만든 `localOnly` 파일은 서버에
없으니 서버 목록만 쓰면 안 보인다. 그래서 "서버에 없는 로컬 파일도 보여주자"고
한 것이다.

그런데 조건이 **"서버에 없으면"** 하나뿐이다. 상태를 안 본다. PC에서 옮겨서
서버에서 사라진 `synced` 파일도 "서버에 없는 로컬 파일"이니 그대로 결과에
들어간다. 그리고 DB 행은 아무도 안 지우니까 다음 새로고침에도, 그 다음에도 계속
남는다. "캐시 삭제"가 `synced` 행을 통째로 지우는 기능이라 그때만 사라졌던 거다.

## Step 2: 그럼 언제 지워야 하나

"서버에 없다"는 사실 하나로는 부족하고, **왜 서버에 없는지**를 상태로 구분해야
한다.

| 서버에 없는 로컬 파일의 상태 | 해석 | 처리 |
|---|---|---|
| `synced` + 수정 초안 없음 | 다른 곳(PC)에서 옮기거나 지웠다 | **로컬 정리** |
| `localOnly` | 폰에서 만들었고 아직 안 올렸다 | 유지 |
| `pendingUpload` | 서버에선 사라졌는데 폰에 수정본이 있다 | 유지 (동기화 때 충돌 처리) |
| `pendingDelete` | 폰에서 지웠고 서버 반영 대기 | 유지 (목록에선 숨김) |
| `conflict` | 아직 사용자가 해결 안 함 | 유지 |

핵심은 첫 줄이다. `synced`라는 건 "마지막으로 확인했을 때 서버와 같았다"는
뜻이고, 그런 파일이 지금 서버에 없다면 서버 쪽이 바뀐 것이다. 폰에 수정한
게 없으니 지워도 잃을 데이터가 없다.

반대로 나머지는 전부 **폰 쪽에 아직 서버에 안 올라간 정보가 있는** 상태다.
이걸 지우면 사용자가 쓴 내용이 날아간다. 그래서 건드리지 않는다.

## Step 3: 코드 고치기

판단 함수부터 만들었다. `synced`이면서 dirty 초안이 없어야 "정리해도 되는
파일"이다.

```dart
/// 서버에는 없지만 로컬에 동기화 완료로 남아 있고 수정 초안도 없는 파일인지.
Future<bool> _isStaleSynced(String fileId) async {
  final file = await _db.getFile(fileId);
  if (file == null || file.syncStatus != SyncStatus.synced) return false;
  final draft = await _db.getDraft(fileId);
  return draft == null || !draft.isDirty;
}
```

정리 함수는 캐시 파일·초안·동기화 작업·충돌 기록·메타데이터 행을 한꺼번에
지운다. 이런 코드가 `markDelete()`에도 따로 있길래 하나로 합쳤다.

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

그리고 병합 루프에 조건을 넣었다.

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

### 폴더째 옮긴 경우

여기서 하나 더 신경 쓸 게 있었다. 파일 하나가 아니라 **폴더째** `inbox/` →
`archive/inbox/`로 옮기면 어떻게 될까?

루트를 새로고침하면 서버 목록에 `inbox` 폴더가 없다. 위 루프는 "그 폴더의 직접
자식 파일"만 보기 때문에 `inbox/아이디어.md` 같은 하위 파일은 검사 대상이
아니다. 화면에서는 폴더가 안 보이니 얼핏 괜찮아 보이는데, DB에는 여전히 남아
있어서 **검색이나 `[[위키링크]]` 이동에서 옛 경로가 계속 잡힌다.**

그래서 "서버에서 사라진 하위 폴더에 속한 synced 파일"도 같이 정리하는 함수를
붙였다.

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

경로의 첫 세그먼트(`inbox`)가 서버 폴더 목록에 없으면, 그 아래 `synced` 파일은
전부 정리 대상이다. 여기서도 `_isStaleSynced`를 거치니까 폰에서 수정 중인
파일은 안전하다.

## Step 4: 고쳤다는 걸 무엇으로 확인했나

고치고 나서 폰으로 한 번 해보면 "된다"는 건 알 수 있다. 문제는 이 로직이
**지우면 안 되는 파일을 안 지운다**는 것까지 손으로 확인하기가 번거롭다는 점이다.
수정 중인 초안이 있는 파일, 아직 안 올린 로컬 전용 파일, 삭제 예약한 파일…
경우의 수가 다섯 개고, 하나라도 잘못 지우면 사용자가 쓴 글이 날아간다.

그래서 "PC에서 옮기고 → 앱에서 새로고침"을 코드로 재현하는 테스트를 6개 썼다.
실제 네트워크도, 실제 SQLite 파일도 없이 돈다.

| 테스트 | 확인하는 것 |
|---|---|
| 다른 폴더로 옮긴 노트 | 이전 위치에서 사라지는가 |
| 폴더째 옮긴 경우 | 상위 폴더 갱신만으로 하위 파일 메타데이터가 정리되는가 |
| 수정 초안이 있는 파일 | 서버에 없어도 **살아남는가** |
| 로컬 전용 파일 | 서버에 없어도 살아남는가 |
| 삭제 대기 파일 | 목록에선 숨되 DB에는 남는가 |
| `markDelete` | 로컬 전용 파일은 초안까지 깔끔히 지워지는가 |

테스트 하나는 이렇게 생겼다. `api.tree`를 손대는 줄이 "PC에서 옮기고 push한 것"에
해당한다.

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

중요한 건 이 테스트가 **정말 이 버그를 잡는지**까지 확인한 것이다. 수정한 파일
하나만 수정 전 커밋으로 되돌리고 돌려봤다.

```bash
git checkout dcc1096^ -- lib/features/file_browser/data/notes_repository.dart
flutter test test/features/file_browser/notes_repository_test.dart
```

이동 관련 2개가 정확히 빨갛게 나온다.

```text
00:00 +0 -1: PC에서 다른 폴더로 옮긴 노트는 … [E]
  Expected: not contains 'inbox/note.md'
    Actual: MappedListIterable<BrowserEntry, String>:['inbox/note.md']

00:00 +0 -2: 폴더째 옮긴 경우 상위 폴더 갱신 시 … [E]
  Expected: not contains 'inbox/note.md'
    Actual: Set:['inbox/note.md', 'root.md']
```

나머지 4개("살아남아야 하는" 쪽)는 수정 전에도 통과한다. 즉 이 두 개가 딱 이번
버그를 가리킨다. 파일을 복구하면 6개 전부 통과한다. 이 한 번의 확인이 "테스트가
통과한다"와 "테스트가 의미 있다"의 차이를 만든다.

테스트를 **돌릴 수 있는 환경**을 만드는 쪽 — 인메모리 DB, 가짜 GitHub API, 파일
캐시 경로 주입 — 은 이야기가 길어서 [2편](/posts/reponote_repository_test_harness_20260924)에서 따로 다룬다.

## 트러블슈팅: 폰에 설치했더니 서명이 안 맞는다

고친 빌드를 폰에 바로 넣으려다 한 번 막혔다.

```text
adb: failed to install app-release.apk: Failure
[INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.backdev.reponote
 signatures do not match newer version; ignoring!]
```

폰에 깔린 건 **Play 스토어에서 받은 버전**이었다. Play 앱 서명을 쓰면 내가
올린 AAB를 Google이 자기 키로 다시 서명해서 배포한다. 그래서 같은 keystore로
빌드한 로컬 APK라도 폰 입장에선 "다른 서명"이고 덮어쓰기를 거부한다.

`dumpsys package`로 보면 바로 알 수 있다.

```bash
adb shell dumpsys package com.backdev.reponote | grep installer
#   installerPackageName=com.android.vending   ← Play 스토어 설치본
```

해결은 삭제 후 재설치뿐인데, 이러면 **앱 데이터(토큰·설정·미동기화 초안)가
전부 날아간다.** 이 앱은 원래 모든 노트가 GitHub에 있으니 재로그인만 하면
되지만, 동기화 안 된 초안이 있었다면 잃었을 거다. 로컬 빌드로 테스트하는
기기에는 처음부터 Play 버전을 깔지 않는 게 편하다.

## 정리

| 단계 | 한 줄 요약 |
|---|---|
| 증상 | PC에서 옮긴 노트가 앱 목록에 남고, 캐시 삭제해야 사라짐 |
| 원인 | "서버에 없는 로컬 파일"을 상태 구분 없이 전부 목록에 합침 |
| 판단 기준 | `synced` + 수정 초안 없음 = 서버에서 사라진 것 → 정리 / 나머지 = 폰에 미반영 정보 있음 → 유지 |
| 추가 처리 | 폴더째 옮긴 경우도 하위 파일 메타데이터 정리 (검색·위키링크 오염 방지) |
| 검증 | drift 인메모리 DB + Fake API로 시나리오 테스트 6개, 수정 전 코드로 실패 확인 |

이 버그의 교훈은 하나다. **로컬 캐시를 서버와 합칠 땐 "없다"만 보지 말고
"왜 없는지"를 봐야 한다.** 서버에 없는 이유가 "아직 안 올렸다"인지 "저쪽에서
지웠다"인지에 따라 정반대로 처리해야 하는데, 상태 필드를 만들어 두고도 그걸
안 읽고 있었다. 오프라인 우선 앱을 만든다면 어디선가 한 번은 마주칠 함정이다.

1.0.5는 Play 스토어에 올리는 중이다. 이제 옵시디언에서 폴더 정리를 해도 폰에서
새로고침 한 번이면 끝난다.

[다음 편(2/2)](/posts/reponote_repository_test_harness_20260924)에서는 이 글에서 "테스트 6개를 썼다"고 한 줄로 넘어간 부분을 다룬다.
DB·네트워크·파일 시스템을 전부 끼고 도는 Repository를, 에뮬레이터도 네트워크도
없이 11초 만에 검증하는 테스트 하네스를 어떻게 짰는지에 대한 이야기다.
