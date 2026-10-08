---
title: 'Tired of Just Reading Concepts — Adding 5 More Hands-On Courses to My Own Learning Platform'
date: '2026-07-17'
publish_date: '2026-12-14'
description: Adding 5 new hands-on courses in Python, algorithms, FastAPI, SQL, and LLM internals to a personal coding practice platform, turning concept-reading into actually-graded practice, plus two UI bugs I fixed along the way
tags:
  - Side Project
  - FastAPI
  - Next.js
  - Learning
  - pytest
---

## Great at Organizing Notes, Terrible at Actually Typing Code

Since getting back into coding, I kept running into the same pattern. I'd write up a clean summary of a
concept, decide "okay, I get this," and move on to the next topic. But the moment I actually had to write
code, my hands wouldn't move. There was a real gap between what I thought I understood and what I could
actually produce.

So a few weeks ago I started building a personal learning platform where I could run code and get it
graded right in the browser. A prompt on the left, an editor on the top right, a terminal on the bottom
right — a practice environment that lets you go all the way to building a deep learning model and
deploying it to a Kubernetes cluster. But once I had around 8 courses built, it hit me: **the stuff I
actually use every single day — Python fundamentals, algorithms, API servers — wasn't on there at all.**
I'd built the flashy stuff like deep learning and Kubernetes first and left basic strength training for
later.

So today I added 5 more courses. **Python fundamentals, algorithm fundamentals, FastAPI fundamentals, SQL
deep dive, and LLM internals** — going from 8 to 13. And along the way, I also fixed two new UI bugs that
turned up as the course count grew.

## Step 1. The Shape of a Course — Lesson, Starter, Grader, Solution. That's All Four Files

Adding a new course is mostly repetitive work. Each course has this folder structure.

```
app/courses/{course_id}/
├── lessons/    stage1.md, stage2.md, stage3.md  (지문)
├── starters/   stage1.py, stage2.py, stage3.py  (# TODO가 있는 시작 코드)
├── checks/     stage1.py, stage2.py, stage3.py  (채점 스크립트)
└── solutions/  stage1.py, stage2.py, stage3.py  (정답 코드)
```

The key idea is that **the grader doesn't trust the solution code.** For example, the "window functions"
stage of the SQL deep-dive course asks the user to find the longest track per genre with
`ROW_NUMBER() OVER (...)`, and the grader computes the exact same answer completely independently of the
user's code, **from scratch, by itself**, and compares the results.

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

Set up this way, "copying the solution verbatim to pass" and "writing the logic yourself to pass" are
graded against the exact same standard. There's no shortcut around it.

## Step 2. Grading Performance Too — It Passed, So Why Is It Slow?

There was a fun part while building the algorithm-fundamentals course. One problem has you implement
Fibonacci recursively, and **if you only check correctness, even naive recursion with no memoization
passes for small inputs.** That leaves you with the false impression that "slow but correct" is fine.

So I put a time limit in the grader.

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

`fib(33)` solved with pure recursion and no memoization makes millions of function calls and takes
several seconds, but with memoization it takes well under 0.01 seconds. The feedback itself — "the value
is right, so why is it timing out?" — becomes the best possible hint. `two_sum` (a problem meant to be
solved in O(n) with a hash map) got the same treatment: I deliberately fed it a large 20,000-item input
so that a nested-loop (O(n²)) solution would time out.

## Step 3. LLM Internals — When Verification Becomes a Proof of the Concept

The problem I liked best this time deals with the **KV cache**. The idea is that when an LLM generates
tokens one at a time, it doesn't recompute the entire sentence from scratch every time — it reuses the
Key/Value pairs for past tokens, already computed and stored in a cache. The question was how to actually
grade this.

The answer turned out to be simple. I made the grading criterion the very fact that **"the result of
computing sequentially, one token at a time, using the cache" must be mathematically identical to "the
result of computing the whole sentence at once with causal attention."**

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

Pass this test, and instead of being told in words "why a KV cache speeds things up with no loss of
accuracy," the user proves it themselves with code they wrote. Personally, building problems like this
is the part I enjoy most — the process of writing the grader itself forces me to re-internalize the
concept all over again.

## Troubleshooting 1: Adding More Courses Broke Scrolling

After bumping the course count up to 13 and opening the main page, the cards overflowed past the bottom
of the screen but scrolling didn't work at all. Rolling the mouse wheel did nothing.

The cause was in `layout.tsx`.

```tsx
// 수정 전
<body className="h-full overflow-hidden">{children}</body>
```

The practice screen (the three-pane layout with the editor and terminal) is designed so the whole page
should never scroll, and when I built that screen I'd set `overflow-hidden` on `body` for exactly that
reason. The problem was I'd forgotten this gets **applied globally to every page.** With only a handful
of courses, all the cards fit on one screen so it never showed — at 13, it was immediately obvious.

```tsx
// 수정 후
<body className="h-full">{children}</body>
```

The practice screen manages its own scrolling through `Workspace.tsx`'s
`<div className="flex h-screen flex-col overflow-hidden">`, so removing `overflow-hidden` from `body` had
zero effect on it. This was another reminder that **when you set a global style for the sake of one
specific screen, the moment you forget that screen exists, every other page quietly breaks.**

## Troubleshooting 2: Couldn't Type While Looking at the Answer

This one I actually found frustrating while working through a course myself. Clicking "Show solution"
popped the solution code up as a modal, fixed in the center of the screen, darkening the background
behind it. So typing along with the solution in the editor meant repeatedly closing and reopening the
window.

What I wanted was simple. **Push the solution window off to the side, see the solution on the left and
the editor on the right, side by side, and type it out myself while looking at it.** So I turned the
modal into a draggable panel.

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

Two things changed:

1. **Removed the background overlay.** It used to be a
   `<div className="absolute inset-0 bg-black/60">` covering everything and blocking all clicks. I
   replaced it with an outer container set to `pointer-events-none` and only the panel itself set to
   `pointer-events-auto`. Now clicking outside the solution window reaches the editor just fine.
2. **Turned the header into a drag handle.** `onPointerDown` stores the click's starting position and
   the panel's original position, and `onPointerMove` shifts the `position: fixed` element's `left`/`top`
   by that same delta. Setting `setPointerCapture` keeps the drag from breaking even if the mouse flies
   out past the edge of the window.

Now I can push the solution window into a corner and type directly in the editor on the left while
referencing it. It sounds minor, but it changed a lot — "looking at the answer" and "looking at the
answer while typing it out by hand" turned out to be completely different learning experiences.

## Verification: It's Not Done Until You've Seen It With Your Own Eyes

After writing all 15 new graders (5 courses × 3 stages), I didn't just stop at "looks like it should
work." I ran each stage's solution code through its grader directly.

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

And then I ran the pytest suite that cycles through the entire catalog automatically.

```bash
pytest -q
# 71 passed in 70.46s
```

Adding the 5 new courses as parameters to the existing grader test file automatically checks both "does
the official solution pass" and "does an empty submission fail," for every single one.

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

Only after all of this did I restart the backend and open the browser myself to confirm `/api/courses`
was returning all 13 courses correctly and that the cards all showed up on the frontend catalog page. I
tried to stick to the principle that even if the code shows all green, it isn't actually done until
you've looked at that screen with your own eyes.

## Wrap-Up

| Task | Key point |
|---|---|
| 5 new courses | Python fundamentals / algorithm fundamentals / FastAPI fundamentals / SQL deep dive / LLM internals, 3 stages each |
| Grading design | The grader never trusts user code — it recomputes the reference answer itself |
| Performance grading | A time limit catches "slow-but-correct" solutions, not just incorrect ones |
| KV cache problem | Used the mathematical equivalence "sequential computation = full computation" as the grading bar |
| Scroll bug | A global `overflow-hidden` set for the practice screen leaked onto the catalog page |
| Draggable solution window | Removed the background overlay + used Pointer Events to move the window aside while typing |

Looking back, half of today's work was "adding courses," and the other half was "fixing things that
annoyed me while actually using my own tool." I built this tool to turn a habit of just reading concepts
into hands-on practice, and then while using it myself, I found yet another rough edge and fixed it —
that loop itself is the part I'm enjoying most right now. Next up, I'm thinking about turning what's
currently a single fixed practice session into something multiple people can each use independently.
