---
title: '에러가 없는데 아무 일도 안 일어났다 — launchd 스케줄러가 사라진 걸 10일 뒤에 안 이야기'
date: '2026-08-07'
publish_date: '2026-10-17'
description: 블로그 자동 발행이 열흘간 멈춘 진짜 원인이 세션 만료가 아니라 launchd plist 소실이었고, macOS TCC 때문에 복구까지 한 번 더 막혔던 진단 과정
tags:
  - launchd
  - macOS
  - 자동화
  - 트러블슈팅
  - Playwright
---

## "다 발행 실패로 되어 있어"

내가 만들어 쓰는 블로그 자동 발행 시스템이 있다. 날짜별로 주제를 등록해두면 초안을 쓰고, Playwright로 실제 브라우저를 조작해 티스토리에 발행하는 구조다. 매일 아침 8시 50분에 맥에서 자동으로 돈다.

어느 날 대시보드를 열어보니 이렇게 되어 있었다.

```
상태별: { published: 16, failed: 19 }
```

**19건 연속 실패.** 항목을 하나씩 열어보니 에러 메시지도 전부 똑같았다.

```
티스토리 로그인 세션이 만료되었습니다. 설정 페이지에서 티스토리를 다시 연동해 주세요.
```

여기까지 보고 나는 "아, 또 세션이 풀렸구나" 하고 넘어갈 뻔했다. 카카오 로그인 세션은 원래 잘 죽는다. 이 프로젝트에서 제일 골치 아픈 부분이 그거였고, 이미 여러 번 겪은 일이었으니까. 그래서 로그인만 다시 하면 될 거라고 생각했다.

**그런데 그게 표면 원인이었다.** 진짜 문제는 따로 있었고, 그걸 못 찾았으면 며칠 뒤에 똑같은 일을 또 겪었을 거다.

## 이상한 신호: 로그가 자라지 않는다

습관적으로 로그 파일부터 열었다.

```bash
tail -n 100 ~/Library/Logs/blog-auto-writer-refresh.log
```

내용은 예상대로였다. "세션 만료 감지", "간편로그인 계정 타일을 찾지 못했습니다" 같은 메시지가 반복되고 있었다. 여기까진 가설과 일치한다.

그런데 로그에 **시각이 하나도 안 찍혀 있었다.** 그냥 npm 실행 출력만 계속 이어 붙는 구조였던 거다. 그래서 "이게 언제 찍힌 로그지?"를 알 수가 없었다. 어쩔 수 없이 파일 자체의 수정 시각을 봤다.

```bash
ls -la ~/Library/Logs/ | grep blog
```

```
-rw-r--r--  1 hs  staff  7024  7월 28 08:51 blog-auto-writer-refresh.log
```

**7월 28일.** 그날은 8월 7일이었다. 즉 **열흘 동안 이 파일에 아무것도 안 쓰였다**는 뜻이다.

이게 왜 중요하냐면, 스케줄러가 정상적으로 돌고 있다면 성공하든 실패하든 **뭐라도 찍혀야 한다.** 실패하면 실패 메시지라도 쌓인다. 그런데 파일이 자라지 않았다는 건 결론이 하나뿐이다.

> 발행이 실패한 게 아니라, **애초에 실행되지 않았다.**

## 범인: 사라진 plist

macOS에서 주기적 작업은 `launchd`가 담당한다. 리눅스의 cron 같은 역할인데, 설정을 plist라는 XML 파일로 쓰고 `~/Library/LaunchAgents/`에 두면 된다. 등록된 작업이 있는지부터 확인했다.

```bash
launchctl list | grep -i blog
```

아무것도 안 나왔다. 디렉터리도 직접 봤다.

```bash
ls -la ~/Library/LaunchAgents/
```

```
drwx------@  4 hs  staff   128  7월 28 19:02 .
-rw-r--r--@  1 hs  staff   874  6월 19 14:39 ai.perplexity.CometUpdater.wake.plist
-rw-r--r--@  1 hs  staff   869  6월 19 14:39 com.google.GoogleUpdater.wake.plist
```

내 plist가 **없다.** 그리고 디렉터리 수정 시각이 **7월 28일 19시 02분**. 로그가 멈춘 그날 저녁이다. 무언가가(혹은 내가 뭔가 정리하다가) 그 파일을 지운 거다.

이렇게 되면서 벌어진 일을 정리하면 이렇다.

| 기간 | 실제로 벌어진 일 | 대시보드에 보인 것 |
|---|---|---|
| 7/19 ~ 7/28 | 스케줄러는 돌았지만 세션 만료로 발행 실패 | 발행 실패 |
| 7/28 ~ 8/6 | **스케줄러 자체가 없어서 아무것도 실행 안 됨** | 발행 실패 (동일) |

두 기간의 원인이 전혀 다른데 **화면에는 똑같이 보였다.** 대시보드의 "실패" 표시는 클라우드 쪽 발행 시도가 남긴 것이었고, 로컬 스케줄러가 죽었다는 사실은 어디에도 드러나지 않았다.

이게 이번 장애의 핵심이다. **에러가 시끄럽게 나는 것보다, 아무 일도 안 일어나는 게 훨씬 무섭다.** 에러는 눈에 띄지만 "실행 안 됨"은 아무 흔적도 안 남긴다.

## 복구 1단계: plist를 저장소에 넣는다

가장 어이없었던 건, 지워진 plist를 **복구할 방법이 없었다**는 점이다. 저장소에 사본이 없었다. 예전에 만들 때 `~/Library/LaunchAgents/`에 직접 파일을 쓰고 끝냈던 거다. 그 순간 그 파일은 이 세상에 하나뿐인 원본이 됐고, 지워지자 그냥 사라졌다.

그래서 이번엔 저장소에 정본을 두기로 했다.

```
launchd/com.blog-auto-writer.refresh-session.plist   ← 저장소에 커밋된 정본
scripts/run-publish-cloud.sh                          ← 실행 스크립트 정본
```

plist는 이런 모양이다.

```xml
<key>Label</key>
<string>com.blog-auto-writer.refresh-session</string>

<key>ProgramArguments</key>
<array>
  <string>/Users/사용자명/.local/bin/blog-auto-writer-publish.sh</string>
</array>

<!-- 매일 08:50 -->
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key><integer>8</integer>
  <key>Minute</key><integer>50</integer>
</dict>

<!-- 로그인/부팅 직후에도 한 번 (그날 발행이 아직이면 따라잡는다) -->
<key>RunAtLoad</key>
<true/>
```

여기서 초보자가 자주 밟는 지뢰가 하나 있다. **`KeepAlive`를 켜면 안 된다.** 이건 "죽으면 다시 살려라"는 옵션이라 상시 실행되는 서버에나 맞다. 발행 스크립트처럼 한 번 돌고 끝나는 작업에 켜두면 끝나자마자 다시 실행하고, 또 끝나면 또 실행하는 **무한 루프**가 된다. 실제로 이 프로젝트에 예전부터 있던 다른 plist에는 `KeepAlive`가 켜져 있었는데, 그건 상시 스케줄러용이라 맞는 설정이었다. 용도를 헷갈리면 안 된다.

등록은 이렇게 한다. 예전 문서에 흔한 `launchctl load`는 구식이고, 요즘은 `bootstrap`을 쓴다.

```bash
cp launchd/com.blog-auto-writer.refresh-session.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.blog-auto-writer.refresh-session.plist
```

## 복구 2단계: macOS가 실행을 막는다 (TCC 함정)

등록하고 `RunAtLoad` 덕분에 즉시 한 번 돌았다. 로그를 확인했더니 이런 게 찍혀 있었다.

```
/bin/zsh: can't open input file: /Users/사용자명/Documents/workspace/.../scripts/run-publish-cloud.sh
```

파일을 열 수 없다고 한다. 권한 문제인가 싶어 확인했다.

```bash
ls -la scripts/
-rwxr-xr-x@  1 hs  staff  967  8월  7 01:16 run-publish-cloud.sh
```

실행 권한(`x`) 멀쩡하고, 소유자도 나다. 터미널에서 직접 실행하면 **아무 문제 없이 잘 돌아간다.** 이러니 더 헷갈렸다.

범인은 macOS의 **TCC(Transparency, Consent, and Control)**였다. macOS는 `~/Documents`, `~/Desktop`, `~/Downloads` 같은 폴더를 특별 보호한다. 사용자가 터미널에서 접근하는 건 괜찮지만, **launchd가 백그라운드로 띄운 프로세스**가 그 안의 파일을 실행하려 하면 막힌다. 권한 비트와는 완전히 별개의 레이어다.

이전 설정이 왜 잘 돌았는지도 이걸로 설명됐다. 예전 plist는 `npm`을 실행하고 작업 디렉터리만 Documents 아래로 지정했다. **실행 파일 자체는 Documents 밖에 있었던 것**이다.

해결은 간단하다. 실행 파일만 보호 대상 밖으로 빼고, 스크립트 안에서 `cd`로 들어간다.

```bash
mkdir -p ~/.local/bin
cp scripts/run-publish-cloud.sh ~/.local/bin/blog-auto-writer-publish.sh
chmod +x ~/.local/bin/blog-auto-writer-publish.sh
```

정리하면 이렇다.

| 방식 | 결과 |
|---|---|
| plist가 `~/Documents/.../script.sh`를 직접 실행 | ❌ `can't open input file` |
| plist가 `~/.local/bin/script.sh` 실행 → 스크립트가 `cd`로 진입 | ✅ 정상 |
| `WorkingDirectory`를 Documents 아래로 지정 | ✅ 문제없음 |

## 복구 3단계: 다시는 조용히 죽지 않게

같은 일이 또 생겨도 **빨리 알아채는 것**이 진짜 목표다. 세 가지를 바꿨다.

**첫째, 로그에 시각을 찍는다.** 이번에 "언제부터 멈췄는지"를 로그로 못 알아내고 파일 mtime으로 추정해야 했던 게 제일 답답했다.

```bash
echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') publish-cloud 시작 ====="
npm run publish-cloud
# zsh에서 $status는 읽기 전용($?의 별칭)이라 대입하면 실패한다 — 다른 이름을 쓴다
exit_code=$?
echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') publish-cloud 종료 (exit=$exit_code) ====="
```

참고로 저 주석은 실제로 한 번 밟은 지뢰다. 처음엔 아무 생각 없이 `status=$?`라고 썼는데 zsh에서는 `status`가 `$?`의 별칭인 **읽기 전용 변수**라 대입이 안 된다. bash에선 잘 되니까 더 헷갈린다.

**둘째, nvm 경로를 스크립트 안에서 해결한다.** plist에 `/usr/local/bin/npm` 같은 절대경로를 박아두면 노드 버전을 올리는 순간 경로가 깨져서 또 조용히 멈춘다.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
```

**셋째, 점검 명령을 문서에 박아뒀다.**

```bash
launchctl print gui/$(id -u)/com.blog-auto-writer.refresh-session | grep -E "runs|last exit"
```

```
	runs = 1
	last exit code = 0
```

`runs`가 0이거나 명령 자체가 실패하면 스케줄러가 없는 것이고, `last exit code`가 0이 아니면 실행은 됐는데 스크립트가 실패한 거다. **원인이 완전히 다르니 이 둘을 구분하는 게 중요하다.**

## 덤: 밀린 데이터를 되살릴 때 밟은 지뢰

스케줄러를 고쳤으니 밀린 19건을 처리할 차례였다. 날짜가 이미 지나버려서, 오늘부터 하루 한 건씩 다시 배치하기로 했다. 단순히 각 항목의 `date` 필드만 바꾸면 될 것 같았다.

그런데 초안 저장 키가 이렇게 생겼다.

```
user:{userId}:draft:{date}_{platform}_{slug}
```

**키에 날짜가 들어간다.** 주제의 날짜만 바꾸면 발행 시점에 새 날짜로 초안을 찾을 테고, 그러면 못 찾아서 **초안을 통째로 다시 생성**한다. 이미 써둔 19편이 버려지고 API 호출 비용까지 새로 나가는 거다.

그래서 초안도 같이 옮겼다.

```typescript
const draft = await getCloudDraft(oldDate, platform, entry.topic, USER);
if (draft) await saveCloudDraft(newDate, platform, entry.topic, draft, USER);
entry.date = newDate;
entry.status = draft ? 'drafted' : 'pending';
entry.lastError = undefined;
```

그리고 이런 작업은 **반드시 dry-run을 먼저 돌린다.** `--apply` 플래그가 없으면 계획만 출력하게 만들어두고 눈으로 확인한 뒤 실행했다.

```
재배치 대상: 19건 (전체 35건)

2026-07-19 → 2026-08-07  [초안 있음] 휴가 후유증 극복! 햇빛에 탄 피부 진정시키는...
2026-07-20 → 2026-08-08  [초안 있음] 다이어터 주목! 여름 휴가철 살 안 찌는 외식...
...
초안 있음 19건 / 없음 0건

(dry-run — 실제 반영하려면 --apply)
```

19건 전부 초안이 살아 있었다. 그대로 옮기고 상태를 `failed`에서 `drafted`로 되돌렸다.

## 마지막: 에러가 없다고 성공한 게 아니다

로그인을 다시 하고 발행을 돌렸다. 결과는 이랬다.

```
[tistory] 세션 확보 완료 (쿠키 34개)
▶ [local-publish] 2026-08-07 / tistory / "휴가 후유증 극복! ..."
  [tistory] 본문 주입: 1678자
  [tistory] 발행 완료
```

여기서 끝내면 안 된다. 이 프로젝트에서 몇 번이나 데인 게 **"에러 없이 끝났는데 실제로는 반영이 안 된 경우"**였다. 본문이 빈 채로 발행되거나, 공개 설정이 씹혀서 비공개로 올라가거나. 그래서 항상 RSS로 실물을 확인한다.

```bash
curl -s "https://내블로그.tistory.com/rss"
```

```
제목: 휴가 후유증 극복! 햇빛에 탄 피부 진정시키는 천연 팩 레시피
발행: Fri, 7 Aug 2026 01:30:17 +0900
분류: Tyson잡학다식/생활상식
본문길이: 2664
```

제목·카테고리·본문 길이까지 확인하고, 중복 글이 생기지 않았는지 전체 목록도 훑었다. 그제야 끝난 거다.

## 정리

이번 장애에서 건진 것을 정리하면 이렇다.

1. **자동화가 안 돌면 로그 내용보다 로그 파일의 mtime을 먼저 본다.** 파일이 안 자라고 있으면 작업이 실패한 게 아니라 실행 자체가 없는 것이고, 원인이 완전히 다른 곳에 있다.
2. **화면에 보이는 에러가 최신 원인이라는 보장이 없다.** 이번엔 "세션 만료"가 열흘 내내 떠 있었지만, 뒤쪽 열흘의 진짜 원인은 스케줄러 소실이었다.
3. **설정 파일은 시스템 폴더에만 두지 말고 저장소에 정본을 둔다.** 지워지는 순간 복구할 수 없다면 그건 백업이 없는 것이다.
4. **launchd는 `~/Documents` 아래 스크립트를 실행하지 못한다.** TCC 때문이고, 파일 권한과 무관하며, 터미널에서는 잘 되니까 더 헷갈린다. 실행 파일은 `~/.local/bin`에.
5. **로그에는 반드시 타임스탬프를.** 없으면 사고 났을 때 시간 축을 재구성할 수가 없다.
6. **데이터 마이그레이션은 dry-run부터.** 특히 키에 날짜 같은 값이 들어가 있으면, 그 값을 바꾸는 순간 연결된 데이터가 미아가 된다.

마지막으로 하나 더. 이번에 알게 된 건데, 내 발행 스크립트는 주제 큐가 비어 있으면 **"발행할 주제 없음"을 출력하고 정상 종료(exit 0)** 한다. 즉 주제가 떨어져도 실패로 안 보인다. 그것도 결국 같은 종류의 조용한 실패라서, 남은 주제 날짜를 주기적으로 확인하라는 메모를 문서에 남겨뒀다.

자동화는 만들어두면 알아서 돌아간다고 생각하기 쉽지만, **"돌고 있다는 사실 자체를 확인하는 장치"**가 없으면 언제 멈췄는지도 모른 채 지나간다. 열흘치 발행을 날리고 배운 교훈이다.
