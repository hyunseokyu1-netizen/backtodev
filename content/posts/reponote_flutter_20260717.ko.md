---
title: 'Obsidian 모바일 Git 동기화가 너무 힘들어서, 메모 앱을 직접 만들었다 (RepoNote 개발기)'
date: '2026-07-17'
description: Obsidian 모바일에서 Git 연결이 복잡하고 충돌 해결이 어려워, GitHub 저장소와 자동 동기화되는 Flutter 메모 앱을 직접 만든 과정 — React Native로 먼저 만들었다 갈아엎은 이야기까지
tags:
  - Flutter
  - GitHub API
  - Obsidian
  - React Native
  - Riverpod
---

## 왜 만들었나: Obsidian 모바일 + Git의 고통

나는 메모를 Obsidian으로 쓰고, Vault 전체를 GitHub 저장소에 올려서 백업한다.
PC에서는 이 조합이 완벽하다. 문제는 **모바일**이다.

폰에서 Obsidian과 Git을 연결하려면 커뮤니티 플러그인을 깔고, 토큰을 넣고,
저장소를 클론하고... 설정 과정부터가 만만치 않다. 그런데 진짜 고통은 그다음이다.

**충돌(conflict)이 나는 순간 지옥이 시작된다.**

PC에서 수정한 노트를 폰에서도 수정하면 어김없이 충돌이 나는데,
그 작은 화면에서 `<<<<<<< HEAD` 마커를 보며 병합하는 건 정말 할 짓이 아니었다.
몇 번 겪고 나니 폰에서는 메모를 안 쓰게 되더라. 메모 앱인데 메모를 안 쓰게 만들면 그게 무슨 의미인가.

그래서 결론을 내렸다.

> 폰에서는 Git이 필요 없다. 그냥 **열고, 쓰고, 닫으면 알아서 GitHub에 커밋되는 앱**이면 된다.

그렇게 만든 게 **RepoNote**다. 소스는 [GitHub에 공개](https://github.com/hyunseokyu1-netizen/repo-note)해 뒀다.

![파일 트리 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/reponote_files_1784275718000.png)

## 핵심 아이디어: Git CLI 없이 Contents API로

이 앱은 폰에 저장소를 클론하지 않는다. Git CLI도, SSH 키도 없다.
대신 **GitHub REST API(Contents API)** 만 사용한다.

| 동작 | 방법 |
|---|---|
| 파일 목록 | `GET /repos/{owner}/{repo}/contents/{path}` |
| 파일 읽기 | 같은 엔드포인트 (Base64 본문 + SHA) |
| 저장 = 커밋 | `PUT /repos/.../contents/{path}` (message, content, sha) |
| 삭제 | `DELETE /repos/.../contents/{path}` |

파일 하나 저장할 때마다 커밋 하나가 생기는 구조다. Git의 모든 기능이 필요한 게 아니라
"내 노트가 저장소에 반영되는 것"만 필요하다면 이걸로 충분하다.

충돌 감지도 단순하다. 파일을 읽을 때 받은 `SHA`를 기억해 뒀다가,
업로드 직전에 서버의 현재 SHA와 비교한다. 다르면 누군가(대부분 PC의 나) 먼저 수정한 것이니
덮어쓰지 않고 충돌 화면을 띄운다. 사용자는 세 가지 중에 고르면 된다:

1. 서버 버전 사용
2. 내 버전으로 덮어쓰기
3. 두 버전을 별도 파일로 보존

`<<<<<<< HEAD`를 폰에서 볼 일이 없어졌다.

## 첫 시도는 React Native였다 — 그리고 갈아엎었다

사실 이 앱, 처음에는 **React Native로 만들었다.**

작업지시서(스펙 문서)를 먼저 꼼꼼하게 써두고 그대로 개발을 시작했는데,
결과물이 계속 말썽이었다. 화면 전환에서 상태가 꼬이고, 네이티브 모듈 버전 충돌이 나고,
빌드가 어제는 되다가 오늘은 안 되고... 기능 코드보다 에러 잡는 시간이 더 길었다.

그래서 과감하게 버리고 **같은 작업지시서로 Flutter에서 처음부터 다시** 만들었다.

이 경험에서 얻은 교훈이 하나 있다.

> **작업지시서를 잘 써두면 프레임워크를 갈아타도 손해가 크지 않다.**

스펙 문서에는 화면 구성, 데이터 모델, 동기화 정책, 충돌 규칙까지 다 적혀 있었다.
프레임워크가 바뀌어도 "무엇을 만들지"는 그대로라서, Flutter 버전은 훨씬 빠르게 완성됐다.
같은 문서로 두 번 만들어 보니 두 프레임워크의 차이도 몸으로 느껴졌는데,
적어도 이 프로젝트에서는 Flutter 쪽이 빌드 안정성과 개발 속도 모두 나았다.

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Flutter (Material 3) | RN 대비 빌드가 안정적, 단일 코드베이스 |
| 상태 관리 | flutter_riverpod | Provider 오버라이드로 테스트·데모 모드가 쉬움 |
| 라우팅 | go_router | 선언적 라우트, 딥링크 대응 |
| 네트워크 | dio | Interceptor로 인증 헤더·Rate Limit 공통 처리 |
| 토큰 저장 | flutter_secure_storage | 토큰은 Keystore에만, DB·로그 금지 |
| 로컬 DB | drift (SQLite) | 타입 안전 쿼리, 마이그레이션 관리 |

구조는 Feature-first + Repository 패턴으로 잡았다. 핵심 규칙은 하나다:
**UI는 절대 Dio나 DB를 직접 만지지 않는다.** 화면 → Repository → API/DB 순서로만 흐른다.

## 데이터 유실 방지: 로컬 저장이 항상 먼저

메모 앱에서 제일 무서운 건 "쓴 글이 사라지는 것"이다. 그래서 순서를 강제했다.

```text
입력 → (600ms debounce) → 로컬 DB에 초안 저장 → (5초 후) → GitHub 커밋
```

네트워크가 끊겨도, 앱이 강제 종료돼도, GitHub API가 실패해도 로컬 초안은 남는다.
오프라인에서 쓴 메모는 `pendingUpload` 상태로 큐에 쌓였다가 연결이 돌아오면 자동 업로드된다.

![편집 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/reponote_editor_1784275718000.png)

편집 화면 상단에는 저장 상태(저장됨 / 동기화 대기 / 동기화 중 / 오프라인 / 충돌)가 항상 표시된다.
마크다운 미리보기도 지원해서 체크리스트가 그대로 렌더링된다.

![미리보기 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/reponote_preview_1784275718000.png)

## 삽질 기록: 새 토큰이 계속 401 나던 버그

개발하면서 만난 버그 중 하나는 공유할 가치가 있다.

테스트하려고 GitHub에서 토큰을 폐기(revoke)한 뒤 새 토큰을 등록하는데,
**분명히 올바른 새 토큰인데 계속 "Token이 올바르지 않습니다"** 가 떴다.

원인은 Dio Interceptor였다. 모든 요청에 저장된 토큰을 자동으로 붙이도록 해뒀는데,
"새 토큰 검증" 요청까지 저장돼 있던 **옛 토큰으로 덮어쓰고** 있었다.

```dart
// Before: 무조건 덮어씀 — 새 토큰 검증도 옛 토큰으로 나감
onRequest: (options, handler) async {
  final token = await tokenProvider();
  options.headers['Authorization'] = 'Bearer $token';
  handler.next(options);
}

// After: 이미 Authorization이 지정된 요청은 건드리지 않음
onRequest: (options, handler) async {
  if (!options.headers.containsKey('Authorization')) {
    final token = await tokenProvider();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
  }
  handler.next(options);
}
```

첫 등록 때는 저장된 토큰이 없어서 멀쩡히 동작하다가, **토큰을 교체할 때만** 터지는 버그라
한참을 헤맸다. 인증 헤더를 Interceptor에서 공통 처리한다면, 헤더를 직접 지정하는
예외 경로가 있는지 꼭 확인하자. 고친 뒤에는 회귀 테스트도 추가했다.

## 스토어 준비: 스크린샷용 데모 모드

스토어 스크린샷을 찍는데 실제 계정으로 찍으면 개인 노트가 노출된다.
그래서 **가짜 GitHub API를 주입하는 스크린샷 전용 엔트리포인트**를 따로 만들었다.

```bash
flutter build apk --release \
  -t lib/screenshots/main_screenshots.dart \
  --dart-define=SCREENSHOT_LOCALE=en
```

Riverpod의 Provider 오버라이드 덕분에 API 클라이언트만 가짜로 갈아끼우면
앱 전체가 데모 데이터로 돌아간다. 한국어/영어 스크린샷을 dart-define 하나로 전환할 수 있어서
스토어 등록 이미지 12장을 금방 뽑았다.

![설정 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/reponote_settings_1784275718000.png)

## 정리

| 단계 | 내용 |
|---|---|
| 문제 | Obsidian 모바일 Git 연결이 복잡하고 충돌 해결이 고통 |
| 해결 | Git 없이 GitHub Contents API로 자동 커밋되는 메모 앱 |
| 1차 시도 | React Native — 에러가 많아 중단 |
| 2차 시도 | 같은 작업지시서로 Flutter 재개발 — 완성 |
| 핵심 설계 | 로컬 저장 우선, SHA 기반 충돌 감지, UI/API 계층 분리 |
| 결과 | Android 실기기 동작, 한/영 지원, 테스트 29개, 스토어 등록 준비 완료 |

Obsidian을 쓰든 안 쓰든, "GitHub 저장소에 마크다운으로 메모를 모으고 싶다"면
이 방식(Contents API + SHA 충돌 감지)은 생각보다 구현이 간단하니 직접 만들어 보는 것도 추천한다.
전체 소스는 [repo-note 저장소](https://github.com/hyunseokyu1-netizen/repo-note)에 있다.
