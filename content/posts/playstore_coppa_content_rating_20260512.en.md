---
title: "A Privacy Policy's Children's Clause and Play Store's 'Everyone' Rating Are Separate Things"
date: '2026-05-12'
publish_date: '2026-06-03'
description: My confusion over whether adding "not directed at children under 13" to a privacy policy meant I had to set a 13+ content rating
tags:
  - Google Play
  - App Publishing
  - Privacy Policy
  - COPPA
  - Content Rating
---

# A Privacy Policy's Children's Clause and Play Store's "Everyone" Rating Are Separate Things

Writing a privacy policy for the first time when publishing an app to the Play Store, you inevitably run into this standard clause.

> "This app is not directed at children under 13 and does not knowingly collect personal information from children."

Reading this raised a question in my head.

**"Does that mean I need to set the content rating to 13+?"**

Short answer — **no.** These are two entirely different concepts.

---

## Why it's confusing

Seeing "not directed at children under 13" inside your privacy policy makes it feel like the app must be exclusively for people 13 and older.

But this clause is **a declaration of legal exemption, not a content restriction.** Distinguishing between these two is the whole point.

---

## Content rating (IARC) — "what age is this app's content appropriate for"

Google Play's content rating is determined based on **IARC (International Age Rating Coalition)** standards.

| Rating | Criteria |
|---|---|
| Everyone | no violence or adult content |
| 10+ | fantasy violence, mild horror elements |
| Teen (13+) | moderate violence, gambling implications, etc. |
| Mature (17+) | strong violence, adult themes |

**The rating is determined solely by the app's actual content.** A simple player app that just plays YouTube links, with no separate violence or adult elements, correctly gets an Everyone rating.

---

## Privacy policy's children's clause (COPPA) — "we don't collect children's data"

**COPPA** is the U.S. Children's Online Privacy Protection Act. Its core requirement:

> Collecting personal information from children under 13 requires parental consent.

To avoid this requirement, most general-audience apps add this to their privacy policy.

> "This app is not designed to target children under 13 and does not knowingly collect personal information from children."

This clause means exactly one thing —

**"Our app isn't a kids-only app, and we don't collect children's data, so COPPA doesn't apply to us."**

It doesn't mean the content is inappropriate for children, nor does it mean children shouldn't use it.

---

## Summary: the difference between the two concepts

| | Content Rating (IARC) | Children's Clause (COPPA) |
|---|---|---|
| Purpose | classifies age-appropriateness of app content | declares whether children's data is collected |
| Decided by | presence of violence/adult content | whether children are targeted, whether data is collected |
| Where it appears | Play Console's content rating section | the privacy policy document |
| For a typical app | Everyone (no issue) | insert a "not targeting children" clause |

---

## How to actually answer this in Play Console

Filling out the content rating questionnaire, you'll hit this question.

**"Is this app primarily targeted at children?"**

For a simple utility or media player app → select **No.**

Answering this way still gets your content rating as **Everyone.** "Not targeting children" is a choice made for COPPA compliance — it isn't a factor that raises the rating.

---

## Privacy policy children's clause — a standard template

```markdown
## Children's Privacy

This app is not directed at children under 13 and does not
knowingly collect personal information from children.

## 어린이 개인정보

이 앱은 13세 미만 어린이를 대상으로 하지 않으며,
어린이의 개인정보를 의도적으로 수집하지 않습니다.
```

For an app that doesn't separately collect personal data, this clause alone is sufficient.

---

## Summary

- **Content rating** = what age the app's content is appropriate for → no violence/adult content means **Everyone**
- **Children's clause** = a COPPA legal exemption declaration → the standard statement that you don't collect children's data
- The two concepts are **independent of each other** — having a children's clause doesn't prevent the content rating from staying at Everyone

If writing a privacy policy before launching an app feels overwhelming, separating these two concepts makes it a lot easier for a typical general-audience app.
