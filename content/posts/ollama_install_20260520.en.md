---
title: 'Installing Ollama and getting started with local AI'
date: '2026-05-20'
description: 'A guide to installing Ollama and selecting a model for local AI'
tags:
  - Ollama
  - AI
  - local AI
  - macOS
---

Recently, I keep seeing issues with Claude token usage and cost.

Suddenly, I realized that I might have to use AI offline when I'm not online.

It's like when people used to buy mp3s, even though they could listen to them streaming.

So I thought about installing DeepSea at first, and then I looked into it to see which model would work for me.

My computer is a MacBook (16GB), so it's not a high-end model, but I wanted something that fits my computer, that I can use for coding, and that I can have a good conversation in Korean.

---]

## Which model is right for my MacBook?

### 1. Qwen2.5-Coder (큐멘2.5 코oder)

This is Alibaba's biggest hit in China, which currently dominates the local coding model market. Although it is based on English and Chinese, the Qwen2.5 series contains a lot of multilingual training data by default, so it can understand Korean questions very accurately and perfectly organize Korean annotated code.

- **Recommended size:** `qwen2.5-coder:7b` (about 4.7GB)
- Features:** Ability to write, debug, and refactor code that commercial models (like GPT-4o) can't match. It will run a bit hot on a 16GB MacBook, but as a coding assistant, it's the most reliable.

```bash
ollama run qwen2.5-coder:7b
```bash ollama run qwen2.5-coder:7b

### 2. EXAONE 3.5 (엑사원 3.5)

It is a Korean-specific AI developed by LG AI Research Institute in Korea and released as open source. As it was created by a large Korean company, it is the best in Korea at understanding Korean context and Korean coding questions.

- **Recommended size:** `exaone3.5:7.8b` (about 4.8GB)
- Features:** The quality of Korean conversations is amazing. Although it is not a coding-specific model, it is very satisfying to have development-related concepts explained in Korean and to write basic to intermediate programming code.

```bash
ollama run exaone3.5:7.8b
```bash ollama run exaone3.5:7.8b

---]

## Installing

1. Install from the Ollama official site** **1.

When you access [ollama.com](https://ollama.com/), the installation command is provided immediately.

![Ollama 공식 사이트](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_02_54_1779242135971.png)

Copy the command from the site and paste it into your terminal.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

![Ollama 설치 진행 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_03_13_1779242355332.png)

---]

**2. Check the usage**

![Ollama 사용법](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_50_46_1779242388553.png)

---]

**3. Install the model

- **qwen2.5-coder:7b**

![qwen2.5-coder 설치](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_09_28_1779242418949.png)

```bash
ollama run qwen2.5-coder:7b
```

- **deepseek-r1:1.5b**

My computer specs recommended the 1.5B model, so I installed that as well. It's lightweight at 1.1 GB.

![deepseek-r1 설치](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_11_09_02_1779242963347.png)

```bash
ollama run deepseek-r1:1.5b
```

---]

## Run screen

![Ollama 실행 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_47_57_1779243171657.png)

> It's definitely slower than Claude or Codex. Still, I'll give it a try.
