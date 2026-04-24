---
title: >-
  [Claude Console] Buy Credits button is disabled - Causes and solutions for not
  checking out
date: '2026-04-24'
description: >-
  In the Claude Console, the Buy button would not activate even after all
  payment information was entered. The cause was a bug that reset the city
  selection when switching languages.
tags:
  - Claude
  - ClaudeConsole
  - Troubleshooting
---

I signed up for the console to try out the Claude API and tried to top up my credit. I entered my card information, address and everything, but the purchase button is still disabled.

I spent a couple of days trying different things, and the bottom line is - it's a bug that resets the City selection when the language is switched on the checkout page.

---.

## Symptoms

The Buy button is not pressed even when all payment information is entered.

![Buy button disabled after entering payment information](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_34_38_1776992406711.png)

I double-check the address fields one by one and they all seem to be filled in.

![주소 필드 입력 화면](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_34_54_1776992462771.png)

After filling in all the fields, the button is still not activated.

![여전히 비활성화된 버튼](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_29_1776992519033.png)

---]

## Find the cause

I unchecked the `Shipping address and billing address are the same` checkbox to verify the shipping address manually.

![체크박스 해제 후 배송 주소 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_42_1776992546908.png)

It was clearly checked and set to the same as the billing address, but the **City select box was blank.

![도시 선택값이 비어 있는 상태](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_36_53_1776992622408.png)

When the language of the checkout page switches from English to another language, the values entered in the select boxes don't seem to be picked up.

---]

## Resolved

1. Uncheck the box "Shipping address and billing address are the same
2. manually select the **City** field for the shipping address
3. the Buy button is activated

![버튼 활성화 확인](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-04-24_______12_37_06_1776992714184.png)

---]

## Cleanup

| Situation | Things to check |
|---|---|
| Buy button is disabled | Make sure that the City select box is actually checked |
| `Billing=Shipping` is checked but not working | Uncheck it and manually select the shipping address city |

It seems to be a bug that resets the select box values when switching languages, which can be confusing because it looks like it's populated.

This ended up messing up one of my accounts, so the API created a separate account with a development email. I was going to separate the accounts later anyway, so I figured it was a good idea.
