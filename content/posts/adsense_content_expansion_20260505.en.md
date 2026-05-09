---
title: 'I Built a WiFi QR Code Generator — My First Completed Side Project with AI'
date: '2026-05-05'
publish_date: '2026-05-10'
description: A WiFi QR code generator I made because sharing passwords to guests was annoying — React + i18n + print support
tags:
  - React
  - TypeScript
  - i18n
  - SideProject
  - qrcode
---

The same thing happens every time guests come over.

1. "What's the WiFi password?" they ask
2. Check the sticker on the back of the router
3. Dictate the complicated password character by character
4. Typo → try again

What if they could just scan a QR code and connect automatically? I looked into it and found there's a standard format for this, plus libraries like `qrcode.react`. So I decided to build it myself.

This is the first side project I've actually finished with AI. The site is at [wi-fi-qr.xyz](https://wi-fi-qr.xyz).

---

## What It Does at a Glance

| Feature | Description |
|---------|-------------|
| WiFi QR code generation | Enter SSID, password, encryption type → instant QR |
| Print support | Print QR code + network name as a card |
| History | List of previously generated QR codes (localStorage) |
| Multilingual | Korean / English / Chinese / German |
| Hidden SSID | Supports hidden networks too |

---

## Tech Stack

| Category | Library |
|----------|---------|
| Framework | React + Vite + TypeScript |
| Routing | wouter |
| Form | react-hook-form + zod |
| QR generation | qrcode.react |
| SEO | react-helmet-async |
| Icons | lucide-react |
| Analytics | @vercel/analytics |

---

## Step 1 — Understanding the WiFi QR Format

WiFi QR codes follow a specific string format.

```
WIFI:T:WPA;S:NetworkName;P:Password;H:false;;
```

- `T`: Encryption type (`WPA`, `WEP`, `nopass`)
- `S`: SSID (network name)
- `P`: Password
- `H`: Whether SSID is hidden

On iOS 11+ and Android 10+, scanning with the camera app brings up a connection prompt directly. Pass this string to `qrcode.react` and it renders the QR code.

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

## Step 2 — Form Setup: react-hook-form + zod

The form is managed with `react-hook-form` and `zod`. When encryption is set to `nopass`, the password field is hidden entirely.

```typescript
// shared/schema.ts
export const insertWifiConfigSchema = z.object({
  ssid: z.string().min(1, "Please enter your SSID"),
  password: z.string().optional(),
  encryption: z.enum(["WPA", "WEP", "nopass"]),
  hidden: z.boolean().default(false),
});
```

Every form change lifts the current values to the parent so the QR code updates in real time.

```typescript
// WifiForm.tsx
const handleChange = (data: Partial<InsertWifiConfig>) => {
  const newConfig = { ...form.getValues(), ...data };
  onUpdate(newConfig); // lift to parent for immediate QR refresh
};

<form onChange={() => handleChange(form.getValues())}>
```

The password field has a show/hide toggle — WiFi passwords are often long and complex, so being able to verify the input matters.

```typescript
const [showPassword, setShowPassword] = useState(false);

<Input type={showPassword ? "text" : "password"} />
<button onClick={() => setShowPassword(!showPassword)}>
  {showPassword ? <EyeOff /> : <Eye />}
</button>
```

---

## Step 3 — Multilingual Support (i18n)

I implemented this without a library. `i18n.ts` holds key-value translation objects per language, shared across the app via Context.

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

Language detection checks the browser settings first and falls back to English if nothing matches. The selected language is saved in `localStorage` so it persists across visits.

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

## Step 4 — Print Feature

I created a separate `PrintableCard` component for printing and call `window.print()`. CSS `@media print` hides all UI elements so only the card prints.

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

The card shows the QR code alongside the network name. Print it out and stick it somewhere — guests can scan and connect themselves.

---

## Step 5 — Routing and SEO

I used wouter for routing. There are four pages in total.

```typescript
// App.tsx
<Route path="/" component={Home} />
<Route path="/guide" component={Guide} />
<Route path="/about" component={About} />
<Route path="/privacy" component={Privacy} />
```

Each page gets a title, description, and canonical URL via `react-helmet-async`.

```typescript
<Helmet>
  <title>Free WiFi QR Code Generator | WiFi QR Print</title>
  <meta name="description" content="Generate a printable WiFi QR code..." />
  <link rel="canonical" href="https://wi-fi-qr.xyz" />
</Helmet>
```

---

## Initial Site Structure

The home page layout at launch looked like this:

```
Home (/)
  ├── Header + Language selector
  ├── WiFi QR form (left) + QR preview (right)
  ├── How-to section (4 steps)
  ├── FAQ (5 items)
  └── Footer → Privacy link
```

As a tool it worked well. Fill in the form, get a QR, print it, use it in four languages. So I decided to try adding Google AdSense.

---

## Summary — The Core Flow

```
Annoying WiFi password sharing
  ↓
Generate QR with WIFI:T:WPA;S:...;P:...;; format
  ↓
react-hook-form + zod → real-time QR updates
  ↓
window.print() print card
  ↓
4-language i18n (browser auto-detect)
  ↓
Vercel deploy → wi-fi-qr.xyz
```

The site worked great. Then the AdSense rejection email arrived. I'll cover that story in the next post.

---

*WiFi QR Code Generator series*
- **Part 1: Site Overview — WiFi QR Generator Built with AI (current)**
- [Part 2: Google AdSense Rejected Me — The Reality of a Tool-Only Site](/posts/wifi_qr_adsense_20260429)
