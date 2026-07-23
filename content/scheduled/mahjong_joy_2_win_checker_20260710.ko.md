---
title: 'Mahjong Joy 개발기 (2) — 마작 승리 판정 알고리즘, 재귀로 뚫기'
date: '2026-07-10'
publish_date: '2026-07-30'
description: 14장의 패가 몸통 4개와 머리 1쌍으로 분해되는지 판정하는 재귀 알고리즘을 Dart로 구현하고 단위 테스트로 함정 케이스까지 잡은 과정
tags:
  - Flutter
  - Dart
  - 알고리즘
  - 게임개발
  - 재귀
---

> **Mahjong Joy 시리즈**
> 1. 기획 분석과 작업 계획
> 2. **핵심 로직 — 승리 판정 알고리즘** ← 이번 글
> 3. 게임 엔진과 AI 만들기
> 4. 파스텔 UI와 타일 애니메이션
> 5. 점수 시스템과 메인화면

## UI보다 로직 먼저

게임 개발을 시작하면 화면부터 그리고 싶어진다. 하지만 이번엔 순서를 바꿨다. **UI 없이 순수 Dart 로직만 먼저 만들고, `flutter test`로 완결**하는 것. 이 결정 덕분에 이후 UI 작업 내내 "로직이 틀렸나?"를 의심할 일이 없었다.

이번 편에서 만들 것은 세 가지다.

1. 타일 모델과 덱 (136장 생성, 셔플, 배분)
2. **승리 판정** — 14장이 3-3-3-3-2로 쪼개지는가?
3. 대기패 계산과 뺏어오기 판정

## Step 1: 타일 모델 — 34종을 정수 하나로

마작 타일은 34종이다. 수패 3종(만/통/삭) × 9 = 27종, 자패 7종. 각 4장씩 총 136장. 핵심은 타일을 **0~33의 정수 key로 인코딩**한 것이다.

```dart
enum Suit { man, pin, sou, honor }

class Tile implements Comparable<Tile> {
  final Suit suit;
  final int rank; // 수패 1~9, 자패 1~7

  /// 34종 타일을 0~33으로 인코딩. 정렬·판정 로직의 기본 키.
  int get key => suit.index * 9 + (rank - 1);

  static Tile fromKey(int key) =>
      Tile(Suit.values[key ~/ 9], (key % 9) + 1);

  @override
  int compareTo(Tile other) => key - other.key;
}
```

이 인코딩의 좋은 점: **연속 숫자 판정이 `key + 1`, `key + 2` 비교로 끝난다.** 손패도 `List<int> counts = List.filled(34, 0)` 형태의 카운트 배열로 다루면 재귀에서 복사 비용 없이 증감만 하면 된다.

덱 생성과 배분은 단순하다.

```dart
List<Tile> buildDeck() {
  final deck = <Tile>[];
  for (var key = 0; key < Tile.kindCount; key++) {
    final tile = Tile.fromKey(key);
    for (var i = 0; i < 4; i++) {
      deck.add(tile);
    }
  }
  return deck;
}
```

`deal()` 함수는 `Random`을 주입받도록 만들었다. 테스트에서 `Random(42)`처럼 시드를 고정하면 **재현 가능한 대국**을 만들 수 있어서, 이후 시뮬레이션 테스트의 기반이 된다.

## Step 2: 승리 판정 — 머리 후보 제거 후 재귀 분해

문제 정의: 14장의 패가 "몸통 4개(연속 3장 or 동일 3장) + 머리 1쌍"으로 **완전히** 분해되는가?

알고리즘은 2단계다.

1. 머리(같은 패 2장)가 될 수 있는 후보를 하나씩 잡아 제거해본다
2. 남은 12장이 몸통 4개로 깔끔하게 쪼개지는지 재귀로 확인한다

```dart
bool isWinningHand(List<Tile> tiles, {int meldCount = 0}) {
  final setsNeeded = 4 - meldCount;
  if (setsNeeded < 0 || tiles.length != setsNeeded * 3 + 2) return false;

  final counts = List<int>.filled(Tile.kindCount, 0);
  for (final t in tiles) {
    counts[t.key]++;
    if (counts[t.key] > 4) return false; // 같은 패는 4장까지만
  }

  for (var key = 0; key < Tile.kindCount; key++) {
    if (counts[key] < 2) continue;
    counts[key] -= 2; // 머리 후보 제거
    if (_decomposeIntoSets(counts, setsNeeded)) {
      counts[key] += 2;
      return true;
    }
    counts[key] += 2; // 백트래킹
  }
  return false;
}
```

`meldCount` 파라미터가 눈에 띌 텐데, 뺏어오기로 이미 공개한 몸통 수만큼 손패에서 찾아야 할 몸통을 차감하는 용도다. 몸통 2개를 공개했으면 손패 8장에서 몸통 2개 + 머리만 찾으면 된다.

재귀 분해의 핵심 아이디어는 이거다. **정렬된 상태에서 가장 작은 key의 패는 반드시 어떤 몸통의 "시작"이어야 한다.** 그래서 분기가 딱 두 개뿐이다.

```dart
bool _decomposeIntoSets(List<int> counts, int setsNeeded) {
  if (setsNeeded == 0) return true;

  var key = 0;
  while (key < Tile.kindCount && counts[key] == 0) {
    key++;
  }
  if (key == Tile.kindCount) return false;

  // 경우 1: 트리플
  if (counts[key] >= 3) {
    counts[key] -= 3;
    if (_decomposeIntoSets(counts, setsNeeded - 1)) { /* 복원 후 */ return true; }
    counts[key] += 3;
  }

  // 경우 2: 스트레이트 (수패만, rank 7까지 시작 가능)
  final tile = Tile.fromKey(key);
  if (!tile.isHonor && tile.rank <= 7 &&
      counts[key + 1] > 0 && counts[key + 2] > 0) {
    // key, key+1, key+2를 하나씩 빼고 재귀 → 실패 시 복원
  }

  return false;
}
```

가장 작은 패가 트리플의 일부도, 스트레이트의 시작도 될 수 없다면 그 손은 절대 완성될 수 없다. 이 관찰 하나로 탐색 공간이 확 줄어든다. 자패는 `isHonor` 체크로 스트레이트 분기를 막았고, 수패도 8·9에서 시작하는 스트레이트는 없으니 `rank <= 7` 조건이 붙는다.

## Step 3: 대기패 계산 — 판정 함수 재활용

"어떤 패가 들어오면 완성인가?"를 알려주는 기능(기획안의 '남은 패 가이드')은 의외로 공짜로 얻는다. **34종을 전부 넣어보면 된다.**

```dart
List<Tile> waitingTiles(List<Tile> hand, {int meldCount = 0}) {
  final waits = <Tile>[];
  for (var key = 0; key < Tile.kindCount; key++) {
    if (inHand[key] >= 4) continue; // 이미 4장 다 들고 있으면 불가능
    final candidate = Tile.fromKey(key);
    if (isWinningHand([...hand, candidate], meldCount: meldCount)) {
      waits.add(candidate);
    }
  }
  return waits;
}
```

34번의 판정이면 충분하다. 판정 함수가 빠르니(카운트 배열 + 가지치기) 매 턴 호출해도 전혀 부담이 없다.

뺏어오기 판정(`claimableSets`)도 비슷한 요령이다. 버려진 패에 대해 트리플(손에 같은 패 2장)과 스트레이트 3가지 위치(x-2·x-1, x-1·x+1, x+1·x+2)만 검사하면 된다.

## Step 4: 함정 케이스를 테스트로 박제

이런 로직은 "대충 돌아가는 것 같은데?"가 제일 위험하다. 함정 케이스를 단위 테스트로 박아뒀다.

```dart
test('자패는 스트레이트가 될 수 없다', () {
  // 동남서를 몸통으로 취급하면 안 됨
  expect(isWinningHand(hand('z123 m456 m789 p111 s99')), isFalse);
});

test('다중 해석 손패: 순정구련보등 + 9', () {
  // 1112345678999 + 9: 여러 분해 경로 중 하나만 성립해도 승리
  expect(isWinningHand(hand('m1112345678999 m9')), isTrue);
});

test('연속 쌍 함정: 22334455는 스트레이트 2개로 분해 가능', () {
  expect(isWinningHand(hand('m223344 m556677 s88')), isTrue);
});
```

두 번째 케이스가 중요하다. `1112345678999`는 머리를 `11`로 잡으면 `123 456 789 999`로 분해되지만, `99`로 잡으면 실패한다. **첫 시도가 실패해도 다른 머리 후보로 백트래킹하는지** 검증하는 케이스다. 탐욕(greedy) 알고리즘으로 대충 짜면 여기서 무너진다.

테스트용 표기법도 만들어두면 편하다. `hand('m123 p456 z11')`처럼 문자열로 손패를 만들어주는 헬퍼 하나가 테스트 가독성을 확 올린다.

## 정리

1. 타일 34종을 0~33 정수 key로 인코딩 → 연속 판정과 카운트 배열이 간단해짐
2. 승리 판정 = 머리 후보 제거 → 최소 key 기준 트리플/스트레이트 재귀 분해
3. "가장 작은 패는 반드시 몸통의 시작"이라는 관찰로 분기를 2개로 압축
4. 대기패 계산은 34종 전수 대입으로 공짜 구현
5. 백트래킹이 필요한 함정 손패를 단위 테스트로 박제 (25개 전부 통과)

다음 편에서는 이 로직 위에 **4인 턴 루프 게임 엔진과 AI 3명**을 올린다. AI 4명이 100판을 자동으로 두게 해서 엔진을 검증하는 시뮬레이션 테스트가 하이라이트다.
