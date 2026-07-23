---
title: 'Automating Blog Publishing (2): Auto-Generating Drafts in My Own Style With the Claude API'
date: '2026-07-07'
publish_date: '2026-08-13'
description: How a single style-guide document made the Claude API write blog drafts in my own voice every time, and the fallback path that let it run without an API key
tags:
  - Claude API
  - Prompt Engineering
  - Node.js
  - TypeScript
  - Automation
---

Last time, I introduced the overall architecture of blog-auto-writer. This part covers the pipeline's first real working stage — **generating a draft with AI.** Rather than just throwing "write me a blog post" at a prompt, the key was making it come out consistently in my own style, every single time.

## The problem: it's a pain if the tone changes every time

The most common complaint about handing writing off to AI is "the tone is different every time it writes." Some days it's overly formal, some days it stuffs in a ton of emoji, other days it opens with "Hey everyone!" Explaining all of this at length in every prompt is inefficient, and above all, easy to forget.

So I split the style guide out into its **own separate markdown file.**

```markdown
# config/style.md

## Tone & Persona
- Write from the perspective of a developer getting back into coding.
- Explain things simply enough for a reader encountering a new technology for the first time.
- Avoid exaggerated marketing language and clichés.

## Structure
1. Intro: why this topic (2-4 sentences)
2. Body: step-by-step explanation with subheadings
3. Wrap-up: key takeaways + what's coming next
```

Dropping this one file whole into the system prompt means whatever topic goes in, the output comes out in the same voice. To change the style, there's no need to touch code — just edit this file.

## The draft-generation logic

The core function looks like this.

```typescript
const stream = client.messages.stream({
  model: 'claude-opus-4-8',
  max_tokens: 32000,
  thinking: { type: 'adaptive' },
  system: [
    {
      type: 'text',
      text: `${systemPrompt}\n\n${styleGuide}\n\n## Output format (must be followed)\n...`,
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [{ role: 'user', content: userPrompt }],
});
```

Two things worth noting here.

### 1. Enforcing the output format via prompt

I explicitly instruct Claude to "output a single markdown block with frontmatter, nothing else."

```
---
title: "Post title"
tags: [tag1, tag2, tag3]
---

(body markdown)
```

This lets me split frontmatter from body immediately when parsing the response, using the `gray-matter` library. No need to make a separate call asking for the title and tags again.

```typescript
const parsed = matter(cleaned);
const title = (parsed.data.title as string) ?? entry.topic;
const tags = (parsed.data.tags as string[]) ?? entry.keywords ?? [];
```

### 2. Cutting cost with prompt caching

The style guide is nearly identical text repeated in every request. Marking this kind of "large, fixed text" for caching with `cache_control: { type: 'ephemeral' }` means every request after the first gets processed at a much lower cost. Given that this is an automation tool generating multiple drafts every day, this one setting makes a fairly large difference in cumulative cost.

## Giving different instructions per platform

Tistory and Naver have different editor characters. Tistory supports markdown natively, but Naver's SmartEditor doesn't support markdown at all. So I put different platform-specific guidance into the user prompt.

```typescript
const platformNote =
  platform === 'naver'
    ? "This is for Naver Blog. Minimize code blocks and write with explanation-focused prose instead."
    : "This is for Tistory. Feel free to use markdown syntax freely (code blocks, tables, etc.)";
```

This reduces loss later, at the stage of converting markdown to plain text for the Naver publish step. In effect, it steers the Naver-targeted draft toward fewer code blocks from the start.

## Making it work without an API key

I made one interesting decision here. It was originally built to call the Anthropic API directly via the `ANTHROPIC_API_KEY` environment variable, but the local environment didn't actually have an API key configured. Instead, **the Claude Code CLI was already logged in.**

So I added a fallback path to the draft-generation function.

```typescript
const raw = process.env.ANTHROPIC_API_KEY
  ? await generateViaApi(systemPrompt, userPrompt)
  : await generateViaClaudeCli(systemPrompt, userPrompt);
```

`generateViaClaudeCli` internally runs `claude -p "..." --append-system-prompt "..."` as a subprocess and captures the result.

```typescript
const { stdout } = await execFileAsync(
  'claude',
  ['-p', userPrompt, '--append-system-prompt', systemPrompt],
  { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 },
);
```

This way, I could reuse the Claude Code session I was already logged into, with no need to issue and manage a separate API key. If an API key exists, it calls the API directly (fine-grained control over streaming, caching, etc.); if not, it automatically falls back to the CLI — leaving both paths open.

## What running it for real produced

I actually ran this pipeline for the topic "Automating blog post publishing with Playwright." It ran through the Claude CLI path, and produced a 6.7KB post with the frontmatter, title, tags, and body all filled in correctly. It was good enough to hand straight to the publishing pipeline with no manual edits needed.

## The draft file-naming convention

Generated drafts are saved to the `drafts/` folder in the format `date_platform_slug.md`.

```typescript
function draftFilePath(date: string, platform: Platform, topic: string): string {
  const slug = topic
    .replace(/[^\w가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return path.join(DRAFTS_DIR, `${date}_${platform}_${slug}.md`);
}
```

If a draft file with the same name already exists, it isn't regenerated — the existing file is used as-is. This means that if I hand-edited a draft once it was created, running the scheduler again won't overwrite my edits. Thanks to this property, a usage pattern of "generate drafts ahead of time, review and edit them, then let them publish on schedule" falls into place naturally.

## Next up

Getting to the draft stage went smoothly. The real problem hit at the next stage — **actually operating the browser to publish.** I ran into the login session failing to save, three separate times, and the next part unpacks exactly how that went.
