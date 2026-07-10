---
title: 'Building a Prescription Fraud-Verification Blockchain With an AI Coding Assistant (From Smart Contract to Web UI)'
date: '2026-07-10'
description: A record of recording prescription hashes on-chain with a Solidity smart contract, going from a local demo to a Sepolia testnet deployment and a web UI, all in one day
tags:
  - Blockchain
  - Solidity
  - Hardhat
  - Ethereum
  - Claude Code
---

## What happens if a prescription gets forged

When a pharmacy fills a prescription issued by a hospital, the system today mostly runs on "trusting the paper (or PDF)." But what if someone changes just one character in that file to inflate a medication quantity, or reuses an already-filled prescription at a different pharmacy? A paper-document system has no good way to stop this.

Blockchain fits this problem for exactly one reason — **once recorded, it can't be tampered with, and who recorded what and when stays transparently visible.** But it'd be a mistake to immediately think "so let's just put the prescription content on the blockchain." Blockchain records can't be deleted, and permanently pinning personal information like a patient's name or medical condition to a permanently public location violates privacy law.

So the answer is **"the original stays off-chain, only the fingerprint goes on-chain."** This time, I actually built this structure as a smart contract and connected the whole flow — local testing → testnet deployment → web UI. I started with just a requirements doc and Claude Code, and got here in a single day. Here's that process, written up as-is.

## Let's nail down the core idea first

Before diving into implementation, it's worth covering why this structure works.

- **Original file (off-chain)**: stored as-is in the hospital's DB or the patient's app. Never goes on the blockchain.
- **SHA-256 hash (on-chain)**: only the "fingerprint" — a 64-character string summarizing the file's content — goes on the blockchain.

Change even a single character in the file, and the hash value comes out completely different. So simply comparing "the original file's hash" against "the hash recorded on the blockchain" lets you determine tampering with 100% certainty. Conversely, you can't work backward from a hash value to the original content, so personal information stays safe too.

The overall flow looks like this.

```
[Hospital]  creates the prescription file → computes SHA-256 hash
   │
   ▼   registerDocument(docId, hash)     ← blockchain write (costs gas)
[Blockchain]  stores hash + issuer + timestamp + status (Issued)
   │
[Patient]  submits the original file to the pharmacy
   │
   ▼   verifyDocument(docId, locally computed hash)  ← query (free)
[Pharmacy]  true → original intact + unused + within validity period
   │
   ▼   markAsUsed(docId)                 ← blockchain write (costs gas)
[Blockchain]  status changes to Used → blocks reuse
```

## Prerequisites

- Node.js 18 or later (I used v24)
- Hardhat — a framework that handles Solidity compilation, testing, and deployment
- OpenZeppelin Contracts — for pulling in verified building blocks like access control (AccessControl)

```bash
mkdir document-verification-blockchain && cd document-verification-blockchain
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

## Step 1. Design the generic core contract first

Instead of building this "prescription-specific" from the start, I first built a **base contract reusable for any kind of document.** Given the future possibility of extending this to diplomas or electronic contracts, this approach pays off far more.

```solidity
// contracts/UniversalRegistry.sol
enum DocumentStatus { NonExistent, Issued, Used, Revoked }

struct DocumentRecord {
    bytes32 documentHash; // SHA-256 hash of the original file
    address issuer;       // issuer's address
    uint256 timestamp;    // issuance time
    DocumentStatus status;
    string metadataURI;   // link to additional info (optional)
}
```

There are only three core functions.

- `registerDocument(docId, docHash, metadataURI)` — registering a document sets it to `Issued` status
- `updateStatus(docId, newStatus)` — changes the status to `Used` or `Revoked`
- `verifyDocument(docId, actualHash)` — confirms the hash matches and the status is valid (returns `bool`)

For access control, I used OpenZeppelin's `AccessControl` as-is. This is an area easy to get wrong writing it yourself, so using a verified library is the right call. And "who can change the status" is pulled out into a `virtual` function called `_authorizeStatusUpdate`. This way, a subclass contract can override just this function to plug in domain-specific policy.

## Step 2. Layer on prescription-specific logic

I inherited from `UniversalRegistry` and added rules appropriate for prescriptions.

```solidity
// contracts/PrescriptionRegistry.sol
contract PrescriptionRegistry is UniversalRegistry {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");   // hospital
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE"); // pharmacy
    uint256 public validityPeriod = 7 days;

    function registerDocument(...) external override onlyRole(ISSUER_ROLE) {
        // automatically computes and stores the expiration time on registration
    }

    function markAsUsed(bytes32 _docId) external onlyRole(VERIFIER_ROLE) {
        // reverts here if the prescription has expired
    }
}
```

Two rules were added.

1. **Separation of authority**: only a hospital (`ISSUER_ROLE`) can register, and only a pharmacy (`VERIFIER_ROLE`) can mark it as "used."
2. **Validity period**: once 7 days (the default) have passed since issuance, `verifyDocument` automatically returns `false`. This also blocks any attempt to fill an expired prescription.

## Step 3. Prove the scenarios with tests

Smart contracts are notoriously tricky to fix once deployed (immutability is both a strength and a weakness), which makes testing especially important. I tested the following flow entirely with Hardhat + TypeScript.

```typescript
it("returns false for an incorrect hash (a tampered prescription)", async () => {
  const { registry, docId } = await registeredFixture();
  const tamperedHash = sha256Of("content with an altered medication quantity");
  expect(await registry.verifyDocument(docId, tamperedHash)).to.equal(false);
});
```

Successful registration from a hospital account, a revert when an unauthorized account attempts registration, a pharmacy marking something as used, verification with correct/incorrect hashes, and even an expiration scenario by rolling time forward 7 days with `time.increase()` — a total of **29 tests**, all passing.

```bash
npm test
# 29 passing (1s)
```

## Step 4. Experience the full flow locally

To confirm the contract is well-built, you have to actually run it. I spun up Hardhat's local blockchain node and wrote a deployment script plus a demo script.

```bash
# Terminal 1 — a fake blockchain node (auto-generates 20 test accounts)
npx hardhat node

# Terminal 2 — deploy, then demo
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/demo.ts --network localhost
```

The demo script even creates an actual file and hashes it using Node.js's `crypto` module. It reproduces the "original stays off-chain, only the hash goes on-chain" structure exactly in code.

```
1️⃣ [Hospital] Issue a prescription and register the hash → ✅ Issued
2️⃣ [Pharmacy] Verify against the original file → ✅ true
3️⃣ [Forgery attempt] Verify with a file with an altered quantity → ❌ false (forgery caught)
4️⃣ [Unauthorized account] Attempt to register → ❌ revert
5️⃣ [Pharmacy] Mark as used → re-verification returns ❌ false (reuse blocked)
6️⃣ [Expiration] Simulate 7 days elapsed → ❌ false
```

## Step 5. Deploying to a real blockchain (the Sepolia testnet)

The local demo is a "fake" blockchain that only runs on my computer. This time, I actually deployed it to Ethereum's testnet (Sepolia), accessible by anyone in the world. Since it's for testing, gas fees are paid with free test ETH.

**Three things needed.**

1. A wallet (private key) — generated fresh, for testing only
2. Test ETH — obtained free from a faucet (Google Cloud Faucet, Chainlink Faucet, etc.)
3. An RPC address — using a public RPC connects immediately with no API key needed

The faucet is the point where automation breaks down, requiring a captcha or account verification. This one step has to be done manually in a browser. After depositing test ETH into the wallet:

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

```
✅ PrescriptionRegistry deployed: 0xF4d634D1E21c5682EB95727922077f9C048cc801
✅ ISSUER_ROLE (hospital) granted
✅ VERIFIER_ROLE (pharmacy) granted
🔍 Check on Etherscan: https://sepolia.etherscan.io/address/0xF4...
```

Once deployed, anyone can inspect the contract and transactions on [Sepolia Etherscan](https://sepolia.etherscan.io). I actually ran through registration → verification → forgery detection → marking as used, and the total gas cost came out to about 0.0014 ETH. Unlike the local demo, the thing that struck me most was that this record **stays permanently.**

> 💡 Even on a testnet, records don't get erased. When experimenting, always use dummy data only.

## Step 6. Attaching a web UI

Calling a contract via command is convenient for a developer, but it's not something hospital or pharmacy staff would actually use. So I attached a simple web UI, with one thing I paid particular attention to.

**The file is never uploaded to a server.** The hash gets computed via the browser's Web Crypto API, and only the hash value gets sent to the server.

```javascript
// Compute SHA-256 directly in the browser
async function sha256OfFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return "0x" + [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

The structure looks like this.

```
[Browser]  drag & drop a file → compute the SHA-256 hash (the original never leaves here)
    ▼  send only the hash + prescription number
[Backend (Express)]  signs with the institution's key and calls the contract
    ▼
[Blockchain]  PrescriptionRegistry
```

I split the screen into three tabs.

| Tab | Role | Function |
|----|------|------|
| 🏥 Hospital — Issue | ISSUER | prescription number + file → register hash |
| 💊 Pharmacy — Verify | VERIFIER | verify file → mark as used |
| 🔍 Status Lookup | Anyone | check on-chain status by number alone |

The pharmacy tab is the part I paid the most attention to — instead of just showing "false" on a verification failure, I had the backend parse the custom errors and turn them into clear messages distinguishing **why** it failed (hash mismatch = forgery, expired, already used, revoked).

```bash
npm run web   # visit http://localhost:3900
```

## Frequently used commands

| Command | Description |
|--------|------|
| `npm test` | run the full test suite |
| `npm run node` | run the local blockchain node |
| `npm run deploy` / `deploy:sepolia` | deploy locally / to the testnet |
| `npm run demo` | run the local 6-step demo scenario |
| `npm run interact:sepolia` | register → verify → mark as used on the testnet |
| `npm run web` | run the web UI |

## Troubleshooting

**`ts-node` dies with a `fileExists` error**
Installing dependencies pulls in TypeScript 7, which doesn't play well with `ts-node@10`. Pinning to `typescript@~5.8.3` fixed it. The Hardhat ecosystem still seems geared toward the TS 5.x line.

**Restarting the local node makes the demo fail with `DocumentAlreadyExists`**
Restarting the local node wipes the blockchain state entirely. You need to run `deploy` again from scratch. Obvious in hindsight, but it catches you off guard the moment it happens.

**The web server port is already in use**
Since another local project (Next.js, etc.) is often using port 3000, I moved the default port to 3900. If it still collides, just change it, like `PORT=8080 npm run web`.

## Summary

In a single day, I went from a requirements doc → 2 smart contracts → 29 tests → a local demo → an actual testnet deployment → a web UI. Looking back, it all comes down to one thing.

> **Personal information stays off-chain; only the fingerprint (hash) goes on-chain.**

Stick to just this one principle, and everything else turns into an access-control and status-management problem — deciding "who registers, who verifies, when it expires." And this structure isn't locked to prescriptions alone. Override just two functions in `UniversalRegistry` (`_authorizeStatusUpdate`, `verifyDocument`), and it extends just as well to other domains — diplomas, electronic contracts, supply-chain authenticity verification.

Blockchain tends to feel vaguely grandiose as a concept, but actually building with it, it turned out to be a pretty practical tool — as long as you have "something you want to protect from tampering, whose original shouldn't be carelessly exposed."
