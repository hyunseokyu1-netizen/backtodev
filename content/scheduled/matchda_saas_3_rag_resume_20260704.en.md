---
title: 'Building a SaaS With an AI Coding Assistant (3): A RAG Tailored Resume, Built Without Embeddings'
date: '2026-07-04'
publish_date: '2026-08-02'
description: From auto-analyzing an uploaded resume file, to a RAG-style tailored resume implemented with nothing but keyword overlap and no extra infrastructure, to DOCX/PDF downloads that keep the on-screen formatting
tags:
  - RAG
  - Claude API
  - Next.js
  - Resume Automation
  - SaaS
---

## Starting off

Part 1 covered cleaning up URLs and flow, Part 2 covered a data-loss incident. This part covers the most "product-like" work from the same session — three features around handling resumes.

- Resume file upload → automatic AI analysis → auto-filling basic info
- RAG-style tailored resume generation, referencing previously written tailored resumes
- DOCX/PDF downloads that faithfully preserve the on-screen design

These three features aren't independent — they feed data into each other. An uploaded resume fills out a structured profile, that profile becomes the material for tailored resume generation, and as tailored resumes accumulate they become RAG reference material for the next one.

## Why it was needed

MatchDa is a service that "restructures a Korean resume into English, tailored to a job posting." But the early version required users to type resume content into a form field by field. Using it for real, this step alone caused a lot of drop-off — nobody wants to retype a PDF/DOCX resume they already have.

There was also this: repeatedly building tailored resumes across many postings raises a style-consistency problem — "how did I phrase this experience last time?" Rather than writing completely from scratch every time, it's more natural to reuse phrasing that worked well before.

## Step 1. Resume file upload → automatic analysis

This is what commit `e597828` implemented. I put an upload banner at the top of the resume studio (`/profile`) — upload a PDF/DOCX, and it auto-analyzes and fills the editor fields.

```
feat: resume file upload → AI auto-analysis → auto-fill studio basic info

- Added a PDF/DOCX upload banner to the top of the resume studio
- analyzeResumeFile action: extract file text → structure with Haiku
  (name/title/summary/experience/skills/education) → save to onboarding_ko/en → return result
- Editor fields on the left auto-fill immediately after upload; review/edit then save
- The original DOCX is kept in storage, used later for tailored-resume DOCX generation
```

The key decision here was **model choice.** Structuring a resume isn't creative writing — it's closer to extraction work, pulling fields out of text. So instead of a heavy model, I used **Claude Haiku.** Fast responses and low cost let me build a user experience where the result fills in within a few seconds of uploading.

The flow looks like this.

```
Upload PDF/DOCX
   │
   ▼
Extract text from the file
   │
   ▼
Ask Haiku to "structure this into name/title/summary/experience/skills/education"
   │
   ▼
Save into the onboarding_ko / onboarding_en columns
   │
   ▼
Auto-fill editor fields (user reviews/edits, then saves)
```

I also kept the original DOCX file itself in storage — to use as a formatting reference later, when regenerating a tailored resume as DOCX.

## Step 2. Boosting tailored resumes with RAG — no embeddings

This is the most interesting part of the session. Say "RAG (Retrieval-Augmented Generation)" and people usually picture an embedding model and a vector DB (pgvector, Pinecone, etc.). But standing up a separate vector infrastructure at the side-project stage would have been overkill. So I implemented RAG with **simple keyword-overlap scoring** instead.

Here's the core logic from commit `2a3b0b2`.

```ts
// src/app/actions.ts
// extract core keywords from the JD (strip stopwords, lowercase)
const RAG_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'our', 'are', 'will', 'that', 'this', ...
])
function ragKeywords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) ?? []
  return new Set(words.filter(w => !RAG_STOPWORDS.has(w)))
}
function ragScore(text: string, kws: Set<string>): number {
  const words = text.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) ?? []
  let s = 0
  for (const w of words) if (kws.has(w)) s++
  return s
}
```

Broken down step by step, here's how it works.

1. Build a set of core keywords from the new posting's JD, with stopwords removed.
2. Fetch up to 30 tailored resumes the user previously wrote for other postings (the `tailored_resumes` table, excluding the current job).
3. Score each past resume's text by counting how many times the new JD's keywords appear in it.
4. Take only the top 3 with a score above 0, and inject them into the prompt as "reference context."

```ts
async function retrievePastResumes(profileId: string, jobId: string, jd: string): Promise<string> {
  const { data: past } = await supabaseAdmin
    .from('tailored_resumes')
    .select('job_id, content')
    .eq('user_id', profileId)
    .neq('job_id', jobId)
    .not('content', 'is', null)
    .limit(30)
  if (!past?.length) return ''

  const kws = ragKeywords(jd)
  const ranked = past
    .map(p => ({ ...p, score: ragScore(p.content ?? '', kws) }))
    .sort((a, b) => b.score - a.score)
    .filter(p => p.score > 0)
    .slice(0, 3)
  // ... assemble the top 3 into text as "reference resumes" and return it
}
```

The advantages of this approach are clear.

| | Embedding + vector DB approach | Keyword overlap approach |
|---|---|---|
| Extra infrastructure | Needs a vector DB, embedding API calls | None (existing Postgres queries suffice) |
| Latency | Embedding computation + similarity search | In-memory scoring, a few ms |
| Accuracy | Captures semantic similarity too | Captures only surface-level keyword matches |
| Data scale | Favors thousands to tens of thousands of records | Suits tens to hundreds of records |

At an early product stage where a single user has at most a few dozen tailored resumes, keyword overlap alone was enough to pick out "the top 3 most relevant past resumes." If the data grows later and accuracy falls short, that's the time to swap in embeddings — putting a vector DB in place at this stage would have been over-engineering.

**The single most important rule when using this RAG setup**: the reference material is strictly for "phrasing and emphasis style," and **the source of truth for facts is always limited to the original resume.** I baked this constraint explicitly into the prompt too.

```
## Original resume (the sole source of facts)
${baseResume}

## Tailored resumes previously written for similar postings (reference phrasing/emphasis only, do not add new facts)
${pastContext}

## Writing requirements
- Facts must come only from the "original resume." Never fabricate or
  exaggerate experience, skills, numbers, or company names
- The "past tailored resumes" are for referencing emphasis, phrasing, and
  bullet style only — do not pull new facts from them
```

Without this, phrasing from past tailored resumes (which is itself already slightly embellished) could get reproduced over and over, drifting further and further from the original facts — a kind of "compounding hallucination" effect. Separating the RAG source from the fact source at the prompt level was the key.

Another thing I was careful about was handling users without a `resume_text` (uploaded raw text). Even with just the structured profile entered during onboarding (`onboarding_en`), I made it possible to assemble a fact-based text substitute like this.

```ts
function structuredResumeText(onboardingEn: unknown): string {
  // assemble name, title, summary, experience[], skills[], education[]
  // into section-by-section text
}
```

This connects naturally back to Step 1's auto-fill feature — if there's a structured profile filled in from an upload, a tailored resume can be generated even without the original raw text.

## Step 3. DOCX/PDF downloads that keep the formatting

Even with great RAG-generated content, if the download comes out as a bare plain-text file, it's awkward to actually use. DOCX downloads originally were plain-text level, but commits `fa033c3` and `2b54721` improved this to preserve the on-screen design.

```
feat: apply on-screen design formatting to resume DOCX + add PDF/DOCX download to profile

- Generate DOCX as a formatted document instead of plain text (bold/color for
  name/title/sections, right-aligned date ranges, bullet lists, section dividers,
  brand accent color)
- Added studioToRender/docToRender/renderResumeHtml as a shared render model
```

What worked well here was setting up a single **"shared render model"** and having the on-screen preview, DOCX, and PDF all consume that same model.

```
Structured resume data
        │
        ▼
  renderResumeHtml (shared render model)
   ├──▶ On-screen preview (React)
   ├──▶ DOCX generation (docx library)
   └──▶ PDF generation (html2canvas + jsPDF)
```

This eliminates at the source the common mismatch problem of "it looks like this on screen but comes out different when downloaded."

The PDF side had a more fundamental change. It originally used the browser's print dialog (`window.print()`), which stamped a URL footer and forced the user to manually pick "Save as PDF" every time. In `2b54721`, I switched to rasterizing the screen with `html2canvas` and building the actual file directly with `jsPDF`.

```
feat: download resume PDF as a real file instead of via print

- Generate the PDF file directly with html2canvas + jsPDF instead of the
  print dialog (which included a URL footer)
- Korean text displays correctly by rasterizing the browser's rendering;
  auto-splits into A4 pages
- Removed the unused printResumeHtml, added the html2canvas dependency
```

Instead of embedding Korean fonts directly into a PDF library, the pragmatic choice was to "capture the screen the browser already renders well as an image, and paste that whole image into the PDF." This sidesteps font embedding/subsetting issues entirely. The catch is that once a page gets long enough to exceed a single A4 sheet, the captured image needs to be sliced by page height and pasted across multiple pages.

## Summary

One principle ran through all three features in this part — **"pick the simplest solution that fits the current scale."**

| Feature | The common choice | What I actually chose | Why |
|---|---|---|---|
| Resume structuring | Precise extraction with a heavy model | Claude Haiku | Speed and cost matter more for extraction work |
| Tailored resume reference search | Embeddings + vector DB | Keyword overlap scoring | Enough for tens of records per user, zero infrastructure |
| PDF generation | Embed Korean fonts in a PDF library | Capture the screen and insert as an image | Sidesteps font issues, guarantees 100% match with the screen |

For all three features, a "theoretically more sophisticated method" exists — but at this stage, the simpler method was actually easier to maintain and delivered a good enough user experience. Implementing it firsthand made clear that RAG doesn't necessarily require a vector DB.

Next up: implementing one-click job-posting collection via recommended-company presets, a support chatbot, and the Stripe subscription billing work in progress.
