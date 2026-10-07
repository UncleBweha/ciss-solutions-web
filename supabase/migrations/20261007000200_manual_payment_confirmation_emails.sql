-- Paybill and bank transfer: the customer pays outside the site and staff confirm the money.
-- The "paid" emails (customer and staff) now go out when staff mark the order Paid, as they
-- already do when Safaricom confirms an M-Pesa payment. Until then the order's emails say
-- "awaiting payment confirmation" (src/lib/notifications/templates.ts).
--
-- Same function as before; the only change is the list of methods that queue
-- payment_confirmed. Cash on delivery is left out: it is paid at the door, and the
-- customer gets the "delivered" email.

create or replace function public.outbox_on_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'PAID' and old.payment_status is distinct from 'PAID'
     and new.payment_method in ('mpesa', 'card', 'mpesa_paybill', 'bank_transfer') then
    insert into outbox (kind, order_id) values ('payment_confirmed', new.id);
  end if;
  -- Customer emails for status changes made by staff (not automatic expiry).
  if new.order_status is distinct from old.order_status
     and new.order_status in ('PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')
     and public.is_staff() then
    insert into outbox (kind, order_id, payload)
    values ('order_status', new.id, jsonb_build_object('status', new.order_status));
  end if;
  -- POS: a sale once the money is confirmed (by staff or by M-Pesa), voided on refund.
  if new.payment_status = 'PAID' and old.payment_status is distinct from 'PAID' then
    insert into outbox (kind, order_id) values ('pos_sale', new.id);
  end if;
  if new.payment_status = 'REFUNDED' and old.payment_status = 'PAID' then
    insert into outbox (kind, order_id) values ('pos_void', new.id);
  end if;
  return new;
end;
$$;
