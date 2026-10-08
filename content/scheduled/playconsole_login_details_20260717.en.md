---
title: "What Goes in Google Play's Login Details When Your App Has No Username or Password? (Submitting a GitHub Token Auth App)"
date: '2026-07-17'
publish_date: '2026-12-13'
description: "A field report on filling out Google Play's Login details (formerly App access) section for an app that only authenticates with a GitHub token, including setting up a review-only demo repo and a fine-grained token"
tags:
  - Google Play
  - Play Console
  - GitHub
  - App Review
  - Flutter
---

## The Reviewer Can't Log Into My App

I was submitting [RepoNote](https://github.com/hyunseokyu1-netizen/repo-note), a note-taking app I built in Flutter,
to the Play Store, and I got stuck for a moment on the **"Login details"** section (formerly called App access).

The intent of this section is simple. If your app has anything locked behind a login, you're supposed to hand
Google's reviewer a key so they can get in and look around. The problem is that every bit of the guidance text
assumes you're working with a **"username and password."**

My app doesn't have username/password login at all. All it needs is **a single GitHub Personal Access Token**.
So what's an app like that supposed to submit? Here's what I worked out by actually going through it.

## Confusing from the Very First "Yes/No" Question

The first question is this:

> Does your app have any restricted access?

Is entering a token "login"? I paused on that for a second, but the answer is clearly **"Yes."** The explanation
under the option lists things like "email address, username, Google account sign-in, SSO, and similar
**account login details**," and token auth is, at the end of the day, still an account credential. Until you
enter the token, every feature in the app is locked, so you can't pick "No" here.

If you do pick "No," here's what happens — the reviewer gets stuck on the very first screen (the token input
screen) and the app gets **rejected as "unable to review."** The warning at the bottom of the page spells it
out too:

> Reviewers cannot access your app by creating an account, using an existing account, or using a free trial.
> They also cannot contact the developer for more information.

In other words, the reviewer will never create a GitHub account on their own. **I have to hand them everything
pre-set-up, ready to use.**

## Prep Work: A Demo Repo for Review + a Dedicated Token

I obviously can't hand the review team the token to my personal notes repo. So I built a separate
review-only environment from scratch. I initially wondered whether I'd need to spin up a brand-new GitHub
account just for review, but it turned out my existing account was perfectly safe to use, since a
**fine-grained token can be scoped to a single repository.**

### Step 1. Create the Demo Repo

I made a repo that only contains dummy data for the reviewer to look at.

```text
reponote-review-demo/
├── README.md
├── Today.md              # sample note with a checklist
├── Reading notes.md
├── Ideas/App ideas.md
├── Projects/RepoNote improvements.md
└── Meetings/Weekly sync.md
```

A few points:

- It's made up entirely of **English dummy notes with no personal information** (review is done in English)
- I threw in a couple of folders so the app's tree-navigation feature could also be checked
- Making it a private repo lets me validate "private repo support" at the same time

### Step 2. Issue a Fine-grained Token Scoped to Just That Repo

GitHub → Settings → Developer settings → **Fine-grained personal access tokens**:

| Setting | Value | Reason |
|---|---|---|
| Token name | `reponote-review` | To identify what it's for |
| Expiration | 1 year | Needs to stay valid through review and any re-review on updates |
| Repository access | **Only select repositories** → the demo repo only | Blocks access to my personal repos entirely |
| Contents | Read and write | Needed to verify the app's commit feature |
| Metadata | Read-only | Selected automatically |

If a token issued this way ever leaks, all that's exposed is a single dummy-data repo, so there's no real
risk in handing it over to the review team.

> Note: don't set a short expiration date. Google re-reviews this information every time you ship an app
> update, so if the token expires, update reviews get blocked.

## Filling Out the Login Details Form

Back in Play Console, selecting "Yes" and clicking **Add instructions** opens the form.

![Login details input form](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/playconsole_login_form_1784282739000.png)

Here's what I put in each field:

| Field | What I entered |
|---|---|
| Name | `GitHub token login` |
| Username/email | (left empty — the app has no username field) |
| Password | the issued `github_pat_...` token |
| Other info | the step-by-step instructions below |

The spot designed for apps that don't follow the username/password shape is the **"Other info needed to
access your app"** text area. The form's own description tells you to use this field for cases that can't
be expressed as username/password, like 2FA, QR codes, or biometrics. I wrote out the token auth flow
step by step there (there's a 500-character limit, so I had to keep it tight):

```text
This app does not use username/password login. It authenticates with
a GitHub personal access token only.

1. Paste the token (in the password field above) into the
   "GitHub Token" field on the first screen.
2. Tap "Verify connection".
3. Select repository "reponote-review-demo" → branch "main" → tap
   "Use repository root (/) as Vault".
4. All features (browse, edit, auto-commit, sync, conflict handling)
   are now testable.
```

![Step-by-step instructions written in the Other info field](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/playconsole_login_instructions_1784282739000.png)

A few tips on writing this part:

- **It has to be in English.** The top of the form explicitly states that information must be provided in English.
- I put the token itself in the "Password" field, and the instructions just point to that location.
  That also keeps the long token string from eating into the 500-character instruction limit.
- The checkbox at the bottom, **"The login details in this declaration provide full access to all
  functionality and content,"** should only be checked if that's actually true. I verified on my own phone
  that the demo repo's token alone unlocks every feature of the app before checking it.

## What It Looks Like When Done

Once added, it shows up in the list like this: "Password, Instructions" — meaning both the token and the
step-by-step instructions were registered.

![Login details registration complete](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/playconsole_login_done_1784282739000.png)

I left the toggle below it on (allow these login details to be used when testing on Google and trusted
partner devices). It's an option that can get me feedback during pre-launch testing, so there was no
reason to turn it off.

## Wrap-Up

| Step | What I did |
|---|---|
| Decision | Token auth still counts as "account login details" → chose **"Yes"** |
| Prep 1 | Created a review-only demo repo containing nothing but dummy notes |
| Prep 2 | Issued a fine-grained token scoped to just that repo (1-year expiration) |
| Filling out the form | Token in the password field, step-by-step English instructions in Other info |
| Verification | Confirmed, before submitting, that the token alone unlocks every feature of the app |

It all comes down to one thing. **Treat the reviewer like a first-time user and make sure a single copy-paste
and a few taps get them all the way through the app.** Even an app with no username/password can pass
review without issues, as long as you make good use of the "Other info" field.
