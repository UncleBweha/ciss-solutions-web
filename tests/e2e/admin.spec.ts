import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'Admin flows are covered on desktop')

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login?next=/admin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => u.pathname !== '/login')
}

const sku = `E2E-${Date.now().toString(36).toUpperCase()}`
const name = `E2E Test Toner ${sku}`

test('staff can create a product and it is live immediately', async ({ page }) => {
  await signIn(page, 'admin@ciss.local', 'Admin12345!')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.goto('/admin/products/new')
  await page.getByLabel('Product name').fill(name)
  await page.getByLabel('SKU').fill(sku)
  await page.getByLabel('Price (KES)').fill('4321')
  await page.getByLabel('Opening stock').fill('7')
  await page.getByLabel('Short description').fill('Approx. 1,000 pages')
  await page.getByLabel('Status').selectOption('active')
  await page.getByLabel('Product type').selectOption('ink_toner')
  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/)
  await expect(page.getByText('7 on hand')).toBeVisible()

  // Storefront search reflects the new product right away (targeted cache invalidation)
  await page.goto(`/search?q=${sku}`)
  await expect(page.getByRole('link', { name })).toBeVisible()
  await page.getByRole('link', { name }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  await expect(page.getByText('KSh 4,321').first()).toBeVisible()
})

test('staff can adjust stock with a reason and it is recorded', async ({ page }) => {
  await signIn(page, 'admin@ciss.local', 'Admin12345!')
  await page.goto(`/admin/inventory?q=${sku}`)
  const row = page.getByRole('row', { name: new RegExp(sku) })
  await row.getByRole('button', { name: 'Adjust' }).click()
  await page.getByLabel('Quantity').fill('5')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Stock updated to 12.')).toBeVisible()
  await expect(page.getByRole('cell', { name: '+5' }).first()).toBeVisible()
})

test('staff can process an order to delivered and print the invoice', async ({ page }) => {
  await signIn(page, 'admin@ciss.local', 'Admin12345!')
  await page.goto('/admin/orders?payment=PAID&status=PAID')
  const first = page.locator('a[href^="/admin/orders/"]').first()
  test.skip((await first.count()) === 0, 'Needs a paid order (run checkout.spec first)')
  await first.click()
  for (const action of ['Mark Processing', 'Mark Shipped', 'Mark Delivered']) {
    await page.getByRole('button', { name: action }).click()
    await expect(page.getByText('Order updated.').last()).toBeVisible()
  }
  await expect(page.getByText('Order: Delivered')).toBeVisible()
  const invoiceHref = await page.getByRole('link', { name: 'Print Invoice' }).getAttribute('href')
  const res = await page.request.get(invoiceHref!)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('application/pdf')
})

test('a narrow staff role cannot reach other admin modules', async ({ page, request }) => {
  // Make the demo user "amina" an order manager via the super admin UI.
  await signIn(page, 'admin@ciss.local', 'Admin12345!')
  await page.goto('/admin/settings/staff')
  await page.getByLabel('Email').fill('amina@ciss.local')
  await page.getByLabel('Role').selectOption('order_manager')
  await page.getByRole('button', { name: 'Apply role' }).click()
  await expect(page.getByText('amina@ciss.local is now order manager.')).toBeVisible()
  await page.context().clearCookies()
  void request

  await signIn(page, 'amina@ciss.local', 'Customer12345!')
  await expect(page).toHaveURL(/\/admin$/)
  const nav = page.getByRole('navigation', { name: 'Admin' })
  await expect(nav.getByRole('link', { name: 'Orders', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Products', exact: true })).toHaveCount(0)
  await page.goto('/admin/products')
  await expect(page).toHaveURL(/\/admin\?denied=1/)
  await page.goto('/admin/settings/payments')
  await expect(page).toHaveURL(/\/admin\?denied=1/)

  // Restore
  await page.context().clearCookies()
  await signIn(page, 'admin@ciss.local', 'Admin12345!')
  await page.goto('/admin/settings/staff')
  await page.getByLabel('Email').fill('amina@ciss.local')
  await page.getByLabel('Role').selectOption('customer')
  await page.getByRole('button', { name: 'Apply role' }).click()
  await expect(page.getByText('amina@ciss.local is now customer.')).toBeVisible()
})
