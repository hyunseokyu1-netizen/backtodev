---
title: 'What It Means to Share a Playlist — Why I Built Sharing Into ChainPlay'
date: '2026-06-11'
publish_date: '2026-06-22'
description: Adding a share feature to ChainPlay wasn't just a convenience feature — I wanted to build a culture of sharing taste through playlists
tags:
  - ChainPlay
  - SideProject
  - App Development
  - YouTube
---

## "Do you like this kind of song?"

Words can only get you so far when describing your taste in music.

"I like mellow stuff," "I like something with a beat" — these phrases don't actually communicate anything. You have to hear it yourself. That's why we've always shared something, one way or another — mixtapes recorded on cassette, burned CDs, links sent through Melon. The medium changed, but the essence stayed the same.

**"I want you to hear the things I love."**

---

## But what about now?

Music sharing is still very much alive. Sending a Spotify playlist link, sharing a YouTube playlist.

But honestly, there are some real inconveniences.

- **Spotify**: without Premium, you either get ads or are stuck with shuffle-only. If the recipient doesn't have an account, they only get half the experience.
- **YouTube playlists**: the feature itself is great, but creating and managing one is more of a hassle than it should be. And whoever receives it can't edit it or bring it into their own app.

And most of all — I was already using an app (ChainPlay) that plays YouTube videos back-to-back without YouTube Premium, and there was simply no way to share it with anyone else.

---

## Where ChainPlay's share feature came from

Using ChainPlay myself, this thought kept coming up naturally.

> "I wish I could send my 'Kids' chain to a friend who's also raising a toddler."
> "Can't I just send the chain of songs I'm listening to lately as a single link?"

It started as a simple "wouldn't it be convenient" thought. But building it, I realized it was more than that.

Sharing a playlist isn't just handing over a list of videos. **It's handing over what someone's been watching lately, what mood they're into, what they're feeling.**

Like posting the song you're currently listening to on Instagram, or sharing "this song right now" to your story — I came to think a playlist itself could be a form of self-expression.

---

## The culture I wanted to build

While building the feature, I had a few scenes in mind.

- Parents trading "kids' YouTube chains" with each other
- Sending a friend your "songs I'm obsessed with lately" chain
- Sharing a collection of focus-friendly videos for studying
- Making a "my all-time favorite videos TOP 10" chain and posting it on social media

Right now, sending a link just shows the video list in the browser, and if you have the app, it opens right into it. Nothing grand or heavily social yet.

But I think that's the starting point.

---

## The day a playlist becomes a business card

Someone once told me:

> "If our music taste matches, I feel like I already know roughly what kind of person you are."

I think that's true. Taste tells you more than you'd expect — sense of humor, mood, energy level, worldview.

What I want is for a ChainPlay chain to play that role. For "just look at my chain" to be enough to convey what videos I enjoy, what mood I'm drawn to.

That's not happening yet, today. But the share feature is the first brick of that culture.

---

## How it was actually built, technically

This post is about the "why" behind the feature, but for anyone curious, briefly:

I built it with no server. Chain data is base64-encoded into the URL, and a static GitHub Pages page acts as the passthrough. If the app is installed, it opens directly via deep link; if not, it links to the Play Store.

I wrote up the implementation details in a separate post → [Sharing App Content Without a Server — GitHub Pages + Android Deep Links]

---

## Closing thoughts

Building a side project, every single feature ends up with a reason behind it.

Adding one share button might not sound like a big deal. But for me, it was the moment I found an answer to "why am I even building this."

Building a tool is great, but I realized once again that thinking about what culture that tool could create is even more fun.

I built it. Now I just have to use it to find out.
