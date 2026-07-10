---
title: '서비스 이름 바꾸기: 커스텀 도메인 연결과 OAuth 리다이렉트 함정 (Vercel + GoDaddy + Supabase)'
date: '2026-06-24'
publish_date: '2026-07-18'
description: JobRadar에서 matchda.com으로 리브랜딩하며 겪은 도메인 구매, Vercel 연결, GoDaddy DNS, Supabase Auth 설정까지 실전 기록
tags:
  - Vercel
  - GoDaddy
  - Supabase
  - DNS
  - OAuth
---

사이드 프로젝트를 만들다 보면 어느 순간 이름이 마음에 안 들기 시작한다. 나도 그랬다. 처음엔 "JobRadar"라는 이름으로 AI 잡 매칭 서비스를 만들고 있었는데, 어느 날 문득 **이 제품의 핵심은 '레이더(탐지)'가 아니라 '매칭'**이라는 걸 깨달았다. 채용공고를 긁어모으는 것보다, 내 이력과 공고가 얼마나 맞는지 점수를 매겨주는 게 진짜 가치였으니까.

그래서 `matchda.com`으로 바꾸기로 했다. "match" + 한국어 "~다(맞다/매칭하다)"를 합친 이름이다. 한국어 사용자(해외 취업 준비생)가 타깃이라 이중 의미가 잘 통한다고 봤다.

이 글은 **이름만 바꾸는 게 아니라, 실제로 새 도메인을 사서 서비스에 연결하기까지** 겪은 과정을 정리한 기록이다. 생각보다 함정이 많았다. 특히 마지막 OAuth 부분에서.

## 리브랜딩은 코드 3~4곳이면 끝난다

막상 시작하니 의외로 코드 변경은 작았다. 전체 저장소에서 "JobRadar"를 검색하니 35곳이 나왔는데, **사용자에게 실제로 보이는 곳은 단 4개 파일**이었다.

```bash
grep -rniI "jobradar" --exclude-dir=node_modules --exclude-dir=.next .
```

| 위치 | 성격 |
|------|------|
| `layout.tsx` | 브라우저 탭 타이틀 + 헤더 로고 |
| `Landing.tsx` | 랜딩 페이지 문구 |
| `login/page.tsx` | 로그인 화면 |
| `package.json` | 프로젝트 name |

나머지는 README, 기획 문서, 주석 같은 거라 천천히 정리해도 됐다. 로고 이모지도 레이더(📡)에서 매칭을 연상시키는 🎯로 바꿨다.

> 팁: 리브랜딩은 **이름을 확정한 뒤** 한 번에 하는 게 좋다. 어설프게 절반만 바꿔두면 나중에 어디까지 했는지 헷갈린다.

여기까지는 쉬웠다. 진짜 일은 도메인 연결부터였다.

## Step 1. 도메인 구매 후 Vercel에 연결하기

도메인은 GoDaddy에서 샀다(어디서 사든 상관없다). 구매 후 첫 단계는 **이 도메인을 Vercel 프로젝트에 붙이는 것**이다.

Vercel CLI로 하면 된다:

```bash
vercel domains add matchda.com
vercel domains add www.matchda.com
```

실행하면 이런 경고가 뜬다:

```
WARNING! This domain is not configured properly.
  a) Set the following record on your DNS provider: A matchda.com 76.76.21.21 [recommended]
  b) Change your Domain's nameservers to: ns1.vercel-dns.com / ns2.vercel-dns.com
```

여기서 중요한 포인트: **"프로젝트에 연결"과 "DNS 설정"은 별개**다. Vercel에 도메인을 추가했다고 끝이 아니라, 도메인을 산 곳(GoDaddy)에서 "이 도메인은 Vercel을 가리켜라"라고 DNS 레코드를 설정해줘야 한다.

참고로 `vercel domains inspect`로 현재 네임서버를 보면 어디서 샀는지도 알 수 있다. 내 경우 `domaincontrol.com`이 떠서 GoDaddy인 걸 확인했다.

## Step 2. GoDaddy DNS 레코드 설정 (그리고 CNAME 충돌)

GoDaddy 도메인 관리 → DNS 레코드로 들어간다. 설정해야 할 건 두 개다.

| Type | Name(Host) | Value |
|------|-----------|-------|
| **A** | `@` (apex) | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

`76.76.21.21`은 Vercel의 고정 IP다. apex 도메인(`matchda.com`처럼 www 없는 형태)은 CNAME을 쓸 수 없어서 A 레코드로 이 IP를 가리킨다.

그런데 여기서 **첫 번째 함정**에 걸렸다. `www`에 A 레코드를 추가하려니까 이런 에러가 떴다:

> 레코드 이름 www이(가) 다른 레코드와 충돌합니다.

이유는 간단했다. **GoDaddy는 기본적으로 `CNAME www → @`를 깔아둔다.** 그리고 DNS 규칙상 **같은 이름(www)에 CNAME과 A 레코드를 동시에 둘 수 없다.** 그래서 충돌이 난 거다.

해결책은 새로 만들지 말고 **기존 CNAME의 값만 수정**하는 것:

- ❌ `A www 76.76.21.21` 새로 추가 → 충돌
- ✅ 기존 `CNAME www`의 값을 `cname.vercel-dns.com`으로 **수정**

이렇게 하니 깔끔하게 통과했다. (사실 GoDaddy 기본값인 `CNAME www → @`를 그냥 둬도 동작은 한다. www가 apex를 거쳐 결국 같은 IP로 가니까. 하지만 Vercel이 "설정 안 됨" 경고를 띄울 수 있어서 명시적으로 바꿔주는 게 낫다.)

## Step 3. SSL은 알아서 발급된다

DNS를 저장하고 잠깐(수십 분 이내) 기다리면 Vercel이 **자동으로 SSL 인증서를 발급**한다. Let's Encrypt 무료 인증서다. 따로 할 게 없다.

전파 상태는 이렇게 확인했다:

```bash
# DNS가 Vercel을 가리키는지
dig +short matchda.com A          # → 76.76.21.21
dig +short www.matchda.com CNAME  # → cname.vercel-dns.com

# HTTPS 응답 + 인증서
curl -s -o /dev/null -w "%{http_code}" https://matchda.com   # → 200
echo | openssl s_client -servername matchda.com -connect matchda.com:443 2>/dev/null \
  | openssl x509 -noout -issuer -dates
# issuer=Let's Encrypt ... notAfter=...
```

`matchda.com`이 200을 반환하고 브랜딩까지 정상으로 떴다. 여기까지 오면 90% 끝난 것 같지만 — **마지막 10%가 제일 골치 아팠다.**

## Step 4. 로그인 후 도메인이 바뀐다? (OAuth 리다이렉트 함정)

새 도메인에서 로그인을 해봤다. 로그인은 됐다. 그런데 **로그인 직후 주소창이 옛날 도메인(`...vercel.app`)으로 바뀌어 있었다.** 이게 제일 헷갈리는 버그였다.

원인을 추적해보니 **OAuth/매직링크 인증 흐름**에 있었다. 내 앱은 Supabase Auth로 로그인을 처리하는데, 흐름이 이렇다:

```
matchda.com → Google 로그인 → Supabase 콜백 → (여기서 어디로 돌려보낼까?) → 앱 복귀
```

코드에서는 분명히 현재 주소 기준으로 돌아오게 짜놨다:

```ts
// 코드는 origin 기반이라 도메인에 종속되지 않음
options: { redirectTo: `${window.location.origin}/auth/callback` }
```

문제는 **Supabase가 아무 주소로나 돌려보내주지 않는다**는 점이다. 보안상 **허용된 URL 목록(allowlist)에 있는 주소로만** 리다이렉트한다. 그리고 **허용목록에 없으면, 무시하고 Site URL(기본 주소)로 보낸다.**

즉 내 상황은:
1. `matchda.com/auth/callback`으로 돌아오라고 요청했지만
2. 그 주소가 Supabase 허용목록에 없었고
3. Supabase가 **Site URL(아직 옛 도메인)로 폴백** → 그래서 도메인이 바뀐 것

**해결**은 Supabase 대시보드 → Authentication → URL Configuration에서:

- **Site URL**: `https://matchda.com` 으로 변경 ← 이게 핵심
- **Redirect URLs**에 추가:
  - `https://matchda.com/**`
  - `https://www.matchda.com/**`

이 설정은 **코드가 아니라 Supabase 서버 쪽 설정**이라, 배포만 해서는 절대 안 고쳐진다. 새 도메인으로 옮길 때 가장 빼먹기 쉬운 부분이다.

## 보너스: "supabase.co로 이동"은 정상이다

설정을 마치고 Google 로그인을 하니 동의 화면에 이런 문구가 떴다:

> wezyyzxsczhosqdboamh.supabase.co(으)로 이동

"내 도메인이 아니라 왜 supabase.co가 뜨지?" 싶어서 당황했는데, **이건 정상**이다. Google 동의 화면은 OAuth **콜백 목적지**(= Supabase 프로젝트 주소)를 표시한다. Supabase·Auth0 같은 인증 중개 서비스를 쓰는 모든 앱에서 똑같이 나온다.

내 도메인으로 보이게 하려면:
- **무료**: Google Cloud Console → OAuth 동의 화면에서 앱 이름/로고만 브랜딩 (단, "...supabase.co로 이동" 호스트 줄은 남음)
- **유료**: Supabase Custom Domain 애드온으로 `auth.matchda.com` 같은 커스텀 인증 도메인 연결

초기 서비스라면 그냥 둬도 기능·보안엔 전혀 문제없다.

## 자주 쓴 명령어 요약

```bash
# 도메인을 Vercel 프로젝트에 연결
vercel domains add matchda.com
vercel domains add www.matchda.com

# 도메인 설정/네임서버 확인
vercel domains inspect matchda.com
vercel certs ls                       # SSL 인증서 발급 확인

# DNS 전파 확인
dig +short matchda.com A
dig +short www.matchda.com CNAME

# HTTPS + 인증서 확인
curl -s -o /dev/null -w "%{http_code}" https://matchda.com
echo | openssl s_client -servername matchda.com -connect matchda.com:443 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

## 정리

새 도메인으로 리브랜딩하는 전체 흐름을 한눈에:

1. **코드**: 사용자 노출 문자열만 교체 (의외로 3~4곳)
2. **Vercel**: `vercel domains add`로 프로젝트에 도메인 연결
3. **DNS(GoDaddy)**: apex는 `A → 76.76.21.21`, www는 `CNAME → cname.vercel-dns.com` (기존 CNAME 충돌 주의)
4. **SSL**: Vercel이 자동 발급 (할 일 없음)
5. **Supabase Auth**: Site URL + Redirect URLs를 새 도메인으로 변경 ← **제일 빼먹기 쉬움**

가장 큰 교훈은 마지막이다. **"코드를 배포했는데 왜 안 되지?"의 답이 코드 밖에 있을 수 있다.** 인증, DNS, SSL처럼 외부 서비스 설정이 얽힌 부분은 코드를 아무리 봐도 안 나온다. 도메인을 옮길 땐 "이 주소를 알고 있는 모든 외부 서비스"를 떠올려보자. 내 경우엔 그게 Supabase였다.
