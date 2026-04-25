---
title: 'Connecting Gemini to Claude Code via MCP — Using Two AIs Without Token Anxiety'
date: '2026-04-21'
description: A step-by-step guide to connecting Gemini as an MCP tool inside Claude Code, so you can delegate token-heavy tasks to Gemini without leaving your workflow.
tags:
  - ClaudeCode
  - MCP
  - Gemini
  - AI
---

At some point while using Claude Code, you'll run into this message.

> *"Approaching context limit"*

Large file analysis, long log parsing, repetitive processing — Claude is powerful, but it burns through tokens fast. And switching to Gemini in a separate browser tab for copy-pasting defeats the purpose of having an AI assistant in the first place.

This post covers how to **connect Gemini as an MCP tool inside Claude Code**, so you can say "handle this one with Gemini" and have it just work.

---

## What is MCP?

MCP (Model Context Protocol) is the protocol that lets Claude Code call external tools and services. Think of it as **a plugin system for Claude Code**.

Once you register an MCP server, Claude can call its functions directly mid-conversation. Wrap the Gemini API in an MCP server, and Gemini becomes a tool Claude can use on demand.

```
User → Claude Code → (when needed) Gemini MCP Server → Gemini API
```

---

## Prerequisites

- Node.js 20 or higher
- Claude Code CLI installed
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey)

---

## Step 1 — Create the MCP Server Directory

Placing the server inside the Claude config folder makes it available across all projects.

```bash
mkdir -p ~/.claude/mcp-servers/gemini
cd ~/.claude/mcp-servers/gemini
```

---

## Step 2 — Write package.json

```json
{
  "name": "gemini-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "dependencies": {
    "@google/generative-ai": "^0.24.0",
    "@modelcontextprotocol/sdk": "^1.10.2"
  }
}
```

`"type": "module"` is required for ES Module syntax.

---

## Step 3 — Write the MCP Server (index.js)

This server exposes two tools:
- `ask_gemini` — sends a text prompt
- `ask_gemini_with_file` — sends a file's contents along with the prompt (for large file analysis)

```js
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY environment variable is not set.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const server = new Server(
  { name: "gemini-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ask_gemini",
      description:
        "Send a question or task to Gemini AI. Best used for long document analysis, large file summarization, and repetitive text processing that would otherwise burn through Claude's context.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "The prompt to send to Gemini" },
          model: {
            type: "string",
            description: "Model to use (default: gemini-2.0-flash)",
            default: "gemini-2.0-flash",
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "ask_gemini_with_file",
      description:
        "Send a file's contents along with a prompt to Gemini. Ideal for analyzing large files.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "The prompt to send alongside the file" },
          file_path: { type: "string", description: "Absolute path to the file to analyze" },
          model: {
            type: "string",
            description: "Model to use (default: gemini-2.0-flash)",
            default: "gemini-2.0-flash",
          },
        },
        required: ["prompt", "file_path"],
      },
    },
  ],
}));

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "ask_gemini") {
      const model = genAI.getGenerativeModel({
        model: args.model || "gemini-2.0-flash",
      });
      const result = await model.generateContent(args.prompt);
      return { content: [{ type: "text", text: result.response.text() }] };
    }

    if (name === "ask_gemini_with_file") {
      const fileContent = fs.readFileSync(args.file_path, "utf-8");
      const model = genAI.getGenerativeModel({
        model: args.model || "gemini-2.0-flash",
      });
      const prompt = `${args.prompt}\n\n--- File contents (${args.file_path}) ---\n${fileContent}`;
      const result = await model.generateContent(prompt);
      return { content: [{ type: "text", text: result.response.text() }] };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Step 4 — Install Dependencies

```bash
npm install
```

---

## Step 5 — Register the MCP Server with Claude Code

> **Important**: Do NOT manually add `mcpServers` to `~/.claude/settings.json` — it will fail schema validation. Always use the `claude mcp add` command.

```bash
claude mcp add gemini -s user \
  -e GEMINI_API_KEY=your_api_key_here \
  -- node ~/.claude/mcp-servers/gemini/index.js
```

| Option | Description |
|--------|-------------|
| `-s user` | Register globally (available in all projects) |
| `-e KEY=VALUE` | Environment variable injected at server startup |
| `--` | Separator between CLI flags and the run command |

---

## Step 6 — Verify the Connection

```bash
claude mcp list
```

Expected output:
```
gemini: node ~/.claude/mcp-servers/gemini/index.js - ✓ Connected
```

Once you see `✓ Connected`, restart Claude Code and Gemini is ready to use mid-conversation.

---

## Usage Examples

Just tell Claude what you want in natural language:

```
Analyze this file with Gemini: /path/to/large-log.txt
```

```
Use Gemini to summarize this long document
```

```
This is repetitive text transformation — handle it with Gemini
```

Claude will decide whether to call `ask_gemini` or `ask_gemini_with_file` based on the request.

---

## When to Use Gemini vs Claude

| Task | Recommended |
|------|-------------|
| Large log / file analysis | **Gemini** (1M token context) |
| Long document summarization | **Gemini** |
| Repetitive text processing | **Gemini** |
| Code implementation / editing | **Claude** |
| Architecture design | **Claude** |
| Complex debugging | **Claude** |

---

## Troubleshooting

### Added mcpServers to settings.json manually and got an error

```
Settings validation failed: Unrecognized field: mcpServers
```

Claude Code's `settings.json` schema does not allow `mcpServers` directly. Always use `claude mcp add`. The actual config is stored in `~/.claude.json`.

### 429 Too Many Requests

```
RESOURCE_EXHAUSTED: Free tier quota exceeded
```

The Gemini API free tier has daily and per-minute limits. Options:

1. **Wait until tomorrow** — free tier resets daily
2. **Issue a new API key** — create a new project in Google AI Studio
3. **Upgrade to paid** — link billing in Google AI Studio

To swap API keys:

```bash
claude mcp remove gemini
claude mcp add gemini -s user -e GEMINI_API_KEY=new_key -- node ~/.claude/mcp-servers/gemini/index.js
```

### Connected but tool calls aren't working

**Fully restart** the Claude Code session. Newly registered MCP servers aren't picked up until Claude Code restarts.

---

## Summary

```
[1] Create directory
    mkdir -p ~/.claude/mcp-servers/gemini
            ↓
[2] Write package.json + index.js
            ↓
[3] npm install
            ↓
[4] Register with claude mcp add
    (never edit settings.json directly)
            ↓
[5] Verify with claude mcp list → ✓ Connected
            ↓
[6] Restart Claude Code and use it
    "Handle this one with Gemini"
```

Set it up once and Gemini is available in any project. Claude handles the precision work; Gemini handles the volume. Together, the token anxiety mostly goes away.
