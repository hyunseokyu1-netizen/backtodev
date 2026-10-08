---
title: "Building a Gossip Site, What Scared Me Most Wasn't the Code — It Was My Name"
date: '2026-07-16'
publish_date: '2026-12-05'
description: The real questions I faced building the anonymous community Nogari — who gets to open a room, where the line between criticism and abuse sits, and whether I could put my own name behind an anonymous service
tags:
  - Service Planning
  - Nogari
  - Anonymous Community
  - Essay
noindex: true
---

## Turning "Shooting the Breeze" Into a Service

Korean has an expression, "노가리 깐다" (nogari kkanda) — literally "shelling dried pollock," but used colloquially to mean shooting the breeze, dishing out a bit of gossip about other people. It can carry a negative connotation too, but if you think about it, it's just something people do every day — at a cafe, in a group chat, over drinks after work. The service that carries this sentiment straight into its name is **Nogari (nogari.org)**.

It's a place where you can make a room out of any topic — a person, an object, a brand, an event — and talk about it anonymously. I wrote up the technical side of how I built it separately, in detail, in the [Nogari Dev Log](/en/posts/nogari_dev_journey_20260712). This post covers what that dev log didn't — a record of **why I decided to build it this way**, and **the moment that scared me most while building it.**

## Who Should Get to Open a Room

In existing communities, the operator creates the boards. It's such a standard way of doing things that nobody questions it. But while planning Nogari, I started questioning that premise itself.

The moment an operator creates a board, their taste and judgment get baked into the community's structure. "This topic is worth a room," "that one isn't" — you have to keep making that call alone. The more people join, the worse this bottleneck gets.

So I flipped it. **Anyone can propose a topic, and if 30 people agree within 72 hours, the room opens automatically.** As the operator, I don't intervene in this process at all. If it doesn't gather enough support, it quietly disappears; if it does, it opens. A kind of small-scale DAO.

I built this knowing there would be side effects. The number 30 is purely a gut call. Too low and any topic at all opens a room; too high and nothing opens during the cold-start phase. In fact, early on there wouldn't be enough people around for gathering 30 agreements to be anything but hard. So I pre-seeded 300 National Assembly members as seed rooms — a device to sidestep the common psychology of "I don't want to be the first person to post on an empty board." I'm planning to adjust this number later once I have real usage data. I don't think of it as a problem with a right answer, but as a dial I'll keep tuning.

Looking back, this decision was less a technical choice than a philosophical one. "Who gets to open the door to content" is a power-structure question every community service is born carrying. When the operator opens the door, it's fast and consistent, but the community can never escape the taste of that one person. Opening it by collective agreement instead is slower and harder to predict, but at least the judgment that "this topic is needed" belongs to many people, not one. I can't say for certain which side is right. I just wanted to experiment with the latter.

## "Trash Talk Is Fine, Cursing Isn't"

I know an anonymous site with zero moderation falls apart in no time. But block criticism and satire entirely, and the service loses its entire reason to exist. What's the point of a gossip site that bans gossip?

So I settled the principle into one sentence: **"Trash talk is fine on Nogari. Cursing isn't."** Sharp criticism, complaints, and satire aimed at anyone are all allowed. What's blocked instead is profanity, personal information, and clear falsehoods. How that line gets implemented in code is a technical story, so I'll leave that to other posts ([two-stage comment filtering](/en/posts/nogari_dev_journey_20260712), [AI report moderation](/en/posts/ai_report_moderation_20260713)).

What I want to talk about here isn't the implementation — it's **the agonizing that went into settling on this one sentence.** "Block profanity" sounds like a clear-cut standard at first glance, but the moment you actually try to turn that sentence into filtering logic, you keep running into fuzzy boundaries. "Is this criticism or abuse?" "Is this expression satire or mockery?" In the end there's no perfect answer, and I realized all you can do is pin the principle down into the clearest single sentence you can, then keep refining from there.

## Could I Put My Name Behind This

After finishing Nogari, what I ended up agonizing over longest was, of all things, "how do I even promote this?"

Promoting an anonymous community ultimately means someone outside that community has to say "I built this." The moment I post an introduction on a place like GeekNews or Disquiet, my real-name account gets permanently tied to the identity of "Nogari's operator." The person who built an anonymous service ends up with a name that's anything but anonymous.

At first this felt uncomfortable. But thinking it over again, I concluded this was actually how it should be. The more anonymous a service is, the less its operator should be allowed to hide responsibility. Anonymity only stays a device that protects speech, rather than a tool that conceals abuse, if it's clear who judges and acts on reports, and who to contact when something goes wrong. So I straightened out the terms of service and privacy policy first, and decided to promote it under my own name after that. I judged that hiding behind anonymity and just running the operation without that preparation would actually be the more irresponsible path.

The hesitation itself was a discovery in its own right. I was never once scared while writing code. The whole time I was designing the Supabase schema, connecting anonymous sessions to `device_hash`, and building the report pipeline, every problem was "how do I implement this," never "is it okay to do this." But once the service was fully built and it came time to promote it, the question "is it okay to do this" came up for the first time. It's been a few months since I got back into development, but this time I learned that deciding "is it okay to put this out into the world under my own name" takes far longer than getting stuck on anything technical.

## What I'm Curious About Right Now

Now that the service is built, I'm left with questions I don't know the answers to.

- Whether surviving the cold start with roughly 300 seed rooms of politicians and sports stars actually works
- Whether the "open a room with 30 agreements" mechanism still functions meaningfully once there are more people, or whether the number needs constant adjustment
- Where real users will actually see the line sitting between "trash talk is fine" and "cursing isn't"

Unlike technical problems, no amount of staring at the code gives you the answers to these questions. They only come out once people actually use it.

Come stop by sometime and shoot the breeze in any room you like — that itself might end up being the answer to these questions: [nogari.org](https://nogari.org)
