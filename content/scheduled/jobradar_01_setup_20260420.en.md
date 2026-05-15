---
title: '[JobRadar Part 1] Project Setup — I Built an AI Tool to Help Me Find a Job'
date: '2026-04-20'
publish_date: '2026-05-18'
description: From automated job scraping to AI matching — JobRadar side project part 1. A step-by-step walkthrough of the initial Next.js + Supabase + Vercel setup.
tags:
  - JobRadar
  - NextJS
  - Vercel
  - SideProject
---

When you're job hunting, the daily routine gets repetitive fast.

1. Open Indeed, Glassdoor
2. Search keywords (`React Native`, `Fullstack`, `Node.js`...)
3. Open each listing one by one
4. Ask yourself "is this a good fit?"
5. If yes, write a cover letter
6. Adjust the tone for each company
7. Repeat

Doing this cycle 3–5 times a day is exhausting. The cover letters are the worst part. Similar content but different for every company, and after a while you start losing track of who you even are.

So I had an idea. **What if I handed all of this to AI?**

Auto-collect listings → AI picks the ones that match me → auto-generate cover letters → get a summary email every morning.

That's the origin of **JobRadar**.

This series documents building JobRadar from scratch. Part 1 covers the initial setup — from creating the Next.js project to deploying on Vercel.

---

## Tech Stack at a Glance

| Role | Tech | Why |
|------|------|-----|
| Framework | Next.js (TypeScript + App Router) | Frontend + API Routes in one |
| Styles | Tailwind CSS | Fast UI work |
| DB | Supabase (PostgreSQL) | Free tier, real-time features |
| AI | Claude API (Anthropic) | Matching score + cover letter generation |
| Scraping | Playwright | Handles JS-rendered pages |
| Email | Resend | Free 3,000/month |
| Deploy | Vercel | Next.js optimized, free |
| Scheduler | Vercel Cron Jobs | Daily auto-scraping + email |

**Cost during MVP: $0.** Everything fits inside the free tier.

---

## Prerequisites

- Node.js 18+
- GitHub account
- Vercel account (signing up with GitHub is easiest)
- Basic terminal usage

---

## Step 1 — Create the Next.js Project

Use `create-next-app` to scaffold the project. You'll be prompted for options — match these settings:

```bash
npx create-next-app@latest jobradar
```

Prompts during install:

```
✔ Would you like to use TypeScript? › Yes
✔ Would you like to use ESLint? › Yes
✔ Would you like to use Tailwind CSS? › Yes
✔ Would you like your code inside a `src/` directory? › Yes
✔ Would you like to use App Router? (recommended) › Yes
✔ Would you like to use Turbopack for next dev? › No
✔ Would you like to customize the import alias? › No
```

The `src/` structure and App Router are the important choices here. They keep folders clean and make API Route management easier later.

After setup, you'll have this structure:

```
jobradar/
├── src/
│   └── app/
│       ├── favicon.ico
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── public/
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── eslint.config.mjs
└── tsconfig.json
```

Run it to confirm:

```bash
cd jobradar
npm run dev
```

If you see the Next.js default screen at `http://localhost:3000`, you're good.

---

## Step 2 — Folder Structure Design

Add domain-specific folders to the base structure. Setting this up from the start saves a lot of confusion once files start multiplying.

```
src/
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── jobs/[id]/page.tsx    # Job detail page
│   ├── profile/page.tsx      # My profile settings
│   └── api/
│       ├── scrape/route.ts   # Scraping API (Cron trigger)
│       ├── match/route.ts    # AI matching API
│       ├── cover/route.ts    # Cover letter generation API
│       └── digest/route.ts   # Email sending API
├── components/
│   ├── jobs/                 # Job-related components
│   ├── cover/                # Cover letter components
│   └── ui/                   # Shared UI components
├── lib/
│   ├── scrapers/             # Scrapers (Indeed, Glassdoor)
│   ├── claude.ts             # Claude API client
│   ├── supabase.ts           # Supabase client
│   └── email.ts              # Resend email
└── types/
    └── index.ts              # Shared TypeScript types
```

`lib/` is where external service clients live. **Establish the rule early: Supabase client only via `lib/supabase.ts`, Claude API only via `lib/claude.ts`.** This makes things much easier to manage later.

---

## Step 3 — Environment Variables

Never put API keys or DB credentials directly in code. Store them in `.env.local` and add it to `.gitignore` to keep them off GitHub.

```bash
# .env.example
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
RESEND_API_KEY=
```

Verify `.gitignore` includes:

```bash
.env*
!.env.example   # exception — .env.example should be committed
```

Without `!.env.example`, the example file gets ignored too.

---

## Step 4 — Write CLAUDE.md

This project is developed with Claude Code. Create `CLAUDE.md` at the project root so the AI editor understands the project context.

```markdown
# JobRadar — CLAUDE.md

## Project
AI-powered job matching & cover letter automation.
Auto-collect AU/NZ IT job listings → Claude API matching → custom cover letter generation → email digest.

## Tech Stack
- Framework: Next.js 14 App Router + TypeScript
- Styles: Tailwind CSS
- DB: Supabase (PostgreSQL)
- AI: Claude API (Anthropic SDK)
- Scraping: Playwright
- Email: Resend
- Deploy: Vercel + Vercel Cron

## Coding Rules
- Use TypeScript strict mode
- Supabase client: import only from src/lib/supabase.ts
- Claude API: import only from src/lib/claude.ts
- Env vars: use .env.local, never commit
- Server components by default, 'use client' only when client state is needed
```

A well-written `CLAUDE.md` means you can just say "create a Supabase client" and the AI puts it in the right place automatically.

---

## Step 5 — Create GitHub Repo and Push

```bash
git init
git add src/ public/ next.config.ts package.json tsconfig.json
git add eslint.config.mjs postcss.config.mjs .gitignore .env.example CLAUDE.md
git commit -m "Initial commit from Create Next App"
git remote add origin https://github.com/your-username/jobradar.git
git branch -M main
git push -u origin main
```

Avoid `git add -A` or `git add .` — sensitive files like `.env.local` could sneak in.

---

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and log in with GitHub
2. Click `Add New Project`
3. Select the `jobradar` repo you just pushed
4. Leave settings at default (Next.js auto-detected)
5. Click `Deploy`

After 2–3 minutes you'll have a `https://jobradar-xxxx.vercel.app` URL. Every push to `main` will trigger an automatic redeployment.

---

## Common Commands

```bash
npm run dev        # start dev server
npm run build      # build check (verify locally before deploying)
npx tsc --noEmit   # type check
npm run lint       # lint
```

---

## Troubleshooting

**`.env.example` getting caught by gitignore**

If `.gitignore` only has `.env*`, it catches `.env.example` too.

```
.env*
!.env.example
```

**Environment variable errors after Vercel deploy**

Local `.env.local` values don't automatically sync to Vercel. Go to Vercel Dashboard → Settings → Environment Variables and add them manually.

---

## Summary — The Core Flow

```
npx create-next-app → folder structure → env vars
→ CLAUDE.md → GitHub push → Vercel deploy
```

Next up: using Playwright to scrape Indeed and Seek, and everything that went wrong along the way.

Full code: [github.com/hyunseokyu1-netizen/jobradar](https://github.com/hyunseokyu1-netizen/jobradar)
