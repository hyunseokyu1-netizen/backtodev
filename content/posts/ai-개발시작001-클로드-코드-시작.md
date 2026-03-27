---
title: '[AI 개발시작_002] 이미지 삽입 추가'
date: '2026-03-27'
description: 이미지 삽입기능 추가
tags:
  - 블로그 이미지 추가.ai
lang: ko
---
## 이미지삽입

이미지 삽입을 하였고, 글을 쓸때는 안보이는게, 절대경로라 당연히 안 보이는거라하고 일단 배포 해보고 다시 보자고 생각하고 넘어갔다.

![스크린샷 2026-03-27 오전 11.09.49](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-03-27_______11_09_49_1774580287472.png)


### 역시나 이미지가 보여 지지 않음. 

![스크린샷 2026-03-27 오전 11.51.20](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-03-27_______11_51_20_1774580303414.png)



> " 여기 이미지 보면 업로드 한 이미지 안보여 깃을 보면 이미지 업로드는 되어       
있는거 같은데, 보여지는 경로 확인해줄래?? "    

요청했더니, 아래와 같이 설명해줌.

![스크린샷 2026-03-27 오전 11.53.29](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-03-27_______11_53_29_1774580510070.png)


```typescript
⏺ GitHub에서 이미지 경로를 확인해볼게요.
⏺ 이미지는 GitHub public/images/에 잘 올라갔는데, 문제는 Vercel은 빌드 시점의
  public/ 폴더만 서빙하기 때문에 나중에 업로드한 이미지는 경로를 못 찾습니다.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ 원인 확인했습니다. 현재 /images/filename.png로 URL을 반환하는데, Vercel의  
  public/ 폴더는 빌드 시점에 고정되어 새로 업로드한 이미지를 서빙할 수 없습니다.
   GitHub raw URL로 직접 연결하도록 수정합니다.

⏺ 이제 기존에 업로드된 이미지들도 markdown에서 raw URL로 수정해야 합니다. 현재
  글에서 사용 중인 이미지 경로를 확인합니다.

⏺ 경로가 올바르게 바뀌었습니다. GitHub에 반영합니다.

⏺ 배포 완료입니다! 이제 이미지가 정상적으로 보일 겁니다.

  원인 요약: Vercel은 빌드 시점의 public/ 폴더만 서빙하기 때문에 나중에 GitHub에
   추가된 이미지는 /images/... 경로로 접근할 수 없었습니다. GitHub raw
  URL(raw.githubusercontent.com/...)로 직접 연결하도록 수정했습니다.

✻ Cooked for 1m 56s

```


이렇게 알려준다.

> 진짜 내 마음을 읽는 것일까???


옛날이였으면 원인 찾고, 해결하고, 배포하고, 원인요약 및 결과 보고서까지  써야 되었는데, 어찌보면, 혼자 몇시간은 작업해야되는 양이 였을수도 있는데, 단지 몇분만에 이렇게 해주다니...감탄만 나올 뿐이다..
