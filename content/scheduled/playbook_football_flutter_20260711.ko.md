---
title: '보드게임 규칙서 PDF 한 권으로 Flutter 풋볼 게임 만들기'
date: '2026-07-11'
publish_date: '2026-08-09'
description: 미국 풋볼 보드게임 Playbook Football의 규칙서와 카드를 분석해 주사위·카드 차트 기반 AI 대전 모바일 게임으로 옮긴 과정
tags:
  - Flutter
  - Dart
  - 게임개발
  - ClaudeCode
  - 보드게임
---

## 서랍 속 보드게임을 폰에 넣고 싶었다

예전에 미국 미식축구를 소재로 한 보드게임 **Playbook Football**을 재밌게 했던 기억이 있다. 화려한 그래픽 게임이 아니라, 공격팀과 수비팀이 각자 카드를 한 장씩 몰래 내고 주사위를 굴려서 카드에 인쇄된 **차트(표)**에서 결과를 찾는, 철저하게 텍스트와 숫자 위주의 게임이다.

- 공격팀은 4번의 다운(공격 기회) 안에 10야드를 전진해야 한다
- 공격 카드는 패스 4종 + 러닝 5종, 총 9장
- 수비 카드는 9가지 대형(4-3, 니켈, 블리츠...)이고, 공격 플레이 종류별로 주사위 보정치를 준다
- "상대가 패스를 낼까, 러닝을 낼까"를 읽는 심리전이 게임의 핵심

문제는 이 게임을 같이 할 사람이 늘 옆에 있는 게 아니라는 것. 그래서 **혼자서도 AI를 상대로 플레이할 수 있는 모바일 게임**으로 만들어 보기로 했다. 재료는 딱 두 개, 한글 번역 규칙서 PDF와 카드 스캔 PDF였다.

## 사전 준비

| 항목 | 내용 |
|---|---|
| 프레임워크 | Flutter 3.44 (Dart) |
| 입력 자료 | 규칙서 PDF 1권 + 카드 스캔 PDF (32장) |
| PDF 처리 | poppler(pdftoppm) + Python Pillow |
| 게임 모드 | 싱글플레이 (AI 대전) |

Flutter를 고른 이유는 단순하다. iOS/Android를 한 코드로 커버하면서, 이 게임처럼 **커스텀 그리기(필드, 전술 다이어그램)**가 많은 UI는 Flutter의 `CustomPainter`가 잘 맞기 때문이다.

## Step 1. 카드 차트를 데이터로 옮기기 — 가장 지루하지만 가장 중요한 일

이 게임의 본체는 사실 코드가 아니라 **카드에 인쇄된 5×10 차트**다. 공격 카드마다 이런 표가 하나씩 붙어 있다.

- **행(5개)**: 공격자의 10면체 주사위 결과 (9-10 / 7-8 / 5-6 / 3-4 / 1-2)
- **열(10개)**: 양 팀 12면체 주사위 합 (2-3 / 4-5 / ... / 23-24)
- **셀 값**: 전진 야드(음수면 후퇴), 또는 특수 결과 — `I`(인터셉트), `F`(펌블), `G`(골 성공), `X`(실패)

카드 스캔 PDF를 그대로 읽기엔 해상도가 애매해서, poppler로 200dpi PNG로 변환한 뒤 카드 단위로 잘라서 하나씩 확인했다.

```bash
brew install poppler
pdftoppm -png -r 200 card_scan.pdf cards
```

```python
# Pillow로 3x3 그리드 크롭
from PIL import Image
im = Image.open('cards-1.png')
card = im.crop((x0, y0, x1, y1))  # 카드 한 장씩
card.save('def_1.png')
```

이렇게 전사한 데이터는 Dart에서 문자열 2차원 배열로 들고 갔다. 숫자와 특수문자가 섞여 있어서 `int`로 강제하지 않고 문자열로 두고, 조회 시점에 파싱하는 쪽이 오히려 깔끔했다.

```dart
const shortPass = OffenseCard(
  id: 'short_pass',
  name: 'SHORT PASS',
  type: PlayType.pass,
  averageYards: 8.0,
  chart: [
    ['95', '59', '24', '21', '9', '8', '20', '24', '32', '86'],
    // ... 5행 10열
    ['9', '8', '0', 'F', '-1', '0', '-2', 'I', '-4', '5'],
  ],
);
```

**교훈**: 이런 전사 작업은 검증 코드를 같이 만들어야 한다. "모든 차트는 5행 10열", "셀 값은 숫자 또는 I/F/G/X/R만 허용" 같은 단위 테스트를 먼저 깔아두니, 옮기다 실수한 부분이 바로 걸러졌다.

```dart
test('차트 셀은 숫자 또는 유효한 특수문자', () {
  final valid = RegExp(r'^(-?\d+|I|F|G|X|R)$');
  for (final c in offenseCards) {
    for (final row in c.chart) {
      for (final cell in row) {
        expect(valid.hasMatch(cell), true, reason: '${c.id}: $cell');
      }
    }
  }
});
```

## Step 2. 게임 엔진 — UI 없이 순수 Dart로

엔진은 Flutter 위젯과 완전히 분리해서 순수 Dart로 작성했다. 필드는 0~100의 1차원 좌표로 표현하면 충분하다.

```dart
enum Team { home, away }

extension TeamX on Team {
  /// 공격 진행 방향 (+1: 100쪽, -1: 0쪽)
  int get direction => this == Team.home ? 1 : -1;
}
```

핵심 판정 로직은 규칙 그대로다. 수비 카드가 공격 주사위에 보정치를 주고, 보정된 값으로 행을, 12면체 합으로 열을 찾는다.

```dart
final mod = defenseCard.modifierFor(offenseCard.id); // 예: 니켈 vs 숏패스 = -2
final adjusted = (offD10 + mod).clamp(1, 10);
final row = rowIndex(adjusted);
final col = columnIndex(offD12 + defD12);
final cell = offenseCard.cell(row, col); // '9', '-1', 'I', 'F' ...
```

까다로웠던 건 숫자가 아닌 특수 결과들의 **연쇄 처리**였다. 인터셉트가 나오면 턴오버 차트를 또 굴리고, 거기서 또 펌블이 나오면 펌블 차트를 굴린다. 상태 머신으로 페이즈를 나눠서 정리했다.

```dart
enum GamePhase {
  kickoff,      // 킥오프 or 온사이드 킥 선택
  returnChoice, // 엔드존 도달 시 리턴/터치백 선택
  play,         // 공격/수비 카드 선택
  extraPoint,   // 터치다운 후 추가득점 선택
  gameOver,
}
```

한 가지 설계 팁. 쿼터 종료(16플레이) 타이밍이 미묘한데, 규칙상 "진행 중이던 다운은 끝까지 해결하고" 쿼터가 넘어간다. 처음엔 플레이 카운트 증가 시점에 바로 쿼터를 넘겼다가 진행 중인 판정이 꼬였다. 결국 **"쿼터 전환 예약" 플래그**를 두고, 모든 판정이 끝난 뒤에 적용하는 구조로 바꿨다.

## Step 3. AI 상대 — 가중치 랜덤이면 충분하다

AI라고 해서 거창한 게 아니다. 상황(다운, 남은 야드, 필드 위치, 점수차)별로 카드에 가중치를 주고 추첨하는 방식이다.

```dart
String _weightedPick(Map<String, double> weights) {
  final total = weights.values.fold(0.0, (a, b) => a + b);
  var roll = _rng.nextDouble() * total;
  for (final e in weights.entries) {
    roll -= e.value;
    if (roll <= 0) return e.key;
  }
  return weights.keys.last;
}
```

난이도는 **가중치에 지수를 씌우는 것**만으로 구현했다. 쉬움은 `w^0.35`(거의 랜덤), 어려움은 `w^1.6`(최적 선택에 쏠림). 여기에 어려움 난이도는 사람이 최근에 낸 패스/러닝 비율을 기억했다가 수비를 맞춰 오는 "성향 학습"을 한 스푼 얹었다.

검증은 시뮬레이션으로 했다. **AI끼리 100판을 자동 대전**시켜서 크래시·무한루프가 없는지, 평균 득점이 상식적인 범위인지 확인하는 테스트를 만들어 두니, 엔진을 고칠 때마다 회귀 여부가 몇 초 만에 확인됐다.

## Step 4. UI — 텍스트 게임이라도 '게임플랜' 맛은 살리기

처음 버전은 공격 카드 9장을 3×3 그리드로 전부 보여줬는데, 직접 해보니 매번 9장을 훑는 게 피곤했다. 그래서 미식축구 게임들이 쓰는 **게임플랜 방식**으로 바꿨다.

1. 현재 상황을 자동 판별한다 (짧은 거리 / 중간 / 긴 거리 / 골라인)
2. 상황에 맞는 **추천 플레이 3장만** 크게 보여준다
3. 다른 걸 쓰고 싶으면 [전체 플레이북] 버튼으로 시트를 연다

각 카드에는 `CustomPainter`로 그린 X/O 전술 다이어그램을 넣었다. 미식축구 전술판 표기(공격은 O, 수비는 X, 루트는 화살표, 페이크는 점선)를 그대로 따랐다.

공 이동 애니메이션은 `TweenSequence`로 궤적을 다단계로 이었다. 킥오프처럼 "앞으로 갔다가 리턴으로 되돌아오는" 움직임도 세그먼트 거리를 가중치로 주면 자연스럽게 이어진다.

```dart
items.add(TweenSequenceItem(
  tween: Tween(begin: from, end: to)
      .chain(CurveTween(curve: Curves.easeInOut)),
  weight: dist, // 이동 거리 비례로 시간 배분
));
```

## 트러블슈팅

**1. 위젯 테스트로 레이아웃 오버플로우 잡기**

UI 버그는 특정 게임 상황에서만 터진다(예: 4번째 다운에만 나타나는 펀트/FG 버튼 줄이 화면을 넘침). 실기기로 그 상황을 재현하려면 한참 걸리는데, **랜덤 진행 스모크 테스트**가 효자였다. 화면에 보이는 버튼을 60스텝 동안 아무거나 눌러가며 진행하고, 매 스텝 `tester.takeException()`이 null인지 확인한다. `RenderFlex overflowed` 같은 레이아웃 예외가 테스트 실패로 잡힌다.

**2. 웹에서 카드가 이상하게 늘어남**

폰 세로 화면 기준으로 만든 레이아웃을 넓은 브라우저에서 열면 카드가 가로로 쭉 늘어나 테두리만 보였다. 해결은 한 줄 — 게임 화면 전체를 `ConstrainedBox(maxWidth: 520)`으로 감싸서 어디서 열어도 폰 비율을 유지하게 했다.

**3. 구형 Android 에뮬레이터**

옛날에 만든 arm32 AVD는 최신 에뮬레이터에서 아예 못 돌린다 (`CPU Architecture 'arm' is not supported by the QEMU2 emulator`). arm64 시스템 이미지를 새로 받아야 한다. 급하면 웹 빌드(`flutter build web`)를 로컬 서버로 띄워서 브라우저로 확인하는 게 훨씬 빠르다.

```bash
cd build/web && python3 -m http.server 8765
# 폰에서도 http://<맥 IP>:8765 로 바로 접속 가능
```

**4. 실기기 설치**

USB로 연결하고 릴리즈 APK를 바로 밀어 넣었다.

```bash
flutter build apk --release
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

## 정리 — 보드게임 디지털화의 흐름

1. **규칙서·카드를 데이터로**: 차트를 전부 전사하고, 무결성 테스트를 먼저 깐다
2. **엔진은 순수 Dart로**: UI와 분리하면 AI 자동 대전 같은 시뮬레이션 테스트가 가능해진다
3. **AI는 가중치 추첨 + 지수 난이도**: 보드게임 수준의 상대는 이걸로 충분히 재밌다
4. **UI는 상황 기반 추천**: 카드가 많으면 다 보여주지 말고, 상황에 맞는 몇 장만
5. **랜덤 스모크 테스트**: 확률 게임의 UI 버그는 자동 랜덤 진행으로 잡는 게 제일 싸다

종이 규칙서 한 권이 폰 안의 게임이 되기까지, 가장 오래 걸린 건 코딩이 아니라 **카드 32장의 숫자를 옮기고 검증하는 일**이었다. 반대로 말하면, 데이터만 정확하게 옮겨 두면 보드게임의 디지털화는 생각보다 할 만한 프로젝트다. 서랍에 잠들어 있는 보드게임이 있다면 한번 도전해 보시길.
