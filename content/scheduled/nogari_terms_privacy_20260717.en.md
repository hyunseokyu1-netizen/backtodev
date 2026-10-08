---
title: 'Does a Non-Commercial Side Project Still Need Terms of Service? — Why I Added Legal Pages to Nogari'
date: '2026-07-17'
publish_date: '2026-12-12'
description: Realizing that even a hobby project with no business registration still carries content moderation and privacy disclosure obligations, and documenting how I handled them
tags:
  - Side Projects
  - Terms of Service
  - Privacy Policy
  - Information & Communications Network Act
  - Next.js
---

## "Should I Make the Server Look Like It's Overseas?"

I was getting ready to start promoting Nogari (my anonymous community project). Then, out of nowhere, I got scared. There are rooms about politicians where real names and titles show up as-is, and even without outright profanity, it's a place where sharp-edged talk behind people's backs happens. The thought hit me: "what if someone reports this or sues?" So I seriously asked myself a question.

> "I'm about to promote Nogari — should I make the server look like it's located overseas?"

The answer that came back was clear. **Disguising it doesn't reduce legal risk.** If anything, it could work against me as evidence of "intentional concealment" if a problem ever came up. The real line of defense wasn't hiding — it was **properly setting up terms of service and a process that runs from report to temporary measures.**

This post agrees with that conclusion and walks through the process of actually building the `/terms` and `/privacy` pages. If you're thinking "it's just a free service I made for fun, do I really need this much," you're probably wrestling with the same question I was.

## Business Registration Obligations and Privacy Disclosure Obligations Are Separate

This was the first thing that confused me. "I have no ads and no payments — a non-revenue personal project — is it even okay to put up terms of service without a business registration?"

The short answer: these are two completely different tiers of obligation.

| Category | Governing law | When it applies |
|---|---|---|
| Mail-order business registration, business registration | E-Commerce Act, Value-Added Tax Act | Only applies to continuous, repeated business activity carried out for profit |
| Content/post management liability (temporary measures) | Network Act (Information and Communications Network Act), Art. 44-2 | Applies unconditionally to any information and communications service provider, regardless of profit |
| Privacy processing notice | Personal Information Protection Act | Applies from the moment personal data is processed, regardless of profit |

In other words, I'm not subject to business registration or mail-order business reporting, but **the moment I handle posts and store users' device information (an anonymous hash)**, obligations under the Network Act and the Personal Information Protection Act apply regardless. The fact that I "run this for free, as a hobby" doesn't exempt me from these obligations.

So I left this reasoning as a comment at the top of the page.

```tsx
// 노가리는 광고·유료 기능이 없는 무수익 개인 프로젝트라, 통신판매업 신고나
// 사업자등록 대상이 아니다(전자상거래법·부가가치세법상 의무는 영리 목적의
// 계속·반복적 사업 활동에 붙는다). 다만 정보통신망법상 게시물 관리 책임과
// 개인정보 처리 의무는 사업자 등록 여부와 무관하게 적용되므로, 운영자를
// "개인"으로 정직하게 표기하고 그 의무만 충실히 정리한다.
```

Not having to lie about anything was actually a relief. I can honestly write "I'm a private individual operator, not a business" and still fulfill the legal obligations as they stand.

## Step 1: Adding Network Act Article 44-2 (Temporary Measures) to the Terms of Service

The core of it was spelling out "what happens if someone reports defamation or a rights violation." Network Act Article 44-2 sets out the procedure a service provider must follow in this situation — a provision stating that upon receiving a request, temporary measures (blocking access for up to 30 days) can be taken on the post immediately.

```tsx
<em>정보통신망 이용촉진 및 정보보호 등에 관한 법률 제44조의2</em>에
따라 요청을 받은 즉시 해당 게시물에 대해 임시조치(최대 30일간 접근
차단)를 할 수 있으며, 권리침해 여부 판단이 곤란한 경우에는 30일 내
범위에서 조치를 유지할 수 있습니다. 삭제 요청은 아래 연락처로
접수합니다.
<p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
  문의/신고: nogari.nara@protonmail.com
</p>
```

I also nailed down the scope of the operator's responsibility alongside this. I spelled out that primary responsibility for the content of a post lies with the user who wrote it, and the operator's role is to "faithfully carry out the procedures for receiving reports and taking temporary measures."

```tsx
운영자는 이용자가 게시한 정보·내용의 신뢰성, 정확성에 대해 사전
편집·검수할 책임을 지지 않으며, 게시물의 내용에 대한 1차적 책임은
이를 작성한 이용자 본인에게 있습니다. 다만 운영자는 신고 접수 및
임시조치 등 관련 법령이 정한 절차를 성실히 이행합니다.
```

For this clause to actually mean anything, "we act when we receive a report" has to be a feature that genuinely works — not just a declaration on paper. Nogari already had a report → AI first-pass classification → human final review pipeline (I covered this in an earlier post about the report system), and this time I added filtering and search to the admin report page so reports actually get processed instead of getting buried. Keeping the document and the code from drifting apart from each other mattered a lot.

## Step 2: A Privacy Policy Starts with Being Honest About "What's Actually Stored"

Nogari has no sign-up. It collects no name, no email, no phone number. But that doesn't mean a privacy policy is unnecessary — to prevent abuse, I store an irreversible per-device hash (HMAC), and I maintain an anonymous session via cookies. This, too, can qualify as "processing of personal data" under the Personal Information Protection Act.

So at the very top of the policy, I wrote down the principle that it reflects the actual implementation exactly as it stands.

```tsx
// 회원가입이 없는 완전 익명 서비스라 이름·이메일 등은 아예 수집하지 않는다.
// 실제로 저장되는 건 (1) 부정이용 방지용 익명 해시(device_hash, 되돌릴 수
// 없는 HMAC — src/lib/device-hash.ts)뿐이고, IP는 현재 애플리케이션
// 레벨에서 별도로 기록하지 않는다(Supabase/Vercel 등 인프라 접속 로그에는
// 통신비밀보호법에 따라 남을 수 있음). 이 문서는 그 실제 구현에 맞춰 작성했다.
```

Two things I was careful about here.

1. **Making the collected items match the code 1:1.** I only listed three things: "device identifier hash," "cookies," and "images uploaded by users." I didn't pad the list by pretending to collect things I don't actually store (name, email, application-level IP logging).
2. **Not hiding the infrastructure-level gray area either.** I noted in parentheses that IPs can end up in access logs from infrastructure providers like Supabase or Vercel themselves, under the Protection of Communications Secrets Act. Writing it plainly causes less headache down the road than glossing over it.

Retention periods follow the same approach: the principle is "destroyed without delay once the purpose is fulfilled," while statutory exceptions remain in place, such as the 3-12 month retention period for communication confirmation data required under the Protection of Communications Secrets Act.

## Step 3: Linking from the Footer So It Can Be Found from Anywhere

No matter how well-written, it's meaningless if nobody can find it. I added links to both pages in the site footer so they're reachable from any page. I blocked search engine exposure with `robots: { index: false }` — legal documents aren't content meant to attract search traffic; it's enough that they can be found when needed.

## Troubleshooting: Where to Draw the Line When You're Thinking "Do I Really Need to Go This Far?"

The thought that kept nagging me while writing this was "can I actually keep all of this, isn't this overkill?" Here's the bar I set.

- **Only promise what I'm actually doing.** For example, I left out SLA-sounding phrasing I wasn't sure I could keep, like "all reports handled within 24 hours." I kept the wording to something like "faithfully carried out," and reflected the actual handling process (AI first-pass classification + human final review) that was already implemented.
- **Don't pretend to have what doesn't exist.** There was a temptation to throw in boilerplate about account deletion or requests to view personal data, but since there's no account to begin with, I explicitly marked those as not applicable.
- **Keep at least one contact channel genuinely alive.** I listed a report/inquiry email address, and actually confirmed it works. A contact address that exists only on paper, with no one on the receiving end, actually undermines trust.

## Wrap-Up

Being a non-revenue personal project doesn't exempt you from terms of service and a privacy policy. To sum up:

1. **Business registration obligations** and **content moderation/privacy disclosure obligations** are separate duties coming from different laws. Not having the former doesn't mean you're exempt from the latter.
2. Disguising or hiding doesn't reduce risk. Real defense means documenting a **report → temporary measures process** in line with Network Act Article 44-2, and making sure it actually works.
3. A privacy policy should honestly state only "what we actually store." Even without sign-up, storing an anonymous hash or cookies can itself qualify as processing personal data.
4. The document must not drift from the code. If the document says "reports are handled faithfully," it's only natural that the work extends to polishing the admin screen so that handling doesn't actually get buried.

Even a project that started as a hobby reaches a point, once people actually start using it, where "this should be fine" no longer holds up. I'm glad I sorted this out before traffic grew any bigger.
