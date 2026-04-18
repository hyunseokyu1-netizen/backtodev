---
title: '[앱 출시] 테스터 12명 모으는 법 — Google Groups를 써야 하는 이유'
date: '2026-04-18'
description: Google Play 테스트 트랙 등록 시 테스터 12명을 효율적으로 모으는 방법. 이메일 수동 등록 대신 Google Groups를 써야 하는 이유와 순서 정리.
tags:
  - 앱스토어등록
  - 앱테스터
  - GooglePlay
---

Google Play에서 앱을 정식 출시하려면 **테스터 12명 이상**이 14일 이상 앱을 사용해야 한다.  
처음엔 그냥 주변에 이메일 보내면 되겠지 싶었는데, 해보니 함정이 꽤 있었다.

---

## 주의사항 1 — 트랙 생성 직후엔 링크가 동작하지 않는다

트랙을 처음 만들면 **"검토 중"** 상태가 된다.

![트랙 검토 중 상태](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-18-11-25-27_001_1776479195292.jpg)

이 상태에서는 테스트 링크를 공유해도 상대방이 앱을 설치할 수 없다.  
검토 완료까지 시간이 걸리므로, **트랙 생성 후 링크 공유는 승인 뒤에** 해야 한다.

> 처음 생성 시만 시간이 걸리고, 이후 테스터 추가는 거의 즉시 반영된다.

---

## 주의사항 2 — 이메일 목록 말고 Google Groups를 써라

테스터를 추가하는 방법이 두 가지다.

| 방법 | 특징 |
|------|------|
| 이메일 직접 입력 | 내가 한 명씩 수동 등록해야 함 |
| **Google Groups 연결** | 그룹 링크만 공유하면 상대방이 직접 가입 가능 |

Google Groups를 공개로 만들어두면, 테스터가 알아서 가입하고 자동으로 등록된다.  
이메일을 일일이 받아서 추가하는 것보다 훨씬 편하다.

![Google Groups 연결 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-18_______9_44_37_1776478930357.png)

---

## 주의사항 3 — Google Groups는 트랙 생성 시점에 등록해야 한다

여기서 가장 중요한 함정이다.

**트랙을 먼저 만들고 나중에 Google Groups를 추가하면 적용이 안 된다.**

반드시 **트랙 생성 → 제출 시점**에 Google Groups를 함께 등록해야 한다.  
나중에 수정으로 추가하면 인식이 안 되어서, 결국 트랙을 새로 만들어야 한다.

![Google Groups 미적용 시 오류](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-18_______11_04_47_1776478944366.png)

Groups가 제대로 연결되지 않으면 테스터가 링크를 눌러도 아래처럼 **"접근 권한 없음"** 오류가 뜬다.

![접근 권한 없음 오류 1](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-18-11-25-28_002_1776479502295.jpg)

![접근 권한 없음 오류 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-18-11-25-47_002_1776479521463.png)

---

## 테스터 모집 문구 예시

아래는 실제로 사용한 모집 문구다. SNS나 오픈 채팅방에 올리기 적합하다.

```text
🙏 앱 테스트 참여자 12명만 부탁드립니다!

레트로 감성 "카세트 테이프 음악 플레이어" 앱 출시 전에
마지막 테스트를 진행하고 있어요 🎧

✔ 참여 방법 (간단)

1. 구글 그룹 가입 (필수)
   https://groups.google.com/g/cassettetape

2. 아래 링크 접속 후 설치
   https://play.google.com/store/apps/details?id=com.hscassette.player

(웹 테스트 링크)
https://play.google.com/apps/testing/com.hscassette.player

✔ 부탁드리는 것

* 그냥 설치해두시고 가끔 한 번만 실행해주시면 됩니다 👍
* 14일 동안 삭제만 안 해주시면 됩니다 🙏

댓글이나 톡 주시면 바로 등록 도와드릴게요!
```

구글 그룹스 가입 링크와 테스트 링크를 함께 안내하면, 테스터가 두 단계를 헷갈리지 않고 따라올 수 있다.

---

## 정리

1. **트랙 생성** → 검토 완료 대기 (처음만 시간 소요)
2. **Google Groups 공개 그룹 생성** → 그룹 주소 준비
3. **트랙 제출 시 Google Groups 등록** (나중에 추가하면 적용 안 됨)
4. **링크 공유** → 테스터가 그룹 가입 후 앱 설치
5. 14일 이상 유지 → 정식 출시 조건 달성
