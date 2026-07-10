---
title: 'AI 코딩 어시스턴트와 SaaS 만들기 ⑪: "Confirm your signup"은 너무 심심하다 — 브랜드 이메일과 Resend SMTP'
date: '2026-07-05'
publish_date: '2026-08-10'
description: table 레이아웃과 인라인 스타일로 돌아간 이메일 HTML 2종, dig로 발견한 뜻밖의 Mailgun MX 레코드, 발송 전용 restricted key의 401 소동 — Supabase 기본 인증 메일을 브랜드 메일로 바꾸고 Resend SMTP를 연결한 설정 협업기
tags:
  - Resend
  - Supabase
  - 이메일
  - DNS
  - AI 코딩 어시스턴트
---

## 시작하며

10편에서 비밀번호 찾기 플로우를 만들고 실제로 메일을 받아본 순간, 다른 종류의 문제가 눈에 들어왔다. 도착한 메일이 이랬다.

- 제목: **"Confirm your signup"** — 한국어 서비스에 영어 제목
- 본문: 스타일 없는 링크 한 줄
- 발신자: **noreply@mail.app.supabase.io** — 우리 도메인이 아니다
- 그리고 결정적으로, Supabase 기본 SMTP는 **시간당 발송 2~4건 제한** — 하루에 사용자 몇 명만 가입해도 메일이 안 나간다

앞의 셋은 브랜딩 문제지만 마지막은 서비스 장애급이다. 회원가입이 이메일 인증 필수인 서비스에서 인증 메일이 안 나가면 가입 자체가 막힌다. 이번 편은 이 문제를 두 층으로 나눠 해결한 기록이다 — **템플릿**(커밋 `58121ce`, `c74b78a`)과 **발송 인프라**(Resend SMTP 연결). 후자는 코드가 아니라 대시보드와 DNS의 세계라서, AI 어시스턴트와의 협업이 지금까지와는 다른 모양이 됐다.

## Step 1. 브랜드 이메일 템플릿 2종 (`58121ce`, `c74b78a`)

### 이메일 HTML은 2005년의 웹이다

가입 확인 메일과 비밀번호 재설정 메일, 두 템플릿을 만들었다. 그런데 이메일 HTML은 우리가 아는 웹이 아니다. Gmail·Outlook·네이버 메일의 렌더러는 각자 멋대로 CSS를 잘라내기 때문에, 살아남는 기법이 정해져 있다.

- **레이아웃은 `<table>`** — flexbox도 grid도 못 믿는다. `role="presentation"`을 붙인 중첩 테이블이 정석
- **스타일은 전부 인라인** — `<style>` 블록은 클라이언트에 따라 통째로 제거된다
- **웹폰트 불가** — 시스템 한글 폰트 스택으로 대체

```html
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="background-color:#F4F6F8;padding:40px 16px;
         font-family:'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',Helvetica,Arial,sans-serif;">
```

폰트 스택 순서에도 이유가 있다. macOS/iOS는 Apple SD Gothic Neo, Windows는 Malgun Gothic(맑은 고딕)을 잡고, 그 외 환경은 Segoe UI → Helvetica로 떨어진다. 한글 메일에서 폰트 스택을 영문 폰트로 시작하면 한글만 시스템 기본 명조로 렌더링되는 참사가 나기 때문에, 한글 폰트를 앞에 뒀다.

### 가입 확인 메일 — 인증 버튼에 온보딩을 끼워 팔기

가입 확인 템플릿의 구조는 그린(#046C4E) 헤더 + 로고, 본문, CTA 버튼, 그리고 팁 박스다. Supabase가 치환해주는 `{{ .ConfirmationURL }}` 변수를 버튼과 폴백 링크 두 곳에 넣었다.

```html
<a href="{{ .ConfirmationURL }}" target="_blank"
   style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;
          color:#ffffff;text-decoration:none;border-radius:10px;">
  이메일 인증하기
</a>
```

이 메일에서 제일 마음에 드는 부분은 CTA 아래의 팁 박스다.

```html
<td style="background-color:#ECFDF3;border:1px solid #CEEBDC;border-radius:10px;padding:14px 16px;">
  <p style="margin:0;font-size:12.5px;line-height:1.6;color:#046C4E;">
    💡 가입 후 <b>이력서 파일(PDF·DOCX)만 올리면</b> AI가 자동 분석해
    1분 안에 영어 이력서를 만들어드립니다.
  </p>
</td>
```

가입 확인 메일은 **열람률이 거의 100%인 유일한 메일**이다. 인증 버튼만 누르게 하고 끝내기엔 아깝다. "인증하고 나서 뭘 하면 되는지"를 한 줄 심어두면, 메일이 온보딩의 첫 페이지가 된다. 3편에서 만든 이력서 자동 분석 기능이 이 서비스의 "1분 안에 아하 모먼트"라서, 그걸 그대로 실었다.

### 재설정 메일 — 같은 뼈대, 다른 톤

비밀번호 재설정 템플릿은 가입 확인과 같은 뼈대를 복제하되, 팁 박스 자리에 **주황 보안 안내 박스**가 들어간다.

```html
<td style="background-color:#FEF3E2;border:1px solid #F5DDB8;border-radius:10px;padding:14px 16px;">
  <p style="margin:0;font-size:12.5px;line-height:1.6;color:#B45309;">
    🔒 이 링크는 보안을 위해 <b>일정 시간 후 만료</b>됩니다.
    본인이 요청하지 않았다면 이 메일을 무시하세요 — 비밀번호는 변경되지 않습니다.
  </p>
</td>
```

재설정 메일의 필수 문구 두 가지 — 링크가 만료된다는 것, 그리고 **본인이 요청하지 않았다면 무시해도 안전하다는 것**. 후자가 특히 중요하다. 누군가 내 이메일로 재설정을 요청하면 나한테 메일이 오는데, 이때 "무시하면 비밀번호는 변경되지 않는다"는 안내가 없으면 사용자는 계정이 털린 줄 알고 패닉한다. 같은 초록 박스를 쓰지 않고 주황으로 바꾼 것도 의도다 — 가입 메일의 박스는 "해보세요"(제안)고, 재설정 메일의 박스는 "주의하세요"(경고)니까.

### 검증: sed로 변수 치환 후 Playwright 스크린샷

이메일 템플릿은 브라우저에서 열면 `{{ .ConfirmationURL }}`이 그냥 텍스트로 보여서 실제 모습을 알기 어렵다. AI 어시스턴트는 sed로 변수를 더미 URL로 치환한 사본을 만들어 Playwright로 스크린샷을 찍었다.

```bash
sed 's|{{ .ConfirmationURL }}|https://matchda.com/auth/callback?code=DUMMY|g' \
  docs/email-templates/confirm-signup.html > /tmp/preview.html
# → Playwright로 열어 데스크톱 폭 스크린샷 확인
```

렌더링을 눈으로 확인하고 나서야 커밋했다. 이메일 HTML은 "코드가 맞아 보인다"와 "실제로 그렇게 보인다"의 간극이 웹보다 훨씬 크다.

### 코드가 아닌데 왜 git에 넣었나

이 템플릿들은 앱이 import하는 코드가 아니다. Supabase 대시보드의 Auth → Email Templates에 **사람이 복사해 붙여넣는** 자산이다. 그런데도 `docs/email-templates/`에 커밋한 이유는 명확하다 — 대시보드에 붙여넣는 순간 그 HTML의 원본은 대시보드에만 존재하게 되고, 다음에 문구 하나 고치려면 대시보드에서 꺼내와야 한다. 버전 관리 밖의 자산은 반드시 유실된다. 리포에 원본을 두고 대시보드를 "배포 대상"으로 취급하면, 수정 이력도 남고 리뷰도 된다. 9편의 약관 문서와 같은 원칙이다: 사람이 관리하는 자산일수록 git 안에 있어야 한다.

## Step 2. Resend SMTP 연결 — 설정 협업기

템플릿을 아무리 예쁘게 만들어도 시간당 2~4건 제한과 supabase.io 발신자는 그대로다. 커스텀 SMTP가 필요했고, CLAUDE.md에 처음부터 "이메일: Resend"라고 적혀 있었으니 Resend로 가면 된다. …라고 생각했는데, 여기서부터 발견의 연속이었다.

### 발견 1: RESEND_API_KEY가 빈 값

AI 어시스턴트가 연결 상태부터 점검했는데, `.env.local`의 `RESEND_API_KEY`가 **빈 문자열**이었다. CLAUDE.md에는 몇 달 전부터 "이메일: Resend"라고 적혀 있었지만, 실제로는 한 번도 연결된 적이 없었던 것이다. 이메일 다이제스트 기능이 우선순위에서 밀리면서 스택 문서에만 존재하는 유령 의존성이 돼 있었다.

문서와 현실의 괴리는 이렇게 조용히 쌓인다. 9편에서 개인정보 처리방침에 위탁 업체로 Resend를 떡하니 적어놓고는, 정작 Resend 계정 연동은 안 돼 있었다니. "문서가 곧 현실인지"는 주기적으로 실물(환경변수, API 응답)로 검증해야 한다.

### 발견 2: dig가 알려준 뜻밖의 동거인

Resend에 도메인을 붙이려면 DNS 레코드를 만져야 한다. 그 전에 현재 상태부터 — AI 어시스턴트가 dig로 matchda.com의 DNS를 조사했다.

```bash
$ dig NS matchda.com +short
ns51.domaincontrol.com.        # GoDaddy 네임서버
ns52.domaincontrol.com.

$ dig MX matchda.com +short
10 mxa.mailgun.org.            # ...Mailgun?
10 mxb.mailgun.org.
```

네임서버는 GoDaddy — 예상대로. 그런데 MX 레코드가 **Mailgun**을 가리키고 있었다. 언젠가 수신 메일함(support@ 같은)을 만들려고 Mailgun을 붙여둔 흔적이다. 나도 잊고 있었다.

여기서 잠깐 판단이 필요했다. Resend를 붙이면 Mailgun과 충돌하나? 결론은 **공존 가능**. MX 레코드는 "이 도메인으로 오는 메일을 누가 받느냐"(수신)를 정하고, Resend는 발신 인증용으로 `send.matchda.com` **서브도메인**에 자기 레코드(SPF/DKIM)를 만든다. 루트 도메인의 수신은 Mailgun, 서브도메인의 발신은 Resend — 서로 건드리는 레코드가 다르다. DNS를 만지기 전에 dig 한 번으로 현재 상태를 찍어두는 습관이 "설정하다 기존 메일 수신이 끊겼다" 같은 2차 사고를 막는다.

### 발견 3: 401이 나는데 발송은 되는 키

GoDaddy DNS에 레코드를 추가하고 Resend 대시보드에서 도메인 인증을 마친 뒤(이 부분은 사람 몫 — 뒤에서 다시), 발급받은 API 키를 검증하는데 이상한 일이 생겼다.

```bash
$ curl -s https://api.resend.com/domains -H "Authorization: Bearer re_..."
{"statusCode":401,"name":"restricted_api_key","message":"This API key is restricted to only send emails"}
```

도메인 목록 조회가 401. 키가 잘못됐나 싶었는데, 에러 메시지를 읽어보면 답이 있다 — **"발송 전용으로 제한된 키"**다. Resend는 키를 만들 때 권한 범위를 고를 수 있는데, "Sending access"만 준 키는 발송 API만 되고 관리 API는 막힌다. 그러니까 이 401은 문제가 아니라 **최소 권한 원칙이 제대로 동작하는 증거**다. SMTP 릴레이 용도의 키가 도메인 설정까지 만질 수 있어야 할 이유는 없다. 오히려 칭찬할 일이라 키를 그대로 뒀다.

교훈: 401을 보자마자 "키가 틀렸다"로 달려가지 말 것. `restricted_api_key`라는 에러 이름까지 읽으면 디버깅이 아니라 확인으로 끝난다.

### 검증 체인: API 직접 발송 → Supabase 경유 실발송

연결이 진짜 되는지는 두 단계로 확인했다. 먼저 Resend API로 직접 발송 —

```bash
$ curl -s https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
  -d '{"from":"MatchDa <no-reply@matchda.com>","to":["..."],"subject":"[테스트] Resend 연결 확인","html":"<b>OK</b>"}'
{"id":"a1b2c3d4-..."}
```

`no-reply@matchda.com` 발신으로 성공. 도메인 인증과 키가 살아 있다는 뜻이다. 하지만 이건 Resend까지만 확인한 것이고, 실제 경로는 **Supabase → Resend SMTP**다. Supabase 대시보드에 SMTP 설정(호스트 smtp.resend.com, 유저 resend, 비밀번호에 API 키)을 넣은 뒤, 이 경로를 통째로 태우는 방법으로 10편에 만든 기능을 그대로 썼다.

```ts
// Supabase가 SMTP로 실제 메일을 쏘게 만드는 가장 쉬운 트리거
await supabase.auth.resetPasswordForEmail('내 이메일', { redirectTo: ... })
```

몇 초 뒤 메일함에 도착한 건 — `no-reply@matchda.com` 발신, Step 1에서 만든 주황 박스가 들어간 브랜드 재설정 메일이었다. 템플릿·SMTP·DNS 세 층이 한 번에 검증된 순간이다. 시간당 2~4건 제한도 이 시점부터 Resend의 한도(무료 티어 기준 일 100건)로 올라갔다.

### 사람과 AI의 역할 분담 — 대시보드는 AI가 못 누른다

이번 작업의 협업 구조는 지금까지의 코딩 세션과 확연히 달랐다. 정리하면 이렇다.

| 단계 | 담당 | 이유 |
|---|---|---|
| 현재 상태 조사 (env, dig, API 검증) | AI | CLI로 가능 |
| 템플릿 HTML 작성·스크린샷 검증 | AI | 코드와 Playwright의 세계 |
| GoDaddy DNS 레코드 추가 | 사람 | 대시보드 클릭 |
| Resend 도메인 등록·키 발급 | 사람 | 대시보드 클릭 |
| Supabase SMTP 설정·템플릿 붙여넣기 | 사람 | 대시보드 클릭 |
| 각 단계의 결과 검증·디버깅 | AI | curl과 실발송으로 확인 가능 |

Resend도 Supabase도 Management API가 있긴 하지만, 그 토큰을 발급해 넘기지 않는 한 AI는 대시보드를 대신 눌러줄 수 없다. 그래서 협업이 **"AI가 정확한 값과 순서를 준비 → 사람이 붙여넣기 → AI가 즉시 검증"**의 릴레이가 됐다. 흥미로운 건 이 구조가 생각보다 안전하다는 점이다. 2편 사고 이후 인프라 계열 쓰기 작업에 사람 확인을 두기로 했는데, 대시보드 설정은 구조적으로 사람 손을 거칠 수밖에 없으니 그 규칙이 저절로 지켜진다. 대신 사람이 붙여넣다 생기는 오타는 AI의 검증 단계가 잡는다 — 실제로 실발송 테스트가 없었다면 SMTP 설정이 조용히 틀려 있어도 다음 가입자가 나올 때까지 몰랐을 것이다.

## 열린 과제: support@matchda.com은 진짜 받아지는가

한 가지는 확인하지 못한 채 남겨뒀다. 9편에서 약관·고객센터에 `support@matchda.com`을 문의 채널로 적어놨는데, dig에서 본 Mailgun MX가 이 주소의 수신을 실제로 라우팅하고 있는지는 아직 검증하지 않았다. Resend는 발신 전용이라 이 문제와 무관하고, 순전히 Mailgun 쪽 설정의 문제다. **정책 문서에 적힌 주소로 메일을 보내면 실제로 누군가에게 도착하는가** — 발신을 검증한 것과 같은 방식으로(외부 메일함에서 발송 → 수신 확인) 다음 세션에서 확인해야 한다. 문서와 현실의 괴리를 이번에 RESEND_API_KEY에서 한 번 발견했으니, 같은 종류의 괴리가 수신 쪽에도 있다고 가정하는 게 안전하다.

## 자주 쓴 패턴 요약

| 상황 | 패턴 |
|---|---|
| 이메일 HTML 레이아웃 | `<table role="presentation">` 중첩 + 전부 인라인 스타일, `<style>` 블록 금지 |
| 한글 메일 폰트 | 시스템 한글 폰트를 앞에: `'Apple SD Gothic Neo','Malgun Gothic',...` |
| 가입 확인 메일 | 인증 CTA + 열람률 100%를 활용한 온보딩 팁 박스 |
| 재설정 메일 | 만료 안내 + "미요청 시 무시해도 안전" 문구, 경고 톤(주황) 박스 |
| 템플릿 미리보기 | sed로 `{{ .변수 }}` 치환 → Playwright 스크린샷 |
| 대시보드 붙여넣기 자산 | 원본은 git(`docs/email-templates/`)에 — 대시보드는 배포 대상 |
| DNS 작업 전 | `dig NS`·`dig MX`로 현재 상태 스냅샷 — 기존 수신 설정과의 충돌 확인 |
| 수신·발신 공존 | 수신(MX)은 루트 도메인, 발신(Resend)은 서브도메인 — 레코드가 안 겹침 |
| Resend restricted key 401 | 에러 이름(`restricted_api_key`)부터 읽기 — 최소 권한 키는 정상 |
| SMTP 연결 검증 | API 직접 발송 → 앱 기능(resetPasswordForEmail) 트리거로 전체 경로 실발송 |
| 대시보드 설정 협업 | AI가 값·순서 준비 → 사람이 붙여넣기 → AI가 curl·실발송으로 즉시 검증 |

## 정리

1. **인증 메일은 기능이 아니라 첫인상이다.** "Confirm your signup"이라는 제목과 supabase.io 발신자는 동작에는 문제가 없지만, 사용자가 서비스에서 받는 첫 번째 산출물이 남의 브랜드로 온다는 뜻이다. 그리고 기본 SMTP의 시간당 2~4건 제한은 브랜딩 이전에 서비스 장애의 씨앗이다 — 커스텀 SMTP는 "나중에"가 아니라 가입 기능을 여는 시점의 필수 작업이다.
2. **스택 문서는 주기적으로 실물과 대조하라.** CLAUDE.md의 "이메일: Resend"는 몇 달간 희망사항이었고, 그 사이 개인정보 처리방침에까지 올라갔다. 빈 환경변수 하나가 문서·법적 문서·현실 사이의 괴리를 드러냈다. 문서에 적힌 의존성은 "적혀 있다"가 아니라 "검증했다"가 돼야 한다.
3. **설정 협업에서 AI의 자리는 조사와 검증이다.** 대시보드 클릭은 사람 몫이지만, 그 전후 — dig로 현재 DNS를 찍고, 401의 정체를 규명하고, 실발송으로 전체 경로를 검증하는 일 — 은 AI가 훨씬 빠르고 꼼꼼하다. "AI가 준비 → 사람이 실행 → AI가 검증" 릴레이는 코드 밖 인프라 작업에서 꽤 쓸만한 협업 형태였다.
4. **검증은 항상 실제 경로로.** Resend API 직접 발송 성공은 절반의 검증이다. 실제 사용자가 타는 경로는 Supabase → SMTP → Resend고, 그 경로는 앱의 기능(resetPasswordForEmail)을 트리거해야만 검증된다. 10편에서 만든 기능이 11편의 테스트 도구가 된 것처럼, 잘 만든 기능은 그대로 인프라 검증 도구가 된다.

이제 MatchDa에 가입하면 초록 헤더에 악수-M 로고가 박힌 한국어 메일이 no-reply@matchda.com에서 도착한다. 사용자는 아무것도 눈치채지 못할 것이다 — 그리고 인프라 작업은 원래 그게 성공의 정의다.
