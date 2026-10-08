---
title: 'The Same AI Looks Like a Different Name — A Bug Hidden by Seat Rotation in LAN Matches'
date: '2026-07-13'
publish_date: '2026-11-21'
description: Why the same AI showed up under different names on each participant's screen in a mahjong game's LAN multiplayer, and how I fixed it by separating screen position from actual seat
tags:
  - Flutter
  - Dart
  - Multiplayer
  - Game Development
  - Debugging
---

# The Same AI Looks Like a Different Name

Testing LAN multiplayer with family in "Mahjong Joy," the mahjong game I'm building, I got two screenshots side by side. Same game, same moment — but the AI seat names were different.

- Phone A: Kitty, Teddy
- Phone B: Bunny, Teddy

Teddy looked identical on both, but the other AI showed up as "Kitty" on one phone and "Bunny" on the other. On the surface this looks like a simple display bug, but digging into the cause, it turned out to be the result of missing a concept that runs through this project's entire multiplayer structure.

## Screen Position and the Actual Seat Are Different Things

This game's LAN matches have one host phone acting as the referee, while everyone else just receives state onto their own screen and draws it. There's one key trick here: **every participant always sees themselves as sitting in "the bottom of the screen (seat 0)."** In the actual game data, whether I'm seat 2 or seat 3, when the host sends me state, it rotates the seat numbers so it looks like "you're seat 0." That way, no matter how each of the four players is holding their phone, their own hand always shows up at the bottom of their screen.

```
실제 좌석:     0(호스트)  1(나)  2(AI)  3(AI)
내 화면에서:      2         0      1      3   ← 회전됨
```

Thanks to this rotation, the drawing code gets really simple. Since "seat 0" always refers to me, there's no conditional logic needed for placing control buttons at the bottom of the screen and showing my own hand.

## Where the Bug Lived: the Code That Picks a Name

The problem was the code that picks the AI's name.

```dart
String _nameOf(TableController gc, Strings s, int seat) =>
    gc.seatNames?[seat] ?? s.playerNames[seat];
```

If `seatNames` exists (a real participant's name), it uses that; if not (an AI), it pulls a name from `playerNames`, a per-language list of names (`['나', '토끼', '곰돌이', '야옹이']`), indexed by seat number. But the value coming into this `seat` parameter was **the position number after screen rotation had already been applied.**

Going back to the table above, the AI at actual seat 2 looks like this:
- On my screen (seat 1), after rotation it's at position 1 → `playerNames[1]` = "Bunny"
- On the host's screen (seat 0), with no rotation it's at position 2 → `playerNames[2]` = "Teddy"

Looking up the same AI by different indexes was naturally going to produce different names. Rotation is a concept that's a perfect fit for "where to draw the hand" — but it's not a concept that should ever apply to "what this AI's identity (name) is." Failing to distinguish these two was the real nature of the bug.

## The Fix: Send the Actual Seat Number Along With the State

The direction of the fix was clear. Just for picking a name, you need to know the "real seat number" from before rotation. I decided that when the host sends state to each participant, it would also carry that person's own actual seat number along with it.

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

The client stores this value, and I built one function that converts "screen position → actual seat."

```dart
// NetClientController
int _mySeat = 0; // view가 도착하면 갱신됨

@override
int actualSeatOf(int seat) => (seat + _mySeat) % 4;
```

I added this function to the shared interface (`TableController`), and had modes that never had rotation in the first place — like local AI matches — use a default implementation (the identity function).

```dart
abstract class TableController extends ChangeNotifier {
  // ...
  /// 화면에 보이는 좌석 번호(0=나)를 실제(회전 전) 좌석 번호로 바꾼다.
  /// 로컬 대전은 회전이 없어 항등함수, LAN 클라이언트는 호스트가
  /// 알려준 자신의 실제 좌석을 기준으로 되돌린다.
  int actualSeatOf(int seat) => seat;
}
```

Finally, I fixed the name-picking code to use this.

```dart
String _nameOf(TableController gc, Strings s, int seat) =>
    gc.seatNames?[seat] ?? s.playerNames[gc.actualSeatOf(seat)];
```

It's a one-line difference, but the key is clearly distinguishing `seat` (screen position) from `actualSeatOf(seat)` (actual seat). Now, no matter which participant's screen you look at, the AI at actual seat 2 is always fixed to `playerNames[2]` = "Teddy."

## Reproducing It With a Test

This kind of bug is the type you can only really notice by lining up 2-3 real devices and comparing by eye — but you can't verify things that way every single time. So I built a test that connects a real host + 2 participants over an actual socket connection and checks whether the same AI really does point to the same actual seat on each participant's screen.

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

The key part is verifying `localPos` (which can differ per participant) and `actualSeatOf(localPos)` (which should always be 3) side by side. Passing this test means "no matter where it's shown on screen, the lookup for the actual identity always produces the same result."

## Wrap-Up

What this bug taught me is simple. **The position something is drawn at on screen** and **the actual entity the data points to** can be two different coordinate systems, and mixing them up creates the kind of bug where "everyone sees something that looks correct on their own screen, but it's wrong the moment you compare notes."

- Seat rotation is for "where to draw on whose screen" — a UI coordinate system
- AI name lookup is for "what entity this actually is" — a data coordinate system

Adding one function (`actualSeatOf`) to the interface that explicitly separates these two solved it. Whenever concepts like "rotation," "offset," or "local index" show up in a multiplayer game, it's worth double-checking whether that value really points to the same coordinate system everywhere it's used.
