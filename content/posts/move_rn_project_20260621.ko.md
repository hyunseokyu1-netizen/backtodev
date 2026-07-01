---
title: '새 컴퓨터로 React Native(Expo) 프로젝트 옮기기 — node_modules 빼고 복사한 뒤 환경 복원하기'
date: '2026-06-21'
publish_date: '2026-07-02'
description: node_modules 없이 옮긴 Expo 프로젝트를 npm ci로 복원하고 nvm 셸 로드 누락까지 잡아 정상 동작시키는 전 과정
tags:
  - React Native
  - Expo
  - npm
  - nvm
  - Node.js
---

## 왜 node_modules를 빼고 옮길까

새 컴퓨터로 작업 환경을 옮길 일이 생겼다. 작업하던 React Native(Expo) 프로젝트 폴더를 통째로 복사하면 되겠지 싶다가도, 막상 폴더를 열어보면 `node_modules` 하나가 수백 MB에서 1GB를 가뿐히 넘는다. 파일 개수도 수만 개라 복사 자체가 느리고, 중간에 멈추기도 한다.

그래서 보통은 **`node_modules`를 빼고 복사한다.** 어차피 이 폴더는 "복원 가능한 캐시"이기 때문이다. 진짜 중요한 건 어떤 패키지를 어떤 버전으로 쓰는지 적어둔 `package.json`과 `package-lock.json` 두 파일이다. 이 둘만 있으면 새 컴퓨터에서 똑같은 `node_modules`를 다시 만들어낼 수 있다.

나도 이번에 이전 컴퓨터에서 `node_modules`만 빼고 프로젝트를 복사해 왔다. 이 글은 그렇게 옮긴 프로젝트를 **실제로 돌아가는 상태까지 복원한 과정**을 그대로 정리한 것이다. 단순히 "npm install 하면 끝"이 아니라, 중간에 만난 nvm 함정과 복원이 잘 됐는지 검증하는 단계까지 다룬다.

> 📌 이 글은 **복원편(1편)**입니다. 의존성을 되살린 뒤 안드로이드 네이티브 빌드와 실기기 설치까지 이어지는 과정은 [2편 — 새 노트북으로 RN 프로젝트 빌드하기](/posts/rn_new_laptop_build_20260622)에서 다룹니다.

## 사전 점검: 지금 뭐가 있고 뭐가 없나

복원을 시작하기 전에 현재 상태부터 파악하는 게 좋다. 옮겨온 폴더에서 무엇이 빠졌는지 눈으로 확인하는 단계다.

```bash
ls -la
```

내 프로젝트는 이런 상태였다.

| 항목 | 상태 | 의미 |
|---|---|---|
| `package.json` | 있음 | 의존성 목록 — 복원의 핵심 |
| `package-lock.json` | 있음 | 잠긴 버전 정보 — 똑같이 재현 가능 |
| `android/` | 있음 | 네이티브 프로젝트 폴더 그대로 복사됨 |
| `src/`, `App.tsx` | 있음 | 소스 코드 그대로 |
| `node_modules/` | **없음** | 복원 대상 |

핵심은 `package-lock.json`이 함께 왔다는 점이다. 이게 있으면 단순히 "비슷한 버전"이 아니라 **이전 컴퓨터와 완전히 동일한 버전**으로 복원할 수 있다. 뒤에서 `npm install`이 아니라 `npm ci`를 쓰는 이유가 바로 이것이다.

## Step 1. Node가 실제로 잡히는지 확인하기 (첫 번째 함정)

의존성을 깔려면 당연히 Node.js가 있어야 한다. 그래서 버전부터 찍어봤는데:

```bash
node -v
# zsh: command not found: node
```

`command not found`. 새 컴퓨터라 Node가 아예 없나 싶었지만, 사실은 **nvm은 설치돼 있는데 셸이 그걸 로드하지 않은 상태**였다.

> **nvm(Node Version Manager)** 은 Node.js 버전을 여러 개 깔아두고 골라 쓰게 해주는 도구다. 그런데 nvm은 터미널을 켤 때 `~/.zshrc` 같은 셸 설정 파일에서 한 번 "로드"되어야 `node` 명령이 활성화된다. 이 로드 구문이 빠져 있으면, nvm으로 Node를 깔아놨어도 `node`를 못 찾는다.

nvm에 어떤 Node가 깔려 있는지부터 확인했다.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"   # nvm 수동 로드
nvm ls
```

`v24.17.0`이 잘 깔려 있었다. 즉 Node가 없는 게 아니라, **셸이 nvm을 자동으로 불러오지 않는 것**이 문제였다. 이건 Step 4에서 영구적으로 해결한다. 일단 지금은 위처럼 수동으로 로드해두면 같은 터미널 안에서는 `node`, `npm`, `npx`가 모두 동작한다.

## Step 2. npm ci로 의존성 복원하기

이제 핵심이다. `node_modules`를 되살린다.

```bash
npm ci
```

`npm install`이 아니라 `npm ci`를 쓴 이유:

| | `npm install` | `npm ci` |
|---|---|---|
| 기준 파일 | `package.json` | `package-lock.json` |
| 버전 | 범위 내 최신으로 갱신될 수 있음 | 잠긴 버전 그대로 |
| 기존 node_modules | 부분 갱신 | 통째로 지우고 새로 설치 |
| 재현성 | 상대적으로 낮음 | **완전히 동일하게 재현** |

옮겨온 프로젝트를 복원할 때는 "이전 컴퓨터와 똑같은 상태"가 목표이므로 `npm ci`가 정답이다. `lock` 파일을 그대로 따르기 때문에 의도치 않은 버전 업으로 인한 미묘한 오류를 막아준다.

결과는 이랬다.

```
added 634 packages, and audited 635 packages in 29s
```

30초 만에 634개 패키지가 복원됐다. 중간에 `npm warn deprecated ...`나 `N vulnerabilities` 같은 경고가 잔뜩 뜰 수 있는데, 이건 라이브러리 생태계에 흔한 노이즈다. **복원 단계에서는 일단 무시해도 된다.** 옮겨오기 전에도 잘 돌아가던 프로젝트라면, 이 경고들은 새로 생긴 문제가 아니라 원래 있던 것이다.

## Step 3. 복원이 제대로 됐는지 검증하기

`npm ci`가 에러 없이 끝났다고 끝이 아니다. 패키지가 다 깔렸어도 정작 코드가 컴파일되는지는 별개 문제다. 두 가지를 확인했다.

### 3-1. TypeScript 타입체크

```bash
npx tsc --noEmit
```

`--noEmit`은 "실제 결과물(JS 파일)은 만들지 말고 타입 검사만 하라"는 옵션이다. 아무것도 출력되지 않으면 타입 에러가 없다는 뜻. 내 경우 깔끔하게 통과했다. 이게 통과하면 적어도 "타입 정의 패키지가 제대로 복원됐고, 소스 코드와 버전이 맞물린다"는 걸 보장받는다.

### 3-2. Expo 의존성 정합성 검사

Expo 프로젝트라면 한 단계 더 있다. Expo는 SDK 버전마다 "이 패키지는 이 버전을 써야 궁합이 맞는다"는 권장 버전이 정해져 있다.

```bash
npx expo install --check
```

결과:

```
The following packages should be updated for best compatibility:
  expo@54.0.34 - expected version: ~54.0.35
  expo-localization@17.0.8 - expected version: ~17.0.9
```

패치 버전이 살짝 어긋난다고 알려준다. 이 정도 차이는 실사용에 지장이 거의 없지만, 깔끔하게 맞추고 싶다면 아래처럼 Expo가 권장하는 버전으로 정렬하면 된다.

```bash
npx expo install expo expo-localization
```

> **팁:** Expo 프로젝트에서 패키지를 추가할 때는 `npm install` 대신 `npx expo install`을 쓰는 습관을 들이면 좋다. 현재 SDK와 호환되는 버전을 알아서 골라주기 때문이다.

## Step 4. nvm 자동 로드를 영구적으로 고치기

Step 1에서 만난 "node를 못 찾는" 문제로 돌아가자. 매 터미널마다 nvm을 수동 로드하는 건 번거롭다. `~/.zshrc`에 아래 두 줄이 있는지 확인하고, 없으면 추가한다.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

추가했다면 설정을 다시 불러온다.

```bash
source ~/.zshrc
node -v   # 이제 v24.17.0 이 바로 뜬다
```

이렇게 해두면 새 터미널을 열어도 `node`, `npm`, `npx`, `npx expo start`가 곧바로 동작한다. 새 컴퓨터 세팅 직후에 흔히 놓치는 부분이라 짚어둘 가치가 있다.

## 자주 쓰는 복원 명령어 요약

```bash
# 0) (새 컴퓨터라면) nvm 로드 확인
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
node -v

# 1) lock 파일 기준으로 의존성 통째 복원
npm ci

# 2) 타입체크로 코드 정합성 검증
npx tsc --noEmit

# 3) (Expo) SDK 호환 버전 점검 / 정렬
npx expo install --check
npx expo install <패키지명>
```

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `node: command not found` | nvm이 셸에 로드 안 됨 | `~/.zshrc`에 nvm 로드 구문 추가 후 `source ~/.zshrc` |
| `npm ci`가 lock 파일 없다고 실패 | `package-lock.json` 누락 | 어쩔 수 없이 `npm install` 사용 (단, 버전이 갱신될 수 있음) |
| `npm ci` 중 버전 불일치 에러 | `package.json`과 lock 파일이 어긋남 | 둘을 맞추거나 `npm install`로 lock 재생성 |
| deprecated / vulnerabilities 경고 | 생태계 노이즈 | 복원 단계에서는 무시. 동작과 무관 |
| Expo 패키지 버전 경고 | SDK 권장 버전과 미세 차이 | `npx expo install <패키지>`로 정렬 |

## 정리 — 한눈에 보는 복원 흐름

새 컴퓨터로 `node_modules` 없이 옮긴 React Native(Expo) 프로젝트를 되살리는 흐름은 이렇게 요약된다.

1. **현황 점검** — `package.json`과 `package-lock.json`이 함께 왔는지 확인 (이 둘이 복원의 전제)
2. **Node 확인** — `node -v`가 안 되면 nvm 로드 문제부터 의심
3. **`npm ci`** — lock 파일 기준으로 이전 환경과 동일하게 의존성 복원
4. **검증** — `npx tsc --noEmit`로 타입, `npx expo install --check`로 SDK 호환성 확인
5. **마무리** — `~/.zshrc`에 nvm 로드 구문을 넣어 터미널 환경을 영구적으로 정상화

핵심은 **`node_modules`는 짐이 아니라 캐시**라는 관점이다. 무겁게 들고 다닐 필요 없이, `lock` 파일만 잘 챙기면 어느 컴퓨터에서든 30초면 똑같은 환경을 복원할 수 있다. 옮긴 직후엔 설치만 하고 끝내기 쉬운데, 타입체크 한 번, 호환성 점검 한 번을 더해주면 "분명 깔았는데 실행하니 안 된다"는 흔한 함정을 미리 걷어낼 수 있다.
