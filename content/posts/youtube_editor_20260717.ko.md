---
title: 'YouTube 링크만으로 영상 편집하기 — Next.js + FastAPI + yt-dlp + FFmpeg 개발기'
date: '2026-07-17'
description: 유튜브 링크를 붙여넣고 원하는 구간만 골라 하나의 MP4로 합치는 개인용 웹 편집기를 만들면서 배운 것들
tags:
  - FastAPI
  - Next.js
  - FFmpeg
  - yt-dlp
  - Claude Code
---

## 영상 편집 프로그램 없이 클립 모음 만들기

유튜브를 보다 보면 "이 부분이랑 저 영상의 그 부분만 이어붙이고 싶다"는 순간이 있습니다. 그런데 그걸 하려면 보통 이런 과정을 거칩니다.

1. 영상 다운로더로 원본을 통째로 받는다
2. 영상 편집 프로그램을 켠다 (무겁다)
3. 타임라인에 올리고, 자르고, 내보낸다

고작 클립 두세 개 이어붙이는 데 과정이 너무 깁니다. 그래서 만들었습니다. **YouTube URL을 붙여넣고 → 구간을 고르고 → 순서를 정하면 → 하나의 MP4로 합쳐서 다운로드**해주는 개인용 웹 도구입니다.

핵심 기능은 이렇습니다.

- YouTube 링크 여러 개 추가 (일반/단축/Shorts URL 지원)
- 플레이어에서 재생하면서 시작점·종료점 버튼으로 구간 지정
- YouTube의 **Most Replayed**(사람들이 많이 다시 본 구간) 그래프 표시
- 클립 카드를 드래그해서 순서 변경
- FFmpeg로 잘라서 하나의 MP4로 병합, 진행률 표시와 취소까지

## 기술 스택 — 왜 프런트와 백엔드를 분리했나

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 프런트엔드 | Next.js 16 + TypeScript + Tailwind | 플레이어, 타임라인 같은 인터랙티브 UI |
| 상태 관리 | zustand | Redux보다 훨씬 가볍고 localStorage 저장(persist)이 내장 |
| 드래그 정렬 | dnd-kit | React 드래그 앤 드롭의 사실상 표준 |
| 백엔드 | FastAPI (Python) | yt-dlp가 Python 생태계, async로 긴 작업 처리 |
| 다운로드 | yt-dlp | 유튜브 다운로드 도구의 표준 |
| 편집 | FFmpeg | 자르기, 재인코딩, 병합 전부 이걸로 |

처음엔 "Next.js API Route에서 다 하면 안 되나?" 싶었는데, 영상 렌더링은 **몇 분씩 걸리는 백그라운드 작업**이라 요청-응답 모델과 안 맞습니다. 작업을 시작시키고, 프런트가 진행률을 폴링하고, 중간에 취소도 되는 구조가 필요해서 백엔드를 분리했습니다.

## 전체 구조

```text
Browser (Next.js)
  │  POST /api/videos/inspect   ← 메타데이터 + heatmap 조회
  │  POST /api/render           ← 렌더링 시작, jobId 반환
  │  GET  /api/render/{jobId}   ← 1초마다 진행률 폴링
  │  GET  /api/render/{jobId}/download
  ▼
FastAPI
  ├─ yt-dlp: 원본 다운로드 (같은 영상은 한 번만)
  ├─ FFmpeg: 구간 자르기 + 포맷 정규화 (재인코딩)
  └─ FFmpeg: concat 병합 → 실패 시 재인코딩 fallback
```

## Step 1. 유튜브 메타데이터와 Most Replayed 가져오기

yt-dlp는 다운로드 없이 메타데이터만 JSON으로 뽑을 수 있습니다.

```bash
yt-dlp --dump-single-json --no-download "https://www.youtube.com/watch?v=..."
```

이 JSON 안에 재미있는 필드가 있는데, 바로 `heatmap`입니다. 유튜브에서 영상 진행 바에 마우스를 올리면 보이는 회색 물결 그래프 — "사람들이 많이 다시 본 구간" 데이터가 그대로 들어 있습니다.

```json
{
  "heatmap": [
    { "start_time": 0.0, "end_time": 10.6, "value": 0.87 }
  ]
}
```

`value`가 0~1로 정규화된 관심도라서, 이걸 SVG로 그려주면 "하이라이트가 어디인지" 한눈에 보입니다. 클립 딸 구간을 찾을 때 진짜 유용합니다.

실제 화면은 이렇게 생겼습니다. 플레이어 아래 파란 물결이 heatmap 그래프인데, 봉우리가 솟은 곳이 사람들이 많이 다시 본 구간입니다. 그래프를 클릭하면 그 지점으로 이동하고, 드래그하면 구간이 선택됩니다.

![편집기 메인 화면 — 플레이어와 Most Replayed heatmap 그래프](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/youtube_editor_main_20260717.png)

**주의할 점**: 모든 영상에 heatmap이 있는 건 아닙니다. 유튜브가 시청 통계가 충분한 영상에만 생성해 줍니다. 그래서 코드에서 중요한 원칙 하나 — **heatmap 추출 실패가 전체 조회를 실패시키면 안 됩니다.** 없으면 빈 배열을 반환하고 일반 시간 막대만 보여주도록 했습니다.

## Step 2. 구간 자르기 — 정확도가 중요하면 재인코딩

FFmpeg로 구간을 자르는 방법은 두 가지입니다.

| 방식 | 속도 | 정확도 |
| --- | --- | --- |
| `-c copy` (복사) | 매우 빠름 | 키프레임 단위라 최대 몇 초 오차 |
| 재인코딩 | 느림 | 프레임 단위로 정확 |

클립 편집기에서 "시작점 2:00.5"라고 지정했는데 1:58부터 잘리면 곤란하죠. 그래서 재인코딩을 선택했습니다. 덤으로 **자르면서 동시에 해상도·fps·코덱을 통일**할 수 있어서, 서로 다른 영상에서 온 클립들을 나중에 병합할 때 문제가 없습니다.

```bash
ffmpeg -ss 120.5 -to 210.0 -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -crf 20 -c:a aac -b:a 192k -ar 48000 -ac 2 \
  clip_001.mp4
```

`scale + pad` 필터 조합이 포인트입니다. 세로 영상이든 4:3이든 비율을 유지한 채 1080p 캔버스 가운데에 넣고 여백은 검은색으로 채웁니다.

## Step 3. 병합 — concat demuxer와 fallback

모든 클립이 같은 포맷이면 재인코딩 없이 이어붙일 수 있습니다.

```text
# concat.txt
file 'clip_001.mp4'
file 'clip_002.mp4'
```

```bash
ffmpeg -f concat -safe 0 -i concat.txt -c copy output.mp4
```

Step 2에서 포맷을 통일해뒀기 때문에 이 단계는 몇 초 만에 끝납니다. 다만 가끔 copy 병합이 실패하는 경우가 있어서, 실패하면 재인코딩으로 병합하는 fallback을 넣었습니다.

## Step 4. 백그라운드 렌더링과 진행률

FastAPI에서 렌더링 요청을 받으면 `asyncio.ensure_future`로 작업을 띄우고 `jobId`만 바로 반환합니다. 작업 객체는 상태(`downloading → cutting → merging → completed`)와 진행률을 들고 있고, 프런트는 1초마다 폴링합니다.

서로 다른 네 영상에서 만든 클립을 드래그로 정렬하고 렌더링까지 끝낸 모습입니다. 완료되면 결과 영상을 바로 재생해보고 MP4로 다운로드할 수 있습니다.

![편집 타임라인의 클립 4개와 렌더링 완료 후 결과 미리보기](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/youtube_editor_render_20260717.png)

취소 처리가 은근 까다로웠는데, `asyncio.Event`를 취소 신호로 쓰고 **실행 중인 yt-dlp/FFmpeg 프로세스를 kill한 뒤 임시 파일까지 정리**하도록 했습니다. 몇 가지 안전장치도 함께:

- subprocess 인자는 반드시 배열로 전달 (shell 문자열 조합 금지)
- 파일 경로는 서버가 만든 UUID만 사용, 사용자 입력은 경로에 안 들어감
- YouTube 도메인 URL만 허용
- 임시 파일은 24시간 뒤 자동 삭제

## 트러블슈팅

### 1. "Vercel에 올리면 되지 않아?" → 안 됩니다

프런트는 되지만 백엔드는 구조적으로 안 맞습니다. Vercel 함수는 "몇 초 안에 응답하고 사라지는" serverless인데, 이 백엔드는 FFmpeg 바이너리 실행 + 몇 분짜리 작업 + 수백 MB 임시 파일이 필요합니다. 계속 켜져 있는 서버가 필요한 워크로드입니다.

더 큰 문제는 따로 있습니다. **YouTube가 데이터센터 IP의 yt-dlp 요청을 강하게 차단**합니다. Railway든 AWS든 클라우드에 올리면 "Sign in to confirm you're not a bot" 오류를 만날 확률이 높습니다. 개인용 도구라면 그냥 로컬(집 IP)에서 돌리는 게 가장 속 편합니다.

### 2. 한글 폴더명과 zip — 유니코드 정규화 함정

다른 맥에 전달하려고 zip을 만드는데, rsync의 `--exclude '전달용/'`이 안 먹히는 문제가 있었습니다. 원인은 macOS가 파일명을 **NFD**(자모 분리)로 저장하는데 셸에서 입력한 패턴은 **NFC**(완성형)라서 문자열이 서로 달랐던 것. 한글 파일명을 스크립트로 다룰 땐 이 문제를 항상 의심해야 합니다. Python의 `unicodedata.normalize('NFC', name)`로 비교해서 해결했습니다.

### 3. 영상마다 heatmap이 있다 없다 한다

버그인 줄 알았는데 유튜브 스펙이었습니다. 인기 영상이어도 Most Replayed 데이터가 없는 경우가 있습니다. "없으면 없는 대로 동작"하도록 설계해두면 스트레스가 없습니다.

## 정리 — 핵심 흐름 한눈에

```text
URL 입력
  → yt-dlp로 메타데이터 + heatmap 조회
  → 플레이어에서 구간 선택 (heatmap 그래프 참고)
  → 클립 목록에 쌓고 드래그로 순서 정리
  → 렌더링: 다운로드(영상당 1회) → 재인코딩 자르기+정규화 → concat 병합
  → 진행률 폴링 → MP4 다운로드
```

이 프로젝트에서 얻은 교훈 세 가지:

1. **긴 작업은 처음부터 job 모델로** — 시작 API와 상태 조회 API를 분리하면 진행률, 취소, 재시도가 다 자연스럽게 풀립니다.
2. **정규화를 먼저, 병합은 copy로** — 클립 단계에서 포맷을 통일해두면 마지막 병합이 공짜에 가깝습니다.
3. **외부 데이터(heatmap)는 있으면 좋고 없어도 되는 것으로** — 부가 기능의 실패가 핵심 기능을 막지 않게.

전체 코드는 Next.js 프런트 + FastAPI 백엔드 구조이고, `setup.sh` 하나로 다른 맥에도 설치되도록 패키징까지 해뒀습니다. 다음에는 무음 구간 자동 제거나 세로 영상(9:16) 출력 같은 걸 붙여볼 생각입니다.
