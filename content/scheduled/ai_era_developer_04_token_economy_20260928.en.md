---
title: "A Developer's Place in the AI Era (4/5): When Tokens Became a Line Item, Tech Decisions Became P&L Decisions"
date: '2026-09-28'
publish_date: '2027-01-07'
description: Why AI products have a cost structure where getting popular can mean losing money, and how that turns model choice and cache design into business decisions
tags:
  - AI
  - Tokens
  - Cost
  - SaaS
  - GTM
---

# A Developer's Place in the AI Era (4/5): When Tokens Became a Line Item, Tech Decisions Became P&L Decisions

In [Part 3](/posts/ai_era_developer_03_two_paths_20260928), I wrote that developers face two forks: one going deeper into technology, one taking development experience out into business.

So why are companies increasingly looking for the right-side person these days? "Organizational trend" is too thin an explanation. **There's a harder reason. The cost structure changed.**

---

## 1. A Structure Old Software Never Had

I previously wrote a post called [Why We're Going Back to Cutting Down Token Usage](/posts/whyWereReturningToAStrategyOfReducingTheTokenSuppl_20260707). Back then it was an observation about industry trends. Now it's turned into an accounting problem.

| | Regular software | AI products |
|---|---|---|
| As users grow | Server costs climb a little | **Cost climbs with every single request** |
| Heavy users are | Good users | **Expensive users** |
| Using one more feature | Almost no cost change | Money goes out proportionally |
| At larger scale | Unit cost drops | **Unit cost stays roughly flat** |

The last row is the key one. The reason traditional software businesses were attractive was **economies of scale.** Build it once, and the cost to replicate it approaches zero. That premise breaks for AI products. **Every request is a cost, one for one.**

---

## 2. A Structure Where Getting Popular Means Losing Money

Let's run the numbers on a simple assumption. Not real rates — just an example to show the structure.

```
Assumption: 1 request = 30 won in cost
            1 paying user = 10,000 won/month

Uses it 3x/day   → 90 requests/month  → 2,700 won cost   → 73% margin
Uses it 10x/day  → 300 requests/month → 9,000 won cost   → 10% margin
Uses it 15x/day  → 450 requests/month → 13,500 won cost  → loss
```

**A structure where the product getting loved means it goes broke.** Something traditional SaaS almost never had. Heavy users running at a loss happens as a matter of course.

That's why AI services keep changing their pricing these days. Unlimited plans get usage caps bolted on, things move to a credit system, expensive models get pulled out into higher tiers. **It's not fickleness — it's belatedly catching up to the cost structure.**

---

## 3. Which Is Why Technical Decisions Become Business Decisions

This is where it connects to the fork I described in Part 3. In AI products, the following judgment calls are **technical calls and P&L calls at the same time.**

| Decision | Technical side | Business side |
|---|---|---|
| Which model to use | Quality | **Cost per call** |
| How much context to feed | Accuracy | Cost per request |
| Where to put the cache | Response speed | **Removing duplicate calls = cost savings** |
| Whether to store the result | Reusability | Avoiding recomputation |
| How many automatic retries | Success rate | Every failure costs money |
| How many agent steps to run | Autonomy | **Multiplies at every step** |

**Someone who only looks at the left column is a good engineer.** The problem is that a decision made looking only at the left column causes an accident on the right.

The last row especially is scary. Build a structure where an agent judges for itself and loops multiple times, and one user request becomes ten, twenty internal calls. The feature works beautifully, and the cost quietly goes up twentyfold. **If you're not watching the logs, you find out a few days later from the bill.**

This is exactly why someone who watches both sides at once became necessary. And the fact that nobody's settled on a name for that person yet is what I wrote in [Part 2](/posts/ai_era_developer_02_job_landscape_20260928).

---

## 4. The Moment Saving Money Becomes a Skill

I went through this myself running a small service. There was a spot where multiple users looking up the same thing was triggering a fresh request every single time. I switched it to a shared cache.

As code, it was a trivial change. **The hard part wasn't the implementation — it was noticing "money is leaking here" in the first place.**

This is exactly the same structure as the nail-and-hammer story from [Part 1](/posts/ai_era_developer_01_dogfooding_20260928). It's not the skill of crafting an elegant hammer — it's the skill of seeing where a nail is actually needed.

Finding the leak isn't anything fancy. Go through it in order and it usually surfaces.

1. **Count requests first.** Cost is request count times size per request. If you don't know which one's bigger, you'll cut the wrong thing
2. **Check if the same input repeats.** If it repeats, caching is the answer. Cheapest fix, biggest payoff
3. **Check the retry count.** Wherever failures are frequent is burning cost two or three times over
4. **Check if unused stuff is riding along in the context.** Data you shoved in out of habit costs money on every single request
5. **Separate out the spots that actually need an expensive model.** Running everything on the top-tier model is just as lazy a design as running everything on the cheapest one

These five aren't optimizations out of a technical manual. **They're the order you read a P&L statement in.**

---

## 5. Pricing Became a Technical Problem

If cost moves with usage, price has to follow that same structure. But **whichever pricing model you pick, you get a side effect.**

| Pricing model | Upside | Problem |
|---|---|---|
| **Flat monthly subscription** | Easy for customers to understand | **Heavy users run at a loss** |
| **Usage-based billing** | Cost and revenue move together | Customers can't predict their bill, and it makes them anxious |
| **Prepaid credits** | Revenue comes in up front | Customers ration remaining credits and **use the product less** |
| **Flat fee + usage cap** | Splits the difference | Where to set the cap becomes a constant argument |

The fourth is the most common shape these days. But **setting the cap requires knowing usage patterns, and knowing usage patterns requires looking at logs.** So this is a business decision that can't be made without technical data.

The third row's problem isn't trivial either. The moment a customer starts worrying about remaining credits, they use the product less. **Use it less, and the habit never forms; no habit, and they cancel next month.** The thing built to save cost ends up creating churn.

So this judgment call can't be made by any single team alone. A dev-only view only wants to cut cost; a sales-only view wants to sell unlimited. **You need someone holding both sets of numbers at once.** This is where it becomes clear why the right-side direction from Part 3 is growing inside organizations.

### And Someone Has to Explain This to the Customer Too

In B2B, there's one more step. **The customer company doesn't understand this structure either.**

You have to answer "why did this get more expensive than last month." The honest answer is "because you used more," but say it that bluntly and the relationship takes damage. You have to explain together where the usage spiked, how it can be reduced, and what gets lost if it is.

**Without knowing the tech, you can't give this explanation. Without knowing the customer, you can't have this conversation.** This is where it clicks why the FDE described in [Part 2](/posts/ai_era_developer_02_job_landscape_20260928) has customer-facing work and LLM operations attached to one person.

## 6. The Person Companies Will Go Looking For

To sum up, I think this is the kind of person whose value is about to rise:

> **Someone who can produce the same result with fewer tokens, and explain how that difference shows up on the P&L.**

It matters that this is two parts. Do just the first half and you're a good engineer; do the second half too and you're in the right-side direction from Part 3.

And the second half isn't as hard to learn as it sounds. It just takes running the numbers once. **The hard part is thinking to run the numbers at all.**

---

## 7. Wrap-up

1. **AI products are software whose economies of scale broke.** One request is one unit of cost
2. **Heavy users are expensive users.** A structure where popularity leads to losses genuinely exists
3. **Pricing plans changing constantly isn't fickleness.** It's belatedly catching up to the cost structure
4. **Model choice, context size, caching, retries, and agent step count are all P&L decisions**
5. **Agent steps multiply.** The feature works beautifully while cost quietly goes up twentyfold
6. **Finding the leak isn't hard.** Start by counting requests. The hard part is thinking to count at all

That's the market-side story: the landscape of job categories, the two forks, and the cost structure.

Which leaves one last question. **What determines whether someone can become that person?**

It's not years of experience — almost nowhere I interviewed asked about years of experience directly. Not a degree, not the number of languages you can use, either.

**Part 5 is about how that comes down to the range of your curiosity.** I think going forward, the range of a person's ability will end up nearly identical to the range of what they were curious about.
