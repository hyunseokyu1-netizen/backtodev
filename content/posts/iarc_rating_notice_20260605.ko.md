---
title: 'Google Play 앱 등록 후 IARC 메일이 왔다 — 그냥 넘어가면 된다'
date: '2026-06-05'
publish_date: '2026-06-26'
description: IARC Live Rating Notice는 앱 연령 등급이 스토어에 공개됐다는 통보 메일이다. 특별한 조치가 필요 없는 이유
tags:
  - GooglePlay
  - Android
  - 앱출시
  - IARC
---

그냥 넘어가면 된다.

Google Play에 앱을 등록하고 나서 IARC라는 곳에서 메일이 왔다. 제목은 **"IARC Live Rating Notice: ChainPlay"**. 처음 보면 뭔가 조치를 해야 할 것 같은 느낌이 드는데, 결론부터 말하면 아무것도 안 해도 된다.

---

## IARC가 뭔데

IARC(International Age Rating Coalition)는 앱/게임의 연령 등급을 국제적으로 통합 관리하는 기관이다. Google Play, Microsoft Store, Nintendo eShop 등 주요 디지털 스토어가 여기에 가입되어 있다.

앱을 Google Play에 등록할 때 Play Console에서 "콘텐츠 등급" 설문을 작성하는 단계가 있다. 폭력성, 성인 콘텐츠, 도박 요소 같은 항목에 체크하는 그 과정이 IARC 설문이다. 이 설문을 완료하면 IARC가 지역별 등급을 자동으로 생성해준다.

- 북미: ESRB
- 유럽: PEGI
- 한국: GRAC
- 기타 지역별 등급 기관들

---

## 왜 이 메일이 오는가

설문 작성 → 등급 생성 → 앱 심사 완료 → **스토어에 정식 공개**

이 흐름이 완료됐을 때 IARC가 "당신 앱의 등급이 이제 스토어에 라이브됐다"고 알려주는 것이다. 확인 통보 그 이상도 이하도 아니다.

메일 내용에는 이런 정보가 포함된다.

| 항목 | 내용 |
|---|---|
| Global Rating ID | 다른 IARC 지원 스토어에서 재사용할 수 있는 ID |
| Product Title | 앱 이름 |
| Rating Date | 등급 공개일 |
| Storefront | Google Play |

---

## 이 메일 받고 해야 할 일

**없다.** 대부분의 경우 그냥 읽고 닫으면 된다.

예외적으로 아래 상황에서만 뭔가를 해야 한다.

| 상황 | 해야 할 일 |
|---|---|
| 등급이 잘못 나온 것 같다 | 메일 내 "request a rating check" 링크로 이의신청 |
| 앱 업데이트로 콘텐츠 성격이 바뀐다 (폭력성 추가 등) | Play Console에서 설문을 다시 작성해야 함 |
| Amazon Appstore 등 다른 스토어에도 등록하고 싶다 | Global Rating ID를 입력하면 등급 재사용 가능 |

평범한 유틸리티 앱이나 게임이라면 등급도 전체이용가(E/3+) 수준으로 나왔을 거고, 이의를 제기할 이유도 없다.

---

## Global Rating ID는 뭐에 쓰나

메일에 있는 긴 ID 값 (`d5f24a30-5594-84c4-8ac0-3f3fffcf256f` 같은 형식)이다.

IARC를 지원하는 다른 스토어에 같은 앱을 등록할 때, 설문을 처음부터 다시 작성하는 대신 이 ID를 입력하면 기존 등급을 가져다 쓸 수 있다. 지금 당장 필요 없으면 무시해도 된다.

---

## 정리

```
Google Play 콘솔에서 콘텐츠 등급 설문 작성
        ↓
IARC가 지역별 연령 등급 자동 생성
        ↓
앱 심사 완료 + 스토어 공개
        ↓
IARC Live Rating Notice 메일 도착
        ↓
그냥 넘어가면 됨
```

앱을 처음 출시하면 이것저것 낯선 메일이 오는데, IARC 메일은 그중에서 가장 무해한 편이다. "등록됐다"는 확인 메일이니 확인만 하고 넘어가면 된다.
