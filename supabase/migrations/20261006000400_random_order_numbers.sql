-- Order numbers no longer count up through the day (CISS-20261006-0004), which showed
-- anyone holding one how many orders the shop takes. They are now "CISS-" plus 8 random
-- characters, e.g. CISS-7K3M9QXD. The alphabet leaves out 0/O and 1/I so a number read
-- over the phone or typed as an M-Pesa account reference is not mistyped.
--
-- Existing orders keep their numbers. order_number_counters is left in place, unused.
create or replace function public.generate_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_number text;
begin
  loop
    select 'CISS-' || string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_number
      from generate_series(1, 8);
    -- 32^8 possibilities; retry on the rare collision (orders.order_number is unique).
    exit when not exists (select 1 from orders where order_number = v_number);
  end loop;
  return v_number;
end;
$$;

revoke execute on function public.generate_order_number() from public, anon, authenticated;
grant execute on function public.generate_order_number() to service_role;
