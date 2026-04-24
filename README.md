# backtodev

**[backtodev.com](https://backtodev.com)** — A developer's log of coming back to code.

[한국어](#한국어)

---

## About This Blog

I stepped away from development for a while, then came back. This blog documents what I've been learning since — new tools, new approaches, and the real experience of figuring things out hands-on.

Less tutorial, more "here's what happened when I tried this." Written in both English and Korean.

---

## About Me

I started as a full-stack developer, working across Angular, Java, Node.js, and various other languages and frameworks — covering web, mobile (Android / React Native), and backend. Over time, I moved into product planning and PM roles, which gave me a view of how technology connects to business outcomes.

Now I'm focused on integrating AI tools directly into the development workflow and exploring business models built around them. I'm drawn to the intersection of fast execution and strategic thinking — turning ideas into working products quickly.

Currently open to opportunities across Europe, Australia, North America, and beyond.

---

## Why Manage a Blog This Way

This blog runs with Claude Code.

- Writing, translating, registering, and deploying posts all happen through conversation with Claude Code
- Repetitive tasks are automated with custom skills (`/post-register`, `/blog-write`, etc.)
- Scheduled publishing is handled by GitHub Actions, which checks the `scheduled/` folder every night at midnight KST

It's not just about convenience. Actually using AI tools in a real workflow — and writing about what works and what doesn't — is the point of this blog.

```
Write post (Claude Code)
    → Save to content/scheduled/
    → GitHub Actions moves it to content/posts/ on the target date
    → Vercel auto-deploys
```

---

## Tech Stack

| Role | Technology |
|---|---|
| Framework | Next.js (App Router + TypeScript) |
| Styling | Tailwind CSS |
| Deployment | Vercel |
| Scheduled publishing | GitHub Actions |
| Content | MDX (`content/posts/`) |
| Translation | DeepL API |
| AI assistant | Claude Code |

---

## Docs

- [Development & Deployment Guide](docs/DEPLOYMENT.md)

---

## 한국어

**[backtodev.com](https://backtodev.com)** — 개발을 다시 시작한 개발자의 기록

### 이 블로그에 대해

한동안 개발에서 멀어졌다가 다시 돌아왔다. 새로운 툴, 새로운 방식들을 하나씩 부딪혀보면서 배우고 있다. 그 과정에서 겪은 것들 — 삽질, 해결, 새로 알게 된 것들 — 을 기록하는 공간이다.

거창한 튜토리얼보다는 "이거 해보다가 이렇게 됐다"는 실제 경험 위주로 쓴다. 한국어와 영어 두 언어로 운영한다.

### 나에 대해

Full-stack developer로 커리어를 시작해 Angular, Java, Node.js를 비롯한 다양한 언어와 프레임워크를 다뤘다. 웹, 앱(Android/React Native), 백엔드를 아우르는 개발 경험을 바탕으로 이후 기획과 PM으로 영역을 넓혔다. 기술과 비즈니스 양쪽을 모두 이해하는 포지션에서 일해온 셈이다.

지금은 AI 툴을 개발 워크플로우에 직접 통합하면서, 이를 기반으로 한 새로운 비즈니스 모델을 실험하고 있다. 개발자로서의 실행력과 PM으로서의 시각을 결합해 아이디어를 빠르게 제품으로 만드는 것에 관심이 많다.

현재 유럽, 호주, 북미 등 글로벌 시장에서의 기회를 열어두고 있다.

### 왜 이렇게 블로그를 관리하나

이 블로그는 Claude Code와 함께 운영된다.

- 포스트 작성, 번역, 등록, 배포까지 Claude Code와 대화하면서 진행
- 반복 작업은 커스텀 스킬로 자동화 (`/post-register`, `/blog-write` 등)
- 예약 발행은 GitHub Actions가 매일 자정 scheduled 폴더를 확인해서 처리

단순히 편해서가 아니다. AI 툴을 실제로 써보면서 어디까지 되는지, 어떻게 써야 잘 쓰는지를 직접 경험하는 것 자체가 이 블로그의 주제이기도 하다.
