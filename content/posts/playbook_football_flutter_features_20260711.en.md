---
title: 'Five Things I Added to My Flutter Board Game App in One Day — Animation, Localization, and Local Multiplayer'
date: '2026-07-11'
publish_date: '2026-11-10'
description: Adding dice-roll animation, Korean/English localization, same-Wi-Fi local multiplayer, and generated app icons to a Flutter board game app, all in a single day
tags:
  - Flutter
  - Dart
  - Socket Programming
  - Game Development
  - l10n
---

On this side project of porting the board game Playbook Football into a Flutter app, today was an unusually productive day. It started in the morning with "it'd be nice to have a dice-rolling animation," and by evening it had rolled all the way into playing against a friend on two phones over the same Wi-Fi. Five features went in over the course of one day, so I'm recording how I built each one and where I got stuck.

What got added today:

1. Dice-rolling + card-clash animation (including a toggle setting)
2. Korean/English localization
3. Same-Wi-Fi local multiplayer (TCP/UDP sockets)
4. App icon/splash generation with a PIL script
5. Small but noticeable UX improvements — a card-info button, the recommended-card row

## 1. A Board Game Needs Its Dice to Roll

This game rolls four dice (offense D10, defense D10, and two D12s) on every single play to point at a spot on the card chart. My first implementation just popped the result number onto the screen instantly, which never captured that board-game feel.

So I built the rolling effect with a single `AnimationController`. There were three core ideas.

**The face changes rapidly while it's rolling.** There's no need for a real random number — pulling a pseudo-random value from the animation progress `t` is enough. The value changes on every setState, producing that "tumbling" feel.

```dart
final shown = rolling
    ? 1 + (version * 7 + i * 5 + (t * 20).floor()) % sides
    : v;  // 멈추면 실제 결과값
```

**They stop one at a time, left to right.** Giving each die a different settle time (`settleAt = 0.45 + i * 0.13`) makes them land sequentially, casino-style. Adding a little pop — briefly growing then shrinking back the instant it stops — gives it some punch.

**Bounce height uses a sine function plus decay.** Bouncing on the table and settling down is just the absolute value of `sin` multiplied by a decay factor. Tying the shadow blur to the bounce height adds real depth.

```dart
final decay = rolling ? 1.0 - (t / settleAt).clamp(0.0, 1.0) : 0.0;
final bounce = rolling ? math.sin(t * 32 + i * 1.7).abs() * 9 * decay : 0.0;
```

On top of that, I added an overlay (`CardFlyby`) where cards fly in from both sides and clash into a "VS" at play resolution time. Sliding them in with `Curves.easeOutBack` gives them a slight overshoot that feels good. Tapping skips it instantly.

And one important thing — **the effect has to be toggleable.** A 1.3-second dice sequence is torture for someone who wants to move fast. I put a switch on the main screen and persisted it with `shared_preferences`. Turning it off jumps straight to `_ctrl.value = 1.0`, showing the animation's final frame (i.e., the result) immediately.

## 2. Localization — Why I Built It Myself Instead of Using a Package

I decided to add a language choice (Korean/English). The standard Flutter approach is `flutter_localizations` + ARB files, but this project's circumstances were a bit different: **the game engine (pure Dart) generates log strings directly.** Resolution logs like "Gain of 3 yards!" or "Interception!" come out of the engine, not the UI, and the ARB approach needs a `BuildContext`, which is awkward to use from the engine.

So I went with a simple structure: an abstract class plus a global instance.

```dart
abstract class L10n {
  String gain(int yards);
  String touchdown(String team);
  // ... 문자열 약 100개
}

class L10nKo extends L10n {
  @override
  String gain(int yards) => '$yards야드 전진!';
}

class L10nEn extends L10n {
  @override
  String gain(int yards) => 'Gain of $yards yards!';
}

L10n loc = const L10nKo();  // 전역. 엔진과 UI 모두 이걸 참조
```

Because these are methods, grammatical differences between languages get absorbed naturally. Things that can't be handled by simple substitution — like English's ordinal notation ("2nd & 11") — just get handled inside each implementation.

### A Hidden Bug That Localization Exposed

There was an unexpected payoff while doing this work. The existing sound-effect code looked like this.

```dart
// Before: 로그 텍스트를 검사해서 효과음 결정 (한국어에 결합!)
if (text.contains('터치다운') || text.contains('필드골 성공')) {
  sfx.score();
}
```

In English mode, there's no '터치다운' string anywhere, so every sound effect was about to go completely silent. I refactored it so the engine itself records an `SfxEvent` (score/penalty/turnover/kick) at resolution time.

```dart
// After: 엔진이 의미 있는 이벤트를 기록, UI는 언어 무관하게 소비
enum SfxEvent { score, penalty, turnover, kick }

// 엔진 내부
r.sfx.add(SfxEvent.score);

// UI
if (r.sfx.contains(SfxEvent.score)) sfx.score();
```

I felt this lesson firsthand: **never hang logic off a display string.** Localization forces this kind of coupling out into the open.

I made the validation fun too. I added a test that simulates an entire game in English mode, then fails if even a single Korean character turns up anywhere in the log.

```dart
final koreanLines = e.gameLog.where((l) => RegExp(r'[가-힣]').hasMatch(l));
expect(koreanLines, isEmpty, reason: koreanLines.join('\n'));
```

## 3. Same-Wi-Fi Multiplayer — Sockets Alone, No Server

Today's highlight. The way to satisfy "I want to play with a friend over the network" at zero server cost is local-network play. Two phones on the same router talk to each other directly over TCP.

### Architecture: The Host Is the Referee

The first thing to decide in multiplayer design is **who holds authority over resolution.** I chose a host-authoritative structure.

- **Host** (the one who created the room): actually runs the game engine. Only the host rolls the dice
- **Guest** (the participant): only sends card choices, and renders whatever full state the host broadcasts

This way, state desync simply can't happen in the first place. A P2P approach where both devices roll their own dice opens the door to synchronization hell.

From the UI's point of view, I put in one interface so single-player and multiplayer look identical.

```dart
abstract class MpSession {
  Team get myTeam;
  GameState get state;
  Stream<void> get updates;
  void chooseOffense(String cardId);
  void chooseDefense(String cardId);
  // ...
}

class HostSession implements MpSession { /* 엔진 직접 구동 */ }
class GuestSession implements MpSession { /* 소켓으로 원격 호출 */ }
```

Since the game screen only needs to know about `MpSession`, host and guest share the exact same screen code.

### Transport: Newline-Delimited JSON

I kept the protocol humble. I stream one line of JSON at a time (`jsonEncode(msg) + '\n'`) over the TCP connection, and the receiving side cuts it apart with `LineSplitter`.

```dart
_guestSub = sock
    .cast<List<int>>()          // 이거 없으면 타입 에러!
    .transform(utf8.decoder)
    .transform(const LineSplitter())
    .listen(_onGuestLine);
```

I got stuck here once. Passing a `Socket` straight to `utf8.decoder` throws `Utf8Decoder can't be assigned to StreamTransformer<Uint8List, dynamic>`. That's because `Socket` is a `Stream<Uint8List>`, while the decoder expects a `Stream<List<int>>`. One line, `.cast<List<int>>()`, fixes it.

TCP is a stream, so there's no message boundary. For something with low message frequency, like a game, I think newline-delimited JSON gives the best effort-to-payoff ratio. Being able to just read it as a human while debugging is also a big plus.

### Room Discovery: UDP Broadcast

Asking your friend to "read me your IP address" is the worst possible UX. So I added auto-discovery via UDP broadcast.

1. Host: listens on UDP port 47845, and replies with its own info (JSON) whenever it receives a `pf_discover_v1` probe
2. Guest: sends a probe to `255.255.255.255` every second, and adds any host that responds to its list

```dart
// 게스트 쪽 프로브
_sock!.broadcastEnabled = true;
_sock!.send(utf8.encode(kDiscoverProbe),
    InternetAddress('255.255.255.255'), kDiscoveryPort);
```

That said, some routers (especially public Wi-Fi) block broadcast traffic. So I made sure to leave **manual IP entry as a fallback.** Showing the host's own IP on its waiting screen lets you type that number in and connect whenever auto-discovery fails.

On Android, you also need manifest permissions.

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE"/>
```

### Testing: Verifying Real Connections over Loopback

Network code can be unit-tested too. You just connect a host and a guest for real, inside a single process, over `127.0.0.1`.

```dart
test('루프백 연결 후 킥오프까지 상태가 동기화된다', () async {
  final host = await HostSession.host();
  final guest = await GuestSession.connect('127.0.0.1');
  await host.onGuestConnected;

  // 킥오프 진행 후
  expect(guest.version, host.version);
  expect(guest.state.ballPos, host.state.ballPos);
});
```

Round-tripping over real sockets with no mocking even catches serialization bugs along the way.

## 4. App Icon, Drawn in Code Without a Designer

I needed an app icon, and I drew it with Python PIL instead of a design tool. Drawing it in code means a revision request ("make the arrow a bit thicker") can be answered with a single parameter change — which actually makes this the faster path.

Two points worth noting:

- **4x supersampling**: drawing at 4096px and then downscaling to 1024px with `LANCZOS` eliminates PIL's jagged edges. PIL has no anti-aliased drawing, so this is practically mandatory
- **Computing Bézier curves by hand**: PIL has no curve API, so I sampled the quadratic Bézier formula in a loop and connected the points with `line`. This is how I drew the playbook's distinctive running-route arrows

```python
def bezier(p0, c, p1, t):
    x = (1-t)**2 * p0[0] + 2*(1-t)*t * c[0] + t**2 * p1[0]
    y = (1-t)**2 * p0[1] + 2*(1-t)*t * c[1] + t**2 * p1[1]
    return (x * L, y * L)
```

Feed the resulting 1024px PNG into `flutter_launcher_icons` and it auto-generates icons for Android/iOS/web; feed it into `flutter_native_splash` and splash screens get generated too.

```bash
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

## 5. Small Details with an Outsized UX Impact

Playing on a real device surfaces friction you'd never spot just by reading the code. Two things I fixed today.

**The selected card wasn't visible.** The screen shows 3 situation-based recommended cards, but picking a card outside those recommendations from the "full playbook" left the selection indicator showing up nowhere. Fixed by swapping the last slot of the 3 recommended cards for the selected card.

```dart
final sel = selectedDefense;
if (sel != null && !ids.contains(sel)) {
  ids = [...ids.sublist(0, 2), sel];  // 마지막 자리를 선택 카드로
}
```

**A pre-execution card-info button.** With a card selected, tapping the 📖 icon next to the confirm button shows that card's chart and modifiers. Being able to check and compare "what happens if I play this card?" before actually committing is especially useful for anyone studying strategy.

## Troubleshooting Summary

| Symptom | Cause | Fix |
|---|---|---|
| `Utf8Decoder can't be assigned to...` | Socket is a `Stream<Uint8List>` | `.cast<List<int>>()` before transforming |
| Widget tests suddenly started failing | A new full-screen overlay was intercepting taps | Have the test tap the overlay first to dismiss it |
| Sound effects going silent in English mode (prevented) | Sound was decided by matching Korean log text | Engine now records `SfxEvent` enum values directly |
| `flutter install` installed an old build | `install` doesn't build | `flutter build apk --release`, then install |
| Room auto-discovery failing (some routers) | UDP broadcast blocked | Provided manual IP entry as a fallback |

The fourth one actually got me. `flutter install` **just installs the existing APK as-is** — it doesn't rebuild. If a new feature isn't showing up on your phone, nine times out of ten, this is why.

## Wrap-Up

The core flow of a day's work:

1. **Effects through math** — dice rolling with sine decay + sequential settling, with an on/off toggle as a baseline
2. **Localization exposes coupling** — split sound logic that was hanging off log text into enum events
3. **Multiplayer is half authority design** — the host is the sole referee, the guest only provides input. An interface unifies the single/multiplayer screens
4. **Keep transport simple** — newline-delimited JSON + UDP broadcast discovery + manual IP fallback
5. **Icons in code too** — PIL supersampling + Bézier curves, revisions down to a single parameter

I installed it on 3 real devices (2 Galaxys, 1 LG) and confirmed it all the way through to actually matching two of them against each other. Watching multiplayer run in the living room without a single line of server code makes socket programming feel pretty rewarding. Next up, I'm thinking about matches over the internet (a relay server) or a spectator mode.
