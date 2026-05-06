---
title: 'Google AdSense Rejected Me — The Reality of a Tool-Only Site'
date: '2026-05-06'
publish_date: '2026-05-10'
description: After being rejected for "low value content," I expanded content and reapplied to AdSense on a WiFi QR code generator site
tags:
  - AdSense
  - React
  - i18n
  - SEO
  - SideProject
---

After building the WiFi QR code generator ([wi-fi-qr.xyz](https://wi-fi-qr.xyz)), I decided to try adding AdSense. I'd heard tool sites can monetize once they get traffic. Applied and waited a few days.

The email arrived:

> "Your site is not currently eligible for AdSense because it does not comply with Google Publisher Policies."

Two rejection reasons:

1. **Low value content**
2. **Ads placed on screens with little to no publisher content**

---

## Full Response Timeline

```
Receive AdSense rejection email
  → Analyze policy guidelines
  → Diagnose the problem: just form + 5 FAQs, bad ad placement too
  → Expand home page content (15 FAQs, Use Cases, Security Tips)
  → Create new /guide page (~900 words)
  → Create new /about page
  → Move ad banner position
  → Add internal links to footer
  → Reapply
```

---

## Why I Got Rejected

Fair point. The home page at the time:

```
Home (/)
  ├── WiFi QR form
  ├── How-to section (4 steps)
  ├── [AdBanner] ← placed here
  └── FAQ (5 items)
```

The tool works great. But there was almost no text content directly above the ad banner. By Google's standard, that screen was too empty for ads.

Re-reading the AdSense policy, the core rule was:

> The page where the ad is shown must have significantly more content than ads.

Tool sites aren't exempt. A QR code generator needs **readable material** — explanations, use cases, security tips, guide documentation.

---

## Step 1 — FAQ: 5 → 15 Items

The original FAQ was basics like "What is a QR code?" and "Which devices support this?" Added 10 more items that real users would actually wonder about:

Added items:
- What's the difference between WPA2 and WPA3?
- What happens to the QR code if I change my WiFi password?
- Can I use this for a guest network?
- What should I do if the QR code won't scan?
- Does it support hidden SSIDs?

Since the site supports 4 languages, all FAQ items are managed as translation keys in `i18n.ts`.

```typescript
// client/src/lib/i18n.ts
"faq.q6": "What is the difference between WPA2 and WPA3?",
"faq.a6": "WPA3 is the latest WiFi security standard...",
"faq.q7": "What happens to the QR code if I change my WiFi password?",
"faq.a7": "The QR code is generated from your password at the time...",
```

Add the translation key, then add it to the array in `Home.tsx`:

```typescript
const faqs = [
  { q: t("faq.q1"), a: t("faq.a1") },
  // original 5
  { q: t("faq.q6"), a: t("faq.a6") },
  // q7 ~ q15
];
```

---

## Step 2 — Use Cases + Security Tips Sections

### Use Cases

Four use cases — hotel, café, office, home — displayed as cards. Used `lucide-react` icons for visual separation.

```typescript
const usecases = [
  { icon: <Building2 />, title: t("usecases.hotel.title"), desc: t("usecases.hotel.desc") },
  { icon: <Coffee />,    title: t("usecases.cafe.title"),  desc: t("usecases.cafe.desc") },
  { icon: <Users />,     title: t("usecases.office.title"), desc: t("usecases.office.desc") },
  { icon: <HomeIcon />,  title: t("usecases.home.title"), desc: t("usecases.home.desc") },
];
```

### Security Tips

A section that answers the implicit question "is it safe to share QR codes?" — four tips as cards: use WPA3, separate guest network, strong password, rotate regularly.

```typescript
const tips = [
  { icon: <Shield />,    title: t("tips.t1.title"), desc: t("tips.t1.desc") }, // WPA3
  { icon: <Users />,     title: t("tips.t2.title"), desc: t("tips.t2.desc") }, // Guest network
  { icon: <Lock />,      title: t("tips.t3.title"), desc: t("tips.t3.desc") }, // Strong password
  { icon: <RefreshCw />, title: t("tips.t4.title"), desc: t("tips.t4.desc") }, // Rotate regularly
];
```

---

## Step 3 — New /guide Page

Home page content alone wasn't enough, so I created an independent guide page. About 900 words of content.

| Section | Content |
|---------|---------|
| What Is a WiFi QR Code? | Explains the internal format (`WIFI:T:WPA;S:...;P:...`) |
| Device Compatibility | Support by iOS/Android version |
| Security Considerations | Recommend guest network separation, no WEP |
| Best Uses by Venue | Tips for hotel / café / office / home |
| Troubleshooting | Checklist when QR won't scan |

Added meta tags and canonical URL with `react-helmet-async`:

```typescript
// client/src/pages/Guide.tsx
<Helmet>
  <title>Complete Guide to WiFi QR Codes | WiFi QR Print</title>
  <meta name="description" content="Everything you need to know about WiFi QR codes..." />
  <link rel="canonical" href="https://wi-fi-qr.xyz/guide" />
</Helmet>
```

The QR format explanation is shown as an actual code block:

```
WIFI:T:WPA;S:YourNetworkName;P:YourPassword;H:false;;
```

Just this one format explanation creates a noticeable difference between "a site where you fill out a form" and "a site that teaches you something."

---

## Step 4 — New /about Page

Short but important. AdSense policy requires information about the site operator and service description.

Contents:
- What this tool does
- Why I built it
- Privacy policy summary

The last item mattered most. This is a site where you enter a WiFi password — I addressed the "can I trust this site?" question directly.

```typescript
// client/src/pages/About.tsx
<p>
  All processing happens locally in your browser. Your WiFi password is never
  transmitted to any server — it exists only in your browser's memory while
  you are on the page.
</p>
```

---

## Step 5 — Move Ad Banner + Footer Links

### Banner Position

```
Before:                    After:
[How-to]                   [How-to]
[AdBanner] ← no content   [Use Cases]
[FAQ 5 items]              [Security Tips]
                           [FAQ 15 items]
                           [AdBanner] ← after substantial content
```

Also changed the AdBanner format from `fluid` to `auto`. `fluid` made the ad too prominent when there was little content around it.

```typescript
// before
<AdBanner slot="9601998432" format="fluid" layoutKey="-6s+ed+2g-1n-4q" />

// after
<AdBanner slot="9601998432" format="auto" className="min-h-[90px]" />
```

### Footer Links

After creating new pages, crawlers need links to find them:

```typescript
// before — just Privacy
<Link href="/privacy">{t("footer.privacy")}</Link>

// after — Guide / About / Privacy
<div className="flex items-center gap-4">
  <Link href="/guide">{t("footer.guide")}</Link>
  <Link href="/about">{t("footer.about")}</Link>
  <Link href="/privacy">{t("footer.privacy")}</Link>
</div>
```

---

## Troubleshooting

**When translation keys pile up**

With 15 items across 4 languages, `i18n.ts` gets long. Section comments help:

```typescript
// --- FAQ ---
"faq.q1": "...",
// --- Use Cases ---
"usecases.hotel.title": "...",
```

If `t("faq.q6")` appears literally on screen in the dev server, that key is missing for that language. A good habit: when adding English keys, open the other language sections at the same time.

Chinese (zh) and German (de) are hard to write by hand. Used Claude or DeepL for machine translation and pasted into the file.

---

## Summary — The Core Flow

```
Rejection: insufficient content + bad ad placement
  ↓
Home page: FAQ 5→15, Use Cases, Security Tips added
  ↓
/guide page: 900-word guide content
  ↓
/about page: operator info + trust signals
  ↓
Ad banner: moved to after substantial content
  ↓
Footer links added → crawlers can find new pages
  ↓
Reapplied (under review)
```

| Item | Before | After |
|------|--------|-------|
| FAQ count | 5 | 15 |
| Content sections | How-to | How-to + Use Cases + Security Tips |
| Standalone pages | Home + Privacy | Home + Privacy + Guide + About |
| AdBanner position | After How-to | After FAQ |
| Footer links | Privacy (1) | Guide / About / Privacy (3) |

Google's standard turned out to be simple: "is there readable content next to the ads?" Tool sites are not exempt. I'll follow up when the reapplication result comes in.

---

*WiFi QR Code Generator series*
- [Part 1: Site Overview — WiFi QR Generator Built with AI](/posts/adsense_content_expansion_20260427)
- **Part 2: Google AdSense Rejected Me — The Reality of a Tool-Only Site (current)**
