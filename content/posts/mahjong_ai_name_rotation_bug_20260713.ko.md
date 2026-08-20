---
title: '같은 AI인데 이름이 달라 보인다 — LAN 대전 좌석 회전이 숨긴 버그'
date: '2026-07-13'
publish_date: '2026-08-21'
description: 마작 게임 LAN 멀티플레이에서 같은 AI가 참가자 화면마다 다른 이름(곰돌이·야옹이 vs 곰돌이·토끼)으로 보이던 버그의 원인과, 화면 위치와 실제 좌석을 분리해서 고친 과정
tags:
  - Flutter
  - Dart
  - 멀티플레이
  - 게임개발
  - 디버깅
---

# 같은 AI인데 이름이 달라 보인다

만들고 있는 마작 게임 "마작 조이"의 LAN 멀티플레이를 가족과 테스트하다가, 스크린샷 두 장을 나란히 받았다. 같은 판, 같은 순간인데 AI 좌석 이름이 서로 달랐다.

- 폰 A: 야옹이, 곰돌이
- 폰 B: 토끼, 곰돌이

곰돌이는 둘 다 똑같이 보이는데, 나머지 AI 하나가 한쪽에서는 "야옹이", 다른 쪽에서는 "토끼"로 나온 것이다. 겉으로 보면 그냥 표시 버그 같지만, 원인을 파고들면 이 프로젝트의 멀티플레이 구조 전체를 관통하는 개념 하나를 놓친 결과였다.

## 화면 위치와 실제 좌석은 다르다

이 게임의 LAN 대전은 호스트 폰 하나가 심판 역할을 하고, 나머지 참가자는 자기 화면에 상태를 받아 그리기만 한다. 이때 핵심 트릭이 하나 있다. **모든 참가자는 자기 자신을 항상 "화면 아래쪽(좌석 0)"으로 본다.** 실제 게임 데이터에서는 내가 좌석 2든 3이든, 호스트가 나에게 상태를 보낼 때 좌석 번호를 회전시켜서 "네가 0번"인 것처럼 만들어준다. 그래야 4명이 각자 폰을 어떻게 들고 있든 항상 자기 손패가 화면 아래에 보인다.

```
실제 좌석:     0(호스트)  1(나)  2(AI)  3(AI)
내 화면에서:      2         0      1      3   ← 회전됨
```

이 회전 덕분에 화면 그리기 코드는 정말 단순해진다. "좌석 0"이라고 쓰면 그게 항상 나 자신이니까, 화면 아래에 컨트롤 버튼을 놓고 손패를 보여주는 로직에 조건문이 필요 없다.

## 버그의 위치: 이름을 고르는 곳

문제는 AI 이름을 고르는 코드였다.

```dart
String _nameOf(TableController gc, Strings s, int seat) =>
    gc.seatNames?[seat] ?? s.playerNames[seat];
```

`seatNames`가 있으면(실제 참가자 이름) 그걸 쓰고, 없으면(AI) `playerNames`라는 언어별 이름 목록(`['나', '토끼', '곰돌이', '야옹이']`)에서 좌석 번호로 이름을 골라온다. 그런데 이 `seat` 매개변수에 들어오는 값이 바로 **화면 회전이 끝난 뒤의 위치 번호**였다.

위 표로 다시 보면, 실제 좌석 2번 AI는:
- 나(좌석 1)의 화면에서는 회전 후 위치 1 → `playerNames[1]` = "토끼"
- 호스트(좌석 0)의 화면에서는 회전이 없으니 위치 2 → `playerNames[2]` = "곰돌이"

같은 AI를 서로 다른 인덱스로 조회하니, 당연히 다른 이름이 나올 수밖에 없었다. 회전은 "손패를 어디에 그릴지"에는 완벽하게 맞는 개념인데, "이 AI의 정체성(이름)이 뭔지"에는 적용하면 안 되는 개념이었던 것이다. 이 둘을 구분하지 못한 게 버그의 본질이었다.

## 고치는 법: 실제 좌석 번호를 함께 보낸다

해결 방향은 명확했다. 이름을 고를 때만큼은 회전 전의 "진짜 좌석 번호"를 알아야 한다. 호스트가 각 참가자에게 상태를 보낼 때, 그 사람 자신의 실제 좌석 번호를 함께 실어 보내기로 했다.

```dart
// buildView() — 호스트가 각 참가자에게 보내는 스냅샷
return {
  'type': 'view',
  // ...
  // 참가자 자신의 실제(회전 전) 좌석 번호. AI 이름은 화면 위치가
  // 아니라 이 번호를 기준으로 골라야 참가자마다 다르게 보이지 않는다.
  'mySeat': forSeat,
  'myHand': tileKeys(game.players[forSeat].hand),
  // ...
};
```

클라이언트는 이 값을 저장해두고, "화면 위치 → 실제 좌석"으로 되돌리는 함수를 하나 만들었다.

```dart
// NetClientController
int _mySeat = 0; // view가 도착하면 갱신됨

@override
int actualSeatOf(int seat) => (seat + _mySeat) % 4;
```

이 함수를 공통 인터페이스(`TableController`)에 추가하고, 로컬 AI 대전처럼 애초에 회전이 없는 모드에서는 기본값(항등함수)을 쓰게 했다.

```dart
abstract class TableController extends ChangeNotifier {
  // ...
  /// 화면에 보이는 좌석 번호(0=나)를 실제(회전 전) 좌석 번호로 바꾼다.
  /// 로컬 대전은 회전이 없어 항등함수, LAN 클라이언트는 호스트가
  /// 알려준 자신의 실제 좌석을 기준으로 되돌린다.
  int actualSeatOf(int seat) => seat;
}
```

마지막으로 이름을 고르는 코드를 이걸 쓰도록 고쳤다.

```dart
String _nameOf(TableController gc, Strings s, int seat) =>
    gc.seatNames?[seat] ?? s.playerNames[gc.actualSeatOf(seat)];
```

한 줄 차이지만, `seat`(화면 위치)와 `actualSeatOf(seat)`(실제 좌석)를 명확히 구분한 게 핵심이다. 이제 어느 참가자의 화면에서 보든, 실제 좌석 2번 AI는 항상 `playerNames[2]` = "곰돌이"로 고정된다.

## 테스트로 재현하기

이런 종류의 버그는 실기기 2~3대를 붙여놓고 눈으로 비교해야 겨우 알아채는데, 그렇다고 매번 폰을 여러 대 붙여서 검증할 순 없다. 그래서 실제 소켓 통신으로 호스트 1명 + 참가자 2명을 붙이고, 각자 화면에서 같은 AI가 진짜로 같은 실제 좌석을 가리키는지 확인하는 테스트를 만들었다.

```dart
test('AI 좌석의 실제 좌석 번호는 회전과 무관하게 참가자마다 동일하다', () async {
  // 호스트 + 클라이언트 2명, 좌석3만 AI로 남긴다.
  final host = NetHostController(hostName: '방장', aiDelay: Duration.zero);
  await host.open(advertise: false);
  final clients = <NetClientController>[];
  for (var i = 0; i < 2; i++) {
    final c = NetClientController();
    clients.add(c);
    await c.connect(InternetAddress.loopbackIPv4, host.port!, name: 'C$i');
  }
  await waitFor(() => host.humanCount == 3);
  host.startGame();
  await waitFor(() => clients.every((c) => c.status == NetClientStatus.playing));

  for (final c in clients) {
    // 이 클라이언트 화면에서 AI가 보이는 위치를 찾고,
    final localPos = c.seatNames!.indexWhere((n) => n == null);
    // 실제 좌석으로 되돌리면 항상 3이어야 한다 —
    // 즉 참가자마다 다른 위치에 보여도 이름 조회 기준은 같아야 한다.
    expect(c.actualSeatOf(localPos), 3);
  }
});
```

핵심은 `localPos`(참가자마다 다를 수 있음)와 `actualSeatOf(localPos)`(항상 3이어야 함)를 나란히 검증한 부분이다. 이게 통과한다는 건 "화면에 어디 보이든, 실제 정체성 조회는 항상 같은 결과를 낸다"는 걸 뜻한다.

## 정리

이번 버그가 알려준 건 단순하다. **화면에 그리는 위치**와 **데이터가 가리키는 실제 개체**는 서로 다른 좌표계일 수 있고, 둘을 섞어 쓰면 "각자한테는 정상으로 보이는데 서로 비교하면 틀린" 종류의 버그가 생긴다는 것.

- 좌석 회전은 "누구 화면에서 어디에 그릴지"를 위한 것 — UI 좌표계
- AI 이름 조회는 "이게 실제로 어떤 개체인지"를 위한 것 — 데이터 좌표계

이 둘을 명시적으로 구분하는 함수(`actualSeatOf`) 하나를 인터페이스에 추가하는 것으로 해결됐다. 멀티플레이 게임에서 "회전", "오프셋", "로컬 인덱스" 같은 개념이 등장하면, 그 값이 정말 모든 곳에서 같은 좌표계를 가리키는지 한 번 더 의심해볼 만하다.
