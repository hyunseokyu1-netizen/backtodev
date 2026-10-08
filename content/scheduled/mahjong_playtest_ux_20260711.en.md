---
title: 'In Multiplayer Games, Silence Is a Bug — Waiting-State UX Lessons from a Playtest'
date: '2026-07-11'
publish_date: '2026-11-06'
description: Playtesting a mahjong game with family across 3 phones surfaced multiplayer-specific UX problems — solved in Flutter with double-enforced response timeouts, shared "still deciding" state, and leave/rejoin notifications
tags:
  - Flutter
  - Multiplayer
  - UX
  - Game Development
  - Playtesting
---

# In Multiplayer Games, Silence Is a Bug

I built a mahjong game that plays across 3 phones on the same Wi-Fi, and finally ran a real playtest with family. The network connected fine, and the game ran fine too. But after 10 minutes, a complaint came out.

> "Is the game stuck or something?"

It wasn't stuck. **Someone else was just thinking it over, looking at a "want to claim this tile?" prompt.** But everyone else's screen showed nothing at all. Just silence. This problem can't exist in a single-player game — if I'm the one thinking, I already know I'm thinking.

What I learned that day, in one sentence: **in multiplayer, every moment where one person's state looks like "silence" to everyone else is a bug.** This post is the record of eliminating those silences one by one.

## Problem 1: One Person's Hesitation Freezes Everyone

In mahjong there's a moment when, after someone discards, everyone else gets to choose whether to claim that tile. Game progress pauses while waiting on that person's response. Two things were needed.

### (1) A Time Limit — But Who Keeps Time?

Auto-pass if there's no response within 15 seconds. Sounds simple, but **where the timer runs** is a design question.

The first answer that comes to mind is "in the prompt widget." That's indeed how I built the countdown UI:

```dart
class _ClaimPromptState extends State<_ClaimPrompt> {
  static const _timeoutSeconds = 15;
  int _remaining = _timeoutSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _remaining--);
      if (_remaining <= 0) {
        _timer?.cancel();
        context.read<TableController>().humanRespondClaim(); // 자동 패스
      }
    });
  }
  // ...
}
```

But this alone isn't enough. **If the app of the person who needs to respond goes to the background, the widget's timer freezes right along with it.** Then everyone else waits forever. A UI timer is a "courtesy" — the actual enforcement has to live with **whoever holds authority (the host).**

So I gave the host (the room owner's phone acting as referee) its own independent timer too:

```dart
// 호스트: 응답 대기 시작 시
if (_awaiting.isNotEmpty) {
  _claimTimer?.cancel();
  _claimTimer = Timer(claimTimeout, _onClaimTimeout);
}

/// 제한시간 초과: 아직 응답하지 않은 전원을 패스 처리.
void _onClaimTimeout() {
  if (_disposed || _responses == null || _awaiting.isEmpty) return;
  for (final seat in _awaiting.toList()) {
    _responses![seat] = const _ClaimResponse(); // 패스
  }
  _awaiting.clear();
  _notifyBroadcast();
  _drive(); // 게임 계속 진행
}
```

This is a **double enforcement** pattern. The client timer handles UX (showing a countdown, reacting instantly), while the host timer handles game integrity (never actually freezing). If a client passes first, the host timer just gets canceled; if a client is dead, the host passes on its behalf instead. Whichever happens first, the result is the same, so there's no conflict.

I pulled the time limit out as a constructor parameter. Injecting `claimTimeout: Duration(milliseconds: 200)` in tests lets you automatically verify "the game still proceeds all the way through even if a client never responds" in a matter of seconds.

### (2) Show Waiting Players Why They're Waiting

Even with a time limit, 15 seconds is long. People who are waiting need to see **why it stopped.**

The host was already tracking "the list of seats that haven't responded yet." All I had to do was include it in the state broadcast. On the UI side, I added one getter to the controller interface:

```dart
/// 완성/뺏어오기 응답을 아직 고민 중인 좌석들 (0 = 나)
List<int> get claimWaitingSeats => const [];
```

If I don't have a prompt of my own, but some other seat is still deciding, show a banner:

```dart
if (gc.humanClaimOpportunity == null &&
    gc.claimWaitingSeats.any((seat) => seat != 0))
  // "🤔 엄마 고르는 중..." 배너 표시
```

Now, whenever the game pauses, "🤔 Mom is deciding..." shows up on screen. Same 15 seconds, completely different feel. **"Waiting with no explanation" is worse than the wait itself** — that's an old lesson from loading spinners, but in multiplayer the thing you're waiting on is "someone else's action," which is what's different here.

## Problem 2: Nobody Knows Who Left or Who Came Back

During play, one person closed the app. As designed, AI took over that seat so the game kept running fine — but **nobody knew that had happened**, leading to "why is this person suddenly playing so well?" The paradox is that the better the auto-recovery works, the less the situation gets communicated.

I added event notifications. At the point where the host detects a leave/rejoin, it broadcasts a notice message to the whole room:

```dart
/// 퇴장/복귀를 방 전체(호스트 자신 포함)에 알린다.
void _announce(TableNoticeKind kind, String name) {
  notice.value = TableNotice(kind, name);          // 호스트 자신
  final msg = eventMessage(kind.name, name);
  for (final c in _clients.values) {
    sendJson(c.socket, msg);                        // 참가자들
  }
}
```

Delivering it to the UI was solved with a single `ValueNotifier`. The base controller class has a `ValueNotifier<TableNotice?> notice`, which the game screen subscribes to and shows as a snackbar:

```dart
void _onNotice() {
  final n = _gc.notice.value;
  if (n == null || !mounted) return;
  final text = switch (n.kind) {
    TableNoticeKind.left => s.playerLeft(n.name),      // 👋 나갔어요 — AI가 이어서 둘게요
    TableNoticeKind.rejoined => s.playerRejoined(n.name), // 🎉 돌아왔어요!
  };
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}
```

Keeping **game state (updated every turn, via `notifyListeners`) and one-off events (occasional, via snackbar) on separate channels** turned out cleanest. Mixing events into game state leads to messy code tracking "have I already shown this notification?"

## Problem 3: The Info Box Covers the Table

A pure layout problem, this one. I put a "Round 1/8 · 81 tiles left" info box dead center on the table, and it ended up **covering exactly the spot where discarded tiles pile up.** While designing, I only looked at an empty table with no discards and it looked nice centered — but once a game is mid-way through, the center turns out to be the busiest spot of all.

I moved the box to a small chip in the top-left corner, under the home button. The lesson is simple: **validate layout against the busiest state, not the empty one.** For a game, that's the late-game; for chat, a long message; for a table, the row with the most columns.

## Summary: What the Playtest Taught Me

These are problems the simulator and automated tests could never have caught, because the code was "working correctly" the whole time. Every one of them lived in **the information gap between people.**

| Silence | Fix |
|---|---|
| Someone else deciding → my screen just freezes | "🤔 ○○ is deciding..." banner + 15-second limit |
| A responder goes AFK → everyone waits forever | UI timer + host-enforced auto-pass (double enforcement) |
| Leave/rejoin → nobody notices | Room-wide snackbar notification |
| Info box covers the table | Reposition based on the busiest state |

If you've built a multiplayer feature, once the technical verification is done (does it connect? does it sync?), make sure to **sit real people down** and test it. "Is the game stuck or something?" turned out to be a more accurate bug report than any log file.
