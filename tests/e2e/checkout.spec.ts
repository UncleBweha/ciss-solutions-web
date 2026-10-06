import { expect, test } from '@playwright/test'

// Critical flow: home -> search -> product -> cart -> checkout -> delivery ->
// M-Pesa payment (mock provider) -> confirmed order.
test('customer can find a printer and buy it with M-Pesa', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('CISS Solutions')

  // Search
  const search = page.getByRole('banner').getByRole('combobox', { name: 'Search products' })
  await search.fill('L3250')
  await expect(page.getByRole('banner').getByRole('option').first()).toContainText('L3250')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/search\?q=L3250/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('L3250')

  // Product page
  await page.getByRole('link', { name: 'Epson EcoTank L3250 All-in-One Wi-Fi Printer' }).first().click()
  await expect(page).toHaveURL(/\/p\/epson-ecotank-l3250/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Epson EcoTank L3250 All-in-One Wi-Fi Printer')
  await expect(page.getByText('KSh 32,999').first()).toBeVisible()

  // Add to cart
  await page.getByRole('button', { name: 'Add to Cart' }).first().click()
  await expect(page.getByRole('link', { name: /Cart, 1 item/ })).toBeVisible()
  await page.goto('/cart')
  await expect(page.getByText('Epson EcoTank L3250 All-in-One Wi-Fi Printer').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Proceed to Checkout/ })).toBeEnabled()
  await page.getByRole('link', { name: /Proceed to Checkout/ }).click()

  // Checkout: details
  await expect(page).toHaveURL(/\/checkout/)
  await page.getByLabel('Full name').fill('Test Customer')
  await page.getByLabel('Phone number').fill('0712345678')
  await page.getByLabel('Email').fill('e2e@example.com')
  await page.getByRole('button', { name: 'Continue to delivery' }).click()

  // Delivery
  await page.getByLabel('County').selectOption('Nairobi')
  await page.getByLabel('Town / City').fill('Westlands')
  await page.getByLabel('Delivery address').fill('Mpaka Road, Office 4')
  await page.getByRole('button', { name: 'Continue to payment' }).click()
  // 32,999 from the server quote; courier delivery is agreed after the order, not charged here
  await expect(page.getByRole('button', { name: /Pay KSh 32,999 with M-Pesa/ })).toBeVisible()

  // Payment (mock M-Pesa succeeds for numbers not ending in 1 or 2)
  await page.getByRole('button', { name: /Pay KSh 32,999 with M-Pesa/ }).click()
  await expect(page).toHaveURL(/\/order\/CISS-[2-9A-HJ-NP-Z]{8}\?t=/)
  await expect(page.getByText('Check your phone')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Payment confirmed', { timeout: 45_000 })
  // Straight from checkout the page is a confirmation; order progress lives on Track order.
  await expect(page.getByRole('heading', { name: 'Order status' })).toHaveCount(0)
})

test('server rejects a tampered price: totals come from the database', async ({ page, request }) => {
  // Seed a cart with a fake client-side price (KSh 1); the cart must show the real price.
  const { items } = await (await request.get('/api/search?q=pickup%20roller')).json()
  const tampered = [{ productId: items[0].id, variantId: null, quantity: 1, snapshot: { name: items[0].name, slug: items[0].slug, price: 1, imageUrl: null, variantName: null, sku: 'x' } }]
  await page.addInitScript((cart) => localStorage.setItem('ciss-cart-v1', JSON.stringify(cart)), tampered)
  await page.goto('/cart')
  await expect(page.getByText('KSh 2,500').first()).toBeVisible()
  await expect(page.getByText('KSh 1 each')).toHaveCount(0)
})
