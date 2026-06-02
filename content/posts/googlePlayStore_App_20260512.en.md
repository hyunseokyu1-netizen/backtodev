---
title: 'Google Play Store App Registration A-Z - The whole process with screenshots'
date: '2026-05-12'
description: A hands-on, screenshot-filled guide to the entire Google Play Console process, from creating an app to passing a private test.
tags:
  - googleplay
  - Android
  - AppStore
  - app launch
---

When you first publish your app to the Google Play Store, the console UI is more complicated than you might think. There are many places where it's confusing to know where to press what.

I've summarized the entire process based on screenshots I captured during registration.

--- --- ------.

## Overall flow

```
Sign up for Google Play Console ($25)
  → Create your app
  → Internal testing (optional)
  → Private test (required - 12 people × 14 days)
  → Complete the to-do list
  → Set up store properties
  → Submit review → Approve → Launch
```

**Key condition**: Current Google policy requires **12 people in private testing for at least 14 days (2 weeks) before a public release is possible.**

---

## Step 1 - Create your app

Create a new app in the Google Play Console.

![앱 만들기](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_30_56_1778551894292.png)
![앱 만들기 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_31_13_1778551926470.png)

Inputs: app name, package name, default language, and a choice of paid or free

![앱 정보 입력](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_34_24_1778551990911.png)
![앱 정보 입력 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_34_44_1778552005411.png)

Package name format: `com.companyname.appname`

---

## Step 2 - Internal Testing (optional)

Internal testing is not required, but it has the advantage of allowing you to quickly create and verify a link to install your app. It's a good way to verify your own installation while waiting for private test approval.

### Register as a tester and create a version

![내부 테스트](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_36_27_1778552076633.png)
![내부 테스트 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_36_43_1778553088756.png)

Sequence: Select a tester → Create a new version → Preview and verify the version

![테스터 추가](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_04_1778553136935.png)

Add a list of tester emails:

![테스터 이메일](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_14_1778553180264.png)
![테스터 이메일 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_37_27_1778553225128.png)

### Upload the AAB file

![버전 만들기](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_38_04_1778553260112.png)
![버전 만들기 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_51_51_1778553288265.png)

Upload the App Bundle (`.aab`) file.

![AAB 업로드](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_51_45_1778553317275.png)
![업로드 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_57_55_1778553383650.png)

### Write release notes

![출시 정보](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_58_10_1778553417638.png)

For multilingual support, specify the language tag
- English: `<en-US>`
- Korean: `<ko-KR>`

You can ignore the warning message.

![경고 무시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_59_22_1778553629271.png)

Save and launch:

![저장 및 출시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11_______11_59_34_1778553601760.png)

### Verify release

![출시 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-11______12_00_04_1778553865311.png)

**The green checkmark is key. If it looks like "Under Review", you need to wait for Google approval. Once approved, the link to invite testers will be active.**

![링크 활성화](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_47_24_1778554088406.png)

> Since private test approval takes time, we recommend that you create an internal test link first to verify your installation.

---

## Step 3 - Private test (required)

Mandatory step for public release. Requires **12 testers participating for at least 14 days**.

### Create a track

![비공개 테스트](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_28_1778554207528.png)

In the Google Play Console, version units are called "tracks". You can organize them as Alpha/Beta, or if you're confused, Track1 and Track2.

> You should update your tracks periodically, even during private testing. If they are not updated, they may be rejected.

**Procedure:** Create track → Select country → Select testers → Create new version → Preview version → Send version to Google

![비공개 테스트 순서](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_41_1778554730753.png)

### Select country

![국가 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_46_53_1778554859534.png)
![국가 선택 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_07_1778554879268.png)

If there's no reason to limit it, you can select all.

![국가 전체 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_17_1778554905020.png)

> After completing each page, I get a popup asking "Would you like to go to the publishing overview?", but clicking "Go to overview" takes me to the dashboard and breaks my workflow. **It's easier to hit the "Later" button and go back and continue working.**

### Setting up testers - recommend utilizing Google Groups

![테스터 선택](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_26_1778555110625.png)

If I manually add people by email, I have to approve them and they have to wait. **With Google Groups, users can join the group directly and join right away.**

![테스터 이메일 방식](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_47_37_1778555142663.png)

---

## Step 4 - Create Google Groups

![Google Groups](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_48_13_1778555372662.png)

**Privacy settings are important - if they're too restrictive, people will give up on joining.**

![Google Groups 설정](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_49_20_1778555416592.png)

**Recommended settings:**

| Items | Settings |
|------|--------|
| Group Search | Open to everyone on the web |
| Join a group | Anyone can join |
| Browse conversations | open to anyone on the web
| Create posts | Group members |
| View members | Group admin |

![그룹 만들기 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_49_42_1778551636467.png)

![그룹 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_50_31_1778555679096.png)
![그룹 주소 복사](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_50_56_1778555700028.png)

Copy the group address email (`이름@googlegroups.com`) from the group information.

---

## Step 5 - Connect Google Groups to the tester

![Google Groups 연결](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_51_19_1778555775154.png)

In the tester settings, select Google Groups and add the group email you copied.

---

## Step 6 - Register your comment URL/email

![의견 이메일](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_51_38_1778555814447.png)

We recommend that you create and manage a separate email account for your store, as you will receive more emails about your app than you think.

---

## Step 7 - Process your to-do list

You should expand the "To Do View" of your dashboard and complete the items below one by one.

![앱 설정 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_39_1778556008313.png)
![할 일 목록](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______10_52_53_1778556103595.png)

### Privacy Policy

![개인정보처리방침](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_02_56_1778556377545.png)

You must have a URL for your privacy policy. You can either create a separate site, or create a web-viewable page with GitHub Pages.

![개인정보처리방침 입력](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_01_21_1778556450713.png)
![나중에 버튼](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_______11_03_05_1778556542324.png)

### App access permissions

![앱 액세스](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_30_12_1778556687129.png)

### Ads

![광고](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_32_48_1778556787949.png)

### Content rating

Questionnaire format. **Answering "yes" to any item will result in more questions.** Answering "yes" to items related to violence will result in more detailed questions, so it's easier to answer "no" to items that don't apply.

![콘텐츠 등급](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_33_43_1778556836906.png)
![설문지 카테고리](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_34_50_1778556911063.png)
![폭력성 선택 시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_36_12_1778556999923.png)
![추가 질문 예시](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_16_1778557232488.png)
![추가 질문 예시 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_28_1778557248811.png)
![추가 질문 예시 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_39_1778557261422.png)
![추가 질문 예시 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_39_49_1778557273775.png)

A list of cases with only 'no' answers:

![아니요 목록](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_41_38_1778557343685.png)
![아니요 목록 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_42_09_1778557356630.png)
![아니요 목록 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_43_23_1778557438801.png)

> After completing the survey, you must press the **Save** button to activate the **Next** button, as it will not automatically advance.

![저장 후 다음 활성화](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______12_45_41_1778564914759.png)

Check the summary:

![콘텐츠 등급 요약](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_49_03_1778565011095.png)

### Target Audience

![타겟층](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_50_27_1778565070916.png)
![타겟층 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_50_44_1778565092284.png)
![타겟층 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_51_46_1778565172139.png)
![타겟층 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_51_56_1778565239015.png)
![타겟층 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_52_09_1778565258642.png)
![타겟층 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12______2_52_16_1778565274931.png)

### Data security

![데이터 보안](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_14_59_33_1778565615802.png)
![데이터 보안 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_14_59_48_1778565629331.png)
![데이터 보안 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_00_47_1778565697123.png)
![데이터 보안 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_22_05_1778566948272.png)

If your app's target audience includes children, you must select "Yes" when asked if you "comply with the Google Play Family Policy" to proceed to the next step.

![데이터 보안 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_23_57_1778567066107.png)
![데이터 보안 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_01_12_1778565715512.png)

### Government apps

![정부 앱](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_26_29_1778567208159.png)

### Financial features

![금융 기능](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_27_12_1778567259406.png)
![금융 기능 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_27_27_1778567268841.png)

You'll need to select "App does not offer financial features" to move on.

### Health

![건강](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_29_10_1778567388656.png)
![건강 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_29_34_1778567402939.png)

---

## Step 8 - App category and contact details

![앱 카테고리](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_30_32_1778567447349.png)
![앱 카테고리 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_31_11_1778567618242.png)
![앱 카테고리 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_32_10_1778567637309.png)
![앱 카테고리 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_32_20_1778567652196.png)
![앱 카테고리 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_34_29_1778567755539.png)
![앱 카테고리 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_35_26_1778567798505.png)

---

## Step 9 - Set up your store properties

Register the description and images that will appear in your store for each language.

![스토어 등록정보](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_21_47_1778635429482.png)
![스토어 등록정보 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_23_1778635440147.png)
![스토어 등록정보 3](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_41_1778635454873.png)
![스토어 등록정보 4](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_49_1778635468031.png)
![스토어 등록정보 5](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_22_56_1778635478168.png)
![스토어 등록정보 6](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_23_06_1778635487330.png)

Images need to be added as assets when registering. After uploading, you need to click "Send file → Add" to actually add it.

![이미지 등록](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_35_11_1778638764027.png)
![이미지 등록 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_10_35_29_1778638804657.png)

Each section allows different image sizes. It is recommended that you check the size requirements for each section and prepare your images before uploading.

![이미지 사이즈 오류](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_22_03_1778639032518.png)

---

## Step 10 - Submit for review and wait for approval

Once everything is complete, submit the review and the status bar will change to "Under Review".

![검토 전송](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-12_15_36_58_1778567894474.png)
![검토 중](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_52_55_1778640841863.png)
![검토 중 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_53_09_1778640870670.png)

### If you find a problem

If Google finds something you missed, it will let you know which part is the problem. Follow the instructions to fix it and resubmit.

![문제 발견](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_46_03_1778640429631.png)
![문제 발견 2](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_46_13_1778640456014.png)

### Approved

After sending, you'll see "Changes are being reviewed".

![전송 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_55_53_1778641001907.png)
![비공개 테스트 검토 중](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_11_54_56_1778641050306.png)

**When the icon changes to a green checkmark**, you can share the link with your testers and let them install it.

![승인 완료](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-05-13_12_00_31_1778641319462.png)

---

## Clean up the overall flow

```
1. sign up for Google Play Console ($25)
        ↓
2. create an app (package name, language, free)
        ↓
3. internal testing [optional] - get a quick install link
        ↓
4. private testing [required]
   - Recruit testers with Google Groups
   - 12 people × 14 days to meet
        ↓
5. complete the to-do list
   Privacy policy - Access rights - Ads - Content rating
   Target audience - Data security - Government apps - Financial features - Health
        ↓
6. App category + store information (description-image)
        ↓
7. submit review → fix and resubmit if there are any problems
        ↓
8. check the green checkmark → share the tester link
```

**3 key tips:**

1. test internally first - install and validate yourself while waiting for private test approval
2. use Google Groups - recruit testers with a single group link instead of manually adding emails
3. use the 'Later' button - hit 'Later' at each step instead of 'Go to Overview' to avoid breaking the workflow
