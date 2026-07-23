---
title: '유튜브 오디오 오프라인 다운로드, 왜 요즘은 안 되는가 (feat. 삽질 기록)'
date: '2026-07-17'
publish_date: '2026-09-19'
description: 개인 앱에 유튜브 오프라인 재생 기능을 넣으려다 YouTube의 스트림 throttling 정책 때문에 결국 롤백한 과정
tags:
  - YouTube
  - ReactNative
  - Expo
  - 디버깅
  - youtube-dl
---

## 왜 이런 걸 시도했나

제가 만든 유튜브 재생목록 앱(ChainPlay)에 "오프라인 재생" 기능을 넣어보려고 했습니다. 재생목록에 저장해둔 영상을 인터넷 없이도 오디오로 들을 수 있게 하는 기능이었죠. 결론부터 말하면 **못 만들었습니다.** 하지만 그 과정에서 알게 된 것들이 꽤 흥미로워서 기록으로 남깁니다.

이 글은 "이렇게 하면 됩니다" 튜토리얼이 아니라 "이렇게 했는데 안 됐습니다" 트러블슈팅 기록에 가깝습니다. 비슷한 걸 시도하려는 분이 있다면 시간을 아낄 수 있을 거예요.

> 참고로 유튜브 영상을 다운로드하는 건 YouTube 이용약관 위반이고, 스토어에 출시된 앱에 넣으면 정책 위반으로 앱이 내려갈 수 있는 영역입니다. 이번 작업은 개인 기기에서만 쓰는 별도 빌드로 한정해서 진행했습니다.

## 1차 시도: youtubei.js

가장 먼저 시도한 건 `youtubei.js`라는 라이브러리였습니다. 유튜브의 내부 API(Innertube)를 감싸서 영상 정보나 스트림 URL을 가져올 수 있게 해주는 패키지입니다. React Native 환경에서 쓰려면 `ReadableStream`, `TextEncoder` 같은 브라우저 전역 객체들을 폴리필로 채워줘야 합니다.

```ts
// 폴리필 예시 (index.ts 최상단)
import 'react-native-url-polyfill/auto';
import 'event-target-polyfill';
import { ReadableStream } from 'web-streams-polyfill';
```

폴리필까지 다 세팅하고 스트림 URL을 뽑으려고 하니 이런 에러가 났습니다.

```
No valid URL to decipher
```

원인을 파보니, 최근 YouTube가 도입한 **SABR + PO Token** 정책 때문이었습니다. 이제 유튜브는 봇 방지 토큰(PO Token) 없이는 스트림 URL 자체를 아예 비워서 줍니다. PO Token 생성 라이브러리(`bgutils-js`)까지 붙여봤지만 WEB 클라이언트에서는 여전히 풀리지 않았습니다.

## 2차 시도: 순수 fetch + 여러 클라이언트 조합

youtubei.js를 포기하고, Innertube의 `/player` 엔드포인트를 직접 fetch로 호출하는 방식으로 방향을 바꿨습니다. 핵심은 **클라이언트마다 응답이 다르다**는 점입니다.

```ts
const body = {
  context: {
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.65.10',
      // ...
    },
  },
  videoId,
};

const res = await fetch(
  'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
  { method: 'POST', headers, body: JSON.stringify(body) }
);
```

`ANDROID_VR` 클라이언트로 요청하면 서명(cipher) 변환이나 PO Token 없이 바로 재생 가능한 URL을 주는 경우가 있었습니다. 실제로 몇몇 영상(공식 뮤직비디오류)은 이 방식으로 오디오 URL을 뽑는 데 성공했습니다.

문제는 **영상마다 되는 클라이언트가 다르다**는 것이었습니다. 어떤 영상은 `ANDROID_VR`에서 `UNPLAYABLE`이 뜨고, 대신 `IOS`나 `ANDROID` 클라이언트로는 재생 가능했습니다. 그래서 여러 클라이언트를 순서대로 시도하는 폴백 로직을 짰습니다.

```ts
const CLIENTS = ['ANDROID_VR', 'IOS', 'ANDROID'];

for (const client of CLIENTS) {
  const data = await callPlayer(client, videoId);
  if (data.playabilityStatus?.status === 'OK') {
    const format = pickAudioFormat(data);
    if (format) return format;
  }
}
```

추가로 첫 요청에서 봇 확인(`LOGIN_REQUIRED`)에 걸리면, 응답에 담긴 `visitorData`를 헤더에 실어 재요청하는 2단계 로직도 필요했습니다. 여기까지 하니 대부분의 영상에서 오디오 URL을 얻을 수 있었습니다.

## 3차 문제: URL은 얻었는데 다운로드가 안 된다

URL을 얻는 데는 성공했지만, 실제로 다운로드를 시도하니 `403 Forbidden`이 떴습니다. 원인을 하나씩 좁혀갔습니다.

- Range 헤더를 지정하지 않고 전체를 한 번에 받으면 → 403
- 작은 Range(1MB 이하)로 나눠 받으면 → 성공
- 하지만 두 번째 청크부터는 → 다시 403

즉 유튜브 서버가 **일정 용량 이상은 순차적으로도 안 준다**는 뜻이었습니다. 이건 유튜브가 URL에 심어둔 `n` 파라미터와 관련이 있습니다. 이 파라미터를 제대로 디코딩하지 않은 "미가공" URL로 받으면 일부러 속도를 제한(throttle)해버리는 겁니다.

```
정상 URL: ...&n=UgoOL6QotfzybA...   ← 이 상태면 앞부분만 받히고 끊김
디코딩된 URL: ...&n=3ZNtQantXvmgrw... ← 이래야 끊김 없이 전체 다운로드 가능
```

## 4차 시도: n 파라미터 직접 디코딩

`n` 파라미터를 풀려면 유튜브가 내려주는 플레이어 스크립트(`base.js`) 안에 있는 변환 함수를 실행해야 합니다. 이 스크립트를 실제 JS 엔진에서 돌려서, 유튜브 자신의 코드가 계산한 값을 그대로 가져오는 방식을 검증해봤습니다.

```js
import vm from 'node:vm';

const sandbox = { window: {}, document: {} };
vm.createContext(sandbox);
vm.runInContext(baseJs, sandbox); // base.js를 통째로 실행
```

`base.js`를 로드해서 실행하는 것 자체는 됐습니다. 문제는 **그 안에서 어떤 함수가 n 변환 함수인지 찾아내는 것**이었습니다. 이걸 찾는 정규식 패턴을 여러 개 시도했지만, 지금 시점의 유튜브 플레이어 버전에서는 전부 실패했습니다.

혹시나 해서 이 문제를 전문적으로 다루는 검증된 오픈소스 라이브러리(`@distube/ytdl-core`)도 테스트해봤는데, 같은 에러가 났습니다.

```
WARNING: Could not parse n transform function.
```

즉 **저만 못 찾은 게 아니라, 관련 생태계 전체가 최신 유튜브 플레이어 구조를 아직 못 따라잡은 상태**였습니다. 유일하게 최신 구조까지 대응하고 있는 건 Python 기반의 `yt-dlp`뿐이었는데, 이건 모바일 앱에 내장할 수 있는 게 아닙니다.

## 왜 여기서 멈췄나

기술적으로 아예 불가능한 건 아닙니다. `yt-dlp`가 하는 것처럼 n 변환 함수를 찾는 로직을 처음부터 직접 만들 수도 있습니다. 하지만 그렇게 만들어도:

1. 유튜브가 플레이어 구조를 바꿀 때마다 (많으면 몇 주 간격으로) 다시 깨집니다.
2. 그때마다 제가 직접 최신 플레이어 스크립트를 분석해서 패치해야 합니다.
3. 이건 사실상 유튜브 다운로더의 핵심 로직을 계속 유지보수하는 일이 됩니다.

개인이 취미로 만드는 작은 앱에 들이기엔 너무 큰 비용이라고 판단했습니다. 그래서 관련 코드와 빌드, 설치된 앱까지 전부 롤백하고 원래 상태로 되돌렸습니다.

## 정리

| 시도 | 결과 |
|---|---|
| youtubei.js | 스트림 URL 자체를 못 받음 (SABR 정책) |
| PO Token 생성 후 재시도 | 여전히 URL이 안 풀림 |
| 순수 fetch + 클라이언트 폴백 | URL은 획득, 하지만 throttle 걸림 |
| n 파라미터 직접 디코딩 | 검증된 라이브러리도 실패, 직접 구현은 비용 과다 |
| **최종 결정** | **기능 롤백** |

이번 삽질에서 남는 교훈은 이겁니다. 외부 서비스의 비공식 API를 우회해서 쓰는 기능은, 그 서비스가 정책을 바꾸는 순간 유지보수 비용이 기하급수적으로 커진다는 것. 되는지 안 되는지를 빠르게 검증하고, 안 되면 미련 없이 접는 것도 중요한 판단이라는 걸 다시 확인한 하루였습니다.
