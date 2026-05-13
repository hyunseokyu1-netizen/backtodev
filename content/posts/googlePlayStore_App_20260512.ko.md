---
title: '구글 플레이스토어 앱 등록 A-Z — 스크린샷으로 전 과정 정리'
date: '2026-05-12'
description: 앱 생성부터 비공개 테스트 통과까지, 구글 플레이 콘솔의 전 과정을 스크린샷으로 정리한 실전 가이드
tags:
  - GooglePlay
  - Android
  - AppStore
  - 앱출시
---

구글 플레이스토어에 앱을 처음 등록해보면 콘솔 UI가 생각보다 복잡하다. 어디서 뭘 눌러야 하는지 헷갈리는 부분이 한두 군데가 아니다.

직접 등록하면서 캡처한 화면을 바탕으로 전 과정을 정리했다.

---

## 전체 흐름

```
구글 플레이 콘솔 가입 ($25)
  → 앱 만들기
  → 내부 테스트 (선택)
  → 비공개 테스트 (필수 — 12명 × 14일)
  → 할 일 목록 완료
  → 스토어 등록정보 설정
  → 검토 제출 → 승인 → 출시
```

**핵심 조건**: 현재 구글 정책상 **비공개 테스트 12명이 14일(2주) 이상 참여**해야 정식 출시가 가능하다.

---

## Step 1 — 앱 만들기

구글 플레이 콘솔에서 앱을 신규 생성한다.

![앱 만들기](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_30_56_1778551894292.png)
![앱 만들기 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_31_13_1778551926470.png)

입력 항목: 앱 이름, 패키지 이름, 기본 언어, 유료/무료 선택

![앱 정보 입력](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_34_24_1778551990911.png)
![앱 정보 입력 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_34_44_1778552005411.png)

패키지 이름 형식: `com.회사명.앱이름`

---

## Step 2 — 내부 테스트 (선택)

내부 테스트는 필수가 아니지만, **앱 설치 링크를 빠르게 만들어서 확인할 수 있다**는 장점이 있다. 비공개 테스트 승인을 기다리는 동안 직접 설치해서 검증하기 좋다.

### 테스터 등록 및 버전 생성

![내부 테스트](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_36_27_1778552076633.png)
![내부 테스트 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_36_43_1778553088756.png)

순서: 테스터 선택 → 새 버전 만들기 → 버전 미리보기 및 확인

![테스터 추가](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_04_1778553136935.png)

테스터 이메일 목록 추가:

![테스터 이메일](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_14_1778553180264.png)
![테스터 이메일 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_27_1778553225128.png)

### AAB 파일 업로드

![버전 만들기](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_38_04_1778553260112.png)
![버전 만들기 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_51_51_1778553288265.png)

App Bundle(`.aab`) 파일을 업로드한다.

![AAB 업로드](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_51_45_1778553317275.png)
![업로드 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_57_55_1778553383650.png)

### 출시 정보 작성

![출시 정보](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_58_10_1778553417638.png)

다국어 지원 시 언어 태그를 명시한다.
- 영어: `<en-US>`
- 한국어: `<ko-KR>`

경고 메시지는 무시해도 된다.

![경고 무시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_59_22_1778553629271.png)

저장 후 출시:

![저장 및 출시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_59_34_1778553601760.png)

### 출시 확인

![출시 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11______12_00_04_1778553865311.png)

**초록색 체크 표시**가 핵심이다. '검토 중'으로 보이면 구글 승인을 기다려야 한다. 승인이 완료돼야 테스터 초대 링크가 활성화된다.

![링크 활성화](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_47_24_1778554088406.png)

> 비공개 테스트 승인에 시간이 걸리므로, 내부 테스트 링크를 먼저 생성해서 설치를 확인해두는 것을 추천한다.

---

## Step 3 — 비공개 테스트 (필수)

정식 출시를 위한 필수 단계. **12명의 테스터가 14일 이상 참여**해야 한다.

### 트랙 만들기

![비공개 테스트](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_28_1778554207528.png)

구글 플레이 콘솔에서는 버전 단위를 '트랙'이라고 부른다. 알파/베타로 관리하거나, 헷갈리면 트랙1, 트랙2로 관리해도 무방하다.

> 비공개 테스트 중에도 주기적으로 트랙을 업데이트해야 한다. 업데이트가 없으면 리젝될 수 있다.

**진행 순서:** 트랙 생성 → 국가 선택 → 테스터 선택 → 새 버전 만들기 → 버전 미리보기 → Google에 버전 전송

![비공개 테스트 순서](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_41_1778554730753.png)

### 국가 선택

![국가 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_53_1778554859534.png)
![국가 선택 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_07_1778554879268.png)

특별히 제한할 이유가 없으면 전체 선택하면 된다.

![국가 전체 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_17_1778554905020.png)

> 각 페이지 완료 후 '게시 개요로 이동하시겠어요?' 팝업이 뜨는데, '개요로 이동'을 누르면 대시보드로 이동해서 작업 흐름이 끊긴다. **'나중에' 버튼을 누르고 뒤로 가기**로 이어서 작업하는 게 편하다.

### 테스터 설정 — Google Groups 활용 추천

![테스터 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_26_1778555110625.png)

이메일로 일일이 추가하면 내가 직접 승인해줘야 하고, 사용자도 기다려야 한다. **Google Groups를 사용하면** 사용자가 그룹에 직접 가입해서 바로 참여할 수 있다.

![테스터 이메일 방식](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_37_1778555142663.png)

---

## Step 4 — Google Groups 만들기

![Google Groups](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_48_13_1778555372662.png)

**개인정보 설정이 중요하다.** 설정이 너무 제한적이면 사람들이 가입을 포기한다.

![Google Groups 설정](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_49_20_1778555416592.png)

**권장 설정:**

| 항목 | 설정값 |
|------|--------|
| 그룹 검색 | 웹의 모든 사용자에게 공개 |
| 그룹 가입 | 누구나 가입할 수 있음 |
| 대화 열람 | 웹의 모든 사용자에게 공개 |
| 게시물 작성 | 그룹 멤버 |
| 회원 열람 | 그룹 관리자 |

![그룹 만들기 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_49_42_1778551636467.png)

![그룹 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_50_31_1778555679096.png)
![그룹 주소 복사](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_50_56_1778555700028.png)

그룹 정보에서 **그룹 주소 이메일(`이름@googlegroups.com`)을 복사**해 둔다.

---

## Step 5 — 테스터에 Google Groups 연결

![Google Groups 연결](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_51_19_1778555775154.png)

테스터 설정에서 Google Groups를 선택하고 복사해둔 그룹 이메일을 추가한다.

---

## Step 6 — 의견 URL / 이메일 등록

![의견 이메일](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_51_38_1778555814447.png)

앱 관련 이메일이 생각보다 자주 오므로 **스토어 전용 이메일 계정을 별도로 만들어 관리하는 것을 추천한다.**

---

## Step 7 — 할 일 목록 처리

대시보드의 '할 일 보기'를 펼쳐서 아래 항목을 하나씩 완료해야 한다.

![앱 설정 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_39_1778556008313.png)
![할 일 목록](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_53_1778556103595.png)

### 개인정보처리방침

![개인정보처리방침](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_02_56_1778556377545.png)

개인정보처리방침 URL이 반드시 필요하다. 별도 사이트를 만들거나, GitHub Pages로 웹 열람 가능한 페이지를 만들면 된다.

![개인정보처리방침 입력](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_01_21_1778556450713.png)
![나중에 버튼](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_03_05_1778556542324.png)

### 앱 액세스 권한

![앱 액세스](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_30_12_1778556687129.png)

### 광고

![광고](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_32_48_1778556787949.png)

### 콘텐츠 등급

설문지 형식으로 진행된다. **'예'로 답한 항목은 추가 질문이 많아진다.** 폭력성 관련 항목에 '예'를 선택하면 세부 질문이 대거 추가되므로, 해당 없는 항목은 '아니요'로 답하는 것이 편하다.

![콘텐츠 등급](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_33_43_1778556836906.png)
![설문지 카테고리](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_34_50_1778556911063.png)
![폭력성 선택 시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_36_12_1778556999923.png)
![추가 질문 예시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_16_1778557232488.png)
![추가 질문 예시 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_28_1778557248811.png)
![추가 질문 예시 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_39_1778557261422.png)
![추가 질문 예시 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_49_1778557273775.png)

'아니요'로만 답한 경우의 목록:

![아니요 목록](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_41_38_1778557343685.png)
![아니요 목록 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_42_09_1778557356630.png)
![아니요 목록 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_43_23_1778557438801.png)

> 설문 완료 후 **'저장' 버튼을 눌러야 '다음' 버튼이 활성화된다.** 자동으로 넘어가지 않으니 주의.

![저장 후 다음 활성화](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_45_41_1778564914759.png)

요약 확인:

![콘텐츠 등급 요약](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_49_03_1778565011095.png)

### 타겟층

![타겟층](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_50_27_1778565070916.png)
![타겟층 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_50_44_1778565092284.png)
![타겟층 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_51_46_1778565172139.png)
![타겟층 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_51_56_1778565239015.png)
![타겟층 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_52_09_1778565258642.png)
![타겟층 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_52_16_1778565274931.png)

### 데이터 보안

![데이터 보안](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_14_59_33_1778565615802.png)
![데이터 보안 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_14_59_48_1778565629331.png)
![데이터 보안 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_00_47_1778565697123.png)
![데이터 보안 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_22_05_1778566948272.png)

앱 대상 연령에 아동이 포함된 경우, 'Google Play 가족 정책 준수 여부'를 묻는 항목에서 **'예'를 선택**해야 다음 단계로 넘어갈 수 있다.

![데이터 보안 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_23_57_1778567066107.png)
![데이터 보안 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_01_12_1778565715512.png)

### 정부 앱

![정부 앱](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_26_29_1778567208159.png)

### 금융 기능

![금융 기능](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_27_12_1778567259406.png)
![금융 기능 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_27_27_1778567268841.png)

'앱에서 금융 기능을 제공하지 않음'을 선택해야 넘어갈 수 있다.

### 건강

![건강](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_29_10_1778567388656.png)
![건강 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_29_34_1778567402939.png)

---

## Step 8 — 앱 카테고리 및 연락처 세부정보

![앱 카테고리](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_30_32_1778567447349.png)
![앱 카테고리 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_31_11_1778567618242.png)
![앱 카테고리 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_32_10_1778567637309.png)
![앱 카테고리 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_32_20_1778567652196.png)
![앱 카테고리 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_34_29_1778567755539.png)
![앱 카테고리 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_35_26_1778567798505.png)

---

## Step 9 — 스토어 등록정보 설정

스토어에 표시될 설명과 이미지를 각 언어에 맞게 등록한다.

![스토어 등록정보](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_21_47_1778635429482.png)
![스토어 등록정보 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_23_1778635440147.png)
![스토어 등록정보 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_41_1778635454873.png)
![스토어 등록정보 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_49_1778635468031.png)
![스토어 등록정보 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_56_1778635478168.png)
![스토어 등록정보 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_23_06_1778635487330.png)

이미지 등록 시 **에셋으로 추가**해야 한다. 업로드 후 '파일 보내기 → 추가' 순서로 눌러야 실제 등록된다.

![이미지 등록](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_35_11_1778638764027.png)
![이미지 등록 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_35_29_1778638804657.png)

각 섹션마다 허용하는 이미지 사이즈가 다르다. 사이즈가 맞지 않으면 업로드 자체가 불가능하니, **항목별 요구 사이즈를 먼저 확인하고 이미지를 준비**하는 것이 좋다.

![이미지 사이즈 오류](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_22_03_1778639032518.png)

---

## Step 10 — 검토 제출 및 승인 대기

모든 항목 완료 후 검토를 제출하면 상태바가 '검토 중'으로 바뀐다.

![검토 전송](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_36_58_1778567894474.png)
![검토 중](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_52_55_1778640841863.png)
![검토 중 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_53_09_1778640870670.png)

### 문제 발견 시

구글에서 놓친 항목을 발견하면 어느 부분이 문제인지 알려준다. 안내에 따라 수정 후 다시 제출하면 된다.

![문제 발견](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_46_03_1778640429631.png)
![문제 발견 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_46_13_1778640456014.png)

### 승인 완료

전송 완료 후 '변경사항 검토 중'으로 표시된다.

![전송 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_55_53_1778641001907.png)
![비공개 테스트 검토 중](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_54_56_1778641050306.png)

**아이콘이 초록색 체크로 바뀌면** 테스터에게 링크 공유 및 설치가 가능해진다.

![승인 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_12_00_31_1778641319462.png)

---

## 전체 흐름 정리

```
1. 구글 플레이 콘솔 가입 ($25)
        ↓
2. 앱 만들기 (패키지명, 언어, 유무료)
        ↓
3. 내부 테스트 [선택] — 빠른 설치 링크 확보
        ↓
4. 비공개 테스트 [필수]
   - Google Groups로 테스터 모집
   - 12명 × 14일 충족
        ↓
5. 할 일 목록 완료
   개인정보처리방침 · 액세스권한 · 광고 · 콘텐츠등급
   타겟층 · 데이터보안 · 정부앱 · 금융기능 · 건강
        ↓
6. 앱 카테고리 + 스토어 등록정보 (설명·이미지)
        ↓
7. 검토 제출 → 문제 있으면 수정 후 재제출
        ↓
8. 초록색 체크 확인 → 테스터 링크 공유 가능
```

**핵심 팁 3가지:**

1. **내부 테스트를 먼저** — 비공개 테스트 승인 기다리는 동안 직접 설치해서 검증
2. **Google Groups 사용** — 이메일 수동 추가 대신 그룹 링크 하나로 테스터 모집
3. **'나중에' 버튼 애용** — 각 단계에서 '개요로 이동' 대신 '나중에'를 눌러야 작업 흐름이 끊기지 않음
