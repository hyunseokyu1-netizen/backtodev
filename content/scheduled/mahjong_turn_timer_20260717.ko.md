---
title: 'Flutter 마작 게임에 턴 타이머 UI 붙이기 — 보이지 않는 시간제한은 없는 것과 같다'
date: '2026-07-17'
publish_date: '2026-09-07'
description: 네트워크 대전의 15초 시간제한을 화면에 카운트다운으로 보여주고, 마지막 5초는 빨간 숫자로 긴장감을 연출한 과정 (마작한판 1.1.0)
tags:
  - Flutter
  - Dart
  - 게임개발
  - 위젯테스트
  - LAN멀티플레이
---

## 문제: 시간제한은 있는데, 아무도 모른다

제가 만들고 있는 심플 마작 게임 "마작한판"에는 LAN 멀티플레이가 있습니다. 한 사람이 패를 안 내고 버티면 방 전체가 멈추니까, 호스트가 15초 지나면 방금 뽑은 패를 자동으로 버리는 로직을 넣어뒀었죠.

그런데 폰 세 대로 실제 플레이테스트를 해보니 이런 피드백이 나왔습니다.

> "시간이 안 보이는데 갑자기 패가 자동으로 버려져. 내가 뭘 잘못 눌렀나 싶었어."

맞는 말이었습니다. **제한시간이 있다는 사실 자체가 화면 어디에도 없었거든요.** 플레이어 입장에서는 규칙이 아니라 버그처럼 느껴지는 겁니다. 반대로 생각하면, 시간이 *보이기만 해도* 자동 버리기는 "패널티"가 아니라 "긴장감"이 됩니다. 그래서 1.1.0에서 이렇게 바꾸기로 했습니다.

- 내 차례가 되면 남은 시간을 화면에 표시
- 마지막 5초는 화면 정중앙에 **큰 빨간 숫자**로 카운트다운 (긴장감 연출)

결과부터 말하면, 로직 변경은 거의 없이 **표시 전용 위젯 하나**로 해결됐습니다. 다만 그 과정에서 설계 원칙 하나와 숨어 있던 버그 하나를 건졌는데, 그 얘기를 해보려고 합니다.

## 설계 원칙: 진실은 호스트에, UI는 표시만

이 게임의 네트워크 구조는 "호스트가 유일한 심판"입니다. 게임 엔진은 호스트에서만 돌고, 클라이언트는 행동만 보내고 자기 시점의 상태(view)를 받아 그립니다. 15초 강제 버리기도 호스트의 `Timer`가 처리하죠.

```dart
// host_session.dart — 진짜 시간제한은 여기 있다
void _armDiscardTimer() {
  final key = (game.current, game.wallCount);
  if (_discardWaitKey == key) return; // 같은 턴에 중복으로 걸지 않기
  _discardWaitKey = key;
  _discardTimer?.cancel();
  _discardTimer = Timer(discardTimeout, () => _onDiscardTimeout(key));
}
```

여기서 유혹이 하나 생깁니다. "UI 타이머가 0이 되면 클라이언트에서도 자동으로 버리게 할까?" — 하지만 그러면 **진실이 두 군데**가 됩니다. 네트워크 지연으로 두 타이머가 어긋나면 호스트와 클라이언트가 서로 다른 패를 버리는 경합이 생길 수 있죠.

그래서 새 타이머 위젯은 철저하게 **표시 전용**으로 만들었습니다. 0이 되면 그냥 멈춰서 호스트의 처리를 기다립니다. 호스트가 강제로 버리면 상태가 갱신되면서 위젯이 자연스럽게 사라지고요.

## Step 1: 컨트롤러 인터페이스에 "제한시간"을 노출

UI는 로컬 AI 대전, LAN 호스트, LAN 클라이언트가 모두 같은 `TableController` 인터페이스를 씁니다. 여기에 getter 하나를 추가했습니다.

```dart
// table_controller.dart
/// 내 버리기 차례의 제한시간 (초과하면 호스트가 자동으로 버린다).
/// UI가 카운트다운을 띄우는 데 쓴다. null = 제한 없음 (로컬 AI 대전).
Duration? get discardTimeLimit => null;
```

포인트는 **기본값이 `null`(제한 없음)**이라는 것. 혼자 AI랑 느긋하게 두는 모드에는 타이머가 없어야 하니까, 네트워크 컨트롤러들만 오버라이드합니다.

```dart
// host_session.dart
@override
Duration? get discardTimeLimit => discardTimeout;
```

클라이언트가 문제였는데, 프로토콜(view 메시지)에 제한시간 값이 실려오지 않습니다. 프로토콜을 바꾸면 테스트 폰 전부 재설치해야 해서, 양쪽이 공유하는 상수로 해결했습니다.

```dart
// protocol.dart — 호스트 강제 타이머와 클라이언트 카운트다운이 같은 값을 쓴다
const Duration turnTimeLimit = Duration(seconds: 15);
```

UI 쪽에서는 조건 하나로 세 모드가 전부 정리됩니다.

```dart
// game_screen.dart — Stack 안에
if (gc.isHumanDiscardTurn && gc.discardTimeLimit != null)
  _TurnTimer(
    key: ValueKey('turn-timer-${gc.game.wallCount}'),
    limit: gc.discardTimeLimit!,
  ),
```

## Step 2: 타이머 위젯 — 평소엔 배지, 마지막 5초는 빨간 숫자

카운트다운 자체는 평범한 `StatefulWidget` + `Timer.periodic`입니다. 재미있는 건 표시 방식의 전환이에요.

```dart
class _TurnTimerState extends State<_TurnTimer> {
  static const _urgentSeconds = 5;

  late int _remaining = widget.limit.inSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_remaining <= 0) return; // 0에서 멈춤 — 강제 버리기는 호스트 몫
      setState(() => _remaining--);
    });
  }
  // ...
}
```

**15~6초**: 상단 중앙에 작은 배지. 정보는 주되 시야를 방해하지 않습니다.

```dart
Container(
  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
  decoration: BoxDecoration(
    color: Colors.white.withValues(alpha: 0.85),
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: Palette.mint, width: 1.5),
  ),
  child: Text('⏱ $_remaining', /* ... */),
)
```

**마지막 5초**: 테이블 정중앙에 110pt 빨간 숫자가 매 초 "튀어나오는" 연출. `TweenAnimationBuilder`의 key를 남은 초로 걸어서, 숫자가 바뀔 때마다 애니메이션이 처음부터 다시 재생되게 했습니다.

```dart
TweenAnimationBuilder<double>(
  key: ValueKey(_remaining),          // 매 초 애니메이션 리셋
  tween: Tween(begin: 1.6, end: 1.0), // 크게 등장했다가 제자리로
  duration: const Duration(milliseconds: 250),
  curve: Curves.easeOutBack,
  builder: (context, scale, child) =>
      Transform.scale(scale: scale, child: child),
  child: Text(
    '$_remaining',
    style: const TextStyle(
      fontSize: 110,
      fontWeight: FontWeight.w900,
      color: Color(0xFFE53935),
      shadows: [ // 초록 테이블 위에서도 잘 보이게 흰 글로우
        Shadow(color: Colors.white, blurRadius: 24),
        Shadow(color: Colors.white, blurRadius: 48),
      ],
    ),
  ),
)
```

전체를 `IgnorePointer`로 감싸는 것도 잊지 마세요. 중앙에 뜬 숫자가 손패 터치를 가로막으면 안 되니까요. 안 그러면 "5초 남았는데 패가 안 눌려요"라는 더 나쁜 버그가 생깁니다.

## Step 3: 타이머를 붙이다가 발견한 진짜 버그

UI를 붙이면 로직의 구멍이 보입니다. 호스트의 타임아웃 처리를 다시 읽어보니:

```dart
// 수정 전
void _onDiscardTimeout((int, int) key) {
  // ...
  final drawn = game.drawnTile;
  if (drawn == null) return; // ← 뽑은 패가 없으면 그냥 포기?!
  game.discard(drawn);
}
```

마작에서는 남이 버린 패를 가져와서(뺏어오기) 몸통을 만들면, **패를 뽑지 않고** 바로 버릴 차례가 됩니다. 이때 `drawnTile`이 `null`이라 타임아웃이 아무것도 못 하고 리턴해버립니다. 즉, **뺏어온 직후에 안 내고 버티면 방 전체가 영원히 멈추는** 구멍이 있었던 거죠.

타이머 UI를 달았으니 이 구멍은 더 도드라집니다. 카운트다운이 0이 됐는데 아무 일도 안 일어나면 그게 더 이상하잖아요. AI 추천 패를 대신 버리도록 고쳤습니다.

```dart
// 수정 후 — 뽑은 패가 없으면(뺏어온 직후) AI 추천 패를 버린다
final p = game.players[game.current];
final tile = game.drawnTile ?? _ai.chooseDiscard(p.hand, p.meldCount);
_clearDiscardTimer();
game.discard(tile);
```

"UI만 붙이는 작업"에서 게임이 멈추는 버그를 잡았습니다. 표시와 실제 동작을 일치시키려고 하면 이런 게 걸려 나오더라고요.

## Step 4: 위젯 테스트 — 가짜 컨트롤러로 시간을 돌리기

Flutter 위젯 테스트의 좋은 점은 **가짜 시계**입니다. `tester.pump(Duration)`으로 시간을 원하는 만큼 감을 수 있어서, 15초짜리 타이머 테스트가 실제로는 밀리초 만에 끝납니다.

네트워크 없이 타이머만 검증하고 싶어서, 로컬 컨트롤러에 제한시간만 얹은 테스트용 서브클래스를 만들었습니다.

```dart
/// 네트워크 대전처럼 버리기 제한시간이 있는 컨트롤러 흉내
class _TimedController extends GameController {
  _TimedController({super.seed});

  @override
  Duration? get discardTimeLimit => const Duration(seconds: 15);
}

testWidgets('버리기 제한시간이 있으면 카운트다운이 보이고 마지막 5초는 크게 표시된다',
    (tester) async {
  final gc = _TimedController(seed: 7);
  await tester.pumpWidget(app(gc));

  expect(find.text('⏱ 15'), findsOneWidget);

  await tester.pump(const Duration(seconds: 10)); // 10초 순간이동
  expect(bigNumber('5'), findsOneWidget);         // 중앙 큰 숫자로 전환

  gc.humanDiscard(gc.human.hand.first);           // 버리면
  await tester.pump();
  expect(bigNumber('4'), findsNothing);           // 타이머도 사라진다
});
```

인터페이스에 getter를 추가한 덕에, 오버라이드 한 줄로 테스트 더블이 만들어졌습니다.

## 트러블슈팅

### 1. `find.text('5')`가 3개나 잡힌다

처음엔 `expect(find.text('5'), findsOneWidget)`으로 썼다가 실패했습니다. 마작 게임 화면에는 **숫자 5가 그려진 타일**이 있으니까요. 손패의 5만 타일 두 장 + 타이머 숫자, 이렇게 3개가 잡혔습니다.

폰트 크기로 구분하는 predicate finder로 해결:

```dart
Finder bigNumber(String n) => find.byWidgetPredicate(
    (w) => w is Text && w.data == n && (w.style?.fontSize ?? 0) > 100);
```

### 2. `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

빌드해서 폰에 설치하려니 서명 불일치로 거부됐습니다. 이전에 다른 키로 설치된 빌드가 남아 있던 거죠. 개발 중이라면 지우고 다시 까는 게 답입니다 (앱 데이터는 날아갑니다).

```bash
adb uninstall com.backdev.mahjonghanpan
adb install build/app/outputs/flutter-apk/app-release.apk
```

### 3. `INSTALL_FAILED_VERSION_DOWNGRADE`

두 번째 폰에서는 또 다른 에러. 그 폰에 versionCode 3짜리 빌드가 있는데 새 빌드가 2였던 겁니다. `pubspec.yaml`의 버전을 건너뛰어 올려서 해결했습니다. **versionCode는 건너뛰어도 되고, 낮아지면 안 됩니다.**

```yaml
# pubspec.yaml — 1.1.0+2가 아니라 +4로 (기존 최고 코드보다 크게)
version: 1.1.0+4
```

Play Console에 올라간 코드보다 낮으면 스토어 업로드도 거부되니, 기기에서 이 에러를 만났다면 스토어 쪽 코드도 의심해보세요.

## 정리

| 한 일 | 파일 | 핵심 |
|---|---|---|
| 제한시간 노출 | `table_controller.dart` | `Duration? get discardTimeLimit => null` — null이면 타이머 없음 |
| 값 공유 | `protocol.dart` | 호스트 강제와 UI 표시가 같은 상수 사용 |
| 타이머 위젯 | `game_screen.dart` | 표시 전용, 마지막 5초는 중앙 빨간 숫자 + 스케일 애니메이션 |
| 멈춤 버그 수정 | `host_session.dart` | 뽑은 패 없으면 AI 추천 패로 대체 버리기 |
| 테스트 | `app_smoke_test.dart` | getter 오버라이드로 테스트 더블, `pump`로 시간 감기 |

이번 작업에서 남은 교훈은 두 가지입니다.

1. **보이지 않는 규칙은 버그처럼 느껴진다.** 시간제한, 자동 처리, 강제 진행 — 시스템이 플레이어 대신 뭔가를 한다면, 그 전에 반드시 예고가 보여야 합니다.
2. **분산 환경에서 타이머는 하나만.** 진실(강제 버리기)은 호스트에 두고, 클라이언트 타이머는 철저히 표시 전용으로. 두 개의 시계가 같은 결정을 내리게 하면 반드시 어긋납니다.

다음엔 마지막 5초에 째깍째깍 효과음을 붙여볼까 합니다. 눈에 이어 귀로도 긴장감을 줘야죠. 🀄
