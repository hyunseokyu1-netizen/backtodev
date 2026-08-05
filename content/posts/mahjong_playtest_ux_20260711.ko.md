---
title: '멀티플레이 게임은 침묵이 버그다 — 플레이테스트에서 배운 대기 상태 UX'
date: '2026-07-11'
publish_date: '2026-08-06'
description: 폰 3대로 가족과 마작 게임을 플레이테스트하며 발견한 멀티플레이 특유의 UX 문제들 — 응답 제한시간의 이중 강제, 선택 중 상태 공유, 퇴장/복귀 알림을 Flutter로 해결한 기록
tags:
  - Flutter
  - 멀티플레이
  - UX
  - 게임개발
  - 플레이테스트
---

# 멀티플레이 게임은 침묵이 버그다

같은 Wi-Fi에서 폰 3대로 대전하는 마작 게임을 만들고, 드디어 가족과 실제 플레이테스트를 했다. 네트워크는 잘 붙었고 게임도 잘 돌아갔다. 그런데 10분 만에 불만이 터져 나왔다.

> "게임이 멈춘 거 아냐?"

멈춘 게 아니었다. **다른 사람이 "이 패를 가져갈까요?" 프롬프트를 보면서 고민 중**이었을 뿐이다. 하지만 나머지 사람들 화면에는 아무것도 없었다. 그냥 정적. 혼자 하는 게임에서는 존재할 수 없는 문제다 — 내가 고민 중이면 내가 고민 중인 걸 아니까.

이날 배운 것을 한 문장으로 요약하면 이렇다. **멀티플레이에서는 한 사람의 상태가 다른 모든 사람에게 "침묵"으로 보이는 순간이 전부 버그다.** 이 글은 그 침묵들을 하나씩 없앤 기록이다.

## 문제 1: 한 명의 고민이 전원의 정지가 되는 문제

마작에는 누가 패를 버리면 다른 사람이 그 패를 가져갈지 선택하는 순간이 있다. 이때 게임 진행이 그 사람의 응답을 기다리며 멈춘다. 필요한 건 두 가지였다.

### (1) 제한시간 — 그런데 누가 시간을 재는가?

15초 안에 응답하지 않으면 자동 패스. 간단해 보이지만 **타이머를 어디서 돌리느냐**가 설계 문제다.

처음 떠오르는 답은 "프롬프트 위젯에서". 실제로 카운트다운 UI는 그렇게 만들었다:

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

하지만 이것만으로는 부족하다. **응답해야 할 사람의 앱이 백그라운드로 가면 위젯 타이머도 같이 멈춘다.** 그러면 나머지 사람들은 영원히 기다린다. UI 타이머는 "예의"고, 강제력은 **권한을 가진 쪽(호스트)**에 있어야 한다.

그래서 호스트(게임 심판 역할을 하는 방장 폰)에도 독립적인 타이머를 뒀다:

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

**이중 강제(double enforcement)** 패턴이다. 클라이언트 타이머는 사용자 경험(카운트다운 표시, 즉각 반응)을, 호스트 타이머는 게임 무결성(절대 멈추지 않음)을 담당한다. 클라이언트가 먼저 패스를 보내면 호스트 타이머는 취소되고, 클라이언트가 죽어 있으면 호스트가 대신 패스시킨다. 둘 중 누가 먼저든 결과는 같으므로 충돌이 없다.

제한시간은 생성자 파라미터로 뺐다. 테스트에서 `claimTimeout: Duration(milliseconds: 200)`으로 주입하면, "클라이언트가 응답을 안 해도 게임이 끝까지 진행된다"를 몇 초 만에 자동 검증할 수 있다.

### (2) 기다리는 사람에게는 이유를 보여주기

제한시간이 있어도 15초는 길다. 기다리는 사람에게 **왜 멈췄는지**를 보여줘야 한다.

호스트는 이미 "아직 응답 안 한 좌석 목록"을 관리하고 있었다. 이걸 상태 브로드캐스트에 실어 보내기만 하면 된다. UI 쪽에서는 컨트롤러 인터페이스에 게터 하나를 추가하고:

```dart
/// 완성/뺏어오기 응답을 아직 고민 중인 좌석들 (0 = 나)
List<int> get claimWaitingSeats => const [];
```

내 프롬프트는 없는데 다른 좌석이 고민 중이면 배너를 띄운다:

```dart
if (gc.humanClaimOpportunity == null &&
    gc.claimWaitingSeats.any((seat) => seat != 0))
  // "🤔 엄마 고르는 중..." 배너 표시
```

이제 게임이 멈추면 화면 위에 "🤔 ○○ 고르는 중..."이 뜬다. 같은 15초인데 체감이 완전히 다르다. **대기 시간 자체보다 "설명 없는 대기"가 문제**라는 건 로딩 스피너의 오래된 교훈인데, 멀티플레이에서는 그 대상이 "다른 사람의 행동"이라는 점이 다르다.

## 문제 2: 나간 사람, 돌아온 사람을 아무도 모름

플레이 중 한 명이 앱을 껐다. 그 자리는 설계대로 AI가 이어받아서 게임은 잘 굴러갔는데... **아무도 그 사실을 모르고** "쟤 왜 이렇게 잘 두지?" 하는 상황이 나왔다. 자동 복구가 잘 될수록 오히려 상황 공유가 안 되는 역설이다.

이벤트 알림을 추가했다. 호스트가 이탈/복귀를 감지하는 지점에서 방 전체에 알림 메시지를 뿌리고:

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

UI 전달은 `ValueNotifier` 하나로 해결했다. 컨트롤러 기반 클래스에 `ValueNotifier<TableNotice?> notice`를 두고, 게임 화면이 구독해서 스낵바로 띄운다:

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

게임 상태(매 턴 갱신, `notifyListeners`)와 일회성 이벤트(가끔 발생, 스낵바)는 **전달 채널을 분리**하는 게 깔끔했다. 이벤트를 게임 상태에 섞으면 "이 알림을 이미 보여줬나?"를 추적하는 지저분한 코드가 생긴다.

## 문제 3: 정보 박스가 게임판을 가림

이건 순수 레이아웃 문제. "1판/8 · 남은 패 81장" 정보 박스를 테이블 정중앙에 뒀더니, 정작 **버린 패들이 쌓이는 자리를 가려버렸다**. 디자인할 때는 버림패가 없는 빈 테이블만 보고 예뻐서 중앙에 뒀는데, 실제 게임 중반이 되면 중앙이 제일 붐비는 자리였다.

박스를 화면 왼쪽 위 홈 버튼 아래의 작은 칩으로 옮겼다. 교훈은 단순하다: **레이아웃 검증은 빈 화면이 아니라 가장 붐비는 상태로 해야 한다.** 게임이라면 종반, 채팅이라면 긴 메시지, 표라면 최대 행.

## 정리: 플레이테스트가 알려준 것

시뮬레이터와 자동 테스트로는 절대 못 찾았을 문제들이다. 코드는 전부 "정상 동작"이었으니까. 문제는 전부 **사람 사이의 정보 격차**에 있었다.

| 침묵 | 해결 |
|---|---|
| 남이 고민 중 → 내 화면은 정지 | "🤔 ○○ 고르는 중..." 배너 + 15초 제한 |
| 응답자가 잠수 → 전원 무한 대기 | UI 타이머 + 호스트 강제 패스 (이중 강제) |
| 이탈/복귀 → 아무도 모름 | 방 전체 스낵바 알림 |
| 정보 박스가 게임판 가림 | 붐비는 상태 기준으로 재배치 |

멀티플레이 기능을 만들었다면, 기술 검증(연결되나? 동기화되나?)이 끝난 뒤에 반드시 **사람을 앉혀놓고** 테스트해 보길. "게임이 멈춘 거 아냐?"라는 한 마디가 어떤 로그보다 정확한 버그 리포트였다.
