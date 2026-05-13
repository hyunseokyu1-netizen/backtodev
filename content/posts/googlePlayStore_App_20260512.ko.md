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

**초록색 체크 표시**가 핵심이다. '검토 중'으로 보이면 구글 승인을 기다려야 한다. 승인이 완료돼야 테스터 초대 링크가 활성화된다.

![링크 활성화](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_47_24_1778554088406.png)

> 비공개 테스트 승인에 시간이 걸리기 때문에, 내부 테스트 링크를 먼저 생성해서 설치 확인을 해두는 것을 추천한다.

---

## Step 3 — 비공개 테스트 (필수)

정식 출시를 위한 필수 단계다. **12명의 테스터가 14일 이상 참여**해야 한다.

### 트랙 만들기

![비공개 테스트](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_28_1778554207528.png)

구글 플레이 콘솔에서는 버전 단위를 '트랙'이라고 부른다. 알파/베타로 관리해도 되고, 헷갈리면 트랙1, 트랙2로 관리해도 무방하다.

> 비공개 테스트 중에도 주기적으로 트랙을 업데이트해야 한다. 업데이트가 없으면 리젝될 수 있다.

**진행 순서:**

비공개 테스트 트랙 생성 → 국가 선택 → 테스터 선택 → 새 버전 만들기 → 버전 미리보기 → Google에 버전 전송

![비공개 테스트 순서](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_41_1778554730753.png)

### 국가 선택

![국가 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_53_1778554859534.png)
![국가 선택 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_07_1778554879268.png)

특별히 제한할 이유가 없으면 전체 선택하면 된다.

![국가 전체 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_17_1778554905020.png)

> 각 페이지 완료 후 '게시 개요로 이동하시겠어요?' 팝업이 뜨는데, '개요로 이동'을 누르면 대시보드로 이동해서 작업 흐름이 끊긴다. **'나중에' 버튼을 누르고 뒤로 가기**로 이어서 작업하는 게 편하다.

### 테스터 설정 — Google Groups 활용 추천

![테스터 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_26_1778555110625.png)

이메일로 테스터를 일일이 추가하면, 내가 직접 추가해줘야 하고 사용자도 승인될 때까지 기다려야 한다. 테스터를 외부에서 모집할 계획이라면 **Google Groups를 사용하는 것이 훨씬 편하다.** 사용자가 그룹에 직접 가입해서 바로 테스트에 참여할 수 있다.

![테스터 이메일 방식](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_37_1778555142663.png)

---

## Step 4 — Google Groups 만들기

![Google Groups](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_48_13_1778555372662.png)

Google Groups에서 새 그룹을 생성한다. **개인정보 설정이 중요하다.** 설정이 너무 제한적이면 사람들이 가입 자체를 포기한다.

![Google Groups 설정](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_49_20_1778555416592.png)

**권장 설정:**

| 항목 | 설정값 |
|------|--------|
| 그룹을 검색할 수 있는 사용자 | 웹의 모든 사용자에게 공개 |
| 그룹에 가입할 수 있는 사용자 | 누구나 가입할 수 있음 |
| 대화를 볼 수 있는 사용자 | 웹의 모든 사용자에게 공개 |
| 게시물을 올릴 수 있는 사용자 | 그룹 멤버 |
| 회원을 볼 수 있는 사용자 | 그룹 관리자 |

'회원을 볼 수 있는 사용자'를 그룹 관리자로 제한하면 가입자 수가 외부에 노출되지 않는다.

![그룹 만들기 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_49_42_1778555636467.png)

그룹 생성 완료:

![그룹 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_50_31_1778555679096.png)
![그룹 주소 복사](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_50_56_1778555700028.png)

그룹 정보에서 **그룹 주소 이메일(`이름@googlegroups.com`)을 복사**해 둔다. 다음 단계에서 사용한다.

---

## Step 5 — 테스터에 Google Groups 연결

![Google Groups 연결](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_51_19_1778555775154.png)

테스터 설정에서 Google Groups를 선택하고 복사해둔 그룹 이메일을 추가한다.

---

## Step 6 — 의견 URL / 이메일 등록

![의견 이메일](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_51_38_1778555814447.png)

테스터 피드백을 받을 이메일 주소를 입력한다. 앱 관련 이메일이 생각보다 많이 오기 때문에 **스토어 전용 이메일 계정을 별도로 만들어서 관리하는 것을 추천한다.**

---

## Step 7 — 앱 설정 완료: 할 일 목록 처리

버전을 전송하고 나면 대시보드에서 '할 일 보기'를 펼쳐야 한다.

![추가 정보 오류](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_11_1778555897806.png)
![추가 정보 오류 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_20_1778555924530.png)
![앱 설정 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_39_1778556008313.png)
![할 일 목록](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_53_1778556103595.png)

처리해야 할 항목들:

- 개인정보처리방침 설정
- 앱 액세스 권한
- 광고 여부
- 콘텐츠 등급
- 타겟층
- 데이터 보안
- 앱 카테고리 선택 및 연락처 세부정보
- 스토어 등록정보 설정

항목이 많아 보이지만, 대부분은 라디오 버튼 선택이나 간단한 입력으로 끝난다. 하나씩 체크하면서 완료하면 된다.

---

## Step 8 — 검토 제출

![검토 제출](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_01_21_1778556450713.png)
![검토 제출 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_02_56_1778556377545.png)
![검토 제출 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_03_05_1778556542324.png)

모든 항목 완료 후 'Google에 버전 전송'을 누르면 검토가 시작된다.

![최종 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_30_12_1778556687129.png)
![최종 확인 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_32_48_1778556787949.png)
![최종 확인 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_33_43_1778556836906.png)
![최종 확인 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_34_50_1778556911063.png)
![최종 확인 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_36_12_1778556999923.png)
![최종 확인 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_16_1778557232488.png)
![최종 확인 7](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_28_1778557248811.png)
![최종 확인 8](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_39_1778557261422.png)
![최종 확인 9](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_49_1778557273775.png)
![최종 확인 10](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_41_38_1778557343685.png)
![최종 확인 11](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_42_09_1778557356630.png)
![최종 확인 12](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_43_23_1778557438801.png)

---

## 전체 흐름 정리

```
1. 구글 플레이 콘솔 가입 ($25)
        ↓
2. 앱 만들기 (패키지명, 언어, 유무료 설정)
        ↓
3. 내부 테스트 [선택] (빠른 설치 링크 확보)
        ↓
4. 비공개 테스트 [필수]
   - Google Groups로 테스터 모집
   - 12명 × 14일 충족
        ↓
5. 할 일 목록 전부 완료
        ↓
6. Google에 버전 전송 → 검토 → 승인
        ↓
7. 정식 출시
```

**핵심 팁 3가지:**

1. **내부 테스트를 먼저** — 비공개 테스트 승인 기다리는 동안 내부 테스트로 앱을 직접 검증
2. **Google Groups 사용** — 이메일 수동 추가 대신 그룹 링크 하나로 테스터 모집
3. **'나중에' 버튼 애용** — 각 페이지에서 '개요로 이동' 대신 '나중에'를 눌러야 작업 흐름이 끊기지 않음
