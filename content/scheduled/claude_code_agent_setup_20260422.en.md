---
title: 'Building a Claude Code Custom Agent — A Practical Guide with blog-auto-draft'
date: '2026-04-22'
publish_date: '2026-05-09'
description: How to create Claude Code custom agents to automate repetitive tasks. A step-by-step walkthrough using blog-auto-draft as a real example, from file structure to invocation.
tags:
  - ClaudeCode
  - Agent
  - Automation
---

> "Tired of explaining the same context to Claude over and over?"

When working with Claude Code, certain tasks become repetitive. For me it was: after every work session, I'd type "analyze today's commits and write a blog draft." That was fine at first, but having to re-explain the context every single time got old fast.

So I built a **custom agent**. Once set up, I just type `/blog-auto-draft` and it handles the same task every time. This post walks through that process using blog-auto-draft as the example.

---

## What Is an Agent?

In Claude Code, an **agent** is a sub-AI with a predefined role and behavior guidelines. There are three key differences from a regular conversation:

| | Regular Chat | Custom Agent |
|--|-------------|--------------|
| Context | Explain every time | Saved in a file, reused |
| Permissions | All tools | Can specify only what's needed |
| How to invoke | Free-form text | Call by name |

Think of it as creating a **dedicated assistant for repetitive tasks**.

---

## Prerequisites

- Claude Code CLI installed (the `claude` command works)
- `~/.claude/agents/` directory (create it if it doesn't exist)

```bash
mkdir -p ~/.claude/agents
```

---

## Step 1 — Create the Agent File

An agent is defined in a single markdown file. It lives in one of two places:

```
~/.claude/agents/agent-name.md      # global (available in all projects)
.claude/agents/agent-name.md        # local (current project only)
```

The file structure is simple:

```markdown
---
name: agent-name
description: "One-line description of what this agent does"
color: purple
---
The system prompt for the agent (role, behavior guidelines)
```

The **frontmatter** between `---` is metadata; everything below is the agent's **role instructions**.

---

## Step 2 — Dissecting the blog-auto-draft File

Here's the agent I actually use. `~/.claude/agents/blog-auto-draft.md`:

```markdown
---
name: blog-auto-draft
description: "Analyzes today's git commits and changed files to auto-generate a blog draft.
             On invocation, reads git log and diff, writes a markdown draft in blog-write style, and saves it."
color: purple
---
Analyze today's work and write a blog draft.

## Step 1: Understand What Was Done Today

Check recent work with:

```bash
git log --oneline -10
```

Cross-reference today's date with commit messages to identify today's commits.
If there are no commits today, target the 1–3 most recent commits instead.

## Step 2: Check Changed Files
...
```

Three key points:

**1. description is read by AI**
The description isn't just a note — it's how Claude decides when to invoke this agent. The more specific you are, the more accurately it triggers automatically.

**2. Structure the prompt with steps**
The agent body works better as a clear instruction guide rather than free-form text. Using `Step 1`, `Step 2` notation prevents the agent from skipping steps.

**3. Specify the output path**
If the agent saves files, hard-code the save path and filename format in the prompt. That way it never has to ask.

---

## Step 3 — Invoking the Agent

Once created, you can invoke the agent two ways.

### Method 1: Call it by name

```
Run blog-auto-draft
```

Claude reads the description, finds the matching agent, and executes it.

### Method 2: Direct invocation via the Agent tool (in code)

```python
Agent(
  subagent_type="blog-auto-draft",
  prompt="Analyze today's work and write a draft"
)
```

This is how Claude Code internally creates sub-agents.

---

## Step 4 — Building Your Own Agent

Use blog-auto-draft as a reference to build something for your own use case.

### PR Review Summary Agent

```markdown
---
name: pr-summary
description: "Analyzes GitHub PR changes and writes a summary to share with the team"
color: blue
---
Analyze the current branch's PR changes and write a summary.

## Step 1: Understand the Changes
Run git diff main...HEAD to see all changes

## Step 2: Write Summary
- List of changed features (bullet points)
- Key decisions made
- Items that need testing

## Step 3: Output
Print in markdown format to the console
```

### Daily Commit Summary Agent

```markdown
---
name: daily-standup
description: "Analyzes today's git commits and creates a standup meeting summary"
color: green
---
Organize today's work in standup format.

Format:
- What I did: (based on commits)
- What I'm doing today: (based on TODO.md)
- Blockers: (none if nothing)
```

---

## Common Patterns

| Pattern | Description |
|---------|-------------|
| Set `color` | purple, blue, green, red, etc. — for visual identification in the agent list |
| Step structure | Breaking into steps keeps the agent on track |
| Hard-code paths | For file-saving agents, specify paths in the prompt |
| Detailed description | Directly affects auto-trigger accuracy |

---

## Troubleshooting

**Agent doesn't respond when called**
→ Verify the path is `~/.claude/agents/`. The filename must end in `.md`.

**Always have to re-explain context**
→ Background information must go directly in the agent prompt body. Agents don't remember conversation history.

**Output doesn't save in the right format**
→ Clearly specify the save path and filename format at the end of the prompt.

---

## Summary

```
1. Create a .md file in ~/.claude/agents/
2. Write name and description in frontmatter
3. Write step-by-step instructions in the body
4. Invoke by name
```

Once set up, repetitive tasks shrink down to a single command. For me, finishing a work session now means typing `Run blog-auto-draft` and getting a blog draft out. Ten minutes of setup, endless reuse.

The next post will cover how to **connect MCP tools to an agent**.
