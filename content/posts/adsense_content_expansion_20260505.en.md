---
title: Created a WiFi QR code generator - my first completed side project with AI
date: '2026-05-05'
description: >-
  A QR code generator created because I didn't want to give my guests my WiFi
  password - React + i18n + Print
tags:
  - React
  - TypeScript
  - i18n
  - Sideprojects
  - qrcode
---

When guests come over, the same situation always repeats itself.

1. ask "What's the WiFi password?"
2. check the sticker on the back of the router
3. dictate a complicated password
4. typo → retry

What if there was a way to automatically connect with a QR code? I looked for a standard format and found libraries like `qrcode.react`. I decided to create one myself.

This is the first side project I completed with AI. The site address is [wi-fi-qr.xyz](https://wi-fi-qr.xyz).

---

## What I made at a glance

| Features | Content |
|------|------|
| WiFi QR code generation | Enter SSID, password, encryption method → instantly generate QR
| Print function | Print as QR code + network name card format
| History | List of previously created QR codes (local storage) |
| Multi-language support | Korean / English / Chinese / German
| Hidden SSID | Supports hidden networks as well

---

## Technology Stack

| Uncategorized | Libraries
|------|-----------|
| Frameworks | React + Vite + TypeScript |
| Routing | wouter |
| Form Management | react-hook-form + zod
| QR Generation | qrcode.react |
| SEO | react-helmet-async
| Icons | lucide-react |
| Analytics | @vercel/analytics |

---

## Step 1 - Understand the QR Code format

WiFi QR Codes follow a specific string format.

```
WIFI:T:WPA;S:NetworkName;P:Password;H:false;;
```

- T`: Encryption method (`WPA`, `WEP`, `nopass`)
- S`: SSID (network name)
- P`: Password
- H`: Hidden SSID or not

On iOS 11+, Android 10+ devices, scan with the camera app and the connection screen will pop up immediately. Pass this string to `qrcode.react` and it will render a QR code.

```typescript
import QRCode from "qrcode.react";

function buildWifiString(config: WifiConfig): string {
  const { ssid, password, encryption, hidden } = config;
  if (encryption === "nopass") return `WIFI:T:nopass;S:${ssid};;`;
  return `WIFI:T:${encryption};S:${ssid};P:${password};H:${hidden};;`;
}

<QRCode value={buildWifiString(config)} size={200} />
```

---]

## Step 2 - Configure the form: react-hook-form + zod

The input form is managed with `react-hook-form` and `zod`. The encryption method is `nopass`, which hides the password field itself.

```typescript
// shared/schema.ts
export const insertWifiConfigSchema = z.object({
  ssid: z.string().min(1, "Please enter your SSID"),
  password: z.string().optional(),
  encryption: z.enum(["WPA", "WEP", "nopass"]),
  hidden: z.boolean().default(false),
});
```

Whenever the form changes, the QR code is updated in real time by sending the current value to the parent.

```typescript
// WifiForm.tsx
const handleChange = (data: Partial<InsertWifiConfig>) => {
  const newConfig = { ...form.getValues(), ...data };
  onUpdate(newConfig); // update QR immediately by raising to parent
};

<form onChange={() => handleChange(form.getValues())}>
```

The password field has a show/hide toggle. WiFi passwords are often long and complex, so we need to confirm the input.

```typescript
const [showPassword, setShowPassword] = useState(false);

<Input type={showPassword ? "text" : "password"} />.
<button onClick={() => setShowPassword(!showPassword)}>
  {showPassword ? <EyeOff /> : <Eye />}
</button>
```

---

## Step 3 - Multilingual support (i18n)

We implemented this directly without any libraries. We manage translation key-value objects per language in `i18n.ts` and share them globally with Context.

```typescript
// lib/i18n.ts
type Language = "en" | "ko" | "zh" | "de";

const translations: Record<Language, Record<string, string>> = {
  en: { "form.ssid": "Network Name (SSID)", ... },
  en: { "form.ssid": "Network Name (SSID)", ... },
  zh: { "form.ssid": "网络名称 (SSID)", ... },
  de: { "form.ssid": "Netzwerkname (SSID)", ... },
};
```

Language detection checks the browser settings first and falls back to English if not present. The selected language is saved in `localStorage` and is preserved for the next visit.

```typescript
// App.tsx
function detectLanguage(): Language {
  const saved = localStorage.getItem("wifi-qr-lang");
  if (valid.includes(saved as Language)) return saved as Language;

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("en")) return "en";
  if (browserLang.startsWith("zh")) return "zh";
  if (browserLang.startsWith("de")) return "de";
  return "en";
}
```

---

## Step 4 - Print Function

We created a separate printable card component (`PrintableCard`) and called `window.print()`. We used CSS `@media print` to hide the UI elements and make sure only the card is printed.

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

The card comes with a QR code and the name of the network. You can print it out and post it in your cafe or office so customers can scan it to connect.

---

## Step 5 - Routing and SEO

We've routed to wouter. There are 4 pages in total.

```typescript
// App.tsx
<Route path="/" component={Home} />
<Route path="/guide" component={Guide} />
<Route path="/about" component={About} />
<Route path="/privacy" component={Privacy} />
```

Each page has a title, description, and canonical URL using `react-helmet-async`.

```typescript
<Helmet>
  <title>Free WiFi QR Code Generator | WiFi QR Print</title>
  <meta name="description" content="Generate a printable WiFi QR code..." />
  <link rel="canonical" href="https://wi-fi-qr.xyz" />
</Helmet>
```

---

## Initial site structure

At the time of deployment, the home page looked like this

```
Home (/)
  ├── Header + language selector
  WiFi QR form (left) + QR preview (right)
  ├── How-to section (4 steps)
  ├── FAQ (5 steps)
  └── Footer → Privacy link
```

As a tool, it was good enough. The form was easy to fill out, QR, printable, and available in four languages, so I decided to add Google AdSense.

---

## Organization - Key flows at a glance

```
WiFi password sharing is inconvenient
  ↓
Create a QR with the format WIFI:T:WPA;S:...;P:...;;
  ↓
react-hook-form + zod-form → Real-time QR update
  ↓
window.print() print card
  ↓
4 languages i18n (browser auto detection)
  ↓ Vercel
Vercel Deployment → wi-fi-qr.xyz
```

The site was working fine. However, after applying for AdSense, I received a rejection email, which I will write about in the next installment.

---

*WiFi QR code generator developer*.
- **Part 1: Site Introduction - WiFi QR Generator with AI (Current)
- [Part 2: Google AdSense Rejected - The Reality of a Contentless Tools Site](/posts/wifi_qr_adsense_20260506)
