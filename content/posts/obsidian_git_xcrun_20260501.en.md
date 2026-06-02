---
title: 'The story of setting up the Obsidian Git plugin and encountering an xcrun error'
date: '2026-05-01'
description: How to resolve the xcrun error I encountered while connecting Obsidian to GitHub and setting up the Git plugin.
tags:
  - Obsidian
  - Git
  - macOS
  - GitHub
  - xcode
---]

When I started my LLM wiki, I decided to use Obsidian. It's markdown-based, developer-friendly, and the structure of linking notes together works well with wikis.

But I was worried about saving it locally. What if my Mac blows up? So I connected it to GitHub and set up automatic backups. The process was simple, except for one unexpected error that popped up at the end.

---

## Why Obsidian + Git

Obsidian is based on Markdown, so its files are all text. This is a perfect structure for version control with Git. And if you're using it on multiple devices, you can use GitHub as an intermediate repository to synchronize without Obsidian Sync (which is paid).

---]

## Preparation

- Installing Obsidian
- Create a GitHub account + empty repository
- Basic Mac Terminal usage

---

## Step 1 - Connect to GitHub repo

First, initialize the vault folder with a Git repo and connect it to GitHub.

```bash
cd ~/Documents/Obsidian\ Vault
git init
git remote add origin https://github.com/유저명/obsidian-vault.git
git add .
git commit -m "Initial vault commit"
git push -u origin main
```

---]

## Step 2 - Install the Obsidian Git plugin

Install it from inside your Obsidian app.

1. Settings (⚙️) → Community Plugins → Explore Community Plugins
2. search for **"Obsidian Git"** → Install → Activate

After installation, a folder called `.obsidian/plugins/obsidian-git/` will be created and settings will be saved in `data.json`.

---]

## Step 3 - Set up automatic synchronization

In the default installation, automatic commits/pushes/pulls are all turned off. You can turn them on as shown below.

| Item | Recommended value | Description
|---|---|---|---|
| Auto save interval | 10 minutes | Auto commit + push every 10 minutes |
| Auto pull interval | 10 minutes | Pull remotely every 10 minutes |
| Pull on startup | On | Up to date on app startup |
| Disable popups for no changes | On | Skip notifications for no changes |

You can change these in the Obsidian settings UI, or you can modify the `data.json` directly.

```json
"autoSaveInterval": 10,
"autoPushInterval": 10,
"autoPullInterval": 10,
"autoPullOnBoot": True,
"disablePopupsForNoChanges": true
```

---

## Step 4 - Set up GitHub authentication

If you connected over HTTPS, you'll need a GitHub Personal Access Token (PAT).

**To get a token:** 1.
1. GitHub → `Settings` → `Developer settings` → `Personal access tokens` → `Tokens (classic)`
2. `Generate new token` → `repo` Check permissions → Generate

Save to macOS Keychain (Terminal):** **Save to macOS Keychain (Terminal):** **Save to macOS Keychain (Terminal)

```bash
git config --global credential.helper osxkeychain
```

After that, when you enter your GitHub account and token on your first push/pull, it will be stored in your keychain and you will be automatically authenticated.

> **Note:** Never post your token in chat, code, or public repositories. If they are compromised, they should be immediately destroyed and reissued.

---]

## Troubleshooting - xcrun error

After finishing the setup, I turned on Obsidian and got this popup.

```
xcrun: error: invalid active developer path (/Library/Developer/CommandLineTools),
missing xcrun at: /Library/Developer/CommandLineTools/usr/bin/xcrun
```

Git calls `xcrun` internally, and this error is caused by Xcode Command Line Tools not being installed properly. It often appears after upgrading macOS or performing a clean install.

**Workaround:**

In the Terminal, run the following two commands in sequence.

```bash
# 1. install Command Line Tools (click "Install" when it pops up)
xcode-select --install

# 2. reset the path after installation is complete
sudo xcode-select --reset
```

The installation will take a few minutes. Restart Obsidian after it finishes and the error should disappear.

---]

## Organization - the whole flow at a glance

```
Create a GitHub repo
    ↓
Connect git init + remote on vault folder
    ↓
Install + activate the Git plugin from Obsidian
    ↓ Set up the
Set an auto-commit/pull interval (10 minutes recommended)
    ↓
Issue GitHub PAT + save keychain
    ↓Run
xcode-select --install + --reset (in case of error)
    ↓
Restart Obsidian → auto-sync complete
```

Once you've set it up once, you don't have to worry about it anymore and it will back up every 10 minutes. If you're done setting up your PC, you can follow the steps in the [next post](/posts/obsidian_git_mobile_20260501) to connect the same vault on Android.
