---
title: 'Expo 앱을 Play Store에 올리기까지 — AAB 빌드부터 스토어 자산 제작까지'
date: '2026-05-10'
publish_date: '2026-05-31'
description: React Native(Expo) 게임 앱을 처음 Google Play Store에 출시하면서 겪은 빌드, 자산 제작, 버그 수정 전 과정 정리
tags:
  - Expo
  - ReactNative
  - Android
  - GooglePlayStore
  - Supabase
---

## 드디어 앱을 세상에 내보낼 시간

사이드 프로젝트를 만들다 보면 "언제쯤 실제로 출시할 수 있을까" 하는 생각이 항상 뒤따른다. 기능은 어느 정도 됐고, 테스트도 했는데 막상 Play Store 등록 단계가 되면 갑자기 모르는 게 잔뜩 나온다.

이번 글은 내가 만든 TILT라는 퍼즐 게임 앱을 Google Play Store에 처음 올리면서 겪은 과정을 정리한 것이다. Expo 기반 React Native 앱이고, 기기를 기울여서 미로를 푸는 게임이다. 리더보드는 Supabase로 붙여놨다.

출시 직전에 버그가 하나 터졌고, 순위 시스템도 손봐야 했고, 스토어 자산도 직접 만들었다. 그 삽질 과정을 단계별로 기록해둔다.

---

## 출시 전에 터진 버그: 로딩 스피너가 안 사라진다

### 증상

게임이 끝나고 점수가 나오는 화면에서 리더보드 로딩 스피너가 계속 돌고 있었다. Supabase 연결이 안 된 환경(개발 초기, DB 미설정 상태)에서 특히 심하게 나타났다.

### 원인

기존 코드에서 스피너 표시 조건이 이랬다.

```typescript
// 기존 코드 — 문제 있음
if (!topRankings.length && !rankInfo && score > 0) {
  return <LoadingSpinner />;
}
```

DB 요청이 실패하거나 타임아웃이 나도 `topRankings`는 빈 배열, `rankInfo`는 null인 채로 남아 있으니까 스피너 조건이 계속 참으로 평가된다. 로딩이 끝났는지 알 방법이 없었던 것이다.

### 해결

`isLoadingRankings` 상태를 별도로 관리하는 게 정석이다. GameContext에 플래그를 추가했다.

```typescript
// GameContext.tsx
const [isLoadingRankings, setIsLoadingRankings] = useState(false);

const fetchRankings = async () => {
  setIsLoadingRankings(true);
  try {
    const data = await getRankings(); // Supabase 호출
    setTopRankings(data.top);
    setRankInfo(data.myRank);
  } catch (error) {
    console.error('Rankings fetch failed:', error);
    // 실패해도 상태는 조용히 빈 채로 유지
  } finally {
    setIsLoadingRankings(false); // 성공/실패 무관하게 항상 false
  }
};
```

스피너 표시 조건도 바꿨다.

```typescript
// 수정 후
if (isLoadingRankings) {
  return <LoadingSpinner />;
}
```

간단하지만 놓치기 쉬운 패턴이다. 비동기 상태를 데이터 유무로 판단하면 항상 이런 함정이 생긴다. "로딩 중인가"는 별도 플래그로 명시적으로 관리하는 게 맞다.

---

## 순위 시스템 수정: 동점자 처리

### 문제

원래 PostgreSQL의 `DENSE_RANK()`를 쓰고 있었다. 동점자가 같은 순위를 공유하는 방식이다. 100명이 게임을 하면 상위 50명이 전부 1위가 될 수도 있는 구조였다. 게임 특성상 "나만의 순위"가 더 의미 있어서 바꾸기로 했다.

### 정렬 기준 설계

순위 결정 기준을 세 단계로 정했다.

| 우선순위 | 기준 | 방향 |
|---|---|---|
| 1 | 점수 | 높을수록 유리 (DESC) |
| 2 | 총 플레이 시간 | 짧을수록 유리 (ASC) |
| 3 | 등록 시각 | 먼저 등록한 사람 유리 (ASC) |

### total_play_time 컬럼 추가

플레이 시간을 기록하려면 DB에 컬럼이 있어야 한다. 주의할 점은 "실패한 라운드 시간은 포함하지 않는다"는 것이다. 성공한 라운드의 누적 시간만 쓴다.

```sql
ALTER TABLE rankings ADD COLUMN total_play_time INTEGER DEFAULT 0;
```

클라이언트에서 점수를 올릴 때 함께 전송한다.

```typescript
await supabase.from('rankings').upsert({
  user_id: userId,
  score: currentScore,
  total_play_time: successfulRoundsTime, // 실패 라운드 제외
  created_at: new Date().toISOString(),
});
```

### applyRank 유틸 함수

순위 계산 로직을 재사용 가능하도록 분리했다. `startOffset`은 페이지네이션 시 시작 순위를 지정할 때 쓴다.

```typescript
// utils/ranking.ts
export function applyRank<T>(
  entries: T[],
  startOffset: number = 0
): (T & { rank: number })[] {
  return entries.map((entry, index) => ({
    ...entry,
    rank: startOffset + index + 1,
  }));
}
```

DB에서 이미 정렬된 결과가 내려오면 클라이언트에서는 순서 그대로 번호만 붙이면 된다. SQL에서 ORDER BY를 정확하게 걸어주는 게 핵심이다.

```sql
SELECT *
FROM rankings
ORDER BY score DESC, total_play_time ASC, created_at ASC;
```

---

## Play Store 자산 제작

이게 예상보다 손이 많이 갔다. 필요한 파일 목록부터 정리하면 이렇다.

| 자산 | 사이즈 | 형식 |
|---|---|---|
| 앱 아이콘 | 512 × 512 | PNG (32bit) |
| 피처 그래픽 | 1024 × 500 | PNG 또는 JPG |
| 스크린샷 | 최소 2장, 최대 8장 | PNG 또는 JPG |
| 개인정보처리방침 | — | URL (외부 링크) |

### SVG로 먼저 만들고 PNG로 변환

디자인 툴이 없으니 SVG로 직접 작성했다. Figma나 Illustrator 없이도 충분히 만들 수 있다.

아이콘과 피처 그래픽을 SVG로 만든 다음, Chrome headless로 PNG 변환했다.

```bash
# SVG → PNG 변환 (Chrome headless)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --screenshot=icon_512.png \
  --window-size=512,512 \
  icon.svg

# HTML 목업 → PNG
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --screenshot=screenshot_gameplay.png \
  --window-size=1080,1920 \
  screenshot_gameplay.html
```

스크린샷은 실제 기기 화면을 캡처하는 것보다 HTML로 목업을 만들어서 변환하는 방식이 훨씬 편했다. 크기도 원하는 대로 조절할 수 있고, 텍스트나 배경도 자유롭게 넣을 수 있다.

### 개인정보처리방침

Play Store는 개인정보처리방침 URL을 반드시 요구한다. GitHub Pages로 호스팅하면 무료로 해결된다.

```
https://<username>.github.io/<repo>/privacy-policy
```

한국어 앱이라도 영문 버전을 함께 제공하는 게 좋다. 글로벌 출시 시 리뷰가 빠르다.

파일 구조는 이렇게 했다.

```
docs/
  privacy-policy/
    index.html        # 영문
    ko/index.html     # 한국어
```

`docs/` 폴더를 GitHub Pages 소스로 설정하면 바로 접근 가능하다.

---

## Android AAB 빌드

### Step 1: 네이티브 코드 생성

Expo managed workflow에서 bare workflow로 전환하는 단계다.

```bash
expo prebuild --platform android
```

이 명령어 한 번으로 `android/` 폴더가 생긴다. 이때부터 네이티브 Android 프로젝트가 된다.

패키지명은 `app.json`에서 미리 설정해야 한다.

```json
{
  "expo": {
    "android": {
      "package": "com.backdev.tilt"
    }
  }
}
```

패키지명은 나중에 바꾸기가 굉장히 번거롭다. 처음에 신중하게 정하자.

### Step 2: 키스토어 생성

Play Store에 올리는 APK/AAB는 반드시 서명이 되어 있어야 한다. 키스토어는 한 번 만들면 앱 수명 내내 같은 걸 써야 한다. 잃어버리면 업데이트를 올릴 수 없으니 백업을 잘 해둬야 한다.

```bash
keytool -genkey -v \
  -keystore tilt-release.keystore \
  -alias tilt \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

생성한 키스토어 정보를 `android/gradle.properties`에 넣는다.

```properties
MYAPP_UPLOAD_STORE_FILE=tilt-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=tilt
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

`android/app/build.gradle`에서 release 서명 설정도 연결해야 한다.

```groovy
android {
    signingConfigs {
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### Step 3: 불필요한 권한 제거

Expo 기본 템플릿에는 필요 없는 권한이 꽤 붙어 있다. Play Store 심사에서 "이 권한을 왜 쓰나요?"라고 물어보는 경우가 있으니 미리 정리하는 게 좋다.

`android/app/src/main/AndroidManifest.xml`에서 제거할 권한에 `tools:node="remove"`를 달면 된다.

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- 카메라 권한 제거 -->
    <uses-permission android:name="android.permission.CAMERA"
        tools:node="remove" />

    <!-- 녹음 권한 제거 -->
    <uses-permission android:name="android.permission.RECORD_AUDIO"
        tools:node="remove" />
</manifest>
```

`tools:node="remove"`는 상속받은 권한도 삭제해준다. 직접 `<uses-permission>`을 아예 안 쓰는 것보다 이 방식이 더 확실하게 제거된다.

### Step 4: AAB 빌드

```bash
cd android
./gradlew bundleRelease
```

빌드가 성공하면 다음 경로에 파일이 생긴다.

```
android/app/build/outputs/bundle/release/app-release.aab
```

이번 경우엔 64MB 정도 나왔다. Play Store 업로드 파일 크기 제한은 150MB이니 여유 있다.

빌드 시간이 처음엔 꽤 오래 걸린다. 두 번째부터는 캐시 덕에 빠르다.

---

## 자주 쓰는 명령어 모음

```bash
# 네이티브 코드 생성 (처음 한 번)
expo prebuild --platform android

# 릴리즈 AAB 빌드
cd android && ./gradlew bundleRelease

# 빌드 캐시 초기화 (이상할 때)
cd android && ./gradlew clean

# 키스토어 정보 확인
keytool -list -v -keystore tilt-release.keystore

# Chrome headless 스크린샷
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --screenshot=output.png --window-size=WIDTH,HEIGHT input.html
```

---

## 트러블슈팅

### `JAVA_HOME` 관련 오류

```
ERROR: JAVA_HOME is not set and no 'java' command could be found
```

Android 빌드는 Java가 필요하다. Homebrew로 설치하면 빠르다.

```bash
brew install --cask temurin@17
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

### `gradlew` 권한 오류

```
Permission denied: ./gradlew
```

```bash
chmod +x android/gradlew
```

### 서명 검증 실패

이미 Play Store에 올라간 앱과 키스토어가 다른 경우 업로드가 거부된다. Play App Signing을 사용하면 Google이 최종 서명을 관리해주므로 키스토어 분실 리스크를 줄일 수 있다. 첫 업로드 전에 활성화해두자.

### prebuild 후 기존 변경 사항이 사라진다

`expo prebuild`는 `android/` 폴더를 덮어쓴다. 네이티브 코드를 직접 수정했다면 매번 다시 적용해야 한다. 반복되는 수정은 Expo config plugin으로 자동화하는 게 좋다.

---

## 정리: 출시까지의 흐름

```
1. 버그 수정
   └─ 비동기 상태는 데이터 유무가 아닌 전용 플래그로 관리

2. 기능 개선
   └─ DB 설계 변경 → 클라이언트 로직 단순화

3. 스토어 자산 준비
   └─ SVG로 제작 → Chrome headless로 PNG 변환
   └─ 개인정보처리방침 → GitHub Pages 무료 호스팅

4. Android 빌드
   └─ expo prebuild → 키스토어 생성 → 권한 정리 → bundleRelease

5. Play Store 등록
   └─ AAB 업로드 → 자산 업로드 → 스토어 등록 정보 작성 → 심사 제출
```

처음 해보면 각 단계에서 막히는 지점이 생긴다. 특히 키스토어 설정과 권한 정리는 나중에 되돌리기 어려운 부분이니 첫 빌드 전에 꼼꼼하게 챙겨두는 게 좋다.

빌드가 통과되고 AAB 파일이 생겼을 때의 뿌듯함은 꽤 크다. Play Store 심사는 며칠 걸리지만 그건 기다리면 된다.
