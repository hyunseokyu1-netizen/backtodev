---
title: '구글 플레이 콘솔 — 비공개 테스트 후 프로덕션 등록하기'
date: '2026-05-27'
description: 비공개 테스트 14일 완료 후 프로덕션 액세스 신청까지 채워야 하는 항목과 실제 답변 정리
tags:
  - Google Play Console
  - 앱 출시
  - 비공개 테스트
---

## 드디어 14일이 지났다

비공개 테스트를 시작하고 14일이 지나면, 플레이 콘솔에 **프로덕션 신청 버튼**이 생긴다.

![프로덕션 신청 버튼](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_41_05_1779860095792.png)

클릭하면 몇 가지 질문에 답해야 한다. 각 항목별로 어떤 질문이 나오는지, 내가 어떻게 답했는지 정리해봤다.

---

## Step 1. 비공개 테스트 정보 입력

### 테스터 모집 방법

![테스터 모집 질문](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_41_21_1779860095793.png)

- 비공개 테스트에 참여할 사용자를 어떻게 모집했나요?
- 테스터를 얼마나 쉽게 모집했나요?

**내 답변:**

```
여러 커뮤니티에 홍보 글을 등록해서 테스터 참여를 요청했다.
```

**AI 추천 답변:**

> 모바일 앱·개발 커뮤니티 그룹에 홍보 게시글을 등록하여 비공개 테스트 참여를 요청했습니다.
> 게시글에 앱의 주요 기능, 테스트 참여 방법, 피드백 제공 방식, 테스트 기간을 안내했습니다.
> 댓글로 질문을 받고, 관심 있는 사용자에게 직접 테스트 링크를 공유했습니다.
> 유료 테스트 제공업체는 이용하지 않았습니다.

---

### 테스터 참여도 및 피드백

![테스터 참여도 질문](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_41_43_1779860162822.png)

- 테스트 중 테스터의 참여도를 설명해 주세요.
- 테스터 의견을 요약하고, 수집 방법도 알려주세요.

**내 답변:**

![내 답변 1](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_45_43_1779860162823.png)
![내 답변 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_45_53_1779860162824.png)

```
- 테스터들이 모든 기능을 활용했고, 피드백을 받아 업데이트 함.
- 이메일 및 메신저로 의견을 수집.
- 게임 설명이 없어서 어렵다는 의견 → Help 페이지 추가.
- 박스가 작아서 잘 안보인다는 의견 → 박스 사이즈 키움.
```

**AI 추천 답변:**

> 테스터들은 체인 생성·이름 변경·삭제, 플레이리스트 분류·관리 등 주요 기능을 꼼꼼히 사용했고, 기능별 개선 사항을 피드백으로 제공했습니다.
>
> 주요 피드백:
> - 다국어 지원 필요 (해외 사용자 고려)
> - 체인 단위 분류·관리 기능 요청
>
> 의견 수집 방법: 커뮤니티 게시글 댓글, 이메일, 구글 설문지.
> 수집한 의견을 정리해 다국어 지원과 체인 관리 기능을 우선순위로 반영했습니다.

---

## Step 2. 앱 정보 입력

![앱 정보 질문 1](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_46_08_1779860162825.png)
![앱 정보 질문 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_46_16_1779860162826.png)

> 게임으로 분류된 앱은 "게임 정보 페이지", 일반 앱은 다른 질문이 나온다.
> 아래는 ChainPlay (일반 앱) 기준 화면.

![ChainPlay 앱 질문](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-28_14_52_37_1779947591770.png)

- 앱의 주요 대상은 누구인가요?
- 앱을 돋보이게 하는 요소는 무엇인가요?
- 첫 해 예상 설치 수는?

**내 답변:**

![내 답변](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_51_58_1779860162827.png)
![내 답변 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_10_52_08_1779860162828.png)
![내 답변 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_11_03_28_1779860162829.png)

> 주요 대상: 전 연령 (연령, 성별 상관없이 리스트를 정리하고 싶은 모든 사용자)
>
> 차별점: 사용자가 원하는 대로 플레이리스트를 자유롭게 만들고, 체인 단위로 분류·관리 가능.

---

## Step 3. 프로덕션 준비 확인

![프로덕션 준비 질문](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_11_03_49_1779860162830.png)

- 비공개 테스트에서 알게 된 내용을 바탕으로 앱을 어떻게 변경했나요?
- 프로덕션 배포 준비가 됐다고 어떻게 판단했나요?

**내 답변:**

![내 답변](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_11_08_43_1779860162831.png)

> 핵심 기능 (다국어 지원, 체인 관리)이 안정적으로 동작함을 확인했고, 주요 오류나 진행 불가 문제는 발견되지 않았습니다.
> 테스터 피드백을 반영해 기능과 UI/UX를 개선한 뒤, 실제 사용 환경에서도 원활하게 작동하는 것을 검증했습니다.

---

## 신청 완료

모든 항목 입력 후 제출하면 아래 화면이 나온다.

![신청 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-27_11_09_04_1779860162832.png)

접수 완료. 이제 구글 심사 기다리는 일만 남았다.

---

## 업데이트 (5월 28일) — 하루 만에 승인 완료

신청 다음 날 바로 승인이 났다. 승인 완료되면 이렇게 메일이 온다.

![스크린샷 2026-05-28 11.30.39](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-28_11_30_39_1779935559909.png)

대시보드 화면:

![스크린샷 2026-05-28 10.23.28](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-28_10_23_28_1779935559906.png)
![스크린샷 2026-05-28 08.47.13](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-28_08_47_13_1779935559904.png)

승인 후 남은 할 일 목록:

![스크린샷 2026-05-28 08.47.26](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-28_08_47_26_1779935559905.png)

- 국가 및 지역 선택
- 새 버전 만들기
- 버전 미리보기 및 확인
- 검토를 위해 Google에 버전 전송
- Google Play에 앱 게시

검토 내역을 구글에 전송:

![스크린샷 2026-05-28 10.29.44](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-28_10_29_44_1779935559907.png)
![스크린샷 2026-05-28 10.30.35](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-28_10_30_35_1779935559908.png)

여기까지 하면 프로덕션 등록의 전체 과정이 끝난다.
