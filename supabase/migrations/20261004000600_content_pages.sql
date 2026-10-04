-- Editable content pages (Admin -> Content pages). Stored as settings rows
-- `page:<slug>` = { title, description, body (Markdown subset), reviewed }.
-- The defaults are deliberately neutral drafts: CISS Solutions must review and
-- complete legal pages before launch (reviewed=false shows a warning in admin).

insert into public.settings (key, value, is_public) values
('page:about', jsonb_build_object(
  'title', 'About CISS Solutions',
  'description', 'CISS Solutions supplies printers, spare parts, ink, toner and printing accessories in Kenya.',
  'reviewed', false,
  'body', E'CISS Solutions is a Kenyan printing solutions business. We supply printers, genuine and compatible spare parts, ink, toner, scanners, paper and accessories for homes, offices and print shops.\n\n## What we do\n\n- Printers from leading brands, including ink tank, laser and dot matrix models\n- Spare parts matched to your exact printer model\n- Original ink and toner\n- Help identifying the right part when you are not sure what you need\n\n## Talk to us\n\nCall, WhatsApp or send us a message from the [contact page](/contact). If you need a part and do not know the part number, use our [part request form](/support/part-request).'
), true),
('page:faqs', jsonb_build_object(
  'title', 'Frequently asked questions',
  'description', 'Answers about ordering, payment, delivery and spare parts at CISS Solutions.',
  'reviewed', false,
  'body', E'## How do I pay?\n\nYou can pay with M-Pesa at checkout. You will receive a prompt on your phone to enter your M-Pesa PIN. Other options shown at checkout may include bank transfer and cash on delivery in selected areas.\n\n## How long does delivery take?\n\nDelivery times and fees depend on your county and are shown at checkout before you pay. See [delivery information](/shipping-policy).\n\n## How do I know a spare part fits my printer?\n\nEach spare part lists the printer models it is compatible with. You can also use the [parts finder](/parts-finder) or [ask a technician](/support/part-request).\n\n## How do I track my order?\n\nUse [track order](/track-order) with your order number and phone number, or sign in to your account.'
), true),
('page:privacy', jsonb_build_object(
  'title', 'Privacy Policy',
  'description', 'How CISS Solutions handles personal data.',
  'reviewed', false,
  'body', E'This page describes how CISS Solutions collects and uses personal information when you use this website.\n\n## Information we collect\n\nWhen you place an order or contact us we collect the details you provide, such as your name, phone number, email address and delivery address, and the details of your order.\n\n## How we use it\n\nWe use this information to process and deliver your orders, take payment, provide customer support and send you messages about your orders.\n\n## Payments\n\nM-Pesa payments are processed by Safaricom. We do not see or store your M-Pesa PIN.\n\n## Contact\n\nFor questions about your data, please [contact us](/contact).'
), true),
('page:terms', jsonb_build_object(
  'title', 'Terms and Conditions',
  'description', 'Terms for using the CISS Solutions website and buying from us.',
  'reviewed', false,
  'body', E'These terms apply to orders placed on this website.\n\n## Prices\n\nPrices are shown in Kenya Shillings (KES). The amount payable, including delivery and any discount, is confirmed at checkout before you pay.\n\n## Orders\n\nAn order is confirmed once payment has been received or, for cash on delivery, once we confirm it with you. Stock is reserved for a limited time while a payment is pending.\n\n## Questions\n\nPlease [contact us](/contact) with any questions about these terms.'
), true),
('page:refund-policy', jsonb_build_object(
  'title', 'Returns & Refund Policy',
  'description', 'How returns and refunds work at CISS Solutions.',
  'reviewed', false,
  'body', E'If there is a problem with your order, please [contact us](/contact) with your order number as soon as possible so we can help.\n\nPlease keep the product, its packaging and your order number. Our team will explain the next steps for your specific product.'
), true),
('page:shipping-policy', jsonb_build_object(
  'title', 'Delivery Information',
  'description', 'Delivery areas, fees and timelines across Kenya.',
  'reviewed', false,
  'body', E'We deliver across Kenya. Delivery fees and estimated delivery times depend on your county and are shown at checkout before you pay. The current delivery zones are listed below.'
), true),
('page:warranty', jsonb_build_object(
  'title', 'Warranty',
  'description', 'Warranty information for products bought from CISS Solutions.',
  'reviewed', false,
  'body', E'Warranty terms depend on the product and manufacturer. Where a product has a warranty, the period is shown in its specifications.\n\nIf you have a problem with a product, please [contact us](/contact) with your order number.'
), true)
on conflict (key) do nothing;
