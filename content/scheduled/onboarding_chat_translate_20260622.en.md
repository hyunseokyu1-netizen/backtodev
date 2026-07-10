---
title: 'Korean Chat Answers, Translated to English All at Once at the End — Building an Onboarding Flow'
date: '2026-06-22'
publish_date: '2026-07-15'
description: My experience collecting user info via chat right after signup, then translating and structuring it into English with a single Claude API call at completion time, saving both Korean and English
tags:
  - Next.js
  - Claude API
  - Supabase
  - Onboarding
---

## Users signed up, but there was nothing after that

JobRadar, which I'm building, is a service that collects Australia/New Zealand IT job postings and matches them with AI. But there was one thing missing. **A newly signed-up user had no proper place to enter their own information.**

The existing setup had a plain form on a `/profile` page. Name, skills, desired position — the usual boxes to fill in. But from a new user's perspective, staring at an empty form leaves them thinking "what am I supposed to write here?" Education? Experience? The more blank fields, the more likely they just close it and leave.

So I thought of **chat-style onboarding.** AI asks one question at a time, and the user just answers comfortably in Korean. And here's the key part — since matching and cover letter generation run on English, **at the very end, I translate the entire set of answers into English and save both Korean and English.**

This post is a record of the choices I made along the way, particularly the question of "where and how much should the LLM be used."

## First fork in the road: how do you make chat feel like "chat"

Say "chat-style UI," and two approaches come to mind.

| Approach | Behavior | Pros | Cons |
| --- | --- | --- | --- |
| **Truly conversational** | LLM reads each turn's answer and dynamically generates the next question | Natural and flexible | An API call every turn, uneven flow, cost↑ |
| **Script-based** | Question order is fixed in code, only shown as chat-bubble UI | Stable, predictable, cheap | Less flexible since questions are fixed |

At first, truly conversational looked cool. But thinking it through, the onboarding items to ask about (basic info, education, experience, skills, desired conditions) are fixed regardless. There's no reason to call the LLM every turn. And with the conversation changing every time, testing gets harder, and things get tangled if a user gives an off-the-wall answer.

So I went with **script-based chat.** The question order is baked into code, and only the UI is styled to look like chat. The LLM gets used in **exactly one place, at the very end.**

I defined the question script as an array like this.

```ts
// questions.ts
export type Step =
  | { kind: 'single'; key: SingleKey; question: string; placeholder?: string; optional?: boolean }
  | { kind: 'list'; key: ListKey; question: string; addMoreQuestion: string; placeholder?: string }

export const STEPS: Step[] = [
  { kind: 'single', key: 'name', question: 'What's your name?' },
  {
    kind: 'list',
    key: 'education',
    question: 'Tell us about your education. School name, major, degree, and dates all at once is fine.',
    addMoreQuestion: 'Add another one if you have more education to list.',
  },
  // ... experience, skills, desired conditions
]
```

The key point here is `kind: 'list'`. Education or experience can have multiple entries, so after receiving one item, it asks "anything else to add?" and shows [Add more]/[Next] buttons. Simple, but produces natural, repeated input, chat-style.

## Second fork in the road: when to translate

The answers received in Korean need to become English, but there are two timing options.

- **Translate at each step**: translate that section every time an answer comes in → API calls = number of steps
- **All at once at the end**: after everything's filled in, one shot when the completion button is clicked → 1 API call

Obviously I went with the latter. One call means one cost, and giving the full context at once also makes translation quality more consistent.

But I got a little greedy with that one final call. Instead of a simple translation, I had it do **three things simultaneously.**

1. Structure the free text (e.g. "Bachelor's in Computer Science, Seoul National University, 2011-2015" → split into `school`, `major`, `degree`, `period`)
2. Generate both a cleaned-up Korean version (`ko`) and an English translation (`en`) with the same structure
3. Even write an English career summary (`career_summary_en`) based on experience

I nailed down a clear JSON schema in the prompt, and emphasized "leave missing info as an empty string/empty array, and never make anything up." Because an LLM filling in blanks convincingly is the scariest thing that could happen.

```ts
// actions.ts — server action called on completion
const message = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 2000,
  messages: [{ role: 'user', content: PROMPT(answers) }],
})
const text = message.content[0].type === 'text' ? message.content[0].text : ''
const result = extractJson(text)  // { ko, en, career_summary_en }
```

I picked `claude-haiku` as the model. Translation + structuring is well within a lightweight model's reach, and it's fast and cheap.

### Parse JSON defensively

Even when you tell an LLM "output JSON only," it occasionally wraps it in a ` ```json ` code fence, or adds explanation before/after. So instead of running `JSON.parse` directly on the response, I filtered it through a step first.

```ts
function extractJson(text: string) {
  // If there's a ```json ... ``` fence, parse inside it; otherwise parse between the first { and last }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Could not find JSON.')
  return JSON.parse(raw.slice(start, end + 1))
}
```

Seems minor, but skip this, and a perfectly working onboarding suddenly breaks one day.

## Third fork in the road: how to store Korean/English

I needed to keep both Korean and English. I want to show the user Korean, but the matching/cover-letter logic needs to use English.

I first considered making two sets of columns — one for English, one for Korean — but that gets messy for structured data like education/experience. So I went with **two JSONB columns** instead.

```sql
-- migration 011
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_ko        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_en        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phone                TEXT;
```

`onboarding_ko` and `onboarding_en` are JSON with **the exact same shape.** One's Korean, the other's English. Same structure, so later on-screen, all you need is a language toggle.

But one more thing. The existing matching/cover-letter code reads **flat columns** like `name`, `skills`, `career_summary`, `desired_positions`. Rewriting all of that felt too heavy. So when saving, I **also mapped the English data into the existing flat columns.**

```ts
await supabaseAdmin
  .from('profiles')
  .update({
    onboarding_ko: result.ko,
    onboarding_en: result.en,
    onboarding_completed: true,
    // For backward compatibility — fill the flat columns with English
    name: en.name || profile.name,
    skills: en.skills ?? [],
    career_summary: result.career_summary_en || '',
    desired_positions: en.desired?.positions ?? [],
    preferences: {
      salary_min: en.desired?.salary_min ?? null,
      salary_max: en.desired?.salary_max ?? null,
      salary_currency: en.desired?.salary_currency || 'AUD',
    },
  })
  .eq('id', profile.id)
```

Thanks to this, the matching logic runs on unchanged, without a single line touched. Adding a new structure while keeping the existing interface — it's surprisingly reassuring.

## What if translation fails? — protect the input

Since everything's riding on that one final API call, if it fails, everything the user just spent time typing in disappears entirely. Worst case scenario.

So if translation fails, I made it **save at least the raw Korean answers first**, and tell the user to "please try again shortly."

```ts
try {
  // ... translation call
} catch (e) {
  // Preserve the input even if translation fails
  await supabaseAdmin
    .from('profiles')
    .update({ onboarding_ko: answers })
    .eq('id', profile.id)
  return { error: 'Something went wrong while organizing your profile. Your input has been saved, so please try again shortly.' }
}
```

On the client side too, I backed up the in-progress answers to `localStorage`, so the answers survive even if the user accidentally refreshes. This kind of safety net doesn't show at all in normal times, but the difference between having it and not having it is huge the one time an incident actually happens.

## Side work: two small UI fixes

Not as big a deal as onboarding, but I also touched up the job listing UI on the same day.

**1. Expanding the match explanation.** The AI-written match explanation was clipped to two lines with `line-clamp-2`, ending in `...`, with no way to see the whole thing. I added a toggle so clicking expands it.

```tsx
<p
  onClick={() => setReasonExpanded(p => !p)}
  className={`text-xs text-zinc-400 mt-1.5 cursor-pointer ${reasonExpanded ? '' : 'line-clamp-2'}`}
>
  {job.match_reason}
</p>
```

Just one piece of state (`reasonExpanded`) and one conditional class, done. No need for a modal.

**2. Shading postings with a JD entered.** When a job description is thin, a "Paste JD" button appears; fill in the JD, and the button disappears. I added a background shade to distinguish "postings already filled in" at a glance. The condition for showing the button was scattered across the code, so I consolidated it into one variable and reused it.

```tsx
// Defining the condition in one place so button visibility and shading follow the same rule
const needsJdInput = job.source === 'glassdoor' || !job.description || job.description.length < 200

// li background
className={`... ${needsJdInput ? 'bg-white' : 'bg-zinc-100/70'} ...`}
```

If the same judgment criteria gets used in two places, pull it out into a variable. Otherwise you end up fixing one and forgetting the other.

## Summary

Here's this work at a glance.

1. **Questions live in code, LLM only at the end** — for onboarding that asks fixed items, there's no need to call the LLM every turn.
2. **Get greedy with that one final call** — bundled translation, structuring, and summarization into one call, saving on cost.
3. **Parse JSON responses defensively** — filter out code fences and extra fluff, or it breaks unexpectedly one day.
4. **Korean/English as two JSONBs with the same shape, English mapped to existing columns** — add a new structure while leaving existing logic untouched.
5. **Protect user input even on failure** — partial saves + localStorage backup.

Say "chat-style onboarding" and it's easy to picture a grand conversational AI, but what was actually needed was **a well-designed question order + one smart call at the end.** It reminded me once again that the LLM isn't an all-purpose hammer — it's more like a nail, meant to be driven precisely where it's actually needed.
