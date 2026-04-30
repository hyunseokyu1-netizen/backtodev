---
title: '구글 애드센스 거절당했다 — 콘텐츠 없는 도구 사이트의 현실'
date: '2026-05-06'
publish_date: '2026-05-06'
description: 애드센스 심사에서 "가치 없는 콘텐츠"로 거절당한 뒤, 도구 사이트에 콘텐츠를 채워 재신청한 과정
tags:
  - AdSense
  - React
  - i18n
  - SEO
  - 사이드프로젝트
---

WiFi QR 코드 생성기([wi-fi-qr.xyz](https://wi-fi-qr.xyz))를 만들고 나서 애드센스를 달아보기로 했다. 도구 사이트도 트래픽이 생기면 수익화할 수 있다고 들었다. 신청하고 며칠을 기다렸다.

도착한 이메일:

> "귀하의 사이트가 Google 게시자 정책을 준수하지 않아 현재 AdSense를 사용할 수 없습니다."

거절 사유는 두 가지였다.

1. **가치가 별로 없는 콘텐츠** (Low value content)
2. **게시자 콘텐츠가 없는 화면에 광고** (Ads placed on screens with little to no publisher content)

---

## 전체 대응 타임라인

```
애드센스 거절 메일 수신
  → 정책 가이드 분석
  → 문제 진단: 폼 + FAQ 5개뿐, 광고 위치도 나쁨
  → 홈 페이지 콘텐츠 확장 (FAQ 15개, Use Cases, Security Tips)
  → /guide 페이지 신규 생성 (900단어)
  → /about 페이지 신규 생성
  → 광고 배너 위치 이동
  → 푸터 내부 링크 추가
  → 재신청
```

---

## 왜 거절당했나

찔렸다. 당시 홈 페이지 구성은 이랬다.

```
홈 (/)
  ├── WiFi QR 폼
  ├── How-to 섹션 (4단계)
  ├── [AdBanner] ← 여기 달았음
  └── FAQ (5개)
```

도구는 잘 작동한다. 하지만 광고 배너 바로 위에 텍스트 콘텐츠가 거의 없었다. 구글 기준에서 보면 광고를 달기엔 너무 빈 화면이었다.

애드센스 정책을 다시 읽으니 핵심은 이거였다.

> 광고가 노출되는 페이지에는 광고보다 콘텐츠가 충분히 많아야 한다.

도구 사이트도 예외가 없다. QR 코드 생성기라면 QR 코드에 대한 설명, 사용 사례, 보안 팁, 가이드 문서 같은 **읽을 거리**가 있어야 한다는 뜻이다.

---

## Step 1 — FAQ 5개 → 15개

기존 FAQ는 "QR 코드가 뭔가요", "어떤 기기에서 쓸 수 있나요" 수준이었다. 실제 사용자가 궁금해할 만한 내용으로 10개를 추가했다.

추가된 항목:
- WPA2와 WPA3 차이가 있나요?
- WiFi 비밀번호를 바꿨을 때 QR 코드는 어떻게 되나요?
- 게스트 네트워크용으로 써도 되나요?
- QR 코드가 인식되지 않을 때는 어떻게 하나요?
- 숨겨진 네트워크(Hidden SSID)도 지원하나요?

사이트가 4개 언어를 지원하기 때문에, FAQ 항목도 전부 `i18n.ts`에 번역 키로 관리했다.

```typescript
// client/src/lib/i18n.ts
"faq.q6": "What is the difference between WPA2 and WPA3?",
"faq.a6": "WPA3 is the latest WiFi security standard...",
"faq.q7": "What happens to the QR code if I change my WiFi password?",
"faq.a7": "The QR code is generated from your password at the time...",
```

번역 키를 추가한 뒤 `Home.tsx`에서 배열에 끼워 넣으면 끝이다.

```typescript
const faqs = [
  { q: t("faq.q1"), a: t("faq.a1") },
  // 기존 5개
  { q: t("faq.q6"), a: t("faq.a6") },
  // q7 ~ q15
];
```

---

## Step 2 — Use Cases + 보안 팁 섹션 추가

### Use Cases

호텔, 카페, 사무실, 가정 — 4가지 활용 사례를 카드 형식으로 보여주는 섹션을 만들었다. `lucide-react` 아이콘을 활용해 시각적으로 분리했다.

```typescript
const usecases = [
  { icon: <Building2 />, title: t("usecases.hotel.title"), desc: t("usecases.hotel.desc") },
  { icon: <Coffee />,    title: t("usecases.cafe.title"),  desc: t("usecases.cafe.desc") },
  { icon: <Users />,     title: t("usecases.office.title"), desc: t("usecases.office.desc") },
  { icon: <HomeIcon />,  title: t("usecases.home.title"), desc: t("usecases.home.desc") },
];
```

### 보안 팁

"QR 코드를 뿌리면 보안에 문제없나요?"라는 암묵적인 질문에 답하는 섹션이다. WPA3 사용 권장, 게스트 네트워크 분리, 강력한 비밀번호, 주기적 교체 — 4가지 팁을 카드로 나열했다.

```typescript
const tips = [
  { icon: <Shield />,    title: t("tips.t1.title"), desc: t("tips.t1.desc") }, // WPA3
  { icon: <Users />,     title: t("tips.t2.title"), desc: t("tips.t2.desc") }, // 게스트 네트워크
  { icon: <Lock />,      title: t("tips.t3.title"), desc: t("tips.t3.desc") }, // 강력한 비밀번호
  { icon: <RefreshCw />, title: t("tips.t4.title"), desc: t("tips.t4.desc") }, // 주기적 교체
];
```

---

## Step 3 — /guide 페이지 신규 생성

홈 페이지 콘텐츠만으로는 부족해서 독립적인 가이드 페이지를 만들었다. 약 900단어 분량의 영문 콘텐츠다.

| 섹션 | 내용 |
|---|---|
| What Is a WiFi QR Code? | QR 코드 내부 포맷(`WIFI:T:WPA;S:...;P:...`) 설명 |
| Device Compatibility | iOS/Android 버전별 지원 여부 |
| Security Considerations | 게스트 네트워크 분리 권장, WEP 사용 금지 |
| Best Uses by Venue | 호텔/카페/사무실/가정별 활용 팁 |
| Troubleshooting | QR 인식 안 될 때 체크리스트 |

`react-helmet-async`로 메타태그와 canonical URL을 달았다.

```typescript
// client/src/pages/Guide.tsx
<Helmet>
  <title>Complete Guide to WiFi QR Codes | WiFi QR Print</title>
  <meta name="description" content="Everything you need to know about WiFi QR codes..." />
  <link rel="canonical" href="https://wi-fi-qr.xyz/guide" />
</Helmet>
```

QR 포맷 설명도 실제 코드 블록으로 넣었다.

```
WIFI:T:WPA;S:YourNetworkName;P:YourPassword;H:false;;
```

이 포맷 설명 하나만으로도 "그냥 폼 채우는 사이트"와 "뭔가 알려주는 사이트"의 차이가 생겼다.

---

## Step 4 — /about 페이지 신규 생성

About 페이지는 짧지만 중요하다. 애드센스 정책상 사이트 운영자 정보와 서비스 소개가 있어야 한다.

포함된 내용:
- 서비스가 뭘 하는 도구인지
- 왜 만들었는지
- 개인정보 보호 방침 요약

마지막 항목이 특히 중요했다. WiFi 비밀번호를 입력하는 사이트라 "이 사이트 믿어도 되나?"라는 의심을 정면으로 다뤘다.

```typescript
// client/src/pages/About.tsx
<p>
  All processing happens locally in your browser. Your WiFi password is never
  transmitted to any server — it exists only in your browser's memory while
  you are on the page.
</p>
```

---

## Step 5 — 광고 배너 위치 변경 + 푸터 링크

### 배너 위치

```
변경 전:                    변경 후:
[How-to]                   [How-to]
[AdBanner] ← 콘텐츠 없음   [Use Cases]
[FAQ 5개]                  [Security Tips]
                           [FAQ 15개]
                           [AdBanner] ← 충분한 콘텐츠 이후
```

AdBanner 포맷도 `fluid`에서 `auto`로 바꿨다. `fluid`는 콘텐츠가 적을 때 광고가 너무 눈에 띄게 되는 문제가 있었다.

```typescript
// 변경 전
<AdBanner slot="9601998432" format="fluid" layoutKey="-6s+ed+2g-1n-4q" />

// 변경 후
<AdBanner slot="9601998432" format="auto" className="min-h-[90px]" />
```

### 푸터 링크

새 페이지를 만들었으면 크롤러가 찾을 수 있게 링크를 연결해야 한다.

```typescript
// 변경 전 — Privacy 링크 하나
<Link href="/privacy">{t("footer.privacy")}</Link>

// 변경 후 — Guide / About / Privacy
<div className="flex items-center gap-4">
  <Link href="/guide">{t("footer.guide")}</Link>
  <Link href="/about">{t("footer.about")}</Link>
  <Link href="/privacy">{t("footer.privacy")}</Link>
</div>
```

---

## 트러블슈팅

**i18n 번역 키가 많아지면**

번역 키가 15개씩 4개 언어로 늘어나니 `i18n.ts` 파일이 꽤 길어졌다.

섹션 주석으로 구분하는 게 도움이 된다.

```typescript
// --- FAQ ---
"faq.q1": "...",
// --- Use Cases ---
"usecases.hotel.title": "...",
```

개발 서버에서 `t("faq.q6")` 같은 값이 그대로 화면에 보이면 해당 언어에 키가 누락된 것이다. 영어 키를 추가할 때 다른 언어 섹션도 함께 열어서 같이 추가하는 습관을 들이는 게 좋다.

중국어(zh), 독일어(de)는 직접 쓰기 어렵다. Claude나 DeepL로 기계 번역한 뒤 파일에 붙여넣었다.

---

## 정리 — 핵심 흐름 한눈에

```
거절 사유: 콘텐츠 부족 + 광고 위치 나쁨
  ↓
홈 페이지: FAQ 5→15, Use Cases, Security Tips 추가
  ↓
/guide 페이지: 900단어 가이드 콘텐츠
  ↓
/about 페이지: 운영자 정보 + 신뢰 구축
  ↓
광고 배너: 콘텐츠 충분한 이후로 이동
  ↓
푸터 링크 추가 → 크롤러 접근 가능
  ↓
재신청 (심사 중)
```

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| FAQ 개수 | 5개 | 15개 |
| 콘텐츠 섹션 | How-to | How-to + Use Cases + Security Tips |
| 독립 페이지 | 홈 + Privacy | 홈 + Privacy + Guide + About |
| AdBanner 위치 | How-to 직후 | FAQ 이후 |
| 푸터 링크 | Privacy 1개 | Guide / About / Privacy 3개 |

결국 구글의 기준은 단순했다. "광고 옆에 읽을 콘텐츠가 있느냐." 도구 사이트라도 예외가 없다. 재신청 결과가 나오면 후속으로 이어가겠다.

---

*WiFi QR 코드 생성기 개발기*
- [1편: 사이트 소개 — AI와 함께 만든 WiFi QR 생성기](/posts/adsense_content_expansion_20260427)
- **2편: 구글 애드센스 거절당했다 — 콘텐츠 없는 도구 사이트의 현실 (현재)**
