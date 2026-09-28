---
title: '이미 배포한 앱의 공유 링크 도메인을 바꾸려면 — 하위 호환 파싱 설계기'
date: '2026-07-24'
publish_date: '2026-10-04'
description: 개인 GitHub 아이디가 노출되는 공유 링크 주소를 Cloudflare로 옮기면서, 이미 퍼진 옛날 링크를 깨뜨리지 않고 앱 3곳의 코드를 고친 과정과 실수
tags:
  - Flutter
  - Android
  - 딥링크
  - Cloudflare Pages
  - 앱 배포
---

## 링크 주소에 내 이름이 박혀 있었다

카세트 테이프 앱을 만들면서 "테이프를 링크 하나로 공유하기" 기능을 넣었다. 방식은 단순하다. 테이프에 담긴 유튜브 링크 목록을 URL 파라미터로 인코딩해서 웹페이지 하나를 만들고, 그 웹페이지가 "앱으로 열기" 버튼과 곡 목록 미리보기를 보여준다. 서버 없이 GitHub Pages에 정적 HTML 하나 올려서 끝냈다.

문제는 그 결과로 나온 주소였다.

```
https://hyunseokyu1-netizen.github.io/cassette-tape/?n=...&a=...
```

`hyunseokyu1-netizen`은 내 GitHub 아이디다. 카톡으로 테이프를 공유할 때마다 상대방이 URL만 봐도 내가 누구인지 알 수 있는 상태였다. 처음엔 대수롭지 않게 넘겼는데, 막상 여러 사람한테 링크를 뿌려보니 계속 신경이 쓰였다. 그래서 **개인 계정 흔적이 없는 무료 도메인으로 옮기기로** 했다.

여기서 "그냥 주소만 새로 만들어서 붙이면 되지 않나?" 싶었는데, 실제로 해보니 이미 배포된 앱에서는 그렇게 간단하지 않았다. 이 글은 그 과정에서 실제로 겪은 문제들 — 도메인이 3곳에 흩어져 있던 것, 실수로 잘못된 서비스에 배포했던 것, 이미 퍼진 옛날 링크를 살려두면서 새 링크로 전환하는 방법 — 을 정리한 기록이다.

## 왜 "주소만 바꾸기"가 아닌가

앱 하나에 공유 링크 도메인이 몇 군데 박혀 있는지 세어봤다.

| 위치 | 역할 |
|---|---|
| 링크 **생성** 코드 (Dart) | 테이프 공유 시 URL을 만드는 곳 |
| 링크 **파싱** 코드 (Dart) | 받은 텍스트에서 도메인+파라미터를 읽어내는 곳 |
| `AndroidManifest.xml`의 딥링크 `intent-filter` | 그 도메인의 링크를 눌렀을 때 앱을 선택지로 띄우는 설정 |

세 곳 다 안드로이드 앱 하나에 있는 도메인 문자열이다. 그런데 이 세 곳을 그냥 새 주소로 **바꿔치기**하면 안 된다. 이유는 하나다.

**이미 공유된 옛날 링크는 사용자 손에 영원히 남아 있다.**

카톡 대화방, 문자, 즐겨찾기에 박제된 링크는 앱을 업데이트해도 사라지지 않는다. 파싱 코드가 새 도메인만 알아듣게 바꿔버리면, 지난주에 친구가 보내준 링크는 다음 주부터 "테이프 코드를 찾지 못했어요" 에러를 뱉는다. 그래서 필요한 건 "바꾸기"가 아니라 **"추가하기"** 였다.

## Step 1. 링크 생성부터 — 신규 도메인 하나만 쓰게

생성 쪽은 간단하다. 상수 하나만 바꾸면 된다.

```dart
/// 신규 공유 도메인 (Cloudflare Pages). 링크 생성은 이 주소만 사용한다.
/// 옛 도메인(GitHub Pages) 링크도 parseShareLink에서 계속 파싱한다 (하위 호환).
const shareBaseUrl = 'https://repotape.pages.dev/';
```

새로 만드는 링크부터 새 도메인으로 나가게 하는 건 이 한 줄이면 끝이다. 진짜 작업은 다음 단계, 파싱 쪽이다.

## Step 2. 파싱은 여러 도메인을 동시에 받게

받은 텍스트에서 공유 링크인지 판별하는 정규식이 있었다. 원래는 도메인 하나만 매칭했다.

```dart
// 이전: 도메인 하나만 인식
final url = RegExp(
  r'https://hyunseokyu1-netizen\.github\.io/cassette-tape/?\?(\S+)',
).firstMatch(text)?.group(1);
```

이걸 OR로 늘렸다.

```dart
// 이후: 신규 도메인 + 구버전 도메인 + 딥링크 스킴을 한 정규식에서 전부 허용
final url = RegExp(
  r'(?:https://repotape\.pages\.dev/?|'
  r'https://hyunseokyu1-netizen\.github\.io/cassette-tape/?|'
  r'cassettetape://import/?)\?(\S+)',
).firstMatch(text)?.group(1);
```

핵심은 **생성은 하나, 파싱은 여러 개**라는 비대칭이다. 새로 만드는 링크는 항상 최신 도메인으로 나가지만, 받는 쪽은 과거에 어떤 버전의 앱이 만들었을지 모르는 링크까지 다 받아줘야 한다. 이 원칙을 세워두니 앞으로 도메인을 또 바꿀 일이 생겨도 파싱 목록에 한 줄 추가하는 걸로 끝난다는 확신이 들었다.

## Step 3. 안드로이드 딥링크에도 신구 도메인 둘 다

"공유된 웹페이지에서 앱으로 열기" 버튼을 누르면 실제로는 안드로이드가 `intent-filter`를 보고 어느 앱을 띄울지 정한다. `AndroidManifest.xml`에도 도메인이 박혀 있었다.

```xml
<!-- 신규 도메인 -->
<intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https"
          android:host="repotape.pages.dev"/>
</intent-filter>

<!-- 구버전 GitHub Pages 링크도 계속 앱으로 열리게 (하위 호환) -->
<intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https"
          android:host="hyunseokyu1-netizen.github.io"
          android:pathPrefix="/cassette-tape"/>
</intent-filter>
```

`intent-filter`는 정규식이 아니라서 OR 조건을 한 태그에 몰아넣을 수 없다. 도메인 개수만큼 `intent-filter`를 **통째로 복사**해야 한다. 번거롭지만 이게 안드로이드 방식이다.

## Step 4. 배포하다가 잘못된 서비스에 올라간 사건

Cloudflare Pages에 새 배포 폴더를 올리고 확인해보니, 나온 주소가 이랬다.

```
https://repotape.backdev.workers.dev/
```

원하던 `repotape.pages.dev`가 아니었다. Cloudflare 대시보드에서 프로젝트를 만드는 진입점이 기본적으로 **Workers 생성 화면**으로 유도돼서, 무심코 진행하면 Pages가 아니라 Workers 서비스가 만들어진다. (이 함정 자체는 따로 [Cloudflare Pages 배포 글](/ko/posts/cloudflare_pages_deploy_20260723)에 자세히 적어뒀다.)

문제는 **이미 이 잘못된 주소로 앱 코드를 한 번 고쳐서 커밋까지 했다는 것**이다.

```bash
# 확인 스크립트로 실제 배포 상태부터 점검
curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://repotape.backdev.workers.dev/"
# HTTP 200 — 이 주소도 실제로 응답은 한다. 그래서 헷갈렸다.
```

`workers.dev` 주소도 정상 작동은 했기 때문에 "이대로 써도 되는 거 아닌가" 싶었지만, 원래 목적(짧고 깔끔한 무료 주소)에는 맞지 않았다. 결국 Pages 쪽으로 다시 배포하고, 앱 코드도 두 번째로 고쳤다. 이때 배운 게 있다.

> **도메인 문자열을 코드 여러 곳에 그대로 박아두면, 나중에 "아, 이것도 고쳐야 했지"가 반복된다.**

이번엔 세 군데(생성 상수, 파싱 정규식, 매니페스트)뿐이라 그나마 견딜 만했지만, 값이 더 퍼져 있었다면 하나씩 놓쳤을 거다. 실제로 두 번째 수정 때는 `git grep`으로 이전 도메인 문자열을 전부 검색해서 빠진 곳이 없는지 확인하고 나서야 안심했다.

```bash
git grep -n "backdev.workers.dev\|hyunseokyu1-netizen"
```

## Step 5. 버전 올리고, 서명 키가 같은지 재확인

도메인만 고치고 끝이 아니다. 이미 스토어에 배포된 앱이라 **새 버전을 빌드해서 업로드**해야 실사용자에게 반영된다. `pubspec.yaml`의 버전을 올렸다.

```yaml
# 이전
version: 2.0.0+200
# 이후
version: 2.0.1+201
```

Flutter/Android에서 `버전이름+버전코드` 형식인데, 버전코드(`+` 뒤 숫자)는 스토어에 올라간 기존 값보다 반드시 커야 업데이트로 인식된다. 여기서 실수하기 쉬운 지점이 하나 더 있다. **릴리즈 서명 키가 기존 배포와 같은지 확인하는 것.**

안드로이드 앱은 첫 배포에 쓴 서명 키로 계속 서명해야 "업데이트"로 인정받는다. 다른 키로 서명하면 스토어가 아예 다른 앱으로 취급해서 업로드가 거부된다. 그래서 빌드하고 나서 서명 지문을 대조했다.

```bash
keytool -printcert -jarfile app-release_v2.0.1.aab | grep "SHA256:"
# SHA256: 31:2E:A1:CC:5C:56:AC:5F:CA:73:A0:B7:07:39:1F:6B:A7:BC:0B:A8:3F:38:8B:8B:D0:4A:E7:1A:EB:50:E1:6C

# 예전 버전 AAB와 비교
keytool -printcert -jarfile app-release_v1.1.0.aab | grep "SHA256:"
# 동일한 값이 나와야 안전
```

두 값이 한 글자도 틀리지 않고 같아야 한다. 다르면 업로드 단계에서 바로 거부되니, 빌드 직후에 이 대조를 습관처럼 하게 됐다.

## 트러블슈팅: 이미 심사 중인 버전이 있을 때

도메인을 바꾼 시점에 하필 이전 버전(v2.0.0)이 스토어 심사를 받는 중이었다. 이 상태에서 정리한 원칙은 이렇다.

- **심사 중인 버전은 여전히 옛날 GitHub Pages 링크를 만든다.** 그러니 GitHub Pages 배포를 지금 내리면 안 된다.
- 새 버전(v2.0.1, 새 도메인 반영)이 사용자에게 충분히 퍼진 뒤에야 옛 인프라를 정리할 수 있다.
- 즉 한동안 **두 개의 공유 페이지를 동시에 살려둬야** 한다.

정리하면 이런 순서였다.

1. 새 도메인(Cloudflare) 배포 + 앱 코드 하위 호환 파싱 반영 → v2.0.1로 커밋
2. v2.0.0 심사 결과를 기다림 (여전히 옛 도메인 링크를 생성하는 버전)
3. v2.0.1을 업데이트로 순차 배포
4. 사용자 대부분이 v2.0.1로 갱신된 뒤 → 그제서야 GitHub Pages 배포 삭제 검토

새 걸 만드는 것보다 **옛 것을 언제 지워도 안전한지 판단하는 게** 더 조심스러운 작업이었다.

## 정리

공유 가능한 링크를 앱에 심을 때 처음부터 세워뒀으면 좋았을 원칙을 이번에 뒤늦게 배웠다.

1. **도메인 문자열은 한 곳(상수)에서만 참조하게 만들 것.** 생성 로직이 여러 파일에 흩어져 있으면 나중에 놓치는 곳이 생긴다.
2. **생성은 항상 최신 하나, 파싱은 과거 전부.** 지금 만드는 링크는 최신 도메인으로 나가되, 받는 코드는 그동안 나온 모든 버전의 링크 형식을 계속 인식해야 한다.
3. **안드로이드 딥링크(intent-filter)는 도메인마다 별도 블록이 필요하다.** 정규식처럼 OR로 합칠 수 없다.
4. **빌드 후엔 서명 지문부터 대조.** 도메인 이슈와 무관해 보여도, 같은 배포 사이클에서 실수하면 업로드 자체가 막힌다.
5. **옛 인프라는 신버전이 충분히 퍼질 때까지 지우지 않는다.** 이미 뿌려진 링크는 앱 업데이트와 무관하게 계속 눌릴 수 있다.

결국 "도메인 하나 바꾸는 일"이 아니라 "이미 존재하는 이전 버전들과 공존하는 방법을 설계하는 일"이었다. 앱을 한 번이라도 스토어에 내보낸 뒤에는, 어떤 값 하나를 바꾸는 것도 "지금 이 값을 참조하고 있는 게 몇 버전 전 사용자까지인가"를 항상 같이 생각해야 한다는 걸 실감한 하루였다.
