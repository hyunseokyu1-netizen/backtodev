---
title: 'Ollama 설치 및 로컬 AI '
date: '2026-05-20'
description: '로컬 AI 사용을 위한 Ollama 설치 '
tags: []
---
요즘 클로드 토큰 사용량, 비용에 대한 이슈가 계속 보인다.

그러다가 갑자가 온라인이 안되고 오프라인에서 AI를 사용해야 되는 상황이 발생할 수도 있다는 생각이 들었다.

옛날 사람들이 스트리밍으로 들어도 되는데, 꼭 mp3구매했던 느낌이랄까?

그래서 처음에는 딥시크를 설치해볼까 하고 알아보다가, 

나에게 맞는 모델이 어떤건지 알아 봤다. 


내 컴퓨터는 맥북(16GB)로 고사양은 아니라 내 컴퓨터에 맞는 모델 및 코딩할때 사용하고, 한국어 대화가 잘 되면 좋겠다고 했다. 


1. 🏆 원탑 추천: Qwen2.5-Coder (큐웬 2.5 코더)
현재 로컬 코딩 모델 시장을 평정한 중국 알리바바(Alibaba)의 최고 히트작입니다. 영어와 중국어 기반이지만, Qwen2.5 시리즈는 기본적으로 다국어 학습 데이터가 대거 포함되어 있어 한국어 질문을 매우 정확하게 알아듣고 한국어 주석이 달린 코드를 완벽하게 짜줍니다. 


2018 맥북 프로 추천 크기: qwen2.5-coder:7b (용량 약 4.7GB)
특징: 상용 모델(GPT-4o 등) 부럽지 않은 코드 작성, 디버깅, 리팩토링 능력을 가졌습니다. 16GB 맥북에서 팬은 좀 돌겠지만, 코딩 도우미로서 성능이 가장 확실합니다.
터미널 설치 명령어:
```
bash
ollama run qwen2.5-coder:7b
```

 2. 🇰🇷 한국어 정서 맞춤: EXAONE 3.5 (엑사원 3.5)
대한민국의 LG AI연구원에서 개발하고 오픈소스로 공개한 한국어 특화 인공지능입니다. 국내 대기업이 만든 만큼 한국어 문맥, 한국어 코딩 관련 질문 이해도가 국내 탑클래스입니다. 


2018 맥북 프로 추천 크기: exaone3.5:7.8b (용량 약 4.8GB)
특징: 한국어 대화 퀄리티가 기가 막힙니다. 코딩 특화 모델은 아니지만, 개발 관련 개념을 한국어로 친절하게 설명받고 프로그래밍 기초~중급 코드를 짤 때 대화 만족도가 아주 높습니다.
터미널 설치 명령어:
```
bash
ollama run exaone3.5:7.8b
```
 

## 설치하기

1. [Ollama](https://ollama.com/) 


![스크린샷 2026-05-20 10.02.54](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_02_54_1779242135971.png)

사이트에서 명령어를 복사해서 터미널에 붙이면 된다. 

```
curl -fsSL https://ollama.com/install.sh | sh
```

![스크린샷 2026-05-20 10.03.13](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_03_13_1779242355332.png)


2. 사용법

![스크린샷 2026-05-20 10.50.46](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_50_46_1779242388553.png)


3. 설치

- qwen2.5-coder:7b

![스크린샷 2026-05-20 10.09.28](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_09_28_1779242418949.png)

```
ollama run qwen2.5-coder:7b
```


- deepseek-r1:1.5b 설치하기   
 내 컴퓨터 사양에는 1.5B 모델을 추천해 줘서 이걸로 설치해 놓았음. 용량은 1.1GB로 가벼움.

![스크린샷 2026-05-20 11.09.02](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_11_09_02_1779242963347.png)
```
ollama run deepseek-r1:1.5b
```


4. 실행화면
![스크린샷 2026-05-20 10.47.57](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-20_10_47_57_1779243171657.png)

> 확실히 Claude나 Codex 보다 느리긴하다. 
그래도 일단 한번 놀아봐야겠다.
