---
title: 'AI 코딩 어시스턴트와 SaaS 만들기 ⑥: 로고 불일치, 공고 171건 관리, 그리고 Ctrl+A 붙여넣기 분석'
date: '2026-07-04'
publish_date: '2026-08-05'
description: 파비콘과 인앱 로고가 서로 달랐던 브랜드 불일치 정리, 수집 공고가 171건으로 불어나며 생긴 관리 문제(편집 모드·미채점 필터), 스크래핑이 실패하는 사이트를 위한 공고 전문 붙여넣기 AI 분석까지
tags:
  - Next.js
  - Claude API
  - SaaS
  - UX
  - AI 코딩 어시스턴트
---

## 시작하며

5편에서 Stripe 결제의 전체 사이클을 검증했다. 이번 편은 같은 날 이어진 나머지 작업들이다. 결제만큼 극적이진 않지만, 서비스를 실제로 쓰다 보면 반드시 마주치는 종류의 문제들이다.

- 파비콘은 최종 아이콘인데 앱 안의 로고는 옛날 것이던 **브랜드 불일치**
- 수집 공고가 **171건**으로 불어나면서 생긴 관리 문제
- URL 스크래핑이 실패하는 사이트를 위한 **공고 전문 붙여넣기 AI 분석**

셋 다 "기능을 새로 만든다"기보다 "만들어둔 것을 실제로 운영하다 보니 드러난 구멍을 메운" 작업에 가깝다.

## Step 1. 파비콘과 인앱 로고가 서로 달랐다

브라우저 탭의 파비콘은 최종 확정한 악수-M 마크인데, 정작 앱 안의 사이드바·푸터·헤더 로고는 **코드로 손수 그린 근사 SVG**(`HandshakeMark`)였다. 파비콘 작업을 먼저 끝내고, 인앱 로고는 "비슷하게 생긴 SVG 컴포넌트"로 임시로 그려둔 게 그대로 남아 있었던 것이다. 탭 아이콘과 앱 로고가 미묘하게 다르니, 알고 나면 계속 눈에 밟혔다.

해결은 단순하게 갔다 (`eb514c6`). 최종 아이콘 파일 `icon-512.png`를 `public/matchda-mark.png`로 복사하고, 로고를 그리던 세 곳을 전부 `next/image`로 교체했다.

```diff
// src/components/matchda/dashboard/Sidebar.tsx
-import { HandshakeMark, LayoutDashboard, FileText, Target, Briefcase } from '../ui/icons'
+import Image from 'next/image'
+import { LayoutDashboard, FileText, Target, Briefcase } from '../ui/icons'

-        <div className="h-[30px] w-[30px] overflow-hidden rounded-lg bg-[#046C4E]">
-          <HandshakeMark size={30} className="block text-white" />
-        </div>
+        <Image src="/matchda-mark.png" alt="MatchDa" width={30} height={30} className="rounded-lg" />
```

이제 쓰이지 않게 된 `HandshakeMark` SVG 컴포넌트는 삭제했다. 교훈은 간단하다. **브랜드 에셋의 원본은 한 곳이어야 한다.** "아이콘 파일 따로, 코드로 그린 SVG 따로"처럼 같은 마크의 사본이 두 형태로 존재하면 언젠가 반드시 어긋난다. 실제 파일 하나(`matchda-mark.png`)를 모든 곳이 참조하게 바꾸고 나니 diff가 순삭제 방향으로 나온 것(-34줄 +7줄)도 당연한 결과였다.

## Step 2. 수집 공고 171건 — 쌓이기 시작하면 관리가 기능이 된다

4편에서 만든 추천 기업 원클릭 수집을 며칠 굴리자, 잡 탐색의 수집 공고가 **171건**이 됐다. 수집은 잘 되는데 치우는 방법이 없었다. 하나씩 지우는 버튼은 있었지만 171건 앞에서는 무의미하고, 점수 없는 공고들이 목록에 섞여서 뭘 봐야 할지도 흐려졌다.

그래서 `84aa519` 커밋에서 관리 도구를 붙였다.

### 편집 모드 + 다중 선택 삭제 (소프트 삭제)

편집 버튼을 누르면 카드마다 체크박스가 나타나고, 전체 선택/해제와 선택 삭제가 가능하다. 여기서 중요한 결정 하나 — **삭제는 DB 행 삭제가 아니라 소프트 삭제**다.

```ts
// src/app/discover/actions.ts
/** 편집 모드 다중 선택 삭제 — 소프트 삭제(status='dismissed'), 행 삭제 아님 */
export async function dismissDiscoveredJobs(
  discoveredJobIds: string[]
): Promise<{ dismissed?: number; error?: string }> {
  // ... 로그인/프로필 체크

  const ids = (discoveredJobIds ?? []).filter(Boolean).slice(0, 500)
  if (ids.length === 0) return { error: '선택된 공고가 없습니다.' }

  const { data, error } = await supabaseAdmin
    .from('discovered_jobs')
    .update({ status: 'dismissed' })
    .in('id', ids)
    .eq('user_id', profile.id)
    .select('id')
  ...
}
```

2편에서 다뤘던 데이터 유실 사고 이후, 이 프로젝트에는 "DB 행 삭제는 하지 않는다"는 원칙이 생겼다. 다중 "삭제"도 실제로는 `status='dismissed'` 업데이트일 뿐이라, 잘못 지워도 상태만 되돌리면 복구된다. 사고 한 번이 설계 원칙이 되어 이후 모든 기능에 스며드는 걸 보여주는 예다. `.eq('user_id', profile.id)`로 남의 공고를 못 건드리게 하는 필터도 잊지 않았다.

### "미채점" 필터 — 점수 없는 공고는 버그가 아니라 구조다

수집 공고 중 일부는 점수가 아예 없다. 이건 의도된 구조다.

- 수집 시 키워드 프리필터에서 탈락한 공고는 채점 없이 저장된다 (내 직군과 무관해 보이는 공고까지 전부 Haiku에 태우면 비용 낭비)
- 프리필터를 통과해도 1회 수집당 채점 상한(50건)을 넘는 분량은 점수 없이 저장된다

그동안 이 공고들은 점수 필터 어디에도 걸리지 않는 유령 같은 존재였는데, 점수 필터에 '미채점' 칩을 추가해 명시적으로 모아볼 수 있게 했다.

```ts
type ScoreFilter = 'all' | '70' | '40' | 'unscored'

if (scoreFilter === 'unscored') {
  if (j.match_score !== null) return false
} else if (scoreFilter !== 'all' && (j.match_score === null || j.match_score < Number(scoreFilter))) {
  return false
}
```

### 미채점 공고 개별 채점

미채점 목록을 보다가 "어, 이건 괜찮아 보이는데?" 싶은 공고가 있으면, 카드의 '점수 매기기' 버튼으로 그 한 건만 Haiku 채점을 돌릴 수 있다(`rescoreDiscoveredJob`). 일괄 자동 채점은 상한으로 비용을 통제하되, 사용자가 관심을 표한 건에는 온디맨드로 AI를 쓰는 절충이다.

## Step 3. 스크래핑이 실패하면 — Ctrl+A 붙여넣기로 우회

MatchDa의 기본 플로우는 "공고 URL 붙여넣기 → 스크래핑 → AI 매칭"인데, 봇을 막거나 렌더링이 특이한 사이트에서는 스크래핑이 실패해서 "제목 파싱 불가" 카드가 생긴다. URL 스크래핑을 아무리 고도화해도 모든 사이트를 이길 수는 없다.

그래서 발상을 바꿨다. **어차피 사용자는 그 공고 페이지를 브라우저로 보고 있다.** 그럼 페이지에서 `Ctrl+A` → `Ctrl+C`로 전체 복사해서 붙여넣게 하고, 잡음 제거는 AI에게 시키면 된다 (`18af52d`).

```ts
// src/app/actions.ts — parseJobText (발췌)
const message = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 3000,
  messages: [{
    role: 'user',
    content: `아래는 채용공고 웹페이지에서 전체 선택(Ctrl+A) 후 복사한 원문입니다. 메뉴·광고·푸터 등 잡음이 섞여 있습니다. 채용공고 핵심 정보만 추출하세요.

## 원문
${text.slice(0, 15000)}

## 추출 규칙
- title: 직무명 (원문 언어 그대로)
- company: 회사명
- location: 근무지 (없으면 빈 문자열)
- salary: 급여 정보 (명시된 경우만, 없으면 빈 문자열)
- description: 채용공고 본문만 정제해 재구성 (주요 업무, 자격 요건, 우대 사항 등. 메뉴/광고/무관한 텍스트 제거. 원문 언어 유지, 최대 2000자)

JSON으로만 응답하세요. ...`,
  }],
})
```

`Ctrl+A` 복사본에는 내비게이션 메뉴, 광고, 추천 공고, 푸터 링크가 전부 섞여 들어온다. 정규식이나 휴리스틱으로 이걸 걷어내는 건 사이트마다 다시 짜야 하는 지옥이지만, LLM에게는 "잡음 속에서 공고 본문만 골라내라"가 오히려 잘하는 종류의 일이다. 실제로 Seek 스타일의 지저분한 페이지 덤프(메뉴 + 추천 공고 목록 + 푸터가 다 섞인 것)를 붙여넣어 테스트했는데, 제목·회사·위치·연봉에 정제된 JD까지 깔끔하게 뽑아냈다.

진입점은 두 곳에 만들었다.

| 진입점 | 동작 |
|---|---|
| 직접 추가 모달의 "붙여넣기로 자동 채우기" | 붙여넣기 → `parseJobText` 분석 → 폼 필드 자동 채움 (사용자가 확인 후 저장) |
| 파싱 실패 카드의 "JD 직접 입력" 버튼 | 붙여넣기 → `fixJobWithText`가 기존 공고를 보정하고 **자동 매칭까지 실행** |

두 번째 경로가 특히 중요하다. "제목 파싱 불가"라는 dead-end 카드가, 이제 사용자 스스로 복구할 수 있는 카드가 됐다. 보정 액션은 내 지원 목록에 있는 공고인지 먼저 확인한 뒤에만 수정을 허용하고, JD가 채워지면 그 자리에서 매칭 점수 계산까지 이어서 실행한다.

```ts
// fixJobWithText (발췌) — 보정 후 자동 매칭
const res = await parseJobText(rawText)
if (res.error || !res.parsed) return { error: res.error ?? '분석 실패' }

await supabaseAdmin.from('jobs').update({
  title: p.title, company: p.company || null, location: p.location || null,
  salary: p.salary || null, description: p.description || null,
}).eq('id', jobId)

if (p.description) {
  const matchRes = await matchSingleJob(jobId)  // 보정 즉시 AI 매칭
  ...
}
```

### 챗봇 지식 베이스에도 반영 — 셀프서비스 루프 닫기

마지막으로, 4편에서 만든 고객센터 챗봇의 지식 베이스에 이 사용법을 추가했다.

```
- 공고 추가 방법 3가지:
  1) 채용공고 URL 붙여넣기 (Seek·Indeed·LinkedIn·Glassdoor 등) → "추가"
  2) "직접 추가" 버튼 → 공고 페이지에서 Ctrl+A(전체 선택) → Ctrl+C(복사) 후
     "붙여넣기로 자동 채우기" 칸에 붙여넣고 "AI로 분석해서 채우기"
  3) 항목별 수동 입력
- URL로 추가했는데 "제목 파싱 불가"로 나오면: 카드의 "JD 직접 입력" 버튼 →
  공고 페이지 전체를 복사해 붙여넣으면 AI가 다시 분석해 채우고 매칭까지 실행합니다.
```

기능을 만들고 끝이 아니라, 사용자가 "공고 추가가 안 돼요"라고 챗봇에 물었을 때 이 우회 경로를 안내받을 수 있어야 셀프서비스 지원 루프가 닫힌다. 기능 추가 커밋에 지식 베이스 갱신이 같이 들어간 이유다.

## 자주 쓴 패턴 요약

| 상황 | 패턴 |
|---|---|
| 브랜드 에셋 | 원본 파일 하나를 모든 곳이 참조 — 코드로 그린 사본을 남기지 않는다 |
| 대량 데이터 삭제 UI | 소프트 삭제(`status='dismissed'`) + user_id 필터, 행 삭제 금지 |
| AI 채점 비용 통제 | 프리필터 + 채점 상한으로 자동 채점을 제한하고, 관심 건은 온디맨드 개별 채점 |
| 스크래핑 실패 대응 | Ctrl+A 전체 복사 → LLM이 잡음 제거·구조화 (사이트별 파서 불필요) |
| 새 기능 출시 | 챗봇 지식 베이스도 같은 커밋에서 갱신 — 셀프서비스 루프 유지 |

## 정리

1. **임시로 그린 것은 반드시 청산 목록에 올려둬야 한다.** 파비콘 작업 때 "일단 비슷하게" 그려둔 SVG가 최종 로고인 척 몇 주를 버텼다. 임시 산출물은 만들 때부터 "언제 진짜로 교체할지"를 정해두지 않으면 그대로 굳는다.
2. **수집 기능을 만들면 관리 기능이 따라와야 한다.** 171건이 쌓이고 나서야 편집 모드·필터·개별 채점이 필요하다는 게 보였다. 데이터가 늘어나는 기능은 "늘어난 후의 화면"을 상상하며 만들어야 한다.
3. **완벽한 파서보다 좋은 우회로가 낫다.** 모든 사이트의 스크래핑을 뚫으려는 싸움 대신, 사용자가 이미 보고 있는 페이지를 복사·붙여넣기하게 하고 정제를 AI에 맡기는 쪽이 훨씬 견고했다. 실패 케이스를 없애는 게 아니라, 실패했을 때의 다음 행동을 설계하는 것이 제품이다.
4. **사고는 원칙이 되고, 원칙은 코드에 스며든다.** 2편의 데이터 유실 사고가 "소프트 삭제만 한다"는 원칙이 됐고, 이번 다중 삭제 기능은 그 원칙 위에서 처음부터 안전하게 만들어졌다.

이번 시리즈 여섯 편으로 URL 재설계부터 데이터 사고, RAG, 챗봇, 유료화, 그리고 운영하며 드러난 구멍 메우기까지 — AI 코딩 어시스턴트와 함께 SaaS 하나가 "코드 덩어리"에서 "돈이 돌고 스스로를 설명하는 제품"이 되는 과정을 기록했다. 다음은 실제 사용자 피드백과 그에 따른 개선을 다룰 차례다.
