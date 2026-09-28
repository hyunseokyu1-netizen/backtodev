---
title: '하모니카 앱 개발기 2편 - 숫자 악보 파서, 조옮김, 그리고 에뮬레이터에서 잡은 버그 3개'
date: '2026-09-24'
publish_date: '2026-10-15'
description: 악보 사진 자동 인식 대신 한국식 숫자 악보 텍스트 파서를 먼저 만들고, Key를 바꿔도 홀·계이름·악보가 함께 바뀌도록 데이터를 설계한 뒤 Riverpod autoDispose 등 버그 3개를 잡은 기록
tags:
  - Flutter
  - Riverpod
  - Dart
  - 하모니카
  - 숫자 악보
---

> 이 글은 **하모니카 연습 앱 개발기** 시리즈의 2편입니다.
> - 1편: "소리가 두 개 나요"를 눈으로 확인하고 싶어서
> - 2편: 숫자 악보 파서, 조옮김, 그리고 에뮬레이터에서 잡은 버그 3개 (지금 글)

## 음만 맞으면 끝일까?

1편에서 마이크로 음정을 잡아 "숫자 + 계이름 + 홀 번호 + cents"를 실시간으로 보여주는 부분을 만들었습니다. 경음 때문에 흔들리는 걸 눈으로 볼 수 있게 된 거죠.

그런데 실제로 연습해 보면 음 하나 맞추는 걸로는 부족합니다. 레슨에서 받은 악보를 보면서 **"다음에 불어야 할 음"** 을 같이 봐야 하거든요. 휴대폰으로 악보 사진 보고, 튜너 앱 켜고, 왔다 갔다 하는 게 제일 불편했습니다.

그래서 이 앱의 두 번째 목표는 **악보를 올려 두고, 그 악보를 따라 불면서 맞는지 확인하는 것**이었습니다.

## Step 1. 악보 자동 인식은 일단 미뤘다

작업지시서에는 "JPG/PNG/PDF 악보를 올리면 분석해서 연주 데이터로 만든다"라고 적었습니다. 그런데 이걸 제대로 하려면 **OMR(Optical Music Recognition, 악보 인식)** 이 필요합니다. 글자 OCR과 달리 오선, 음표 머리, 꼬리, 쉼표, 조표를 다 읽어야 해서, 별도 모델이나 외부 서비스가 있어야 합니다.

MVP 단계에서 이걸 붙이면 음정 감지보다 악보 인식에 시간을 더 쓰게 됩니다. 그래서 이렇게 나눴습니다.

| 기능 | 상태 | 방법 |
|---|---|---|
| 악보 사진/파일 업로드 | 동작 | `image_picker`, `file_picker`로 올려서 화면에 띄워 둠 |
| 숫자 악보 텍스트 입력 | 동작 | `NumericNotationParser` |
| 이미지/PDF 자동 인식 | 미연결 | `ScoreParser` 인터페이스만 두고 나중에 교체 |

자동 인식은 인터페이스만 먼저 만들어 뒀습니다.

```dart
/// 악보 파일(이미지/PDF)을 연주 데이터로 바꾸는 엔진.
/// 온디바이스 모델, 서버 API, 외부 서비스 중 무엇을 쓰든 이 인터페이스만 맞추면
/// 나머지 코드는 그대로 둔 채 갈아끼울 수 있다.
abstract class ScoreParser {
  String get name;
  List<String> get supportedExtensions; // ['jpg', 'png', 'pdf']
  bool get isAvailable;

  Future<PracticeScore> parse(File file, {required String title, required String key});
}
```

지금은 `UnavailableScoreParser`라는 "아직 안 됨" 구현체가 꽂혀 있고, 나중에 엔진을 붙일 때는 이 인터페이스를 구현한 뒤 `scoreParserProvider` 한 줄만 바꾸면 됩니다. Riverpod을 쓴 이유가 여기서 나옵니다.

## Step 2. 한국식 숫자 악보 파서

그럼 당장은 어떻게 연습하나? 여기서 힌트가 된 건 **한국 하모니카 악보는 대부분 숫자 악보**라는 점이었습니다. 오선 악보를 인식하는 건 어렵지만, 숫자 악보는 사진을 옆에 띄워 두고 **텍스트로 옮겨 적는 게 금방**입니다.

표기법은 이렇게 정했습니다.

| 표기 | 의미 | 예 |
|---|---|---|
| `1`~`7` | 도~시 | `1 2 3` = 도 레 미 |
| `0` | 쉼표 | `5 0 5` |
| `1'` / `1''` | 한/두 옥타브 위 | `1'` = 높은 도 |
| `1,` / `1,,` | 한/두 옥타브 아래 | `5,` = 낮은 솔 |
| `1-` | 2박 (`-` 하나마다 1박) | `5--` = 3박 |
| `1_` | 0.5박 (`_` 하나마다 절반) | `3_ 4_` |
| `1.` | 점음표 (1.5배) | `5.` |
| `\|` | 마디 구분 | `1 2 3 4 \| 5 - - -` |

예를 들어 "학교종"의 첫 줄은 이렇게 입력합니다.

```text
5 5 6 6 | 5 5 3 - | 5 5 3 3 | 2 - - -
```

파서는 공백과 줄바꿈으로 토큰을 나눈 뒤 하나씩 해석합니다. 재미있었던 부분은 **따로 떨어진 `-`** 처리입니다. 종이 악보에서는 `5 - - -`처럼 긴 음을 줄로 이어 쓰는 경우가 많아서, 홀로 선 `-`는 "앞 음을 1박 늘린다"로 처리했습니다.

```dart
// 홀로 선 '-'는 앞 음을 1박 늘린다. (줄로 이어진 긴 음 표기)
if (RegExp(r'^-+$').hasMatch(token)) {
  if (notes.isEmpty) {
    throw NotationParseException('$i번째 토큰: 늘릴 앞 음이 없습니다. ("$token")');
  }
  final previous = notes.removeLast();
  // (실제 코드는 MusicNote를 새로 만들어 duration만 늘린다)
  notes.add(previous.copyWithDuration(previous.duration + token.length));
  beat += token.length;
  continue;
}
```

잘못된 토큰이 있으면 **몇 번째 토큰이 왜 틀렸는지** 예외 메시지에 담아서 입력 화면에 보여 줍니다. 옮겨 적다 보면 오타가 꼭 나니까요.

## Step 3. Key를 바꾸면 전부 따라와야 한다

하모니카는 Key별로 악기가 따로 있습니다. C 하모니카, G 하모니카... 그리고 숫자 악보의 `1`은 **항상 현재 Key의 도**입니다.

```text
C Key: 1=C, 2=D, 3=E ...
G Key: 1=G, 2=A, 3=B ...
```

Key를 바꾸면 목표 음, 계이름, 홀 매핑, 악보가 전부 일관되게 바뀌어야 합니다. 처음엔 Key마다 24홀 배열을 다 적어 둘까 했는데, 12 Key × 24홀 = 288개 데이터를 손으로 관리하는 건 말이 안 됩니다.

그래서 **실제 음정 대신 "패턴"** 만 저장했습니다. `assets/harmonicas/models.json`:

```json
{
  "id": "standard-24-tremolo",
  "name": "표준 24홀 트레몰로",
  "holeCount": 24,
  "pattern": [
    { "number": 1, "scaleDegree": 1, "octaveOffset": 0, "breath": "blow" },
    { "number": 2, "scaleDegree": 2, "octaveOffset": 0, "breath": "draw" },
    { "number": 3, "scaleDegree": 3, "octaveOffset": 0, "breath": "blow" }
  ]
}
```

"으뜸음 기준 몇 번째 음인지(`scaleDegree`), 몇 옥타브 위인지(`octaveOffset`), 불기인지 마시기인지(`breath`)"만 담기 때문에, Key를 바꾸면 같은 패턴이 그대로 조옮김됩니다. 12개 Key용 데이터를 따로 둘 필요가 없습니다.

표준 배열에서 알게 된 사실도 하나 있습니다.

- 불기 음은 으뜸화음 1·3·5(도·미·솔), 나머지 2·4·6·7은 들이마시기
- 그래서 **6(라)과 7(시)은 연속으로 들이마시기**
- 같은 음이 여러 홀에 있으면 하나로 강제하지 않고 "도: 가능한 홀 1 / 13"처럼 표시

제조사마다 배열이 다를 수 있는데, 그럴 땐 JSON에 모델을 하나 추가하면 됩니다. 코드는 건드리지 않아도 됩니다.

## Step 4. 조옮김 - 이 하모니카로 불 수 있는 Key 찾기

레슨 악보가 F Key인데 제 하모니카가 C라면? 반음 단위로 악보를 옮겨야 합니다. `TransposeService`는 모든 음의 MIDI 번호에 반음 수를 더하고, 숫자 악보는 **새 Key 기준으로 다시 계산**합니다.

```dart
final notes = score.notes.map((note) {
  if (note.isRest) return note;
  final midi = note.midi + semitones;
  return MusicNote(
    note: NoteUtils.noteNames[midi % 12],
    octave: (midi ~/ 12) - 1,
    midi: midi,
    scaleDegree: NoteUtils.scaleDegreeOf(midi, key), // 새 Key 기준
    duration: note.duration,
    startBeat: note.startBeat,
    measure: note.measure,
  );
}).toList();
```

여기에 하나를 더 붙였습니다. 조옮김 후보마다 **"이 하모니카로 실제로 낼 수 있는 음이 몇 개인지"** 를 계산해서 보여 줍니다(`TransposeOption.playableNotes / totalNotes`). 24홀 트레몰로는 반음(#, b)을 낼 수 없어서, 아무 Key로나 옮기면 못 부는 음이 생기거든요. 100% 연주 가능한 후보를 먼저 고르면 됩니다.

## Step 5. 에뮬레이터에서 잡은 버그 3개

Android 14(API 34) 에뮬레이터에서 전체 흐름을 돌려 봤습니다.

1. 마이크 권한 요청 → 실시간 감지 → 숫자/계이름/홀/cents 표시
2. 음계 연습 시작 → 목표 음 진행 → 결과 화면 → 기록 저장 → 기록 목록
3. 악보 등록(숫자 악보 입력) → 미리보기 → 조옮김 → 연주 화면

여기서 버그 세 개가 나왔는데, 셋 다 Riverpod을 처음 쓰는 사람이 빠지기 쉬운 함정이라 정리해 둡니다.

### 버그 1. 시작했는데 목표 음이 비어 있다 - autoDispose

| 항목 | 내용 |
|---|---|
| 증상 | 음계 연습을 시작하면 목표 음 카드가 비어 있음 |
| 원인 | `practiceControllerProvider`가 `autoDispose`. `start()`를 먼저 부르고 화면으로 넘어가는 사이 구독자가 0명이 되어 폐기됨. 화면이 붙을 때는 빈 새 인스턴스가 생성됨 |
| 해결 | 화면 구독 전에 `start()`가 불리는 구조이므로 autoDispose를 쓰지 않음 |

`autoDispose`는 "아무도 안 보면 치운다"입니다. 그 "아무도 안 보는 순간"이 화면 전환 사이에 아주 잠깐 생길 수 있다는 걸 이번에 배웠습니다.

### 버그 2. 결과 화면이 끝없이 쌓인다 - build()에서 화면 이동

| 항목 | 내용 |
|---|---|
| 증상 | 연습이 끝나고 결과 화면에서 확인을 눌러도 같은 결과 화면이 또 나옴 |
| 원인 | `build()` 안에서 "완료면 결과 화면 push". 감지 결과가 20~30ms마다 들어와 화면이 다시 그려질 때마다 결과 화면이 새로 쌓임 |
| 해결 | `PracticeCompletionGate` 위젯으로 분리. `ref.listen` + `_handled` 플래그로 **완료로 바뀌는 순간 한 번만** 반응 |

```dart
ref.listen(practiceControllerProvider, (previous, next) {
  if (next.finished && !_handled) {
    _handled = true;
    _showResult();
  }
});
```

실시간 오디오 앱은 초당 수십 번 다시 그려집니다. `build()`는 "그리기만" 하고, 부수 효과(화면 이동, 저장)는 `listen`으로 빼야 한다는 원칙을 몸으로 익혔습니다.

### 버그 3. 끝났다는데 결과가 null - 상태 알림 순서

| 항목 | 내용 |
|---|---|
| 증상 | 결과 화면을 열 때 가끔 null 에러 |
| 원인 | 컨트롤러가 "진행 상태 = 끝남"을 먼저 알리고, 결과 객체는 그다음에 만듦. 알림을 받은 구독자가 아직 null인 result를 읽음 |
| 해결 | 결과를 먼저 만들고 상태를 한 번에 갱신 |

세 버그 모두 회귀 테스트를 붙였습니다.

```bash
flutter test test/providers/practice_controller_test.dart
flutter test test/features/practice_completion_gate_test.dart
```

## 아직 남은 것

솔직하게 적어 둡니다.

- **화면 켜짐 유지**: 실제 하모니카로 불어 보니 경음도 잡히고 지금 내는 계이름도 잘 보였는데, 연습 도중 화면이 자꾸 꺼졌습니다. 다음 작업에서 연습 화면이 켜져 있는 동안에는 화면이 꺼지지 않게 할 예정입니다.
- **감도 미세 조정**: 방 소음이나 폰 마이크에 따라 `PitchSmoother`의 `minConfidence`, `PitchService`의 `noiseGateRms`, YIN `threshold`를 더 다듬을 수 있습니다.
- **판정 기준**: ±10/25/50 cents는 초기값입니다. 레슨 받으면서 너무 빡빡한지 느슨한지 맞춰 볼 생각입니다.
- **악보 자동 인식**: `ScoreParser` 구현체를 붙이는 건 다음 과제입니다.
- **릴리즈 서명**: 지금은 debug 키 서명이라 스토어 배포 전에 설정이 필요합니다.

## 정리

| 주제 | 선택 | 이유 |
|---|---|---|
| 악보 업로드 | 사진 띄우기 + 숫자 악보 텍스트 입력 | OMR 없이도 오늘 바로 연습 가능 |
| 자동 인식 | `ScoreParser` 인터페이스만 | provider 한 줄로 엔진 교체 |
| 하모니카 데이터 | Key 무관한 패턴 JSON | 12 Key × 24홀을 따로 관리하지 않음 |
| 조옮김 | 반음 이동 + 연주 가능 음 비율 | 반음 없는 트레몰로에 맞는 Key 선택 |
| Riverpod 교훈 | autoDispose 주의, `build()`에서 부수 효과 금지, 결과 먼저 상태 나중 | 실시간 앱은 초당 수십 번 다시 그린다 |

"소리가 두 개 나요"라는 한마디에서 시작한 앱인데, 만들다 보니 트레몰로 하모니카가 왜 떨리는지, 숫자 악보가 어떻게 생겼는지, 하모니카 배열이 왜 6·7번에서 연속으로 마시는지까지 알게 됐습니다. 다음 레슨 때는 이 앱을 켜 두고 선생님께 "이번엔 한 음만 났죠?" 하고 여쭤볼 생각입니다.
