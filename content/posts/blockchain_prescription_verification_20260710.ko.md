---
title: 'AI 코딩 어시스턴트로 처방전 위변조 검증 블록체인 만들어보기 (스마트 계약부터 웹 UI까지)'
date: '2026-07-10'
description: Solidity 스마트 계약으로 처방전 해시를 온체인에 기록하고, 로컬 데모부터 Sepolia 테스트넷 배포, 웹 UI까지 하루 만에 붙여본 기록
tags:
  - Blockchain
  - Solidity
  - Hardhat
  - Ethereum
  - Claude Code
---

## 처방전이 위조되면 무슨 일이 생길까

병원에서 발급한 처방전을 약국에서 조제할 때, 지금은 대부분 "종이(또는 PDF)를 믿는" 구조다. 그런데 이 파일 한 글자만 바꿔서 약 수량을 부풀리거나, 이미 조제된 처방전을 다른 약국에서 한 번 더 쓰면 어떻게 될까? 종이 문서 시스템에서는 이걸 막을 방법이 마땅치 않다.

이럴 때 블록체인이 잘 맞는 이유는 딱 하나다 — **한 번 기록하면 조작이 불가능하고, 누가 언제 기록했는지가 투명하게 남는다.** 다만 여기서 바로 "그럼 처방전 내용을 블록체인에 올리면 되겠네?"라고 생각하면 곤란하다. 블록체인 기록은 삭제가 안 되는데, 환자 이름·질병 정보 같은 개인정보를 영구히 공개된 곳에 박제하는 건 개인정보보호법 위반이다.

그래서 답은 **"원본은 오프체인, 지문만 온체인"**이다. 이번에 실제로 이 구조를 스마트 계약으로 만들어보고, 로컬 테스트 → 테스트넷 배포 → 웹 UI까지 한 흐름으로 붙여봤다. Claude Code를 붙잡고 요구사항 문서 하나로 시작해서 하루 만에 여기까지 왔는데, 그 과정을 그대로 정리해본다.

## 핵심 아이디어부터 정리하고 가자

구현에 들어가기 전에, 왜 이 구조가 되는지부터 짚고 넘어가는 게 좋다.

- **원본 파일(Off-chain)**: 병원 DB나 환자 앱에 그대로 보관. 블록체인에는 안 올라간다.
- **SHA-256 해시(On-chain)**: 파일 내용을 64자리 문자열로 요약한 "지문"만 블록체인에 올린다.

파일이 한 글자라도 바뀌면 해시값이 완전히 달라진다. 그래서 "원본 파일의 해시"와 "블록체인에 기록된 해시"를 대조하는 것만으로 위변조 여부를 100% 판별할 수 있다. 반대로 해시값만 보고 원본 내용을 역으로 알아낼 수는 없으니 개인정보도 안전하다.

전체 흐름은 이렇게 된다.

```
[병원]  처방전 파일 생성 → SHA-256 해시 계산
   │
   ▼   registerDocument(문서ID, 해시)     ← 블록체인 기록 (가스 소모)
[블록체인]  해시 + 발행자 + 시각 + 상태(Issued) 저장
   │
[환자]  원본 파일을 약국에 제출
   │
   ▼   verifyDocument(문서ID, 직접 계산한 해시)  ← 조회 (무료)
[약국]  true → 원본 그대로 + 미사용 + 유효기간 이내
   │
   ▼   markAsUsed(문서ID)                 ← 블록체인 기록 (가스 소모)
[블록체인]  상태를 Used로 변경 → 재사용 차단
```

## 사전 준비

- Node.js 18 이상 (나는 v24로 진행)
- Hardhat — Solidity 컴파일·테스트·배포를 다 해주는 프레임워크
- OpenZeppelin Contracts — 권한 관리(AccessControl) 같은 검증된 부품을 가져다 쓰기 위해

```bash
mkdir document-verification-blockchain && cd document-verification-blockchain
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

## Step 1. 범용 코어 계약부터 설계한다

처음부터 "처방전 전용"으로 만들지 않고, **모든 종류의 문서에 재사용 가능한 베이스 계약**을 먼저 만들었다. 나중에 졸업증명서나 전자계약서로 확장할 걸 생각하면 이 편이 훨씬 이득이다.

```solidity
// contracts/UniversalRegistry.sol
enum DocumentStatus { NonExistent, Issued, Used, Revoked }

struct DocumentRecord {
    bytes32 documentHash; // 원본 파일의 SHA-256 해시
    address issuer;       // 발행자 주소
    uint256 timestamp;    // 발행 시각
    DocumentStatus status;
    string metadataURI;   // 부가 정보 링크 (선택)
}
```

핵심 함수는 세 개뿐이다.

- `registerDocument(docId, docHash, metadataURI)` — 문서를 등록하면 `Issued` 상태가 된다
- `updateStatus(docId, newStatus)` — 상태를 `Used`나 `Revoked`로 변경
- `verifyDocument(docId, actualHash)` — 해시가 일치하고 상태가 유효한지 확인 (`bool` 반환)

권한 관리는 OpenZeppelin의 `AccessControl`을 그대로 썼다. 직접 짜면 실수하기 쉬운 부분이라 검증된 라이브러리를 쓰는 게 맞다. 그리고 "누가 상태를 바꿀 수 있는지"는 `_authorizeStatusUpdate`라는 `virtual` 함수로 빼뒀다. 이렇게 해두면 하위 계약에서 이 함수만 오버라이드해서 도메인별 정책을 끼워 넣을 수 있다.

## Step 2. 처방전 특화 로직 얹기

`UniversalRegistry`를 상속받아 처방전에 맞는 규칙을 추가했다.

```solidity
// contracts/PrescriptionRegistry.sol
contract PrescriptionRegistry is UniversalRegistry {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");   // 병원
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE"); // 약국
    uint256 public validityPeriod = 7 days;

    function registerDocument(...) external override onlyRole(ISSUER_ROLE) {
        // 등록 시 만료 시각을 자동으로 계산해서 저장
    }

    function markAsUsed(bytes32 _docId) external onlyRole(VERIFIER_ROLE) {
        // 만료된 처방전은 여기서 revert
    }
}
```

추가된 규칙은 두 가지다.

1. **권한 분리**: 병원(`ISSUER_ROLE`)만 등록할 수 있고, 약국(`VERIFIER_ROLE`)만 "사용 완료" 처리를 할 수 있다.
2. **유효기간**: 발행 후 기본 7일이 지나면 `verifyDocument`가 자동으로 `false`를 반환한다. 만료된 처방전으로 조제하려는 시도도 막힌다.

## Step 3. 테스트로 시나리오를 증명한다

스마트 계약은 배포하고 나면 고치기가 까다롭기 때문에(불변성이 장점이자 단점) 테스트가 특히 중요하다. Hardhat + TypeScript로 아래 흐름을 전부 테스트했다.

```typescript
it("잘못된 해시값(위변조된 처방전)이면 false를 반환한다", async () => {
  const { registry, docId } = await registeredFixture();
  const tamperedHash = sha256Of("약 수량을 조작한 내용");
  expect(await registry.verifyDocument(docId, tamperedHash)).to.equal(false);
});
```

병원 계정으로 등록 성공, 권한 없는 계정의 등록 시도 revert, 약국의 사용 완료 처리, 올바른/잘못된 해시 검증, 그리고 `time.increase()`로 시간을 7일 뒤로 돌려서 만료 시나리오까지 — 총 **29개 테스트**가 전부 통과했다.

```bash
npm test
# 29 passing (1s)
```

## Step 4. 로컬에서 전체 흐름 체험하기

계약이 잘 짜였는지 확인하려면 실제로 돌려봐야 한다. Hardhat이 제공하는 로컬 블록체인 노드를 띄우고, 배포 스크립트와 데모 스크립트를 만들었다.

```bash
# 터미널 1 — 가짜 블록체인 노드 (테스트 계정 20개 자동 생성)
npx hardhat node

# 터미널 2 — 배포 후 데모
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/demo.ts --network localhost
```

데모 스크립트는 실제 파일을 만들어서 Node.js `crypto` 모듈로 해싱하는 것까지 포함한다. "원본은 오프체인, 해시만 온체인"이라는 구조를 코드로 그대로 재현한 것이다.

```
1️⃣ [병원] 처방전 발행 및 해시 등록 → ✅ Issued
2️⃣ [약국] 원본 파일 대조 검증 → ✅ true
3️⃣ [위조 시도] 약 수량 조작한 파일로 검증 → ❌ false (위조 적발)
4️⃣ [무권한 계정] 등록 시도 → ❌ revert
5️⃣ [약국] 사용 완료 처리 → 재검증 시 ❌ false (재사용 차단)
6️⃣ [만료] 7일 경과 시뮬레이션 → ❌ false
```

## Step 5. 진짜 블록체인(Sepolia 테스트넷)에 올려보기

로컬 데모는 내 컴퓨터에서만 도는 "가짜" 블록체인이다. 이번엔 전 세계 누구나 접근 가능한 이더리움 테스트넷(Sepolia)에 실제로 배포해봤다. 테스트용이라 가스비는 무료 테스트 ETH로 낸다.

**준비물은 세 가지.**

1. 지갑(개인키) — 테스트 전용으로 새로 하나 생성
2. 테스트 ETH — Faucet에서 무료로 받기 (Google Cloud Faucet, Chainlink Faucet 등)
3. RPC 주소 — 공개 RPC를 쓰면 API 키 없이도 바로 연결된다

Faucet은 캡차나 계정 인증을 요구해서 자동화가 안 되는 지점이다. 여기서만큼은 브라우저로 직접 받아야 한다. 테스트 ETH를 지갑에 입금한 뒤:

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

```
✅ PrescriptionRegistry 배포 완료: 0xF4d634D1E21c5682EB95727922077f9C048cc801
✅ ISSUER_ROLE(병원) 부여
✅ VERIFIER_ROLE(약국) 부여
🔍 Etherscan에서 확인: https://sepolia.etherscan.io/address/0xF4...
```

배포가 끝나면 [Sepolia Etherscan](https://sepolia.etherscan.io)에서 계약과 트랜잭션을 누구나 조회할 수 있다. 실제로 등록 → 검증 → 위조 적발 → 사용 처리까지 전부 실행해봤는데, 가스비는 총 0.0014 ETH 정도 들었다. 로컬 데모와 달리 이 기록은 **영구히 남는다**는 게 체감상 가장 크게 다가왔다.

> 💡 테스트넷이라도 기록은 지워지지 않는다. 실험할 땐 반드시 더미 데이터만 쓰자.

## Step 6. 웹 UI 붙이기

명령어로 계약을 호출하는 건 개발자에게나 편하지, 실제로 병원·약국 직원이 쓸 화면은 아니다. 그래서 간단한 웹 UI를 붙였는데, 여기서 신경 쓴 부분이 하나 있다.

**파일은 절대 서버로 올라가지 않는다.** 브라우저의 Web Crypto API로 해시를 계산해서, 해시값만 서버로 보낸다.

```javascript
// 브라우저에서 직접 SHA-256 계산
async function sha256OfFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return "0x" + [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

구조는 이렇다.

```
[브라우저]  파일 드래그&드롭 → SHA-256 해시 계산 (원본은 여기서 안 나감)
    ▼  해시 + 처방전 번호만 전송
[백엔드 (Express)]  기관 키로 서명해서 계약 호출
    ▼
[블록체인]  PrescriptionRegistry
```

화면은 세 개 탭으로 나눴다.

| 탭 | 역할 | 기능 |
|----|------|------|
| 🏥 병원 — 발행 | ISSUER | 처방전 번호 + 파일 → 해시 등록 |
| 💊 약국 — 검증 | VERIFIER | 파일 검증 → 사용 처리 |
| 🔍 상태 조회 | 누구나 | 번호만으로 온체인 상태 확인 |

약국 탭이 특히 신경 쓴 부분인데, 검증 실패 시 "그냥 false"가 아니라 **왜** 실패했는지(해시 불일치=위조, 만료, 이미 사용됨, 발행 취소)를 구분해서 보여주도록 백엔드에서 커스텀 에러를 파싱해 한국어 메시지로 바꿔줬다.

```bash
npm run web   # http://localhost:3900 접속
```

## 자주 쓰는 명령어 정리

| 명령어 | 설명 |
|--------|------|
| `npm test` | 전체 테스트 실행 |
| `npm run node` | 로컬 블록체인 노드 실행 |
| `npm run deploy` / `deploy:sepolia` | 로컬 / 테스트넷 배포 |
| `npm run demo` | 로컬 6단계 데모 시나리오 |
| `npm run interact:sepolia` | 테스트넷에서 등록→검증→사용 처리 |
| `npm run web` | 웹 UI 실행 |

## 트러블슈팅

**`ts-node`가 `fileExists` 오류를 내며 죽는다**
의존성을 설치하면 TypeScript 7이 딸려 오는데, `ts-node@10`과 궁합이 안 맞았다. `typescript@~5.8.3`으로 버전을 고정하니 해결됐다. Hardhat 생태계는 아직 TS 5 계열에 맞춰져 있는 듯하다.

**로컬 노드를 껐다 켜니 데모가 `DocumentAlreadyExists`로 실패한다**
로컬 노드는 재시작하면 블록체인 상태가 통째로 초기화된다. `deploy`부터 다시 실행해야 한다. 당연한 이야기인데 막상 겪으면 순간 당황한다.

**웹 서버 포트가 이미 쓰이고 있다**
로컬에 다른 프로젝트(Next.js 등)가 3000번을 쓰고 있는 경우가 많아서 기본 포트를 3900으로 옮겼다. 그래도 겹치면 `PORT=8080 npm run web`처럼 바꾸면 된다.

## 정리

하루 만에 요구사항 문서 → 스마트 계약 2개 → 테스트 29개 → 로컬 데모 → 테스트넷 실배포 → 웹 UI까지 이어봤다. 돌아보면 핵심은 결국 하나다.

> **개인정보는 오프체인에, 지문(해시)만 온체인에.**

이 원칙 하나만 지키면 나머지는 "누가 등록하고, 누가 검증하고, 언제 만료되는지"를 정하는 권한·상태 관리 문제로 바뀐다. 그리고 이 구조는 처방전에만 갇혀 있지 않다. `UniversalRegistry`의 두 함수(`_authorizeStatusUpdate`, `verifyDocument`)만 오버라이드하면 졸업증명서, 전자계약서, 공급망 정품 인증 같은 다른 도메인으로도 그대로 확장할 수 있다.

블록체인이라고 하면 막연히 거창하게 느껴지는데, 막상 붙여보니 "위변조를 막고 싶은 무언가가 있고, 그 원본을 함부로 공개하면 안 된다"는 조건만 있으면 꽤 실용적인 도구였다.
