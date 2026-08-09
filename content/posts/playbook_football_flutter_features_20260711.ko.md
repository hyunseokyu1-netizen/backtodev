---
title: 'Flutter 보드게임 앱에 하루 만에 붙인 5가지 — 애니메이션, 다국어, 로컬 멀티플레이까지'
date: '2026-07-11'
publish_date: '2026-08-10'
description: Playbook Football Flutter 앱에 주사위 애니메이션, 한/영 다국어, 같은 Wi-Fi 멀티플레이, 앱 아이콘 생성까지 하루 동안 붙인 기능들의 구현 기록
tags:
  - Flutter
  - Dart
  - 소켓통신
  - 게임개발
  - l10n
---

보드게임 Playbook Football을 Flutter 앱으로 옮기는 사이드 프로젝트, 오늘은 유난히 진도가 많이 나간 날이었다. 아침에는 "주사위 굴리는 애니메이션이 있으면 좋겠다"로 시작했는데, 저녁에는 폰 두 대로 같은 Wi-Fi에서 친구와 대전하는 것까지 굴러갔다. 하루 동안 붙인 기능이 다섯 가지라, 각각 어떻게 구현했고 어디서 막혔는지 기록으로 남긴다.

오늘 추가한 것들:

1. 주사위 롤링 + 카드 대결 애니메이션 (켜고 끄는 설정 포함)
2. 한국어/영어 다국어 지원
3. 같은 Wi-Fi 로컬 멀티플레이 (TCP/UDP 소켓)
4. PIL 스크립트로 앱 아이콘/스플래시 생성
5. 자잘한 UX 개선 — 카드 정보 버튼, 추천 카드 라인

## 1. 주사위가 굴러야 보드게임이지

이 게임은 매 플레이마다 주사위 4개(공격 D10, 수비 D10, D12 두 개)를 굴려서 카드 차트를 짚는다. 처음 구현은 결과 숫자가 그냥 '띡' 하고 표시되는 방식이었는데, 아무래도 보드게임 감성이 안 살았다.

그래서 `AnimationController` 하나로 롤링 연출을 만들었다. 핵심 아이디어는 세 가지다.

**굴러가는 동안 눈이 빠르게 바뀐다.** 진짜 난수를 쓸 필요 없이, 애니메이션 진행도 `t`에서 의사 난수를 뽑으면 된다. setState마다 값이 바뀌면서 "돌돌돌" 구르는 느낌이 난다.

```dart
final shown = rolling
    ? 1 + (version * 7 + i * 5 + (t * 20).floor()) % sides
    : v;  // 멈추면 실제 결과값
```

**왼쪽부터 하나씩 멈춘다.** 주사위마다 멈추는 시점을 다르게 주면(`settleAt = 0.45 + i * 0.13`) 카지노처럼 순차적으로 착지한다. 멈추는 순간 살짝 커졌다 돌아오는 팝 효과를 넣으면 타격감이 생긴다.

**튀는 높이는 사인 함수 + 감쇠.** 테이블 위에서 통통 튀다가 잦아드는 건 `sin`의 절댓값에 감쇠 계수를 곱하면 끝이다. 그림자 blur를 튀는 높이에 연동하면 입체감이 확 산다.

```dart
final decay = rolling ? 1.0 - (t / settleAt).clamp(0.0, 1.0) : 0.0;
final bounce = rolling ? math.sin(t * 32 + i * 1.7).abs() * 9 * decay : 0.0;
```

여기에 플레이 판정 때 양쪽에서 카드가 날아 들어와 "VS"로 맞붙는 오버레이(`CardFlyby`)도 추가했다. `Curves.easeOutBack`으로 슬라이드 인하면 카드가 살짝 오버슈팅하며 들어와서 느낌이 좋다. 탭하면 즉시 스킵된다.

그리고 중요한 것 하나 — **연출은 끌 수 있어야 한다.** 빠른 진행을 원하는 사람에게 1.3초짜리 주사위 연출은 고문이다. 메인 화면에 스위치를 하나 두고 `shared_preferences`로 저장했다. 끄면 `_ctrl.value = 1.0`으로 애니메이션 마지막 프레임(=결과)을 바로 보여준다.

## 2. 다국어 지원 — 패키지 없이 직접 구현한 이유

언어 선택(한국어/영어)을 넣기로 했다. Flutter의 정석은 `flutter_localizations` + ARB 파일이지만, 이 프로젝트는 사정이 좀 달랐다. **게임 엔진(순수 Dart)이 로그 문자열을 직접 생성한다**는 점이다. "3야드 전진!", "인터셉트!" 같은 판정 로그가 UI가 아니라 엔진에서 나오는데, ARB 방식은 `BuildContext`가 필요해서 엔진에서 쓰기 불편하다.

그래서 추상 클래스 + 전역 인스턴스라는 단순한 구조로 갔다.

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

메서드로 만들었기 때문에 언어별 문법 차이도 흡수된다. 영어의 서수 표기("2nd & 11")처럼 단순 치환으로 안 되는 부분을 각 구현체 안에서 처리하면 된다.

### 다국어화가 잡아낸 숨은 버그

작업 중 예상 못 한 수확이 있었다. 기존 효과음 코드가 이렇게 되어 있었다.

```dart
// Before: 로그 텍스트를 검사해서 효과음 결정 (한국어에 결합!)
if (text.contains('터치다운') || text.contains('필드골 성공')) {
  sfx.score();
}
```

영어 모드에선 '터치다운'이라는 문자열이 없으니 효과음이 전부 침묵할 뻔했다. 엔진이 판정 시 `SfxEvent`(score/penalty/turnover/kick)를 직접 기록하도록 리팩토링했다.

```dart
// After: 엔진이 의미 있는 이벤트를 기록, UI는 언어 무관하게 소비
enum SfxEvent { score, penalty, turnover, kick }

// 엔진 내부
r.sfx.add(SfxEvent.score);

// UI
if (r.sfx.contains(SfxEvent.score)) sfx.score();
```

**표시용 문자열에 로직을 걸면 안 된다**는 교훈을 실감했다. 다국어화는 이런 결합을 강제로 드러내 준다.

검증도 재미있게 했다. 영어 모드로 게임 한 판을 통째로 시뮬레이션한 뒤, 로그에 한글이 한 글자라도 있으면 실패하는 테스트를 넣었다.

```dart
final koreanLines = e.gameLog.where((l) => RegExp(r'[가-힣]').hasMatch(l));
expect(koreanLines, isEmpty, reason: koreanLines.join('\n'));
```

## 3. 같은 Wi-Fi 멀티플레이 — 서버 없이 소켓만으로

오늘의 하이라이트. "친구와 네트워크로 하고 싶어"라는 요구를 서버 비용 0원으로 해결하는 방법이 로컬 네트워크 대전이다. 같은 공유기에 물린 두 폰이 직접 TCP로 통신한다.

### 아키텍처: 호스트가 심판이다

멀티플레이 설계에서 제일 먼저 정할 것은 **누가 판정 권한을 갖느냐**다. 나는 호스트 권한(host-authoritative) 구조를 골랐다.

- **호스트**(방 만든 쪽): 게임 엔진을 실제로 돌린다. 주사위도 호스트만 굴린다
- **게스트**(참가자): 카드 선택만 보내고, 호스트가 브로드캐스트하는 전체 상태를 받아 그린다

이러면 상태 불일치가 원천적으로 없다. 두 기기가 각자 주사위를 굴리는 P2P 방식은 동기화 지옥이 열린다.

UI 입장에서는 싱글이든 멀티든 똑같아 보이도록 인터페이스를 하나 뒀다.

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

게임 화면은 `MpSession`만 알면 되니, 호스트와 게스트가 같은 화면 코드를 쓴다.

### 전송: 줄바꿈 구분 JSON

프로토콜은 소박하게 갔다. TCP 스트림에 JSON 한 줄씩(`jsonEncode(msg) + '\n'`) 흘리고, 받는 쪽은 `LineSplitter`로 자른다.

```dart
_guestSub = sock
    .cast<List<int>>()          // 이거 없으면 타입 에러!
    .transform(utf8.decoder)
    .transform(const LineSplitter())
    .listen(_onGuestLine);
```

여기서 한 번 막혔다. `Socket`을 바로 `utf8.decoder`에 넘기면 `Utf8Decoder can't be assigned to StreamTransformer<Uint8List, dynamic>` 에러가 난다. `Socket`은 `Stream<Uint8List>`인데 디코더는 `Stream<List<int>>`를 기대하기 때문. `.cast<List<int>>()` 한 줄이면 해결된다.

TCP는 스트림이라 메시지 경계가 없다. 게임처럼 메시지 빈도가 낮은 경우 줄바꿈 구분 JSON이 구현 대비 효율이 가장 좋다고 생각한다. 디버깅할 때 사람이 그냥 읽을 수 있다는 것도 크다.

### 방 검색: UDP 브로드캐스트

친구에게 "IP 주소 불러줘"라고 하는 건 UX 최악이다. 그래서 UDP 브로드캐스트로 자동 검색을 붙였다.

1. 호스트: UDP 47845 포트에서 대기, `pf_discover_v1` 프로브를 받으면 자기 정보(JSON)로 응답
2. 게스트: `255.255.255.255`로 1초마다 프로브 송출, 응답 오는 호스트를 목록에 추가

```dart
// 게스트 쪽 프로브
_sock!.broadcastEnabled = true;
_sock!.send(utf8.encode(kDiscoverProbe),
    InternetAddress('255.255.255.255'), kDiscoveryPort);
```

단, 일부 공유기(특히 공용 Wi-Fi)는 브로드캐스트를 차단한다. 그래서 **수동 IP 입력을 반드시 폴백으로** 남겼다. 호스트 대기 화면에 자기 IP를 표시해 주면, 자동 검색이 안 될 때 그 숫자를 입력해서 연결할 수 있다.

Android에서는 매니페스트 권한도 필요하다.

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE"/>
```

### 테스트: 루프백으로 실제 연결을 검증

네트워크 코드도 단위 테스트가 된다. `127.0.0.1`로 호스트와 게스트를 한 프로세스 안에서 실제로 연결하면 된다.

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

모킹 없이 진짜 소켓으로 왕복하니 직렬화 버그까지 같이 잡힌다.

## 4. 앱 아이콘, 디자이너 없이 코드로

앱 아이콘이 필요했는데 디자인 툴 대신 Python PIL로 그렸다. 코드로 그리면 수정 요청("화살표 좀 더 굵게")에 파라미터 하나로 대응할 수 있어서, 오히려 이쪽이 빠르다.

포인트 두 가지만 남기면:

- **4배 슈퍼샘플링**: 4096px로 그린 뒤 `LANCZOS`로 1024px로 축소하면 PIL의 계단 현상이 사라진다. PIL에는 안티앨리어싱 드로잉이 없어서 이게 사실상 필수
- **베지어 곡선 직접 계산**: PIL에 곡선 API가 없으니 2차 베지어 공식을 loop로 샘플링해 `line`으로 이었다. 플레이북 특유의 러닝 루트 화살표를 이걸로 그렸다

```python
def bezier(p0, c, p1, t):
    x = (1-t)**2 * p0[0] + 2*(1-t)*t * c[0] + t**2 * p1[0]
    y = (1-t)**2 * p0[1] + 2*(1-t)*t * c[1] + t**2 * p1[1]
    return (x * L, y * L)
```

생성한 1024px PNG 한 장을 `flutter_launcher_icons`에 넘기면 Android/iOS/웹용 아이콘이, `flutter_native_splash`에 넘기면 스플래시가 전부 자동 생성된다.

```bash
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

## 5. 작지만 체감 큰 UX 디테일

실기기로 플레이하다 보면 코드만 봐서는 안 보이는 불편이 나온다. 오늘 고친 것 둘.

**선택한 카드가 안 보이는 문제.** 화면에는 상황별 추천 카드 3장이 나오는데, "전체 플레이북"에서 추천 밖의 카드를 고르면 선택 표시가 어디에도 안 보였다. 추천 3장의 마지막 자리를 선택한 카드로 치환하는 것으로 해결.

```dart
final sel = selectedDefense;
if (sel != null && !ids.contains(sel)) {
  ids = [...ids.sublist(0, 2), sel];  // 마지막 자리를 선택 카드로
}
```

**실행 전 카드 정보 버튼.** 카드를 선택한 상태에서 확정 버튼 옆 📖 아이콘을 누르면 그 카드의 차트/보정치를 볼 수 있게 했다. "이 카드 내면 어떻게 되지?"를 실행 전에 확인하고 비교할 수 있으니, 전략을 공부하는 사람에게 특히 유용하다.

## 트러블슈팅 요약

| 증상 | 원인 | 해결 |
|---|---|---|
| `Utf8Decoder can't be assigned...` | Socket은 `Stream<Uint8List>` | `.cast<List<int>>()` 후 transform |
| 위젯 테스트가 갑자기 실패 | 새 전체 화면 오버레이가 탭을 가로챔 | 테스트에서 오버레이 먼저 탭해 스킵 |
| 영어 모드에서 효과음 침묵 (예방) | 한국어 로그 텍스트 매칭으로 사운드 결정 | 엔진이 `SfxEvent` enum을 직접 기록 |
| `flutter install`이 옛날 빌드를 설치 | install은 빌드를 안 함 | `flutter build apk --release` 후 install |
| 방 자동 검색 실패 (일부 공유기) | UDP 브로드캐스트 차단 | 수동 IP 입력 폴백 제공 |

특히 네 번째는 실제로 당했다. `flutter install`은 **기존 APK를 그대로 설치**할 뿐 재빌드하지 않는다. 새 기능이 폰에 안 보이면 십중팔구 이것이다.

## 정리

하루치 작업의 핵심 흐름:

1. **연출은 수학으로** — sin 감쇠 + 순차 settle로 주사위 롤링, 켜고 끄는 설정은 기본
2. **다국어는 결합을 드러낸다** — 로그 텍스트에 걸린 사운드 로직을 enum 이벤트로 분리
3. **멀티플레이는 권한 설계가 절반** — 호스트가 유일한 심판, 게스트는 입력만. 인터페이스로 싱글/멀티 화면 통합
4. **전송은 단순하게** — 줄바꿈 구분 JSON + UDP 브로드캐스트 검색 + 수동 IP 폴백
5. **아이콘도 코드로** — PIL 슈퍼샘플링 + 베지어, 수정이 파라미터 하나

실기기 3대(갤럭시 2대, LG 1대)에 설치해서 실제로 두 대를 맞붙여 보는 것까지 확인했다. 서버 한 줄 없이 거실에서 멀티플레이가 돌아가는 걸 보면 소켓 프로그래밍의 보람이 꽤 크다. 다음에는 인터넷 너머 대전(릴레이 서버)이나 관전 모드를 고민해 볼 생각이다.
