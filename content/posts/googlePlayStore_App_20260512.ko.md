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
  → 프로덕션 출시
```

**핵심 조건**: 현재 구글 정책상 **비공개 테스트 12명이 14일(2주) 이상 참여**해야 정식 출시가 가능하다. 이 기간을 건너뛸 수 없으니 미리 테스터를 확보해두는 게 중요하다.

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

업로드 완료 시 버전 정보가 자동으로 표시된다.

### 출시 정보 작성

![출시 정보](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_58_10_1778553417638.png)

다국어를 지원할 경우 언어 태그를 명시한다.
- 영어: `<en-US>`
- 한국어: `<ko-KR>`

경고 메시지는 무시해도 된다.

![경고 무시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_59_22_1778553629271.png)

저장 후 출시:

![저장 및 출시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_59_34_1778553601760.png)

### 출시 확인

![출시 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11______12_00_04_1778553865311.png)

12.  개인정보처리방침
![스크린샷 2026-05-12 오전 11.02.56](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_02_56_1778556377545.png)

- 개인정보처리방침이 꼭 필요하므로 사이트를 만들던지 ,아니면 github를 이용해서 웹에서 볼수있게 만들어야 한다.
![스크린샷 2026-05-12 오전 11.01.21](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_01_21_1778556450713.png)

- 작업 끝날때마다 개요로 이동 버튼 누르면, 계속 대시보드에서 다시 열어줘야하는 불편함이 있으므로, '나중에'버튼을 눌러서 뒤로가기 버튼을 활용한다. 
![스크린샷 2026-05-12 오전 11.03.05](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_03_05_1778556542324.png)

13. 앱 엑세스 권한
![스크린샷 2026-05-12 오후 12.30.12](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_30_12_1778556687129.png)
   
14. 광고  
![스크린샷 2026-05-12 오후 12.32.48](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_32_48_1778556787949.png)

15. 콘텐츠 등급  
![스크린샷 2026-05-12 오후 12.33.43](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_33_43_1778556836906.png)
- 설문지 시작 
- 카테고리 (여기 또 이메일 주소 작성있음)
![스크린샷 2026-05-12 오후 12.34.50](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_34_50_1778556911063.png)
- 설문지 여기서 '예'의 대답들은 추가 질문이 엄청 나옴.
![스크린샷 2026-05-12 오후 12.36.12](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_36_12_1778556999923.png)
- 아래처럼 폭력성 있다고 표시하면 추가 질문이 엄청 많음
![스크린샷 2026-05-12 오후 12.39.16](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_16_1778557232488.png)
![스크린샷 2026-05-12 오후 12.39.28](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_28_1778557248811.png)
![스크린샷 2026-05-12 오후 12.39.39](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_39_1778557261422.png)
![스크린샷 2026-05-12 오후 12.39.49](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_49_1778557273775.png)

- 아니요 만 했을 경우 목록
![스크린샷 2026-05-12 오후 12.41.38](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_41_38_1778557343685.png)
![스크린샷 2026-05-12 오후 12.42.09](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_42_09_1778557356630.png)
![스크린샷 2026-05-12 오후 12.43.23](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_43_23_1778557438801.png)
> `저장`버튼 누르기. 자동으로 다음 버튼이 활성화 되지 않아서, 저장을 눌러야 됨. `다음` 버튼이 활성화 됨.

![스크린샷 2026-05-12 오후 12.45.41](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_45_41_1778564914759.png)


- 요약
![스크린샷 2026-05-12 오후 2.49.03](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_49_03_1778565011095.png)


16. 타겟층  
![스크린샷 2026-05-12 오후 2.50.27](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_50_27_1778565070916.png)
![스크린샷 2026-05-12 오후 2.50.44](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_50_44_1778565092284.png)
![스크린샷 2026-05-12 오후 2.51.46](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_51_46_1778565172139.png)
![스크린샷 2026-05-12 오후 2.51.56](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_51_56_1778565239015.png)
![스크린샷 2026-05-12 오후 2.52.09](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_52_09_1778565258642.png)
![스크린샷 2026-05-12 오후 2.52.16](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_52_16_1778565274931.png)


17. 데이터 보안  
![스크린샷 2026-05-12 14.59.33](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_14_59_33_1778565615802.png)
![스크린샷 2026-05-12 14.59.48](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_14_59_48_1778565629331.png)
![스크린샷 2026-05-12 15.00.47](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_00_47_1778565697123.png)
![스크린샷 2026-05-12 15.22.05](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_22_05_1778566948272.png)
- 앱 대상 연령대에 다동이 포함된다고 표시했기 때문에 Google Play 가족 정책을 춘수해야 스토어 등록정보의 데이터 보안 섹션에서 사용자에계 이러한 약속에 대해 안내하시겠어요? -> 예 로 꼭 표시해야지 넘어감.
![스크린샷 2026-05-12 15.23.57](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_23_57_1778567066107.png)
![스크린샷 2026-05-12 15.01.12](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_01_12_1778565715512.png)

18. 정부 앱  
![스크린샷 2026-05-12 15.26.29](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_26_29_1778567208159.png)

19. 금융 기능  
![스크린샷 2026-05-12 15.27.12](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_27_12_1778567259406.png)
![스크린샷 2026-05-12 15.27.27](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_27_27_1778567268841.png)
- 앱에서 금융 기능을 제공하지 않음 선택해야지 넘어감.

20. 건강    
![스크린샷 2026-05-12 15.29.10](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_29_10_1778567388656.png)
![스크린샷 2026-05-12 15.29.34](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_29_34_1778567402939.png)
    
21. 앱 카테고리 선택 및 연락처 세부정보 제공  
![스크린샷 2026-05-12 15.30.32](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_30_32_1778567447349.png)
![스크린샷 2026-05-12 15.31.11](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_31_11_1778567618242.png)
![스크린샷 2026-05-12 15.32.10](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_32_10_1778567637309.png)
![스크린샷 2026-05-12 15.32.20](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_32_20_1778567652196.png)
![스크린샷 2026-05-12 15.34.29](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_34_29_1778567755539.png)
![스크린샷 2026-05-12 15.35.26](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_35_26_1778567798505.png)


22. 스토어 등록정보 설정  
- 여기에서 스토어에 보이는 설명, 이미지을 각 언어에 맞게 등록하면 된다.
![스크린샷 2026-05-13 10.21.47](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_21_47_1778635429482.png)
![스크린샷 2026-05-13 10.22.23](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_23_1778635440147.png)
![스크린샷 2026-05-13 10.22.41](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_41_1778635454873.png)
![스크린샷 2026-05-13 10.22.49](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_49_1778635468031.png)
![스크린샷 2026-05-13 10.22.56](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_56_1778635478168.png)
![스크린샷 2026-05-13 10.23.06](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_23_06_1778635487330.png)

- 이미지 등록시, 에셋으로 추가 해서 이미지를 관리해야한다. 아래 사진처럼 업로드 하고, 파일 보내기, 추가 버튼을 눌러서 등록해야함.
![스크린샷 2026-05-13 10.35.11](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_35_11_1778638764027.png)
![스크린샷 2026-05-13 10.35.29](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_35_29_1778638804657.png)

- 각 섹션에 맞는 이미지 사이즈만 등록할 수 있게 표시되고, 사이즈 안맞는 이미지는 저렇게 안됨 표시로 보임. 그래서 각 에셋에 맞게 버튼을 누르고 추가해야 함.
![스크린샷 2026-05-13 11.22.03](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_22_03_1778639032518.png)


23. 검토 전송
- 위에 작업이 다 끝났을때, 상태바가 보이고, 검토중으로 표시됨.
![스크린샷 2026-05-12 15.36.58](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_36_58_1778567894474.png)
![스크린샷 2026-05-13 11.52.55](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_52_55_1778640841863.png)
![스크린샷 2026-05-13 11.53.09](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_53_09_1778640870670.png)

24. 예외 (문제 발견)
![스크린샷 2026-05-13 11.46.03](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_46_03_1778640429631.png)
![스크린샷 2026-05-13 11.46.13](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_46_13_1778640456014.png)
- 이런식으로 내가 놓힌 부분을 설명해주고 고치라고 해줌.

25. 전송 완료 후 
- 변경사항 검토중으로 바뀜.
![스크린샷 2026-05-13 11.55.53](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_55_53_1778641001907.png)
- 비공개테스트에서도 검토중으로 되어 있음.
![스크린샷 2026-05-13 11.54.56](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_54_56_1778641050306.png)
- 아래처럼 아이콘이 초록색 체크 표시로 바뀌면 이제 테스터에게 링크 공유나 설치가 가능해짐.
![스크린샷 2026-05-13 12.00.31](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_12_00_31_1778641319462.png)
