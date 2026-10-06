-- Delivery is no longer priced at checkout. Customers either collect from the shop (free)
-- or have the order sent by a third-party courier, whose charge is agreed by phone after
-- the order is placed. This rewrites the Delivery Information page and the sentences on
-- other pages that promised a fee at checkout.

update public.settings
set value = value || jsonb_build_object(
  'description', 'How CISS Solutions gets orders to you: free store pickup in Nairobi, or courier delivery across Kenya arranged by phone after you order.',
  'body', $md$You can collect your order from our shop, or have it sent to you by courier anywhere in Kenya.

## Store pickup

Store pickup is free. Choose it at checkout and collect your order from Taveta Court, 2nd Floor, Room 217, along Taveta Road, Nairobi. We will call you when the order is ready. Bring your order number.

## Parcel delivery

We use third-party parcel couriers. The charge depends on your location, the weight of the products and the courier you prefer. That is why the delivery cost shows as "To be confirmed" at checkout and is not part of what you pay there.

After you place the order, our representative will call you to agree the courier and the delivery cost, and to make the arrangements.

## When your order leaves the shop

Orders are prepared once payment for the goods is confirmed. For cash on delivery, that means once we have confirmed the order with you by phone.

- Orders confirmed on a working day before mid afternoon are usually ready or dispatched the same day.
- Orders confirmed later, on a Sunday or on a public holiday are handled on the next working day.
- Paybill and bank transfer orders are released after we have matched your payment, so remember to use your order number as the account number or reference.

If an item turns out to be unavailable, we will call you before sending anything, and you can wait, swap it or get a refund.

## Tracking your order

You get an email when the order is confirmed and again when it is dispatched. You can check the status at any time on the [track order](/track-order) page using your order number and phone number.

## Receiving your order

- Make sure the phone number on the order is one you will answer. We and the courier will call it.
- Check the parcel when you receive it. If the box is damaged or an item is missing, tell us within 48 hours.
- If a delivery fails because the address or phone number was wrong, the courier may charge for a second attempt.

## Changing your delivery details

Contact us as soon as possible if you need to change the address or switch between pickup and delivery. We can change it free of charge before dispatch. After dispatch a change may not be possible or may cost extra.

## Problems with a delivery

If your order is late, arrives damaged or is not what you ordered, call or WhatsApp [0721 578 080](tel:+254721578080) with your order number. See our [returns and refund policy](/refund-policy) for what happens next.$md$
)
where key = 'page:shipping-policy';

update public.settings
set value = jsonb_set(value, '{body}', to_jsonb(replace(
  value ->> 'body',
  'Delivery fees and timelines depend on your county. They are shown at checkout before you pay and listed on the [delivery information](/shipping-policy) page.',
  'You can collect your order from our shop for free, or have it sent by courier. Courier charges depend on your location, the weight of the order and the courier you prefer, so we call you after you order to agree them. See the [delivery information](/shipping-policy) page.'
)))
where key = 'page:about';

update public.settings
set value = jsonb_set(value, '{body}', to_jsonb(replace(
  value ->> 'body',
  'It depends on where you are. Nairobi orders usually arrive the same day or the next day. Other towns take longer because the parcel goes by courier. The estimate for your county is shown at checkout and on the [delivery information](/shipping-policy) page.',
  'It depends on where you are and the courier you choose. Store pickup in Nairobi is free and usually ready the same day. For courier delivery, our representative calls you after you order to agree the courier, the cost and the timing. See the [delivery information](/shipping-policy) page.'
)))
where key = 'page:faqs';

update public.settings
set value = jsonb_set(value, '{body}', to_jsonb(replace(
  value ->> 'body',
  'See [delivery information](/shipping-policy) for fees and timelines.',
  'Courier charges are agreed with you by phone after you order and are not included in the total shown at checkout. See [delivery information](/shipping-policy).'
)))
where key = 'page:terms';
