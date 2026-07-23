---
title: '아이디/비밀번호가 없는 앱, Play 스토어 "로그인 세부정보"는 어떻게 쓰지? (GitHub Token 인증 앱 등록기)'
date: '2026-07-17'
publish_date: '2026-09-11'
description: Google Play 등록 시 로그인 세부정보(구 앱 액세스) 섹션을 GitHub Token 인증만 있는 앱 기준으로 작성한 실전 기록 — 심사용 데모 저장소와 Fine-grained Token 준비법 포함
tags:
  - Google Play
  - Play Console
  - GitHub
  - 앱 심사
  - Flutter
---

## 심사관은 내 앱에 로그인할 수 없다

Flutter로 만든 메모 앱 [RepoNote](https://github.com/hyunseokyu1-netizen/repo-note)를
Play 스토어에 등록하다가 **"로그인 세부정보"** (예전 이름: 앱 액세스) 섹션에서 잠시 멈췄다.

이 섹션의 취지는 간단하다. 앱에 잠긴 부분이 있으면 Google 심사관이 들어가 볼 수 있게
열쇠를 제출하라는 것. 문제는 안내 문구가 전부 **"사용자 이름과 비밀번호"** 기준으로
쓰여 있다는 점이다.

그런데 내 앱은 아이디/비밀번호 로그인이 아예 없다. **GitHub Personal Access Token 하나만
입력**하면 되는 구조다. 이런 앱은 뭘 제출해야 할까? 직접 해보면서 정리한 내용을 공유한다.

## "예 / 아니요"부터 헷갈린다

첫 질문은 이렇다.

> 앱에 제한된 부분이 있나요?

토큰 입력이 "로그인"인가? 잠깐 고민했지만 답은 명확하게 **"예"** 다. 선택지 설명에
"이메일 주소, 사용자 이름, Google 계정 로그인, SSO와 같은 **계정 로그인 세부정보**"가
포함되는데, 토큰 인증도 결국 계정 자격증명이다. 토큰을 넣기 전에는 앱의 모든 기능이
잠겨 있으니 "아니요"를 선택하면 안 된다.

여기서 "아니요"로 내면 어떻게 되냐면 — 심사관이 첫 화면(토큰 입력)에서 막혀서
**"앱을 검토할 수 없음"으로 거부**된다. 페이지 하단 경고문에도 나와 있다:

> 검토자는 계정을 만들거나, 기존 계정을 사용하거나, 무료 체험판을 사용하여 앱에
> 액세스할 수 없습니다. 또한 개발자에게 자세한 내용을 문의할 수도 없습니다.

즉, 심사관은 GitHub 계정을 직접 만들어 주지 않는다. **모든 것을 내가 미리 준비해서
떠먹여 줘야 한다.**

## 사전 준비: 심사용 데모 저장소 + 전용 토큰

내 개인 노트 저장소의 토큰을 심사팀에 제출할 수는 없다. 그래서 심사 전용 환경을
따로 만들었다. 처음엔 심사용 GitHub 계정을 새로 파야 하나 고민했는데, **Fine-grained
Token은 지정한 저장소에만 접근 가능**해서 기존 계정으로도 충분히 안전했다.

### Step 1. 데모 저장소 만들기

심사관이 볼 더미 데이터만 담긴 저장소를 하나 만든다.

```text
reponote-review-demo/
├── README.md
├── Today.md              # 체크리스트가 있는 샘플 노트
├── Reading notes.md
├── Ideas/App ideas.md
├── Projects/RepoNote improvements.md
└── Meetings/Weekly sync.md
```

포인트:

- **개인정보 없는 영어 더미 노트**로만 구성 (심사는 영어 기준)
- 폴더 몇 개를 넣어서 앱의 트리 탐색 기능까지 확인 가능하게
- Private 저장소로 만들면 "비공개 저장소 지원"도 함께 검증된다

### Step 2. 그 저장소만 열리는 Fine-grained Token 발급

GitHub → Settings → Developer settings → **Fine-grained personal access tokens**:

| 설정 | 값 | 이유 |
|---|---|---|
| Token name | `reponote-review` | 용도 식별 |
| Expiration | 1년 | 심사 + 업데이트 재심사 기간 동안 유효해야 함 |
| Repository access | **Only select repositories** → 데모 저장소만 | 개인 저장소 접근 원천 차단 |
| Contents | Read and write | 앱의 커밋 기능 검증용 |
| Metadata | Read-only | 자동 선택됨 |

이렇게 발급한 토큰은 유출돼도 더미 데이터 저장소 하나만 노출될 뿐이라
심사팀에 제출해도 부담이 없다.

> 참고: 토큰 만료일을 짧게 잡으면 안 된다. 앱 업데이트를 낼 때마다 Google이
> 이 정보로 재검토하기 때문에, 만료되면 업데이트 심사에서 막힌다.

## 로그인 세부정보 폼 작성

이제 Play Console로 돌아와서 "예" 선택 → **세부정보 추가**를 누르면 폼이 열린다.

![로그인 세부정보 입력 폼](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/playconsole_login_form_1784282739000.png)

각 필드는 이렇게 채웠다:

| 필드 | 입력한 값 |
|---|---|
| 이름 | `GitHub token login` |
| 사용자 이름/이메일 | (비움 — 앱에 아이디 입력란이 없으므로) |
| 비밀번호 | 발급한 `github_pat_...` 토큰 |
| 기타 정보 | 아래 단계별 안내문 |

아이디/비밀번호 구조가 아닌 앱을 위한 자리가 바로 **"앱 액세스에 필요한 기타 정보"**
텍스트 영역이다. 폼 설명에도 2단계 인증, QR 코드, 생체 인식처럼 아이디/비밀번호로
표현이 안 되는 케이스는 여기에 쓰라고 안내한다. 나는 토큰 인증 과정을 단계별로 적었다
(500자 제한이 있어서 압축이 필요했다):

```text
This app does not use username/password login. It authenticates with
a GitHub personal access token only.

1. Paste the token (in the password field above) into the
   "GitHub Token" field on the first screen.
2. Tap "Verify connection".
3. Select repository "reponote-review-demo" → branch "main" → tap
   "Use repository root (/) as Vault".
4. All features (browse, edit, auto-commit, sync, conflict handling)
   are now testable.
```

![기타 정보에 단계별 안내 작성](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/playconsole_login_instructions_1784282739000.png)

작성 팁:

- **반드시 영어로.** 폼 상단에 "정보는 영어로 제공해야 합니다"라고 명시되어 있다.
- 토큰 자체는 "비밀번호" 필드에 넣고, 안내문에서는 그 위치를 가리키기만 했다.
  긴 토큰 문자열이 안내문 500자를 잡아먹지 않게 하려는 목적도 있다.
- 하단의 **"이 선언의 로그인 세부정보는 ... 모든 기능과 콘텐츠에 대한 전체 액세스
  권한을 제공합니다"** 체크박스는 실제로 그런지 확인하고 체크한다. 데모 저장소
  토큰 하나로 앱의 모든 기능이 열리는지 직접 폰에서 검증해 보고 체크했다.

## 완료된 모습

추가하고 나면 목록에 이렇게 표시된다. "비밀번호, 안내" — 토큰과 단계별 안내가
등록됐다는 뜻이다.

![로그인 세부정보 등록 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/playconsole_login_done_1784282739000.png)

아래 토글(Google 및 신뢰할 수 있는 파트너 기기에서 테스트할 때 이 로그인 세부정보를
사용하도록 허용)은 켜두었다. 사전 테스트에서 피드백을 받을 수 있는 옵션이라 굳이
끌 이유가 없었다.

## 정리

| 단계 | 내용 |
|---|---|
| 판단 | 토큰 인증도 "계정 로그인 세부정보" → **"예"** 선택 |
| 준비 1 | 더미 노트만 담긴 심사용 데모 저장소 생성 |
| 준비 2 | 그 저장소에만 접근하는 Fine-grained Token 발급 (만료 1년) |
| 폼 작성 | 비밀번호 필드에 토큰, 기타 정보에 영어 단계별 안내 |
| 검증 | 제출 전 그 토큰만으로 앱 전 기능이 열리는지 직접 확인 |

핵심은 하나다. **심사관을 처음 쓰는 사용자라고 생각하고, 복붙 한 번과 탭 몇 번으로
앱의 끝까지 도달할 수 있게 만들어 주는 것.** 아이디/비밀번호가 없는 앱이라도
"기타 정보" 란을 활용하면 문제없이 통과할 수 있다.
