---
title: 'Claude Code Hooks — Automate Tasks When Claude Finishes'
date: '2026-04-20'
description: Auto-format on save, response completion alerts, approval request notifications — a step-by-step guide to automating repetitive tasks with Claude Code Hooks.
tags:
  - ClaudeCode
  - Hooks
  - Automation
---

While using Claude Code, you might find yourself thinking:

> "Can't it just run the formatter automatically every time it saves a file?"  
> "I wish I got a notification when Claude finishes responding…"  
> "Claude was waiting for my approval and I missed it while looking at another window…"

If you've been doing these things manually or putting them off — Hooks is exactly what you need.

---

## What Are Hooks?

Claude Code Hooks are **shell commands that run automatically when specific events occur**.

For example:
- Right after Claude edits a file → run `prettier` automatically
- Right after Claude finishes responding → macOS notification popup + sound effect
- When Claude is waiting for approval → a different sound for that
- Before a Bash command runs → log it to a file

Claude Code itself executes these, so you don't have to type anything. Set them up once and they just run.

---

## Where to Configure Hooks

Hooks are written in `settings.json`. There are three file locations:

| File Path | Scope | Git Committed |
|---|---|---|
| `~/.claude/settings.json` | Global (all projects) | No |
| `.claude/settings.json` | Current project (team-shared) | Yes |
| `.claude/settings.local.json` | Current project (personal) | No |

Personal conveniences (notifications, formatters) go in global settings. Rules the whole team needs go in the project settings.

---

## Hook Structure at a Glance

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolName",
        "hooks": [
          {
            "type": "command",
            "command": "shell command to run"
          }
        ]
      }
    ]
  }
}
```

- **EventName**: when to run (`Stop`, `Notification`, `PostToolUse`, `PreToolUse`, etc.)
- **matcher**: which tool to respond to (`Write`, `Edit`, `Bash`, etc.). Not needed for Stop/Notification
- **command**: the actual shell command to execute

---

## Main Event Types

| Event | When It Fires |
|---|---|
| `Stop` | When Claude finishes responding and goes idle |
| `Notification` | When Claude Code triggers a notification (e.g., approval request) |
| `PostToolUse` | After a tool (Write, Edit, Bash, etc.) runs successfully |
| `PreToolUse` | Just before a tool runs |
| `SessionStart` | When a session starts |
| `PreCompact` | Just before context compression |

---

## Step-by-Step Setup

### Step 1 — Open the Global Settings File

```bash
# Open directly in the terminal
open ~/.claude/settings.json

# Or from inside Claude Code
# ! open ~/.claude/settings.json
```

If the file doesn't exist, create it:

```json
{}
```

### Step 2 — Stop Hook: Response Completion Notification + Sound (macOS)

Let's make macOS show a notification popup and play a sound when Claude finishes responding.

I first tried using the `sound name` option in `osascript`, but in practice the notification appeared without any sound in some cases — it seems to vary by notification settings and macOS version.

So I split them: `osascript` handles only the popup, and `afplay` plays the sound directly.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude has finished responding.\" with title \"Claude Code\"' 2>/dev/null; afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true",
            "async": true
          }
        ]
      }
    ]
  }
}
```

**Key points:**
- `async: true` — runs the notification in the background so it doesn't block Claude's response
- `osascript` — handles only the popup (no `sound name`)
- `afplay` — plays the sound directly using a macOS built-in sound file path
- `;` between commands — the second runs even if the first fails
- `2>/dev/null || true` — prevents hook failure if an error occurs

**Available macOS built-in sounds:**

```
/System/Library/Sounds/Glass.aiff
/System/Library/Sounds/Ping.aiff
/System/Library/Sounds/Funk.aiff
/System/Library/Sounds/Basso.aiff
/System/Library/Sounds/Hero.aiff
/System/Library/Sounds/Purr.aiff
```

Swap in whichever one you prefer.

### Step 3 — Notification Hook: Approval Request Alert

Claude Code asks for user approval before sensitive operations like file edits and command execution. The problem is that if you miss it while looking at another window, Claude just sits there doing nothing.

The `Notification` event lets you get an instant alert when an approval request comes in.

```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Approval needed. Claude is waiting.\" with title \"Claude Code\"' 2>/dev/null; afplay /System/Library/Sounds/Ping.aiff 2>/dev/null || true",
            "async": true
          }
        ]
      }
    ]
  }
}
```

The key is using a different sound from the Stop hook:

- **Stop** → `Glass.aiff` : "Response done, ready for input"
- **Notification** → `Ping.aiff` : "Hold on, approval needed"

You can tell the situation just from the sound.

### Step 4 — PostToolUse Hook: Auto-Format After File Save

This hook runs `prettier` automatically whenever Claude edits a file.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path // .tool_response.filePath' | { read -r f; prettier --write \"$f\" --ignore-unknown; } 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

**How it works:**
1. The hook receives JSON via stdin when it runs
2. `jq` extracts the file path
3. Prettier runs on that file

### Step 5 — PreToolUse Hook: Log All Bash Commands

To keep a log of every Bash command Claude runs:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '\"[\" + (now | strftime(\"%Y-%m-%d %H:%M:%S\")) + \"] \" + .tool_input.command' >> ~/.claude/bash-history.log"
          }
        ]
      }
    ]
  }
}
```

Commands will accumulate with timestamps in `~/.claude/bash-history.log`.

### Step 6 — Putting It All Together

Combined into one settings file:

```json
{
  "language": "Korean",
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Approval needed. Claude is waiting.\" with title \"Claude Code\"' 2>/dev/null; afplay /System/Library/Sounds/Ping.aiff 2>/dev/null || true",
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude has finished responding.\" with title \"Claude Code\"' 2>/dev/null; afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true",
            "async": true
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path // .tool_response.filePath' | { read -r f; prettier --write \"$f\" --ignore-unknown; } 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

**Never wipe out your existing config.** Always read → merge → save.

---

## Applying Hook Settings

After saving the settings file, changes may not take effect immediately if Claude Code is already running.

```
/hooks
```

Type `/hooks` inside Claude Code to open the settings panel. Just closing it reloads the settings.  
Or restart the session for a guaranteed reload.

---

## Common Patterns Reference

| Purpose | Event | matcher | Sound |
|---|---|---|---|
| Response completion alert | `Stop` | none | `Glass.aiff` |
| Approval request alert | `Notification` | none | `Ping.aiff` |
| Auto-format after file edit | `PostToolUse` | `Write\|Edit` | — |
| Bash command logging | `PreToolUse` | `Bash` | — |
| Message on session start | `SessionStart` | none | — |

---

## Troubleshooting

### Hooks aren't running

1. **JSON syntax error** — the most common cause. Check with:
   ```bash
   jq . ~/.claude/settings.json
   ```
   If the JSON prints cleanly, it's fine.

2. **Settings not yet reloaded** — type `/hooks` and close it, or restart the session

3. **matcher case mismatch** — `Write`, `Edit`, `Bash` must be capitalized exactly

### osascript sound isn't playing

The `sound name "Glass"` option may not work depending on macOS notification settings or version.

**Fix:** Play the sound separately with `afplay`:

```bash
# Test the sound on its own
afplay /System/Library/Sounds/Glass.aiff
```

If you hear it running directly, it'll work in a hook too.

### Hooks are slowing down Claude's responses

- Add `async: true` to run the hook in the background without blocking the response
- Long-running tasks (test suites, etc.) should always be async

### jq not found

```bash
brew install jq
```

On macOS, install via Homebrew. On most Linux distributions: `apt install jq` or `yum install jq`.

---

## Summary — The Core Flow

```
1. Open ~/.claude/settings.json (or .claude/settings.json)
2. Under "hooks", write: EventName → matcher → command
3. jq . filepath  →  validate JSON syntax
4. Type /hooks and close  →  reload settings
5. Verify it works
```

Start with just the Stop hook. Hearing a "ding" every time Claude finishes is surprisingly satisfying.

Then add the Notification hook. If you've ever had Claude freeze while waiting because you missed an approval prompt — add this. Having a different sound from Stop makes it easy to tell situations apart by ear alone.

If `osascript`'s `sound name` isn't cooperating, don't panic — just switch to `afplay`. Figuring it out hands-on is always the fastest path.
