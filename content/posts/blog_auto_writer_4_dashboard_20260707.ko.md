---
title: '블로그 발행을 자동화해보자 (4) 프레임워크 없이 로컬 웹 대시보드 만들기'
date: '2026-07-07'
publish_date: '2026-08-15'
description: Node.js 내장 http 모듈만으로 주제 등록, 초안 검토, 발행까지 처리하는 로컬 대시보드를 만들고 클라우드 배포를 하지 않은 이유
tags:
  - Node.js
  - 웹 대시보드
  - Playwright
  - Vercel
  - 사이드프로젝트
---

지난 세 편에 걸쳐 주제 등록 → AI 초안 생성 → Playwright 발행까지 CLI로 동작하는 파이프라인을 만들었습니다. 명령어 몇 개로도 충분히 쓸 수 있는 수준이었지만, 막상 써보니 "터미널에서 YAML 파일 열어서 주제 추가하고, 초안 파일 열어서 내용 확인하고" 하는 흐름이 은근히 번거로웠습니다. 그래서 마지막으로 **브라우저에서 클릭만으로 관리할 수 있는 로컬 대시보드**를 붙였습니다.

## 왜 프레임워크 없이 만들었나

React나 Express 같은 걸 쓸까 잠깐 고민했지만, 결국 Node.js 내장 `http` 모듈만으로 만들었습니다. 이유는 단순합니다.

- 기능이 CRUD 몇 개 + 정적 파일 서빙이 전부라 프레임워크가 주는 이점이 거의 없습니다.
- 의존성이 늘어나지 않아서 `npm install` 없이도 바로 돌아갑니다.
- 개인용 도구에 빌드 과정(번들러, JSX 컴파일 등)을 추가하고 싶지 않았습니다.

```typescript
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const { pathname } = url;

  if (pathname === '/api/state' && req.method === 'GET') {
    return send(res, 200, { topics: topicsView(), ... });
  }
  // ...
});
```

프론트엔드도 프레임워크 없이 순수 HTML + `<script>` 태그 안의 바닐라 JS로 만들었습니다. `fetch`로 API를 호출하고 결과를 템플릿 리터럴로 렌더링하는 정도라, React의 가상 DOM 같은 게 필요한 규모가 아니었습니다.

## API 설계 - 기존 CLI 로직을 그대로 재사용

핵심은 대시보드를 위해 로직을 새로 짜지 않았다는 점입니다. 이미 CLI 명령어(`draft`, `publish`, `list`)가 쓰던 함수들을 그대로 API 핸들러에서 호출하도록 했습니다.

```typescript
if (pathname === '/api/generate' && req.method === 'POST') {
  const b = await readBody(req);
  const entry = findEntry(String(b.date), String(b.groupPlatform), String(b.topic));
  const draft = await draftOne(entry, b.platform as Platform);
  return send(res, 200, { ok: true, title: draft.meta.title, body: draft.body });
}

if (pathname === '/api/publish' && req.method === 'POST') {
  const b = await readBody(req);
  const entry = findEntry(String(b.date), String(b.groupPlatform), String(b.topic));
  await publishOneTopic(entry, b.platform as Platform);
  return send(res, 200, { ok: true });
}
```

이렇게 CLI와 웹 UI가 같은 파이프라인 함수(`draftOne`, `publishOneTopic`)를 공유하니, 로직이 두 군데로 갈라져서 유지보수가 힘들어지는 일이 없습니다. 대시보드는 결국 "이미 있는 기능에 클릭 가능한 얼굴을 붙인 것"에 가깝습니다.

## 초안을 열어보고 그 자리에서 고치기

대시보드에서 가장 신경 쓴 기능은 **초안 미리보기 겸 편집**입니다. 초안이 아직 없으면 그 자리에서 생성하고, 있으면 바로 보여주고, 수정한 뒤 저장할 수 있게 만들었습니다.

```javascript
async function openDraft(key) {
  const t = JSON.parse(decodeURIComponent(key));
  if (t.hasDraft) {
    const d = await api(`/api/draft?date=${t.date}&platform=${t.platform}&topic=...`);
    $('dlg-body').value = d.body;
  } else {
    $('dlg-body').value = 'AI가 초안을 작성하는 중입니다… (최대 1~2분)';
    draftDlg.showModal();
    const g = await api('/api/generate', { method:'POST', ... });
    $('dlg-body').value = g.body;
  }
  draftDlg.showModal();
}
```

초안이 없을 때는 먼저 로딩 메시지를 보여준 다음 생성 API를 호출하고, 완료되면 내용을 채워 넣는 식입니다. AI 응답을 기다리는 동안 화면이 멈춘 것처럼 보이지 않도록, 대기 중이라는 걸 명시적으로 표시하는 게 사용성에서 중요했습니다.

저장은 서버 쪽의 `saveDraftBody` 함수가 처리합니다.

```typescript
export function saveDraftBody(date: string, platform: Platform, topic: string, body: string): Draft {
  const filePath = draftFilePath(date, platform, topic);
  const existing = findDraft(date, platform, topic);
  fs.writeFileSync(filePath, matter.stringify(body.trim(), existing.meta));
  return { meta: existing.meta, body: body.trim(), filePath };
}
```

frontmatter(제목, 태그)는 그대로 유지하면서 본문만 갈아끼우는 구조입니다. 대시보드에서 수정한 내용은 그대로 `drafts/` 폴더의 파일에 반영되기 때문에, 나중에 스케줄러가 자동 발행할 때도 수정된 버전이 올라갑니다.

## 상태 뷰를 만들 때 신경 쓴 부분

주제 목록을 그릴 때, `platform: both`로 등록된 주제는 화면에서 티스토리 행과 네이버 행으로 나눠 보여줘야 발행 상태를 각각 추적할 수 있습니다. 이건 서버 쪽에서 미리 펼쳐서 내려줍니다.

```typescript
function topicsView() {
  return loadTopics().flatMap((t) => {
    const platforms: Platform[] = t.platform === 'both' ? ['tistory', 'naver'] : [t.platform];
    return platforms.map((platform) => ({
      date: t.date,
      platform,
      groupPlatform: t.platform, // 원본 엔트리를 다시 찾기 위한 키
      hasDraft: !!findDraft(t.date, platform, t.topic),
      enabled: platform === 'tistory' ? accounts.tistory.enabled : accounts.naver.enabled,
    }));
  });
}
```

`groupPlatform`을 따로 남겨둔 이유가 있습니다. 화면에는 `tistory` / `naver`로 펼쳐서 보여주지만, 실제로 주제를 삭제하거나 상태를 갱신할 때는 원본 YAML 엔트리(`both`로 등록된 그 항목)를 다시 찾아야 하기 때문입니다. 펼쳐서 보여주는 것과 실제 데이터 조작 대상은 다르다는 걸 명확히 구분해둔 셈입니다.

또한 `enabled` 플래그도 함께 내려줘서, 네이버가 비활성화 상태면 발행 버튼을 자동으로 비활성화(`disabled`)하도록 처리했습니다. 꺼져 있는 플랫폼에 발행을 시도했다가 애매한 에러를 마주치는 것보다, 애초에 버튼을 눌러도 반응하지 않게 만드는 게 사용자 입장에서 훨씬 명확합니다.

## Vercel에 배포하면 안 되는 이유

대시보드를 만들고 나니 자연스럽게 "이거 Vercel에 올리면 폰에서도 쓸 수 있지 않을까?"라는 생각이 들었습니다. 결론부터 말하면 **이 구조로는 클라우드 배포가 불가능합니다.**

이유는 명확합니다. 발행 단계가 API 호출이 아니라 **로컬에 저장된 로그인 세션으로 실제 브라우저를 조작**하는 방식이기 때문입니다.

- 서버리스 환경은 요청마다 실행 환경이 초기화되므로, `profiles/tistory-state.json` 같은 로그인 쿠키를 지속적으로 보관할 수 없습니다.
- 카카오·네이버 로그인 세션을 외부 서버에 올려두는 것 자체가 보안적으로 바람직하지 않습니다.
- 헤드리스 브라우저로 실제 계정을 조작하는 자동화는 서버리스의 짧은 실행 시간 제약과도 잘 맞지 않습니다.

정 원격에서 쓰고 싶다면, "주제 관리·초안 생성"은 클라우드에 올리고 "실제 발행"만 집 컴퓨터의 워커가 처리하는 하이브리드 구조가 유일한 현실적 방법입니다. 하지만 이건 개인용 도구치고 과한 설계라 판단했고, 지금은 로컬 대시보드로 충분하다고 결론 내렸습니다. 같은 와이파이 안에서 폰으로 접속하고 싶으면 `http://<맥의 IP>:4700`으로 열면 되니까요.

## 정리 - 4편에 걸친 전체 그림

이 시리즈에서 만든 걸 한 줄로 정리하면 이렇습니다.

```
주제 등록 (YAML/대시보드)
   → Claude API/CLI로 초안 생성 (스타일 가이드 + 프롬프트 캐싱)
      → Playwright로 로그인 세션 재사용해 발행 (storageState + 정확한 셀렉터)
         → 로컬 대시보드로 전 과정을 클릭만으로 관리
```

기술적으로 어려운 건 하나도 없었습니다. Claude API 호출, Playwright 브라우저 조작, Node 내장 http 서버 모두 익숙한 도구들이었죠. 다만 **로그인 세션의 종류(세션 쿠키 vs 영구 쿠키)**, **에디터 DOM의 실제 구조** 같은, 문서에는 잘 안 나오는 디테일에서 시간을 많이 썼습니다. 브라우저 자동화를 만들 때는 "이론상 되어야 한다"를 믿지 말고 실제 DOM을 찍어보는 습관이 결국 제일 빠른 길이라는 걸 다시 한번 느꼈습니다.
