---
title: '결제 팝업 없는 아이 전용 놀이터를 직접 만들었다 — 웹으로 키오스크 모드 구현하기'
date: '2026-07-23'
description: 오래된 맥북을 아이 전용 기기로 만들려고 웹 앱을 직접 짰다. 전체화면 진입, 부모 잠금, 시간 제한을 브라우저 API만으로 구현한 기록
tags:
  - React
  - Next.js
  - Fullscreen API
  - PWA
  - 키오스크
---

## 왜 만들었나

집에 안 쓰는 맥북이 한 대 굴러다닌다. 성능은 요즘 기준으로 한참 뒤처졌지만, 아이들이 마우스 연습하며 노는 용도로는 충분했다. 그래서 아이들 게임 앱 몇 개를 깔아줬는데, 며칠 지나니 문제가 보이기 시작했다.

**결제 팝업이 너무 많았다.**

무료로 받은 앱인데 게임 하나 끝날 때마다 "전체 버전을 잠금 해제하세요" 창이 뜬다. 아이는 글을 못 읽으니 그냥 큰 버튼을 누른다. 그게 결제 화면으로 가는 버튼이다. 광고도 마찬가지다. 색칠 그림 하나 고르려는데 전면 광고가 뜨고, 닫기 버튼(×)은 5초 뒤에 나타나며 그마저도 화면 구석에 아주 작게 있다. 아이 손가락으로는 정확히 못 누르고, 결국 광고 링크를 눌러 브라우저가 열린다.

거기에 하나 더. 앱을 잘 놀다가도 아이가 실수로 창을 최소화하거나, Dock을 눌러 다른 앱을 열거나, 시스템 설정을 헤집어 놓는 일이 반복됐다. 옆에 붙어 앉아 계속 지켜봐야 하는 상황이 됐고, 그럴 거면 태블릿을 쥐여주는 것과 다를 게 없었다.

그래서 그냥 직접 만들기로 했다. 요구사항은 단순했다.

1. **광고 없고 결제 없다.** 외부 링크도 없다.
2. **시작하면 전체화면.** 아이가 다른 걸 건드릴 여지를 최대한 없앤다.
3. **아이 혼자서는 못 빠져나온다.** 대신 부모는 쉽게 빠져나올 수 있어야 한다.
4. **정해진 시간이 지나면 자동으로 끝난다.**
5. **마우스만으로 전부 조작된다.** 글을 못 읽는 아이도 아이콘만 보고 놀 수 있어야 한다.

결과물은 React + Next.js로 만든 웹 앱이다. 색칠 놀이, 퍼즐, 짝꿍 찾기 등 10가지 놀이가 들어갔다. 이 글은 그중에서도 **"아이가 못 빠져나가는 화면"을 브라우저 API만으로 어떻게 만들었는지**에 대한 기록이다.

![KidsPlay 놀이 허브 화면 — 10가지 놀이 카드](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/portfolio/kidsplay-screen-ko-hub.png)

## 전체 구조 잡기: 부모 화면과 아이 화면 분리

가장 먼저 정한 건 화면을 두 개의 모드로 완전히 나누는 것이었다. 설정은 부모만 만지고, 아이는 놀이만 한다.

```tsx
const [mode, setMode] = useState<"parent" | "kids">("parent");

if (mode === "parent") return <ParentScreen ... onStart={start} />;

return (
  <div className="kid-mode">
    {/* 아이 화면 */}
  </div>
);
```

라우팅을 쓰지 않고 상태값 하나로 갈랐다. 이유가 있다. **URL로 나누면 아이가 뒤로 가기를 누르거나 주소창을 건드렸을 때 빠져나갈 구멍이 생긴다.** 상태값으로만 관리하면 나가는 경로가 코드상 단 하나(`exit()` 함수)뿐이라, 그 한 곳만 잠그면 된다.

부모 화면에서는 세 가지를 고르게 했다.

| 설정 항목 | 선택지 | 용도 |
|---|---|---|
| 아이 나이 | 2~3세 / 4~5세 / 6~7세 | 게임 난이도와 획득 별 개수 조절 |
| 놀이 시간 | 15 / 30 / 45 / 60분 | 자동 종료 타이머 |
| 첫 놀이 | 놀이터(전체) 또는 특정 게임 | 바로 시작할 게임 지정 |

나이 설정은 각 게임에 그대로 내려가서 문제 개수를 바꾼다.

```ts
export const difficultyCount = (age: AgeGroup, values: [number, number, number]) =>
  values[age === "toddler" ? 0 : age === "preschool" ? 1 : 2];
```

게임 컴포넌트에서는 `difficultyCount(age, [4, 6, 9])` 처럼 쓴다. 2~3세는 4개, 4~5세는 6개, 6~7세는 9개. 이 함수 하나로 10개 게임의 난이도를 일관되게 맞췄다.

## Step 1. 전체화면으로 진입시키기

핵심은 Fullscreen API다. 그런데 여기에 함정이 하나 있다.

**전체화면 요청은 반드시 사용자의 직접적인 조작(클릭, 키 입력) 안에서 호출되어야 한다.** `useEffect` 안에서 자동으로 호출하면 브라우저가 조용히 거부한다. 그래서 부모 화면의 "전체 화면으로 시작" 버튼 클릭 핸들러 안에 넣었다.

```tsx
const start = () => {
  const seconds = settings.minutes * 60;
  setRemaining(seconds);
  setSessionEnd(Date.now() + seconds * 1000);
  setActiveGame(selectedGame);
  setMode("kids");
  setTimedOut(false);

  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (request) Promise.resolve(request.call(root)).catch(() => undefined);
};
```

몇 가지 짚을 부분이 있다.

**`webkitRequestFullscreen` 폴백이 필요하다.** 구형 Safari(그리고 내가 쓰려던 오래된 맥북의 브라우저)는 표준 `requestFullscreen`이 없거나 동작이 다르다. 타입 단언으로 옵셔널 프로퍼티를 붙여서 둘 다 처리했다.

**`.catch(() => undefined)`가 중요하다.** 전체화면 요청은 실패할 수 있다. 브라우저 설정, iframe 안에서 실행, 사용자가 이전에 거부한 경우 등. 이때 처리되지 않은 Promise rejection이 뜨면 콘솔이 지저분해지고, 상황에 따라 에러 오버레이가 뜬다. **전체화면 진입 실패가 앱 전체를 막으면 안 된다.** 실패해도 그냥 창 모드로 놀 수 있게 조용히 넘겼다.

**`document.documentElement`를 대상으로 한다.** 특정 div가 아니라 문서 루트를 전체화면으로 만들어야 모달이나 툴팁 같은 것들이 화면 밖으로 잘리지 않는다.

나가는 쪽도 대칭으로 만들었다.

```tsx
const exit = () => {
  setExitGate(false);
  setTimedOut(false);
  setSuccess(null);
  setMode("parent");
  setActiveGame(null);
  setSessionEnd(null);

  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  const exitFullscreen = doc.exitFullscreen || doc.webkitExitFullscreen;
  if (exitFullscreen) Promise.resolve(exitFullscreen.call(doc)).catch(() => undefined);
};
```

`exitFullscreen`은 `document`에 붙어 있고 `requestFullscreen`은 엘리먼트에 붙어 있다. 대상이 다르다는 걸 처음에 헷갈려서 한참 헤맸다.

## Step 2. 아이가 실수로 화면을 망가뜨리지 못하게

전체화면에 들어갔다고 끝이 아니다. 아이가 마우스를 아무렇게나 누르면 별의별 일이 다 일어난다.

- 우클릭 → 컨텍스트 메뉴가 뜨고 "이미지 저장", "페이지 소스 보기"가 보인다
- 더블클릭 → 텍스트가 블록 선택되어 파랗게 반전된다
- 스크롤 휠 → 화면이 밀려서 게임 버튼이 화면 밖으로 나간다
- 키보드 아무 키 → 브라우저 단축키가 걸린다

키즈 모드일 때만 이 이벤트들을 막았다.

```tsx
useEffect(() => {
  if (mode !== "kids") return;

  const prevent = (event: Event) => event.preventDefault();
  const preventKey = (event: KeyboardEvent) => event.preventDefault();

  document.addEventListener("contextmenu", prevent);
  document.addEventListener("dblclick", prevent);
  document.addEventListener("wheel", prevent, { passive: false });
  document.addEventListener("keydown", preventKey);

  return () => {
    document.removeEventListener("contextmenu", prevent);
    document.removeEventListener("dblclick", prevent);
    document.removeEventListener("wheel", prevent);
    document.removeEventListener("keydown", preventKey);
  };
}, [mode]);
```

여기서 **`wheel`에 `{ passive: false }`를 붙인 게 핵심이다.** 최신 브라우저는 스크롤 성능을 위해 `wheel`과 `touchmove` 리스너를 기본적으로 passive로 등록한다. passive 리스너에서는 `preventDefault()`가 무시되고, 콘솔에 "Unable to preventDefault inside passive event listener" 경고만 뜬다. 이걸 모르고 한동안 "왜 스크롤이 안 막히지?" 하며 시간을 버렸다.

`mode !== "kids"`일 때 바로 return하는 것도 중요하다. 부모 화면에서까지 우클릭과 키보드를 막으면 부모가 설정을 못 만진다. 그리고 cleanup 함수에서 반드시 리스너를 제거해야 한다. 안 그러면 키즈 모드를 한 번 들어갔다 나온 뒤에도 계속 이벤트가 막힌다.

### 솔직히 말하면 완벽하지 않다

**웹 앱으로는 `Esc` 키와 `F11`을 막을 수 없다.** 브라우저가 전체화면에서 빠져나오는 경로는 보안상 사이트가 가로챌 수 없게 되어 있다. 이건 웹 표준이 의도적으로 그렇게 만든 것이고, 우회할 방법도 없다(있다면 그게 더 위험한 일이다).

그래서 목표를 현실적으로 다시 잡았다. **"절대 못 나가게"가 아니라 "실수로는 안 나가게"**다. 2~7세 아이가 마우스를 이리저리 누르다 우연히 Esc를 정확히 누를 확률은 낮다. 실제로 몇 주 써보니 아이가 전체화면을 빠져나온 일은 없었다. 진짜 완전한 잠금이 필요하면 OS 수준의 키오스크 모드(macOS의 가이드 접근, Chrome의 `--kiosk` 플래그)를 함께 써야 한다.

## Step 3. 부모만 나갈 수 있는 문 만들기

아이가 못 나가게 하는 것만큼 중요한 게, **부모는 쉽게 나갈 수 있어야 한다**는 점이다. 처음엔 고정 PIN 번호를 썼는데 금방 버렸다. 이유가 있다.

- 아이가 옆에서 보고 외운다. 네 자리 숫자는 생각보다 빨리 외운다.
- 부모가 잊어버린다. 자주 안 쓰는 번호는 반드시 잊는다.
- 어딘가에 저장해야 하는데, 브라우저 localStorage에 넣으면 개발자 도구로 다 보인다.

그래서 **매번 랜덤으로 생성되는 곱셈 문제**로 바꿨다.

```tsx
function createMathProblem() {
  const left = Math.floor(Math.random() * 8) + 2;
  const right = Math.floor(Math.random() * 8) + 2;
  return { left, right, answer: left * right };
}
```

2부터 9까지의 곱셈이다. 구구단을 아는 사람이면 3초 안에 푼다. 아직 구구단을 모르는 미취학 아동은 못 푼다. **외울 대상이 없으니 아이가 훔쳐볼 수도 없고, 부모가 잊어버릴 것도 없다.** 저장할 비밀도 없으니 localStorage를 뒤져도 나오는 게 없다.

![KidsPlay 부모님 확인 모달 — 랜덤 곱셈 문제](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/portfolio/kidsplay-screen-ko-parentcheck.png)

문에 들어가는 방법도 아이가 우연히 밟지 않게 만들었다. 화면 상단 모서리의 자물쇠 버튼을 **1초간 누르고 있어야** 열린다.

```tsx
const holdTimer = useRef<number | null>(null);

const startHold = () => {
  holdTimer.current = window.setTimeout(onExitRequest, 1000);
};
const stopHold = () => {
  if (holdTimer.current) window.clearTimeout(holdTimer.current);
  holdTimer.current = null;
};

<button
  className="parent-corner left"
  onMouseDown={startHold}
  onMouseUp={stopHold}
  onMouseLeave={stopHold}
  onTouchStart={startHold}
  onTouchEnd={stopHold}
  aria-label="부모 메뉴: 1초간 누르기"
>🔒</button>
```

`onMouseLeave`에도 `stopHold`를 거는 게 포인트다. 누른 채로 마우스를 끌고 나가면 `onMouseUp`이 이 버튼에서 발생하지 않는다. 그럼 타이머가 살아남아서, 아이가 다른 곳에서 놀고 있는데 갑자기 부모 확인 창이 뜬다. 실제로 겪고 나서 추가한 코드다.

터치 이벤트(`onTouchStart` / `onTouchEnd`)도 같이 붙여서 태블릿에서도 동작하게 했다.

오답 처리는 이렇게 했다.

```tsx
const submit = () => {
  if (!answer) return;
  if (Number(answer) === problem.answer) {
    window.setTimeout(onExit, 250);
    return;
  }
  setWrong(true);
  window.setTimeout(() => {
    setAnswer("");
    setProblem(createMathProblem());   // 문제를 새로 뽑는다
    setWrong(false);
  }, 500);
};
```

틀리면 0.5초간 흔들리는 애니메이션을 보여준 뒤 **문제 자체를 새로 뽑는다.** 같은 문제를 계속 주면 아이가 숫자를 무작위로 눌러보다 우연히 맞힐 수 있다. 매번 새 문제면 그 확률이 계속 초기화된다.

정답일 때 250ms 지연을 준 건 순전히 감각적인 이유다. 정답 입력과 동시에 화면이 확 바뀌면 뚝 끊기는 느낌이 든다. 짧은 여백을 주니 훨씬 자연스러웠다.

## Step 4. 놀이 시간 타이머

"30분만 하기로 했잖아"를 매번 말로 하는 대신 앱이 알아서 끝내게 했다. 여기서 중요한 구현 포인트가 하나 있다.

**남은 시간을 1초씩 빼는 방식으로 만들면 안 된다.**

```tsx
// 이렇게 하면 안 됨
setInterval(() => setRemaining((prev) => prev - 1), 1000);
```

브라우저는 탭이 비활성화되거나 노트북 뚜껑이 닫히면 타이머를 늦추거나 아예 멈춘다. 이 방식이면 실제로는 30분이 지났는데 앱은 12분밖에 안 지났다고 믿는다. 그래서 **종료 시각을 절대 시간으로 잡아두고, 매초 현재 시각과 비교**했다.

```tsx
// 시작할 때
setSessionEnd(Date.now() + seconds * 1000);

// 매초 확인
useEffect(() => {
  if (mode !== "kids" || !sessionEnd) return;

  const update = () => {
    const seconds = Math.max(0, Math.ceil((sessionEnd - Date.now()) / 1000));
    setRemaining(seconds);
    if (seconds === 0) {
      setTimedOut(true);
      setExitGate(true);
    }
  };

  update();                                    // 즉시 한 번
  const timer = window.setInterval(update, 1000);
  return () => window.clearInterval(timer);
}, [mode, sessionEnd]);
```

이러면 타이머가 몇 초 밀리든, 탭이 백그라운드에 있었든 정확한 남은 시간이 나온다. `setInterval` 등록 직후 `update()`를 한 번 직접 호출하는 것도 필요하다. 안 그러면 첫 1초 동안 남은 시간이 화면에 안 나온다.

시간이 다 되면 앞서 만든 부모 확인 창을 **닫기 버튼 없이** 띄운다.

```tsx
{!timedOut && <button className="math-close" onClick={onClose}>✕</button>}
```

`timedOut`이 true면 × 버튼 자체를 렌더링하지 않는다. 곱셈 문제를 풀어야만 나갈 수 있으니, 아이가 혼자 시간을 연장할 수 없다.

## Step 5. 진행 상황 저장과 오프라인 지원

별과 스티커는 localStorage에 저장했다. 서버도 계정도 없다. **아이 데이터를 서버에 안 보내는 게 가장 확실한 개인정보 보호**라고 판단했다.

```tsx
useEffect(() => {
  try {
    window.localStorage.setItem("kidsplay-settings", JSON.stringify(settings));
  } catch { /* no-op */ }
}, [settings]);
```

`try/catch`가 필수다. **시크릿 모드나 브라우저 설정에 따라 localStorage 접근 자체가 예외를 던진다.** 저장 실패는 앱이 멈출 이유가 안 되니 조용히 넘긴다.

읽어올 때는 `setTimeout(..., 0)`으로 한 틱 미뤘다.

```tsx
useEffect(() => {
  const restoreTimer = window.setTimeout(() => {
    try {
      const savedSettings = window.localStorage.getItem("kidsplay-settings");
      // ...
    } catch { /* Local storage can be disabled in private browsing. */ }
  }, 0);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }

  return () => window.clearTimeout(restoreTimer);
}, []);
```

정적 사이트로 미리 렌더링된 HTML과 localStorage에서 복원한 값이 다르면 hydration 불일치 경고가 뜬다. 첫 렌더는 기본값으로 그리고, 그다음 틱에 저장된 값을 반영하면 이 문제가 사라진다.

같은 `useEffect`에서 서비스 워커도 등록했다. 한 번 접속하면 그다음부터는 인터넷 없이도 놀 수 있다. 차 안에서나 와이파이가 없는 곳에서도 되니, 아이용 앱에서는 생각보다 체감이 크다.

## 트러블슈팅 정리

직접 겪은 것들만 모았다.

| 증상 | 원인 | 해결 |
|---|---|---|
| 전체화면이 안 켜짐 | `useEffect`에서 호출 | 반드시 클릭 핸들러 안에서 호출 |
| 스크롤이 안 막힘 | `wheel`이 기본 passive | `{ passive: false }` 옵션 추가 |
| 부모 창이 갑자기 뜸 | 누른 채 마우스가 버튼을 벗어남 | `onMouseLeave`에도 `stopHold` 연결 |
| 시간이 안 맞음 | 1초씩 빼는 방식 | 종료 시각을 절대 시간으로 저장 후 비교 |
| hydration 경고 | 첫 렌더에서 localStorage 읽음 | `setTimeout(..., 0)`으로 한 틱 미룸 |
| 한국어 음성이 안 나옴 | 음성 목록 로딩 전 호출 | 목록이 비어 있으면 한국어로 간주 후 재시도 |

마지막 항목은 부연이 필요하다. `speechSynthesis.getVoices()`는 브라우저가 음성 목록을 다 불러오기 전에는 빈 배열을 반환한다. 이때 "한국어 음성이 없네" 하고 영어로 넘어가버리면, 앱을 켜자마자 처음 몇 번은 영어로 말한다.

```tsx
const voices = synthesis.getVoices();
const koreanVoice = voices.find((voice) => /^ko([-_]|$)/i.test(voice.lang));
const canSpeakKorean = language === "ko" && (Boolean(koreanVoice) || voices.length === 0);
```

`voices.length === 0`을 조건에 넣어서, **목록이 아직 안 왔을 때는 일단 한국어로 시도**하게 했다. 정규식을 `/^ko([-_]|$)/i`로 쓴 이유는 `ko-KR`, `ko_KR`, `ko` 세 가지 표기를 모두 잡되 `kok`(콘칸어) 같은 다른 언어 코드는 걸러내기 위해서다.

## 정리

브라우저 API만으로 만든 아이용 키오스크 화면의 핵심 흐름은 이렇다.

1. **모드는 상태값 하나로 가른다** — 라우팅을 쓰면 뒤로 가기로 빠져나갈 구멍이 생긴다
2. **전체화면은 클릭 핸들러 안에서** — `useEffect`에서는 조용히 거부된다
3. **키즈 모드에서만 이벤트를 막는다** — `wheel`은 `{ passive: false }` 필수
4. **잠금은 고정 PIN 대신 랜덤 곱셈** — 외울 게 없으니 아이도 못 외우고 부모도 안 잊는다
5. **타이머는 절대 시각 기준** — 1초씩 빼면 탭이 멈출 때 어긋난다
6. **저장은 localStorage + try/catch** — 서버가 없으면 유출될 데이터도 없다

전체화면을 완벽히 잠그는 건 웹으로는 불가능하다. 하지만 **"실수로는 빠져나가지지 않는" 수준까지는 충분히 만들 수 있었고**, 미취학 아동 대상으로는 그걸로 충분했다.

무엇보다, 아이가 결제 팝업을 누를 걱정 없이 옆에서 다른 일을 할 수 있게 됐다. 며칠 저녁 붙잡고 만든 것치고는 꽤 남는 장사였다.

만든 결과물은 [kidsnara.pages.dev](https://kidsnara.pages.dev)에서 바로 볼 수 있다. 설치도 로그인도 필요 없다. 이걸 Cloudflare Pages에 무료로 올린 과정은 [Cloudflare Pages로 pages.dev 무료 도메인 배포하기](/ko/posts/cloudflare_pages_deploy_20260723)에 따로 정리했다.
