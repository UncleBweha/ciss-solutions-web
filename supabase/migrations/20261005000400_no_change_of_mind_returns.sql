-- Returns are accepted only for products that are faulty or not working properly
-- (or where we sent the wrong item). Change of mind returns are not accepted.

update public.settings
   set value = jsonb_set(value, '{body}', to_jsonb($md$Last updated: 5 October 2026

We accept returns only when a product is faulty or does not work properly. We do not accept returns because you changed your mind, ordered the wrong item or no longer need it. Please check the product and the printer models it fits before you pay, and [ask a technician](/support/part-request) if you are not sure.

## Check your order when it arrives

Open the parcel as soon as you receive it and check that the items match your order and that nothing is damaged. If there is a problem, contact us within **48 hours** of delivery with your order number and a photo. Problems reported straight away are much easier to resolve.

## When you can return a product

- The product is faulty or does not work properly
- The product arrived damaged
- We sent you a different item from the one on your order

In these cases we replace the product or refund you in full, including the delivery fee. We also cover the cost of getting it back to us.

## When you cannot return a product

- You changed your mind or no longer need the product
- You ordered the wrong product, or a part that does not fit your printer, where the listing was correct
- You found the product cheaper somewhere else
- The product was damaged by misuse, power surges, liquids or incorrect installation
- The fault was caused by fitting the part to a printer it was not listed for
- The product comes back with parts, accessories or the serial number missing

We test every returned product. If it is sent back as faulty and we find it works correctly, or the fault was caused by fitting or misuse, we will return it to you and you will cover the delivery cost.

## How to return a faulty product

- Contact us by phone or WhatsApp on [0721 578 080](tel:+254721578080), or by email at [info@cisssolutions.co.ke](mailto:info@cisssolutions.co.ke). Give your order number and describe the fault. A photo or short video helps.
- Wait for us to confirm the return. Please do not send anything back before we confirm it, because we need to tell you where and how to send it.
- Pack the product securely with everything that came in the box. You can drop it at our shop on Taveta Road in Nairobi or send it by courier.
- We test the product when it arrives, normally within two working days, and tell you the outcome.

## Refunds

Once we have confirmed the fault you can choose a replacement or a refund.

Refunds are paid to the M-Pesa number or bank account the payment came from, within **7 working days** of approval. Cash on delivery orders are refunded by M-Pesa. We do not give cash refunds for orders placed on the website.

## Cancelling an order

You can cancel an order at no cost at any time before it is dispatched. Call or WhatsApp us with your order number. If you have already paid, we refund the full amount.

Once an order has been dispatched it cannot be cancelled.

## Faults that appear later

A fault that appears after you have been using the product may be covered by warranty. See the [warranty](/warranty) page.

## Your legal rights

This policy is in addition to your rights under the Consumer Protection Act, 2012. It does not reduce them.$md$::text)),
       updated_at = now()
 where key = 'page:refund-policy';

-- The two FAQ answers that mentioned returns.
update public.settings
   set value = jsonb_set(value, '{body}', to_jsonb(
         replace(
           replace(
             value ->> 'body',
             'Yes, within the conditions in our [returns and refund policy](/refund-policy). In short: tell us quickly, keep the packaging, and do not open ink or toner you intend to return.',
             'Only if it is faulty or does not work properly. We do not take products back because of a change of mind, so please confirm the product and the printer models it fits before you pay. The details are in our [returns and refund policy](/refund-policy).'),
           'Once the parcel has left the shop it has to be handled as a return.',
           'Once the parcel has left the shop the order cannot be cancelled.'))),
       updated_at = now()
 where key = 'page:faqs';
