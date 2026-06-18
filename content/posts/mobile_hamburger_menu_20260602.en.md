---
title: The Menu Is Cut Off on Mobile — Fix It with a Hamburger Menu
date: '2026-06-02'
description: >-
  How I Fixed the Scrolling Issue in the Next.js Blog Navigation on Mobile Using
  a Hamburger Menu
tags:
  - Next.js
  - React
  - Responsive Design
  - Tailwind CSS
---

## The Menu Was Being Pushed Off the Screen on Mobile

For a while after creating my blog, I only checked it on a desktop.

One day, when I checked it on my phone, the top navigation bar looked like this.

```
[Logo]  Home Posts Portfolio About [EN]
```

The screen was too narrow, so the menu was crammed in and sometimes hard to see. I had to scroll to see the entire menu.

I had to fix this.

---

## How to Solve This

There are three main approaches to handling mobile navigation.

| Approach | Description | Drawbacks |
|------|------|------|
| Reduce Font Size | Force everything onto a single line by shrinking the font | Poor readability |
| Bottom Tab Bar | Place an icon menu at the bottom of the screen | Requires major structural changes; feels like an app |
| Hamburger Menu | Expands a dropdown when the button is clicked | Adds an extra click |

Since the blog is content-centric and has only four menu items, I determined that the hamburger menu would be the cleanest solution.

I implemented the design so that the desktop version retains the existing horizontal menu, while the mobile version (screen width less than `md`) switches to the hamburger menu.

---

## Implementation

### Step 1 — Add Icon Component

I created it directly using SVG without a library. It’s lightweight and allows for flexible style customization.

```tsx
const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
```

---

### Step 2 — Managing the Menu’s Open State

```tsx
const [menuOpen, setMenuOpen] = useState(false);
```

We manage whether the menu is open or closed using a simple boolean.

---

### Step 3 — Adding the Hamburger Button

Place the button inside the existing header, next to the desktop navigation.

Use `md:hidden` to make it visible only on mobile, and use `hidden md:flex` for the desktop navigation to hide it on mobile.

```tsx
{/* Desktop nav — displayed only on screens of md or larger */}
<nav className="hidden md:flex items-center">
  {/* ...links... */}
</nav>

{/* Hamburger button — displayed only on screens smaller than medium */}
<button
  className="flex md:hidden items-center justify-center rounded-lg transition-colors"
  style={{
    padding: "0.375rem",
    color: "hsl(var(--muted-foreground))",
    background: menuOpen ? "hsl(var(--primary) / 0.1)" : "transparent",
  }}
  onClick={() => setMenuOpen((v) => !v)}
  aria-label="Open Menu"
>
  {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
</button>
```

When the button is open, a subtle background color is applied to visually indicate its state.

---

### Step 4 — Dropdown Menu Panel

Render the dropdown conditionally just below the header.

```tsx
{menuOpen && (
  <div
    className="md:hidden"
    style={{
 borderTop: "1px solid hsl(var(--border) / 0.4)",
 background: "hsl(var(--background) / 0.95)",
      backdropFilter: "blur(20px)",
    }}
  >
    <nav className="flex flex-col px-6 py-4" style={{ gap: "0.25rem" }}>
      {links.map(({ href, label }) => {
 const active = href === "/" ? cleanPath === "/" : cleanPath.startsWith(href);
        return (
 <Link
 key={href}
 href={href}
 onClick={() => setMenuOpen(false)} // Close the menu when the link is clicked
 className="flex items-center py-3 text-base font-medium transition-colors"
            style={{
 color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
 borderBottom: "1px solid hsl(var(--border) / 0.3)",
              gap: "0.75rem",
 }}
 >
 <span style={{
 fontFamily: "var(--font-mono), monospace",
 fontSize: "0.8rem",
              color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
 }}>
 {active ? "▶" : "○"}
            </span>
 {label}
 </Link>
 );
 })}
    </nav>
  </div>
)}
```

A few things to note:

- **Close menu on link click** — `onClick={() => setMenuOpen(false)}`. If omitted, the menu remains open even after navigating to the linked page.
- **Indicate current page** — Use `▶` / `○` to distinguish active links.
- **Background blur** — `backdropFilter: blur(20px)` to create a glass effect matching the header.
- **Separators** — Use `borderBottom` to separate each item.

---

### Step 5 — Closing the Menu When Clicking the Logo

I implemented the behavior so that clicking the logo while the menu is open navigates to the home page and closes the menu.

```tsx
<Link href="/" onClick={() => setMenuOpen(false)}>
  {/* Logo */}
</Link>
```

---

## Before and After Comparison

| | Before | After |
|--|---------|---------|
| Desktop | Horizontal menu | Horizontal menu (same) |
| Mobile | Menu takes up the entire screen, requires scrolling | Hamburger button → Dropdown |
| Current page indicator | Underline at the bottom | ▶ icon + color highlighting |

---

## Summary

```
Mobile navigation flow:

Header
├── [Desktop] hidden md:flex → Horizontal menu remains unchanged
└── [Mobile]  flex md:hidden → Hamburger button

Click button
├── menuOpen: false → true → Render dropdown
└── menuOpen: true  → false → Remove dropdown

Click dropdown link → setMenuOpen(false) → Closes automatically
```

Implemented using just an SVG icon and `useState`, without any libraries. By utilizing Tailwind’s reactive prefixes (`md:hidden`, `hidden md:flex`), you can neatly separate desktop and mobile versions.
