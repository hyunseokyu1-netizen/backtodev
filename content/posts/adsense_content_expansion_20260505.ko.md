---
title: WiFi QR 코드 생성기를 만들었다 — AI로 처음 완성한 사이드 프로젝트
date: '2026-05-05'
description: 손님에게 WiFi 비밀번호 알려주기가 불편해서 만든 QR 코드 생성기 — React + i18n + 인쇄까지
tags:
  - React
  - TypeScript
  - i18n
  - 사이드프로젝트
  - qrcode
---

손님이 오면 항상 같은 상황이 반복된다.

1. "WiFi 비밀번호가 뭐예요?" 질문
2. 공유기 뒤 스티커 확인
3. 복잡한 비밀번호 받아쓰기
4. 오타 → 재시도

QR 코드로 찍으면 자동 연결되는 게 있으면 어떨까? 찾아보니 표준 포맷도 있고, `qrcode.react` 같은 라이브러리도 있었다. 직접 만들어보기로 했다.

이게 AI와 함께 처음으로 완성한 사이드 프로젝트다. 사이트 주소는 [wi-fi-qr.xyz](https://wi-fi-qr.xyz).

---

## 만든 것들 한눈에

| 기능 | 내용 |
|------|------|
| WiFi QR 코드 생성 | SSID, 비밀번호, 암호화 방식 입력 → 즉시 QR 생성 |
| 인쇄 기능 | QR 코드 + 네트워크 이름 카드 형식으로 인쇄 |
| 히스토리 | 이전에 생성한 QR 코드 목록 (로컬스토리지) |
| 다국어 지원 | 한국어 / 영어 / 중국어 / 독일어 |
| Hidden SSID | 숨겨진 네트워크도 지원 |

---

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| 프레임워크 | React + Vite + TypeScript |
| 라우팅 | wouter |
| 폼 관리 | react-hook-form + zod |
| QR 생성 | qrcode.react |
| SEO | react-helmet-async |
| 아이콘 | lucide-react |
| 분석 | @vercel/analytics |

---

## Step 1 — QR 코드 포맷 이해

WiFi QR 코드는 특정 문자열 포맷을 따른다.

```
WIFI:T:WPA;S:네트워크이름;P:비밀번호;H:false;;
```

- `T`: 암호화 방식 (`WPA`, `WEP`, `nopass`)
- `S`: SSID (네트워크 이름)
- `P`: 비밀번호
- `H`: Hidden SSID 여부

iOS 11+, Android 10+ 기기에서 카메라 앱으로 스캔하면 바로 연결 화면이 뜬다. `qrcode.react`에 이 문자열을 넘기면 QR 코드를 렌더링해준다.

```typescript
import QRCode from "qrcode.react";

function buildWifiString(config: WifiConfig): string {
  const { ssid, password, encryption, hidden } = config;
  if (encryption === "nopass") return `WIFI:T:nopass;S:${ssid};;`;
  return `WIFI:T:${encryption};S:${ssid};P:${password};H:${hidden};;`;
}

<QRCode value={buildWifiString(config)} size={200} />
```

---

## Step 2 — 폼 구성: react-hook-form + zod

입력 폼은 `react-hook-form`과 `zod`로 관리했다. 암호화 방식이 `nopass`이면 비밀번호 필드 자체를 숨기는 방식이다.

```typescript
// shared/schema.ts
export const insertWifiConfigSchema = z.object({
  ssid: z.string().min(1, "SSID를 입력해주세요"),
  password: z.string().optional(),
  encryption: z.enum(["WPA", "WEP", "nopass"]),
  hidden: z.boolean().default(false),
});
```

폼 변경이 일어날 때마다 부모로 현재 값을 올려보내 QR 코드가 실시간으로 갱신된다.

```typescript
// WifiForm.tsx
const handleChange = (data: Partial<InsertWifiConfig>) => {
  const newConfig = { ...form.getValues(), ...data };
  onUpdate(newConfig); // 부모로 올려서 QR 즉시 갱신
};

<form onChange={() => handleChange(form.getValues())}>
```

비밀번호 필드는 show/hide 토글을 달았다. WiFi 비밀번호는 길고 복잡한 경우가 많아서 입력 확인이 필요하다.

```typescript
const [showPassword, setShowPassword] = useState(false);

<Input type={showPassword ? "text" : "password"} />
<button onClick={() => setShowPassword(!showPassword)}>
  {showPassword ? <EyeOff /> : <Eye />}
</button>
```

---

## Step 3 — 다국어 지원 (i18n)

라이브러리 없이 직접 구현했다. `i18n.ts`에 번역 키-값 객체를 언어별로 관리하고, Context로 전체에 공유하는 방식이다.

```typescript
// lib/i18n.ts
type Language = "en" | "ko" | "zh" | "de";

const translations: Record<Language, Record<string, string>> = {
  en: { "form.ssid": "Network Name (SSID)", ... },
  ko: { "form.ssid": "네트워크 이름 (SSID)", ... },
  zh: { "form.ssid": "网络名称 (SSID)", ... },
  de: { "form.ssid": "Netzwerkname (SSID)", ... },
};
```

언어 감지는 브라우저 설정을 먼저 보고, 없으면 영어로 폴백한다. 선택한 언어는 `localStorage`에 저장해서 다음 방문 때도 유지된다.

```typescript
// App.tsx
function detectLanguage(): Language {
  const saved = localStorage.getItem("wifi-qr-lang");
  if (valid.includes(saved as Language)) return saved as Language;

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("ko")) return "ko";
  if (browserLang.startsWith("zh")) return "zh";
  if (browserLang.startsWith("de")) return "de";
  return "en";
}
```

---

## Step 4 — 인쇄 기능

인쇄용 카드 컴포넌트(`PrintableCard`)를 별도로 만들고, `window.print()`를 호출했다. CSS `@media print`로 UI 요소를 숨기고 카드만 인쇄되게 했다.

```typescript
// WifiForm.tsx
const handlePrint = () => {
  window.print();
};

<Button onClick={handlePrint} disabled={!form.watch("ssid")}>
  <Printer className="w-5 h-5 mr-2" />
  {t("form.print")}
</Button>
```

카드에는 QR 코드와 네트워크 이름이 함께 나온다. 카페나 사무실에서 인쇄해서 붙여두면 손님이 직접 스캔해 연결할 수 있다.

---

## Step 5 — 라우팅과 SEO

wouter로 라우팅을 잡았다. 페이지는 총 4개다.

```typescript
// App.tsx
<Route path="/" component={Home} />
<Route path="/guide" component={Guide} />
<Route path="/about" component={About} />
<Route path="/privacy" component={Privacy} />
```

각 페이지에 `react-helmet-async`로 title과 description, canonical URL을 달았다.

```typescript
<Helmet>
  <title>Free WiFi QR Code Generator | WiFi QR Print</title>
  <meta name="description" content="Generate a printable WiFi QR code..." />
  <link rel="canonical" href="https://wi-fi-qr.xyz" />
</Helmet>
```

---

## 초기 사이트 구조

배포 당시 홈 페이지 구성은 이랬다.

```
홈 (/)
  ├── 헤더 + 언어 선택기
  ├── WiFi QR 폼 (좌) + QR 미리보기 (우)
  ├── How-to 섹션 (4단계)
  ├── FAQ (5개)
  └── 푸터 → Privacy 링크
```

도구로서는 충분했다. 폼 채우면 QR 나오고, 인쇄도 되고, 4개 언어로 쓸 수 있었다. 그래서 구글 애드센스도 달아보기로 했다.

---

## 정리 — 핵심 흐름 한눈에

```
WiFi 비밀번호 공유 불편
  ↓
WIFI:T:WPA;S:...;P:...;; 포맷으로 QR 생성
  ↓
react-hook-form + zod 폼 → 실시간 QR 갱신
  ↓
window.print() 인쇄 카드
  ↓
4개 언어 i18n (브라우저 자동 감지)
  ↓
Vercel 배포 → wi-fi-qr.xyz
```

사이트는 잘 돌아갔다. 그런데 애드센스 신청 후 거절 메일이 왔다. 다음 편에서 그 이야기를 쓰겠다.

---

*WiFi QR 코드 생성기 개발기*
- **1편: 사이트 소개 — AI와 함께 만든 WiFi QR 생성기 (현재)**
- [2편: 구글 애드센스 거절당했다 — 콘텐츠 없는 도구 사이트의 현실](/posts/wifi_qr_adsense_20260506)
