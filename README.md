# backtodev

**[backtodev.com](https://backtodev.com)** — 개발을 다시 시작한 개발자의 기록

---

## 이 블로그에 대해

한동안 개발에서 멀어졌다가 다시 돌아왔다. 돌아오면서 새로운 툴, 새로운 방식들을 하나씩 부딪혀보면서 배우고 있다. 그 과정에서 겪은 것들 — 삽질, 해결, 새로 알게 된 것들 — 을 기록하는 공간이다.

거창한 튜토리얼보다는 "이거 해보다가 이렇게 됐다"는 실제 경험 위주로 쓴다. 한국어와 영어 두 언어로 운영한다.

---

## 나에 대해

모바일 앱 개발자 출신. Android, React Native를 주로 다뤘고, 지금은 AI 툴을 활용한 개발 방식을 실험하면서 풀스택 방향으로 넓혀가고 있다. 현재 호주/NZ IT 취업을 준비 중이다.

---

## 왜 이렇게 블로그를 관리하나

이 블로그는 Claude Code와 함께 운영된다.

- 포스트 작성, 번역, 등록, 배포까지 Claude Code와 대화하면서 진행
- 반복 작업은 커스텀 스킬로 자동화 (`/post-register`, `/blog-write` 등)
- 예약 발행은 GitHub Actions가 매일 자정 scheduled 폴더를 확인해서 처리

단순히 편해서가 아니다. AI 툴을 실제로 써보면서 어디까지 되는지, 어떻게 써야 잘 쓰는지를 직접 경험하는 것 자체가 이 블로그의 주제이기도 하다.

```
포스트 작성 (Claude Code)
    → content/scheduled/ 에 저장
    → GitHub Actions가 지정 날짜에 content/posts/ 로 이동
    → Vercel 자동 배포
```

---

## 기술 스택

| 역할 | 기술 |
|---|---|
| 프레임워크 | Next.js (App Router + TypeScript) |
| 스타일 | Tailwind CSS |
| 배포 | Vercel |
| 예약 발행 | GitHub Actions |
| 콘텐츠 | MDX (`content/posts/`) |
| 번역 | DeepL API |
| AI 어시스턴트 | Claude Code |

---

## 관련 문서

- [개발 & 배포 가이드](docs/DEPLOYMENT.md)
