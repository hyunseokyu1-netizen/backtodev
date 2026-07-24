---
title: '카세트 앱에 유튜브 링크를 붙이려다가 — WebView 브릿지와 씨름한 기록'
date: '2026-07-10'
publish_date: '2026-07-25'
description: 친구와 테이프를 만들어 주고받던 추억을 다시 만들고 싶어서, 스킵 없는 레트로 카세트 뮤직 플레이어에 유튜브 링크 추가와 테이프 공유 기능을 붙이며 react-native-youtube-iframe의 postMessage 브릿지 유실 버그와 FF/REW seek 레이스 컨디션을 실기기 로그로 잡아낸 과정
tags:
  - React Native
  - Expo
  - Android
  - WebView
  - 트러블슈팅
---

## 기존 앱, 그리고 이번에 붙이려 한 것

`Cassette — No Skip`은 스킵 버튼이 없는 레트로 카세트 뮤직 플레이어다. Side A/B에 각각 30분씩, 내 폰에 있는 음원 파일만 담아서 끝까지 듣는 게 컨셉이다. 이번에 붙이려던 건 두 가지였다.

1. **유튜브 링크로 트랙 추가** — 파일이 없어도 링크만 있으면 카세트에 담기
2. **테이프 여러 개 관리 + 공유** — 내가 만든 플레이리스트를 코드 하나로 친구에게 전달

작업 자체는 며칠에 걸쳐 진행했는데, 기능이 하나씩 붙을 때마다 실기기에서 재현되는 버그가 있었다. 이 글은 그 디버깅 기록이다.

## 왜 유튜브 링크였나 — 카세트를 주고받던 그 시절

이번 업데이트를 하게 된 건 기능이 필요해서라기보다는, 예전 생각이 나서였다.

옛날엔 마음에 드는 노래들을 골라 테이프 하나에 담아서 친구한테 건네주곤 했다. "이 노래 좋아서 넣었어" 하면서 A면 첫 곡부터 순서를 고민하고, 다 만들고 나면 그 테이프를 들고 만나서 같이 듣고, 어떤 곡이 왜 좋았는지 한참 이야기했다. 지금 스트리밍 서비스로 플레이리스트 링크 하나 던지는 것과는 결이 다른 경험이었다. 손으로 고르고, 순서를 배치하고, 직접 건네준다는 그 과정 자체가 좋았다.

`Cassette — No Skip`을 처음 만들 때는 "스킵 없이 끝까지 듣는다"는 감성에 집중했는데, 쓰다 보니 그때 그 경험에서 빠진 조각이 하나 있었다. 바로 **누군가와 나누는 것**이다. 내 폰에만 있는 파일로 테이프를 만들면 그 테이프는 내 폰 밖으로 못 나간다. 그래서 이번엔 유튜브 링크로 곡을 채워서, 파일 없이도 테이프를 만들고, 그 테이프를 코드 하나로 친구에게 건네고, 친구는 그걸 자기 카세트에 꽂아 넣는 흐름을 만들고 싶었다. 예전에 테이프를 건네던 그 손짓을, 지금 시대의 방식으로 다시 만들어보고 싶었달까.

그래서 이번 업데이트의 두 기능은 사실 하나의 목적을 향해 있다. 유튜브 링크는 "누구나 곡을 채워 넣을 수 있게" 하는 재료이고, 테이프 공유는 그렇게 만든 걸 "건네주는" 행위 자체를 구현한 것이다.

## 유튜브 트랙 추가 — 링크만으로 제목과 길이까지

유튜브 링크(`youtube.com/watch?v=`, `youtu.be/`, `shorts/`)에서 videoId를 정규식으로 뽑아내고, 두 개의 공식 무인증 엔드포인트로 메타데이터를 채웠다.

```typescript
// 제목은 oEmbed (API 키 불필요)
async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );
  const data = await res.json();
  return typeof data.title === "string" ? data.title : null;
}

// 길이는 Innertube player 엔드포인트 (ANDROID 클라이언트는 400, WEB 클라이언트로 통과)
async function fetchYouTubeDuration(videoId: string): Promise<number> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00" } },
      videoId,
    }),
  });
  const data = await res.json();
  const sec = parseInt(data?.videoDetails?.lengthSeconds, 10);
  return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 0;
}
```

Innertube 엔드포인트는 클라이언트 이름을 뭘 넣느냐에 따라 응답이 갈렸다. `ANDROID` 클라이언트로 요청하면 `400 Precondition check failed`가 떨어졌고, `WEB` 클라이언트로 바꾸니 통과했다(단, `playabilityStatus`는 `UNPLAYABLE`로 오는데 우리는 재생이 아니라 메타데이터만 필요하니 상관없다). 이 조회에 실패해도 길이를 0으로 두고, 재생 화면의 iframe이 로드되면 `getDuration()`으로 자동 보정하도록 이중 안전장치를 뒀다.

재생은 `react-native-youtube-iframe`으로 처리했다. 카세트의 릴 애니메이션은 그대로 메인 화면에 두고, 유튜브 트랙일 때만 그 아래 356×200(16:9) 영상 창이 따로 뜨는 구조로 잡았다. 유튜브 임베드는 완전히 숨길 수 없다는 정책 제약이 있어서, 처음엔 카세트를 숨기고 영상만 크게 띄우는 안도 검토했지만 "카세트 감성"이 이 앱의 정체성이라 릴이 항상 보이는 쪽으로 정리했다.

## 실기기에서 터진 문제 1 — 2번째 곡부터 정지/재생이 안 먹는다

첫 곡은 멀쩡한데 다음 곡부터 재생/정지 버튼이 죽는 증상이 있었다. USB 디버깅 상태에서 재현하며 각 함수 진입점에 로그를 심었다.

```typescript
const pause = useCallback(async () => {
  console.log(`[dbg] pause isPlaying=${isPlaying} noise=${isPlayingNoise} yt=${currentYoutubeId}`);
  // ...
```

`adb logcat -d | grep -F "[dbg]"`로 실기기 로그를 뽑아보니, `pause`는 정상 호출되는데 iframe에서 `paused` 이벤트가 전혀 안 돌아왔다. 명령이 앱→WebView 방향으로 가다가 어딘가에서 사라지고 있었다.

원인은 `react-native-webview` 13.x의 변경이었다. 최신 버전은 Android에서 RN→WebView `postMessage`를 `document` 객체로 전달하는데, `react-native-youtube-iframe`이 심는 플레이어 스크립트는 `window`에서만 메시지를 듣고 있었다.

```javascript
// react-native-youtube-iframe이 iframe 안에 심는 리스너 (라이브러리 소스)
window.addEventListener('message', function (event) {
  const { data } = event;
  const parsedData = JSON.parse(data);
  switch (parsedData.eventName) {
    case 'playVideo': player.playVideo(); break;
    // ...
```

`document`로 온 메시지가 `window` 리스너에는 닿지 않으니 재생/정지 명령이 그냥 허공으로 사라진 것이다. FF/REW는 `injectJavaScript`(직접 스크립트 주입) 경로를 쓰기 때문에 이 문제와 무관하게 잘 됐다 — 그래서 "FF/REW는 되는데 재생/정지만 안 된다"는 증상이 나왔다. 두 경로가 다르다는 걸 로그로 확인하고 나서야 왜 절반만 고장났는지 이해가 됐다.

해결은 `document` 메시지를 `window`로 중계하는 브릿지 스크립트를 하나 더 주입하는 것이었다.

```tsx
<YoutubeIframe
  webViewProps={{
    injectedJavaScript: `
      document.addEventListener('message', function (e) {
        window.dispatchEvent(new MessageEvent('message', { data: e.data }));
      });
      true;
    `,
  }}
/>
```

## 실기기에서 터진 문제 2 — REW로 이전 곡에 가면 처음부터 재생된다

FF/REW로 트랙 경계를 넘어 이전 곡으로 넘어갔을 때, 감은 위치가 아니라 항상 0초부터 재생되는 문제가 있었다. 로그를 보니 `seekTo` 요청은 제대로 보내지고 있었다.

```
[dbg] REW stop @142054
[dbg] playItemAt idx=1 type=track src=youtube init=140054
[dbg] ytState=paused idx=1
[dbg] ytState=unstarted idx=1
[dbg] ytState=buffering idx=1
[dbg] ytState=playing idx=1
```

`init=140054`(140초 지점)까지는 정확히 계산됐는데, 실제로는 0초부터 재생됐다. 원인은 타이밍이었다. 같은 iframe에서 `loadVideoById`로 영상만 바뀌는 경우(트랙 전환) `onReady` 콜백이 다시 호출되지 않는데, 내 seek 로직은 "iframe이 ready 상태가 될 때"를 기다리고 있었다. 그래서 요청이 조용히 버려졌다.

```tsx
// 수정 전 — onReady를 기다리다가 트랙 전환 시엔 영원히 못 옴
const applyYoutubeSeek = useCallback(() => {
  if (!youtubeSeekRequest || !ytReadyRef.current || !ytRef.current) return;
  ytRef.current.seekTo(youtubeSeekRequest.ms / 1000, true);
}, [youtubeSeekRequest]);
```

`onReady`는 iframe이 처음 만들어질 때만 오고, 영상 교체는 다른 신호를 봐야 했다. 결국 seek 적용 시점을 "요청이 들어온 즉시 1차 시도" + "영상이 실제로 `playing` 상태가 됐을 때 2차 확정"으로 이중화했다.

```tsx
// 1차: 요청이 오는 즉시 시도 (이미 플레이어가 떠 있으면 바로 먹힘)
useEffect(() => {
  if (!youtubeSeekRequest || !ytRef.current) return;
  if (youtubeSeekRequest.ms > 500) {
    ytRef.current.seekTo(youtubeSeekRequest.ms / 1000, true).catch(() => {});
  }
}, [youtubeSeekRequest]);

// 2차: "playing" 이벤트에서 확정 (loadVideoById로 1차가 무시된 경우 대비)
const handleYtStateChange = useCallback((state: string) => {
  if (state === "playing" && seekReqRef.current && ytRef.current) {
    const { ms } = seekReqRef.current;
    seekReqRef.current = null;
    if (ms > 500) ytRef.current.seekTo(ms / 1000, true).catch(() => {});
  }
  onYoutubeStateChange(state);
}, [onYoutubeStateChange]);
```

어느 한쪽이 무시돼도 다른 쪽이 잡아준다. 시간이 좀 지저분해 보이지만, iframe 라이프사이클을 앱에서 통제할 수 없는 이상 이게 제일 견고했다.

## 최종 UX 결정 — "유튜브는 유튜브 버튼으로"

여기까지 고치고 나니 재생/정지도 명령은 도착하는데, iframe 반응이 2~4초씩 느릴 때가 있었다. 앱의 다른 버튼들(FF/REW/플립)은 즉각 반응하는데 이 지점만 미묘하게 굼떴다. 몇 차례 튜닝해도 유튜브 iframe 특성상 완전히 없애기는 어려웠다.

그래서 방향을 바꿨다. **유튜브 트랙 재생 중에는 앱의 재생/정지 버튼 대신, 영상 화면 자체의 ▶/⏸ 버튼을 정식 컨트롤로 안내**하기로 했다. 앱 버튼을 누르면 토스트로 안내만 띄우고 상태는 건드리지 않는다.

```typescript
function showYoutubeControlHint() {
  const msg = "YouTube 트랙은 영상 화면의 ▶/⏸ 버튼을 사용하세요";
  if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert("", msg);
}
```

대신 영상 버튼으로 조작한 결과(재생/정지 이벤트)는 카세트의 릴 회전과 진행 시간에 그대로 동기화된다. 영상에서 멈추면 릴도 멈추고 테이프 시간도 그 자리에 정지, 다시 재생하면 멈췄던 지점부터 이어간다. FF/REW는 "테이프를 감는" 동작이라 기존처럼 앱 버튼으로 유지했다 — 이 경로는 `injectJavaScript`를 쓰기 때문에 안정적으로 동작했던 걸 이미 확인했으니까.

완벽한 통합 대신 "이 버튼은 여기서 확실히 되고, 저 버튼은 저기서 확실히 된다"는 정직한 경계를 그은 셈이다. 유튜브 재생이 화면이 꺼지면 멈춘다는 것도(백그라운드 재생은 유튜브 정책상 불가) 릴리즈 노트에 미리 못박아 뒀다. 로컬 파일 트랙은 원래처럼 화면을 꺼도 계속 재생된다.

## 테이프 공유 — Hermes엔 btoa가 없다

테이프(Side A/B 트랙 목록)를 텍스트 하나로 내보내고 가져오는 기능도 붙였다. `CT2:` 접두사 + base64로 JSON을 인코딩하는 단순한 포맷인데, React Native의 JS 엔진(Hermes)에는 브라우저의 `btoa`/`atob`가 없어서 UTF-8 안전한 base64 인코더를 직접 짜야 했다(한글 테이프 이름이 깨지지 않아야 하니 단순 `charCodeAt` 방식은 못 쓴다).

```typescript
function utf8Encode(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i)!;
    if (code > 0xffff) i++; // surrogate pair
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}
```

가져오기 쪽은 사용자가 카톡 메시지 전체를 그대로 복사해서 붙여넣는 시나리오를 가정했다. 정규식으로 `CT2:` 코드만 추출하되, 메신저가 긴 문자열을 줄바꿈으로 감싸는 경우까지 대비해 2단계로 파싱했다.

```typescript
export function decodeTapeShare(text: string): Tape | null {
  const strict = text.match(/CT2:([A-Za-z0-9+/=]+)/)?.[1];
  const loose = text.match(/CT2:\s*([A-Za-z0-9+/=\s]+)/)?.[1]?.replace(/\s+/g, "");
  for (const candidate of [strict, loose]) {
    if (!candidate) continue;
    const tape = tapeFromBase64(candidate);
    if (tape) return tape;
  }
  return null;
}
```

로컬 파일 트랙은 다른 기기에서 재생할 수 없으니 공유 시 자동으로 제외하고, 몇 곡이 빠졌는지 안내 문구를 붙였다. 붙여넣는 텍스트 입력창에는 타이핑하는 즉시 "「테이프 이름」 · A 3곡 / B 2곡" 미리보기가 뜨도록 해서, Import 버튼을 누르기 전에 뭐가 들어올지 확인할 수 있게 했다.

## 정리

1. **유튜브 메타데이터**: oEmbed(제목) + Innertube WEB 클라이언트(길이), 조회 실패 시 iframe `getDuration()`으로 보정
2. **재생/정지 유실**: `react-native-webview` 13.x가 `document`로 보내는 메시지를 라이브러리는 `window`에서만 들음 → 브릿지 스크립트로 중계
3. **REW seek 유실**: 트랙 전환 시 `onReady`가 다시 안 옴 → 요청 즉시 시도 + `playing` 이벤트에서 확정, 이중화로 해결
4. **UX 최종안**: 유튜브 재생/정지는 영상 버튼이 정식 컨트롤, FF/REW는 앱 버튼 — 안정적으로 되는 경로만 표면에 노출
5. **공유 포맷**: Hermes에 없는 base64를 UTF-8 안전하게 직접 구현, 가져오기는 메시지 전체 붙여넣기 + 줄바꿈 복구까지 대응

이번 작업에서 제일 크게 느낀 건, 실기기 로그 없이는 "FF/REW는 되는데 재생/정지만 안 된다" 같은 절반만 고장난 버그의 원인을 특정하기 어려웠다는 점이다. 두 기능이 같은 라이브러리 안에서도 완전히 다른 통신 경로(`injectJavaScript` vs `postMessage`)를 타고 있었고, 그 차이가 정확히 증상의 경계선과 일치했다. `adb logcat`으로 함수 진입점마다 상태를 찍어보는 게 결국 제일 빠른 길이었다.
