---
title: 'pnpm install이 exit 1로 죽을 때: 빌드 스크립트 승인과 플랫폼별 네이티브 바이너리 함정'
date: '2026-06-22'
publish_date: '2026-07-10'
description: Replit(linux-x64)용으로 세팅된 Expo 모노레포를 Apple Silicon 맥으로 옮기다 만난 pnpm install exit 1을 onlyBuiltDependencies와 allowBuilds로 해결한 기록
tags:
  - pnpm
  - Expo
  - React Native
  - 모노레포
  - Apple Silicon
---

## 들어가며: "install인데 왜 죽지?"

다른 노트북에서 작업하던 Expo(React Native) 게임 앱 `Tilt`를 새 맥북(Apple Silicon, `darwin-arm64`)으로 옮겼습니다. `node_modules`는 용량이 크니까 빼고 복사한 다음, 새 맥에서 그냥 `pnpm install` 한 번 돌리면 끝일 줄 알았죠.

그런데 install이 이렇게 죽었습니다.

```
 ERR_PNPM_IGNORED_BUILDS  Ignored build scripts: esbuild@0.27.3.
```

그리고 프로세스가 **exit 1**. 더 황당했던 건, esbuild는 분명히 `onlyBuiltDependencies`에 들어 있었다는 겁니다. 빌드를 허용해 놨는데 "무시했다"며 0이 아닌 코드로 종료되니, 그 뒤 단계인 `expo run:android`의 의존성 체크 게이트까지 통째로 막혀버렸습니다.

이 글은 **Replit(linux-x64) 환경에 최적화된 pnpm 모노레포 설정을 다른 OS/아키텍처로 가져올 때 생기는 함정**과, 그걸 풀어낸 과정을 정리한 기록입니다. 개발을 다시 시작하면서 pnpm 모노레포를 처음 제대로 들여다본 입장에서, 같은 곳에서 막힐 분들을 위해 최대한 따라오기 쉽게 적었습니다.

> 이 글은 "왜 install이 죽었나"에 집중합니다. 같은 날 겪은 gradle 빌드와 안드로이드 서명 문제는 별도 글에서 다룹니다.

---

## 배경: pnpm의 빌드 스크립트 보안 정책

먼저 알아야 할 개념이 있습니다. npm 패키지는 설치될 때 `postinstall` 같은 **라이프사이클 스크립트**를 실행할 수 있습니다. esbuild처럼 네이티브 바이너리를 받아오는 패키지는 보통 이 스크립트로 바이너리를 내려받죠.

문제는 이게 공급망 공격(supply-chain attack)의 단골 통로라는 겁니다. 그래서 최신 pnpm은 **기본적으로 빌드 스크립트를 실행하지 않습니다.** 명시적으로 허용한 패키지만 돌립니다. 허용 방법은 두 갈래입니다.

| 키 | 위치 | 역할 |
| --- | --- | --- |
| `onlyBuiltDependencies` | `pnpm-workspace.yaml` | 빌드 스크립트 실행을 허용할 패키지 **목록** |
| `allowBuilds` | `pnpm-workspace.yaml` | 패키지별로 빌드 허용 여부를 `true`/`false`로 지정 |

`pnpm approve-builds` 명령으로 대화형으로 승인하면, 그 결과가 `allowBuilds`에 기록됩니다. 이 두 가지가 어떻게 충돌했는지가 이번 사건의 핵심이었습니다.

---

## 사전 준비

- Node.js + pnpm (저는 모노레포라 pnpm 사용)
- Apple Silicon 맥 (`darwin-arm64`)
- 기존에 다른 플랫폼에서 만들어진 `pnpm-workspace.yaml`을 그대로 가져온 상태

---

## Step 1. 에러 메시지를 곧이곧대로 믿지 않기

처음엔 `ERR_PNPM_IGNORED_BUILDS`만 보고 "esbuild를 허용 목록에 넣으면 되겠지" 했습니다. 그런데 열어보니 이미 들어 있었습니다.

```yaml
onlyBuiltDependencies:
  - '@swc/core'
  - esbuild        # ← 분명히 있다
  - msw
  - unrs-resolver
```

목록에 있는데도 "무시됨"이라는 건, **목록보다 더 강하게 빌드를 차단하는 다른 설정이 있다**는 신호였습니다. 여기서 파일 끝부분을 끝까지 읽어본 게 결정적이었습니다.

---

## Step 2. 진짜 범인 — 깨진 `allowBuilds` 플레이스홀더

`pnpm-workspace.yaml` 맨 아래에 이런 게 있었습니다.

```yaml
allowBuilds:
  esbuild: set this to true or false
```

`pnpm approve-builds`가 남긴 자리 표시(placeholder)였습니다. 누군가(혹은 도구가) `true`/`false`로 채워 넣으라고 만들어 둔 줄인데, 값이 그대로 `set this to true or false`라는 **문자열**로 남아 있었습니다.

pnpm 입장에서는 이게 `true`가 아니니 esbuild 빌드를 차단합니다. 그래서 `onlyBuiltDependencies`에 넣어둔 게 전혀 먹히지 않았던 거죠. 목록은 "후보"고, `allowBuilds`가 "최종 결정"인 셈입니다.

해결은 간단했습니다. 직접 손으로 고쳐도 되지만, 저는 pnpm이 직접 채우게 했습니다.

```bash
pnpm approve-builds --all
```

그 결과 줄이 이렇게 정정됐습니다.

```diff
-allowBuilds:
-  esbuild: set this to true or false
+allowBuilds:
+  esbuild: true
```

이걸 고치자 esbuild의 postinstall이 정상 실행되고, `pnpm install`이 드디어 **exit 0**으로 끝났습니다.

> **교훈:** `onlyBuiltDependencies`에 넣었는데도 "ignored builds"가 뜬다면, `allowBuilds`에 깨진 값이나 `false`가 박혀 있는지 파일 끝까지 확인하세요. 자동 생성된 플레이스홀더가 안 채워진 채 커밋된 경우가 의외로 많습니다.

---

## Step 3. 플랫폼별 네이티브 바이너리 override 풀기

빌드 차단 문제와 별개로, 이 설정 파일은 원래 **Replit(linux-x64) 전용**으로 최적화돼 있었습니다. esbuild·lightningcss·rollup 같은 패키지는 OS/아키텍처별로 바이너리 패키지가 갈라지는데, Replit에선 linux-x64만 필요하니 나머지를 전부 `overrides`로 쳐냈던 거죠.

```yaml
overrides:
  # replit uses linux-x64 only, we can exclude all other platforms
  "esbuild>@esbuild/darwin-arm64": "-"   # ← 맥에 필요한 바로 그 바이너리가 제외돼 있다
  "esbuild>@esbuild/darwin-x64": "-"
  "esbuild>@esbuild/linux-arm64": "-"
  ...
```

`"-"`는 "이 의존성을 설치하지 마라"는 의미입니다. 문제는 새 맥이 `darwin-arm64`라는 것. 정작 맥에 필요한 바이너리가 제외 목록에 들어 있으니, 운 좋게 install이 통과했어도 빌드 단계에서 바이너리를 못 찾고 터졌을 겁니다.

그래서 darwin-arm64 라인만 골라서 제외를 해제했습니다. 대상은 다음 5개 패키지였습니다.

| 패키지 | 푼 항목 |
| --- | --- |
| esbuild | `@esbuild/darwin-arm64` |
| lightningcss | `lightningcss-darwin-arm64` |
| @tailwindcss/oxide | `@tailwindcss/oxide-darwin-arm64` |
| rollup | `@rollup/rollup-darwin-arm64` |
| @expo/ngrok-bin | `@expo/ngrok-bin-darwin-arm64` |

diff로 보면 이렇게 한 줄씩 지우는 작업입니다.

```diff
   "esbuild>@esbuild/android-x64": '-'
   "lightningcss>lightningcss-android-arm64": "-"
-  "lightningcss>lightningcss-darwin-arm64": "-"
   "lightningcss>lightningcss-darwin-x64": "-"
...
-  "rollup>@rollup/rollup-darwin-arm64": "-"
   "rollup>@rollup/rollup-darwin-x64": "-"
...
-  "@expo/ngrok-bin>@expo/ngrok-bin-darwin-arm64": "-"
   "@expo/ngrok-bin>@expo/ngrok-bin-darwin-x64": "-"
```

darwin-x64(인텔 맥)나 win32, 다른 linux 라인은 그대로 뒀습니다. 지금 머신이 Apple Silicon 한 종류라 그것만 살리면 충분했고, 불필요한 바이너리까지 받아 용량을 키울 이유가 없었으니까요.

---

## 자주 쓰는 명령어 요약

| 상황 | 명령어 |
| --- | --- |
| 어떤 빌드가 무시됐는지 확인 | `pnpm install` 출력의 `Ignored build scripts:` 줄 |
| 빌드 스크립트 일괄 승인 | `pnpm approve-builds --all` |
| 특정 패키지만 승인 | `pnpm approve-builds`(대화형 선택) |
| 설치 후 결과 확인 | 종료 코드 0 여부(`echo $?`) |

기억할 흐름은 이렇습니다.

1. `onlyBuiltDependencies` = 빌드 허용 **후보 목록**
2. `allowBuilds` = 패키지별 **최종 on/off** (여기가 우선)
3. `overrides` + `"-"` = 특정 플랫폼 바이너리 **설치 제외**

---

## 트러블슈팅

**Q. `onlyBuiltDependencies`에 넣었는데도 계속 "Ignored build scripts"가 떠요.**
`allowBuilds`에 해당 패키지가 `false`거나, 자동 생성된 플레이스홀더 문자열이 안 채워진 채 남아 있을 가능성이 큽니다. 파일 끝까지 확인하고 `pnpm approve-builds --all`로 정정하세요.

**Q. install은 통과했는데 빌드/실행 단계에서 네이티브 바이너리를 못 찾아요.**
`overrides`에서 현재 플랫폼(`node -p "process.platform + '-' + process.arch"`로 확인) 바이너리가 `"-"`로 제외돼 있는지 보세요. Replit·CI 등 단일 플랫폼용으로 짠 설정을 그대로 가져오면 흔히 발생합니다.

**Q. 다른 플랫폼 바이너리까지 다 풀어줘야 하나요?**
아니요. 지금 쓰는 머신 아키텍처 한 종류만 풀면 됩니다. 여러 머신에서 공유할 거면 그 머신들 것만 추가로 풀어주세요.

---

## 정리: 한눈에 보는 흐름

처음엔 "esbuild 빌드 하나" 문제로 보였지만, 실제로는 **두 개의 독립적인 함정**이 겹쳐 있었습니다.

1. **빌드 스크립트 승인 충돌** — `onlyBuiltDependencies`에 있어도 `allowBuilds`의 깨진 플레이스홀더가 우선해 차단 → `approve-builds --all`로 `esbuild: true` 정정 → install이 exit 0.
2. **플랫폼별 바이너리 제외** — Replit(linux-x64) 전용 `overrides`가 darwin-arm64 바이너리까지 막아둠 → 맥에 필요한 5개 패키지의 darwin-arm64 라인 해제.

남길 한 줄: **특정 플랫폼(Replit, 특정 CI)에 최적화된 설정 파일을 다른 OS/아키텍처로 옮길 땐, 의존성 목록보다 "빌드 승인 상태"와 "플랫폼 override"를 먼저 의심하자.** 에러 메시지(`Ignored build scripts`)는 증상일 뿐, 진짜 스위치는 파일 맨 아래에 숨어 있을 때가 많습니다.
