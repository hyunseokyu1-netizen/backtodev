---
title: 'DOCX 서식 유지하면서 AI로 맞춤 이력서 만들기 — JSZip + Claude API'
date: '2026-06-11'
publish_date: '2026-06-25'
description: JSZip으로 DOCX 내부 XML을 직접 조작해 원본 레이아웃은 그대로 두고 문단 텍스트만 Claude AI가 JD에 맞춰 교체하는 방법
tags:
  - JSZip
  - Claude API
  - DOCX
  - Next.js
  - TypeScript
---

## 이력서에 AI를 붙이면 생기는 문제

AI 커버레터 생성은 많이 봤는데, 이력서는 왜 없을까 싶었다. 직접 만들어보니 금방 이유를 알았다.

커버레터는 매번 새로 쓰는 텍스트라 AI가 생성한 내용을 그냥 붙여넣으면 된다. 반면 이력서는 **정성껏 만들어둔 나만의 DOCX 양식**이 있다. 폰트, 색상, 여백, 섹션 레이아웃... 이걸 버리고 AI가 처음부터 새로 만들면 당연히 쓸 수 없다.

그렇다고 AI한테 "이 서식 그대로 유지해줘"라고 프롬프트를 아무리 잘 써봤자, DOCX를 텍스트로 추출해서 다시 DOCX로 만드는 순간 원본 양식은 날아간다.

**원하는 것은 하나였다**: 원본 DOCX 파일의 레이아웃은 손대지 않고, 문단 텍스트만 JD에 맞게 바꾸기.

오늘은 이걸 구현한 방법을 공유한다.

---

## 핵심 아이디어: DOCX는 ZIP이다

DOCX 파일을 `.zip`으로 바꿔서 열어보면 폴더 구조가 나온다.

```
word/
├── document.xml   ← 본문 전체가 여기에
├── styles.xml     ← 폰트·색상·스타일 정의
├── theme/
└── ...
```

서식 정보는 `styles.xml`과 각 run(`<w:r>`)의 프로퍼티에 들어있고, **실제 텍스트 내용만 `<w:t>` 태그 안에** 있다.

즉 `document.xml`에서 `<w:t>` 안의 텍스트만 바꾸면 — 서식은 건드리지 않고 내용만 교체할 수 있다.

이걸 Node.js에서 다루는 라이브러리가 바로 **JSZip**이다.

---

## 사전 준비

```bash
npm install jszip
```

TypeScript를 쓴다면 타입 선언도 함께 설치된다. 별도 `@types/jszip`는 필요 없다.

---

## Step 1: DOCX 파일 열고 문단 추출하기

`loadDocx` 함수가 하는 일은 두 가지다.

1. DOCX(ZIP)를 열어서 `word/document.xml`을 문자열로 읽는다
2. `<w:p>` (문단) 단위로 순회하며 `<w:t>` 텍스트를 이어 붙여 인덱스와 함께 반환한다

```typescript
// src/lib/docx-rewrite.ts

import JSZip from 'jszip'

const PARA_RE = /<w:p\b[^>/]*>[\s\S]*?<\/w:p>/g
const WT_RE   = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g

export interface DocxDocument {
  zip: JSZip
  xml: string
  paragraphs: { index: number; text: string }[]
}

export async function loadDocx(buffer: Buffer): Promise<DocxDocument> {
  const zip  = await JSZip.loadAsync(buffer)
  const file = zip.file('word/document.xml')
  if (!file) throw new Error('유효한 DOCX 파일이 아닙니다.')
  const xml = await file.async('string')

  const paragraphs: { index: number; text: string }[] = []
  let i = 0
  for (const m of xml.matchAll(PARA_RE)) {
    const text = [...m[0].matchAll(WT_RE)]
      .map(t => decodeXml(t[2]))
      .join('')
    paragraphs.push({ index: i, text })
    i++
  }
  return { zip, xml, paragraphs }
}
```

한 문단(`<w:p>`) 안에 `<w:t>` 가 여러 개 있을 수 있다. Word가 자동완성이나 맞춤법 교정 때문에 run을 쪼개기 때문인데, 사람 눈에는 한 덩어리처럼 보이는 문장이 XML에서는 여러 `<w:t>`로 나뉘어 있는 경우가 흔하다. 그래서 `.join('')`으로 이어 붙여야 실제 텍스트가 보인다.

---

## Step 2: Claude에게 수정할 문단만 뽑아달라고 요청하기

추출한 문단에 인덱스 번호를 붙여서 Claude에게 넘긴다.

```typescript
const numbered = doc.paragraphs
  .filter(p => p.text.trim())           // 빈 문단 제외
  .map(p => `[${p.index}] ${p.text}`)
  .join('\n')
```

출력 예시는 이런 모양이다.

```
[2] Senior Software Engineer
[3] Passionate software engineer with 5+ years of experience in...
[5] Led migration of monolithic system to microservices architecture...
```

이걸 JD와 함께 Claude에 보내면서 **JSON만 반환**하도록 지시한다.

```typescript
const message = await anthropic.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 8000,
  thinking: { type: 'adaptive' },
  messages: [{
    role: 'user',
    content: `...
## 규칙
- 수정할 문단만 {"replacements": [{"i": 문단인덱스, "text": "새 텍스트"}]} 형식의 JSON으로 출력. JSON 외 다른 텍스트 금지
- Professional Summary와 경력 bullet 위주로 JD의 키워드·요구사항에 맞춰 다시 쓸 것
- 이름, 연락처, 회사명, 직책, 근무 기간, 학력, 섹션 제목 문단은 절대 수정하지 말 것
- 원본에 있는 사실만 사용하고 경력·스킬·수치를 지어내지 말 것
- 각 문단의 새 텍스트는 원본과 비슷한 길이로 유지할 것 (레이아웃이 깨지지 않도록 ±30% 이내)`,
  }],
})
```

Claude가 돌려주는 응답 예시:

```json
{
  "replacements": [
    { "i": 3, "text": "Results-driven software engineer with 5+ years of experience in cloud-native..." },
    { "i": 5, "text": "Architected and led migration from monolithic Rails app to event-driven microservices..." }
  ]
}
```

---

## Step 3: 원본 XML에 텍스트만 갈아끼우기

이게 핵심 부분이다. `applyReplacements`가 하는 일을 풀어 설명하면:

1. 원본 XML에서 `<w:p>` (문단)를 하나씩 순회한다
2. Claude가 수정하라고 한 인덱스(`Map<number, string>`)에 해당하면 내부 `<w:t>` 를 교체한다
3. **첫 번째 `<w:t>`에만 새 텍스트 전체를 넣고**, 나머지 `<w:t>`는 빈 문자열로 비운다
4. 수정 지시가 없는 문단은 그대로 반환한다

```typescript
export async function applyReplacements(
  doc: DocxDocument,
  replacements: Map<number, string>
): Promise<Buffer> {
  let i = 0
  const newXml = doc.xml.replace(PARA_RE, para => {
    const newText = replacements.get(i)
    i++
    if (newText === undefined) return para   // 수정 대상 아님 → 원본 그대로

    let first = true
    return para.replace(WT_RE, (_m, open, _content, close) => {
      if (first) {
        first = false
        // xml:space="preserve" 가 없으면 앞뒤 공백이 날아갈 수 있음
        const openTag = open.includes('xml:space')
          ? open
          : open.replace('<w:t', '<w:t xml:space="preserve"')
        return openTag + encodeXml(newText) + close
      }
      return open + close   // 나머지 w:t는 비운다
    })
  })

  doc.zip.file('word/document.xml', newXml)
  return doc.zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Promise<Buffer>
}
```

"왜 첫 번째 `<w:t>`에만 넣냐"는 질문이 생길 수 있다. `<w:t>` 하나하나에는 폰트 크기나 굵기 같은 run 프로퍼티(`<w:rPr>`)가 달려있다. 여러 run에 텍스트를 나눠 담으면 중간에 서식이 바뀔 수 있어서, 첫 번째 run의 서식을 그대로 이어받아 전체 텍스트를 담는 방식을 택했다.

---

## Step 4: 결과를 브라우저로 내려보내기

서버 액션에서 Buffer를 Base64로 인코딩해서 클라이언트에 전달하면, 클라이언트에서 Blob으로 복원해 다운로드한다.

**서버 액션 (actions.ts)**

```typescript
const result = await applyReplacements(doc, replacements)

const safe = (s: string) => s.replace(/[^\w가-힣-]+/g, '_').slice(0, 30)
return {
  base64: result.toString('base64'),
  filename: `resume_${safe(job.company)}_${safe(job.title)}.docx`,
}
```

**클라이언트 컴포넌트**

```typescript
const res = await generateTailoredResumeDocx(jobId)
if (res.base64 && res.filename) {
  const bytes  = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0))
  const blob   = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = res.filename
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## 전체 흐름 정리

```
사용자 DOCX 업로드
      ↓
Supabase Storage에 원본 보관 (profiles.resume_file_path)
      ↓
[맞춤 이력서 생성 요청]
      ↓
Storage에서 원본 DOCX 다운로드
      ↓
loadDocx() → 문단 목록 추출 (인덱스 + 텍스트)
      ↓
Claude API → JD 기반 수정 문단 JSON 반환
      ↓
applyReplacements() → w:t 노드만 교체, 서식은 유지
      ↓
Buffer → Base64 → 클라이언트 → Blob 다운로드
```

---

## 트러블슈팅

### w:t 텍스트가 잘려서 나온다

한 문단 안에 `<w:t>` 가 여러 개로 쪼개진 경우다. `loadDocx`에서 `.join('')`을 빠뜨리면 첫 번째 run 텍스트만 반환된다. 특히 Word 자동완성·맞춤법 교정이 켜진 상태에서 만든 파일일수록 run이 잘게 쪼개져 있다.

### 다운로드한 DOCX가 열리지 않는다

XML이 잘못된 경우다. `encodeXml`을 빠뜨리고 새 텍스트에 `<`, `>`, `&` 문자가 들어갔다면 XML 파싱 오류가 발생한다. Claude 응답에서 받은 텍스트는 반드시 `encodeXml()`을 거쳐야 한다.

### xml:space="preserve" 관련 공백 날아감

`<w:t>` 앞뒤 공백은 `xml:space="preserve"` 속성이 없으면 XML 파서가 제거한다. 특히 들여쓰기나 bullet 뒤 공백이 있는 문단에서 발생한다. `applyReplacements`에서 해당 속성이 없으면 자동으로 추가하도록 처리했다.

### 표 안 셀이 깨진다

표의 각 셀도 `<w:p>`로 감싸여 있다. Claude에게 수정 대상을 지정할 때 표 안 셀도 번호가 매겨진다. 프롬프트에서 "섹션 제목과 레이아웃 요소는 수정하지 말 것" 규칙을 명확히 넣어야 표 셀을 건드리지 않는다.

---

## 마무리

이 방식의 핵심은 **DOCX를 텍스트로 변환하지 않는다**는 점이다. 기존에 많이 쓰이던 방법(mammoth 등으로 HTML/텍스트로 변환 → AI가 재작성 → 다시 DOCX 생성)은 원본 서식을 포기해야 했다.

JSZip으로 DOCX 내부 XML에 직접 접근해서 `<w:t>` 노드만 교체하면 폰트, 색상, 여백, 표 구조 등 나머지는 건드리지 않고 텍스트만 바꿀 수 있다. 구현 자체도 생각보다 간단하고, 테스트도 쉽다.

| 방식 | 서식 유지 | 구현 난이도 |
|---|---|---|
| 텍스트 추출 후 docx 재생성 | X | 낮음 |
| pandoc 변환 활용 | 부분적 | 중간 |
| JSZip으로 w:t 직접 교체 | O | 중간 |

이력서 말고도 계약서, 리포트 등 **서식이 중요한 DOCX를 AI로 일부만 채워야 하는 상황**이라면 같은 방식을 그대로 쓸 수 있다.
