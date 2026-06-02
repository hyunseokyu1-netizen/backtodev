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

The concept of "LLM Wiki" has been trending lately. It's a way of storing things you've learned while studying for your LLM in a wiki, and I wanted to give it a try. When I was looking for a tool to use, I naturally came across Obsidian. It's based on Markdown, which is familiar to developers, and the way you connect notes with links fits the wiki structure perfectly.

I set it up on my PC, connected it to GitHub, and started using it, and this time, I realized that this was a good idea.

> "I want to be able to record things on the go, so why not do it on my phone?"

The Obsidian Git plugin works on mobile. However, the setup is a bit different from PC. Since there is no system git on mobile, the plugin uses its own built-in git (isomorphic-git). This means that you don't need to install a separate app, just the plugin.

---]

## Preparation

- Install **Obsidian** on your Android phone
- GitHub account + existing vaulted repository
- GitHub Personal Access Token (PAT) - if you don't have one, get one below

### How to get a PAT

1. GitHub → `Settings` → `Developer settings`
2. `Personal access tokens` → `Tokens (classic)`
3. Click on `Generate new token` 4.
4. check **repo** permission → Generate
5. copy the token (it will only be shown once)

> A token is like a password. Don't just paste it into notepad or chat.

---]

## Step 1 - Install Obsidian + create a vault

1. install **Obsidian** from the Play Store
2. launch the app → **Create a new vault**.
3. name it the same as your PC to avoid confusion (e.g. `Obsidian Vault`)

> It's okay if the vault is still empty. I'll clone it from GitHub anyway.

---]

## Step 2 - Install the Obsidian Git plugin

1. Go to `Settings (⚙️)` → `Community Plugins`.
2. click **"Turn off restricted mode"** (otherwise you won't be able to use the community plugin)
3. Navigate to Community Plugins → Search for "Obsidian Git"
4. install → activate

---]

## Step 3 - Enter your credentials (important)

Mobile doesn't have a system keychain, so you'll need to enter it directly in the plugin settings.

Scroll down to `Settings` → `Obsidian Git`:

| Items | Enter.
|---|---|
| **Username** | Your GitHub ID |
| **Password/Token** | The PAT you issued |
| **Author name** | Name that will appear in commits |
| **Author email** | GitHub account email |

> If you don't enter the author name/email, you'll get an error when committing. Must fill in.

---

## Step 4 - Clone the GitHub repo

This is where we get stuck. You can't just create a vault and connect to Git, you have to **run the clone command**.

1. click the `≡` menu tab in the bottom toolbar
2. type **"Clone"** in the top search bar
3. select "Clone an existing remote repo"
4. enter the URL:
   ```
   https://github.com/유저명/레포이름.git
   ```
5. save path in vault: **Leave blank** (clone directly to root)
6. confirm → start clone

Once the clone is complete, all the notes on GitHub will come down to your phone.

---

## Step 5 - Set up automatic synchronization

In `Settings` → `Obsidian Git`, set to the values below:

| Items | Recommended values |
|---|---|
| Auto save interval | 10 (minutes) |
| Auto pull interval | 10 (minutes) |
| Pull on startup | On
| Disable popups for no changes | On |

This will automatically get the latest content on startup and push changes every 10 minutes.

---]

## Troubleshooting

### "Can't find a valid git repository" error

The most common error. Caused by creating a new vault and not cloning it.

→ **Resolved by running the clone process in Step 4**.

### Authentication failed during clone

PAT is incorrect or not entered. Go back to Step 3 and reconfirm Username and Token.

### Commits but doesn't push

Author name/email is often missing. Fill it in in the settings to fix it.

---]

## Organize - the whole flow at a glance

```
Install Obsidian + create a new vault
    ↓]
Install + activate the Obsidian Git plugin
    ↓
Enter your GitHub credentials in the plugin settings
(Username / PAT / Author name / email)
    ↓ Run
Run "Clone an existing remote repo"
    ↓
Enter GitHub URL → Complete clone
    ↓
Set the automatic synchronization interval (10 minutes is recommended)
    ↓Click
PC ↔ Phone two-way automatic synchronization completed
```

As you build up your LLM wiki, you'll come up with ideas on the go. Once set up, you can take notes on your phone, continue on your PC, and just focus on your notes.
