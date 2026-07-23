---
title: 'GitHub API에는 "파일 이동"이 없다 — RepoNote에 드래그 앤 드롭 폴더 이동 넣은 이야기'
date: '2026-07-18'
publish_date: '2026-09-20'
description: GitHub Contents API에 move가 없어서 생성+삭제로 파일 이동을 구현하고, 길게 누르기 제스처 충돌과 폴더 이동 설계까지 정리한 개발기
tags:
  - Flutter
  - GitHub API
  - Drag and Drop
  - UX
  - Git
---

## Obsidian처럼 파일을 옮기고 싶었다

[RepoNote](https://github.com/hyunseokyu1-netizen/repo-note)를 며칠 써보니 은근히
불편한 게 하나 있었다. 메모를 아무 폴더에나 일단 만들어놓고 나중에 정리하는
습관이 있는데, 폴더를 옮기려면 **이름 변경 다이얼로그를 열어서 경로를 전부
다시 타이핑**해야 했다. Obsidian 모바일은 파일을 길게 눌러서 드래그하면
바로 옮겨지는데, 그 경험이 그리웠다.

그래서 직접 넣어보기로 했다. 그 과정에서 예상 못한 벽을 두 번 만났다.
하나는 GitHub API의 근본적인 한계, 다른 하나는 순전히 내 실수였다.

## Step 1. GitHub Contents API에는 "이동"이 없다

REST API 문서를 다시 열어봤다. 파일 생성(`PUT`), 조회(`GET`), 삭제(`DELETE`)는
있는데 **rename이나 move에 해당하는 엔드포인트가 아예 없다.** Git 자체가
파일을 경로 문자열로 취급할 뿐 "이동"이라는 개념을 따로 갖지 않기 때문이다.

그래서 방법은 하나다. **새 경로에 같은 내용으로 파일을 만들고, 기존 경로 파일을
지운다.**

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

두 단계로 나뉘다 보니 **중간에 실패할 수 있다**는 게 진짜 문제다. 새 파일은
만들어졌는데 삭제가 실패하면, 사용자 눈에는 "파일이 두 곳에 있는" 상태가 된다.
그래서 삭제 실패 시에는 기존 파일을 조용히 넘어가지 않고 `pendingDelete` 상태로
표시해 두고, 다음 동기화 때 다시 삭제를 시도하도록 큐에 남긴다.

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

참고로 이 패턴은 사실 처음 만드는 게 아니었다. **이름 변경(rename) 기능을 만들
때 이미 똑같은 문제를 겪었다.** 이름을 바꾸는 것도 결국 "다른 경로에 같은 파일을
만드는 것"이니까. 그래서 이번엔 아예 `_movePath(oldPath, newPath)`라는 공통
함수 하나로 합쳐서, 이름 변경도 폴더 이동도 파일 이동도 전부 이 함수를 거치게
만들었다. 같은 문제는 한 곳에서만 풀면 된다.

## Step 2. 길게 눌렀는데 드래그가 아니라 메뉴가 뜬다

기능을 다 만들고 폰에서 테스트하는데, 파일을 아무리 길게 눌러도 드래그가
시작되지 않고 **이름변경/삭제 메뉴가 먼저 떠버렸다.**

원인은 뻔했다. 같은 위젯에 길게 누르기 제스처가 두 개 달려 있었다.

```dart
// Before — 제스처가 충돌한다
InkWell(
  onTap: () => _openFile(entry),
  onLongPress: () => _showEntryActions(entry),  // 메뉴
  child: ...,
)
```

여기에 드래그 기능을 얹으려고 `LongPressDraggable`로 감쌌으니, **길게 누르기
이벤트를 메뉴와 드래그가 동시에 노리는 상황**이 된 거다. Flutter는 안쪽
`InkWell`의 제스처를 먼저 잡아버려서 드래그까지 이벤트가 도달하지 못했다.

해결은 제스처를 아예 나누는 것이었다. **길게 누르기는 드래그 전용으로 넘기고,
메뉴는 눈에 보이는 버튼으로 옮겼다.**

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

파일 행 오른쪽에 `⋮` 버튼을 하나 붙이고 나니 훨씬 명확해졌다. **길게 누르면
"옮기기", 점 세 개를 탭하면 "메뉴"** — 두 동작이 겹치지 않는다. 제스처를
설계할 때는 "이 위젯이 반응해야 하는 입력이 몇 개인지"를 먼저 나열해보고,
겹치는 게 있으면 무조건 다른 트리거로 분리하는 게 맞다는 걸 다시 배웠다.

## Step 3. 폴더는 드래그시키지 않기로 했다

파일 드래그는 잘 되는데, 폴더도 드래그로 옮기게 할지 고민이 됐다. Obsidian은
폴더도 드래그가 되니까 자연스러워 보였다. 그런데 곰곰이 생각해보니 **폴더
이동은 파일 이동과 리스크가 다르다.**

폴더를 옮긴다는 건 결국 "그 안의 파일을 전부 하나씩" 새 경로에 만들고
지운다는 뜻이다. 파일이 20개 있는 폴더를 옮기면 **커밋이 40개(생성 20 +
삭제 20) 생긴다.** 실수로 잘못 드래그했다가 중간에 취소하기도 애매하고,
GitHub Rate Limit에도 걸리기 쉽다. "실수로 툭 건드렸는데 큰 작업이
시작되는" 상황은 피하고 싶었다.

그래서 폴더는 **드래그 대신 명시적인 메뉴 액션**으로 만들었다.

1. 폴더를 길게 누르면 메뉴가 뜬다 (파일과 달리 폴더는 그대로 메뉴 유지)
2. 메뉴에서 **"폴더로 이동…"** 선택
3. 대상 폴더를 고르는 다이얼로그가 뜬다 (저장소를 실시간으로 탐색)
4. **"파일 12개를 이동합니다. 파일마다 커밋이 생성됩니다"** 같은 확인 문구를 보여주고 동의를 받는다
5. 확인하면 그제서야 재귀적으로 하위 파일을 전부 이동한다

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

같은 앱 안에서도 "가볍고 되돌리기 쉬운 동작"과 "무겁고 되돌리기 어려운 동작"은
다른 트리거를 써야 한다는 게 이번에 확실히 느낀 원칙이다. 파일 한 개 옮기는
건 드래그로 가볍게, 폴더 전체를 옮기는 건 몇 단계를 거치게 해서 실수를
막았다.

## 번외: 지운 줄 알았던 이전 버전 파일 되살리기

기능을 다 넣고 스토어에 올릴 준비를 하다가, 예전 버전(1.0.1) 빌드 파일을
실수로 지운 걸 나중에 알아챘다. 다시 만들어야 했는데, 문제는 **지금 작업
디렉터리는 이미 최신 코드(1.0.2)로 넘어와 있다는 것.** 여기서 그냥
`git checkout`으로 옛날 커밋으로 갔다가 돌아오면 되지만, 그러면 작업
중이던 파일들(생성된 코드, 빌드 캐시)이 뒤섞일 위험이 있다.

이럴 때 쓰기 좋은 게 **`git worktree`** 다. 같은 저장소를 다른 폴더에
동시에 체크아웃할 수 있게 해준다.

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

원래 작업 중이던 브랜치는 손끝 하나 안 대고, 완전히 별개의 폴더에서 과거
버전을 빌드할 수 있었다. `stash` → `checkout` → `build` → `checkout back`
→ `stash pop` 같은 번거로운 왕복이 필요 없다. **"지금 하던 작업은 그대로
두고, 다른 시점 코드를 잠깐 빌드만 하고 싶다"** 같은 상황엔 `git worktree`가
정답이라는 걸 이번에 제대로 체감했다.

## 정리

| 문제 | 원인 | 해결 |
|---|---|---|
| GitHub에 파일 이동 API가 없음 | Contents API는 생성/조회/삭제만 지원 | 새 경로 생성 → 기존 경로 삭제, 실패 시 삭제 대기 큐에 등록 |
| 길게 눌러도 드래그가 안 됨 | 메뉴(`onLongPress`)와 드래그가 같은 트리거를 두고 경쟁 | 길게 누르기는 드래그 전용, 메뉴는 `⋮` 버튼으로 분리 |
| 폴더도 드래그시켜야 하나? | 폴더 이동 = 파일마다 커밋 2개, 되돌리기 어려움 | 드래그 대신 메뉴 액션 + 파일 개수 확인 다이얼로그 |
| 지운 옛날 빌드 파일 복구 | 최신 코드로 작업 중인 상태에서 과거 버전을 다시 빌드해야 함 | `git worktree`로 별도 폴더에 과거 커밋 체크아웃 후 빌드 |

결국 이번에 배운 건 한 가지로 요약된다. **API 제약이든 UI 제스처든, 겹치거나
빠진 부분을 억지로 우회하지 말고 구조를 먼저 나눠라.** 이동을 생성+삭제로
쪼개고, 제스처를 드래그와 탭으로 쪼개고, 파일 이동과 폴더 이동을 가벼운
동작과 무거운 동작으로 쪼갠 것 — 전부 같은 원칙이었다.
