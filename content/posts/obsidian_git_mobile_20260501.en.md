---
title: 'Obsidian Git Mobile Settings - Synchronizing GitHub on Android'
date: '2026-05-01'
description: How to clone a GitHub repo with the Obsidian Git plugin on Android and set up automatic synchronization.
tags:
  - Obsidian
  - git
  - android
  - GitHub
  - Mobile
---

The concept of an "LLM wiki" has been trending lately. It means storing what you learn while studying in a wiki, and I wanted to give it a try. When I looked for a tool, I naturally found Obsidian. It's Markdown-based, familiar to developers, and the way it links notes fits the wiki structure perfectly.

I set it up on my PC, connected it to GitHub, and started using it. This time, I realized it was a good idea.

> "I want to be able to record things on the go, so why not do it on my phone?"

The Obsidian Git plugin works on mobile, but the setup is a little different from PC. Since mobile doesn't have system git, the plugin uses its own built-in git (isomorphic-git). That means you don't need to install a separate app, just the plugin.

---

## Preparation

- Install **Obsidian** on your Android phone
- A GitHub account and an existing vault repository
- GitHub Personal Access Token (PAT) - if you don't have one, get one below

### How to get a PAT

1. GitHub → `Settings` → `Developer settings`
2. `Personal access tokens` → `Tokens (classic)`
3. Click `Generate new token`
4. Check **repo** permission → Generate
5. Copy the token (it will only be shown once)

> A token is like a password. Don't paste it into notepad or chat.

---

## Step 1 - Install Obsidian and create a vault

1. Install **Obsidian** from the Play Store
2. Launch the app and tap **Create a new vault**
3. Name it the same as your PC vault to avoid confusion, for example `Obsidian Vault`

> It's okay if the vault is still empty. We'll clone it from GitHub anyway.

---

## Step 2 - Install the Obsidian Git plugin

1. Go to `Settings (⚙️)` → `Community Plugins`
2. Click **Turn off restricted mode** so you can use community plugins
3. Search for "Obsidian Git"
4. Install and activate it

---

## Step 3 - Enter your credentials

Mobile doesn't have a system keychain, so you need to enter the values directly in the plugin settings.

Go to `Settings` → `Obsidian Git`:

| Item | Value |
|---|---|
| **Username** | Your GitHub ID |
| **Password/Token** | The PAT you issued |
| **Author name** | The name that will appear in commits |
| **Author email** | Your GitHub account email |

> If you don't enter the author name and email, committing will fail. Fill them in.

---

## Step 4 - Clone the GitHub repo

This is where people get stuck. You can't just create a vault and connect Git afterward. You have to **run the clone command**.

1. Open the `≡` menu in the bottom toolbar
2. Type **Clone** in the top search bar
3. Select **Clone an existing remote repo**
4. Enter the URL:

```text
https://github.com/유저명/레포이름.git
```

5. Leave the vault path blank to clone directly into the root
6. Confirm and start the clone

Once cloning finishes, all the notes on GitHub will be pulled down to your phone.

---

## Step 5 - Set up automatic synchronization

In `Settings` → `Obsidian Git`, set the values below:

| Item | Recommended value |
|---|---|
| Auto save interval | 10 minutes |
| Auto pull interval | 10 minutes |
| Pull on startup | On |
| Disable popups for no changes | On |

This will automatically pull the latest content on startup and push changes every 10 minutes.

---

## Troubleshooting

### "Can't find a valid git repository" error

This is the most common error. It happens when you create a new vault but never clone the repo into it.

→ **Resolve it by running the clone process in Step 4.**

### Authentication failed during clone

Your PAT is incorrect or missing. Go back to Step 3 and check the username and token.

### It commits but doesn't push

The author name and email are often missing. Fill them in in the settings.

---

## Overview - the whole flow at a glance

```text
Install Obsidian + create a new vault
    ↓
Install and activate the Obsidian Git plugin
    ↓
Enter your GitHub credentials in the plugin settings
    (Username / PAT / Author name / Email)
    ↓
Run "Clone an existing remote repo"
    ↓
Enter the GitHub URL → Complete cloning
    ↓
Set the automatic synchronization interval (10 minutes recommended)
    ↓
PC ↔ Phone two-way automatic synchronization complete
```

As you build up your LLM wiki, you'll come up with ideas on the go. Once it's set up, you can take notes on your phone, continue on your PC, and focus on the notes themselves.
