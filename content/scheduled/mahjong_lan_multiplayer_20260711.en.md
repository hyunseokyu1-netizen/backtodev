---
title: 'Adding Multiplayer to a Flutter Game Without a Server — LAN Sockets, UDP Room Discovery, and Auto-Reconnect'
date: '2026-07-11'
publish_date: '2026-11-05'
description: How I added same-Wi-Fi multiplayer to a simple mahjong game with no external server — host-authoritative design, UDP broadcast room discovery, the seat-rotation trick, and fixing disconnects on real devices with auto-reconnect
tags:
  - Flutter
  - Dart
  - Socket
  - Multiplayer
  - Game Development
---

# Adding Multiplayer to a Flutter Game Without a Server

As a hobby project, I added multiplayer to "Mahjong Joy," the simple mahjong game I'm building. The goal was clear: **a friend sitting next to me, two phones, one quick game.** No accounts, no server costs, no matchmaking system.

The short version: on the same Wi-Fi, you create a room → it shows up automatically in the room list → one tap to join → up to 4 players (AI fills empty seats) and the match runs. Not a single line talks to an external server. This post is the record of the design decisions I made along the way, and the problems I got hit with once I tested on real devices.

## Why LAN, Without a Server

When people think "multiplayer," Firebase or a WebSocket server usually comes to mind first — but that's overkill for a "with the friend right next to me" requirement.

| Approach | Pros | Cons |
|---|---|---|
| **Same Wi-Fi (LAN)** | Zero server cost, fast, cross-platform | Must be on the same router |
| Nearby Connections | No router needed | Effectively Android-only |
| Online server | Works from anywhere | Cost, accounts, ops burden |

Turn-based board game + a friend in the same room = LAN was the right answer. Traffic runs at a few KB per second, so having one phone act as the server is no burden at all.

## Core Design 1: Host-Authoritative

The most important decision. **The game engine only runs on the room host's phone.**

```
[방장 폰]                          [참가자 폰]
게임 엔진 (유일한 심판)    ←TCP→    미러 (그리기만 함)
  ├─ 패 셔플/분배                    ├─ "3번 패 버릴게" 전송
  ├─ 규칙 검증                       └─ 상태 수신 → 화면 갱신
  └─ AI 좌석 진행
```

Clients only send actions ("discard this tile," "complete!") as JSON, and the host applies them to the engine, then broadcasts the resulting state to everyone. The advantages of this structure:

- **Sync bugs are structurally impossible.** There's only one source of truth, and it's the host.
- **Cheat prevention is free.** An invalid action just gets rejected by the engine's existing validation logic.
- **Existing code gets reused.** The game logic was already pure Dart, separated from the UI, so I only had to layer a networking tier on top.

Transport is TCP with **one newline-delimited JSON line = one message.** The protocol parser is literally this:

```dart
Stream<Map<String, dynamic>> jsonMessages(Stream<List<int>> source) => source
    .cast<List<int>>()          // Socket은 Stream<Uint8List>라 cast 필요!
    .transform(utf8.decoder)
    .transform(const LineSplitter())
    .where((line) => line.trim().isNotEmpty)
    .map((line) => jsonDecode(line) as Map<String, dynamic>);
```

The `cast` in the comment is where I first stumbled. `Socket` is a `Stream<Uint8List>`, while `utf8.decoder` expects a `Stream<List<int>>`, so wiring them together without the cast throws `type 'Utf8Decoder' is not a subtype...` **at runtime.** It doesn't get caught at compile time.

## Core Design 2: The Seat-Rotation Trick

The existing UI was built on the assumption "I'm always seat 0 (bottom of the screen)." What if, in an online match, I'm actually seat 2? Do I have to tear the whole UI apart?

No. **The host just rotates the seat numbers per client before sending state.**

```dart
// 좌석 2인 참가자에게는 (실제좌석 - 2) mod 4 로 회전한 상태를 전송
int rot(int seat) => (seat - forSeat + n) % n;
```

Every participant receives "a world where I'm seat 0." Score arrays, discard piles, whose turn it is, even the winner's seat number — all of it gets rotated before being sent. Thanks to this, **the game screen code didn't change by a single line.** Instead, I abstracted the controller the UI reads from behind an interface (`TableController`), so the local AI match, the host, and the client implementations all share the same screen.

As a bonus for both security and bandwidth, **only the tile count** of other players' hands gets sent, never the tiles themselves. The client mirror fills in placeholder dummy tiles, which is fine since the UI only ever draws opponents' hands face-down with a count.

## Core Design 3: UDP Broadcast Room Discovery

"Enter an IP address" disqualifies itself as game UX. Rooms on the same network need to show up automatically in a list.

I considered an mDNS (Bonjour) package, but implemented **UDP broadcast** directly with no extra dependency. The idea is elementary-school simple:

1. Client: every second, blast a "got a room?" packet to `255.255.255.255:47777`
2. Host: listens on that port, replies to the sender with "me! (room name, TCP port, player count)"
3. Client: collects the replies into a list, drops any room with no reply for 4 seconds

```dart
// 참가자 쪽 핑
_socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
_socket!.broadcastEnabled = true;   // 이거 안 켜면 브로드캐스트 전송 실패
_socket!.send(utf8.encode('MJJOY?'),
    InternetAddress('255.255.255.255'), 47777);
```

The host's TCP server binds to port 0 (so the OS assigns a free port) and sends that port back over its UDP reply. No worrying about port conflicts.

Android just needs a one-line `INTERNET` permission in the manifest; iOS needs `NSLocalNetworkUsageDescription` added to Info.plist for the local-network-access popup to appear.

## Core Design 4: Handling Multiple Simultaneous Responses

In mahjong there's a moment where "a chance to claim a discarded tile" opens up to several players at once. In a local match that was simple since there's only one human — but in multiplayer, **everyone's responses have to be collected and re-ranked by priority.**

```dart
// 기회가 있는 좌석마다: AI는 즉시 결정, 사람은 대기 목록에
// 전원 응답 도착 → 우선순위(완성 > 뺏어오기 > 턴 순서)로 한 명만 처리
Map<int, ClaimResponse>? _responses;
final Set<int> _awaiting = {};
```

The host sends out the list of seats that haven't responded yet (`claimAwait`) as part of the state, and only the client whose own seat is on that list shows the prompt. The response options (the possible set combinations) get recomputed by each client from its own hand — and since **it uses the exact same function as the host, the results are guaranteed to match.** Writing the game logic as pure functions pays off right here.

## What Real Devices Hit Me With

Simulator tests all passed, but the moment I ran it on 3 real phones (2 Samsung, 1 LG), problems showed up.

### Problem 1: The Room Vanishes Entirely If the Phone's Screen Turns Off

If the host phone's screen briefly turned off, or it switched to another app, every participant got kicked. The cause was the combo of **screen-off → Android Wi-Fi power saving → dead socket.**

I handled it two ways:

**1) Prevent the screen from turning off at all, with wakelock.** The `wakelock_plus` package keeps the screen on while the lobby or game screen is up. Since screens can stack (the game screen over the lobby), I managed it with a reference count:

```dart
class KeepAwake {
  static int _count = 0;
  static void acquire() { if (++_count == 1) WakelockPlus.enable(); }
  static void release() { if (_count > 0 && --_count == 0) WakelockPlus.disable(); }
}
```

**2) Auto-reconnect plus seat recovery.** If it still drops, the client retries reconnecting every 2 seconds, and the host **remembers a name → seat mapping** for anyone who left, handing the seat back when the same name reconnects. In the meantime, AI plays that seat so the remaining players' game doesn't stall.

I hit a subtle bug here. Right after reconnecting, **a late `onDone` event from the old socket** would arrive and disconnect the freshly-recovered new connection. You can't just clean up by seat number — you have to **distinguish by socket object identity**:

```dart
void _onDisconnect(int? seat, Socket socket) {
  // 이미 재접속해 좌석을 되찾았다면(옛 소켓의 늦은 onDone) 무시
  if (_clients[seat]?.socket != socket) return;
  ...
}
```

Still, the limits are clear. **If the host app gets fully killed by the OS,** the game state only ever existed on the host, so there's no recovering it. That's the price of the host-authoritative design. For something more robust, a foreground service would be the next step.

### Problem 2: Everyone Shows Up as "Player"

I put the name input field on the entry screen, but the real users (my family) just breezed past it, so everyone ended up displayed as "Player." A plain lesson: **an input field belongs on the screen where it's actually used.** I moved it to the top of the room list screen, and the entered value is saved to `shared_preferences` so it's reused next time.

## Integration Testing: Sockets, No Emulator Needed

The real verification for the multiplayer code wasn't widget tests — it was **loopback socket integration tests.** I relied on the fact that `dart:io` sockets work as-is inside `flutter test`'s test environment:

```dart
test('LAN 대전: 호스트 1 + 클라이언트 2 + AI 1이 8판 대국을 완주한다', () async {
  final host = NetHostController(hostName: '방장', aiDelay: Duration.zero);
  await host.open(advertise: false);
  final client = NetClientController();
  await client.connect(InternetAddress.loopbackIPv4, host.port!, name: '친구0');
  // ... 전원 단순 전략으로 8판 완주 후, 클라이언트 미러와
  // 호스트 상태가 좌석 회전까지 정확히 일치하는지 검증
});
```

Having AI delay injectable as `Duration.zero` means an 8-round match finishes in about 2 seconds. I also drilled a `@visibleForTesting void debugDropConnection()` hook for testing sudden disconnects, automatically verifying drop → reconnect → seat recovery → hand resync end to end. These tests caught every protocol bug before I ever touched a real device.

## Bonus: 3-Language Support and a Beginner Mode

I also added two more things before multiplayer.

**i18n (Korean/Chinese/English)**: instead of the official `flutter_localizations`, I used a manual approach — one strings class with three per-language const instances. For an app with under 10 screens, this is simpler than a code-generation tool. On first launch, device language is detected via `PlatformDispatcher.instance.locale.languageCode`, falling back to English if it's not a supported language (ko/zh). A test enforces that every language has every key.

**Beginner mode**: since score-keeping could be a burden for a kid, I added a settings switch that turns off scoring and **only records win counts** instead. Adding this was a single `scored: false` flag on the settlement function — thanks to having kept the scoring logic as a pure function.

## Summary

The core flow of serverless Flutter LAN multiplayer:

1. **Host-authoritative**: the engine only runs on the host phone; participants send actions and mirror state
2. **Newline-delimited JSON over TCP**: a 5-line parser is enough (just watch out for `Stream.cast`)
3. **UDP broadcast room discovery**: an automatic room list in 30 lines, no mDNS package
4. **Seat rotation**: send everyone "a world where I'm seat 0," and the UI gets reused for free
5. **wakelock plus name-based seat recovery**: a mobile LAN's biggest enemy is the screen turning off
6. **Loopback integration tests**: verify a full match at the socket level before ever touching a real device

I finished real-world testing with my family across 3 phones. Getting living-room multiplayer running for zero server cost turned out to be far more satisfying than expected. If you're building a turn-based game, I'd recommend considering the LAN approach before jumping straight to an online server — the fun you get relative to the implementation effort is huge.
