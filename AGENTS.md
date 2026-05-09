<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# 블로그 포스트 폴더 구조 & 워크플로우

## 폴더 역할

| 경로 | 역할 |
|------|------|
| `/Users/hy/Documents/workspace/claude_code/blog_doc_temp/` | 초안 작업 공간. 블로그 포스트 초안을 여기서 작성 |
| `/Users/hy/Documents/workspace/claude_code/blog_doc_temp/완료/` | 배포 완료된 초안 보관. 파일명에 `ff_` 접두사 붙임 |
| `/Users/hy/Documents/workspace/claude_code/backtodev/content/scheduled/` | 예약 배포 폴더. `publish_date` 기준으로 자동 배포됨 |
| `/Users/hy/Documents/workspace/claude_code/backtodev/content/posts/` | 실제 배포된 포스트. scheduled에서 날짜 되면 여기로 이동 |

## 배포 흐름

```
blog_doc_temp/          ← 초안 작성
      ↓  (작업 완료)
content/scheduled/      ← publish_date 세팅 후 복사
      ↓  (publish_date 도달 시 자동 배포)
content/posts/          ← 라이브 포스트
      +
blog_doc_temp/완료/     ← 원본 초안에 ff_ 접두사 붙여 보관
```

## 파일명 규칙

- 초안: `주제_YYYYMMDD.ko.md` (예: `jobradar_06_auth_ux_20260427.ko.md`)
- 완료 처리: `ff_jobradar_06_auth_ux_20260427.ko.md` (ff_ 접두사 추가)
- scheduled/posts 파일명: 프로젝트 규칙에 따름 (예: `jobradar_06_auth_ux_20260427.ko.md`)

## Frontmatter 필드

- `date`: 작성일 (YYYY-MM-DD)
- `publish_date`: 배포 예정일. scheduled 폴더에서 이 날짜 기준으로 posts로 이동됨

## Frontmatter 작성 규칙 (YAML 파싱 오류 방지)

**⚠️ title/description에 apostrophe(')가 포함된 경우 반드시 큰따옴표 사용**

```yaml
# 틀림 — 작은따옴표 안에 '가 있으면 YAML 파싱 오류 → Vercel 빌드 실패
title: 'Why GitHub Actions Commits Don't Show'

# 맞음 — 큰따옴표로 감싸기
title: "Why GitHub Actions Commits Don't Show"
```

`it's`, `don't`, `I've`, `you're`, `won't` 등 영어 축약어가 title에 있으면 무조건 `"..."` 사용.
<!-- END:nextjs-agent-rules -->
