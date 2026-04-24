---
title: 'Claude 콘솔 크레딧 구매 버튼이 비활성화될 때 — 결제 안 되는 원인과 해결법'
date: '2026-04-24'
description: Claude Console에서 결제 정보를 다 입력해도 구매 버튼이 활성화되지 않는 문제. 원인은 언어 전환 시 도시 선택값이 초기화되는 버그였다.
tags:
  - Claude
  - ClaudeConsole
  - 트러블슈팅
---

Claude API를 써보려고 콘솔에 가입하고 크레딧을 충전하려 했다. 카드 정보, 주소까지 다 입력했는데 구매 버튼이 계속 비활성화 상태다.

며칠을 이것저것 시도해봤다. 결론부터 말하면 — **결제 페이지에서 언어가 전환될 때 도시(City) 선택값이 초기화되는 버그**였다.

---

## 증상

결제 정보를 모두 입력해도 구매 버튼이 눌리지 않는다.

![결제 정보 입력 후 구매 버튼 비활성화](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_34_38_1776992406711.png)

주소 필드를 하나하나 다시 확인해봐도 다 채워져 있는 것처럼 보인다.

![주소 필드 입력 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_34_54_1776992462771.png)

모든 필드를 입력해도 여전히 버튼이 활성화되지 않는다.

![여전히 비활성화된 버튼](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_29_1776992519033.png)

---

## 원인 찾기

`배송 주소와 청구 주소가 동일합니다` 체크박스를 해제해서 배송 주소를 직접 확인해봤다.

![체크박스 해제 후 배송 주소 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_42_1776992546908.png)

분명히 체크해서 청구 주소와 동일하게 설정했는데, **도시(City) 셀렉트 박스가 비어 있었다.**

![도시 선택값이 비어 있는 상태](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_53_1776992622408.png)

결제 페이지 언어가 영어에서 다른 언어로 전환되면서, 셀렉트 박스에 입력된 값을 그대로 가져오지 못하는 것 같다.

---

## 해결

1. `배송 주소와 청구 주소가 동일합니다` 체크박스를 **해제**한다
2. 배송 주소의 **도시(City)** 항목을 직접 선택한다
3. 구매 버튼이 활성화된다

![버튼 활성화 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_37_06_1776992714184.png)

---

## 정리

| 상황 | 확인할 것 |
|---|---|
| 구매 버튼이 비활성화 | 도시(City) 셀렉트 박스가 실제로 선택되어 있는지 확인 |
| `청구=배송` 체크했는데도 안 됨 | 체크 해제 후 배송 주소 도시를 직접 선택 |

언어 전환 시 셀렉트 박스 값이 초기화되는 버그인 것 같다. 겉으로는 채워진 것처럼 보이니 헷갈리기 쉬운 부분이다.

결국 이 문제로 계정 하나가 꼬여서, API는 개발용 이메일로 별도 계정을 새로 만들었다. 어차피 나중에 계정 분리하려고 했으니 미리 한 셈 치기로 했다.
