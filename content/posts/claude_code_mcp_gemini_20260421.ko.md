---
title: 'Claude Code에서 MCP로 Gemini 연결하기 — 토큰 걱정 없이 두 AI 함께 쓰기'
date: '2026-04-21'
description: Claude Code 안에서 Gemini를 MCP 툴로 연결해 토큰 부담 없이 두 AI를 상황에 맞게 나눠 쓰는 방법을 단계별로 정리합니다.
tags:
  - ClaudeCode
  - MCP
  - Gemini
  - AI
---

Claude Code를 쓰다 보면 어느 순간 이런 메시지를 마주치게 된다.

> *"컨텍스트 한도에 가까워졌습니다"*

대용량 파일 분석, 긴 로그 파싱, 반복적인 단순 작업... Claude는 강력하지만 토큰 소비가 상당하다. 그렇다고 Gemini를 따로 브라우저에서 열어서 복붙하는 건 너무 번거롭다.

이 글에서는 **Claude Code 안에서 Gemini를 MCP 툴로 연결**해서, 내가 필요할 때 "이건 Gemini한테 맡겨줘"라고 말하면 바로 처리되게 만드는 방법을 공유한다.

---

## MCP가 뭔데?

MCP(Model Context Protocol)는 Claude Code가 외부 도구/서비스를 불러쓸 수 있게 해주는 프로토콜이다. 쉽게 말하면 **Claude Code용 플러그인 시스템**이다.

MCP 서버를 하나 만들어서 등록해두면, 나(Claude)가 대화 중에 그 서버의 함수를 직접 호출할 수 있다. Gemini API를 감싼 MCP 서버를 만들면, Claude Code 안에서 Gemini를 툴처럼 쓸 수 있는 것이다.

```
사용자 → Claude Code → (필요시) Gemini MCP 서버 → Gemini API
```

---

## 사전 준비

- Node.js 20 이상
- Claude Code CLI 설치됨
- [Google AI Studio](https://aistudio.google.com/apikey)에서 발급한 **Gemini API 키**

---

## Step 1. MCP 서버 디렉토리 만들기

Claude Code 설정 폴더 안에 서버를 두면 어느 프로젝트에서든 사용할 수 있다.

```bash
mkdir -p ~/.claude/mcp-servers/gemini
cd ~/.claude/mcp-servers/gemini
```

---

## Step 2. package.json 작성

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

`"type": "module"` — ES Module 방식을 쓰기 위해 반드시 필요하다.

---

## Step 3. MCP 서버 본체 작성 (index.js)

두 가지 툴을 제공한다:
- `ask_gemini` — 텍스트 프롬프트만 전달
- `ask_gemini_with_file` — 파일 내용을 함께 전달 (대용량 파일 분석용)

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
  console.error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const server = new Server(
  { name: "gemini-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 툴 목록 정의
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ask_gemini",
      description:
        "Gemini AI에게 질문하거나 작업을 요청합니다. 토큰이 많이 필요한 긴 문서 분석, 대용량 파일 요약, 반복적인 단순 작업에 활용하세요.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Gemini에게 보낼 프롬프트" },
          model: {
            type: "string",
            description: "사용할 모델 (기본값: gemini-2.0-flash)",
            default: "gemini-2.0-flash",
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "ask_gemini_with_file",
      description:
        "파일 내용을 포함해 Gemini에게 질문합니다. 대용량 파일 분석에 적합합니다.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "파일과 함께 보낼 프롬프트" },
          file_path: { type: "string", description: "분석할 파일의 절대 경로" },
          model: {
            type: "string",
            description: "사용할 모델 (기본값: gemini-2.0-flash)",
            default: "gemini-2.0-flash",
          },
        },
        required: ["prompt", "file_path"],
      },
    },
  ],
}));

// 툴 실행 핸들러
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
      const prompt = `${args.prompt}\n\n---파일 내용 (${args.file_path})---\n${fileContent}`;
      const result = await model.generateContent(prompt);
      return { content: [{ type: "text", text: result.response.text() }] };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `오류 발생: ${error.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Step 4. 의존성 설치

```bash
npm install
```

---

## Step 5. Claude Code에 MCP 서버 등록

> **주의**: `~/.claude/settings.json`에 직접 `mcpServers` 필드를 추가하면 **스키마 검증 오류**가 난다. 반드시 `claude mcp add` 명령어를 사용해야 한다.

```bash
claude mcp add gemini -s user \
  -e GEMINI_API_KEY=여기에_API_키_입력 \
  -- node ~/.claude/mcp-servers/gemini/index.js
```

옵션 설명:

| 옵션 | 설명 |
|------|------|
| `-s user` | 사용자 전체 범위 등록 (모든 프로젝트에서 사용 가능) |
| `-e KEY=VALUE` | 서버 실행 시 주입할 환경변수 |
| `--` | 이후가 실행 명령어임을 구분하는 구분자 |

---

## Step 6. 연결 확인

```bash
claude mcp list
```

출력 결과:
```
gemini: node ~/.claude/mcp-servers/gemini/index.js - ✓ Connected
```

`✓ Connected`가 보이면 성공이다. Claude Code를 재시작하면 대화 중에 바로 Gemini를 쓸 수 있다.

---

## 실제 사용 예시

Claude Code 대화창에서 이렇게 요청하면 된다:

```
이 파일은 Gemini한테 분석시켜줘: /path/to/large-log.txt
```

```
이 긴 문서 요약은 Gemini 써줘
```

```
반복적인 텍스트 변환 작업이라서 Gemini로 처리해줘
```

Claude가 판단해서 `ask_gemini` 또는 `ask_gemini_with_file` 툴을 호출한다.

---

## 언제 Gemini를 쓰면 좋을까?

| 작업 | 추천 모델 |
|------|-----------|
| 대용량 로그/파일 분석 | **Gemini** (컨텍스트 1M 토큰) |
| 긴 문서 요약 | **Gemini** |
| 단순 반복 텍스트 처리 | **Gemini** |
| 코드 구현/수정 | **Claude** |
| 아키텍처 설계 | **Claude** |
| 복잡한 디버깅 | **Claude** |

---

## 트러블슈팅

### settings.json에 직접 mcpServers를 추가했더니 오류남

```
Settings validation failed: Unrecognized field: mcpServers
```

Claude Code의 `settings.json` 스키마는 `mcpServers` 필드를 허용하지 않는다. **반드시 `claude mcp add` 명령어를 사용**해야 하며, 실제 설정은 `~/.claude.json`에 저장된다.

### 429 Too Many Requests

```
RESOURCE_EXHAUSTED: Free Tier 요청 한도 초과
```

Gemini API 무료 티어는 일일/분당 요청 한도가 있다. 해결 방법:

1. **내일 재시도** — 무료 티어는 매일 리셋
2. **새 API 키 발급** — Google AI Studio에서 새 프로젝트로 발급
3. **유료 전환** — Google AI Studio에서 결제 연동

API 키를 바꿀 때는 기존 서버를 제거하고 재등록:

```bash
claude mcp remove gemini
claude mcp add gemini -s user -e GEMINI_API_KEY=새_API_키 -- node ~/.claude/mcp-servers/gemini/index.js
```

### Connected인데 툴 호출이 안 됨

Claude Code 세션을 **완전히 재시작**해야 새로 등록된 MCP 서버가 인식된다.

---

## 전체 흐름 정리

```
[1] 디렉토리 생성
    mkdir -p ~/.claude/mcp-servers/gemini
            ↓
[2] package.json + index.js 작성
            ↓
[3] npm install
            ↓
[4] claude mcp add 명령어로 등록
    (settings.json 직접 수정 금지!)
            ↓
[5] claude mcp list로 Connected 확인
            ↓
[6] Claude Code 재시작 후 사용
    "이건 Gemini한테 맡겨줘"
```

한 번 설정해두면 어느 프로젝트에서든 Gemini를 바로 불러쓸 수 있다. Claude의 섬세한 코드 작업과 Gemini의 넉넉한 컨텍스트를 상황에 맞게 나눠 쓰면 토큰 걱정이 한결 줄어든다.
