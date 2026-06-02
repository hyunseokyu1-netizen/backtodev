---
title: '[Claude Code] How to Create and Use Skills - Your Own Slash Commands'
date: '2026-04-13'
description: Learn how to create and use Skills to automate repetitive tasks in Claude Code with hands-on examples.
tags:
  - Claude Code
  - Skill
  - Automation
  - Slash commands
---

## If you're rewriting the same prompt every time

When you use Claude Code, this kind of situation comes up quickly:

> "Write a blog post. Oh, but always use this style... do I have to explain it again?"

Typing a long context every time, like "write in Korean, use a developer tone, and follow this structure," is tedious. If you make one mistake, the output can come back in a completely different style.

This is exactly where **Skills** help.

Skills are Claude Code's **custom slash commands**. If you save a prompt pattern in a file, you can bring it back with a short command like `/blog-write`. After using it myself, I kept thinking, "I wish I had known this sooner."

---

## Skill in one line

> Skill = a Markdown file that contains a prompt template + slash command registration

No complicated setup. Create one file and it becomes a slash command.

---

## Preparation

First, let's look at where skill files are stored.

```text
~/.claude/skills/
└── skillname/
    └── skill.md ← This one file is the entire skill.
```

- `~/.claude/skills/` is the global skills directory. It can be used in any project.
- The skill folder name becomes the slash command name.
  - `~/.claude/skills/blog-write/` → `/blog-write`
  - `~/.claude/skills/gitpush/` → `/gitpush`

---

## Step 1. Create `skill.md`

Let's create a skill folder and file. As an example, we'll make a simple commit message generator.

```bash
mkdir -p ~/.claude/skills/commit-msg
```

Then create `~/.claude/skills/commit-msg/skill.md`.

```markdown
---
name: commit-msg
description: Create a Korean conventional commit message based on git diff.
user-invocable: true
---

Analyze the current changes and write a conventional commit message in Korean.

## Rules
- Start with one of the following: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, or `chore:`
- Keep the title within 50 characters
- If multiple files changed, summarize the key changes
- Keep English technical terms, but explain in Korean

## Output format
Output only the commit message. No extra explanation.
```

The file structure has two main parts.

| Section | Content |
|---|---|
| **Frontmatter** (between `---`) | Skill metadata: `name`, `description`, `user-invocable` |
| **Body** | The actual prompt that gets sent to Claude |

### Frontmatter fields

```yaml
---
name: commit-msg # Slash command name (/commit-msg)
description: one-line description # Description shown in the `/` list
user-invocable: true # Register it so it can be used as a slash command
---
```

If `user-invocable: true` is missing, it won't appear in the slash command list. You must include it.

---

## Step 2. Use the skill

At the Claude Code prompt, type `/` to see the list of registered skills.

```text
/commit-msg
```

After you press Enter, the body prompt in `skill.md` is automatically passed to Claude. It will analyze the current `git diff` and generate a commit message right away.

---

## Step 3. Pass arguments with `$ARGUMENTS`

If you want to pass extra input into a skill, use the `$ARGUMENTS` variable.

For example, if your blog-writing skill takes a topic as an argument:

```markdown
---
name: blog-write
description: Write a developer blog post in Markdown.
user-invocable: true
---

Write a blog post on the following topic.

## Style
- Korean, friendly, and practical tone
- Include code examples
- Audience: developers seeing this for the first time

## Topic
$ARGUMENTS
```

When using it, type:

```text
/blog-write How to create and use skills in Claude Code
```

The text "How to create and use skills in Claude Code" is substituted into `$ARGUMENTS`.

---

## Step 4. Use `skill-creator` to make skills

Claude Code has a built-in skill called `skill-creator`. It creates skills for you.

```text
/skill-creator blog-write: Create a skill for writing developer blog posts
```

Claude will read your skill description and automatically create the `skill.md` file. This is faster when you're not sure how to structure the prompt.

---

## Common patterns

### 1. Basic skill structure

```markdown
---
name: skill-name
description: one-line description
user-invocable: true
---

Write the prompt here.
```

### 2. Skill with arguments

```markdown
---
name: skill-name
description: description ($ARGUMENTS supported)
user-invocable: true
---

topic: $ARGUMENTS

Please write ... based on the topic above.
```

### 3. File path structure

```text
~/.claude/skills/
├── blog-write/
│   └── skill.md
├── commit-msg/
│   └── skill.md
└── gitpush/
    └── skill.md
```

### Skill vs. repeated prompt

| | Type it manually every time | Skill |
|---|---|---|
| Input size | Full long prompt | Single `/skillname` line |
| Consistency | Can vary each time | Always the same prompt |
| Arguments | Not available | Available via `$ARGUMENTS` |
| Sharing | Difficult | Easy to share as a file |

---

## Troubleshooting

### `/skillname` doesn't show up in the list

- Make sure `user-invocable: true` is in the frontmatter
- Make sure the file path is `~/.claude/skills/skillname/skill.md` (case-sensitive)
- Try restarting Claude Code

### The prompt doesn't work as expected

- Extra text around `$ARGUMENTS` can confuse Claude
- The more clearly you specify the output format, the more stable the result will be
- "Output ~" is more consistent than "Do ~ for me"

### Changes to `skill.md` aren't reflected

- After saving the file, start a new conversation in Claude Code and it will be reflected
- It may not be reflected immediately in an existing conversation

---

## Summary - core flow at a glance

```text
1. Create a folder
   ~/.claude/skills/skill-name/

2. Write skill.md
   ---
   name: skill-name
   description: description
   user-invocable: true
   ---

3. Use it
   /skill-name
```

If you use Skills well, repetitive prompt work drops dramatically and your prompt quality becomes much more consistent. For anything you repeat often, Skills are worth setting up once.
