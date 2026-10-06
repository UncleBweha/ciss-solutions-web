-- Full text for the pages linked from the footer: About, FAQs, Privacy Policy, Terms,
-- Returns & Refunds, Delivery Information and Warranty. Replaces the short starter
-- drafts from 20261004000600. A page staff have already ticked "Reviewed" in
-- Admin, Content pages is left alone.

insert into public.settings (key, value, is_public) values
('page:about', jsonb_build_object(
  'title', 'About CISS Solutions',
  'description', 'CISS Solutions is a Nairobi printer shop selling printers, spare parts, ink and toner, with delivery across Kenya.',
  'reviewed', false,
  'body', $md$CISS Solutions is a printer shop on Taveta Road in Nairobi. We sell printers, the parts that keep them running, and the ink, toner and paper they use. You can buy from us over the counter or order on this website and have it delivered anywhere in Kenya.

## What we sell

- **Printers.** Ink tank, laser, photo and dot matrix models from Epson, Canon, HP, Brother, Pantum and Kyocera.
- **Spare parts.** Pickup rollers, printheads, fuser units, drum units, mainboards, power supplies, cables, gears and the other small parts that are hard to find when a printer stops working.
- **Ink and toner.** Original bottles and cartridges, plus compatible options where we have tested them and are happy with the result. Each listing says clearly which one it is.
- **Scanners, paper and accessories.** Everything else a print shop, school or office goes through in a normal month.

## Who buys from us

Most of our customers fall into three groups. Technicians and repair shops who need a specific part today. Cyber cafes, print shops and schools that print in volume and cannot afford a machine sitting idle. And homes and offices buying one printer and the ink to go with it.

We stock for all three, which is why you will find a single pickup roller next to a full office laser printer.

## Getting the right part

Printer parts are easy to get wrong. Two models that look identical can use different rollers, and a part number that is off by one letter will not fit.

Every spare part on this site lists the printer models it fits. If you know your model, the [parts finder](/parts-finder) will show you what is available for it. If you are not sure what has failed, send us the printer model and a description of the problem through the [part request form](/support/part-request). A photo of the fault or the old part helps. One of our technicians will reply with the part you need and what it costs.

## How ordering works

Add what you need to the cart, enter your delivery details and pay by M-Pesa, bank transfer or, in selected areas, cash on delivery. We confirm every order by email and you can follow it on the [track order](/track-order) page.

Delivery fees and timelines depend on your county. They are shown at checkout before you pay and listed on the [delivery information](/shipping-policy) page.

## Visit or contact us

Taveta Court, 2nd Floor, Room 217, along Taveta Road, Nairobi.

Call or WhatsApp [0721 578 080](tel:+254721578080), or email [info@cisssolutions.co.ke](mailto:info@cisssolutions.co.ke). Opening hours are on the [contact page](/contact).$md$
), true),

('page:faqs', jsonb_build_object(
  'title', 'Frequently asked questions',
  'description', 'Answers about ordering, payment, delivery, spare part compatibility, returns and warranty at CISS Solutions.',
  'reviewed', false,
  'body', $md$## Do I need an account to order?

No. You can check out as a guest with your name, phone number, email and delivery address. An account is useful if you order often, because it saves your addresses and keeps your order history in one place.

## How do I pay?

The options available for your order are shown at checkout. They are:

- **M-Pesa.** You get a prompt on your phone and enter your M-Pesa PIN. The order is confirmed as soon as Safaricom tells us the payment went through.
- **M-Pesa Paybill.** You pay to our Paybill number yourself and use your order number as the account number. We confirm these during working hours.
- **Bank transfer.** Use your order number as the reference. We confirm once the money shows in our account, usually within one business day.
- **Cash on delivery.** Offered in selected areas only. If it is available for your address you will see it at checkout.

## I paid by M-Pesa but my order still shows as unpaid. What now?

Give it a few minutes first. Sometimes the confirmation from Safaricom arrives late. If the status has not changed after 15 minutes, send your order number and the M-Pesa transaction code to us on WhatsApp or by email and we will match the payment by hand. Please do not pay a second time.

## Are your prices final?

The price on the product page is the price of the item. Delivery is added at checkout once we know your county, and any coupon is taken off there too. The total you see before you pay is the total you are charged.

## How long does delivery take?

It depends on where you are. Nairobi orders usually arrive the same day or the next day. Other towns take longer because the parcel goes by courier. The estimate for your county is shown at checkout and on the [delivery information](/shipping-policy) page.

## How do I track my order?

Go to [track order](/track-order) and enter your order number and the phone number you used at checkout. If you have an account, your orders are also listed there.

## How do I know a spare part will fit my printer?

Each part lists the printer models it is compatible with. Check the model name printed on the front of your printer or on the label at the back, then compare it with the list. You can also start from your printer in the [parts finder](/parts-finder).

If your model is not listed, or you are not sure which part has failed, [ask a technician](/support/part-request) before you buy. It is free and it saves a return.

## Are your products genuine?

Printers are new and sold with the manufacturer warranty. Ink, toner and parts are either original or compatible, and each listing states which. We do not sell a compatible product as an original.

## Do you install parts or repair printers?

Parts ordered on the website are supplied for you or your technician to fit. If you would like us to look at a printer, call or WhatsApp us and we will tell you whether it is something we can handle at the shop.

## Can I return something?

Yes, within the conditions in our [returns and refund policy](/refund-policy). In short: tell us quickly, keep the packaging, and do not open ink or toner you intend to return.

## What if my printer or part is faulty?

Contact us with your order number and a description of the fault. Faults covered by warranty are repaired or replaced. See the [warranty page](/warranty) for what is and is not covered.

## Can I change or cancel an order?

Yes, if it has not been dispatched yet. Call or WhatsApp us straight away with your order number. Once the parcel has left the shop it has to be handled as a return.

## Do you sell to businesses and institutions in bulk?

Yes. For bulk orders, quotations or an LPO, email [info@cisssolutions.co.ke](mailto:info@cisssolutions.co.ke) with the items and quantities you need.

## What do you do with my personal details?

We use them to deliver your order, take payment and reply to you. The full detail, including your rights under the Data Protection Act, is in our [privacy policy](/privacy).$md$
), true),

('page:privacy', jsonb_build_object(
  'title', 'Privacy Policy',
  'description', 'What personal data CISS Solutions collects, how we use it and your rights under the Kenya Data Protection Act, 2019.',
  'reviewed', false,
  'body', $md$Last updated: 5 October 2026

This policy explains what personal data CISS Solutions collects when you use this website or buy from us, what we do with it, who we share it with and what rights you have. We handle personal data in line with the Data Protection Act, 2019 of Kenya and the regulations made under it. In this policy we call that law "the Act".

## Who is responsible for your data

CISS Solutions is the data controller for personal data collected through this website. That means we decide why and how your data is used, and we are answerable for it.

- Address: Taveta Court, 2nd Floor, Room 217, along Taveta Road, Nairobi
- Email: [info@cisssolutions.co.ke](mailto:info@cisssolutions.co.ke)
- Phone: [0721 578 080](tel:+254721578080)

Send any question or request about your data to the email address above with the subject "Data protection".

## The data we collect

We only collect what we need to run the shop. Most of it comes directly from you.

### When you place an order

- Your name, email address and phone number
- Your delivery county, town, address and any delivery instructions
- What you ordered, what it cost, any coupon used and any note you add to the order

### When you pay

- The payment method you chose
- For M-Pesa: the phone number that paid, the amount, the transaction code and whether the payment succeeded
- For bank transfer: the reference and amount, so we can match the transfer to your order

We never see or store your M-Pesa PIN. We do not collect or store card numbers.

### When you create an account

- Your name, email address and phone number
- Your password, which is stored in scrambled (hashed) form. Our staff cannot read it.
- Addresses you save, your wishlist and your order history

### When you contact us

- Your name, phone number and email address
- Your message, your printer brand and model, and any photo you attach to a part request
- Messages you send us by WhatsApp, phone or email

### When you write a review

- Your rating and comment, which are published on the product page with your name once approved
- Whether you bought the product from us, so the review can be marked as a verified purchase

### Collected automatically

- Your IP address, which we use to stop abuse such as repeated login or checkout attempts
- Basic technical records kept by our servers, such as the time of a request and whether it failed
- Cookies and similar storage, described below

We do not ask for sensitive personal data such as health details, ethnic origin or religious belief, and we ask you not to send it to us.

## Why we use your data and our legal basis

The Act allows us to use personal data only where we have a lawful reason. These are ours.

- **To carry out a contract with you.** Processing your order, taking payment, arranging delivery, sending order updates, handling returns and warranty claims, and running your account.
- **To meet a legal obligation.** Keeping sales and payment records for tax purposes and answering lawful requests from authorities.
- **For our legitimate interests.** Preventing fraud and misuse of the website, keeping it secure, answering your enquiries and understanding which products people look for so we stock the right ones. We only rely on this where it does not override your rights.
- **With your consent.** Sending marketing messages and using analytics or advertising cookies. You can withdraw consent at any time and it will not affect anything done before you withdrew it.

We do not use your data to make decisions about you by automated means alone, and we do not build profiles of you to sell to anyone.

## Who we share your data with

We do not sell personal data. We share it only with the people and companies that help us deliver your order and run the website, and only as much as each one needs.

- **Safaricom**, to process M-Pesa payments. They receive the paying phone number and the amount.
- **Our bank**, where you pay by bank transfer.
- **Couriers and delivery riders**, who receive your name, phone number and delivery address so the parcel reaches you.
- **Hosting, database and email providers**, who store the website data and send our order emails on our instructions.
- **Analytics and advertising providers** such as Google and Meta, only where those tools are switched on and only for the purposes described under cookies below.
- **Professional advisers and authorities**, such as auditors, the Kenya Revenue Authority, the police or a court, where the law requires it.

Every provider that handles data for us is required to keep it secure and use it only for the service they give us.

## Transfers outside Kenya

Some of our service providers store data on servers outside Kenya. Where that happens we rely on the conditions the Act sets for transfers, including that the provider has appropriate security and data protection safeguards in place. You can ask us which providers are involved.

## How long we keep your data

- **Order and payment records** are kept for at least five years after the sale, because tax law requires us to keep business records for that long.
- **Account details** are kept for as long as your account is open. If you ask us to close it, we delete or anonymise the account details, except for order records we must keep by law.
- **Enquiries and part requests** are kept for as long as needed to deal with them and for a reasonable period afterwards, in case you come back about the same issue.
- **Security records** such as IP addresses used to limit abuse are kept only for a short time.

When data is no longer needed we delete it or strip out the details that identify you.

## How we protect your data

- The website is served over an encrypted connection (HTTPS).
- Passwords are stored hashed, never in plain text.
- Customer and order data can only be opened by staff who need it for their job, and each staff role has limited access.
- Changes staff make to orders and settings are recorded, so we can see who did what.
- Payment confirmations from Safaricom are checked before an order is marked as paid.

No system is perfectly secure. If a breach happens that puts your data at real risk, we will report it to the Office of the Data Protection Commissioner within 72 hours of becoming aware of it and tell you without undue delay, as the Act requires.

## Your rights

Under the Act you have the right to:

- Be told how your personal data is being used
- Get access to the personal data we hold about you
- Object to the processing of all or part of your data
- Have inaccurate or misleading data corrected
- Have false or misleading data about you deleted
- Receive your data in a format you can pass to another provider
- Withdraw consent you have given us
- Not be subject to a decision based only on automated processing that significantly affects you

To use any of these rights, email [info@cisssolutions.co.ke](mailto:info@cisssolutions.co.ke). We may ask for something to confirm it is really you, such as your order number and the phone number used on it. We do not charge for requests and we answer within the time limits set by the Act and its regulations. If we cannot do what you ask, for example because the law requires us to keep an order record, we will tell you why.

You can also correct most of your details yourself by signing in to your account.

## Marketing messages

Messages about an order you have placed, such as confirmation, payment and delivery updates, are part of the service and are sent to every customer.

We only send promotional messages if you have agreed to receive them. Every promotional message will tell you how to stop them, and you can also ask us to stop at any time.

## Cookies and similar storage

- **Essential cookies** keep you signed in and keep the website secure. The site does not work properly without them.
- **Cart storage.** The contents of your cart are saved in your browser so they are still there when you come back.
- **Analytics and advertising.** We may use Google Analytics and the Meta Pixel to see how visitors use the site and how our adverts perform. These tools record pages viewed, searches, products added to the cart and purchases. They do not receive your name, phone number or address from us.

You can block or delete cookies in your browser settings. Blocking essential cookies will stop sign in and checkout from working.

## Children

This website is meant for adults. We do not knowingly collect personal data from anyone under 18 without the consent of a parent or guardian. If you believe a child has given us personal data, contact us and we will remove it.

## Links to other websites

Links to manufacturer websites, WhatsApp and social media take you to services we do not control. Their own privacy policies apply once you leave this site.

## Complaints

If you are unhappy with how we have handled your data, please tell us first so we can put it right. You also have the right to complain to the Office of the Data Protection Commissioner, the regulator for data protection in Kenya. Details are on the [ODPC website](https://www.odpc.go.ke).

## Changes to this policy

We will update this page when the way we handle personal data changes. The date at the top shows when it was last revised. If a change is significant we will also tell customers who have an account.$md$
), true),

('page:terms', jsonb_build_object(
  'title', 'Terms and Conditions',
  'description', 'The terms that apply when you use the CISS Solutions website and buy printers, spare parts, ink or toner from us.',
  'reviewed', false,
  'body', $md$Last updated: 5 October 2026

These terms apply when you use this website and when you buy from CISS Solutions through it. By placing an order you agree to them. Please read them together with our [privacy policy](/privacy), [returns and refund policy](/refund-policy), [delivery information](/shipping-policy) and [warranty](/warranty) pages, which form part of these terms.

## About us

This website is run by CISS Solutions, Taveta Court, 2nd Floor, Room 217, along Taveta Road, Nairobi, Kenya. You can reach us on [0721 578 080](tel:+254721578080) or at [info@cisssolutions.co.ke](mailto:info@cisssolutions.co.ke).

## Your account

You can order as a guest or create an account. If you create one, keep your password to yourself and make sure your contact details are correct. You are responsible for orders placed through your account. Tell us at once if you think someone else has used it.

## Products and descriptions

We try to describe every product accurately, including which printer models a part fits. Photos are there to help you identify an item and may differ slightly from what you receive, for example in packaging or colour.

Compatibility lists are based on manufacturer information and our own experience. It is your responsibility to confirm the model of your printer before you order. If you are unsure, [ask a technician](/support/part-request) first.

Where a product is a compatible item and not an original from the printer manufacturer, the listing says so.

## Prices

All prices are in Kenya Shillings (KES). Delivery is charged separately and is shown at checkout before you pay, together with any discount.

Prices can change at any time, but a change will not affect an order we have already confirmed. If we find a clear pricing mistake on an order, we will contact you and you can choose to pay the correct price or cancel for a full refund.

## Placing an order

Putting items in your cart does not reserve them. When you submit an order we hold the stock for a limited time so that you can pay.

Your order is accepted, and a contract between us is formed, when:

- we receive your payment, for M-Pesa, Paybill and bank transfer orders, or
- we confirm the order with you, for cash on delivery orders.

If payment does not arrive within the holding period, the order is cancelled automatically and the stock is released.

We may decline or cancel an order if an item turns out to be unavailable, if the payment cannot be verified, or if we reasonably suspect fraud. If you have already paid, you get a full refund.

## Payment

The payment methods available for your order are shown at checkout. For Paybill and bank transfer, use your order number as the account number or reference so we can match the payment. An unmatched payment delays your order.

Cash on delivery is offered in selected areas only. Please have the exact amount ready. We may withdraw cash on delivery from a customer who has refused orders without good reason.

## Delivery

We deliver to the address you give at checkout. Delivery times are estimates, not guarantees, and can be affected by courier delays, weather or public holidays. See [delivery information](/shipping-policy) for fees and timelines.

Ownership of the goods and the risk of loss or damage pass to you when the goods are delivered to you or to someone at the delivery address who accepts them on your behalf.

## Returns, refunds and warranty

Your rights to return a product and to have a fault put right are set out in our [returns and refund policy](/refund-policy) and [warranty](/warranty) pages.

## Fitting parts

Parts are supplied for fitting by you or a technician of your choice. Fitting printer parts needs care and, for some parts, experience. We are not responsible for damage caused by incorrect fitting or by using a part in a printer it was not listed for.

## Reviews

If you post a review, keep it honest and about the product. We check reviews before they appear and may decline or remove one that is abusive, misleading, off topic or contains personal details. By posting a review you allow us to display it on this website.

## Using this website

Please do not:

- use the website for anything unlawful or fraudulent
- try to get into parts of the site or data that are not meant for you
- interfere with how the site works, or overload it with automated requests
- copy our product listings in bulk for use elsewhere

We may suspend an account that is used in these ways.

## Content on this site

The text, layout and images we have created belong to CISS Solutions. Brand names, logos and product names belong to their owners and are used only to identify the products we sell and the printers they fit. Using a brand name does not mean we are endorsed by that manufacturer.

## Our responsibility to you

Nothing in these terms takes away rights you have under the Consumer Protection Act, 2012 or any other law of Kenya that cannot be excluded.

Subject to that:

- our total liability for any order is limited to the amount you paid for it
- we are not liable for loss of business, loss of profit or printing downtime
- we are not liable for delay or failure caused by events outside our reasonable control, such as network outages, strikes, floods or courier failures

## Privacy

We use your personal data as described in our [privacy policy](/privacy).

## Changes to these terms

We may update these terms from time to time. The version that applies to your order is the one published on this page on the day you placed it.

## Governing law and disputes

These terms are governed by the laws of Kenya. If you have a complaint, contact us first and we will try to settle it quickly. If we cannot agree, the dispute will be dealt with by the courts of Kenya.$md$
), true),

('page:refund-policy', jsonb_build_object(
  'title', 'Returns & Refund Policy',
  'description', 'When you can return a product to CISS Solutions, how to do it and how refunds are paid.',
  'reviewed', false,
  'body', $md$Last updated: 5 October 2026

We want you to end up with the right product. If something is wrong with your order, tell us and we will sort it out. This page explains what can be returned, how, and when you get your money back.

## Check your order when it arrives

Open the parcel as soon as you receive it and check that the items match your order and that nothing is damaged. If there is a problem, contact us within **48 hours** of delivery with your order number and a photo. Problems reported straight away are much easier to resolve.

## What you can return

### Wrong, damaged or faulty items

If we sent the wrong item, or it arrived damaged or does not work, we will replace it or refund you in full, including the delivery fee. We also cover the cost of getting it back to us.

### Items you no longer want or ordered by mistake

You can return an item within **7 days** of delivery if all of these are true:

- it has not been used or fitted to a printer
- it is in its original packaging, with seals unbroken
- all accessories, manuals and free items are included
- you have your order number

In this case you pay for the return delivery, and the original delivery fee is not refunded.

## What cannot be returned

- Ink bottles, ink cartridges and toner cartridges once the seal has been opened, unless they are faulty
- Spare parts that have been fitted or show signs of fitting, unless they are faulty
- Electrical parts such as mainboards, power supplies and printheads once the anti-static or sealed packaging has been opened, unless they are faulty
- Parts we ordered specially for you and do not normally stock
- Items damaged by misuse, power surges, liquids or incorrect installation
- Items returned without their original packaging or with parts missing

We test returned items. If an item is sent back as faulty and we find it works correctly, or the fault was caused by fitting or misuse, we will return it to you and you will cover the delivery cost.

## How to return an item

- Contact us by phone or WhatsApp on [0721 578 080](tel:+254721578080), or by email at [info@cisssolutions.co.ke](mailto:info@cisssolutions.co.ke). Give your order number and say what is wrong.
- Wait for us to confirm the return. Please do not send anything back before we confirm it, because we need to tell you where and how to send it.
- Pack the item securely in its original packaging. You can drop it at our shop on Taveta Road in Nairobi or send it by courier.
- We inspect the item when it arrives, normally within two working days, and tell you the outcome.

## Refunds

Once a return is approved you can choose a replacement, a different product or a refund.

Refunds are paid to the M-Pesa number or bank account the payment came from, within **7 working days** of approval. Cash on delivery orders are refunded by M-Pesa. We do not give cash refunds for orders placed on the website.

## Cancelling an order

You can cancel an order at no cost at any time before it is dispatched. Call or WhatsApp us with your order number. If you have already paid, we refund the full amount.

Once an order has been dispatched it cannot be cancelled and has to be handled as a return.

## Faults after the return period

A fault that appears later may be covered by warranty. See the [warranty](/warranty) page.

## Your legal rights

This policy is in addition to your rights under the Consumer Protection Act, 2012. It does not reduce them.$md$
), true),

('page:shipping-policy', jsonb_build_object(
  'title', 'Delivery Information',
  'description', 'How CISS Solutions delivers orders across Kenya: processing times, couriers, tracking and delivery fees by county.',
  'reviewed', false,
  'body', $md$We deliver to every county in Kenya. Orders within Nairobi go out by rider. Orders to other towns are sent by courier to your address or to the courier office nearest to you.

## When your order leaves the shop

Orders are prepared once payment is confirmed. For cash on delivery, that means once we have confirmed the order with you by phone.

- Orders confirmed on a working day before mid afternoon are usually dispatched the same day.
- Orders confirmed later, on a Sunday or on a public holiday go out on the next working day.
- Paybill and bank transfer orders are dispatched after we have matched your payment, so remember to use your order number as the account number or reference.

If an item turns out to be unavailable, we will call you before sending anything, and you can wait, swap it or get a refund.

## Delivery fees and timelines

The fee depends on your county and is shown at checkout before you pay. Some zones have free delivery above a certain order value. Where that applies it is shown in the table below and at checkout.

The timelines are estimates. Most orders arrive within them, but couriers are sometimes delayed by weather, road conditions or holidays.

## Tracking your order

You get an email when the order is confirmed and again when it is dispatched. You can check the status at any time on the [track order](/track-order) page using your order number and phone number.

## Receiving your order

- Make sure the phone number on the order is one you will answer. The rider or courier will call it.
- Check the parcel before the rider leaves if you can. If the box is damaged or an item is missing, tell us within 48 hours.
- If nobody is available to receive the parcel, we will arrange a second attempt. A further delivery fee may apply if the first attempt failed because the address or phone number was wrong.
- For cash on delivery, please have the exact amount ready.

## Bulky orders

Large printers and bulk orders may need separate transport. If the standard fee does not cover it, we will contact you with the cost before dispatch and you can cancel for a full refund if you prefer.

## Changing your delivery address

Contact us as soon as possible if you need to change the address. We can change it free of charge before dispatch. After dispatch a change may not be possible or may cost extra.

## Problems with a delivery

If your order is late, arrives damaged or is not what you ordered, call or WhatsApp [0721 578 080](tel:+254721578080) with your order number. See our [returns and refund policy](/refund-policy) for what happens next.

## Delivery zones

The current zones, fees and estimates are listed below.$md$
), true),

('page:warranty', jsonb_build_object(
  'title', 'Warranty',
  'description', 'What the warranty covers on printers, spare parts, ink and toner bought from CISS Solutions, and how to make a claim.',
  'reviewed', false,
  'body', $md$Last updated: 5 October 2026

Products sold by CISS Solutions are covered against manufacturing faults for the warranty period shown on the product page. The same period is the one that applies to your order, so keep your order number or invoice as proof of purchase.

## How long the warranty lasts

The period depends on the product and is listed in the specifications on each product page.

- **Printers and scanners** carry the manufacturer warranty for that model.
- **Spare parts** carry a shorter warranty that covers the part itself.
- **Ink and toner** are covered against defects such as a cartridge that is not recognised or leaks on first use.

The warranty starts on the day the product is delivered to you. If a product page shows no warranty period, ask us before you buy.

## What is covered

Faults caused by materials or manufacture that appear during the warranty period under normal use. For example, a printer that will not power on, a part that fails soon after correct fitting, or a toner cartridge that is dead on arrival.

## What is not covered

- Damage from power surges, lightning, liquid spills, drops or pests
- Damage caused by incorrect installation or by fitting a part to a printer it was not listed for
- Faults caused by refilled, non-genuine or expired ink and toner, where this is what damaged the printer
- Normal wear of parts that are meant to wear out, such as pickup rollers, drums and fuser films, once they have reached their rated page count
- Blocked printheads caused by leaving an ink printer unused for long periods
- Products that have been opened, repaired or modified by anyone other than an authorised technician, where that work caused the fault
- Products with the serial number or warranty seal removed or altered
- Loss of data, loss of business or printing downtime

## How to make a claim

- Contact us on [0721 578 080](tel:+254721578080) or at [info@cisssolutions.co.ke](mailto:info@cisssolutions.co.ke) with your order number, the product and a description of the fault. A photo or short video helps.
- We may suggest a few checks first. Many faults turn out to be a setting, a driver or a paper path problem that can be fixed on the phone.
- If the fault remains, bring or send the product to our shop on Taveta Road in Nairobi, with all its accessories.
- We test the product. For printers under manufacturer warranty we may pass the unit to the manufacturer's authorised service centre, and their assessment will apply.

## What happens next

If the fault is covered, we repair the product, replace it with the same or an equivalent item, or refund you if neither is possible. Which one applies depends on the fault and the manufacturer's terms.

Simple claims on parts and consumables are usually settled within a few working days. Printers sent to a service centre take longer and we will keep you updated.

A repaired or replaced product is covered for the rest of the original warranty period.

If we find no fault, or the fault is not covered, we will explain why and return the product to you. Delivery back to you is at your cost in that case.

## Delivery costs for warranty claims

You are responsible for getting the product to our shop. If the claim is accepted, we cover the cost of sending the repaired or replacement product back to you.

## Your legal rights

This warranty is in addition to your rights under the Consumer Protection Act, 2012. It does not reduce them.$md$
), true)
on conflict (key) do update set value = excluded.value
  where settings.value ->> 'reviewed' is distinct from 'true';
