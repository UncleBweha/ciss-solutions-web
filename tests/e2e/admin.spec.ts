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
  // Nothing filled in: Publish points at what is missing instead of saving.
  await page.getByRole('button', { name: 'Publish product' }).click()
  await expect(page.getByText('Enter the product name')).toBeVisible()
  await expect(page.locator('#categoryId-error')).toHaveText('Choose a category, or add it')

  await page.getByLabel('Product name').fill(name)
  await page.locator('#categoryId').selectOption({ index: 1 })
  // A brand that isn't in the list yet is added from here and selected.
  await page.getByRole('button', { name: 'Add brand' }).click()
  await page.getByLabel('Brand name').fill(`Brand ${sku}`)
  await page.getByRole('dialog').getByRole('button', { name: 'Add brand' }).click()
  await expect(page.locator('#brandId option:checked')).toHaveText(`Brand ${sku}`)
  await page.getByLabel('SKU').fill(sku)
  await page.getByLabel('Compatibility').fill(`Printer ${sku}
Another Model 2000`)
  await page.getByLabel('Buying price (KES)').fill('3000')
  await page.getByLabel('Selling price (KES)').fill('4321')
  await page.getByLabel('Quantity in stock').fill('7')
  await page.getByRole('button', { name: 'Publish product' }).click()
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/)
  await expect(page.getByLabel('Quantity in stock')).toHaveValue('7')
  await expect(page.getByLabel('Compatibility')).toHaveValue(`Printer ${sku}
Another Model 2000`)

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

test('staff change their own password from Settings', async ({ page }) => {
  await signIn(page, 'admin@ciss.local', 'Admin12345!')
  await page.goto('/admin/settings/password')
  const change = async (current: string, next: string) => {
    await page.getByLabel('Current password').fill(current)
    await page.getByLabel('New password', { exact: true }).fill(next)
    await page.getByLabel('Confirm new password').fill(next)
    await page.getByRole('button', { name: 'Change password' }).click()
  }

  await change('not-my-password', 'Changed12345!')
  await expect(page.getByText('Your current password is incorrect.')).toBeVisible()

  await change('Admin12345!', 'Changed12345!')
  await expect(page.getByText('Your password has been changed.')).toBeVisible()
  // Still signed in on this device.
  await page.goto('/admin/settings/password')
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible()

  // Put the seed password back for the other tests.
  await change('Changed12345!', 'Admin12345!')
  await expect(page.getByText('Your password has been changed.')).toBeVisible()
})

test('staff add categories and subcategories by name, and from the product page', async ({ page }) => {
  const main = `E2E Cat ${sku}`
  await signIn(page, 'admin@ciss.local', 'Admin12345!')
  await page.goto('/admin/categories')
  await expect(page.getByRole('heading', { name: 'Printer Spare Parts' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Printer Accessories' })).toBeVisible()

  // A main category: type the name, press Add.
  await page.getByLabel('New main category name').fill(main)
  await page.getByLabel('New main category name').press('Enter')
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: main }) })
  await expect(card).toBeVisible()
  await expect(card.getByText(/0 products · \/c\/e2e-cat-/)).toBeVisible()

  // A subcategory from the field inside that card.
  await card.getByLabel(`New subcategory in ${main}`).fill('E2E Sub One')
  await card.getByRole('button', { name: 'Add' }).click()
  await expect(card.getByText('E2E Sub One', { exact: true })).toBeVisible()
  await card.getByLabel(`New subcategory in ${main}`).fill('E2E Sub Two')
  await card.getByRole('button', { name: 'Add' }).click()
  await expect(card.getByRole('listitem')).toHaveText([/E2E Sub One/, /E2E Sub Two/])

  // Reorder with the arrows.
  await card.getByRole('button', { name: 'Move E2E Sub Two up' }).click()
  await expect(card.getByRole('listitem')).toHaveText([/E2E Sub Two/, /E2E Sub One/])

  // From the product page: a new subcategory is added and selected without leaving the form.
  await page.goto('/admin/products/new')
  await page.getByRole('button', { name: 'Add category' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Category name').fill('E2E From Product')
  await dialog.getByLabel('Inside').selectOption({ label: main })
  await dialog.getByRole('button', { name: 'Add category' }).click()
  await expect(page.locator('#categoryId option:checked')).toHaveText('— E2E From Product')

  await page.goto('/admin/categories')
  await expect(card.getByText('E2E From Product', { exact: true })).toBeVisible()

  // Empty categories can be deleted.
  for (const name of ['E2E From Product', 'E2E Sub One', 'E2E Sub Two']) {
    await card.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
    await expect(card.getByText(name, { exact: true })).toHaveCount(0)
  }
  await card.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('heading', { name: main })).toHaveCount(0)
})
