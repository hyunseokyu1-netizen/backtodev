---
title: "Claude Refused to Lie for Me — Does AI Have an Honesty Filter Now?"
date: '2026-08-24'
description: "Claude refused to fill in a phone number that wasn't mine, which got me thinking about why agentic AI needs to judge honesty now, not just generate text"
tags:
  - Essay
  - Claude Code
  - AI Agents
  - AI Alignment
  - Honesty
---

A few days ago I needed a placeholder value for a form while testing something, so I asked Claude to "put a different phone number in this field, not mine." Claude stopped right there. The gist of its response: "This number doesn't appear to belong to you, so I can't proceed with something that could get registered under someone else's name."

I was baffled for a second. It was just a test value — what was the problem? I re-explained and asked again, and got the same answer. I eventually worked around it and finished what I was doing, but the moment stuck with me. Does AI have some kind of honesty metric now? Do we need to start lying to AI too?

## Why This Never Used to Happen

Up until a few years ago, an LLM was just a text generator. If I said "give me a fake phone number," it would spit out something like `010-1234-5678` without a second thought. Whether that string actually got submitted somewhere, or registered under whose name, was never the LLM's problem — a human was always the one who copy-pasted it into the actual form and hit submit. The final judgment call, and the responsibility that came with it, always sat with a person.

That's not true anymore. Agentic tools like Claude Code don't just generate text. They edit files directly, fill out forms, call APIs, commit, and deploy. When I say "put this value in," it actually lands in a real system. The step where a human double-checks before it goes live is gone. Which means the AI itself now has to judge whether that value could actually harm someone — a judgment call that simply didn't matter when it was just a text generator, but matters a lot now that it's the one executing.

## So What's the Actual Line

Thinking it over, here's the distinction I landed on: there's a real difference between "a value explicitly marked as fake" and "false information submitted as if it were real."

| | Obvious dummy data | Fake info submitted as real |
|---|---|---|
| Example | `555-0100`, `test@example.com`, `0000-0000` | An actual, real phone number or email belonging to someone else |
| Purpose | Checking a layout, local testing | Registered into a live service as if it were a real user's info |
| Destination | Local environment, a test DB I built | A live production service, a third-party system |
| Potential harm | None (never reaches anyone) | Real (a verification text or spam could hit some uninvolved person) |
| AI's call | Executes it | Refuses it |

What I'd asked for leaned toward the second case. It wasn't "any number" — it was a request to put a plausibly real-looking number into an actual registration form, and from Claude's side, that's a scenario where a verification text or spam could genuinely land on some unrelated person. If I'd used an obviously-fake format like `555-0100`, it probably would have gone through without a hitch.

## Why This Is Actually the Natural Progression

My first reaction was "AI got needlessly picky." The more I sat with it, the more it looked like the opposite. As AI gains the ability to do more, its actual footprint on the real world grows too. When AI only ever produced text, the worst case was a weird sentence sitting somewhere, harmless. Now it makes real commits, calls real APIs, submits real forms. As execution authority grows, the responsibility to judge whether that execution could hurt someone has to grow right along with it. People work the same way — a junior with no access can barely cause damage even by mistake, but the moment you're handed deploy access or payment authority, the bar for judgment gets a lot stricter. AI seems to be tracing the same arc.

## So What Do You Do When You Actually Need Test Data

In practice, you genuinely do need dummy values and placeholders sometimes. Here's what I've settled on after running into this:

1. **State your intent up front** — saying "I need dummy data for testing" before anything else lets the AI tell the difference between "false info pretending to be real" and "a fake value we've both explicitly agreed on."
2. **Use a format that's obviously fake to anyone** — phone numbers like `555-0100`, emails like `test@example.com`, names like "John Doe." Don't mimic a format that could plausibly be real.
3. **Scope the destination to local or test environments** — make it explicit that this is going into a local DB or staging setup you built, not a live production service or a third-party system.
4. **Never impersonate a real person's actual info** — ask for "a value that belongs to no one," not "a value that looks like someone else's."

Following those four got almost everything through without friction. In the end, the issue was never "is this a fake value" — it was "could this fake value turn into real harm."

## Looking Back, I'd Already Seen This Pattern

This wasn't actually the first time. I've noticed the same texture before in regular development work with Claude Code. Ask it to run something hard to undo — a `git push --force`, a deploy that touches a live production server — and it doesn't just execute; it checks in with me first. Destructive commands like `rm -rf` get the same treatment. In each case, the behavior is the same: judge whether this action could lead to irreversible harm, and when it's ambiguous, ask a human instead of guessing.

The phone number incident sits on the same axis. Whether it's an irreversible git command or false information that could actually reach a real third party, the common thread is the same question: does the outcome of what the AI just executed spill past the AI's own boundary and land on someone else? That question simply didn't need asking back when a human pressed the final button. Now the AI presses that button itself. The center of gravity for judgment has shifted.

## Do We Need to Lie to AI

Back to the original question — the answer, I think, is closer to "no." If anything, it's the opposite. The vaguer and more evasive I am about my intent, the more the AI defaults to assuming the worst case and blocking it. Give it clear context instead — "this is for testing, it never actually reaches anyone" — and it moves a lot more flexibly. The fact that AI now has an honesty bar to clear is a sign that it's stopped being a text generator and become an actor that intervenes in the real world. Given that, the answer isn't to figure out how to trick it — it's to get better at saying exactly what I actually mean.
