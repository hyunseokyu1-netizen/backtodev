---
title: 'AI 코딩 어시스턴트와 SaaS 만들기 ⑫: support@matchda.com은 어디로 가는가 — 도메인 이메일 수신 구축기'
date: '2026-07-05'
publish_date: '2026-08-11'
description: dig가 폭로한 죽은 Mailgun MX, "아...mailgun 없고...유료네.."의 반전, 코드 0줄로 끝낸 ImprovMX 포워딩 — 정책 문서에만 존재하던 support@matchda.com을 진짜 받아지는 주소로 만든 인프라 탐정극
tags:
  - ImprovMX
  - DNS
  - MX 레코드
  - 이메일
  - AI 코딩 어시스턴트
---

## 시작하며

11편은 이렇게 끝났다 — "정책 문서에 적힌 주소로 메일을 보내면 실제로 누군가에게 도착하는가." 9편에서 약관과 고객센터 페이지에 `support@matchda.com`을 문의 채널로 적어놨는데, 이 주소가 진짜 받아지는지는 검증하지 않은 채 남겨뒀다.

다음 세션에서 이 과제를 꺼내기도 전에, 제품 오너가 먼저 찔렀다.

> "support@matchda.com 메일이 resend에서 만든 메일 주소가 아닌거 같은데..."

정확한 지적이었다. **Resend는 발신 전용 서비스다.** 11편에서 연결한 건 no-reply@matchda.com으로 메일을 *보내는* 인프라지, support@로 오는 메일을 *받는* 메일함이 아니다. 그리고 이 둘은 흔히 하나로 뭉뚱그려지지만 완전히 다른 층이다.

- **발신**: SMTP/API로 메일을 쏘는 쪽. SPF·DKIM 레코드는 "이 서버가 이 도메인 이름으로 보내도 된다"는 발신 평판 인증
- **수신**: 도메인 앞으로 오는 메일을 받는 쪽. **MX 레코드**가 "이 도메인의 메일은 이 서버로 배달하라"는 라우팅 그 자체

Resend에 도메인을 붙이고 DKIM까지 통과했어도 수신함은 1도 생기지 않는다. 이번 편은 코드 커밋이 하나도 없는, 순수 DNS 탐정극의 기록이다.

## Step 1. 탐정극 — 죽은 MX 레코드의 발견

AI 어시스턴트가 늘 하던 대로 현재 상태부터 찍었다.

```bash
$ dig +short MX matchda.com
10 mxa.mailgun.org.
10 mxb.mailgun.org.
```

MX가 **Mailgun**을 가리키고 있다. 11편에서 이미 한 번 봤던 그 "뜻밖의 동거인"이다. MX가 있으니 수신 라우팅 자체는 존재한다는 뜻이고, 그렇다면 Mailgun 대시보드에서 support@를 gmail로 넘기는 Route만 확인하면 끝… 일 수도 있었다.

> AI: "Mailgun 계정 있으세요? 있다면 Routes 설정에서 support@ 포워딩이 걸려 있는지 확인이 필요합니다."
>
> 제품 오너: "있음"
>
> (잠시 후)
>
> 제품 오너: "아...mailgun 없고...유료네.."

반전. 계정은 없었다(혹은 이미 죽어 있었다). 언젠가 수신함을 만들려고 MX만 걸어두고 잊은 흔적이다. 이게 뜻하는 상황을 정리하면 꽤 섬뜩하다.

1. 외부 사용자가 support@matchda.com으로 메일을 보낸다
2. 발신 측 메일 서버는 MX를 조회해 mxa.mailgun.org로 배달을 시도한다
3. Mailgun에는 matchda.com을 받아줄 활성 계정이 없다 → 반송되거나, 조용히 버려진다
4. **우리는 그 메일이 왔었다는 사실조차 알 수 없다**

죽은 DNS 레코드의 무서운 점이 이것이다. 500 에러도, 로그도, 알림도 없다. 그냥 조용히 증발한다. 약관 페이지에는 "문의: support@matchda.com"이 버젓이 걸려 있는데, 그 주소는 우주로 가는 원웨이 티켓이었다.

## Step 2. 선택지 검토 — 코드 0줄로 해결되는 문제에 코드를 쓰지 말자

수신함을 만드는 방법을 넷 놓고 비교했다.

| 선택지 | 방식 | 비용 | 탈락/채택 사유 |
|---|---|---|---|
| Mailgun Routes | MX 유지 + Route로 포워딩 | 유료 | 계정도 없고 유료 — 탈락 |
| Resend Inbound | 수신 메일을 **웹훅(POST)** 으로 전달 | 무료 티어 있음 | 포워더 코드 작성·유지보수 필요 — 탈락 |
| **ImprovMX** | **alias 포워딩 (support@ → gmail)** | **무료** | **5분 설정, 코드 0줄 — 채택** |
| Cloudflare Email Routing | CF에서 무료 포워딩 | 무료 | 네임서버 자체를 GoDaddy → CF로 이전해야 함 — 과함 |

Resend Inbound는 잠깐 흔들렸다. 2025년에 나온 신기능이라(웹 검색으로 확인) 11편에서 이미 쓰고 있는 Resend 하나로 발신·수신을 통일할 수 있다는 그림은 매력적이다. 하지만 방식을 뜯어보면, Resend Inbound는 수신 메일을 메일함에 넣어주는 게 아니라 **웹훅 엔드포인트로 POST**해준다. 즉 "support@ → gmail"을 만들려면:

1. 수신 웹훅을 받는 API Route를 만들고
2. 페이로드에서 본문·첨부를 파싱해서
3. Resend 발신 API로 gmail에 재발송하는 포워더를 직접 구현

해야 한다. 재미있는 토이 프로젝트지만, 지금 필요한 건 "고객 문의가 gmail에 도착하는 것"뿐이다. 웹훅 파싱 코드는 버그가 날 수 있고, 배포가 죽으면 문의 메일도 같이 죽는다. 반면 ImprovMX는 가입 → alias 등록 → MX 교체로 끝이고, 장애 지점이 우리 코드 밖에 있다.

선택 기준을 한 줄로 적어뒀다: **코드 0줄로 해결되는 문제에 코드를 쓰지 말자.** 신기능이 있다는 것과 그게 정답이라는 건 다른 얘기다.

## Step 3. 설정 — 죽은 레코드를 걷어내고 산 레코드를 심기

역할 분담은 11편과 똑같은 릴레이였다. AI가 정확한 레코드 값과 순서를 준비하고, 사람이 대시보드를 누르고, AI가 즉시 검증한다.

사람이 한 일:

1. **ImprovMX 가입** → 도메인 matchda.com 등록 → alias 설정 (`support@` → 제품 오너 gmail, 또는 catch-all `*@`)
2. **GoDaddy DNS**에서:
   - 죽은 MX 2개 삭제: `mxa.mailgun.org`, `mxb.mailgun.org`
   - 새 MX 추가: `mx1.improvmx.com` (priority 10), `mx2.improvmx.com` (priority 20)
   - 루트 도메인 SPF TXT 교체: `include:mailgun.org` → `include:spf.improvmx.com`

여기서 절대 건드리지 말아야 할 것 하나 — **발신용 `send.matchda.com` 서브도메인의 Resend 레코드(SPF/DKIM)는 그대로 둔다.** 11편에서 확인했듯 발신과 수신은 레코드가 겹치지 않게 서브도메인으로 분리돼 있고, 이번 작업은 루트 도메인의 MX·SPF만 만진다. 최종 구조를 그려보면 이렇다.

```
matchda.com (GoDaddy DNS)
│
├── 루트 도메인 ──── 수신 담당
│     MX  → mx1/mx2.improvmx.com     "오는 메일은 ImprovMX로"
│     TXT → v=spf1 include:spf.improvmx.com ~all
│     → support@matchda.com ──(포워딩)──> 제품 오너 gmail
│
└── send.matchda.com ──── 발신 담당 (건드리지 않음)
      SPF/DKIM → Resend
      → no-reply@matchda.com 발신 (Supabase 인증 메일 포함)
```

한 도메인 안에서 수신(ImprovMX)과 발신(Resend)이 서로 모르는 채로 공존한다. DNS 레벨에서 관심사가 분리된 셈이다.

## Step 4. 검증 체인 — 한 통의 메일로 인프라 전체를 관통시키기

### 4-1. MX 전파 확인

레코드 교체 직후, AI가 전파를 확인했다. 캐시에 속지 않도록 권한 네임서버(GoDaddy)를 직접 찍는 것까지.

```bash
$ dig +short MX matchda.com
10 mx1.improvmx.com.
20 mx2.improvmx.com.

# 권한 네임서버에 직접 조회 — 리졸버 캐시 배제
$ dig +short MX matchda.com @ns51.domaincontrol.com
10 mx1.improvmx.com.
20 mx2.improvmx.com.
```

Mailgun은 사라졌고 ImprovMX가 살아 있다. ImprovMX 대시보드의 도메인 상태도 초록불로 바뀌었다.

### 4-2. 실발송 테스트 — 우리 발신으로 우리 수신을 때리기

여기가 이번 편에서 제일 마음에 드는 검증이다. 테스트 메일을 외부에서 보낼 필요 없이, **11편에서 연결해 둔 Resend 발신 API로 support@matchda.com에 쏘면** 된다.

```bash
$ curl -s https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
  -d '{"from":"MatchDa <no-reply@matchda.com>","to":["support@matchda.com"],
       "subject":"[테스트] support 수신 확인","html":"<b>이 메일이 gmail에 도착하면 성공</b>"}'
{"id":"e7f0a3b1-..."}
```

이 한 통이 지나가는 경로를 따라가 보면 — no-reply@matchda.com 발신(**우리 발신 인프라**, Resend/send 서브도메인) → 수신 측 MX 조회 → mx1.improvmx.com(**우리 수신 인프라**) → alias 포워딩 → **제품 오너 gmail**. 한 통의 메일이 이날 만든 것과 지난 편에 만든 것을 전부 관통한다.

몇 초 뒤.

> 제품 오너: "메일 왔어"

끝. 발신 검증이 "브랜드 메일이 도착했다"로 끝났던 것처럼, 수신 검증도 한 마디로 끝났다.

### 4-3. SPF 마무리 확인

교체한 SPF도 dig로 재확인했다.

```bash
$ dig +short TXT matchda.com | grep spf
"v=spf1 include:spf.improvmx.com ~all"
```

`include:mailgun.org`의 흔적까지 사라진 것을 확인하고 상황 종료. ImprovMX의 SPF include는 포워딩된 메일이 gmail에서 스팸 취급받지 않게 하는 데도 한몫한다.

## 최종 이메일 인프라

이 시점의 MatchDa 이메일 스택 전체를 표 하나로 정리하면:

| 기능 | 서비스 | 레코드 위치 |
|---|---|---|
| 발신 (no-reply@) | Resend | `send.matchda.com` 서브도메인 SPF/DKIM |
| 수신 (support@ → gmail) | ImprovMX | 루트 도메인 MX + SPF |
| Supabase 인증 메일 | Resend SMTP | (발신 인프라 재사용) |
| 비용 | **전부 무료 티어** | — |

코드 변경: 0줄. 커밋: 0개. 그런데 서비스의 신뢰도에 직결되는 구멍 하나가 메워졌다.

## 자주 쓴 패턴 요약

| 상황 | 패턴 |
|---|---|
| "이메일 되나요?" 질문 | 발신(SPF/DKIM·SMTP)과 수신(MX)을 분리해서 따로 점검 — Resend 연결됨 ≠ 메일함 있음 |
| 수신 상태 진단 | `dig +short MX 도메인` 부터 — MX가 가리키는 서비스에 활성 계정이 있는지까지 확인 |
| 죽은 레코드 탐지 | MX가 있어도 대상 서비스 계정이 없으면 메일은 조용히 증발 — 레코드 존재 ≠ 동작 |
| 포워딩만 필요할 때 | ImprovMX 무료 alias — 웹훅 포워더 자작(Resend Inbound)보다 장애 지점이 적음 |
| 네임서버 이전이 부담될 때 | Cloudflare Email Routing은 NS 이전 필요 — 기존 등록기관 유지면 ImprovMX가 가벼움 |
| 발신·수신 공존 | 수신 MX는 루트 도메인, 발신 SPF/DKIM은 서브도메인 — 서로 건드리지 않게 분리 |
| DNS 전파 확인 | `dig +short MX 도메인 @권한네임서버` — 리졸버 캐시를 배제하고 원본 확인 |
| 수신 검증 | 자기 발신 인프라(Resend API)로 자기 수신 주소에 실발송 → 최종 메일함 도착 확인 |
| SPF 교체 후 | `dig +short TXT` 로 옛 include가 완전히 사라졌는지 재확인 |
| 설정 협업 | AI가 레코드 값·순서 준비 → 사람이 대시보드 클릭 → AI가 dig·curl로 즉시 검증 |

## 정리

1. **발신과 수신은 다른 인프라다.** SPF·DKIM은 "내가 보낸 메일을 믿어달라"는 발신 평판이고, MX는 "나에게 오는 메일을 여기로 배달하라"는 수신 라우팅이다. Resend에 도메인을 인증했다고 메일함이 생기지 않는다. "이메일 붙였어요"라는 말을 들으면 어느 쪽인지부터 물어야 한다.
2. **죽은 DNS 레코드는 에러 없이 조용히 실패한다.** Mailgun MX는 몇 달 동안 support@ 메일을 소리 없이 증발시키고 있었고, 우리는 문의가 안 온다고만 생각했을 것이다. 정책 문서에 이메일 주소를 적기 전에 dig부터 — 9편에서 이 순서를 지켰다면 열린 과제 자체가 없었다.
3. **신기능이 있다고 그게 정답은 아니다.** Resend Inbound는 흥미로운 신기능이지만, 웹훅 수신 → 파싱 → 재발송 코드를 짜고 유지보수하는 비용을 치러야 한다. 무료 포워딩 서비스로 코드 0줄에 끝나는 문제라면 그쪽이 정답이다. 도구 선택의 기준은 "새로운가"가 아니라 "유지보수할 게 얼마나 남는가"다.
4. **"AI가 준비 → 사람이 클릭 → AI가 검증" 릴레이는 재현 가능한 패턴이다.** 11편에서 한 번 통했던 협업 구조가 이번에도 그대로 작동했다. AI는 dig·curl·웹 검색으로 조사와 검증을 맡고, 사람은 ImprovMX·GoDaddy 대시보드를 누른다. 특히 마지막 실발송 테스트 — 자기 발신 인프라로 자기 수신 인프라를 때리는 — 는 AI가 설계했지만 "메일 왔어"라는 최종 판정은 사람의 메일함에서 나왔다.

이제 약관 페이지의 support@matchda.com은 장식이 아니다. 누군가 정말로 문의를 보내면, 그 메일은 mx1.improvmx.com을 지나 제품 오너의 gmail에 도착한다. 11편의 마지막 문장을 다시 빌리면 — 사용자는 아무것도 눈치채지 못할 것이고, 인프라 작업은 원래 그게 성공의 정의다. 다만 이번에는 하나 배웠다. 눈치채지 못하는 건 실패도 마찬가지라서, 조용한 인프라일수록 dig 한 번의 검증이 필요하다는 것.
