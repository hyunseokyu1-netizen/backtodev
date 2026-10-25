---
title: "Getting Claude Code to Stop Asking Every Time — Digging Into --dangerously-skip-permissions"
date: '2026-07-10'
publish_date: '2026-10-26'
description: "What Claude Code's --dangerously-skip-permissions flag actually does, why it's risky, and the safer alternatives for cutting down on permission prompts without turning them off entirely"
tags:
  - Claude Code
  - AI Coding Assistant
  - CLI
  - Developer Productivity
  - Security
---

## Why I'm Writing About This

Working with Claude Code, every time it touches a file or runs a command, a "Proceed with this action?" popup shows up. For the first few days this feels reassuring — safe by design. But it's a different story when you hand it repetitive work. Ask for something like "update the frontmatter in all 50 markdown files in this folder" and you have to click approve for every single file, which means you can't step away.

That's how I came across the `claude --dangerously-skip-permissions` option floating around the community. With "dangerously" right there in the name, I looked into it half out of curiosity, half out of unease — and after actually trying it, I understood exactly why it's named that way. In this post I'm laying out exactly what this flag does, when it's fine to use and when it absolutely isn't, and the safer alternatives available when all you want is fewer prompts.

## Why Claude Code's Permission Checks Exist in the First Place

Claude Code reads and writes files, runs terminal commands, and if needed, pulls information from the web by default — it actually takes real "actions" on my machine. That's why, in the default permission mode, it asks for confirmation every time it tries to do things like:

- Create a new file / modify an existing file
- Run shell commands like `rm`, `git push`, `npm install`
- Use a tool that requires calling an external API

This confirmation step is annoying, but its reason for existing is clear. It's the last line of defense against an AI misinterpreting an instruction and deleting an important file, accidentally running `git push --force`, or sending sensitive information somewhere it shouldn't go.

## What `--dangerously-skip-permissions` Actually Does

In one line, this flag **turns off this entire confirmation process.** Running it looks like this.

```bash
claude --dangerously-skip-permissions
```

Starting a session with this command means Claude Code executes almost every tool use — file edits, command runs, external calls — immediately, without asking the user. The speed difference is noticeable for repetitive work. If the task is fixing 50 files, it just runs straight through to the end without needing 50 popup clicks.

The problem is that this convenience is like "a car with no brakes." Even if the AI misreads a request, even if it generates an unintended command, it just runs, no confirmation needed.

## Why It's Named "Dangerously"

Here are roughly the kinds of risk you can actually run into.

1. **Unintended deletion/overwriting**: for a vague request like "clean up the temp files," if the AI misjudges the scope, it can delete files you actually needed, with no confirmation.
2. **Running dangerous shell commands**: hard-to-undo commands like `git reset --hard` or `git push --force` can run without confirmation.
3. **Exposure to prompt injection**: if, while working, it reads external content (a webpage, an issue, file contents) that has a malicious instruction hidden inside it, that's normally caught at the pre-execution confirmation step — but with this flag on, that line of defense disappears.
4. **Network access beyond scope**: in an environment with credentials present, a task that calls an external API can proceed without confirmation.

In other words, this flag isn't removing "a confirmation process that's slow and annoying" — it's removing "the last brake that stops accidents."

## When Is It Actually Okay to Use

That's not to say it should never be used. When the following conditions are all met together, it can be a practical choice.

- Working in an **isolated environment** (a Docker container, a throwaway VM, a sandbox — somewhere that, if something goes wrong, only that environment gets wrecked, with no impact on your actual system)
- Working in a state that's **already committed to git and recoverable** (if something goes wrong, you can recover with `git reset`)
- Pure local code work with **no network or sensitive credential access**
- Running a repetitive, **predictably scoped task** (e.g., bulk-editing multiple files to a fixed format) under short supervision

Conversely, these are situations where it's definitely best not to use it.

- An environment with access to a production server or an actual deployment pipeline
- A state with important uncommitted local changes
- A session that involves reading external content (web pages, email, issues, PRs, etc.)
- A situation with direct write access to a repository or infrastructure shared by an entire team

## A Safer Alternative: Allow Only What You Need Instead of Turning Everything Off

What we actually want, often, is "not being asked every time," not "no confirmation at all." Claude Code provides settings for exactly this middle ground.

### 1. Project-Level Allowlist Settings (`settings.json`)

Registering frequently used, safe commands/tools as an allowlist ahead of time in the project root's `.claude/settings.json` means requests matching those patterns run immediately without confirmation, while everything else still gets confirmed.

```json
{
  "permissions": {
    "allow": [
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(npm test:*)",
      "Read(**)"
    ]
  }
}
```

The advantage here is that you can automate only the "repetitive commands with nothing risky about them" specifically, while commands like `git push --force` or `rm -rf` still go through the confirmation step.

If filling in this setting by hand one entry at a time is a hassle, there's also a feature that scans recently approved read-only command patterns from your sessions and auto-generates an allowlist for you — analyzing the log of what you kept clicking approve on, and picking out "this is a pattern that's fine to keep allowing."

### 2. Switching Permission Modes

You can also switch permission modes on the fly mid-session to fit the situation. For example, there's an in-between mode where file edits get accepted automatically, but riskier actions like running commands or deleting things still get confirmed. Instead of turning everything off at once, selectively automating "just the actions likely to repeat in this particular task" is a much safer approach.

### 3. Blocking Only the Dangerous Things With a Deny List

You can also approach it from the other direction. Leave things reasonably open by default, but explicitly block only the commands that should never be allowed to run automatically.

```json
{
  "permissions": {
    "deny": [
      "Bash(git push --force:*)",
      "Bash(rm -rf:*)",
      "Bash(git reset --hard:*)"
    ]
  }
}
```

Using allow and deny together lets you manage things with precision: "this is automatic, this always gets confirmed, everything else follows the default policy."

## Wrap-Up

`claude --dangerously-skip-permissions` is the most extreme way to turn off the entire confirmation process, and exactly as the name says, it's a choice that accepts real risk. Using it briefly in an isolated, throwaway environment might be fine, but it's not recommended anywhere near an actual project or production.

What I actually wanted was to reduce "the fatigue of getting confirmed on repetitive, safe work every single time," and that turned out to be fully solvable through the combination of `settings.json`'s allow/deny lists and permission mode switching, without turning off all permissions. To summarize:

| Situation | Recommended approach |
|------|-----------|
| Quick, repetitive work in an isolated sandbox | `--dangerously-skip-permissions` (sparingly) |
| A project has recurring, safe commands | `permissions.allow` in `.claude/settings.json` |
| You just want to reliably block dangerous commands | `permissions.deny` |
| You want to flexibly adjust depending on the situation | Switching permission modes |

In conclusion, "not being asked" and "safely not being asked" are different problems. Aim for the latter, and in most cases you can get the productivity you want without `--dangerously-skip-permissions` at all.
