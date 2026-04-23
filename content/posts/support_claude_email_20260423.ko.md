---
title: 'Claude 고객센터에 이메일 보내는 법 — AI 챗봇 말고 직접 연락하기'
date: '2026-04-23'
description: Claude support 챗봇이 AI로만 응답할 때, 실제 이메일 티켓을 만들어 사람에게 연락하는 방법을 단계별로 정리했다.
tags:
  - Claude
  - 고객지원
---

Claude 콘솔에서 조직을 실수로 삭제했다. 그 바람에 로그인 자체가 안 되는 상황이 됐다.

support 페이지에 들어가서 채팅을 해봤는데 — AI가 자동 답변만 반복한다. 사람에게 연락하려면 이메일을 보내야 하는데, 이메일 주소가 어디에도 없다.

알고 보니 **챗봇을 통해 티켓을 먼저 만들어야** 이메일 폼이 열리는 구조였다. 순서가 있다.

---

## 핵심 흐름

```
로그아웃 → support 페이지 챗봇 열기 → "I can't login" 선택 → 이메일 입력 → 티켓 생성 → 이메일 작성
```

---

## Step 1 — 로그아웃 후 support 페이지에서 챗봇 열기

로그인 상태에서는 티켓 생성 옵션이 안 보이는 경우가 있다. **먼저 로그아웃**하고 support 페이지에 접속한다.

채팅 아이콘을 눌러 챗봇 창을 연다.

![support 페이지 챗봇 열기](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-23-09-52-57_006_1776906238561.jpg)

챗봇 창이 열리면 메시지를 입력해서 대화를 시작한다.

![챗봇 대화 시작](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-23-09-52-57_007_1776906279068.jpg)

---

## Step 2 — "I can't login" 선택

여기서 선택지가 나오는데, **반드시 `I can't login`을 눌러야 한다.**

![I can't login 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-23-09-52-58_008_1776906568646.jpg)

> `Login now`를 누르면 로그인 페이지로만 계속 보낸다. 로그인이 안 되는 상황이면 무한루프다.

---

## Step 3 — 약관 동의 후 이메일 입력

약관 동의 화면이 나오면 Accept.

![약관 동의](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-23-09-52-58_009_1776906583567.jpg)

이메일 주소를 입력한다. 연락받을 주소를 쓰면 된다.

![이메일 입력](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-23-09-52-58_010_1776906592831.jpg)

---

## Step 4 — 티켓 생성 후 이메일 작성

티켓이 생성됐다는 메시지가 뜨고, 티켓을 누르면 이메일 작성 폼이 열린다.

![티켓 생성 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-23-09-52-57_003_1776906833996.jpg)

내용을 작성하고 보내면 아래처럼 제출 완료 화면이 나온다.

![이메일 제출 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/KakaoTalk_Photo_2026-04-23-09-52-57_002_1776906854053.jpg)

---

## 정리

| 주의할 점 | 이유 |
|---|---|
| 먼저 로그아웃 | 로그인 상태에서는 티켓 옵션이 안 보일 수 있음 |
| `I can't login` 선택 | `Login now`는 로그인 페이지로만 보냄 |
| 이메일 주소 정확히 입력 | 티켓 확인 링크가 해당 메일로 발송됨 |

요즘 고객센터는 다 AI 챗봇이 1차 대응을 한다. 사람에게 닿으려면 챗봇을 통해 티켓부터 만들어야 하는 구조가 됐다. 경로만 알면 어렵지 않다.
