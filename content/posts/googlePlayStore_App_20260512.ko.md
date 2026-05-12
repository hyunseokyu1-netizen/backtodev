---
title: '구글 플레이스토어 앱 등록하기 A-Z까지 '
date: '2026-05-12'
description: 구글 플레이 스토어 앱 등록하기 설명 이미지로 처음부터 자세하게.
tags: []
---
일단 구글 스토어 가입을 한다. 현재 $25불 내면 가입 가능하다. 

스토어 등록 -> 앱 등록 -> 테스트 진행 -> 앱 정식 등록

이 순서이다.

현재 구글 스토어 정책상 12명의 테스터가 14일(2주)간 테스터에 참여해야지 앱 발매가 가능하다. 

1. 앱 만들기
![스크린샷 2026-05-11 오전 11.30.56](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_30_56_1778551894292.png)
![스크린샷 2026-05-11 오전 11.31.13](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_31_13_1778551926470.png)

- 앱 이름 작성, 패키지 이름 작성, 언어 선택, 유료/무료선택 등
![스크린샷 2026-05-11 오전 11.34.24](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_34_24_1778551990911.png)
![스크린샷 2026-05-11 오전 11.34.44](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_34_44_1778552005411.png)
- 패키지 이름 규칙 은 `com.회사명.앱이름 ` 이런식임.

> 앱 생성이 완료되면, 테스트를 등록해야 하는데, 내부테스트, 비공개테스트, 공개 테스트 3종류가 있다.  
 `비공개테스트 12명 14일은 필수`이고, 나머지, 내부테스트, 비공개테스트는 옵션이기는 한데, 내부테스트는 앱 설치링크를 빠르게 만들어서 테스트 할 수 있다는 장점이 있다.

2. 내부테스트 (생략 가능) 버전 생성
![스크린샷 2026-05-11 오전 11.36.27](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_36_27_1778552076633.png)
![스크린샷 2026-05-11 오전 11.36.43](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_36_43_1778553088756.png)
- 테스터 선택, 새 버전 만들기, 버전 미리보기 및 확인 순으로 해야함.
![스크린샷 2026-05-11 오전 11.37.04](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_04_1778553136935.png)

- 테스터 이메일 목록 만들기
![스크린샷 2026-05-11 오전 11.37.14](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_14_1778553180264.png)
![스크린샷 2026-05-11 오전 11.37.27](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_27_1778553225128.png)

- 버전 만들기
![스크린샷 2026-05-11 오전 11.38.04](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_38_04_1778553260112.png)
![스크린샷 2026-05-11 오전 11.51.51](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_51_51_1778553288265.png)
- App Bundle 파일 aab 업로드
![스크린샷 2026-05-11 오전 11.51.45](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_51_45_1778553317275.png)
![스크린샷 2026-05-11 오전 11.57.55](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_57_55_1778553383650.png)
-업로드 완료시 버전 정보 보임.

- 앱 이름 출시 정보 작성
![스크린샷 2026-05-11 오전 11.58.10](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_58_10_1778553417638.png)
- 영어는 <en-US> 태그 사용, 한국어는 <ko-KR> 사용해서 작성.

- 경고는 무시해도 됨. 
![스크린샷 2026-05-11 오전 11.59.22](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_59_22_1778553629271.png)

- 저장 및 출시
![스크린샷 2026-05-11 오전 11.59.34](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_59_34_1778553601760.png)


3. 출시 확인![스크린샷 2026-05-11 오후 12.00.04](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11______12_00_04_1778553865311.png)
빨간박스 안 초록색 체크 표시가 중요함.  
등록후 초록색 체크가 아닌, 검토중으로 보일경우가 있는데, 이 경우는 승인을 기다려야함.  
그냥 내가 올린다고 바로 되는게 아니고, 승인이 되야 테스터가 가능함.
- 승인이 되어야 링크 복사가 활성화가 됨.   
![스크린샷 2026-05-12 오전 11.47.24](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_47_24_1778554088406.png)

> 비공개테스트 승인이 좀 걸리기 때문에 내부테스트 링크를 먼저 생성해서 설치 테스트해보고 비공개테스트 진행해도 됨.


4. 비공개 테스트 등록
![스크린샷 2026-05-12 오전 10.46.28](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_28_1778554207528.png)
- 여기서는 `트랙만들기`라는 단어를 사용함.  
저기에서 비공개 테스트 -Alpha 는 내가 쓴거고, 여기서 비공개 테스트 하면서 계속 수정 하여 트랙을 올리면 된다. 알파,베타로 써도 되고, 헷갈리면, 그냥 트랙1,2,3 로 관리해도 된다. 

> 비공개 테스트 중에도 지속적으로 트랙을 만들어서 업데이트를 해야 된다고 함. 가끔 업데이트가 없으면 리젝된다고 함.


4. 비공개 테스트 순서 
- 비공개 테스트 트랙 생성 -> 국가 선택 -> 테스터 선택 -> 새 버전 만들기 -> 버전 미리보기 및 확인 -> 검토를 위해 Google에 버전 전송
![스크린샷 2026-05-12 오전 10.46.41](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_41_1778554730753.png)

5. 국가 선택
![스크린샷 2026-05-12 오전 10.46.53](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_53_1778554859534.png)
![스크린샷 2026-05-12 오전 10.47.07](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_07_1778554879268.png)
-일단 나는 전체 선택함. 

![스크린샷 2026-05-12 오전 10.47.17](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_17_1778554905020.png)
> 각 페이지마다 완료하고 나면, 매번 '게시 개요로 이동하시겠어요?' 라고 물어보는데, 처음에는 몰라서, '개요로 이동' 버튼을 눌렀더니, 매번 처음 대시보드로 이동하더라. 그래서 그냥 '나중에' 버튼 누르고, 뒤로 가기 하는게 작업을 이어서 할 수 있어서 편하다.

- 구글플레이 콘솔. 진짜 너무 불편하다. 하나 완료하면 자꾸 개요나 대시보드로 가서 그곳에서 작업내용 확인하게 만들었는데...진짜 개발자가 만든 느낌이다. 먼가 사용자를 하다고 고려하지 않은 개발자 특유의 효율만 따지는 UI/UX 임.   이거는 좀 수정하면 좋겠다.

6. 테스터 선택
![스크린샷 2026-05-12 오전 10.47.26](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_26_1778555110625.png)

- 내부테스트때는 이메일로 추가하였는데, 이렇게 하면, 여기저기 테스터 공고를 올려도 사용자가 참여하기가 힘들다. (내가 계속 이메일을 추가해주고, 사용자도 승인될따까지 기다려야함.) 
![스크린샷 2026-05-12 오전 10.47.37](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_37_1778555142663.png)

> 그래서 구글 그룹스를 여기서 사용하는게 편하다.   
그러면 내가 추가 안하고, 사용자가 직접 구글 그룹스에 참여해서 테스트를 설치할 수 있다. 

7. 구글 그룹스 만들기. 
![스크린샷 2026-05-12 오전 10.48.13](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_48_13_1778555372662.png)
- 구글 그룹스로 가서 그룹를 새로 만든다. 
> 개인정보 설정 등급이 중요함.
여기서 불편하면 사람들이 가입을 안하고 설치 안한다. 그래서 링크 사용자가 바로 가입할 수 있도록 등급을 좀 낮춰 놓아야 함.

![스크린샷 2026-05-12 오전 10.49.20](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_49_20_1778555416592.png)
> 그룹을 검색할 수 있는 사용자 : 웹의 모든 사용자에게 공개  
그룹에 가입할 수 있는 사용자 : 누구나 가입할 수 있음  
대화를 볼 수 있는 사용자 : 웹의 모든 사용자에게 공개  
게시물을 올릴 수 있는 사용자 : 그룹멤버   
회원을 볼 수 있는 사용자 : 그룹 관리자   

- 회원을 볼 수 있는 사용자는 그룹멤버로 해도 되는데, 그냥 몇명이 가입되었나 아무나 보는게 싫어서, 그룹관리자로 한정함. 
![스크린샷 2026-05-12 오전 10.49.42](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_49_42_1778555636467.png)
- 그룹 만들기 완료!
![스크린샷 2026-05-12 오전 10.50.31](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_50_31_1778555679096.png)
![스크린샷 2026-05-12 오전 10.50.56](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_50_56_1778555700028.png)
> 그룹정보에서 그룹 주소메일 복사 해 놓기.   
  이름@googlegroups.com

8. 테스터에 google그룹스 선택 후 추가
![스크린샷 2026-05-12 오전 10.51.19](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_51_19_1778555775154.png)

9. 의견 URL 또는 이메일 주소.
- 개인적으로 스토어등록용 이메일 따로 만들어서 관리하는걸 추천함. 은근히 계속 앱 관련해서 이메일 작성할 떄가 많음.
![스크린샷 2026-05-12 오전 10.51.38](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_51_38_1778555814447.png)


10. 추가 정보 오류
![스크린샷 2026-05-12 오전 10.52.11](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_11_1778555897806.png)
![스크린샷 2026-05-12 오전 10.52.20](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_20_1778555924530.png)
- 또 이런식으로 대시보드로 이동해서 확인해 보라고 뜬다. 막상 대시보드가도 제대로 설명이 없다. 그냥 여기서 바로 작업하던지 이어서 작업하게 만들면 되는데.... 이건 머 구글의 문제니까. 우리야 어떻게든 적응해서 사용해야지.머.

11. 앱 설정 완료(대시보드)
![스크린샷 2026-05-12 오전 10.52.39](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_39_1778556008313.png)
- 대시보드에도 머 설명이 없다. 앱 설정 완료 -> '할 일 보기' 를 펼쳐봐야함.
- 내 느낌은 나름 개발자가 아닌 일반인도 여기서 앱을 관리 할 수 있게 만들려고 만든거 같은데, 오히려 복잡성 때문에 더 사용하기 어렵다. 이럴때는 사람이 적응하도록 기존의 방식대로 유지해도 되었을거 같다는 생각이다. 
![스크린샷 2026-05-12 오전 10.52.53](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_53_1778556103595.png)
- 할일 목록이 이렇게 많다.
> 개인정보처리방침 설정  
앱 액세스 권한  
광고  
콘텐츠 등급  
타겟층  
데이터 보안  
정부 앱  
금융 기능  
건강    
>    
>앱 카테고리 선택 및 연락처 세부정보 제공  
스토어 등록정보 설정  

- 이 목록을 다 해야한다. 


