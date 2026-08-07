---
title: 'Flutter 마작 게임에 점수제와 효과음 넣기 — 영수증 연출과 WAV 직접 합성까지'
date: '2026-07-11'
publish_date: '2026-08-07'
description: 심플 마작 게임에 아이도 이해하는 보너스 점수제를 설계하고, 외부 에셋 없이 파이썬으로 효과음을 합성해 audioplayers로 재생한 과정 정리
tags:
  - Flutter
  - Dart
  - audioplayers
  - 게임개발
---

# Flutter 마작 게임에 점수제와 효과음 넣기

취미로 만들고 있는 심플 마작 게임 "마작 조이"에 두 가지를 추가했다. **점수제**와 **사운드**. 승리 판정까지는 만들어놨는데, 이기면 그냥 "3,000점 획득" 하고 끝이라 뭔가 심심했다. 마작의 재미 절반은 "내 패가 얼마나 예쁘게 완성됐나"에서 오는데, 그걸 점수로 보여주지 못하고 있었던 것이다.

문제는 진짜 마작 점수 계산(역, 판수, 부수...)은 어른도 어려워한다는 점. 이 게임의 컨셉은 "짝 맞추기의 재미만 남긴 심플 마작"이라서, 점수제도 **영수증 한 장 보고 바로 이해되는 수준**이어야 했다.

## 점수제 설계: 먼저 더하고, 그다음 곱해요

고민 끝에 규칙을 딱 두 묶음으로 정리했다.

> **최종 점수 = (기본 100점 + 더하기 보너스) × 곱하기 보너스**

| 보너스 | 조건 | 보상 |
|---|---|---|
| 🌈 날씨 세트 | 날씨 패(해·구름·별...) 3장 몸통 | 하나당 +50점 |
| 💪 내가 뽑았다! | 스스로 뽑은 패로 완성 (츠모) | +100점 |
| 📏 올 스트레이트 | 몸통 4개가 전부 연속 숫자 | +200점 |
| 🎣 라스트 캐치 | 남은 패 5장 이하에서 완성 | +200점 |
| 🔒 혼자 힘으로 | 뺏어오기 없이 완성 | ×2 |
| 🌗 하프 앤 하프 | 숫자 패 한 종류 + 날씨 패 | ×2 |
| 🎲 올 트리플 | 몸통 4개가 전부 같은 패 3장 | ×3 |
| 🎨 원 컬러 | 한 종류의 숫자 패로만 완성 | ×5 |

전통 마작의 청일색(원 컬러), 혼일색(하프 앤 하프), 대대화(올 트리플) 같은 족보를 직관적인 이름으로 바꾼 것이다. 어려운 이름 대신 "왜 점수를 받았는지"가 이름에 드러나게 했다.

"쉬운 건 더하기, 어려운 건 곱하기"로 나누니 계산 순서 설명도 한 줄이면 된다: **먼저 더하고, 그다음 곱해요!**

## Step 1: 영수증 데이터 구조

점수 결과를 UI 연출까지 고려해서 설계했다. 핵심은 `ScoreLine`이 `plus`(더하기)와 `times`(곱하기) 중 하나만 갖는다는 것.

```dart
/// 영수증 한 줄. plus와 times 중 정확히 하나만 갖는다.
class ScoreLine {
  final String emoji;
  final String name;
  final String detail; // 왜 받았는지 한 줄 설명
  final int? plus;
  final int? times;

  const ScoreLine.plus(this.emoji, this.name, this.detail, int score)
      : plus = score, times = null;

  const ScoreLine.times(this.emoji, this.name, this.detail, int multiplier)
      : plus = null, times = multiplier;
}

class ScoreResult {
  final List<ScoreLine> lines; // 더하기 → 곱하기 순서
  final int total;

  ScoreResult(this.lines) : total = _sumUp(lines);

  /// count번째 줄까지 반영한 소계 (영수증 연출용)
  int subtotal(int count) => _sumUp(lines.take(count).toList());
}
```

`subtotal()`이 포인트다. 영수증 항목이 한 줄씩 나타날 때마다 소계가 굴러 올라가는 연출을 하려면, "n번째 줄까지의 중간 합계"를 계산할 수 있어야 한다.

## Step 2: 손패 모양 판정 로직

"올 스트레이트"와 "올 트리플"은 완성된 14장을 실제로 분해해봐야 안다. 처음엔 모든 분해 경우를 전부 열거하는 재귀를 짜려다가, 두 판정 모두 훨씬 간단한 방법이 있다는 걸 깨달았다.

**올 트리플**은 재귀가 아예 필요 없다. 장수 분포만 보면 된다:

```dart
/// "머리 1쌍 + 나머지 전부 트리플"인지.
/// 조건: 모든 종류의 장수가 0/2/3장이고, 2장인 종류가 정확히 하나.
bool _isAllTripleHand(List<int> counts) {
  var pairs = 0;
  for (final c in counts) {
    if (c == 2) {
      pairs++;
    } else if (c != 0 && c != 3) {
      return false;
    }
  }
  return pairs == 1;
}
```

**올 스트레이트**는 머리 후보를 하나씩 빼본 뒤, 나머지를 스트레이트만으로 소진할 수 있는지 확인한다. 이때 "가장 작은 숫자 패는 반드시 스트레이트의 시작이어야 한다"는 성질 덕분에 백트래킹 없이 탐욕적으로 확정된다:

```dart
bool _decomposeRunsOnly(List<int> counts) {
  for (var key = 0; key < 27; key++) {
    while (counts[key] > 0) {
      final rank = key % 9 + 1;
      if (rank > 7 || counts[key + 1] == 0 || counts[key + 2] == 0) {
        return false;
      }
      counts[key]--;
      counts[key + 1]--;
      counts[key + 2]--;
    }
  }
  // ...
}
```

점수 로직 전체를 UI와 분리된 순수 함수(`calculateScore`)로 만들어서 단위 테스트를 쉽게 붙일 수 있었다. "올 웨더 잭팟(전부 날씨 패)이면 (100+200)×2×3×5 = 9,000점" 같은 케이스도 테스트로 박아뒀다.

## Step 3: 효과음을 파이썬으로 직접 합성하기

사운드 작업에서 제일 먼저 부딪히는 문제는 의외로 코드가 아니라 **에셋 구하기**다. 무료 효과음 사이트를 뒤지고, 라이선스 확인하고, 톤이 안 맞아서 다시 찾고... 이게 은근히 오래 걸린다.

그래서 이번엔 **효과음을 파이썬 표준 라이브러리로 직접 합성**했다. `wave` + `math` 모듈이면 충분하다. 사인파에 지수 감쇠 엔벨로프를 씌우면 종소리 느낌이 난다:

```python
def tone(freq, dur, vol=0.5, attack=0.005, decay=None, harmonics=(1.0, 0.25)):
    """부드러운 종소리 느낌: 기본파 + 약한 배음, 지수 감쇠."""
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        env = min(1.0, t / attack) * math.exp(-3.5 * t / decay)
        s = sum(amp * math.sin(2 * math.pi * freq * h * t)
                for h, amp in enumerate(harmonics, start=1))
        out.append(vol * env * s)
    return out

# 영수증 항목 체크 '딩' — G6 음의 맑은 종소리
write_wav("ding", tone(1568.0, 0.28, vol=0.45, decay=0.25,
                       harmonics=(1.0, 0.35, 0.12)))
```

이렇게 만든 효과음 7종:

| 파일 | 용도 | 만드는 법 |
|---|---|---|
| tap.wav | 패 버리기 '톡' | 노이즈 + 220Hz 펄스, 급감쇠 |
| draw.wav | 패 뽑기 블립 | 520→940Hz 주파수 스윕 |
| claim.wav | 뺏어오기 '뾰롱' | E5→B5 두 음 상승 |
| ding.wav | 영수증 체크 | G6 종소리 |
| total.wav | 총점 발표 | C6-E6-G6-C7 상승 4연타 |
| win.wav | 승리 팡파레 | C5-E5-G5-C6 아르페지오 + 저음 화음 |
| lose.wav | 패배/유국 | G4→Eb4 부드러운 하강 |

음 높이를 화음(도-미-솔) 관계로 잡으면 아무렇게나 찍은 주파수보다 훨씬 "게임 사운드"처럼 들린다. 스크립트는 `tool/gen_sfx.py`로 프로젝트에 넣어놔서, 톤이 마음에 안 들면 숫자만 바꿔 다시 뽑으면 된다. 라이선스 걱정도 없다.

## Step 4: audioplayers로 재생하기

Flutter에서 짧은 효과음 재생은 `audioplayers` 패키지를 썼다.

```yaml
# pubspec.yaml
dependencies:
  audioplayers: ^6.1.0

flutter:
  assets:
    - assets/sfx/
```

효과음이 연달아 겹칠 수 있으므로(패 버리기 직후 뺏어오기 알림 등) 플레이어 4개를 풀로 만들어 돌려가며 쓴다:

```dart
class SoundService {
  SoundService._();
  static final SoundService instance = SoundService._();

  /// 음소거 토글. UI가 구독해 아이콘을 갱신한다.
  final ValueNotifier<bool> enabled = ValueNotifier(true);

  /// 첫 재생 시 생성 (음소거 상태나 테스트에서는 아예 만들지 않는다)
  List<AudioPlayer>? _pool;
  int _next = 0;

  Future<void> _play(String name, {double volume = 1.0}) async {
    if (!enabled.value) return;
    final pool = _pool ??= List.generate(4, (_) => _newPlayer());
    final player = pool[_next];
    _next = (_next + 1) % pool.length;
    try {
      await player.stop();
      await player.play(AssetSource('sfx/$name.wav'), volume: volume);
    } catch (_) {
      // 효과음은 실패해도 게임 진행에 영향 없음
    }
  }
}
```

여기서 두 가지 디테일:

1. **플레이어 풀을 지연 생성**한다. 위젯 테스트 환경에는 오디오 플러그인이 없어서 `AudioPlayer`를 만드는 것 자체가 문제가 될 수 있다. 테스트에서는 `enabled`를 꺼두면 플레이어가 아예 생성되지 않는다.
2. **음소거를 `ValueNotifier`로** 만들어서, 게임 화면의 🔊 토글 버튼이 `ValueListenableBuilder`로 구독한다. 상태 관리 라이브러리 없이도 깔끔하게 반응형이 된다.

게임 엔진(순수 Dart 로직)에는 사운드 코드를 넣지 않고, UI 컨트롤러에서만 호출했다. 로직 테스트가 사운드에 오염되지 않는다.

## Step 5: 영수증 연출

점수를 숫자로 툭 던지면 재미없다. 게임이 끝나면 🧾 영수증이 뜨고, 0.55초 간격으로 항목이 딩~ 소리와 함께 한 줄씩 미끄러져 들어오면서 소계가 굴러 올라간다. 마지막엔 총점이 팡파레와 함께 `Curves.elasticOut`으로 통통 튀며 등장한다.

핵심 구조는 `Timer.periodic` + `setState`:

```dart
void _tick() {
  if (_revealed < widget.score.lines.length) {
    setState(() {
      _revealed++;
      _prevSubtotal = _subtotal;
      _subtotal = widget.score.subtotal(_revealed);
    });
    SoundService.instance.ding();
  } else {
    _timer?.cancel();
    setState(() => _showTotal = true);
    SoundService.instance.total();
  }
}
```

소계 숫자가 굴러 올라가는 건 `TweenAnimationBuilder` 하나면 된다. `key`를 소계 값으로 주면 값이 바뀔 때마다 이전 값→새 값으로 애니메이션이 다시 시작된다:

```dart
TweenAnimationBuilder<double>(
  key: ValueKey(_subtotal),
  tween: Tween(begin: _prevSubtotal.toDouble(), end: _subtotal.toDouble()),
  duration: const Duration(milliseconds: 350),
  builder: (context, v, _) => Text('${v.round()}점', /* ... */),
)
```

`AnimationController`를 직접 관리하지 않아도 이 정도 연출은 `TweenAnimationBuilder`로 충분하다는 게 이번 작업의 소소한 발견이었다.

## 트러블슈팅

### 위젯 테스트의 "Timer is still pending" 에러

영수증에 `Timer.periodic`을 쓰면서 기존 스모크 테스트가 깨질 위험이 생겼다. `testWidgets`는 테스트 종료 시점에 살아있는 타이머가 있으면 실패시킨다. 게임이 끝나는 순간 결과 오버레이(=영수증 타이머)가 뜨는데, 테스트가 거기서 그냥 끝나버리면 타이머가 pending 상태로 남는다.

해결은 간단했다. 테스트 끝에 **빈 위젯으로 트리를 교체**하면 `State.dispose()`가 불려서 타이머가 정리된다:

```dart
Future<void> tearDownTree(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
}
```

### 츠모 분담금의 나눗셈 문제

점수 스케일을 100 단위로 바꾸니 새 문제가 생겼다. 츠모(스스로 뽑아 완성)면 나머지 3명이 나눠 내는데, 400점 ÷ 3은 나누어떨어지지 않는다. 기존처럼 `value ~/ 3`로 버림하면 점수 총합이 보존되지 않는다(전원 점수 합계가 0이어야 한다).

**올림으로 나누고, 승자는 지불 합계를 받는 방식**으로 정리했다:

```dart
final share = (value / (playerCount - 1)).ceil();
// 승자는 share × 3을 받는다 → 합계 항상 0
```

승자가 최대 2점 더 받지만, 총합 보존이 깨지는 것보다 낫다. 이런 건 테스트(`deltas.reduce((a,b) => a+b) == 0`)를 박아두면 리팩토링할 때 안심이 된다.

### Xcode 없이 macOS 빌드 실패

`flutter build macos`가 `xcrun: unable to find utility "xcodebuild"`로 실패했다. Xcode가 없으면 네이티브 플러그인(audioplayers)이 포함된 macOS/iOS 빌드는 불가능하다. 통합 확인은 `flutter build web`으로 대신했고, 실제 설치는 USB로 연결한 안드로이드 폰에 했다:

```bash
flutter build apk --release
flutter install -d <기기ID> --release
```

## 정리

오늘 작업의 흐름을 한눈에 보면:

1. **점수제 설계** — "더하기 보너스"와 "곱하기 보너스" 두 묶음으로 단순화
2. **순수 함수로 점수 로직 구현** — 손패 분해 판정은 장수 분포 검사와 탐욕 알고리즘으로 재귀 최소화
3. **효과음 직접 합성** — 파이썬 `wave` 모듈로 사인파 + 지수 감쇠, 라이선스 걱정 제로
4. **audioplayers 연동** — 지연 생성 플레이어 풀, `ValueNotifier` 음소거 토글
5. **영수증 연출** — `Timer.periodic` + `TweenAnimationBuilder`로 항목 순차 등장과 소계 카운트업

게임에 점수와 소리가 붙으니 완성도가 확 달라졌다. 특히 "영수증이 한 줄씩 내려오면서 딩딩 거리는" 연출은 코드 양 대비 체감 효과가 가장 컸다. 게임을 만들고 있다면 점수 연출에 시간을 투자해볼 것을 추천한다. 숫자를 언제, 어떻게 보여주느냐가 재미의 절반이다.
