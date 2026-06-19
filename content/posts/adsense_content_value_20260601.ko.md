---
title: 'Google AdSense "가치 없는 콘텐츠" 거절, 이렇게 뚫었다'
date: '2026-06-01'
publish_date: '2026-06-20'
description: 단일 기능 툴 사이트가 AdSense에서 계속 가치없는 콘텐츠로 거절당할 때, 페이지 구조와 콘텐츠를 어떻게 보강했는지 실제 경험을 정리
tags:
  - AdSense
  - SEO
  - React
  - 사이드프로젝트
---

## 사이드 프로젝트를 AdSense에 신청했다가 벽에 부딪혔다

Wi-Fi QR 코드를 생성해서 인쇄할 수 있게 해주는 사이트를 만들었다. 기능은 심플하다. SSID, 비밀번호, 암호화 방식을 입력하면 QR 코드가 나오고, 그걸 인쇄해서 테이블에 붙이면 끝. 카페 사장님이나 에어비앤비 호스트가 쓰기 딱 좋은 도구다.

기능은 잘 돌아가는데 AdSense 심사에서 계속 이 메시지가 돌아왔다.

> **"가치 없는 콘텐츠 (Valuable Inventory: No Content)"**

처음엔 "기능이 있으면 됐지 콘텐츠가 왜 필요해?"라고 생각했다. 근데 AdSense는 그렇게 보지 않더라. AdSense 입장에서 이 사이트는 그냥 "폼 하나짜리 페이지"였던 것이다.

---

## AdSense가 "가치 없는 콘텐츠"라고 판단하는 기준

AdSense 가이드라인을 다시 읽어보니 핵심은 이거였다.

- 광고가 붙을 만한 **충분한 콘텐츠**가 있어야 한다
- 콘텐츠가 **사용자에게 실질적인 정보**를 제공해야 한다
- 사이트가 **신뢰할 수 있는 서비스**라는 증거가 있어야 한다 (About, Privacy Policy, Contact 등)

단일 기능 툴 사이트는 이 기준을 통과하기 어렵다. 폼 하나, QR 코드 하나면 "페이지는 있는데 읽을 콘텐츠가 없다"는 판단이 나온다. 특히:

| 문제 | 이유 |
|------|------|
| 페이지가 1개뿐 | AdSense는 사이트 전체를 본다 |
| 텍스트 콘텐츠 부족 | 폼 + 결과 QR = 읽을 거리가 없음 |
| 신뢰 페이지 부재 | About, Contact, Privacy 없으면 신뢰도 0점 |
| 주제 관련 글 없음 | 정보형 콘텐츠가 없으면 "가치"가 없다고 봄 |

---

## 어떻게 대응했나

AdSense 통과를 위한 최소 목표를 세웠다.

- **페이지 수**: 메인 + 정보형 글 5개 이상 + 기본 신뢰 페이지 3개
- **글 길이**: 정보형 글은 최소 1,000~1,500자 이상
- **신뢰 구조**: About, Contact, Privacy Policy 필수

이걸 기준으로 아래 순서로 작업했다.

---

## Step 1 — 독립 FAQ 페이지 (`/faq`)

메인 페이지에 FAQ가 있긴 했다. 근데 폼 아래에 숨어 있는 아코디언 15개가 전부였다. URL도 없고, 검색엔진 입장에서는 존재하지 않는 거나 마찬가지.

`/faq`를 별도 페이지로 분리하면서 내용도 대폭 확장했다.

**카테고리별로 분류한 20개 Q&A:**

- Security & Privacy (4개) — 비밀번호 안전성, QR이 비밀번호 적는 것보다 안전한 이유 등
- Device Compatibility (4개) — iOS, Android 지원 범위, 기기별 스캔 방법
- Network Settings (5개) — WPA/WEP/None 차이, 숨겨진 네트워크, 암호화 방식 확인법
- Using the Generator (4개) — 오프라인 사용, 이미지 저장, 인쇄 팁
- Guest Networks (3개) — 게스트 네트워크란 무엇인지, 교체 주기, 다중 네트워크 운영

각 답변을 3~5문장으로 충실히 작성했다. 단순히 FAQ 페이지를 만든 게 아니라, 검색에서 걸릴 수 있는 실질적인 질문들을 한 페이지에 모은 것이다.

메인 페이지는 FAQ 6개 미리보기 + "View all FAQs →" 링크 구조로 바꿨다.

---

## Step 2 — 시나리오별 사용 사례 페이지

메인 페이지에도 "카페용", "호텔용" 같은 카드가 있었지만, 카드 한 장에 두 줄 설명이 전부였다. 이걸 각각 독립 페이지로 만들었다.

### `/use-cases/cafe` — 카페·식당용

1,500자 이상의 실용 가이드로 작성했다.

- **기존 방식의 문제점**: 칠판에 비밀번호 적기, 직원이 구두로 알려주기의 한계
- **QR 카드의 장점**: 인터럽션 제거, 오타 없음, 인테리어, 빠른 교체
- **실전 운영 팁**: 카드 배치 위치, SSID를 매장 이름으로 설정하는 방법, 게스트 네트워크 분리
- **단계별 설정 가이드**: 생성부터 테이블 배치까지 8단계

본문 중간에 "Create Your WiFi QR Card" CTA 버튼도 넣어서 메인으로 연결했다.

### `/use-cases/airbnb` — 에어비앤비·단기 임대용

체크인 시 WiFi 공유 문제에 집중했다.

- 메시지로 비밀번호 보내도 게스트가 못 찾는 상황
- 체크아웃마다 비밀번호 교체하는 방법 (QR 카드로 2분 만에 해결)
- 환영 가이드북에 QR 카드 포함하는 팁
- 스마트홈 기기가 있는 경우 게스트 네트워크 분리 이유

### `/use-cases/home` — 가정·가족용

"부모님에게 WiFi 비밀번호 설명하다 지친 사람"을 타깃으로 썼다.

- 방문객마다 비밀번호 반복 설명하는 불편함
- 고령 가족을 위한 별도 카드 프린트 아이디어
- SSID와 비밀번호 설정 팁 (패스프레이즈 형식 추천)
- 거실·주방 배치 위치 가이드

---

## Step 3 — Contact 페이지 (`/contact`)

AdSense 심사 체크리스트에서 빠지지 않는 항목이다. About 페이지에 이메일이 한 줄 있는 거랑, 독립된 `/contact` 페이지가 있는 거랑은 심사에서 다르게 취급된다.

구성은 심플하게:

- 이메일 주소 + Send Email 버튼
- 문의 유형별 안내 카드 (버그 리포트 / 기능 요청 / 일반 피드백)
- 응답 시간 안내
- FAQ·가이드로 먼저 확인하도록 유도

너무 공들일 필요는 없다. "이 사이트에 사람이 있다"는 신호를 주는 게 목적이다.

---

## 작업 후 사이트 구조

```
/                    → 메인 QR 생성기
/guide               → 완전한 WiFi QR 가이드 (기존)
/resources           → 인쇄 팁, 체크리스트, 보안 가이드 (기존)
/faq                 → 독립 FAQ 페이지 (신규) ✅
/use-cases/cafe      → 카페·식당용 가이드 (신규) ✅
/use-cases/airbnb    → 에어비앤비·단기 임대용 (신규) ✅
/use-cases/home      → 가정·가족용 (신규) ✅
/about               → 서비스 소개 (기존)
/contact             → 연락처 (신규) ✅
/privacy             → 개인정보처리방침 (기존)
```

총 10개 페이지. 여기에 sitemap.xml도 전체 URL을 포함하도록 업데이트했다.

---

## 푸터 링크 정비

생각보다 중요한 부분이다. 모든 페이지 푸터에서 주요 페이지로 이동할 수 있어야 한다. AdSense 심사자가 사이트를 탐색할 때 어디서든 주요 페이지로 이동 가능한지 본다.

작업 전 푸터:
```
Guide | Resources | About | Privacy
```

작업 후 푸터:
```
Guide | Resources | FAQ | About | Contact | Privacy Policy
```

메인 use-cases 카드도 각각 해당 페이지로 링크를 연결했다.

---

## React 구조에서 페이지 추가 방법

이 사이트는 React + wouter(라우터) 구조다. 페이지 추가는 단순하다.

**1. 페이지 컴포넌트 생성**

```tsx
// client/src/pages/Faq.tsx
export default function Faq() {
  return (
    <>
      <Helmet>
        <title>WiFi QR Code FAQ | WiFi QR Print</title>
        <meta name="description" content="..." />
        <link rel="canonical" href="https://wi-fi-qr.xyz/faq" />
      </Helmet>
      {/* 페이지 내용 */}
    </>
  );
}
```

**2. App.tsx에 라우트 등록**

```tsx
import Faq from "@/pages/Faq";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/faq" component={Faq} />       {/* 추가 */}
      {/* ... */}
    </Switch>
  );
}
```

**3. sitemap.xml 업데이트**

```xml
<url>
  <loc>https://wi-fi-qr.xyz/faq</loc>
  <lastmod>2026-06-01</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
```

Next.js였다면 `app/faq/page.tsx` 파일 하나 만들면 끝이지만, wouter 기반 SPA는 이렇게 라우트를 명시적으로 등록해야 한다.

---

## 트러블슈팅

**Q. 새 페이지를 추가했는데 새로고침하면 404가 난다**

SPA는 클라이언트 라우팅이라 서버에서 `/faq` 경로를 모른다. Vercel에 배포한다면 `vercel.json`에 rewrite 설정이 필요하다.

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

이미 설정되어 있다면 문제없고, 없다면 이 한 줄로 해결된다.

**Q. 콘텐츠를 추가했는데도 AdSense가 계속 거절한다**

심사에는 시간이 걸린다. 콘텐츠 추가 후 최소 1~2주는 기다렸다가 재신청하는 게 좋다. Google Search Console에서 새 페이지들이 색인됐는지 먼저 확인해볼 것.

---

## 정리

AdSense "가치 없는 콘텐츠" 거절을 해소하는 핵심 흐름은 이렇다.

```
1. 신뢰 페이지 확인  →  About / Contact / Privacy Policy 있는가?
2. 페이지 수 확인    →  메인 + 정보형 글 5개 이상 있는가?
3. 글 길이 확인      →  각 글이 1,000자 이상인가?
4. 내부 링크 확인    →  푸터·본문에서 각 페이지로 연결되는가?
5. sitemap 확인      →  새 URL이 sitemap.xml에 포함됐는가?
```

단일 기능 도구 사이트라도 "이 도구를 어떻게 쓰는지", "어떤 상황에서 필요한지"를 충분히 설명하는 글이 붙어 있으면 AdSense 기준을 충족할 수 있다. 기능을 만드는 것보다 콘텐츠를 붙이는 게 더 귀찮긴 하지만, 어차피 SEO에도 도움이 되니 같이 챙기는 게 낫다.
