---
title: "The Real Reason There Are So Many Popups — They're Built for the People Above You, Not the Customer (2/2)"
date: '2026-11-07'
publish_date: '2027-01-10'
description: "From the flood of popups the moment you open an app to the dark pattern of moving the close button every time, here's why Korean apps are so popup-heavy, from someone who's actually had to ship one"
tags:
  - Essay
  - UX
  - Dark Patterns
  - Design
  - Product Planning
---

## Open the App, Meet a Popup

In the [previous post](/en/posts/korean_app_design_01_integration_20261107), I wrote about how merging subsidiary apps strips out specialized features and eventually funnels customers into calling support. This time, regardless of whether an app has been merged or not, I want to talk about another problem that stands out across Korean apps in general — popups.

Open almost any Korean app or website and, with very few exceptions, a popup appears. Often more than one, stacked back to back. You find the "don't show today" button and tap it, another one appears, you tap that too — some apps make you repeat this close to ten times before you even see the actual content.

## The Dark Pattern of Moving the Close Button

What's even more infuriating is this: the "don't show today" button sits on the left in the first popup, then shifts to the right in the next one. Your hand remembers the position and taps reflexively — and because the position moved, you end up hitting the wrong button instead (usually the one that takes you into the popup's content). That either dumps you on a screen you didn't want, or the popup just reappears. Eventually, closing these popups one by one becomes part of your daily routine every time you log in.

## The More Famous the App, the Fewer Popups It Has

Flip the question around and the answer's already there. Think of any well-known international app or site — popups bombarding you the second you open it are rare. If there's genuinely important news or an event, it gets folded into a banner or section on the main screen instead of a popup. That way the message still gets delivered without interrupting the user's flow.

I'd guess the actual effectiveness of popups is pretty low if anyone bothered to measure it honestly. The people who misclick while rushing to close one probably outnumber the people who actually read the content and care. And yet popups keep getting used — because I think their real target was never the customer in the first place.

## Popups vs. Banners — What's Actually Different

Comparing a popup against "folding the message into the page" makes the difference clearer.

| | Popup | Main-page banner/section |
|---|---|---|
| User flow | Forcibly interrupted | Left uninterrupted |
| Cost to dismiss | Have to find and tap a button (compounds with repetition) | Scrolls past naturally |
| Users who care | Would have found it anyway | Can see it right there |
| Users who don't care | Forced to see it at least once, left annoyed | Easy to ignore naturally |
| Impact in an internal report | High ("we even put up a popup") | Looks comparatively weak |

That table makes it obvious: the one category where a popup wins is "impact in an internal report." Every user-experience metric favors the banner. If popups keep getting chosen anyway, I think it's because the comparison was never really about user experience to begin with — it was about the internal report.

## Popups Exist to Be Shown to Decision-Makers

I've been through something similar myself while running a service directly. An issue that genuinely wasn't that important still came down as an order from above: "put it up as a popup." Anyone who actually cared about that issue would have already seen it on the notices board or read about it elsewhere. Putting it in a popup on top of that adds almost no new information for those people. And yet there was really only one reason it went up as a popup — to show someone above, "look, we did something about this."

The structure that keeps repeating looks like this.

1. A decision-maker orders a response to some issue
2. Whoever's in charge has to demonstrate they responded in the most visible way possible — a popup
3. The negative impact on user experience isn't something anyone's evaluated on
4. The decision-maker is satisfied just seeing a screenshot of the popup live
5. The people stuck closing that popup ten times over are the actual users

I'd bet designers and planners inside that structure pushed back on popup overload plenty of times. Anyone who actually trained in design at a major company knows this pattern hurts the user experience — there's no way they wouldn't. The fact that it keeps happening anyway tells you the decision-maker's will was strong enough to override that, and that whoever's actually implementing it, without any real decision-making power, had no incentive to fight hard enough to stop it. Just doing what you're told is a lot easier.

## Why Even the Close Button Position Moves

I don't think the button position shifting between popups is an accident either. Once a user gets used to reflexively tapping the same spot to dismiss popups, it means they've stopped actually reading the content — they're just clearing it. That fills the internal metric of "popup was shown," but tells you nothing about whether the message landed. Shake up the button position, and you force at least one more moment of pause — enough to leave a trace that the user "at least tapped something." It reads less like consideration for the user and more like an attempt to stop users from going numb to popups altogether.

## Familiarity Hides the Problem

Korean users are so used to this popup environment that most people just tap through and move on without much complaint. But people who've lived abroad for a long time react differently. I've heard that people who spent years in the US and then moved to Korea find the popup structure in Korean apps especially hard to deal with. Even after it's explained to them, the reaction is often "why do I have to tap through all of this?" To eyes that aren't used to it, just how abnormal this flow really is comes through far more clearly.

In the end, I think the merged-app story and the popup story come from the same root. A design where what matters most isn't what the customer actually needs, but how it looks to someone inside the organization. No matter how trendy the design gets, as long as the underlying decision-making criteria don't change, user experience is going to keep losing out.

Fixing this would require a real step before any popup goes up — asking "does the customer actually need this information, or is this for an internal report?" As long as the standard stays "just make it visible and move on," no amount of trendy design is going to reduce the fatigue users actually feel.
