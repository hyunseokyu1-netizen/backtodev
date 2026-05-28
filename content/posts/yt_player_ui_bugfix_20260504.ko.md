---
title: 'React Native YouTube 앱 만들면서 삽질한 것들 — Android WebView 재생 버그부터 키보드 이슈까지'
date: '2026-05-04'
publish_date: '2026-05-29'
description: Android WebView 보안 정책, KeyboardAvoidingView 함정, 자동재생 타이밍 버그까지 — YT Player 앱 개선 과정에서 만난 문제와 해결법을 정리했다
tags:
  - ReactNative
  - Expo
  - Android
  - WebView
  - 버그수정
  - YouTube
---

요즘 개인 프로젝트로 YouTube 플레이리스트 앱을 만들고 있다. YouTube Premium 없이도 영상을 순서대로 재생하려고 시작한 건데, 생각보다 Android에서 예상치 못한 문제들이 많이 튀어나왔다.

이번 포스트는 어제 하루 종일 씨름한 것들 — 자동재생 버그, 커스텀 재생 버튼이 왜 안 되는지, KeyboardAvoidingView가 왜 소용없었는지 — 를 정리해봤다. 비슷한 삽질을 하는 분들에게 도움이 됐으면 좋겠다.

---

## 스택 소개

- **React Native + Expo SDK 54** (TypeScript)
- **react-native-youtube-iframe** — YouTube 플레이어 래핑 라이브러리
- **Android 실기기** 대상

---

## 버그 1 — 곡이 끝나면 다음 곡으로 안 넘어가는 문제

### 증상

영상이 끝나면 멈춘다. 플레이리스트인데 자동으로 다음 곡이 재생되지 않는다.

### 원인 분석

`react-native-youtube-iframe`의 `onChangeState` 콜백을 보면 영상이 끝날 때 `'ended'` 이벤트가 온다. 처음에는 이렇게 짰다.

```tsx
const handleStateChange = (state: string) => {
  if (state === 'ended') {
    setPlaying(false); // 재생 상태 끄기
    onEnded();         // playNext() 호출
  }
};
```

문제는 타이밍이었다. 실행 순서를 따라가 보면:

```
1. 'ended' 이벤트 수신
2. setPlaying(false) 호출 → playing 상태가 false로 확정
3. onEnded() → playNext() → videoId 변경
4. useEffect([item?.videoId]) 실행 → setPlaying(true) 시도
   → 그런데 이미 false가 아래에서 덮어쓸 예정...?
```

정확히는 React의 상태 업데이트 배치 처리 때문이다. `setPlaying(false)`와 `setPlaying(true)`가 같은 이벤트 사이클 안에서 충돌하면서, 결국 `false`로 렌더링되는 경우가 생긴다.

더 직관적으로 보면: **"정지시키고 → 다음 곡 틀어라"** 라는 순서 자체가 모순이다. 다음 곡이 있으면 정지할 필요가 없다.

### 해결

마지막 곡일 때만 `setPlaying(false)`, 그 외엔 그냥 `onEnded()`만 호출하도록 바꿨다.

```tsx
// 수정 전
if (state === 'ended') {
  setPlaying(false);
  onEnded();
}

// 수정 후
if (state === 'ended') {
  if (!hasNext) setPlaying(false); // 마지막 곡일 때만 정지
  onEnded();
}
```

`hasNext`는 `currentIndex < playlist.length - 1`으로 계산한다. 이렇게 하면 중간 곡들은 `playing` 상태를 건드리지 않으니까 `useEffect`가 깔끔하게 `setPlaying(true)`를 실행한다.

---

## 버그 2 — 커스텀 재생 버튼이 Android에서 동작하지 않는 문제

이게 가장 오래 삽질한 부분이다.

### 증상

앱에 직접 만든 재생/정지 버튼(빨간 원)이 있었는데, 눌러도 반응이 없다. YouTube 플레이어 자체 컨트롤 버튼은 잘 된다.

### 원인 — Android WebView 보안 정책

YouTube는 WebView 안에 임베드된다. 그리고 여기서 Android의 보안 정책이 발목을 잡는다.

> **Android WebView는 외부 네이티브 버튼 클릭을 "사용자 제스처"로 인정하지 않는다.**

YouTube 플레이어는 보안상 이유로 `player.playVideo()`를 사용자가 직접 탭한 경우에만 실행을 허용한다. 앱의 네이티브 버튼을 누르면 → React Native가 `postMessage`로 WebView에 신호를 보내고 → WebView 안에서 `player.playVideo()`를 호출하는데, 이 호출이 "사용자 제스처"가 아니라는 이유로 YouTube가 막아버린다.

```
네이티브 버튼 클릭
  → postMessage('playVideo')
  → WebView: player.playVideo() 호출
  → YouTube: "이거 사용자가 직접 탭한 게 아니잖아?" → 거부
```

`forceAndroidAutoplay` prop을 추가해봤지만 이것도 소용없었다. 이 prop은 자동재생 정책을 우회하는 거지, 재생 제스처 보안을 우회하는 게 아니기 때문이다.

### 해결 — 커스텀 재생/정지 버튼 제거

결론적으로 이 문제는 우회할 방법이 없다. YouTube의 WebView 보안 정책은 라이브러리 수준에서 바꿀 수 없다.

대신 **이전/다음 버튼만 남기고** 재생/정지는 YouTube 플레이어 자체 컨트롤에 맡겼다.

이전/다음 버튼이 괜찮은 이유는 다르기 때문이다. 이 버튼들은 `player.playVideo()`를 호출하는 게 아니라, React Native 레벨에서 `videoId` 를 바꿔버린다. `videoId`가 바뀌면 플레이어가 새 영상을 로드하면서 자동으로 재생이 시작된다. YouTube의 재생 제스처 보안과 무관하게 동작하는 것이다.

```tsx
// 이건 안 됨 — WebView 안에서 playVideo() 호출
const handlePlay = () => {
  setPlaying(true); // postMessage 통해 YouTube에 전달 → 거부됨
};

// 이건 됨 — React Native 레벨에서 videoId 교체
const handleNext = () => {
  setCurrentIndex(prev => prev + 1); // 새 videoId → 플레이어 재로드 → 재생
};
```

처음엔 커스텀 버튼을 꼭 넣고 싶었는데, 안 되는 걸 억지로 넣는 것보다 깔끔하게 제거하는 게 낫다고 판단했다.

---

## 버그 3 — KeyboardAvoidingView가 Android에서 무용지물인 문제

### 증상

URL 입력 모달을 열고 입력창을 탭하면 키보드가 올라오면서 모달을 가린다. 입력창이 키보드 뒤에 숨어버린다.

### 왜 KeyboardAvoidingView가 안 되는가

`KeyboardAvoidingView`는 iOS에서는 잘 된다. Android에서는 특히 `Modal` 컴포넌트와 조합할 때 문제가 생긴다.

Android에는 edge-to-edge 모드라는 게 있다. 화면이 상태바, 네비게이션바까지 가득 채우는 방식인데, 이 모드에서는 키보드 높이 계산이 꼬인다.

```tsx
// 이렇게 쓰면 Android에서 안 됨
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  <Modal>
    <TextInput />
  </Modal>
</KeyboardAvoidingView>
```

`behavior="height"`는 뷰 전체 높이를 줄이는 방식인데, `Modal` 내부에서는 기준점 계산 자체가 틀리게 된다. 사실 Android에서 `Modal` + `KeyboardAvoidingView` 조합은 공식적으로도 잘 안 된다고 알려져 있다.

### 해결 — Keyboard 이벤트를 직접 감지해서 paddingBottom 조절

`KeyboardAvoidingView`를 버리고, `Keyboard` API로 이벤트를 직접 감지하는 방식으로 바꿨다.

```tsx
const [keyboardHeight, setKeyboardHeight] = useState(0);

useEffect(() => {
  const show = Keyboard.addListener('keyboardDidShow', (e) => {
    setKeyboardHeight(e.endCoordinates.height);
  });
  const hide = Keyboard.addListener('keyboardDidHide', () => {
    setKeyboardHeight(0);
  });

  return () => {
    show.remove();
    hide.remove();
  };
}, [visible]); // 모달 visible 상태와 함께 등록/해제
```

그리고 오버레이에 `paddingBottom`을 키보드 높이만큼 더해줬다.

```tsx
<View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
  <View style={styles.sheet}>
    {/* 모달 내용 */}
  </View>
</View>
```

키보드가 올라오면 → `keyboardHeight`가 업데이트되고 → 오버레이의 하단 패딩이 늘어나면서 → 모달 전체가 위로 밀린다. 단순하지만 확실히 동작한다.

`visible`을 의존성 배열에 넣은 이유는 모달이 닫힐 때 리스너를 정리하고, 다시 열릴 때 재등록하기 위해서다.

---

## UI 개선 작업들

버그 수정 말고도 UI를 전반적으로 손봤다.

### 헤더 디자인

기존에는 "YT Player" 텍스트 + 곡 수 카운트였는데, YouTube스러운 로고 아이콘을 넣기로 했다.

Android에서 emoji 렌더링이 깨지는 경우가 있어서 (특히 `▶` 같은 미디어 컨트롤 이모지), View와 border trick으로 삼각형을 직접 그렸다.

```tsx
// CSS border trick으로 재생 삼각형 그리기
const styles = StyleSheet.create({
  logoIcon: {
    width: 32,
    height: 22,
    backgroundColor: '#cc0000', // YouTube 빨간색
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'white',
    marginLeft: 2,
  },
});
```

### 플레이어 크기 조정

영상 높이를 줄여서 플레이리스트를 더 많이 보이게 했다.

| 항목 | 이전 | 이후 |
|---|---|---|
| 플레이어 높이 | `width * 9/16` | `width * 9/21` |
| 아이템 paddingVertical | 10 | 7 |
| 썸네일 크기 | 72 × 48 | 64 × 42 |

약 24% 줄어들었는데, 한 화면에 보이는 플레이리스트 아이템이 더 많아지니까 체감상 훨씬 편해졌다.

### URL 추가 모달 개선

| 요소 | 내용 |
|---|---|
| 상단 드래그 바 | 회색 pill 모양 — 바텀시트임을 시각적으로 표시 |
| 입력창 포커스 | 포커스 시 파란 테두리 (focused state로 borderColor 토글) |
| 추가 버튼 | 진한 빨간(#8b1a1a) — 활성/비활성 상태 구분 |
| 하단 힌트 | 지원 URL 포맷 안내 텍스트 |

포커스 상태 처리는 간단하다.

```tsx
const [focused, setFocused] = useState(false);

<TextInput
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
  style={[
    styles.input,
    focused && styles.inputFocused, // 포커스 시 파란 테두리
  ]}
/>
```

### 앱 아이콘 생성

Python + Pillow로 모든 해상도 아이콘을 한번에 생성했다. 헤더 로고와 같은 디자인 (어두운 배경 + 빨간 둥근 사각형 + 흰 재생 삼각형).

Android adaptive icon은 안전 영역을 고려해야 한다. 전체 이미지의 가운데 66%만 보이기 때문에 실제 아이콘 콘텐츠는 그 안에 들어오게 패딩을 줘야 한다.

```python
from PIL import Image, ImageDraw

def create_icon(size):
    img = Image.new('RGBA', (size, size), (18, 18, 18, 255))
    draw = ImageDraw.Draw(img)

    # 빨간 둥근 사각형
    margin = size * 0.2
    radius = size * 0.12
    draw.rounded_rectangle(
        [margin, margin * 1.3, size - margin, size - margin * 1.3],
        radius=radius,
        fill=(204, 0, 0, 255)
    )

    # 흰 재생 삼각형
    cx, cy = size / 2, size / 2
    t = size * 0.14
    draw.polygon(
        [(cx - t * 0.7, cy - t), (cx - t * 0.7, cy + t), (cx + t, cy)],
        fill=(255, 255, 255, 255)
    )
    return img
```

### URL 추가 버튼 위치 이동

헤더에 있던 "+ URL 추가" 버튼을 플레이리스트 하단 우측 플로팅 버튼으로 옮겼다. 헤더가 너무 복잡해 보여서 정리한 것인데, 플로팅 버튼이 접근하기도 더 편하다 (엄지 닿는 위치).

```tsx
// 플로팅 버튼 위치 — 네비게이션바 위로
<TouchableOpacity
  style={[
    styles.fab,
    { bottom: 16 + bottomInset } // SafeArea inset 고려
  ]}
  onPress={() => setModalVisible(true)}
>
  <Text style={styles.fabText}>+ URL 추가</Text>
</TouchableOpacity>
```

---

## 정리

오늘 작업한 핵심만 다시 짚어보면:

| 문제 | 핵심 원인 | 해결 방법 |
|---|---|---|
| 자동재생 안 됨 | playing state 충돌 (false → true 타이밍) | 다음 곡 있으면 setPlaying(false) 안 함 |
| 커스텀 재생 버튼 무반응 | Android WebView 보안 정책 — 외부 클릭은 제스처 아님 | 커스텀 버튼 제거, YouTube 내장 컨트롤 사용 |
| 키보드에 모달 가려짐 | KeyboardAvoidingView가 Modal + edge-to-edge에서 계산 오류 | Keyboard 이벤트 직접 감지 → paddingBottom 적용 |

React Native로 Android 앱 만들 때 WebView 관련 이슈는 특히 자료 찾기가 어렵다. "왜 안 되지?"에서 "아, 이런 이유구나"로 넘어가는 데 시간이 많이 걸렸는데, 이 포스트가 그 시간을 조금이라도 줄여줬으면 한다.

다음엔 플레이리스트 순서를 드래그로 바꾸는 기능을 붙여보려고 한다. New Architecture랑 reanimated가 충돌해서 지금은 ▲▼ 버튼으로 대체했는데, 좋은 방법이 있으면 또 공유할 예정.
