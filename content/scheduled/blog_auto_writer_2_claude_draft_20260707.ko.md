---
title: '블로그 발행을 자동화해보자 (2) Claude API로 내 스타일 그대로 초안 자동 생성하기'
date: '2026-07-07'
publish_date: '2026-08-13'
description: 스타일 가이드 문서 하나로 Claude API가 매번 내 말투대로 블로그 초안을 쓰게 만든 방법과 API 키 없이도 돌아가게 만든 우회 경로
tags:
  - Claude API
  - 프롬프트 엔지니어링
  - Node.js
  - TypeScript
  - 자동화
---

지난 편에서 blog-auto-writer의 전체 구조를 소개했습니다. 이번 편은 파이프라인의 첫 실제 작업 단계, **AI로 초안을 생성하는 부분**입니다. 그냥 "블로그 글 써줘"라고 프롬프트를 던지는 게 아니라, 매번 제 스타일대로 일관되게 나오도록 만드는 게 핵심이었습니다.

## 문제: 매번 다른 톤으로 써주면 곤란하다

AI에게 글쓰기를 맡길 때 가장 흔한 불만이 "쓸 때마다 톤이 다르다"는 겁니다. 어떤 날은 너무 격식체로, 어떤 날은 이모지를 잔뜩 넣어서, 또 어떤 날은 "여러분 안녕하세요!"로 시작하는 식이죠. 이걸 매번 프롬프트에 길게 설명하는 건 비효율적이고, 무엇보다 빠뜨리기 쉽습니다.

그래서 스타일 가이드를 **별도 마크다운 파일**로 분리했습니다.

```markdown
# config/style.md

## 톤 & 페르소나
- 개발을 다시 시작한 개발자의 시선으로 작성한다.
- 새로운 기술을 처음 접하는 독자도 이해할 수 있게 쉽게 풀어쓴다.
- 과장된 마케팅 문구, 클리셰는 피한다.

## 구조
1. 도입: 왜 이 주제를 다루는지 (2~4문장)
2. 본문: 소제목으로 단계적 설명
3. 마무리: 핵심 요약 + 다음에 다룰 내용
```

이 파일 하나를 시스템 프롬프트에 통째로 집어넣으면, 어떤 주제를 넣든 같은 문체로 나옵니다. 스타일을 바꾸고 싶으면 코드를 고칠 필요 없이 이 파일만 수정하면 됩니다.

## 초안 생성 로직

핵심 함수는 이런 모양입니다.

```typescript
const stream = client.messages.stream({
  model: 'claude-opus-4-8',
  max_tokens: 32000,
  thinking: { type: 'adaptive' },
  system: [
    {
      type: 'text',
      text: `${systemPrompt}\n\n${styleGuide}\n\n## 출력 형식 (반드시 준수)\n...`,
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [{ role: 'user', content: userPrompt }],
});
```

여기서 눈여겨볼 부분이 두 가지입니다.

### 1. 출력 형식을 프롬프트로 강제한다

Claude에게 "frontmatter가 포함된 마크다운 하나만 출력하라"고 명시적으로 지시합니다.

```
---
title: "글 제목"
tags: [태그1, 태그2, 태그3]
---

(본문 마크다운)
```

이렇게 하면 응답을 파싱할 때 `gray-matter` 라이브러리로 frontmatter와 본문을 바로 분리할 수 있습니다. 제목과 태그를 별도로 다시 물어볼 필요가 없어지죠.

```typescript
const parsed = matter(cleaned);
const title = (parsed.data.title as string) ?? entry.topic;
const tags = (parsed.data.tags as string[]) ?? entry.keywords ?? [];
```

### 2. 프롬프트 캐싱으로 비용을 줄인다

스타일 가이드는 요청마다 거의 똑같은 내용이 반복해서 들어갑니다. 이런 "고정된 큰 텍스트"는 `cache_control: { type: 'ephemeral' }`로 캐싱 대상으로 지정해두면, 두 번째 요청부터는 훨씬 저렴한 비용으로 처리됩니다. 매일 여러 개의 초안을 생성하는 자동화 도구 특성상, 이 설정 하나로 누적 비용 차이가 꽤 커집니다.

## 플랫폼별로 다른 지시사항 주기

티스토리와 네이버는 에디터 성격이 다릅니다. 티스토리는 마크다운을 그대로 지원하지만, 네이버 스마트에디터는 마크다운을 지원하지 않습니다. 그래서 사용자 프롬프트에 플랫폼별 안내를 다르게 넣었습니다.

```typescript
const platformNote =
  platform === 'naver'
    ? '네이버 블로그용입니다. 코드 블록은 최소화하고, 설명 위주로 풀어 써 주세요.'
    : '티스토리용입니다. 마크다운 문법(코드 블록, 표 등)을 자유롭게 사용해도 됩니다.';
```

이렇게 하면 나중에 네이버 발행 단계에서 마크다운을 플레인 텍스트로 변환할 때 손실이 덜합니다. 애초에 네이버용 초안은 코드 블록이 적게 나오도록 유도하는 거죠.

## API 키가 없어도 되게 만들기

여기서 재밌는 결정을 하나 했습니다. 원래는 `ANTHROPIC_API_KEY` 환경변수로 Anthropic API를 직접 호출하게 만들었는데, 막상 로컬 환경에는 API 키가 설정돼 있지 않았습니다. 대신 **Claude Code CLI가 이미 로그인되어 있는 상태**였죠.

그래서 초안 생성 함수에 우회 경로를 하나 추가했습니다.

```typescript
const raw = process.env.ANTHROPIC_API_KEY
  ? await generateViaApi(systemPrompt, userPrompt)
  : await generateViaClaudeCli(systemPrompt, userPrompt);
```

`generateViaClaudeCli`는 내부적으로 `claude -p "..." --append-system-prompt "..."`를 서브프로세스로 실행해서 결과를 받아옵니다.

```typescript
const { stdout } = await execFileAsync(
  'claude',
  ['-p', userPrompt, '--append-system-prompt', systemPrompt],
  { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 },
);
```

이렇게 하니 별도로 API 키를 발급받아 관리할 필요 없이, 이미 로그인해둔 Claude Code 세션을 그대로 재사용할 수 있었습니다. API 키가 있으면 API를 직접 호출하고(스트리밍, 캐싱 등 세밀한 제어 가능), 없으면 CLI로 자동 전환하는 식으로 두 경로를 모두 열어둔 겁니다.

## 실제로 돌려본 결과

실제로 이 파이프라인을 돌려서 "Playwright로 블로그 글 자동 발행하기"라는 주제로 초안을 생성해봤습니다. Claude CLI 경로로 실행했는데, frontmatter · 제목 · 태그 · 본문이 모두 정상적으로 채워진 6.7KB 분량의 글이 나왔습니다. 별도 수정 없이 바로 발행 파이프라인으로 넘길 수 있는 수준이었습니다.

## 초안 파일 저장 규칙

생성된 초안은 `날짜_플랫폼_슬러그.md` 형식으로 `drafts/` 폴더에 저장됩니다.

```typescript
function draftFilePath(date: string, platform: Platform, topic: string): string {
  const slug = topic
    .replace(/[^\w가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return path.join(DRAFTS_DIR, `${date}_${platform}_${slug}.md`);
}
```

이미 같은 이름의 초안 파일이 있으면 재생성하지 않고 기존 파일을 그대로 씁니다. 즉 한 번 만든 초안을 손으로 고쳐놨다면, 스케줄러가 다시 돌아도 그 수정 내용이 덮어써지지 않는다는 뜻입니다. 이 성질 덕분에 "미리 초안만 만들어두고 검토·수정한 뒤 예약 발행되게 하는" 사용 패턴이 자연스럽게 성립합니다.

## 다음 편

초안까지는 순조로웠습니다. 진짜 문제는 다음 단계, **실제로 브라우저를 조작해서 발행하는 부분**에서 터졌습니다. 로그인 세션이 세 번이나 저장되지 않는 삽질을 했는데, 다음 편에서 그 과정을 그대로 풀어보겠습니다.
