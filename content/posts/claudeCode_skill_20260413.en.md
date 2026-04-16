---
title: '[Claude Code] How to Create and Use Skills - Your Own Slash Commands'
date: '2026-04-13'
description: >-
  Learn how to create and use Skills to automate repetitive tasks in Claude Code
  with hands-on exercises.
tags:
  - Claude Code
  - Skill
  - Automation
  - Slash commands
---
## If you're rewriting the same prompt every time, you can use the

This is what happens when you write Claude Code.

> "Write a blog post. Oh, by the way, you should always write it in this style... Do I need to explain it again?"

It's annoying to have to type a long context like "write in Korean, in developer tone, with this structure" every time. And if you make a mistake, you end up with a completely different style.

This is where **Skill** comes in.

Skills are Claude Code's custom slash commands. You can save your favorite prompt patterns in a file, so you can recall them with a single short command like `/blog-write`. After creating and using it, I found myself thinking, "I wish I'd known about this a long time ago."

---

## Describe the skill in one line

> skill = markdown file with prompt template + slash command registration

No complicated setup, just create a file and it becomes a slash command.

---

## Preparation

First, let's understand where skill files are stored.

```
~/.claude/skills/
└── skillname/
    └── skill.md ← This one file is the entirety of the skill.
```

- ~/.claude/skills/` is the global skills directory. It can be used in any project.
- The skills folder name becomes the slash command name.
  - `~/.claude/skills/blog-write/` → `/blog-write`
  - `~/.claude/skills/gitpush/` → `/gitpush`

---

## Step 1. Create the skill.md file

Let's create our own skill folder and files. For example, we'll create a simple commit message generator.

```bash
mkdir -p ~/.claude/skills/commit-msg
```

And create a file called `~/.claude/skills/commit-msg/skill.md`.

```markdown
---
name: commit-msg
description: Create a Korean conventional commit message based on git diff.
user-invocable: true
---

Analyze the current changes and write a conventional commit message in Korean.

## Rules
- Start with one of the following: `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, or `chore:`.
- Title must be 50 characters or less
- If there are multiple files that have changed, summarize the key changes
- Keep the English technical terms, but explain in Korean

## Output format
Output only the commit message. No comments.
```

The file structure is divided into two main parts.

| Delimiters | Content |
|------|------|
| **Frontmatter** (between `---`) | Skill meta information. Setting `name`, `description`, `user-invocable` |
| **Body** | The actual prompt. What will be delivered to Claude |

### Frontmatter field descriptions

```yaml
---
name: commit-msg # Slash command name (/commit-msg)
description: one line description # description as seen in the list with /.
user-invocable: true # register to be able to write with the slash command
---
```

If `user-invocable: true` is not present, it will not appear in the slash list. You must include it.

---

## Step 2. Use the skill

At the Claude Code prompt, type `/` to see a list of registered skills.

```
/commit-msg
```

After hitting enter, the body prompt of skill.md is automatically forwarded to Claude. It will analyze the current git diff and create a commit message right away.

---

## Step 3. Get arguments with $ARGUMENTS

If you want to take additional input into your skill, you can use the `$ARGUMENTS` variable.

For example, if your blog post writing skill takes a topic as an argument:

```markdown
---
name: blog-write
description: Write a developer blog post in Markdown.
user-invocable: true
---

Write a blog post on the following topics

## Style
- Korean, friendly and practical tone
- Include code examples
- Audience: First-time developers

## Topics
$ARGUMENTS
```

when used, type it like this

```
/blog-write How to create and use skills in Claude Code
```

"How to Create and Use Skills in Claude Code" is substituted for `$ARGUMENTS`.

---

## Step 4. Make skill-creator a skill (easier way)

Claude Code has a built-in skill called `skill-creator`. This skill creates skills.

```
/skill-creator blog-write: Create a skill to write developer blog posts
```

Claude will listen to your skill description and automatically create the skill.md file for you. This is fast when you're not sure how to structure your prompts.

---

## Summarize common patterns

### 1. Basic Skill Structure

```markdown
---''
name: Skill name
description: One-line description
user-invocable: true
---.

Write the prompt here.
```

### 2. Skills that take arguments

```markdown
---''
name: Skill name
description: Description (takes $ARGUMENTS arguments)
user-invocable: true
---.

topic: $ARGUMENTS

Please write ... with the above topic.
```

### 3. File path structure

```
~/.claude/skills/
├── blog-write/
│ └── skill.md
├── commit-msg/
│ └── skill.md
└── gitpush/
    └── skill.md
```

### Skill vs. repetitive prompts

| | Type directly each time | Skill |
|---|---|---|---|
| Volume of input | Full long prompt | Single line of `/skillname` |
| Consistency | Can vary every time | Always the same prompt
| Arguments support | None | Can be done with `$ARGUMENTS` |
| Sharing | Difficult | Can be shared as a file

---

## Troubleshooting

### Entering `/skillname` doesn't show up in the list

- Make sure `user-invocable: true` is in frontmatter
- Make sure the file path is `~/.claude/skills/skillname/skill.md` (case sensitive)
- Try restarting Claude Code

### Prompt not working as intended

- Unnecessary comments around `$ARGUMENTS` can confuse Claude
- The more specific you are about the output format, the more stable the results will be
- "Print ~" is more consistent than "Do ~ for me"

### skill.md doesn't reflect after modification

- After saving the file, it should be reflected when you start a new conversation in Claude Code.
- It may not be reflected immediately in an existing conversation

---

## Summary - Key flow at a glance

```
1. create a folder
   ~/.claude/skills/skillname/

2. create skill.md
   ---.
   name: Skill name
   description: Description
   user-invocable: true
   ---]
   [prompt content]
   [use $ARGUMENTS if necessary].

3. invoked with a slash in Claude Code
   /skillname [optional arguments].
```

If you have a repetitive task, it makes sense to turn it into a skill. It takes 5 minutes to create the first file, and after that it's just a single line of `/skillname`.

I wrote this blog post with the `/blog-write` skill. I just put in a topic and the structure and style are consistent. Once you get the hang of it, it gets easier and easier.
