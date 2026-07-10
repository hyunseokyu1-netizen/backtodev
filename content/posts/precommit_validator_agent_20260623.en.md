---
title: 'An AI That Blocks You One More Time Before You Commit — Automating Commit Validation With a Subagent'
date: '2026-06-23'
publish_date: '2026-07-13'
description: How I built a pre-commit-validator subagent to catch hardcoded emails or missing user_id filters from slipping into commits, and the design principles behind it
tags:
  - Claude Code
  - Subagent
  - Code Review
  - Security
  - Automation
---

## Intro: humans can't remember everything every single time

The JobRadar project has a few rules that must never be broken. The scariest of these is **anything related to auth.**

- **Never hardcode** an email or user ID in code (something like `'hyunseok.yu1@gmail.com'`)
- Every DB read/write **must have an `.eq('user_id', profile.id)` filter**
- In particular, `supabaseAdmin` (service role) bypasses RLS (row-level security), so if the code itself doesn't filter by user_id, **it can touch someone else's data**

Break a rule like this once, and it goes straight to a security incident. But humans, in a hurry to commit, always forget. "Just this once" is the reality that eventually reaches production.

So this time I built an **AI subagent that automatically inspects changes right before a commit.** Using Claude Code's subagent feature, you can set up a checkpoint that automatically steps in whenever you say "commit this," catching rule violations. This post covers how I built that `pre-commit-validator`, and what I paid attention to while designing it.

## What is a subagent?

In Claude Code, a **subagent** is a separate AI worker specialized for a specific task. It works in its own context, separate from the main conversation, and if you attach a description ("call me in this kind of situation"), the main flow calls it automatically.

Simply put, it's similar to **hiring a specialist.** I (the main agent) focus on writing code, while repetitive, meticulous work like commit validation gets handed off to a dedicated validator.

A subagent is usually defined as a single markdown file in the `.claude/agents/` folder. Frontmatter at the top holds metadata, and the body below describes "who you are and what you do."

## Step 1. Deciding when it gets called (description)

The most important part of a subagent is actually the **description.** This is what decides "in what situation this agent gets called automatically." No matter how well-built it is, it's meaningless if it never gets called.

```yaml
---
name: "pre-commit-validator"
description: "Use this agent when the user requests a commit, deployment,
  or push (e.g. 'commit', 'deploy', 'ship it') and you need to verify changes
  before they go live. ..."
model: sonnet
color: cyan
memory: project
---
```

A few points here.

| Field | Meaning |
|------|------|
| `description` | **The trigger.** Clearly state "when a commit/deploy/push is requested." I even baked in Korean trigger words ('커밋', '배포', '올려줘') |
| `model: sonnet` | validation needs to be fast and precise, so a lighter model |
| `memory: project` | uses project-scoped memory — learns and accumulates recurring violation patterns |

I also packed several `<example>` blocks into the description. Giving concrete scenarios like "if the user says 'commit this' → call this agent" as examples makes the call decision far more accurate.

> **Tip**: a description should be written around **"when to call it,"** not "what this agent does." It's a description of the call condition, not a capability description.

## Step 2. What to check — grading the checklist by severity

The body organizes validation rules **graded by severity.** Treating every violation the same way means you miss the ones that actually matter.

```markdown
### 🔴 CRITICAL — Never passes (FAIL if even one exists)
- No hardcoded emails/IDs
- No exposed environment variables/secrets (.env, sk-, SERVICE_ROLE, etc.)
- Missing auth pattern (getAuthUserEmail → getOrCreateProfile)
- Missing user_id filter (mandatory especially when using supabaseAdmin)

### 🟡 IMPORTANT — Passes, but flagged
- Import boundaries (Supabase only via lib/supabase.ts)
- API Route location (only under src/app/api/)
- Overuse of 'use client', TypeScript strict violations

### 🟢 ADVISORY — Quality recommendations
- Leftover console.log, debug code, TODOs
```

Splitting this into 3 tiers (🔴/🟡/🟢) makes the validation result clear. **Even one 🔴 means an automatic FAIL**, while the rest are flagged as warnings without blocking progress. The key was not mixing "could lead to a security incident" with "just a minor code cleanliness issue."

## Step 3. Only validate — don't let it commit itself

There's one principle I set firmly while designing this. **This agent only validates — it never performs the actual commit/push itself.**

```markdown
You do NOT perform the commit/push yourself; you produce a clear
PASS/FAIL verdict with actionable findings so the main flow can
proceed or stop.
```

Why do it this way? Because mixing roles is dangerous. Separating "the one who validates" from "the one who executes" means:
- The validator focuses solely on **the verdict** (PASS/FAIL + reasoning)
- The actual git work is done by the main flow, after user confirmation
- If validation fails, it stops right there

This mirrors real-world code review exactly. It's the same structure as a reviewer just deciding "LGTM" or "please fix this," while the merge button is pressed separately.

## Step 4. Validation scope is only "what changed now"

Another thing I made explicit was **validation scope.** Scanning the entire codebase every single time is slow and nitpicks unrelated existing code. So I made it look only at "the changes about to be committed right now."

```markdown
1. Collect changes: identify "what's about to be committed" via
   git status, git diff, git diff --staged. Focus only on these
   changed lines/files.
2. Rule-by-rule check: compare each changed file against the checklist.
3. Verdict: ✅ PASS / ❌ FAIL + a priority-ordered issue list.
```

And I fixed the output format to a template in Korean too. Getting results in the same shape every time makes them easy to read, and I always made it note "which file, which line, why it's a problem + how to fix it." Just pointing out the problem with no solution makes it half a validator.

## Step 5. Getting smarter with memory

Finally, I attached **project memory** to this agent. Letting it accumulate patterns discovered while validating repeatedly.

```markdown
**Update your agent memory** as you discover recurring violation
patterns, project-specific conventions, and validation insights.

Things worth recording:
- Recurring violations (e.g. a specific file that keeps hardcoding identity)
- Safe patterns confirmed during validation (approved helper usage, etc.)
- Files that legitimately use service-role and their required filters
```

This way, knowledge persists after the conversation ends. Context like "oh, this file made the same mistake before" accumulates, and the validator becomes more specialized to our project over time. Plus, since it's `memory: project`, it's **shared with the team through version control**, so a pattern one person discovers benefits everyone.

## Troubleshooting: common traps when building one

Things commonly encountered when building a subagent for the first time.

| Symptom | Cause | Fix |
|------|------|------|
| The agent doesn't get called automatically | description leans toward "capability description" | make "when to call" + trigger words/examples explicit |
| Blocks even trivial things, annoyingly | no severity distinction | split into 🔴/🟡/🟢 tiers, block only on 🔴 |
| Validation is slow and off-target | scans the entire codebase every time | scope it to `git diff` changes |
| Results vary every time | no fixed output format | enforce a fixed template (file:line + how to fix) |

## Summary: moving a rule from "human memory" to "a system"

If I had to sum up this work in one line: **"moving a rule that a human had to remember every time, into a system that checks it automatically."**

The design principles behind `pre-commit-validator`, summarized:

1. **Make the call condition explicit** — nail down "when to call" with trigger words + examples in the description
2. **Grade by severity** — 🔴(block)/🟡(warn)/🟢(advisory), blocking only what's genuinely dangerous
3. **Separate roles** — validate only, never commit (separate the reviewer from the executor)
4. **Limit the scope** — only `git diff` changes, not everything
5. **Accumulate memory** — learn recurring violation patterns and share with the team

Getting back into development, what I've come to feel is that treating AI purely as "a tool that writes code for me" only gets half its value. It really shines when used as **a safety net that watches for what I'm prone to miss.** Humans make mistakes, and forget rules when rushed. Filling that gap with a system — that's the biggest thing this subagent taught me.

> Next time, I'm thinking of collecting real PASS/FAIL cases from how this validator actually behaves in a live commit flow, as a follow-up post.
