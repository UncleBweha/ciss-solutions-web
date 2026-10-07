# Admin guide

The admin area is at **/admin**. Sign in with a staff account; customers who open it are sent
away. Important changes (products, stock, orders, prices, settings, staff) are recorded in the audit
log with your name.

## Roles and permissions

Each staff member has one role. The menu only shows what your role allows, and the same rules are
enforced again by the server and the database.

| Permission | super_admin | admin | manager | inventory_manager | order_manager | content_manager | support_agent |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `products.manage`: products, images, costs | ✓ | ✓ | ✓ | ✓ | | | |
| `inventory.manage`: stock adjustments | ✓ | ✓ | ✓ | ✓ | | | |
| `catalog.manage`: categories, brands, printer models | ✓ | ✓ | ✓ | | | ✓ | |
| `orders.manage`: orders, statuses, invoices | ✓ | ✓ | ✓ | | ✓ | | |
| `orders.refund`: mark orders refunded | ✓ | ✓ | ✓ | | | | |
| `customers.view` | ✓ | ✓ | ✓ | | ✓ | | ✓ |
| `coupons.manage` | ✓ | ✓ | ✓ | | | | |
| `content.manage`: homepage, content pages | ✓ | ✓ | ✓ | | | ✓ | |
| `reviews.moderate` | ✓ | ✓ | ✓ | | | ✓ | |
| `support.manage`: contact and part requests | ✓ | ✓ | ✓ | | | | ✓ |
| `reports.view`: reports, CSV export | ✓ | ✓ | ✓ | | | | |
| `settings.manage`: business, delivery, checkout | ✓ | ✓ | | | | | |
| `payments.settings` | ✓ | ✓ | | | | | |
| `admins.manage`: staff and roles | ✓ | ✓ | | | | | |

Only a super admin can create or demote another super admin. Nobody can change their own role.

**Add a staff member:** they register a normal account first; then Settings → Staff & roles →
enter their email and pick a role. To remove access, set them back to customer.

## Dashboard and notifications

The dashboard shows today's sales and orders, open orders, low-stock and pending-payment counts,
and for the last 30 days: sales and orders per day, top products and top categories. The bell
(Notifications) lists new orders, payment problems (for example an underpayment), low stock, new
support requests, and "Task failed" when an email or M-Pesa prompt still failed after its retries
(open the order to follow up with the customer). New orders are also emailed to
`orders@cisssolutions.co.ke` and to the addresses in Settings → Checkout, SEO & alerts (plus any in
the server's `ADMIN_ALERT_EMAILS`).

**POS.** When an order becomes paid (staff mark it Paid, M-Pesa confirms it, or a cash-on-delivery
order is delivered), it appears in the POS as a sale of the "Website" shop, with the order number
next to the customer's name. Refunding the order voids that sale. This usually takes a few
seconds and at most a few minutes. POS stock does not change. The POS works out the profit from each
product's cost price, so enter one on every product; a product without it shows no profit. If the POS can't be reached after several tries, a "Task failed" notification appears.

## Products

**Products → New product.** Required: name, SKU, price and product type; a category is optional
but recommended. Also available:
brand, compare-at price (shows a strike-through and discount badge), cost price (internal only,
never shown to customers), opening stock and low-stock threshold, short and full description,
specifications (name/value rows), features, what's included, warranty, condition, part/OEM number,
barcode, weight and dimensions, SEO and social fields, and the URL slug.

- **Status:** *Draft* is invisible to customers; *Active* is live immediately; *Archived* hides it
  but keeps it on past orders.
- **Images:** upload JPG, PNG, WebP or AVIF up to 5 MB. Reorder with the arrows, choose the main
  image with the star, write alt text that describes the product, then click **Save image order &
  alt text**. Use your own photos or images you have
  rights to; do not copy manufacturer images.
- **Variants:** for options such as colour or pack size, each with its own SKU, price and stock.
- **Compatibility:** for parts and supplies, tick the printer models they fit. This powers the
  parts finder and the "Compatible with" list. For a printer, "This printer is model" links the
  product to its model so compatible supplies appear on its page.
- **Duplicate** creates a draft copy of the product's details (new SKU and slug, stock 0). Add
  images, variants and compatibility to the copy yourself.

**Bulk actions** (tick products in the list): activate, deactivate, change prices by a percentage,
set stock, move to a category or brand, delete (type DELETE to confirm).

**CSV import** (Products → Import). Columns: `name, sku, brand, category, price,
compare_at_price, stock, description, short_description, product_type, weight, status`. Only
`name`, `sku` and `price` are required. Rows are matched by SKU: existing products are updated
(a stock difference is recorded as a correction), new SKUs are created. You see a preview with
errors per row before anything is saved. Brands and categories are matched by name or slug.

## Menu

The sidebar has one entry per area; related pages are tabs inside it:

- **Dashboard:** Overview, Reports
- **Orders**
- **Products:** Products, Stock
- **Catalog:** Categories, Brands, Printer models
- **Customers**
- **Support requests**
- **Settings:** Business, Payments, Checkout/SEO/alerts, Homepage, Content pages, Staff & roles

**Log out** is at the bottom of the sidebar and in the top bar. Coupons, product reviews and delivery
zones are switched off: they have no admin page and customers do not see them.

## Stock

The Stock tab (under Products) lists stock, reserved (held by unpaid orders) and available quantities, with a
low-stock filter. **Adjust stock** needs a quantity change and a reason: purchase (new stock in),
return, damage, correction or manual adjustment, plus an optional note. Every movement, including
sales and cancellations, appears in the product's stock history. Stock cannot be reduced below what
is currently reserved.

Online orders reserve stock when placed and deduct it when paid. Unpaid M-Pesa orders release their
reservation automatically after the payment window (30 minutes by default).

## Orders

Orders lists everything with filters by order status and payment status, and search by order
number, name, phone or email. Open an order to see items, customer and delivery details, payment attempts (with
M-Pesa receipts and failure reasons), the status timeline and internal notes.

**Status flow:** Paid → Processing → Ready for dispatch → Shipped → Delivered. Cancel or refund
when needed. The customer is emailed when the order moves to Processing, Ready for dispatch,
Shipped, Delivered, Cancelled or Refunded. Notes you add are internal (they appear in the order
history, not in the email).

- **M-Pesa orders** become Paid only when Safaricom confirms; staff cannot mark them paid.
- **Bank transfer:** when the money shows in the bank account, set the order to Paid.
- **Cash on delivery:** move it through Processing → Shipped → Delivered and collect payment on
  delivery.
- **Cancelling** releases or restocks the items automatically. **Refunding** needs the
  `orders.refund` permission; refund the money through M-Pesa or the bank yourself, then mark the
  order refunded here.
- **Invoice:** **Print invoice** on the order page opens a PDF invoice in a new tab.

## Catalogue structure

- **Categories:** a tree (for example Spare Parts → Printheads). Each can have an image, description
  and SEO text. Deleting a category with products is blocked; move the products first.
- **Brands:** name, logo and description; each brand gets a page at `/b/<slug>`.
- **Printer models:** brand, full name, model number and optional notes. Products link to them
  through compatibility.

## Customers

Customer list with order count and total spent; open one to see their order history and totals. Staff
cannot see passwords or payment PINs (the system never stores them).

## Coupons (switched off)

There is no coupon page in the admin and no coupon box at checkout. When it was on: Code, percentage or fixed amount, optional minimum order and maximum discount, start/end dates,
total and per-customer usage limits, and optional limits to specific products or categories. The
discount is always calculated on the server, at checkout, from the current cart.

## Homepage and content

- **Homepage:** turn sections on/off, reorder them and edit titles. Hero banners: title,
  highlight, subtitle, image, buttons, and an optional featured product with live price.
- **Content pages** (Settings → Content pages): About, FAQs, Privacy, Terms, Refund policy, Shipping
  policy, Warranty, written in simple Markdown. The seeded text is a neutral draft: have the legal
  pages written or checked by someone qualified, then tick **Reviewed**. Until then each page is
  hidden from search engines.

## Reviews and support

- **Reviews (switched off):** no review form or reviews tab on product pages. When it was on, reviews waited as Pending; approve or reject them. Only approved reviews are
  shown and count toward the rating.
- **Support requests:** messages from the contact form and "help me find a part" requests (with
  printer model and problem). Set them In progress / Resolved / Closed and keep notes.

## Reports

For a date range: paid revenue, order count, average order, discounts, revenue by payment method and
orders by status, plus the latest audit-log entries. **Export orders (CSV)** downloads every order in the range, including the M-Pesa receipt, for
accounting and reconciliation (see [PAYMENTS.md](PAYMENTS.md#reconciliation)).

## Settings

| Tab | What you set |
| --- | --- |
| Business | Name, tagline, phone, WhatsApp, email, address, hours, social links, M-Pesa Paybill shown to customers |
| Payments | Turn methods on/off; bank account details and instructions; cash-on-delivery counties |
| Checkout, SEO & alerts | M-Pesa and bank-transfer reservation windows, maximum quantity per item, default SEO title/description, staff alert emails |
| Content pages | Page text and the Reviewed flag |
| Staff & roles | Add staff, change roles |

M-Pesa API credentials are **not** in the admin: they are server environment variables, so they
can't leak through the browser or a staff account (see [DEPLOYMENT.md](DEPLOYMENT.md)).
