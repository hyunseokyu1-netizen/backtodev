---
title: '블로그 발행을 자동화해보자 (11) 아침 9시에 아무 일도 일어나지 않았다 — 롤백의 후유증과 세션 연명 cron'
date: '2026-07-11'
publish_date: '2026-08-04'
description: 분명히 등록해둔 Vercel Cron이 조용히 안 돌았던 원인(rollback 후유증)과, 하루도 못 버티고 죽는 카카오 세션을 비밀번호 저장 없이 연명시키는 keep-alive cron 설계
tags:
  - Vercel
  - Cron
  - 세션관리
  - 트러블슈팅
  - 서버리스
---

전편들에서 매일 09:00에 자동 발행하는 Vercel Cron까지 완성했습니다. 그런데 어느 날 아침, 발행됐어야 할 글이 대시보드에 "초안완료" 상태로 그대로 남아 있었습니다. 에러도 없고, 실패 기록도 없고, 그냥 **아무 일도 일어나지 않았습니다.** 이번 편은 그 원인 두 가지 — 하나는 인프라, 하나는 세션 — 를 잡은 기록입니다.

## 단서가 없다는 게 단서였다

가장 먼저 로그를 확인했는데, 이상한 점이 있었습니다.

```bash
vercel logs <production-url> --since 6h --query "cron"
# → No logs found
```

cron이 실패한 로그가 있는 게 아니라, **cron 요청 자체가 단 한 줄도 없었습니다.** 여기서 두 가지 가능성이 갈립니다 — 요청이 왔는데 로그가 안 남았거나(참고로 Vercel Hobby 플랜은 런타임 로그 보존이 약 1시간이라, 몇 시간 전 일은 로그로 추적 자체가 안 됩니다), 아니면 요청이 아예 안 왔거나. 로그로는 판별이 불가능해서 프로젝트 설정을 API로 직접 조회했습니다.

```bash
curl -s "https://api.vercel.com/v10/projects/{PROJECT_ID}" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "..."
# crons.deploymentId: dpl_FqwU...  (7월 8일자 배포!)
# crons.host: dashboard-2egr82ajh-....vercel.app  (옛날 배포 호스트)
# production: dpl_FqwU...
```

**cron이 사흘 전 배포에 묶여 있었습니다.** 그 사이에 새 기능(멀티테넌트, 네이버 발행 등)을 담은 배포를 여러 번 했는데도요.

## 원인: `vercel rollback`은 프로덕션을 "고정"한다

며칠 전 긴급 상황에서 `vercel rollback`으로 이전 배포로 되돌린 적이 있었습니다(8편 참고). 그때는 몰랐는데, **rollback은 단순히 별칭을 되돌리는 게 아니라 프로덕션 타깃을 그 배포에 고정(pin)합니다.** 이후의 `vercel deploy --prod`는:

- 도메인 별칭은 새 배포로 갱신됨 → 사이트에 새 UI가 보임 → **정상처럼 보임**
- 하지만 프로덕션 타깃(과 거기 묶인 cron)은 롤백 시점 배포에 고정된 채 → **cron은 옛 코드를 향함**

그리고 그 옛 배포의 cron 코드는 이미 이관이 끝나 비어버린 옛 데이터 구조를 바라보고 있어서, 돌았어도 "발행할 게 없네" 하고 조용히 끝났을 상황이었습니다. 겉으로 보이는 사이트와 실제 cron이 서로 다른 코드를 돌고 있는, 꽤 악질적인 불일치입니다.

해결은 명시적 promote입니다.

```bash
vercel deploy --prod          # 새 배포 생성
vercel promote <새 배포 ID>   # 프로덕션 고정 해제 + cron 재바인딩
```

주의할 점: 이미 별칭이 가리키고 있는 배포를 promote하려고 하면 "already the current production deployment" 409 에러가 나면서도 cron 바인딩은 안 풀리는 어정쩡한 상태가 됩니다. **새 배포를 만들어서 그걸 promote**해야 확실히 풀립니다. promote 후 API로 `crons.deploymentId`가 최신 배포로 바뀐 걸 확인했고, 다음 배포부터는 자동으로 따라오는 것도 확인했습니다.

> **교훈**: rollback을 쓴 적이 있다면, 이후 배포에서 "사이트는 새 버전인데 cron은 옛 버전"일 수 있습니다. rollback 사용 후에는 반드시 promote로 정상 상태로 복귀시켜야 합니다.

## 두 번째 문제: 세션이 하루를 못 버틴다

cron 바인딩을 고치고 수동으로 돌려보니 이번엔 코드는 정상 실행됐는데 다른 에러가 나왔습니다.

```json
{"ok": false, "error": "티스토리 로그인 세션이 만료되었습니다..."}
```

로그인 세션(TSSESSION)이 또 죽어 있었습니다. 연동한 지 하루 만에요. 타임라인을 되짚어보니 패턴이 보였습니다:

- 마지막 발행(=세션 사용): 어제 11:31
- 오늘 발행 시도: 12:00쯤 → **약 24.5시간 무활동** → 만료

카카오 세션 쿠키는 절대 시간 만료가 아니라 **무활동 기준 약 24시간**으로 죽는 것으로 보였습니다. 원래 설계는 "매일 발행이 성공하면 그때 세션도 갱신된다"였는데, cron이 하루 안 돌자(위의 바인딩 버그) 갱신 기회가 빠졌고 → 세션 사망 → 다음날 발행도 실패, 라는 연쇄였던 겁니다. 하루만 삐끗해도 수동 재연동이 필요해지는 취약한 구조였죠.

## "그냥 비밀번호를 저장해둘까?"

이쯤 되면 자연스럽게 드는 생각입니다. 세션이 죽으면 저장해둔 비밀번호로 자동 재로그인하면 되지 않나? 결론부터 말하면 **안 하기로 했고, 도덕적 이유보다 실용적 이유가 큽니다.**

1. **저장해도 소용이 없습니다.** 자동 재로그인은 미국 데이터센터 IP(Vercel)에서 카카오 로그인을 시도하는 건데, 사람이 직접 할 때도 캡차(영수증 사진에서 숫자 읽기)가 뜨는 마당에 헤드리스 자동화가 통과할 리 없습니다. 최악엔 이상 로그인으로 계정 보호 조치가 걸립니다.
2. 상업화 서비스에서 "비밀번호를 절대 다루지 않는다"는 게 핵심 신뢰 포인트인데, 그 원칙을 깨는 인프라(저장·복호화 코드)를 만들어두는 것 자체가 리스크입니다.

## 해결: 세션 연명(keep-alive) cron

죽은 세션을 되살릴 수 없다면, **안 죽게 하면 됩니다.** 만료 조건이 "24시간 무활동"이니, 12시간마다 세션을 한 번씩 사용해주면 이론상 영원히 삽니다.

```typescript
// /api/cron/refresh-sessions — 매일 21:00 KST (발행 cron은 09:00)
for (const userId of await listUserIds()) {
  for (const platform of ['tistory', 'naver']) {
    const session = await getSession(userId, platform);
    if (!session?.cookies?.length) continue;

    const browser = await launchServerlessBrowser();
    const context = await browser.newContext({ storageState: session });
    const page = await context.newPage();
    await page.goto(PING_URLS[platform]);           // 로그인된 페이지 한 번 열기

    const alive = (await context.cookies())
      .some((c) => c.name === SESSION_COOKIES[platform]);
    if (alive) {
      await saveSession(userId, platform, await context.storageState()); // 갱신된 쿠키 저장
    }
    // 죽은 세션은 덮어쓰지 않는다 — 사용자 재연동 필요 상태를 유지
  }
}
```

여기서 플랜 제약이 하나 있었습니다. 원래는 6시간마다 돌리고 싶었는데, **Vercel Hobby 플랜의 cron은 잡당 하루 1회 트리거만 허용**됩니다. 그래서 발행 cron(09:00)과 갱신 cron(21:00)을 12시간 간격으로 배치해서, 하루 1회 제약 안에서 갱신 간격을 최대한 줄였습니다.

```json
{
  "crons": [
    { "path": "/api/cron/publish", "schedule": "0 0 * * *" },
    { "path": "/api/cron/refresh-sessions", "schedule": "0 12 * * *" }
  ]
}
```

배포 후 수동으로 트리거해서 실제 응답을 확인했습니다.

```json
{"refreshed": 2, "results": [
  {"platform": "tistory", "ok": true, "note": "refreshed"},
  {"platform": "naver",   "ok": true, "note": "refreshed"}
]}
```

## 정리

| 증상 | 진짜 원인 | 해결 |
|---|---|---|
| cron이 로그 한 줄 없이 안 돎 | rollback이 프로덕션을 옛 배포에 고정, cron도 같이 묶임 | 새 배포 + `vercel promote` |
| 세션이 하루 만에 사망 | 카카오 세션은 ~24h 무활동 시 만료, 갱신 기회가 발행 성공뿐 | 21:00 세션 연명 cron 추가 (갱신 간격 12h) |
| "비밀번호 저장하면 되잖아?" | 자동 재로그인은 캡차·이상탐지에 막혀 실효성 없음 | 세션을 안 죽게 하는 쪽으로 설계 |

이번 건에서 제일 기억에 남는 건 "로그가 없다"는 상태를 읽는 법입니다. 실패 로그는 원인을 알려주지만, **로그의 부재는 요청이 코드에 도달하기 전 단계(라우팅, 바인딩, 보호 설정)를 의심하라는 신호**였습니다. 로그를 아무리 뒤져도 안 나올 때는, 설정을 API로 직접 조회하는 게 훨씬 빨랐습니다.
