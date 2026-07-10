---
title: 'Building a Tailored Resume With AI While Keeping DOCX Formatting Intact — JSZip + Claude API'
date: '2026-06-11'
publish_date: '2026-06-25'
description: How I used JSZip to manipulate a DOCX's internal XML directly, keeping the original layout untouched while letting Claude AI rewrite only the paragraph text to match a job description
tags:
  - JSZip
  - Claude API
  - DOCX
  - Next.js
  - TypeScript
---

## The problem with bolting AI onto a resume

I'd seen plenty of AI cover letter generators, and wondered why nobody did the same for resumes. Building it myself, I quickly understood why.

A cover letter is text you write fresh every time, so pasting in whatever the AI generates works fine. A resume is different — you have **a carefully built, personal DOCX template.** Font, colors, margins, section layout... throw that away and let AI build one from scratch, and of course it's unusable.

And no matter how carefully you prompt an AI to "keep this exact formatting," the moment you extract a DOCX to text and regenerate it as DOCX, the original layout is gone.

**There was only one thing I wanted**: leave the original DOCX file's layout untouched, and only change the paragraph text to fit a job description.

Today I'm sharing how I built that.

---

## The core idea: a DOCX is a ZIP

Rename a DOCX file to `.zip` and open it, and you get a folder structure.

```
word/
├── document.xml   ← the entire body lives here
├── styles.xml     ← font/color/style definitions
├── theme/
└── ...
```

Formatting info lives in `styles.xml` and in each run's (`<w:r>`) properties, and **the actual text content only lives inside `<w:t>` tags**.

Meaning: change only the text inside `<w:t>` in `document.xml`, and you can replace the content while leaving the formatting completely untouched.

The library that handles this in Node.js is **JSZip**.

---

## Prerequisites

```bash
npm install jszip
```

If you're using TypeScript, type declarations come bundled — no separate `@types/jszip` needed.

---

## Step 1: Open the DOCX and extract paragraphs

The `loadDocx` function does two things.

1. Opens the DOCX (ZIP) and reads `word/document.xml` as a string
2. Walks through it paragraph by paragraph (`<w:p>`), joins together the `<w:t>` text inside each, and returns it along with its index

```typescript
// src/lib/docx-rewrite.ts

import JSZip from 'jszip'

const PARA_RE = /<w:p\b[^>/]*>[\s\S]*?<\/w:p>/g
const WT_RE   = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g

export interface DocxDocument {
  zip: JSZip
  xml: string
  paragraphs: { index: number; text: string }[]
}

export async function loadDocx(buffer: Buffer): Promise<DocxDocument> {
  const zip  = await JSZip.loadAsync(buffer)
  const file = zip.file('word/document.xml')
  if (!file) throw new Error('Not a valid DOCX file.')
  const xml = await file.async('string')

  const paragraphs: { index: number; text: string }[] = []
  let i = 0
  for (const m of xml.matchAll(PARA_RE)) {
    const text = [...m[0].matchAll(WT_RE)]
      .map(t => decodeXml(t[2]))
      .join('')
    paragraphs.push({ index: i, text })
    i++
  }
  return { zip, xml, paragraphs }
}
```

A single paragraph (`<w:p>`) can contain multiple `<w:t>` tags. Word splits runs this way due to autocomplete or spell-check corrections — a sentence that looks like one continuous chunk to a human eye is often split across several `<w:t>` tags in the XML. That's why you need `.join('')` to see the actual text.

---

## Step 2: Ask Claude to return only the paragraphs to change

Attach an index number to each extracted paragraph and hand them to Claude.

```typescript
const numbered = doc.paragraphs
  .filter(p => p.text.trim())           // exclude empty paragraphs
  .map(p => `[${p.index}] ${p.text}`)
  .join('\n')
```

The output looks something like this.

```
[2] Senior Software Engineer
[3] Passionate software engineer with 5+ years of experience in...
[5] Led migration of monolithic system to microservices architecture...
```

Send this along with the job description to Claude, instructing it to **return JSON only**.

```typescript
const message = await anthropic.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 8000,
  thinking: { type: 'adaptive' },
  messages: [{
    role: 'user',
    content: `...
## Rules
- Output only the paragraphs to change, as JSON in the format {"replacements": [{"i": paragraphIndex, "text": "new text"}]}. No text outside the JSON.
- Focus on the Professional Summary and experience bullets, rewriting them to match the JD's keywords and requirements
- Never modify paragraphs for name, contact info, company names, job titles, employment dates, education, or section headings
- Use only facts present in the original — never invent experience, skills, or numbers
- Keep each new paragraph's text a similar length to the original (within ±30%, so the layout doesn't break)`,
  }],
})
```

An example of what Claude sends back:

```json
{
  "replacements": [
    { "i": 3, "text": "Results-driven software engineer with 5+ years of experience in cloud-native..." },
    { "i": 5, "text": "Architected and led migration from monolithic Rails app to event-driven microservices..." }
  ]
}
```

---

## Step 3: Swap only the text into the original XML

This is the core part. Here's what `applyReplacements` does, spelled out:

1. Walk through each `<w:p>` (paragraph) in the original XML
2. If its index matches one Claude flagged for change (`Map<number, string>`), replace the inner `<w:t>`
3. **Put the entire new text into only the first `<w:t>`**, and empty out the rest
4. Return paragraphs with no edit instruction as-is

```typescript
export async function applyReplacements(
  doc: DocxDocument,
  replacements: Map<number, string>
): Promise<Buffer> {
  let i = 0
  const newXml = doc.xml.replace(PARA_RE, para => {
    const newText = replacements.get(i)
    i++
    if (newText === undefined) return para   // not a target → keep as-is

    let first = true
    return para.replace(WT_RE, (_m, open, _content, close) => {
      if (first) {
        first = false
        // without xml:space="preserve", leading/trailing whitespace can be dropped
        const openTag = open.includes('xml:space')
          ? open
          : open.replace('<w:t', '<w:t xml:space="preserve"')
        return openTag + encodeXml(newText) + close
      }
      return open + close   // empty out the remaining w:t tags
    })
  })

  doc.zip.file('word/document.xml', newXml)
  return doc.zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Promise<Buffer>
}
```

You might wonder, "why only the first `<w:t>`?" Each `<w:t>` carries its own run properties (`<w:rPr>`) — font size, bold, etc. Split the text across multiple runs, and formatting can change mid-sentence. So I chose to carry over the first run's formatting and pour the entire text into it.

---

## Step 4: Sending the result down to the browser

The server action base64-encodes the resulting Buffer and hands it to the client, where it's reconstructed into a Blob for download.

**Server action (actions.ts)**

```typescript
const result = await applyReplacements(doc, replacements)

const safe = (s: string) => s.replace(/[^\w가-힣-]+/g, '_').slice(0, 30)
return {
  base64: result.toString('base64'),
  filename: `resume_${safe(job.company)}_${safe(job.title)}.docx`,
}
```

**Client component**

```typescript
const res = await generateTailoredResumeDocx(jobId)
if (res.base64 && res.filename) {
  const bytes  = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0))
  const blob   = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = res.filename
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## The full flow, summarized

```
User uploads a DOCX
      ↓
Original stored in Supabase Storage (profiles.resume_file_path)
      ↓
[Tailored resume generation requested]
      ↓
Download the original DOCX from Storage
      ↓
loadDocx() → extract the paragraph list (index + text)
      ↓
Claude API → returns JSON of the paragraphs to rewrite, based on the JD
      ↓
applyReplacements() → replaces only the w:t nodes, keeps formatting intact
      ↓
Buffer → Base64 → client → Blob download
```

---

## Troubleshooting

### w:t text comes out truncated

This happens when a single paragraph has multiple split `<w:t>` tags. If `.join('')` is missing in `loadDocx`, only the first run's text gets returned. Files created with Word's autocomplete or spell-check enabled tend to have runs split into smaller pieces.

### The downloaded DOCX won't open

The XML is malformed. If `encodeXml` was skipped and the new text contains `<`, `>`, or `&`, an XML parsing error results. Text coming back from Claude's response must always go through `encodeXml()`.

### Whitespace disappears — related to xml:space="preserve"

Leading/trailing whitespace around `<w:t>` gets stripped by the XML parser unless the `xml:space="preserve"` attribute is present. This especially shows up in paragraphs with indentation or a space after a bullet. `applyReplacements` handles this by adding the attribute automatically if it's missing.

### Table cells break

Each table cell is also wrapped in `<w:p>`. When telling Claude which paragraphs to target, table cells get numbered too. You need a clear rule in the prompt — "never modify section headings and layout elements" — to keep it from touching table cells.

---

## Wrap-up

The core of this approach is that **the DOCX is never converted to text.** The common alternative (convert to HTML/text via mammoth or similar → AI rewrites → regenerate as DOCX) forces you to give up the original formatting.

Access the DOCX's internal XML directly via JSZip and swap only the `<w:t>` nodes, and you can change just the text while leaving font, color, margins, table structure, and everything else untouched. The implementation itself is simpler than you'd expect, and easy to test too.

| Approach | Keeps formatting | Implementation difficulty |
|---|---|---|
| Extract text, regenerate DOCX | No | Low |
| Convert via pandoc | Partial | Medium |
| Swap w:t directly with JSZip | Yes | Medium |

Beyond resumes, this same approach applies anywhere you need AI to fill in only part of a **formatting-sensitive DOCX** — contracts, reports, and so on.
