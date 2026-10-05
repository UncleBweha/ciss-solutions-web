-- Manual M-Pesa Paybill: the customer pays to the Paybill themselves (order number as the
-- account) and staff mark the order paid, exactly like bank transfer. No Daraja involved.

alter type public.payment_method add value if not exists 'mpesa_paybill';

-- Same function as before; the only change is that mpesa_paybill may be marked paid by staff.
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_actor uuid := auth.uid();
  v_allowed order_status[];
begin
  if not public.is_service_role() and not public.has_permission('orders.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status = 'REFUNDED' and not public.is_service_role() and not public.has_permission('orders.refund') then
    raise exception 'Not allowed to refund' using errcode = '42501';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_allowed := case v_order.order_status
    when 'PENDING' then array['PROCESSING', 'CANCELLED', 'PAID']::order_status[]
    when 'PAYMENT_PENDING' then array['CANCELLED', 'FAILED']::order_status[]
    when 'PAID' then array['PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED', 'REFUNDED']::order_status[]
    when 'PROCESSING' then array['READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED', 'REFUNDED']::order_status[]
    when 'READY_FOR_DISPATCH' then array['SHIPPED', 'CANCELLED', 'REFUNDED']::order_status[]
    when 'SHIPPED' then array['DELIVERED', 'REFUNDED']::order_status[]
    when 'DELIVERED' then array['REFUNDED']::order_status[]
    when 'FAILED' then array['CANCELLED']::order_status[]
    else array[]::order_status[]
  end;

  if not (p_status = any (v_allowed)) then
    raise exception 'INVALID_TRANSITION:% -> %', v_order.order_status, p_status;
  end if;

  if p_status = 'PAID' and v_order.payment_method not in ('bank_transfer', 'cash_on_delivery', 'mpesa_paybill') then
    raise exception 'INVALID_TRANSITION:online payments are confirmed by the payment provider';
  end if;

  if p_status in ('CANCELLED', 'FAILED') then
    perform public.release_order_reservation(p_order_id);
    perform public.restock_order(p_order_id, v_actor);
    update payments set status = 'CANCELLED' where order_id = p_order_id and status in ('PENDING', 'PROCESSING');
    update orders set payment_status = case when payment_status = 'PAID' then payment_status else 'CANCELLED'::payment_status end
     where id = p_order_id;
  end if;

  if p_status = 'REFUNDED' then
    update orders set payment_status = 'REFUNDED' where id = p_order_id;
    update payments set status = 'REFUNDED' where order_id = p_order_id and status = 'PAID';
  end if;

  -- Fulfilment moves stock from reserved to sold for manual payment methods.
  if p_status in ('PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED') and v_order.stock_state = 'reserved' then
    perform public.deduct_order_stock(p_order_id, v_actor);
  end if;

  -- Cash on delivery is paid on delivery.
  if p_status = 'DELIVERED' and v_order.payment_method = 'cash_on_delivery' and v_order.payment_status <> 'PAID' then
    update orders set payment_status = 'PAID', paid_at = now() where id = p_order_id;
  end if;

  update orders set order_status = p_status where id = p_order_id;

  -- Manual "mark paid" for bank transfer / COD / Paybill.
  if p_status = 'PAID' then
    perform public.deduct_order_stock(p_order_id, v_actor);
    update orders set payment_status = 'PAID', paid_at = now() where id = p_order_id;
    insert into payments (order_id, method, provider, status, amount, paid_at, result_description)
    values (p_order_id, v_order.payment_method, 'manual', 'PAID', v_order.total, now(), coalesce(p_note, 'Marked paid by staff'));
  end if;

  insert into order_status_history (order_id, status, note, changed_by)
  values (p_order_id, p_status, p_note, v_actor);

  insert into audit_logs (actor_id, action, resource, resource_id, before, after)
  values (v_actor, 'order.status_changed', 'orders', p_order_id::text,
          jsonb_build_object('order_status', v_order.order_status, 'payment_status', v_order.payment_status),
          jsonb_build_object('order_status', p_status, 'note', p_note));

  return jsonb_build_object('order_id', p_order_id, 'from', v_order.order_status, 'to', p_status);
end;
$$;

update public.settings
   set value = value || jsonb_build_object('mpesa_paybill', jsonb_build_object(
         'enabled', true, 'label', 'M-Pesa Paybill', 'paybill_number', '',
         'instructions', 'Use your order number as the account number. We confirm payments within a few hours on working days.'))
 where key = 'payment_methods' and not (value ? 'mpesa_paybill');
