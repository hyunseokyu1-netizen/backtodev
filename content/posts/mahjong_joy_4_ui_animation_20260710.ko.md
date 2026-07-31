---
title: 'Mahjong Joy 개발기 (4) — 파스텔 UI와 RotatedBox 마작 테이블, 타일 애니메이션'
date: '2026-07-10'
publish_date: '2026-08-01'
description: Flame 없이 순수 Flutter 위젯으로 파스텔톤 마작 UI를 만들고, RotatedBox 4방향 테이블 배치와 TweenAnimationBuilder 타일 애니메이션을 구현한 과정
tags:
  - Flutter
  - UI
  - 애니메이션
  - 게임개발
---

> **Mahjong Joy 시리즈**
> 1. 기획 분석과 작업 계획
> 2. 핵심 로직 — 승리 판정 알고리즘
> 3. 게임 엔진과 AI 만들기
> 4. **파스텔 UI와 타일 애니메이션** ← 이번 글
> 5. 점수 시스템과 메인화면

## 게임 엔진처럼 보이지만, 전부 기본 위젯이다

이번 편의 결론을 먼저 말하면: **턴제 보드게임 UI에 게임 엔진(Flame)은 필요 없다.** 타일이 날아다니는 애니메이션까지 포함해서 전부 Flutter 기본 위젯으로 만들었다. `Container`, `Stack`, `RotatedBox`, `TweenAnimationBuilder`. 이게 전부다.

## Step 1: 파스텔 테마와 이모지 타일

기획안의 컨셉은 "따뜻하고 귀여운 비주얼". 민트/핑크/크림 팔레트를 상수로 정의하고 시작했다.

```dart
class Palette {
  static const mint = Color(0xFFA8E6CF);
  static const pink = Color(0xFFFFB3C1);
  static const cream = Color(0xFFFFF6E9);
  static const tableGreen = Color(0xFFD3F0E4);
  static const textBrown = Color(0xFF6B5B4D);
}
```

타일은 한자 대신 **숫자 + 이모지 심볼** 조합이다. 이미지 에셋을 한 장도 만들지 않았다.

| 전통 마작 | Mahjong Joy | 심볼 |
|---|---|---|
| 만수패 | 귤 | 🍊 |
| 통수패 | 곰 | 🐻 |
| 삭수패 | 꽃 | 🌸 |
| 자패 7종 | 날씨 | ☀️ ☁️ 🌧️ ❄️ 🌙 ⭐ 🌈 |

이모지 타일의 장점은 명확하다. 에셋 파이프라인이 없고, 모든 플랫폼에서 렌더링되고, 사이즈 조절이 `fontSize` 하나로 끝난다. 프로토타입 단계에선 최고의 선택이다. 상대 플레이어도 🐰토끼, 🧸곰돌이, 🐱야옹이로 이모지 아바타다.

## Step 2: 컨트롤러 — 자동 진행 루프와 세대 토큰

UI와 엔진 사이엔 `ChangeNotifier` 컨트롤러를 뒀다. 핵심은 `_drive()`라는 자동 진행 루프다. AI 턴은 딜레이를 넣어 자동으로 진행하다가, **사람의 입력이 필요한 지점에서 루프가 멈추고 리턴**한다.

```dart
Future<void> _drive() async {
  final gen = _generation; // 세대 토큰
  while (!_disposed && gen == _generation && !isFinished) {
    if (game.phase == GamePhase.awaitingDiscard) {
      if (game.current == humanSeat) return; // 사람 입력 대기

      await Future.delayed(_aiDelay);
      if (_disposed || gen != _generation) return; // 그 사이 새 판 시작?

      // AI 턴 진행...
    }
  }
}
```

`_generation`은 새 판을 시작할 때마다 증가하는 정수다. `await` 후에 세대가 바뀌었으면 **이전 판의 루프가 좀비처럼 살아서 새 판을 조작하는 사고**를 막는다. 비동기 루프 + 재시작 가능한 상태 조합에서는 이 패턴(세대 토큰)이 거의 필수다.

## Step 3: RotatedBox로 만드는 진짜 마작 테이블

첫 버전의 중앙 테이블은 버려진 패를 그냥 세로 목록으로 나열했는데, 스크린샷을 보니 휑한 게 영 마작 같지 않았다. 실제 마작 테이블처럼 **각자의 강(버림패 구역)이 자기 자리 앞에, 상대의 패는 그 방향으로 회전**되게 바꿨다.

```dart
Stack(children: [
  Align(alignment: Alignment.topCenter,
      child: RotatedBox(quarterTurns: 2, child: _River(seat: 2))), // 맞은편: 180도
  Align(alignment: Alignment.centerLeft,
      child: RotatedBox(quarterTurns: 1, child: _River(seat: 3))), // 왼쪽: 90도
  Align(alignment: Alignment.centerRight,
      child: RotatedBox(quarterTurns: 3, child: _River(seat: 1))), // 오른쪽: -90도
  Align(alignment: Alignment.bottomCenter, child: _River(seat: 0)), // 나
  Center(child: /* 남은 패 수 칩 */),
])
```

여기서 얻은 요령 두 가지.

**① 강은 전부 "내 시점"으로 만들고 통째로 회전한다.** `_River` 위젯은 방향을 모른다. 6장씩 줄을 만들고 새 줄이 위(중앙 쪽)로 자라는, 아래쪽 플레이어 기준으로만 구현했다. 방향은 `RotatedBox`가 알아서 해결한다. 좌표 계산이 필요 없다.

**② `verticalDirection: VerticalDirection.up`.** 첫 줄이 플레이어 쪽에 붙고 새 줄이 중앙 쪽으로 쌓이게 하려면 Column을 뒤집으면 된다. 이런 속성이 있는 걸 이번에 처음 알았다.

```dart
Column(
  verticalDirection: VerticalDirection.up, // 첫 줄이 아래
  children: rows,
)
```

## Step 4: 타일 애니메이션 — TweenAnimationBuilder + key 트릭

"타일이 움직이는 것처럼 보이게 해달라"는 요구사항. AnimationController를 꺼내기 전에, **암시적 애니메이션으로 어디까지 되는지** 먼저 시도했다. 결론: 충분했다.

```dart
class TileAppear extends StatelessWidget {
  final Widget child;
  final Offset from; // 시작 오프셋. Offset(0, 40) = 아래에서 날아옴

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      child: child,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(from.dx * (1 - t), from.dy * (1 - t)),
          child: Transform.scale(scale: 1.25 - 0.25 * t, child: child),
        ),
      ),
    );
  }
}
```

`TweenAnimationBuilder`는 **위젯이 마운트될 때 자동으로 0→1 재생**된다. 그럼 "새로 버려진 패에만" 애니메이션을 어떻게 걸까? 여기서 **key 트릭**이 나온다.

```dart
TileAppear(
  key: ValueKey('river-$seat-${tiles.length}'), // 패 수가 바뀌면 새 위젯
  from: const Offset(0, 44), // 플레이어 쪽에서 날아온다
  child: tile,
)
```

버림패가 추가되면 `tiles.length`가 바뀌고 → key가 바뀌고 → Flutter가 새 위젯으로 취급해서 애니메이션이 다시 재생된다. 같은 상태로 리빌드만 되면 key가 같으니 재생되지 않는다. **key 하나로 "언제 애니메이션을 재생할지"를 선언적으로 제어**하는 것이다.

덤으로, 강을 전부 내 시점으로 만들고 회전시킨 덕분에 `from: Offset(0, 44)`(아래에서 등장) 하나면 **어느 방향 플레이어든 자기 쪽에서 패가 날아온다.** 회전이 오프셋 방향까지 같이 돌려주기 때문이다.

## Step 5: 스크린샷이 잡아준 버그 — 뽑은 패 분리 표시

게임을 돌려보다가 스크린샷에서 이상한 점을 발견했다. 방금 뽑은 패를 강조하는 기능이 있는데, **같은 종류의 패 2장이 동시에 강조**되고 있었다. 원인은 이 코드.

```dart
highlighted: myTurn && tile == gc.game.drawnTile // 같은 종류면 전부 true!
```

`Tile`의 `==`는 종류 비교라서, 7🌸를 뽑았는데 손에 이미 7🌸가 있으면 둘 다 강조된다. 수정은 실제 마작의 관례를 따랐다. **뽑은 패를 손패 오른쪽에 분리해서 표시**하는 것. 손패 목록에서 한 장만 `remove`하고, 분리된 자리에 강조 + 등장 애니메이션을 붙였다. 버그 수정이 오히려 UX를 마작답게 만들어준 경우다.

## 트러블슈팅 모음

**① 위젯 테스트의 pending timer 에러.** AI 턴이 `Future.delayed`로 돌아가는 앱은 테스트 종료 시점에 타이머가 남아 있으면 실패한다. 해결: 테스트를 "사람 입력 대기 지점"(타이머가 없는 상태)까지 `tester.pump(duration)` 루프로 진행시킨 뒤 종료한다.

**② Flutter 웹 헤드리스 스크린샷.** 레이아웃 검증용으로 Chrome 헤드리스 스크린샷을 찍는데, 디버그 웹 서버(`flutter run -d web-server`)는 빈 화면만 나왔다. **릴리즈 빌드(`flutter build web`)를 정적 서버로 띄우니** 해결.

```bash
flutter build web
python3 -m http.server 8124 -d build/web &
chrome --headless=new --window-size=1500,1000 \
  --virtual-time-budget=30000 --screenshot=game.png http://localhost:8124
```

`--virtual-time-budget`은 페이지 로딩을 가상 시간으로 빨리감기 해주는 옵션인데, CanvasKit 로딩이 느린 디버그 모드에서는 소용이 없었다.

## 정리

1. 턴제 보드게임 UI는 Flame 없이 기본 위젯으로 충분하다
2. 이모지 타일 = 에셋 제로 프로토타이핑
3. 비동기 자동 진행 루프에는 세대 토큰으로 좀비 루프를 방지
4. 방향별 UI는 "내 시점으로 만들고 RotatedBox로 회전" — 좌표 계산 불필요
5. `TweenAnimationBuilder` + `ValueKey` 트릭으로 등장 애니메이션을 선언적으로 제어
6. 헤드리스 스크린샷 검증은 릴리즈 웹 빌드로

다음 편이 마지막이다. 점수 시스템(론 방총, 츠모 분담, 멘젠 2배)과 메인화면, 게임 설명서를 붙여서 "게임"을 완성한다.
