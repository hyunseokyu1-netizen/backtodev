---
title: "In Mahjong, \"Who Grabs It First\" — Why I Turned a Priority Rule Into a Reaction-Speed Race"
date: '2026-07-13'
publish_date: '2026-11-22'
description: How I redesigned the ruling logic for when multiple players want the same discarded tile in a mahjong game, moving from turn-order priority to first-response-wins
tags:
  - Flutter
  - Dart
  - Game Development
  - Concurrency
  - Testing
---

# In Mahjong, "Who Grabs It First"

I found a strange bug (or really more of a bad user experience) in the mahjong game I'm building. During an AI match, whenever a situation came up where I could claim a tile someone else discarded, the AI would already have taken it before I'd even had a chance to press anything. Looking at the game log, the "want to claim this tile?" prompt clearly did appear — but the result was already locked in before a human had any time to react.

The cause was simple. The AI's response logic was **too fast.** The moment the game engine computed a claim (steal/complete) opportunity, the AI would immediately decide its own choice right then. A human needs at least a few hundred milliseconds just to look at the screen and judge — but by then the AI had already finished deciding.

Fixing this got me rethinking one of mahjong's long-standing rules too. **"Who gets to claim that tile" is traditionally decided not by speed, but by seating order (turn priority).** But it's not easy for a human to intuitively grasp this priority inside the game. So I took this opportunity to tear it all down and replace it with a simpler, more intuitive rule: whoever responds first gets it.

## The Problem With the Old Approach

Mahjong Joy's original ruling logic went like this.

1. When a tile is discarded, compute every seat (human + AI) that could claim it.
2. Collect each seat's response.
3. Once everyone has responded, or it's certain that a seat with higher priority (by seating order) has already responded, hand the tile to whoever said "I'll take it" first **according to the fixed seating order.**

The problem is step 3. Since the AI always computes and stores its response instantly, even while a human was still thinking, the logic would instantly satisfy the condition "everyone has already responded." As a result, a round often ended before the human even had time to see the prompt and move a finger.

## Two Design Decisions

Fixing this meant settling two things anew.

### 1. Completing a hand (winning) still takes priority over claiming

This wasn't a speed issue — it's a **value issue**, so I left it as-is. Completing a tile set (winning) always matters more than forming just one meld (claiming), so if a seat that could complete its hand hasn't responded yet — even if another seat's claim response arrives first — the result isn't locked in immediately; it waits.

### 2. Within the same tier, "whoever responds first gets it"

When completions compete with each other, or claims compete with each other, seating order no longer matters at all. It's decided by **who responded first.** There's no distinction between a triple (pung) and a straight (chi) either — this game already had the simplified rule from the start that "anyone can claim regardless of pung/chi distinction," so simplifying the priority too kept things consistent.

Put these two together and the rule fits in one sentence: **a completed hand always wins, and otherwise, whoever presses first wins.**

## Giving the AI "Thinking Time" Too

Changing the rule alone wasn't the end of it. If the AI still responded instantly, the AI would still always win under the "whoever responds first wins" rule. So I reworked the AI's response timing itself.

The core idea is simple. **Decisions a human isn't watching should be fast; decisions a human is involved in should make the AI think like a person would.**

```dart
final opportunities = game.claimOpportunities;
final humanInvolved = opportunities.any((o) => o.seat == humanSeat);

if (!humanInvolved) {
  // AI끼리만 경쟁 — 아무도 안 보고 있으니 즉시 계산해서 우선순위로 처리
  for (final o in opportunities) {
    _responses![o.seat] = _aiAnswerFor(o);
  }
  return;
}

// 사람이 관여 — 모든 AI가 각자 무작위 시간만큼 "고민"한다
for (final o in opportunities) {
  _awaiting.add(o.seat);
  if (o.seat == humanSeat) {
    humanClaimOpportunity = o;
  } else {
    _aiThinkTimers[o.seat] =
        Timer(_randomAiThink(), () => _onAiThinkDone(o.seat, gen));
  }
}
```

- For **rounds the human has no part in at all** (AI competing against AI), I removed the delay entirely. It used to wait 700ms even in this case — but thinking about it, nobody's watching that ruling, so there's no reason to slow it down.
- For **rounds the human has any part in**, each competing AI gets a **random thinking time between 0.5 and 13 seconds.** I matched this range to roughly the human's own response time limit (15 seconds). Since each AI runs its own independent timer, it looks like some AIs decide reflexively fast while others think it over for a while.

Now there's always a guaranteed minimum physical window (the AI's minimum thinking time of 500ms) for a human to see the prompt and move a finger. And if the human responds first, the human wins immediately even if the AI was still "thinking" — it's become a genuine reaction-speed race.

## Making the Ruling Happen "Each Time a Response Arrives"

The old code was structured to "collect all responses, then sort and decide all at once." To switch to a first-click-wins model, this structure itself had to change to an event-driven one that "judges immediately each time a single response arrives."

```dart
void _onAwaitedAnswer(int seat, _ClaimAnswer answer) {
  if (_responses == null) return; // 이미 확정됨
  final opp = _opportunityOf(seat);
  if (opp == null) return;

  if (answer.win && opp.canWin) {
    _finalizeAwaitedWin(seat); // 완성은 도착 즉시 확정
    return;
  }
  if (answer.option != null) {
    _leadingClaimSeat ??= seat;   // 가장 먼저 온 뺏어오기만 기억
    _leadingClaimOption ??= answer.option;
  }
  _tryFinalizeAwaitedClaim();
}

void _tryFinalizeAwaitedClaim() {
  if (_responses == null) return;
  final winCapablePending = game.claimOpportunities
      .any((o) => o.canWin && _awaiting.contains(o.seat));
  if (winCapablePending) return; // 완성 가능자가 아직 남아있으면 대기

  if (_leadingClaimSeat != null) {
    _finalizeAwaitedClaim(_leadingClaimSeat!, _leadingClaimOption!);
  } else if (_awaiting.isEmpty) {
    _finalizeAwaitedPass();
  }
}
```

The `??=` operator is the key here. Since `_leadingClaimSeat` is never overwritten once it's been assigned a value, it naturally ends up remembering only "the first claim response that arrived." A completion gets finalized the instant it arrives (since nobody could have responded earlier than that), while a claim only gets finalized after checking "is there anyone left who could still complete their hand" — which is exactly what preserves the "completion always takes priority" tier decided earlier.

## The Same Pattern, Twice — Local Matches and LAN Matches

This game has two match modes: a local mode playing solo against 3 AIs, and a LAN mode where up to 4 players compete on the same WiFi. Since the two have completely separate code paths (local calls functions immediately; LAN has the host broadcast state over sockets), I had to implement this logic **twice.**

Fortunately the structure carried over almost as-is. The LAN host side needed one more thing on top: the person who claimed the tile needs to be shown to the other participants too.

```dart
void _finalizeAwaitedClaim(int seat, Meld meld) {
  final opp = _opportunityOf(seat);
  _clearClaimRoundState();
  // ... 뺏어오기 적용 ...
  if (multiParty) _announceClaim(seat); // 다른 참가자들에게 "OO가 가져갔어요" 알림
}
```

A local match doesn't need this kind of notification since there's only one screen, but in LAN mode, when multiple people were going for the same tile at once, this notification prevents the confusion of "I pressed it, so why isn't it reflected?" Implementing the same concept (completion-first + first-response-wins) on both local and network paths meant the only thing added on the LAN side was the part about "showing the human what just happened."

## Testing: Reproducing a Race Without Actually Playing a Game

Verifying this logic requires a situation where "multiple people want the same tile at the same time," and that only happens by chance during normal gameplay, which makes it hard to test. So I directly manipulated game state to force the exact situation I wanted.

```dart
void _setupClaimRace(GameController gc) {
  final game = gc.game;
  for (final pl in game.players) {
    pl.hand.clear();
    pl.melds.clear();
  }
  game.players[1].hand.add(m(7)); // 버릴 패
  game.players[0].hand.addAll([m(7), m(7), ...filler]); // 사람: 트리플 가능
  game.players[2].hand.addAll([m(8), m(9), ...filler]); // AI: 스트레이트 가능
  game.current = 1;
  game.discard(m(7));
  gc.debugPoke(); // 자동 진행 루프를 다시 깨운다
}
```

`filler` is filled with loose tiles that can never combine with each other (the 7 honor tile types plus bamboo 2·4·6·8). This lets me prevent accidentally forming a complete hand by chance while precisely controlling for "this tile can only be claimed, nothing else."

I verified timing like this.

```dart
test('사람이 AI의 최소 고민 시간(500ms)보다 먼저 응답하면 사람이 가져간다', () async {
  final gc = GameController(seed: 1, aiThinkMin: 500, aiThinkRangeMs: 12500);
  _setupClaimRace(gc);

  await Future<void>.delayed(const Duration(milliseconds: 50));
  gc.humanRespondClaim(option: /* 트리플 옵션 */);

  await waitFor(() => gc.human.melds.isNotEmpty);
  // AI는 500ms보다 일찍 응답할 수 없으므로, 사람이 반드시 이긴다.
});
```

Being able to inject `aiThinkMin`/`aiThinkRangeMs` through the constructor mattered here. In the real game, the AI thinks for a random 0.5–13 seconds — but a test can't wait 13 seconds every single run. So I injected short values (say 30ms–50ms) just for tests, making "the moment before the AI could possibly have responded" and "the moment after the AI has already responded" fully deterministic. Keeping the real production values untouched while separately controlling test speed is a common pattern, but it was useful here once again.

## Wrap-Up

The core flow of this work:

1. **Found the problem**: the AI always responded instantly, leaving a human no physical time at all to react.
2. **Redesigned the rule**: kept the tier where "completion always takes priority," but within the same tier, simplified seating order into **whoever responds first wins.**
3. **Adjusted AI timing**: no delay for decisions a human isn't watching (AI vs. AI), and only decisions involving a human give the AI a random thinking time (0.5–13 seconds).
4. **Event-driven ruling**: switched from "collect everything, then sort all at once" to "check immediately each time a response arrives," finalizing completions instantly and remembering only the first claim response until the conditions are met.
5. **Implemented twice**: applied the same pattern to both local and LAN matches, adding only a "who claimed it" notification on the LAN side.
6. **Deterministic testing**: directly manipulated game state to create a race situation, and injected short AI thinking times for tests to verify the timing.

I was reminded that "porting a game rule into code" isn't just about porting the ruling logic — you also have to think about **how that rule actually feels to a real user.** Seating-order priority is a reasonable rule in real-world mahjong, but in a digital game that runs on screens and timers, it ended up creating the misunderstanding that "the AI is unfairly fast." Sometimes it's better to think about the experience a rule creates before porting the rule itself exactly as-is.
