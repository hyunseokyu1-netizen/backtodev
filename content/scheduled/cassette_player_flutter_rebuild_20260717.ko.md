---
title: 'React Native 카세트 플레이어를 Flutter로 통째로 다시 만든 이야기'
date: '2026-07-17'
publish_date: '2026-09-06'
description: 디자인이 마음에 안 들어 React Native 카세트 뮤직 플레이어를 Flutter로 재구축하면서 겪은 분석-설계-마이그레이션-실기기 트러블슈팅 전 과정
tags:
  - Flutter
  - React Native
  - Riverpod
  - drift
  - 마이그레이션
---

## 잘 되던 앱을 왜 다시 만들었나

몇 달 전에 React Native(Expo)로 카세트 테이프 뮤직 플레이어를 만들었다. Side A/B에 30분씩 곡을 담고, FF/REW를 길게 눌러 감고, 유튜브 링크도 붙일 수 있는 앱이었다. 기능은 다 됐는데 막상 써보니 디자인이 계속 눈에 밟혔다. 뉴모피즘 버튼도 어정쩡하고, 카세트 비주얼도 장난감처럼 보였다.

디자인만 손보고 싶었지만, 그동안 Flutter를 제대로 써본 적이 없었던 터라 이번 기회에 아예 프레임워크를 바꿔서 다시 만들어보기로 했다. "그냥 새로 짜면 되지 않나" 싶겠지만, 문제는 이미 쓰고 있는 사람들의 데이터였다. 만든 테이프, 담아둔 곡, 마지막 재생 위치 — 이걸 다 날리고 새 앱을 내놓을 수는 없었다.

그래서 이번 작업은 "예쁜 UI 만들기"가 아니라 "기존 기능과 데이터를 하나도 잃지 않으면서 프레임워크를 갈아엎기"에 가까웠다. 이 글은 그 과정에서 실제로 어떤 순서로 작업했고, 어떤 지점에서 막혔는지 기록이다.

## Step 1. 코드부터 새로 짜지 않는다 — 분석이 먼저

가장 하고 싶었던 유혹은 "어차피 다시 만드는 거, 그냥 좋은 거 다 넣어서 새로 짜자"였다. 그런데 이렇게 하면 십중팔구 기존에 잘 되던 기능을 몇 개는 빼먹는다. 그래서 순서를 강제로 정했다.

1. 기존 RN 프로젝트 전체 구조 확인
2. 실행해서 화면 흐름 캡처
3. 재생 엔진 코드를 줄 단위로 읽기
4. 데이터 저장 구조 확인
5. 그제서야 Flutter 설계 시작

실제로 기존 코드(`useAudioPlayer.ts`)를 읽어보니 1,450줄짜리 훅 하나에 재생 엔진, 테이프 CRUD, 저장 로직이 전부 들어있었다. 코드 자체는 지저분했지만, 그 안에 있는 **도메인 규칙**은 의외로 정교했다.

- 트랙과 트랙 사이에 자동으로 2초짜리 "노이즈" 아이템이 끼워진다 (실제 테이프 넘어가는 소리 재현)
- 한 면이 끝나면 30분 채울 때까지 노이즈만 재생하다가, 자동으로 반대 면으로 넘어간다
- FF/REW를 길게 누르면 실제 테이프 위치가 초당 1초씩(10배속) 이동하고, 손을 떼면 그 위치의 정확한 트랙/오프셋을 계산해서 착지한다

이런 건 코드를 안 읽고 추측했으면 절대 재현 못 했을 디테일이다. 그래서 분석 결과를 마크다운 문서 4개(`legacy-analysis.md`, `feature-mapping.md`, `data-migration-plan.md`, `flutter-architecture.md`)로 먼저 정리하고, 여기에 "유지해야 할 기능"과 "새로 추가할 기능"을 표로 갈라놓은 다음에야 Flutter 코드를 짜기 시작했다.

## Step 2. 아키텍처: Feature-first + Riverpod + drift

Flutter를 처음 제대로 써보면서 가장 헷갈렸던 건 "상태 관리를 뭘로 하지"였다. Riverpod, Bloc, Provider... 결국 Riverpod으로 정했는데, 이유는 단순했다. 재생 엔진이 `Stream`으로 상태를 흘려보내는 구조라서, 그 스트림을 구독해서 UI 상태로 바꾸는 데 Riverpod의 `Notifier`가 제일 자연스러웠다.

디렉터리는 feature-first로 나눴다.

```text
lib/
  app/            # 라우팅, 테마, 부트스트랩
  core/
    audio/        # 재생 엔진 (PlayerController)
    database/     # drift 스키마 + 레거시 마이그레이션
    sharing/      # 공유 코드 인코딩/디코딩
  features/
    player/       # 메인 데크 화면
    tapes/        # 테이프 목록
    tape_editor/  # Side A/B 편집
    youtube/
    settings/
```

로컬 DB는 `drift`를 골랐다. SQLite 기반이라 나중에 기존 RN 앱의 SQLite 파일(AsyncStorage가 내부적으로 쓰는 `RKStorage`)을 그대로 열어서 읽어올 수 있다는 점이 결정적이었다.

```dart
class TapeItems extends Table {
  TextColumn get id => text()();
  TextColumn get tapeId => text().references(Tapes, #id, onDelete: KeyAction.cascade)();
  TextColumn get side => text().withLength(min: 1, max: 1)(); // 'A' or 'B'
  IntColumn get position => integer()();
  TextColumn get type => text()(); // 'track' or 'noise'
  IntColumn get durationMs => integer()();
  // ...
}
```

여기서 하나 배운 게 있다. SQLite는 **외래 키 제약을 기본적으로 무시한다.** 테이프를 삭제했는데 딸린 트랙이 안 지워지는 버그가 났고, 원인은 `PRAGMA foreign_keys = ON`을 안 켜서였다.

```dart
@override
MigrationStrategy get migration => MigrationStrategy(
  onCreate: (m) => m.createAll(),
  beforeOpen: (details) => customStatement('PRAGMA foreign_keys = ON'),
);
```

이거 하나 빠뜨려서 cascade 삭제가 조용히 안 먹었던 걸 테스트 작성하다가 잡았다. 처음 SQLite 만지는 사람이라면 꼭 기억해둘 만하다.

## Step 3. 재생 엔진 — "테이프 위치"라는 개념 하나로 통일

Flutter에서 오디오는 `just_audio`, 백그라운드 재생/잠금화면 컨트롤은 `audio_service`로 붙였다. 그런데 진짜 어려웠던 건 라이브러리 사용법이 아니라 **상태 모델링**이었다.

기존 RN 코드에는 `tapePosition`이라는 값이 있었다. 이게 뭐냐면, 지금 재생 중인 트랙 안에서의 위치가 아니라 **노이즈까지 포함한 한 면 전체에서의 절대 위치**다. 이 값 하나만 있으면:

- 릴이 얼마나 감겼는지 (반지름 계산)
- 디지털 카운터에 몇 분 몇 초를 띄울지
- FF/REW로 어디까지 이동했는지
- 면을 뒤집었을 때 반대 면 어디서부터 재생할지 (`30분 - 현재 위치`)

전부 계산이 된다. 이 아이디어는 그대로 가져와서 Dart로 옮겼다.

```dart
/// 절대 테이프 위치(targetMs)가 어느 아이템의 어느 오프셋에 해당하는지 계산
TapeLanding findItemAtTapePosition(List<SideItem> items, int targetMs) {
  var elapsed = 0;
  for (var i = 0; i < items.length; i++) {
    final dur = items[i].durationMs;
    if (elapsed + dur > targetMs) {
      return (itemIdx: i, offsetMs: targetMs - elapsed);
    }
    elapsed += dur;
  }
  // 범위 초과 시 첫 트랙부터
  final firstTrack = items.indexWhere((it) => it is TrackItem);
  return firstTrack != -1 ? (itemIdx: firstTrack, offsetMs: 0) : (itemIdx: 0, offsetMs: 0);
}
```

이 함수 하나가 FF, REW, 면 뒤집기, 재생 위치 복원에서 전부 재사용된다. 로직을 한 군데로 모아두니 유닛 테스트도 붙이기 쉬웠다 — UI 없이 순수 함수라서 `flutter test`로 경계값(트랙 경계, 콘텐츠 범위 초과 등)을 다 검증할 수 있었다.

## Step 4. 카세트 비주얼 — CustomPainter로 처음 그려본 아날로그 질감

Flutter의 `CustomPainter`를 실전에서 써본 게 이번이 처음이었다. 참고 이미지로 받은 빈티지 카세트(크림색 셸 + 오렌지 밴드 + 검은 기어 릴)를 재현하려고 그라디언트, 그림자, 회전하는 기어를 직접 좌표 계산해서 그렸다.

핵심은 릴 두 개의 반지름이 재생 진행률에 따라 서로 반대로 변한다는 것.

```dart
final leftRadius = minR + (1 - progress) * (maxR - minR);
final rightRadius = minR + progress * (maxR - minR);
```

그리고 회전 속도도 고정이 아니라, 감긴 테이프 양에 따라 3초~18초 주기로 변한다. 감긴 양이 적을수록(반지름이 작을수록) 빨리 돈다 — 실제 카세트 테이프의 각속도 물리를 흉내 낸 거다. 처음엔 "이렇게까지 해야 하나" 싶었는데, 막상 넣고 보니 이 디테일 하나로 "그냥 이미지가 빙글빙글 도는" 느낌과 "진짜 테이프가 감기는" 느낌의 차이가 확 났다.

```dart
double periodFor(double ratio) =>
    fast ? 250.0 : 3000.0 + ratio * ratio * 15000.0;
```

## Step 5. 기존 사용자 데이터를 지키는 법

여기가 이번 작업에서 제일 긴장했던 부분이다. React Native 앱은 `AsyncStorage`를 쓰는데, 안드로이드에서는 내부적으로 `RKStorage`라는 SQLite 파일에 키-값으로 저장된다. Flutter 앱이 **같은 패키지명**으로 업데이트 설치되면, 앱 데이터 디렉터리가 그대로 유지되기 때문에 이 파일을 직접 열어서 읽어올 수 있다.

```dart
final rows = db.select(
  'SELECT key, value FROM catalystLocalStorage WHERE key IN (?, ?, ?, ?, ?)',
  [keyTapes, keyCurrentTape, keySide, keyA, keyB],
);
```

마이그레이션 절차는 다음 순서로 짰다.

1. 이미 마이그레이션했는지 플래그 확인 (중복 실행 방지)
2. 기존 SQLite 파일 존재 여부 확인 → 없으면 신규 사용자
3. 원본 파일 백업
4. 키-값 읽어서 JSON 파싱 → 새 도메인 모델로 변환
5. drift 트랜잭션으로 일괄 삽입
6. 성공하면 플래그 저장, **실패하면 플래그를 안 남겨서 다음 실행 때 재시도**

5번이 중요한데, `importTape`가 upsert라서 재시도해도 데이터가 중복되지 않는다. 실패했을 때 "일단 빈 상태로 시작하고 플래그만 저장"해버리면 사용자 데이터를 영영 잃을 수 있어서, 이 부분은 조금 보수적으로 짰다.

## Step 6. 실기기에 깔면서 만난 진짜 문제들

여기부터는 코드보다 삽질 기록에 가깝다.

### 서명 키가 다르면 업데이트 설치가 안 된다

```bash
adb install -r app-release.apk
# Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE:
#  Existing package com.hscassette.player signatures do not match newer version; ignoring!]
```

당연한 얘기지만 Flutter 프로젝트를 새로 만들면 서명 키도 새로 생긴다. 실기기 테스트 단계에서는 기존 앱을 지우고 새로 설치하는 수밖에 없었다 (그 폰에 있던 테스트 데이터는 당연히 날아간다). 실제 출시할 때는 기존 RN 앱을 빌드했던 keystore 파일을 반드시 그대로 써야 한다는 걸 다시 한번 확인한 계기였다.

### file_picker 구버전이 최신 Gradle에서 빌드가 깨진다

```text
Could not find method jcenter() for arguments [] on repository container
```

`file_picker: ^3.0.4`로 시작했다가 릴리즈 빌드에서만 이 에러가 났다. 원인은 그 버전의 안드로이드 빌드 스크립트가 요즘은 사라진 `jcenter()` 저장소를 참조하고 있었던 것. `file_picker`를 10.x로 올리니 해결됐는데, 그러자 이번엔 `share_plus`가 요구하는 `win32` 버전과 충돌이 나서 `share_plus`를 12.x로 한 단계 내려야 했다. Flutter 패키지 버전은 최신이 항상 정답은 아니고, 서로 의존성 그래프가 맞물리는 조합을 찾아야 한다는 걸 체감했다.

### 카톡으로 공유한 텍스트가 중간에 잘린다

테이프 공유 기능은 서버 없이 "테이프 정보를 통째로 base64 인코딩한 텍스트"를 메신저로 보내는 방식이다. 그런데 실사용자가 카톡으로 받은 텍스트를 복사해서 붙여넣었더니 "테이프 코드를 찾지 못했어요"가 떴다.

원인을 찾아보니 **카톡이 긴 메시지를 복사할 때 뒷부분을 잘라버리는** 현상이었다. 코드가 중간에 잘리면 base64 디코딩이 통째로 실패한다. 이걸 고치려고 "잘린 코드에서도 복원 가능한 부분까지는 살려내는" 복구 로직을 추가했다.

```dart
/// 잘린 JSON에서 파싱 가능한 최대 앞부분을 복구.
/// 값 경계(',', '}', ']') 지점마다 미완성 꼬리를 잘라내고
/// 열린 괄호를 자동으로 닫아 시도한다.
Map<String, dynamic>? salvageTruncatedJson(String s) {
  // 문자열 안이 아닌 위치의 콤마/닫는 괄호를 전부 찾아서
  // 뒤에서부터 순서대로 "여기서 자르면 유효한 JSON이 되는지" 시도
}
```

정상적인 공유 흐름에서는 절대 안 만날 버그인데, 실제 사용자가 실제로 쓰는 메신저 조합에서만 나타나는 문제였다. "내 컴퓨터에선 잘 되는데?"의 전형적인 사례라, 실기기 + 실제 사용 시나리오로 테스트하는 게 왜 중요한지 다시 느꼈다.

## 정리

돌아보면 이번 작업의 8할은 "새 기능 만들기"가 아니라 "기존 걸 안 잃어버리게 옮기기"였다.

| 단계 | 핵심 |
|---|---|
| 분석 | 코드부터 짜지 않고 기존 로직·데이터 구조를 문서로 정리 |
| 아키텍처 | Riverpod(상태) + drift(저장) + feature-first 디렉터리 |
| 재생 엔진 | "테이프 위치" 하나로 릴/카운터/FF·REW/면전환을 통일해서 모델링 |
| 비주얼 | CustomPainter로 회전 속도·반지름까지 물리감 있게 재현 |
| 마이그레이션 | 같은 패키지명 유지 + 실패해도 재시도 가능한 구조 |
| 실기기 검증 | 서명 키, 패키지 버전 충돌, 메신저 텍스트 잘림까지 실제로 써보며 발견 |

프레임워크를 바꾸는 리라이트는 "지금 아는 걸 다 넣어서 처음부터 새로 짜고 싶은" 유혹이 항상 따라온다. 하지만 이미 쓰고 있는 사람이 한 명이라도 있다면, 그 유혹을 참고 기존 코드를 먼저 읽는 게 결국 더 빠른 길이었다.
