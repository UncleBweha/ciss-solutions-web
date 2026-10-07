-- Website sales are copied to the POS (a separate Supabase project) once they are paid.
--
-- Two more outbox tasks, written in the same transaction as the payment change:
--   pos_sale   orders.payment_status -> PAID (any method)   -> register the sale in the POS
--   pos_void   orders.payment_status PAID -> REFUNDED        -> void that sale in the POS
-- The worker (src/lib/outbox.ts) calls the POS; see src/lib/pos/service.ts.

alter table public.outbox drop constraint if exists outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('order_placed', 'mpesa_stk_push', 'payment_confirmed', 'order_status', 'pos_sale', 'pos_void'));

-- Same function as before, plus the two POS tasks.
create or replace function public.outbox_on_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'PAID' and old.payment_status is distinct from 'PAID'
     and new.payment_method in ('mpesa', 'card') then
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
