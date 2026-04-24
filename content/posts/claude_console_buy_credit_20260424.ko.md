---
title: 클로드 콘솔 크레딧 구매 버튼 비활성화 문제
date: '2026-04-24'
description: 클로드 콘솔 크레딧 구매 버튼 비활성화되어서 결제를 못함.
tags:
  - Claude Console
---
와 진짜 몇일을 고생하고, 계정을 날린건지..


클로드 API를 쓰려고, 클로드 콘솔 가입을 하고, 크레딧을 충전하려는데

결제 버튼이 계속 비활성화인거다.

- 결제 정보 다 입력했는데, 구매 버튼이 활성화가 안된다.
![스크린샷 2026-04-24 오전 12.34.38](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_34_38_1776992406711.png)


- 모든 필드를 다 입력해야 한다. (주소)
![스크린샷 2026-04-24 오전 12.34.54](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_34_54_1776992462771.png)

- 다 입력해도 활성화가 안된다.
![스크린샷 2026-04-24 오전 12.36.29](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_29_1776992519033.png)


- `배송 주소와 청구 주소가 동일합니다.` 이거를 체크를 지워서 배송주소를 확인해 본다.
![스크린샷 2026-04-24 오전 12.36.42](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_42_1776992546908.png)


- 분명히 동일하게 체크했는데, '도시' 셀렉트 박스가 선택이 안되어 있다. 
![스크린샷 2026-04-24 오전 12.36.53](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_53_1776992622408.png)

이게 결제 페이지 영어가 아닌 다른 언어로 바뀌면서 선택된 정보를 그대로 가져오지 못하는 문제 인거 같다. 

-배송주조와 청구 주소가 동일합니다. 버튼 언체크하고, 도시를 선택해 주니까, 버튼이 활성화가 되었다. 
![스크린샷 2026-04-24 오전 12.37.06](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_37_06_1776992714184.png)


아... 이거 때문에 계정하나는 연결이 안되고...
결국 API는 개발용 이메일로 따로 만들었다. 어자피 테스트 끝나고 계정분리하려고 했는데, 미리 했다고 생각하자~! 
