---
title: 2026년 기준 Google Play 콘솔(개발자 계정) 등록 방법
date: '2026-04-15'
description: Google Play 콘솔 등록 방법
tags:
  - Google Play 콘솔
---
“2026년 기준 Google Play 콘솔(개발자 계정) 등록 방법” 

***

# 2026년 기준 Google Play 콘솔 개발자 계정 등록 방법 (완전 정리)

Android 앱을 정식으로 배포하려면 **Google Play 개발자 계정**과 **Play Console**이 필수입니다. 이 글에서는 2026년 기준으로 개인 개발자가 계정을 만들고 본인 인증까지 완료하는 과정을 단계별로 정리합니다.
***

## 1. 사전 준비물 정리

계정 등록 전에 다음 준비물이 있으면 진행이 훨씬 수월합니다.

- 구글 계정 (Gmail)
- 신용/체크카드: 개발자 등록 수수료 결제용, 1회 25달러(USD)만 결제하면 됨 
- 휴대폰 번호: 2단계 인증 및 본인 확인용 
- 이름과 현재 주소가 적힌 서류 (90일 이내 발급, 예: 공과금 청구서, 은행/카드 명세서, 임대차 계약서 등, 국가별로 인정 서류가 다를 수 있음) 

> 팁: 주소 서류는 **구글 결제 프로필에 입력한 법적 주소와 동일하게** 맞춰 두어야 인증이 잘 통과됩니다. [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)

***

## 2. Google Play Console 접속 및 개발자 계정 등록

1. 브라우저에서 Play Console 접속  
   - 링크: <https://play.google.com/console> [catdoes](https://catdoes.com/blog/how-to-publish-app-on-google-play)
   - 구글 계정으로 로그인합니다.

2. 개발자 등록 시작  
   - 첫 화면에서 **개발자 계정 만들기** 또는 **등록** 버튼을 클릭합니다. [catdoes](https://catdoes.com/blog/how-to-publish-app-on-google-play)
   - 계정 유형을 선택합니다.
     - 개인(Personal) 계정: 1인 개발자용, 일반적인 선택 [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)
     - 조직(Organization) 계정: 회사/법인용, 추가 서류(D-U-N-S 번호 등) 필요할 수 있음 [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

3. 약관 동의  
   - Google Play 개발자 **서비스 약관**에 동의합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

4. 등록 수수료 결제 (1회)  
   - 결제 화면에서 카드 정보를 입력하고 **25달러 등록 수수료**를 결제합니다. [appspine](https://www.appspine.com/blog/from-code-to-store-a-founder-s-guide-to-launching-on-google-play-2026-edition)
   - 이 비용은 1회만 내면 되고, 이후에는 추가 연회비가 없습니다. [catdoes](https://catdoes.com/blog/how-to-publish-app-on-google-play)

***

## 3. 개발자 프로필 및 결제 프로필 설정

결제가 끝나면 개발자 계정 정보와 결제 프로필(법적 주소)을 설정합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)

### 3.1 개발자 프로필 정보 입력

- 개발자 이름(Developer name)  
  - Play 스토어에 표시되는 이름입니다. [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)
  - 개인이라면 본명 또는 활동명, 조직이라면 회사명을 사용합니다.

- 개발자 이메일 주소  
  - 사용자 문의에 사용될 이메일이며, 스토어에 공개됩니다. [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)
  - 인증 메일이 오므로 수신 가능한 주소를 사용하는 것이 중요합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

- 웹사이트, 전화번호 (선택/국가별 필수)  
  - 신뢰도를 위해 가능한 한 채워두는 것을 권장합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)

### 3.2 Google 결제 프로필(법적 주소) 연결

Play Console 계정은 Google 결제 프로필(Payments profile)에 연결됩니다. [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)

- 기존 결제 프로필이 있으면 선택, 없으면 새로 생성  
- 이름(법적 이름), 주소, 국가, 결제 수단 등을 입력합니다. [support.google](https://support.google.com/googlepay/answer/7644076?hl=ko)
- 이 정보는 **신원·주소 인증 기준값**이 되므로 실제와 일치해야 합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

***

## 4. 본인(신원) 인증 진행

2026년 현재 Google은 Play를 안전하게 유지하기 위해 개발자 신원 인증을 강하게 요구합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

### 4.1 개인 계정 신원 인증

개인 계정의 경우 보통 다음 정보가 필요합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

- 정부 발급 신분증(예: 주민등록증, 운전면허증, 여권 등 국가별 허용 문서) [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)
- 신분증에 적힌 이름과 Play Console/결제 프로필의 법적 이름이 일치해야 합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

Play Console의 안내에 따라 신분증 사진 또는 스캔본을 업로드하고, 요청되는 경우 셀피(본인 얼굴) 확인 단계도 거칠 수 있습니다. [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

### 4.2 주소 인증 (Address verification)

추가로 주소 인증이 필요한 경우 다음과 같은 서류 중 하나를 제출합니다. [support.google](https://support.google.com/googleplay/android-developer/answer/15633622?hl=ko&co=GENIE.CountryCode%3DBI)

- 90일 이내 발급된 공과금 청구서 (전기, 수도, 가스, 인터넷, 통신 등)  
- 90일 이내 발급된 신용카드/체크카드 명세서  
- 90일 이내 발급된 은행 명세서  
- 90일 이내 발급된 임대차 계약서 또는 거주 증명 서류

> 주의: 서류에 **이름과 현재 주소가 모두 명확하게 표시**되어 있어야 하며, 결제 프로필에 등록한 주소와 최대한 동일해야 합니다. 주소가 안 적힌 명세서는 인증용으로 인정되지 않습니다. [support.google](https://support.google.com/googlepay/answer/7644078?hl=ko)

업로드를 마치면 Google이 서류를 검토하고, 보통 며칠 이내에 이메일로 승인 또는 추가 요청 결과를 알려줍니다. [support.google](https://support.google.com/googleplay/android-developer/answer/14177239?hl=en)

***

## 5. 계정 보안 설정 (2단계 인증)

Play Console 사용자는 보안을 위해 **2단계 인증(2FA)**를 활성화하는 것이 사실상 필수입니다. 

1. 구글 계정 관리로 이동  
   - <https://myaccount.google.com/security> 접속  
2. **2단계 인증** 설정  
   - 휴대폰 문자/전화, 인증 앱(Google Authenticator 등) 중 원하는 방법으로 설정합니다. 
3. 백업 코드 저장  
   - 계정 잠김에 대비해 백업 코드를 안전한 곳에 보관합니다. 

보안 설정을 완료하면, Play Console 로그인 시 추가 인증을 거쳐 계정이 보호됩니다. 

***

## 6. Play Console 기본 설정 둘러보기

계정 인증이 완료되면 Play Console에서 다음 메뉴들을 확인할 수 있습니다.

- 홈(Home): 앱 요약, 공지, 정책 알림 확인  
- 정책 상태(Policy status): 정책 위반 여부 및 경고 확인  
- 앱 목록(Apps): 등록된 앱 리스트, 새 앱 만들기  
- 개발자 계정(Developer account): 프로필, 연락처, 조직 정보 관리 
- 설정(Settings): 이메일 알림, 연결 서비스, 테스트용 이메일 목록 등 관리 

앱을 실제로 올리려면 이후에 다음 작업이 이어집니다. 

- 앱 항목 생성 및 패키지명 설정  
- 스토어 등록정보(제목, 설명, 스크린샷, 아이콘 등) 작성  
- 개인정보처리방침 URL 및 데이터 보안(Privacy/Data Safety) 폼 작성 [youtube](https://www.youtube.com/watch?v=dVcEMgr5Y1M)
- AAB 업로드, 테스트 트랙 설정, 검수 제출 등

이 부분은 별도의 글에서 “앱 게시 단계” 위주로 정리하는 것이 좋습니다.

***

## 7. 자주 막히는 포인트 & 팁

- 주소 서류에 주소가 안 나오는 경우  
  - 은행/카드사, 통신사에 **주소가 인쇄된 명세서**를 재발급 요청하거나, 공과금 청구서를 발급받는 것이 가장 현실적인 해결책입니다. 
  - 한국인이라면, `주민등록등본`을 제출하는것도 방법임.

- 이름·주소 불일치로 인한 반려  
  - 신분증, 주소 서류, 결제 프로필 정보가 서로 다르면 반려될 수 있습니다. [support.google](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)
  - 먼저 결제 프로필의 법적 이름·주소를 현재 정보와 맞춘 뒤, 같은 정보가 찍힌 서류를 제출하는 흐름이 안전합니다.

- 검토 기간  
  - 신원/주소 인증은 보통 수일 정도 걸리지만, 상황에 따라 더 오래 걸릴 수 있습니다. 
  - 반려 메일을 받으면 안내된 사유에 맞춰 서류를 교체하거나 정보를 수정해야 합니다. 

***

## 마무리

정리하자면, Google Play 콘솔 등록은  
1) 구글 계정 준비 → 2) 개발자 계정 등록 및 25달러 결제 → 3) 개발자·결제 프로필 설정 → 4) 신원·주소 인증 → 5) 보안(2FA) 설정  
순서로 진행됩니다. 

이 글을 기반으로, 캡처 화면과 개인 경험(반려 사례, 서류 준비 팁 등)을 덧붙이면 훨씬 실전적인 튜토리얼이 됩니다.
