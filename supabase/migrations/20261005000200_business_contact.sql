-- Business contact details shown in the header, footer, contact page, invoices and
-- WhatsApp links. Staff can change them later in Admin, Settings, Business.

update public.settings
   set value = value || jsonb_build_object(
         'phone', '0721 578 080',
         'whatsapp', '254721578080',
         'email', 'info@cisssolutions.co.ke',
         'location', 'Taveta Court, Taveta Road, Nairobi',
         'address', 'Taveta Court, 2nd Floor, Room 217, Along Taveta Road, Nairobi')
 where key = 'business';
