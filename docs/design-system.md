# BackToDev Design System (Dark Blog UI)

## 🎯 Goal
Transform the current blog UI into a **premium dark developer blog**
while maintaining a **personal growth narrative (NOT portfolio site)**.

Key principles:
- Content-first (blog readability > visual flex)
- Developer aesthetic (minimal, sharp, focused)
- Subtle premium feel (NOT over-designed)

---

## 🎨 Color System

### Background
- Primary: #0A0F14
- Secondary: #0F1720
- Card: #111827

### Text
- Primary: #E5E7EB
- Secondary: #9CA3AF
- Muted: #6B7280

### Accent (IMPORTANT: use ONLY ONE tone)
- Primary Accent: #00FFC6
- Hover Accent: #00D1A7

❌ Do NOT mix blue + green gradients  
✅ Use a consistent teal accent

---

## 🔤 Typography

### Font Style
- Sans-serif (Inter or similar)

### Hierarchy
- Hero Title: 56~64px / bold / tight line-height
- Section Title: 24~32px
- Body: 16~18px (VERY IMPORTANT)
- Caption: 14px

### Rules
- Increase line-height for readability (1.6+)
- Avoid overly thin fonts

---

## 🧱 Layout System

### Max Width
- 1100px ~ 1200px

### Spacing
- Section spacing: 80px ~ 120px
- Card gap: 24px
- Inner padding: 24px ~ 32px

👉 IMPORTANT:
White space = premium feel

---

## 🧩 Hero Section (Landing)

### Structure
- Small label (Hello World)
- Main headline (2 lines max)
- Sub text (1 short sentence)
- CTA buttons (2 max)

### Style Rules
- Headline should dominate screen (visual weight 70%)
- Accent color ONLY on key phrase
- Subtext must be clearly readable (increase contrast)

### Example
"40대 PM, 다시 개발자로 돌아갑니다."

---

## 🧾 Post Card UI

### Card Style
- Background: #111827
- Border: 1px solid rgba(255,255,255,0.05)
- Border radius: 12px ~ 16px

### Hover Interaction
- Slight lift (translateY -4px)
- Subtle glow:
  box-shadow: 0 0 20px rgba(0,255,198,0.1)

### Content
- Date + read time (small, muted)
- Title (bold, high contrast)
- Description (1 line max)
- Tags (pill style)

---

## ✨ Interaction Design

### Buttons
Primary:
- Background: #00FFC6
- Text: #000
- Hover: darker teal

Secondary:
- Transparent
- Border: 1px solid rgba(255,255,255,0.1)

### Motion
- Transition: 0.2s ease
- Avoid heavy animation

---

## ⚠️ Critical UX Rules

1. Readability > Style
   - No low-contrast gray text
   - No small font

2. Do NOT make it look like a portfolio
   - This is a BLOG
   - Content must feel alive and ongoing

3. Avoid over-design
   - No excessive gradients
   - No heavy shadows

---

## 🚀 Advanced Improvements (Optional)

### Add subtle background texture
- Noise or dot grid (very low opacity)

### Add hover effect to cards
- Slight border glow using accent color

### Improve CTA visibility
- Make "Read Posts" visually dominant

---

## 🧠 Design Intent Summary

This blog should feel like:

- A developer rebuilding their career
- Honest, raw, and focused
- Clean but not corporate
- Personal but not messy

NOT:
- A startup landing page
- A polished portfolio
- A design showcase

---

## 🛠 Implementation Request

Refactor the existing UI based on this system.

Focus on:
1. Typography scaling
2. Spacing improvements
3. Card UI enhancement
4. Color consistency (remove blue tones)
5. Readability fixes

Keep:
- Current layout structure
- Content hierarchy
- Blog-first experience
