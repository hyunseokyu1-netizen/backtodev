---
title: '개념만 읽다 끝나는 게 아까워서 — 나만의 학습 플랫폼에 실습 코스 5개를 더 얹은 이야기'
date: '2026-07-17'
publish_date: '2026-09-12'
description: 파이썬·알고리즘·FastAPI·SQL·LLM 심화까지, 개념 정리에서 그치던 공부를 직접 손으로 채점받는 실습으로 바꾼 과정과 그 김에 고친 UI 버그 두 가지
tags:
  - 사이드프로젝트
  - FastAPI
  - Next.js
  - 학습
  - pytest
---

## 정리는 잘 되는데, 손은 안 움직이더라

공부를 다시 시작하면서 늘 반복하던 패턴이 있었다. 개념 정리를 노트에 깔끔하게 해두고, "아 이거 알겠다" 싶어서 다음 주제로 넘어간다. 그런데 막상 코드를 짜야 하는 순간이 오면 손이 안 움직인다. 안다고 생각했던 것과 실제로 짤 수 있는 것 사이에 꽤 큰 틈이 있었던 거다.

그래서 몇 주 전부터 브라우저에서 코드를 실행하고 채점까지 받을 수 있는 개인용 학습 플랫폼을 만들어 쓰고 있었다. 왼쪽엔 지문, 오른쪽 위엔 에디터, 오른쪽 아래엔 터미널 — 딥러닝 모델을 만들어서 쿠버네티스 클러스터에 배포하는 것까지 되는 실습 환경이다. 그런데 코스가 8개쯤 쌓이고 나니 이런 생각이 들었다. **"정작 매일 손에 쥐고 있는 기본기(파이썬 문법, 알고리즘, API 서버)는 여기 하나도 없네."** 딥러닝·쿠버네티스처럼 화려한 걸 먼저 만들어놓고, 정작 기초 체력 훈련은 미뤄둔 셈이다.

그래서 오늘은 코스를 5개 더 추가했다. **파이썬 기초, 알고리즘 기초, FastAPI 기초, SQL 심화, LLM 심화** — 8개에서 13개로. 그리고 코스가 늘어나면서 새로 발견한 UI 버그 두 개도 같이 고쳤다.

## Step 1. 코스 하나의 구조 — 지문·시작코드·채점기·정답, 이 네 파일이 전부

새 코스를 추가하는 작업은 사실 반복이다. 코스 하나는 이런 폴더 구조를 갖는다.

```
app/courses/{course_id}/
├── lessons/    stage1.md, stage2.md, stage3.md  (지문)
├── starters/   stage1.py, stage2.py, stage3.py  (# TODO가 있는 시작 코드)
├── checks/     stage1.py, stage2.py, stage3.py  (채점 스크립트)
└── solutions/  stage1.py, stage2.py, stage3.py  (정답 코드)
```

핵심은 **채점기가 정답 코드를 신뢰하지 않는다**는 점이다. 예를 들어 SQL 심화 코스의 "윈도우 함수" 단계는 사용자가 `ROW_NUMBER() OVER (...)`로 장르별 최장 곡을 구해야 하는데, 채점기는 사용자 코드와 완전히 독립적으로 같은 계산을 **자기 손으로 다시** 해서 결과를 비교한다.

```python
# checks/stage1.py 中
ref_conn = sqlite3.connect(":memory:")
df = pd.read_csv("music_metadata.csv")
df.to_sql("tracks", ref_conn, index=False)

ref_top1 = dict(ref_conn.execute("""
    SELECT genre, title FROM (
        SELECT genre, title,
               ROW_NUMBER() OVER (
                   PARTITION BY genre ORDER BY duration_sec DESC, track_id ASC
               ) AS rn
        FROM tracks
    ) WHERE rn = 1
""").fetchall())

got = dict(main.longest_track_per_genre(conn))  # 사용자 코드 실행 결과
if got != ref_top1:
    fail("longest_track_per_genre 결과가 다릅니다.", ...)
```

이렇게 짜두면 "정답 코드를 그대로 베껴서 통과"하는 것과 "직접 로직을 짜서 통과"하는 것이 같은 기준으로 채점된다. 우회로가 없다.

## Step 2. 성능까지 채점하기 — 통과했는데 왜 느리지?

알고리즘 기초 코스를 만들면서 재미있던 부분이 있다. 피보나치 수열을 재귀로 구현하는 문제인데, **정확성만 확인하면 순진한 재귀(메모이제이션 없음)도 작은 입력에선 통과해버린다.** 그러면 "느린데도 맞았다"는 착각을 하게 된다.

그래서 채점기에 시간 제한을 넣었다.

```python
start = time.perf_counter()
got = main.fib(33)
elapsed = time.perf_counter() - start

if elapsed > 2.0:
    fail(
        f"fib(33) 계산에 {elapsed:.2f}초가 걸렸습니다 (제한: 2초).",
        "메모이제이션 없이 순수 재귀만 쓰면 호출 횟수가 기하급수적으로 늘어납니다.",
        "memo 딕셔너리에 이미 계산한 값을 저장하고 재사용하세요.",
    )
```

`fib(33)`은 메모이제이션 없이 순수 재귀로 풀면 함수 호출이 수백만 번 일어나 몇 초씩 걸리지만, 메모이제이션을 쓰면 0.01초도 안 걸린다. "값은 맞는데 왜 시간 초과가 나지?"라는 피드백 자체가 최고의 힌트가 된다. `two_sum`(해시맵으로 O(n)에 풀어야 하는 문제)도 똑같은 방식으로, 일부러 2만 개짜리 큰 입력을 줘서 이중 반복문(O(n²))으로 짜면 시간 초과가 나도록 만들었다.

## Step 3. LLM 심화 — 검증이 곧 개념 증명이 되는 순간

이번에 제일 마음에 든 문제는 **KV 캐시**를 다루는 단계다. LLM이 토큰을 한 개씩 생성할 때, 매번 지금까지의 전체 문장을 처음부터 다시 계산하지 않고 이미 계산해둔 과거 토큰의 Key/Value를 캐시에 저장해 재사용한다는 개념인데, 이걸 어떻게 채점할지 고민했다.

답은 간단했다. **"한 토큰씩 순차적으로 캐시를 쓰며 계산한 결과"와 "전체 문장을 한 번에 causal 어텐션으로 계산한 결과"가 수학적으로 완전히 같아야 한다**는 사실 자체를 채점 기준으로 삼았다.

```python
ref = F.scaled_dot_product_attention(Q, K, V, is_causal=True)  # 한 번에 계산

cache = main.KVCache()
outputs = []
for t in range(L):
    out_t = main.decode_step(Q[t:t+1], K[t:t+1], V[t:t+1], cache)  # 한 스텝씩
    outputs.append(out_t)

got = torch.cat(outputs, dim=0)
assert torch.allclose(got, ref, atol=1e-4)
```

이 테스트를 통과시키면, 사용자는 "KV 캐시가 왜 정확도 손실 없이 속도만 빨라지는가"를 말로 설명 듣는 게 아니라 직접 짠 코드로 증명하게 된다. 개인적으로 이런 문제를 만들 때가 제일 즐겁다 — 채점기를 짜는 과정 자체가 나한테 개념을 다시 한번 되새기게 만든다.

## 트러블슈팅 1: 코스가 늘어나니 스크롤이 안 됐다

코스를 13개로 늘리고 메인 페이지를 열었는데, 카드가 화면 아래로 넘쳐나는데도 스크롤이 안 됐다. 마우스 휠을 굴려도 페이지가 꼼짝을 안 한다.

원인은 `layout.tsx`에 있었다.

```tsx
// 수정 전
<body className="h-full overflow-hidden">{children}</body>
```

실습 화면(에디터 + 터미널이 있는 3분할 레이아웃)은 애초에 페이지 전체가 스크롤되면 안 되는 구조라서, 그 화면을 만들 때 `body`에 `overflow-hidden`을 걸어뒀던 거다. 문제는 이게 **모든 페이지에 전역으로 적용**된다는 걸 깜빡했다는 것. 코스가 몇 개 안 될 땐 카드가 한 화면에 다 들어와서 티가 안 났는데, 13개가 되니 바로 드러났다.

```tsx
// 수정 후
<body className="h-full">{children}</body>
```

실습 화면 쪽은 `Workspace.tsx`가 `<div className="flex h-screen flex-col overflow-hidden">`으로 자체적으로 스크롤을 관리하고 있어서, `body`의 `overflow-hidden`을 빼도 전혀 영향이 없었다. **전역 스타일을 특정 화면 하나 때문에 걸어두면, 그 화면을 잊어버리는 순간 다른 페이지가 조용히 망가진다**는 걸 다시 확인한 케이스였다.

## 트러블슈팅 2: 정답을 보면서 타이핑을 못 하겠다

이건 실제로 코스를 풀다가 스스로 답답해서 고친 부분이다. "정답보기" 버튼을 누르면 정답 코드가 모달로 뜨는데, 화면 가운데 고정된 채로 뒤 배경을 어둡게 가려버린다. 그러니 정답을 보면서 에디터에 따라 타이핑을 하려면 창을 닫았다 열었다를 반복해야 했다.

원하는 건 단순했다. **정답 창을 옆으로 치워두고, 왼쪽엔 정답 오른쪽엔 에디터를 나란히 보면서 직접 타이핑하는 것.** 그래서 모달을 드래그 가능한 패널로 바꿨다.

```tsx
const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  const rect = panelRef.current?.getBoundingClientRect();
  dragOrigin.current = {
    pointerX: e.clientX, pointerY: e.clientY,
    left: rect.left, top: rect.top,
  };
  e.currentTarget.setPointerCapture(e.pointerId);
};

const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
  if (!dragOrigin.current) return;
  const { pointerX, pointerY, left, top } = dragOrigin.current;
  setPos(clamp(left + (e.clientX - pointerX), top + (e.clientY - pointerY)));
};
```

바꾼 부분은 두 가지다.

1. **배경 오버레이 제거.** 기존엔 `<div className="absolute inset-0 bg-black/60">`로 전체를 덮어서 클릭이 다 막혔는데, 이걸 `pointer-events-none`인 바깥 컨테이너 + `pointer-events-auto`인 패널만 남기는 구조로 바꿨다. 이제 정답 창 밖을 클릭하면 그대로 에디터가 반응한다.
2. **헤더를 드래그 손잡이로.** `onPointerDown`에서 클릭 시작 위치와 패널의 원래 위치를 저장해두고, `onPointerMove`에서 그 차이만큼 `position: fixed`의 `left`/`top`을 옮긴다. `setPointerCapture`를 걸어두면 마우스가 창 밖으로 빠르게 나가도 드래그가 끊기지 않는다.

이제 정답 창을 오른쪽 구석으로 밀어두고, 왼쪽 에디터에 직접 타이핑하면서 참고할 수 있다. 별거 아닌 것 같은데 체감이 컸다 — "정답을 보는 것"과 "정답을 보며 손으로 짜보는 것"은 완전히 다른 학습 경험이라는 걸 새삼 느꼈다.

## 검증: 눈으로 확인하기 전엔 끝난 게 아니다

새 채점기 15개(코스 5개 × 3단계)를 다 짜고 나서 그냥 "될 것 같다"로 끝내지 않았다. 각 단계마다 정답 코드를 채점기에 직접 통과시켜봤다.

```bash
mkdir -p /tmp/check1
cp app/courses/llm-advanced/solutions/stage1.py /tmp/check1/main.py
cp app/courses/llm-advanced/checks/stage1.py /tmp/check1/_checker.py
cd /tmp/check1 && python3 _checker.py
```

```
✓ top_k_filter 통과
✓ top_p_filter 통과
✓ sample_token(top_k=1) 결정적 동작 통과
✓ sample_token(top_k=2) 필터링 범위 통과
✓ generator 시드 재현성 통과
채점 결과: 합격 🎉
```

그리고 전체 코스를 자동으로 도는 pytest도 돌렸다.

```bash
pytest -q
# 71 passed in 70.46s
```

기존 채점기 테스트 파일에 새 코스 5개를 파라미터로 얹기만 하면, "정답 풀이는 통과하는가"와 "빈 제출은 불합격하는가"를 자동으로 다 확인해준다.

```python
NEW_GRADABLE = [
    (course_id, stage.id)
    for course_id in (
        "python-basics", "algorithm-basics",
        "fastapi-basics", "sql-advanced", "llm-advanced",
    )
    for stage in COURSES[course_id].stages
    if stage.gradable
]

@pytest.mark.parametrize("course_id,stage_id", NEW_GRADABLE)
def test_solution_passes(course_id, stage_id):
    result, output = run_grade(course_id, stage_id, solution(course_id, stage_id))
    assert result["passed"], f"{course_id} stage{stage_id} 정답이 불합격: {result['feedback']}"
```

여기까지 확인한 뒤에야 백엔드를 재시작해서 `/api/courses`가 13개를 제대로 내려주는지, 프론트 카탈로그 페이지에 카드가 다 뜨는지 브라우저로 직접 열어봤다. 코드가 초록불이어도, 실제로 그 화면을 눈으로 한 번 보기 전까진 끝난 게 아니라는 원칙을 지키려고 했다.

## 정리

| 작업 | 핵심 |
|---|---|
| 코스 5종 추가 | 파이썬 기초 / 알고리즘 기초 / FastAPI 기초 / SQL 심화 / LLM 심화, 각 3단계씩 |
| 채점 설계 | 채점기는 사용자 코드를 신뢰하지 않고 참조 계산을 직접 다시 수행 |
| 성능 채점 | 정확성뿐 아니라 시간 제한을 걸어 "느린 정답"도 걸러냄 |
| KV 캐시 문제 | "순차 계산 = 전체 계산"이라는 수학적 동치를 채점 기준으로 삼음 |
| 스크롤 버그 | 실습 화면 때문에 걸어둔 전역 `overflow-hidden`이 카탈로그 페이지를 덮침 |
| 드래그 가능한 정답 창 | 배경 오버레이 제거 + Pointer Events로 창을 옆으로 옮겨 타이핑하며 참고 가능 |

돌이켜보면 오늘 한 일의 절반은 "코스 추가"였고 나머지 절반은 "내가 직접 써보다가 불편해서 고친 것"이었다. 개념을 읽기만 하던 습관을 실습으로 바꾸려고 만든 도구인데, 정작 그 도구를 쓰다가 또 다른 불편함을 발견하고 고치는 것 — 이 루프 자체가 지금 제일 즐거운 부분이다. 다음엔 지금은 세션 하나로 고정된 실습 환경을 여러 명이 각자 독립적으로 쓸 수 있게 만들어볼 생각이다.
