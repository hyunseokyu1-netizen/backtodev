---
title: 'Trying Out Jina AI: Making Job Postings Readable by an LLM, and Matching Them to Resumes'
date: '2026-07-02'
publish_date: '2026-07-24'
description: From Reader turning URLs into markdown, to embeddings and rerankers — why matchda is adopting Jina AI for job matching, and hands-on usage
tags:
  - Jina AI
  - LLM
  - Embeddings
  - Web Scraping
  - matchda
---

## Tired of scraping, I went looking for another way

Building the job-matching service **matchda**, the wall I kept hitting first was always the same. **Reading job posting pages.**

Given a posting URL, I need to extract "the role, requirements, and preferred qualifications" — but actually scraping it:

- what worked locally would get blocked with a **403** on the server
- ran into **Cloudflare** bot blocking
- most job sites these days are **SPAs**, so even getting the HTML leaves the body empty (content only fills in after JS renders)

I'd tried spinning up a headless browser with Playwright too, but the server cost and maintenance weren't trivial. Right as I was thinking "do I really need to go this far just to read a job posting's text," I found **Jina AI**.

This post is a hands-on record of Jina AI's core APIs, and a writeup of why matchda is adopting it.

## What is Jina AI

Jina AI is a service providing "infrastructure for search and LLMs" as APIs. It has several products, but four stood out from matchda's perspective.

| API | What it does | Use in matchda |
|-----|---------|---------------------|
| **Reader** (`r.jina.ai`) | URL → clean markdown | reading job posting pages (replaces scraping) |
| **Search** (`s.jina.ai`) | search query → top results as markdown | enriching company/posting info |
| **Embeddings** | text → vector | semantic matching between resume ↔ posting |
| **Reranker** | reorders a candidate list | precisely sorting match results |

In other words, matchda's pipeline — **"read the posting → match candidates → sort"** — maps almost 1:1 onto Jina's product lineup. This was the decisive reason to consider adopting it.

## Prerequisites: an API key

Reader and Search can be tried immediately **with no key** (just a lower rate limit). Embeddings and Reranker need a key. Sign up at [jina.ai](https://jina.ai) and you get an API key issued, plus free-tier tokens. The key goes into the header like this.

```
Authorization: Bearer jina_xxxxxxxxxxxxxxxx
```

> Exact free limits and pricing change from time to time, so it's worth checking the [pricing page](https://jina.ai). For this post, I'll just note that "there's enough free tier to test thoroughly."

## Step 1. Reader — URL to markdown (the core piece)

The feature matchda welcomed most. Usage is absurdly simple. **Just prepend `https://r.jina.ai/` to the URL you want to read.**

```bash
curl "https://r.jina.ai/https://example.com/jobs/12345"
```

The response organizes that page's body into **markdown an LLM can easily consume.** Noise like ads, navigation, sidebars gets stripped, focusing on title and body content.

The key is that Jina **handles rendering and bot-blocking countermeasures on its side.** Even SPAs return content after JS execution, so the body comes through without me running Playwright myself. It effectively routes around the 403 problem my server was hitting, via Jina's infrastructure.

Add a key, and the rate limit goes up, plus you can tune behavior via headers.

```bash
curl "https://r.jina.ai/https://example.com/jobs/12345" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-Return-Format: markdown" \
  -H "X-Target-Selector: main"          # extract only a specific CSS region
```

- `X-Return-Format`: choose `markdown` / `text` / `html`
- `X-Target-Selector`: give the selector for the posting's body region for more accurate extraction

In matchda, the markdown received this way gets passed directly to the LLM (Claude) to structure "role / requirements / preferred qualifications." **The scraping code disappearing entirely, replaced by a single line of URL,** is the biggest change.

## Step 2. Search — turning search results into markdown, wholesale

When there's only a company name and not enough info, scraping search results is also done with a single URL. Append the search query after `https://s.jina.ai/`.

```bash
curl "https://s.jina.ai/?q=matchda+hiring+company+profile" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

It returns several top search results, **each organized down to its body markdown.** Unlike a typical search API that only gives links and snippets, this comes in a form directly feedable to an LLM, which is convenient. In matchda, this is under consideration for enriching company info not written in the posting (size, domain).

## Step 3. Embeddings — connecting resume and posting by "meaning"

This is where matchda's real heart is. Matching needs to be based on **whether the meaning aligns**, not whether keywords overlap. "React developer" and "frontend engineer" are different words for the same role.

Embeddings are what converts text into a vector for this.

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jina-embeddings-v3",
    "input": [
      "3 years of web frontend development with React, TypeScript",
      "Frontend Engineer — building Next.js-based services"
    ]
  }'
```

The response gives back a vector for each sentence. Computing the **cosine similarity** between a resume vector and a posting vector gives a numeric score for how well they match. Even a resume mixing Korean and English gets handled in one pass, thanks to the multilingual model. This is where matchda's "this posting is an 82% match for you" metric comes from.

## Step 4. Reranker — precisely sorting match results

Say embeddings narrowed things down to 100 candidate postings. These need to be re-sorted into the order shown to the user, and embedding similarity alone sometimes falls short on fine-grained ranking. A reranker takes "one query + several candidates" and **re-ranks them by relevance.**

```bash
curl https://api.jina.ai/v1/rerank \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jina-reranker-v2-base-multilingual",
    "query": "3 years React frontend experience, prefers startups",
    "documents": [
      "Frontend Engineer (React) — Series A startup",
      "Backend Developer (Java) — large enterprise",
      "Web Publisher — agency"
    ],
    "top_n": 3
  }'
```

Each document comes back sorted with a `relevance_score` attached. This is exactly why matchda's final match list is designed as a two-stage structure — "narrow candidates via embeddings → precisely sort via reranker."

## Why matchda wants to use Jina, in one line each

| Problem | Old approach | After adopting Jina |
|------|-----------|--------------|
| Reading a posting page | Playwright + fighting 403/Cloudflare | one line, a Reader URL |
| Enriching company info | search API + re-crawling the body | one Search call |
| Resume-posting matching | keyword matching (imprecise) | semantic matching via Embeddings |
| Sorting results | simple score order | precise sorting via Reranker |

In the end, matchda's entire pipeline maps onto Jina's products one by one. In particular, **Reader alone — escaping scraping hell** — was worth the adoption on its own.

## Troubleshooting

| Symptom | Cause | Fix |
|------|------|------|
| Reader returns empty content | content behind a login/paywall | only public URLs work. Pages requiring auth can't be read |
| 429 Too Many Requests | exceeded the keyless rate limit | issue an API key and add it to the header |
| Body content mixed with clutter | selector not specified | specify the body region with `X-Target-Selector` |
| Match scores look off | sentences are too long | split resume/posting into item-level chunks before embedding |

## Summary

- **Reader** (`r.jina.ai/<URL>`): replaces scraping with a single line of URL — the core of matchda's adoption
- **Search** (`s.jina.ai`): turns search results into body markdown
- **Embeddings** (`jina-embeddings-v3`): semantic matching between resume ↔ posting
- **Reranker** (`jina-reranker-v2`): precisely sorts match results
- Reader/Search testable with no key, Embeddings/Reranker need a key

Building matchda, the appeal was that everything from "reading a job posting" to "connecting a person and a posting" gets solved within a single service. Being able to spend the time I used to wrestle with scraping on the actual matching logic instead — that's the real reason for adopting Jina.
