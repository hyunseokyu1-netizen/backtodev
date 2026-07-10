---
title: 'Logging Into Claude Code With a Different Account, Only in a Specific Folder — Using direnv'
date: '2026-06-17'
publish_date: '2026-06-22'
description: How to combine CLAUDE_CONFIG_DIR and direnv to keep separate Claude Code login accounts per project folder
tags:
  - Claude Code
  - direnv
  - Dev Environment
  - macOS
---

Anyone juggling a work account and a personal account has hit this problem at some point. Once you log into Claude Code, every folder uses the same account. But there comes a moment when you think, "I want just this one project to run under a different account" — work under the work account, a personal blog under the personal account.

To cut to the chase: there's no built-in feature like "auto-switch account when you open this folder." That's because Claude Code's login isn't managed per folder — it's managed per **config directory**. But combine the `CLAUDE_CONFIG_DIR` environment variable with `direnv`, and you can make it automatically use a different account session the moment you enter a specific folder. I actually set this up today for my blog project.

## First, the mechanics

Two things matter here.

- By default, Claude Code uses `~/.claude` as its config/session storage directory. The login session is tied to this location.
- Point the `CLAUDE_CONFIG_DIR` environment variable somewhere else, and you get a **completely separate login state** rooted at that path.

In other words: "when running from this folder, point at a different config dir → different account." So who automatically flips that environment variable every time you enter a folder? That's where `direnv` comes in.

`direnv` is a tool that reads the `.envrc` file in a folder and applies its environment variables automatically the moment you enter it, then reverts them the moment you leave. A perfect fit for per-folder environment isolation.

## Prerequisites

Assuming macOS with Homebrew installed. All you need is `direnv`.

```bash
brew install direnv
direnv --version   # something like 2.37.1 confirms it's OK
```

## Step 1. Register the direnv hook in your shell

Installing `direnv` alone doesn't do anything. You need to register a hook so your shell calls `direnv` every time it detects a folder change. For zsh, add one line at the bottom of `~/.zshrc`.

```bash
# direnv
eval "$(direnv hook zsh)"
```

If you're on bash, add `eval "$(direnv hook bash)"` to `~/.bashrc` instead. After adding this, open a new terminal or run `source ~/.zshrc` to apply it.

## Step 2. Create a dedicated config directory for this project

To keep it from mixing with the default `~/.claude`, carve out a separate directory just for this project. Name it after the project so it's easy to recognize.

```bash
mkdir -p ~/.claude-backtodev
```

This folder holds the session and config for the "other account."

## Step 3. Write .envrc at the project root

Now create `.envrc` so that `CLAUDE_CONFIG_DIR` points at the directory you just made, whenever you're inside the project folder.

```bash
# from the project root
echo 'export CLAUDE_CONFIG_DIR="$HOME/.claude-backtodev"' > .envrc
```

The file content is exactly one line.

```bash
export CLAUDE_CONFIG_DIR="$HOME/.claude-backtodev"
```

## Step 4. Add it to .gitignore

`.envrc` is local development configuration and shouldn't end up in the repo. Add it to `.gitignore` along with the `.direnv/` cache folder.

```bash
# direnv (per-folder Claude account)
.envrc
.direnv/
```

## Step 5. Approve it with direnv allow

For security, `direnv` never auto-executes an `.envrc` it doesn't already trust. The first time you create or modify one, you need to explicitly approve it.

```bash
direnv allow
```

Forget this step, and entering the folder won't pick up the environment variable — you'll just see a warning like this.

```
direnv: error .envrc is blocked. Run `direnv allow` to approve its content
```

Once approved, entering the folder shows a log like this.

```
direnv: loading ~/.../backtodev/.envrc
direnv: export +CLAUDE_CONFIG_DIR
```

Confirm it's applied like so.

```bash
echo $CLAUDE_CONFIG_DIR
# /Users/hy/.claude-backtodev
```

## Step 6. Log in with a different account from there

That's it. Open a new terminal, move into the project folder, and `direnv` applies the environment variable automatically.

```bash
cd ~/Documents/workspace/claude_code/backtodev   # direnv loading...
claude                                            # new session → log in with a different account
```

Since `CLAUDE_CONFIG_DIR` points to an empty directory, Claude Code treats this as a "first run" and shows the login screen. Log in with whichever account you want here. Leave this folder, and the environment variable disappears, reverting back to your original account.

## Frequently used commands

| Command | Purpose |
|--------|------|
| `brew install direnv` | install direnv |
| `eval "$(direnv hook zsh)"` | register the shell hook (.zshrc) |
| `direnv allow` | approve the current folder's .envrc |
| `direnv reload` | reload after changing .envrc |
| `direnv exec . <cmd>` | run a command once with .envrc applied |
| `echo $CLAUDE_CONFIG_DIR` | check whether it's applied |

## Troubleshooting: macOS keychain sharing

One thing worth watching out for. On macOS, Claude Code's OAuth login credentials sometimes get stored not in the config directory but in the **system keychain** (an entry called `Claude Code-credentials`). In that case, simply changing `CLAUDE_CONFIG_DIR` doesn't stop the keychain from being shared, which can cause you to launch into a new directory and **land straight into your existing account without seeing a login screen at all**.

Depending on the symptom:

- **New config dir, but it logs straight into the existing account** → the keychain is being shared. Inside that session, run `/login` (or `/logout` and log back in) to switch accounts.
- **Want stricter isolation** → you can go with API-key-based auth instead of OAuth. Add `export ANTHROPIC_API_KEY=...` to `.envrc`, and since the key itself differs per folder, you're free of keychain-sharing issues entirely.

## Reverting: how to undo direnv

Once you no longer need the separation, you can cleanly revert it. The steps differ depending on scope.

**1) Undo isolation just for this folder (keep using direnv elsewhere)**

Just delete or disable `.envrc`. Entering the folder no longer applies `CLAUDE_CONFIG_DIR`.

```bash
rm .envrc                 # remove the isolation config
# or, to just disable it temporarily
direnv deny               # block .envrc (revokes the allow). re-enable later with direnv allow
```

If you still see leftover `direnv: error` logs after deleting `.envrc`, leaving and re-entering the folder once clears it up. If you no longer need the dedicated config directory (`~/.claude-backtodev`), delete that too.

```bash
rm -rf ~/.claude-backtodev
```

**2) Remove direnv entirely**

If you're not using it in any other project either, strip out the hook and the package too.

```bash
# 1. Remove this line from ~/.zshrc
#    eval "$(direnv hook zsh)"

# 2. Uninstall the package
brew uninstall direnv

# 3. Open a new terminal to apply
```

If you remove the package without removing the hook line first, you'll get `direnv: command not found` on every shell startup — so stick to the order **remove the hook line → uninstall**.

## Logging back into your default (main) account

Separate from folder isolation, sometimes you want to change or re-login to your default `~/.claude` account. Do this from a plain terminal where `CLAUDE_CONFIG_DIR` is **not** applied.

```bash
# run outside the isolated folder (e.g. your home directory) to use the default config dir
cd ~
echo $CLAUDE_CONFIG_DIR   # empty means you're using the default ~/.claude

claude                    # then, once it's running
/logout                   # log out of the current account
/login                    # log back in (choose an account)
```

The key is checking **which config dir the location you're logging in from points to**. An empty `echo $CLAUDE_CONFIG_DIR` means the default account; something like `~/.claude-backtodev` means you're touching the isolated account.

> On macOS, if the keychain is shared, logging out and back in via `/logout` might still land you on the same account. In that case, delete the `Claude Code-credentials` entry in Keychain Access first, then log back in for a clean reset.

## Summary

Here's the whole flow at a glance.

1. `brew install direnv` → install
2. `eval "$(direnv hook zsh)"` in `~/.zshrc` → register the hook
3. `mkdir -p ~/.claude-<project-name>` → create a dedicated config directory
4. Write `.envrc` at the project root (`export CLAUDE_CONFIG_DIR=...`)
5. Add `.envrc`, `.direnv/` to `.gitignore`
6. `direnv allow` → approve
7. Enter the folder and run `claude` → log in with a different account

`direnv` is broadly useful for per-project environment variable isolation beyond just this case, so setting it up once pays off repeatedly. If you're switching between work and personal accounts, set up an automatic per-folder switch instead of logging out and back in every time. It makes things noticeably easier.
