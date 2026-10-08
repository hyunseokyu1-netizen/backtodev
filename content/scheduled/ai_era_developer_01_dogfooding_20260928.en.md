---
title: "A Developer's Place in the AI Era (1/5): I Used My Own Resume App to Write My Own Resume"
date: '2026-09-28'
publish_date: '2027-01-04'
description: Why I went quiet on this blog for over two months, and what I learned actually job hunting with a resume app I built myself
tags:
  - AI
  - Career
  - Problem Solving
  - Dogfooding
---

# A Developer's Place in the AI Era (1/5): I Used My Own Resume App to Write My Own Resume

It's been over two months without a post. That doesn't mean I stopped writing code.

There's exactly one thing I did in that time: **I used the resume management service I built, to actually write my own resume.** I applied with it, interviewed with it, got rejected, and got an offer.

Building something and using it are different things. That sentence gets repeated so often it's lost all meaning — but going through it myself brought it back to life. So this series isn't a technical tutorial. It's **a record of what actually sold and what didn't, inside the bigger story of AI replacing developers.**

---

## 1. Dogfooding Isn't "Trying It Out" — It's "Taking a Walk In It"

While building the service, I kept using it the whole time. Clicking buttons, watching the screen, fixing bugs. That wasn't dogfooding. **That was feature testing.**

Real dogfooding is taking the thing you built out into the world, getting judged by other people, and coming back. For a resume service, **getting an interview or getting rejected is part of the same cycle.** Once I actually ran that cycle, the features I'd poured effort into and the features I actually used barely overlapped.

| What I thought mattered while building | How much I actually used it |
|---|---|
| Automated job-listing scraper cron | Barely used it. Ended up eyeballing and picking manually anyway |
| AI resume auto-rewrite | Draft only. Every sentence got hand-edited |
| Kanban drag-and-drop | **Used it every day.** Because status actually changes, for real |
| Attaching documents per listing | **Used it every day.** I couldn't remember what I'd sent where |
| Match score | Only the first few days. Kept applying even when the score was low |

The hardest feature to build was the least used. The simplest feature was the most used. That doesn't mean my service was badly designed — it means **I didn't actually know what job applicants struggle with.**

### Why I Didn't Use the AI Rewrite Feature

This was the one that hurt the most. I'd put real care into a feature that rewrites your resume to match a job posting, and in the end, I didn't use it myself.

It wasn't about quality. The output was fine. The problem was that **the result wasn't "my own words."** In an interview, they read a sentence straight off my resume and ask, "what does this mean?" If it's not a sentence I actually wrote, the explanation wobbles.

So the way I used it changed.

1. Feed the AI the job posting and ask only: **"list the skills this posting is asking for"**
2. Look at that list and **decide for myself which of my experiences to put up front**
3. Write the sentences myself
4. At the end, ask the AI to **"just point out the awkward sentences"**

I went from a structure where AI produces the output, to a structure where **AI produces the material for judgment and I make the decision.** That connects to the theme of this whole post.

---

## 2. A Resume Isn't Read — It's Searched

Applying for about a month, I laid the resumes that passed next to the ones that didn't. The tech stack wasn't the issue.

| The side that passed screening | The side that didn't |
|---|---|
| Opens with an action — "merged," "cut," "built" | Opens with a title — "led," "in charge of," "headed" |
| Job-posting keywords appear in the first three lines | They're buried later, or missing |
| One bullet covers one problem | One bullet crams in five tasks |
| Has numbers (counts, durations, amount reduced) | Has adjectives ("efficiently," "successfully") |

Starting with a job title in particular didn't work well. Titles mean different things at different companies. At one company a "team lead" does hands-on work; at another, a "team lead" just signs off on things. The reader doesn't know which, so they just defer judgment.

An action, on the other hand, means the same thing regardless of company. **"Merged data that three departments used to manage separately"** paints the same picture no matter where you read it.

One more thing. While prepping overseas applications, I learned that some countries' work visas **determine your occupation category by what you actually did, not your title.** If your employment record just says "team lead," that gets flagged in review. You need actions — "designed and built the system," "diagnosed and resolved the outage."

The fact that the system is already designed that way tells you something: **the system itself already knows a title doesn't explain ability.**

---

## 3. Nobody Asked About Frameworks in a Single Interview

This was the most surprising part. I interviewed in several places, and **almost nowhere asked "have you used framework X?"**

Instead, they asked things like:

- What was the hardest problem you faced, and how did you solve it
- What do you do if people don't use the thing you built
- How did you resolve it when teams disagreed
- If you were adding AI to our company right now, where would you start

All of these are **questions about how you handle problems.** The technology comes out naturally in the course of explaining that.

One moment stuck with me. The story of mine that got the best reaction wasn't about some flashy architecture. It was this:

> The hardest part wasn't a person — it was **a situation where nobody realized two teams were using the same word to mean different things.** Both teams used the same terminology, but pointed at different things. Conversations in meetings made sense, but the data didn't line up.

Not a single technical detail in that story, and yet it generated the most follow-up questions. Because **this problem exists at every company, and code can't fix it.**

And my answer to "what if people don't use what you built" was similar. I left each team's existing format alone, and just built one shared file where **other teams could see what was being written in real time.** People started aligning on their own, without being told to. I didn't force a system — **I just made things visible.** That was the whole trick.

---

## 4. Somebody Has to Actually Drive the Nail

This is where I have to circle back to something I wrote before. It's an extension of what I said in [Why We're Going Back to Cutting Down Token Usage](/posts/whyWereReturningToAStrategyOfReducingTheTokenSuppl_20260707).

The AI industry mints new terminology fast. Just in the last few years, it's gone in this order:

| Era | Core term | What people cared about |
|---|---|---|
| Early | Prompt engineering | How to phrase the question |
| Next | Context engineering | What to feed it alongside the question |
| After that | Harness engineering | How to wire up tools and the execution environment |
| Recently | Loop engineering | How to make it run on its own, and when to stop it |

The progression itself makes sense. The problem is **the vibe that following this list is itself skill.**

I did all of it too. And at some point this thought hit me.

> **There's a nail that needs driving, and I've spent all my time building hammers.**

You build tools for tools. Then you build tools to manage those tools. You build agents, then agents to manage the agents. Somewhere in there, you forget what nail you were originally trying to drive.

After finishing all those interviews, this became clear: **companies aren't looking for someone good at building hammers.** They're looking for someone who can find where a nail is actually needed, grab whatever hammer is on hand, drive it, and make sure it actually holds.

This isn't saying you can ignore the terminology — you need to know it, because it's how conversations happen. But **mistaking "knowing the latest term" for "having skill" is dangerous.** New terms show up every six months. The ability to spot a real problem has nothing to do with that cycle.

---

## 5. Wrap-up — It Comes Down to Problem Solving After All

Boiling down what I learned applying and interviewing for about a month:

1. **Dogfooding only counts once you take the output outside and get judged on it.** Feature testing isn't dogfooding
2. **The hardest feature to build was used the least.** Difficulty and value aren't proportional
3. **Resumes are read by action, not title.** The system itself is built that way
4. **Interviews don't ask about frameworks.** They ask how you handle problems
5. **A structure where AI produces material and I decide worked better than one where AI produces the result**
6. **Chasing terminology and solving problems are different things**

The story that AI replaces developers keeps coming up. What the market told me over that month was a slightly different story. **What gets replaced is "implementing what you were told to," and what's left is "deciding what needs implementing."**

Companies have started giving that leftover work several names these days. FDE, AI Native Engineer, and Go-To-Market Owner. The fact that the name keeps changing is itself a signal.

## How This Series Is Organized

I'm writing five parts. The first two are my own experience and market observations, the middle two are about structure, and the last one is the conclusion.

| Part | What it covers | One line |
|---|---|---|
| **Part 1 (this post)** | Dogfooding, resumes, interviews | Companies aren't looking for someone who builds a great hammer — they're looking for **someone who drives the nail** |
| **[Part 2](/posts/ai_era_developer_02_job_landscape_20260928)** | FDE, AI Native Engineer, GTM Owner | The three names aren't on the same floor. **Only FDE has hardened into a job title** |
| **[Part 3](/posts/ai_era_developer_03_two_paths_20260928)** | Two career forks | A path that goes deeper into tech, and a path that widens into business — **FDE sits between them** |
| **[Part 4](/posts/ai_era_developer_04_token_economy_20260928)** | Tokens, cost, pricing | Once tokens become a cost line, **tech decisions become P&L decisions outright** |
| **[Part 5](/posts/ai_era_developer_05_curiosity_20260928)** | Conclusion | Whether you can do that is decided by **the range of your curiosity** |

> **In one sentence**: What AI replaces is work you do because you were told to; what's left is deciding what to tell it to do. And what you decide to tell it is decided by what you were curious about.

Next part, I'll go through those names one by one and write about which of them has actually hardened into a job and which is still just a name.
