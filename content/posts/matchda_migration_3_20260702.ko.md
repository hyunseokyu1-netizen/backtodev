---
title: '디자인 데모를 실제 앱으로 (3) — 앱 셸 통일과 색 톤 일괄 매핑'
date: '2026-07-02'
publish_date: '2026-07-27'
description: 남은 페이지들을 공통 앱 셸로 감싸 크롬을 통일하고, zinc 색을 브랜드 톤으로 perl 한 방에 일괄 치환하며 만난 함정까지 정리한 기록
tags:
  - Next.js
  - Tailwind CSS
  - perl
  - 리팩터링
---

[2편](#)에서 로그인 홈을 MatchDa 대시보드로 갈아끼웠습니다. 그런데 사이드바에서 `잡 탐색`(`/discover`)이나 `프로필`(`/profile`)을 누르면 — **갑자기 옛날 zinc 헤더에 옛날 톤**이 튀어나옵니다. 대시보드는 초록 사이드바인데 옆 페이지는 회색 상단바라니, 같은 앱 같지가 않죠.

마지막 편은 이 **크롬과 톤의 통일**입니다.

## Step 1. 공통 앱 셸(AppShell)로 감싸기

`/discover`·`/profile`도 대시보드처럼 **왼쪽 사이드바**를 갖게 하려면, 재사용 가능한 셸이 필요합니다. `AppShell`을 만들었습니다.

```tsx
// 사이드바 + 콘텐츠 영역만 통일 (내부 콘텐츠는 각 페이지 그대로)
export default function AppShell({ activeKey, userName, userEmail, children }) {
  const t = getMatchdaDict('ko')
  return (
    <div className="flex min-h-screen bg-[#F7F8FA] font-[family-name:var(--font-plex-kr)]">
      <Sidebar t={t} userName={userName} userEmail={userEmail} activeKey={activeKey} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 lg:px-9">{children}</div>
      </main>
    </div>
  )
}
```

각 페이지는 콘텐츠를 이걸로 감싸기만 하면 됩니다.

```tsx
// app/discover/page.tsx
return (
  <AppShell activeKey="discover" userName={profile.name} userEmail={email}>
    {/* 기존 콘텐츠 그대로 */}
  </AppShell>
)
```

### 사이드바에 activeKey

여러 페이지가 같은 사이드바를 쓰니, **현재 페이지를 강조**할 방법이 필요합니다. 하드코딩됐던 활성 표시를 `activeKey` prop으로 뺐습니다.

```tsx
className={key === activeKey
  ? 'bg-[#ECFDF3] font-semibold text-[#046C4E]'   // 활성
  : 'font-medium text-[#475467] hover:bg-[#F4F6F8]'}
```

### 옛 크롬은 이 경로들에서 숨기기

2편의 `AppChrome`에 경로만 추가하면 됩니다. 이제 옛 전역 헤더는 `/login` 같은 인증 밖 페이지에만 남습니다.

```tsx
const usesMatchdaShell =
  pathname === '/' ||
  pathname?.startsWith('/matchda') ||
  pathname?.startsWith('/discover') ||
  pathname?.startsWith('/profile')
```

> 여기서 범위를 명확히 했습니다 — **셸(크롬)만 통일**하고, 내부 폼/리스트 콘텐츠 자체는 그대로 뒀습니다. 색 톤은 다음 단계에서.

## Step 2. zinc → 브랜드 톤, perl 한 방에

내부 콘텐츠는 온통 `zinc-*` 색이었습니다. 손으로 하나씩 고치면 5개 파일 880줄에 오타 나기 딱 좋죠. 먼저 **어떤 zinc 클래스가 쓰였는지 전부** 뽑았습니다.

```bash
grep -ohE "(hover:|focus:)?(bg|text|border|ring)-zinc-[0-9]+(/[0-9]+)?" \
  src/components/discover/*.tsx src/app/profile/*.tsx | sort | uniq -c | sort -rn
#  14 text-zinc-400
#   9 border-zinc-200
#   8 bg-zinc-900   ← 주요 버튼
#   ...
```

이 목록을 **시맨틱 매핑표**로 만들었습니다. 핵심은 두 가지 — 중립 회색은 MatchDa 중립으로, **주요 버튼(zinc-900)은 브랜드 그린으로.**

| zinc | MatchDa | 의미 |
|---|---|---|
| `bg-zinc-900` | `bg-[#046C4E]` | 주요 버튼 → 그린 |
| `hover:bg-zinc-700` | `hover:bg-[#035A40]` | 버튼 hover |
| `border-zinc-200` | `border-[#ECEEF0]` | 카드/입력 보더 |
| `text-zinc-400` | `text-[#98A2B3]` | 보조 텍스트 |
| `focus:border-zinc-400` | `focus:border-[#046C4E]` | 입력 포커스 → 그린 |

그리고 `perl`로 일괄 치환. **순서가 중요**합니다 — `border-zinc-900/70`(투명도 붙은 것)을 `border-zinc-900`보다 **먼저** 바꿔야 반쪽만 치환되는 사고를 막습니다.

```bash
perl -pi -e '
  s/\bborder-zinc-900\/70\b/border-[#046C4E]\/70/g;   # 투명도 변형 먼저
  s/\bhover:bg-zinc-700\b/hover:bg-[#035A40]/g;
  s/\bbg-zinc-900\b/bg-[#046C4E]/g;                    # 그다음 base
  s/\bborder-zinc-200\b/border-[#ECEEF0]/g;
  s/\btext-zinc-400\b/text-[#98A2B3]/g;
  # ...
' src/components/discover/*.tsx src/app/profile/ProfileForm.tsx ...
```

치환 후 **남은 zinc가 0개**인지, 깨진 토큰은 없는지 바로 확인했습니다.

```bash
grep -ohE "(bg|text|border)-zinc-[0-9]+" 파일들 | sort | uniq -c   # (출력 없음 = 성공)
```

### 상태색은 건드리지 않기

매칭 점수, 에러 메시지 같은 **의미가 있는 색**(green/red/blue/amber)은 일부러 그대로 뒀습니다. 회색을 브랜드로 바꾸는 건 "톤 통일"이지만, 상태색까지 바꾸면 **정보가 사라집니다.** 매핑표에서 이들을 명시적으로 제외했습니다.

## 트러블슈팅 — zsh가 단어를 안 쪼갠다

파일 목록을 변수에 담아 넘겼더니 이런 에러가 났습니다.

```bash
FILES="a.tsx b.tsx c.tsx"
perl -pi -e '...' $FILES
# Can't open 'a.tsx b.tsx c.tsx': No such file or directory
```

파일 셋을 **통째로 한 파일 이름**으로 인식한 겁니다. 원인은 셸 차이 — **zsh는 bash와 달리 unquoted 변수를 기본적으로 단어 분리하지 않습니다.** 해결은 간단합니다.

- `${=FILES}` 로 강제 분리, 또는
- 그냥 파일을 **직접 나열**

저는 파일을 직접 나열했습니다(가장 확실). bash 습관으로 짠 스크립트를 zsh에서 돌릴 때 종종 밟는 지뢰입니다.

## 정리

크롬·톤 통일의 요점.

1. **공통 AppShell**로 여러 페이지의 사이드바를 통일 (콘텐츠는 그대로)
2. **activeKey**로 현재 페이지 강조
3. **먼저 grep으로 실태 파악** → 시맨틱 매핑표 → **perl 일괄 치환**
4. **투명도 변형을 base보다 먼저** 치환 (순서 함정)
5. **상태색은 제외** — 톤 통일과 정보 보존은 다르다
6. zsh에선 **변수 단어 분리 안 됨** — `${=VAR}` 또는 직접 나열

## 시리즈를 마치며

"디자인만 /matchda에 넣은 거 아니야?"라는 한마디에서 출발해, 두 개로 갈라져 있던 앱을 하나로 합쳤습니다. 돌아보면 무손실 마이그레이션의 비결은 화려한 기술이 아니라 **지루한 성실함**이었어요 — 없앨 것의 기능을 표로 적고, 있는 걸 최대한 재사용하고, 회귀를 페이즈로 가두고, 색 하나까지 매핑표로 관리하는 것. 예쁜 데모를 짓는 것보다, 그 데모를 **사용자에게 실제로 닿게 만드는 일**이 더 어렵고 더 값졌습니다.
