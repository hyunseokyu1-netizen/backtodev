---
title: 'React Native YouTube App — Android WebView Playback, Custom Button, and Keyboard Bugs'
date: '2026-05-04'
publish_date: '2026-05-29'
description: From Android WebView security policies, KeyboardAvoidingView pitfalls, and autoplay timing bugs - here are the issues and solutions we encountered while improving the YT Player app.
tags:
  - ReactNative
  - Expo
  - Android
  - WebView
  - Bugfixes
  - YouTube
---

I've been working on a YouTube playlist app as a personal project. I started with the idea of playing videos in order without YouTube Premium, but I've run into a lot of unexpected issues on Android.

This post summarizes the things I spent all day yesterday dealing with - autoplay bugs, why custom play buttons don't work, and why KeyboardAvoidingView didn't work. I hope it's helpful to those of you who are shoveling similar ground.

---

## Introduction to the Stack

- **React Native + Expo SDK 54** (TypeScript)
- **react-native-youtube-iframe** - YouTube player wrapping library
- For **Android devices

---

## Bug 1 - When a song ends, it doesn't advance to the next song

### Symptoms

Video freezes at the end. It's a playlist and it doesn't automatically play the next song.

### Cause Analysis

If we look at the `onChangeState` callback of `react-native-youtube-iframe`, we get the `'ended'` event when the video ends. Initially, I wrote something like this.

```tsx
const handleStateChange = (state: string) => {
  if (state === 'ended') {
    setPlaying(false); // turn off the playing state
    onEnded(); // call playNext()
  }
};
```

The problem was timing. If we follow the execution sequence:

```
1. receive the 'ended' event
2. call setPlaying(false) → set the playing state to false
3. onEnded() → playNext() → change videoId
4. execute useEffect([item?.videoId]) → try setPlaying(true)
   → but false is already going to be overwritten below...?
```

This is precisely because of React's batch handling of state updates. What happens is that `setPlaying(false) and `setPlaying(true) collide in the same event cycle, eventually rendering to `false`.

More intuitively: **"stop → play next song"** is a contradiction in terms. There is no need to stop if there is a next song.

### Resolved

Change `setPlaying(false)` to only call `onEnded()` when it's the last song, otherwise just call `onEnded()`.

```tsx
// Before the fix
if (state === 'ended') {
  setPlaying(false);
  onEnded();
}

// after modification
if (state === 'ended') {
  if (!hasNext) setPlaying(false); // only stop when last song is played
  onEnded();
}
```

The `hasNext` is calculated as `currentIndex < playlist.length - 1`. This way, `useEffect` does a clean `setPlaying(true)` because the middle songs don't touch the `playing` state.

---

## Bug 2 - Custom play buttons don't work on Android

This is the one I shoveled the longest.

### Symptoms

I have a homemade play/stop button (red circle) in the app, but it doesn't respond when pressed. The YouTube player's own control buttons work fine.

### Cause - Android WebView security policy

YouTube is embedded inside a WebView. And this is where Android's security policy gets in the way.

> **Android WebView does not recognize external native button clicks as "user gestures"**.

For security reasons, the YouTube player only allows `player.playVideo()' to be launched if the user taps it directly. When the native button in your app is pressed, → React Native signals the WebView with a `postMessage` → calls `player.playVideo()` inside the WebView, which is blocked by YouTube because it's not a "user gesture".

```
Click the native button
  → postMessage('playVideo')
  → WebView: call player.playVideo()
  → YouTube: "This wasn't tapped by the user, was it?" → Reject
```

I tried adding the `forceAndroidAutoplay` prop, but that didn't work either. This prop bypasses the autoplay policy, not the playback gesture security.

### Solved - Remove custom play/stop buttons

In conclusion, there is no way around this issue. YouTube's WebView security policies cannot be changed at the library level.

Instead, we've left play/stop to the control of the YouTube player itself, leaving only the previous/next buttons.

The previous/next buttons are fine for a different reason. They don't call `player.playVideo()`, they change the `videoId` at the React Native level. When the `videoId` is changed, the player loads a new video and starts playing it automatically. This is independent of YouTube's playback gesture security.

```tsx
// This won't work - call playVideo() inside the WebView
const handlePlay = () => {
  setPlaying(true); // pass to YouTube via postMessage → rejected
};

// this works - replace videoId at React Native level
const handleNext = () => {
  setCurrentIndex(prev => prev + 1); // new videoId → reload player → play
};
```

At first, I really wanted to include the custom button, but I decided it was better to remove it cleanly than to force something that doesn't work.

---

## Bug 3 - KeyboardAvoidingView is useless on Android

### Symptoms

When you open the URL input modal and tap the input box, the keyboard rises and covers the modal. The input window is hidden behind the keyboard.

### Why KeyboardAvoidingView doesn't work

KeyboardAvoidingView works fine on iOS. On Android, it causes problems, especially when combined with the `Modal` component.

Android has something called edge-to-edge mode. This is when the screen fills the status bar and navigation bar, which messes up the keyboard height calculation.

```tsx
// This won't work on Android
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
> >.
  <Modal>
    <TextInput /> <TextInput
  </Modal>
</KeyboardAvoidingView>
```

behavior="height"` is a way to reduce the overall height of the view, but inside `Modal`, the baseline calculation is incorrect. In fact, the combination of `Modal` + `KeyboardAvoidingView` is officially known to not work well on Android.

### Workaround - Detect Keyboard events directly to adjust paddingBottom

We ditched `KeyboardAvoidingView` in favor of detecting events directly with the `Keyboard` API.

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
}, [visible]); // Enable/disable with modal visible state
```

We've also added `paddingBottom` to the overlay, equal to the height of the keyboard.

```tsx
<View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
  <View style={styles.sheet}>
    {/* Modal content */}
  </View>
</View>
```

When the keyboard is raised, → `keyboardHeight` is updated, → the bottom padding of the overlay is stretched, → and the entire modal is pushed up. Simple, but it works.

The reason we put `visible` in the dependency array is to clean up the listeners when the modal closes and re-register them when it reopens.

---

## UI improvements

In addition to bug fixes, we've made some general UI improvements.

### Header design

It used to be "YT Player" text + song count, but we decided to add a YouTube-esque logo icon.

Emoji rendering is sometimes broken on Android (especially media control emoji like `▶`), so I drew a triangle by hand using the View and border trick.

```tsx
// Drawing a playback triangle with the CSS border trick
const styles = StyleSheet.create({
  logoIcon: {
    width: 32,
    height: 22,
    backgroundColor: '#cc0000', // YouTube red
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

### Resize the player

We've reduced the height of the video to show more of the playlist.

| Item | Before | After |
|---|---|---|---|
| player-height | `width * 9/16` | `width * 9/21` |
| item paddingVertical | 10 | 7 | | item paddingVertical | 10 | 7
| thumbnailSize | 72 × 48 | 64 × 42 | | thumbnailSize

This is a reduction of about 24%, which is a lot more comfortable for me to see more playlist items on one screen.

### Improved URL add modal

| Element | Content |
|---|---|
| Top drag bar | Gray pill shape - visual indication that it's a bottomsheet |
| Input bar focus | Blue border on focus (toggle borderColor with focused state) |
| Add button | Dark red (#8b1a1a) - distinguishes active/inactive state |
| Bottom hint | Supported URL formatting guidance text |

Handling the focus state is straightforward.

```tsx
const [focused, setFocused] = useState(false);

<TextInput
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
  style={[
    styles.input,
    focused && styles.inputFocused, // blue border on focus
  ]}
/>.
```

### Create an app icon

I used Python + Pillow to generate icons for all resolutions at once. Same design as the header logo (dark background + red rounded square + white playing triangle).

Android adaptive icons need to consider the safe zone. Only 66% of the center of the entire image is visible, so the actual icon content needs to be padded to fit within it.

```python
from PIL import Image, ImageDraw

def create_icon(size):
    img = Image.new('RGBA', (size, size), (18, 18, 18, 255))
    draw = ImageDraw.Draw(img)

    # red rounded rectangle
    margin = size * 0.2
    radius = size * 0.12
    draw.rounded_rectangle(
        [margin, margin * 1.3, size - margin, size - margin * 1.3],
        radius=radius,
        fill=(204, 0, 0, 0, 255)
    )

    # white playback triangle
    cx, cy = size / 2, size / 2
    t = size * 0.14
    draw.polygon(
        [(cx - t * 0.7, cy - t), (cx - t * 0.7, cy + t), (cx + t, cy)],
        fill=(255, 255, 255, 255, 255)
    )
    return img
```

### Relocate the Add URL button

We moved the "+ Add URL" button from the header to a floating button at the bottom right of the playlist. The header was too cluttered, and the floating button is easier to access (within thumb reach).

```tsx
// Floating button position - above the navigation bar
<TouchableOpacity
  style={[
    styles.fab,
    { bottom: 16 + bottomInset } // Consider SafeArea inset
  ]}
  onPress={() => setModalVisible(true)}
> >
  <Text style={styles.fabText}>+ Add URL</Text>
</TouchableOpacity>
```

---

## Cleanup

Let's recap what we did today:

| Problem | Core Cause | Solution |
|---|---|---|---|
| Autoplay not working | playing state conflict (false → true timing) | don't setPlaying(false) when next song is present
| Custom play button unresponsive | Android WebView security policy - external clicks are not gestures | Remove custom button, use YouTube built-in controls
| Modal obscured by keyboard | KeyboardAvoidingView miscalculated on Modal + edge-to-edge | Detect Keyboard event directly → apply paddingBottom | Android WebView Security Policy - Clicking is not a gesture | Remove custom buttons, use YouTube controls

When building Android apps with React Native, WebView-related issues are particularly hard to find resources for. It takes me a lot of time to get from "why not?" to "oh, this is why", and I hope this post will save you some of that time.

Next time, I'm going to add drag-and-drop playlist ordering. New Architecture and reanimated conflict with each other, so for now I'm using the ▲▼ buttons, but if I come up with a better way, I'll share it.
