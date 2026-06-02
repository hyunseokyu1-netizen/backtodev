---
title: 'Claude Code, why longer conversations get slower and how to use /clear'
date: '2026-05-02'
publish_date: '2026-05-25'
description: Claude Code gives a practical overview of why piling on context gets slower and more expensive, and how to fix it with /clear.
tags:
  - Claude Code
  - context window
  - token management
  - AI development tools
---

## Why does something get weird the longer the conversation goes on?

If you've been using Claude Code, you've probably experienced this at least once.

Claude's initially quick to respond, but after 30 minutes to an hour of conversation, he starts to slow down, sometimes saying the wrong thing or acting like he forgot something he said earlier. And when I type `/context`, I get this screen.

```
Context Usage
⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛁ ⛀ ⛀ ⛀ ⛀ Sonnet 4.6
...
16.7k/200k tokens (8%)
```

The number looks fine at 8%, but as the session gets longer, it goes up to 50% and 70%. This is because the **context window** is filling up.

---

## What's the context piling up?

The Large Language Model (LLM) basically creates the following response by **putting the entire conversation so far as input each time**. If I say "Read me the file", Claude says:

- Everything I've said so far
- Everything Claude has responded to
- All the results of the tool invocation (file contents, command output, etc.)

I look at all of this and answer: the size of this chunk is the **token usage**.

| What happens as the conversation gets longer | Cause |
|---|---|
| Slower responses | Increased processing time due to more input tokens
| Costs go up | API costs increase proportionally to the number of tokens used |
| Context is lost | Previous content is compressed or truncated as context approaches its limit.
| Strange responses | New requests conflict with old context |

200k tokens may seem like a lot, but if you're reading a lot of files or modifying a lot of code, you'll fill up quickly.

---

## What does /clear do?

`/clear` is a command that clears all the history of the current session. It initializes the context as if you had just run Claude Code for the first time.

```
/clear
```

As soon as you type it, the token counter returns to its initial state. Claude is unaware of the previous conversation - it's as if he opened a new session.

### Things to watch out for

- After `/clear`, you **can't access previous conversations**.
- You can't say "look at that code again"
- but **the file is still there**. Code changes don't disappear

---

## When to use /clear

### When to use

**The best time to use it is when your work is about to change completely.**

```text
[Previous task] Fixed a bug in the login feature → Done
[Next task] Start working on a completely different UI component
→ /clear at this point
```

When there's no need to continue the context and the previous conversation is just noise, it's better to be bold and remove it.

It's time to start thinking about it **when the token count is over 50%**. Check in with `/context` from time to time.

```
/context ← check current token usage
```

### When not to use

You shouldn't clear when there is continuity in your work. For example:

- You're refactoring across multiple files.
- Claude knows the structure of the code and needs context
- The error resolution flow continues

In these situations, it's better to let **autocompact** do the work instead of clear.

---

## Get context with /context

Get in the habit of always viewing the current state with `/context` before `/clear`.

```
/context
```

Interpreting the output example:

```
16.7k/200k tokens (8%)

Estimated usage by category
⛁ System prompt: 6.7k tokens (3.3%)
⛁ System tools: 7.8k tokens (3.9%)
⛁ Memory files:     949 tokens (0.5%)
⛁ Skills: 1k tokens (0.5%)
⛁ Messages:         110 tokens (0.1%)
⛶ Free space: 150.3k (75.2%)
⛝ Autocompact buffer: 33k tokens (16.5%)
```

**See also:**

| Item | Description |
|---|---|
| `Messages` | The conversations you've had so far. These keep piling up |
| `Free space` | Free space remaining. The lower the better |
| `Autocompact buffer` | Buffer space for auto compression |

When `Messages` starts to take up 30-40% of the total, consider `/clear`.

---

## Example flow in action

### Step 1: Check the status before starting the job

```bash
/context
```

If you have a lot of tokens piled up, clear them first.

### Step 2: Break your session into independent units of work

Instead of trying to do everything in one session, it's more efficient to break it down into tasks.

```
[Session 1] Implement Feature A → /clear
[Session 2] Implement feature B → /clear
[Session 3] Fix bugs
```

### Step 3: Leave the necessary context in a file

If there's any important context that Claude needs to know before `/clear`, let's put it in a file.

```markdown
<!-- CONTEXT.md -->
## Current work context
- Refactoring the auth module
- Switching from JWT to session method
- /src/auth/middleware.ts has been replaced by the core file
```

We can quickly restore context by asking Claude to read this file in the next session.

---

## autocompact is something like

Claude Code will **automatically compress old content** when the context gets close to the limit. This is autocompact.

Pros: it's more or less automatically managed without my having to think about it
Cons: detailed context can be lost during compression, and compression itself consumes tokens

In other words, relying on autocompact alone is not a complete solution. **Better to do a clean initialization with `/clear` when the unit of work is clearly done.**

---

## Key takeaways

```
Finish task → /clear → Start new task
     ↑
You can make this flow a habit
```

| Commands | Uses |
|---|---|
| `/context` | Check current token usage |
| `/clear` | Clear conversation history (but keep files) |

Just consciously managing context when writing Claude code makes a tangible difference in the quality and speed of response. I highly recommend using `/clear` for each unit of work, especially when working with Claude throughout the day.
