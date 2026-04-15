---
title: 'Comparing 3 translation APIs - MyMemory vs DeepL vs Claude, what should I use?'
date: '2026-04-15'
description: >-
  I'm comparing and contrasting my experience with MyMemory, DeepL, and Claude
  APIs while adding translation functionality to my blog admin.
tags:
  - Translation API
  - DeepL
  - MyMemory
  - Claude API
  - Next.js
---

## I wanted to add a translation feature to my blog

Write a post in Korean and get an English draft with a single button.

It seems like a simple idea, but I had to switch between three different translation APIs to implement it. I started with MyMemory and ended up with DeepL, and in the process, I realized how different each service is.

Here's what I learned from my experience.

---

## Three services at a glance

|  | **MyMemory** | **DeepL** | **Claude API** |
|---|---|---|---|
| **Free Limits** | 1,000 characters/day | 500,000 characters/month | None (pay-as-you-go) |
| **Paid** | Free 10,000 characters/day with email registration | From $6.99/month | Pay as you go
| **Cost per post** | Free | Free | Around 4 cents |
| **Markdown processing** | Special character transformations | Well-preserved | Perfectly understood |
| **Korean language quality** | Low | High | Very High |
| **API key** | Not required | Required (card registration required) | Required| **Setup difficulty** | None | Low | Low | Low |

---

## MyMemory - I started with it because it was free

When I first created the translation feature, I chose MyMemory for one reason and one reason only. **No API key required.**

```ts
const res = await fetch(
  `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|en`
);
const data = await res.json();
return data.responseData.translatedText;
```

In three lines of code, we have a translation. It's great for prototyping because there are few barriers to entry.

### Problems

The more I used it, the more problems I encountered.

**1. Markdown special characters are changed arbitrarily**.

`**Bold text**` → `* * Bold text * *`

I kept seeing `**` get split into `* *`, or transformed into something like `__ BOLD __`. To stop this, I kept adding code to insert and restore placeholders, but the API would deform the placeholders as well, resulting in an infinite loop.

**2. 1,000 character limit**

A single post quickly exceeds 1,000 characters. I had to create logic to break it up into chunks and request it multiple times, which resulted in awkward sentence breaks at chunk boundaries.

**3. Translation quality**

Honestly, it smells like machine translation. In particular, there were a lot of cases where Korean research and tone of voice didn't translate naturally to English.

**Verdict:** It's good for quick testing. However, it has clear limitations when it comes to real-world use.

---

## DeepL - Quality is different

I switched to DeepL after continuing to experience markdown breakage issues with MyMemory.

### Setup

The DeepL API requires card registration, even for the free plan. This is a barrier to entry, but you get 500,000 characters free per month. Even if you write a blog post every day, it's hard to use it up in a month.

Once you get your API key, create a server-side route and use it.

```ts
// app/api/admin/translate/route.ts
const res = await fetch("https://api-free.deepl.com/v2/translate", {
  method: "POST",
  headers: {
    Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: [text],
    source_lang: "EN",
    target_lang: "EN",
  }),
});
const data = await res.json();
return data.translations[0].text;
```

> **Do not call this directly from the client** It must go through the server route because the API key is exposed to the browser.

### Pros.

- Preserves most special characters like Markdown `**`, `##`, etc.
- Korean to English translation quality is much better than MyMemory
- Can process long texts at once (no chunking required)

**Verdict:** I'm happy with both the translation quality and the markdown handling. The free limit is sufficient. Card registration is the only barrier.

---.

## Claude API - does better than translation

Claude is an LLM, not a translation API. But for translation purposes, it's actually better than DeepL.

```ts
const message = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 4096,
  messages: [{
    role: "user",
    content: `Translate the following Markdown text into English. Keep the markdown syntax intact.\n\n${text}`,
  }],
});
return message.content[0].text;
```

### Advantages

- Understands Markdown as a language, so preserves `**`, `##`, blocks of code, etc.
- No need for gimmicks like placeholder handling
- Goes beyond simple translation to find natural, contextualized expressions
- No need to sign up if you already have a Claude API key

### Cons

- Paid (pay-as-you-go). It's about 4 cents per post, so it's affordable, but not free
- Can be a bit slower to respond compared to MyMemory, DeepL

**Conclusion:** If you have an API key, this is the best option. It eliminates the markdown preservation issue.

---

## Which one should I use?

| Situations | Recommendations |
|------|------|
| Quickly test prototypes | MyMemory |
| I want to write for free and can register my card | DeepL Free |
| Claude API key already in place | Claude API |
| Translation quality is our top priority | Claude API |

I eventually settled on **DeepL**. I was tired of MyMemory's markdown breaking issues, and I already use the Claude API for other things, so I was a little hesitant to add translation to the mix. I found DeepL to have a good free limit and good quality.

---

## Organization - core flow at a glance

```
Test/Prototype
  └── MyMemory (out of the box, no API key required)

Actual service
  ├── DeepL Free (500,000 free characters per month, card registration required)
  └── Claude API (pay-as-you-go, 1 post ≈ 4 cents, full markdown preservation)

Markdown preservation reliability
  MyMemory < DeepL < Claude API
```

I've used three APIs to add a single translation feature. At first, I thought that I could just use a free API, but the difference in quality is bigger than I thought. It would have been much faster to start with DeepL or Claude from the beginning.
