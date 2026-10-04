import { expect, test } from '@playwright/test'

// Uses the seeded demo customer (supabase/seed.sql).
const CUSTOMER = { email: 'customer@ciss.local', password: 'Customer12345!' }

test('guest cart merges into the account on sign in; wishlist and orders work', async ({ page }) => {
  // Guest adds a product
  await page.goto('/p/hp-laserjet-m404-m405-pickup-roller')
  await page.getByRole('button', { name: 'Add to Cart' }).first().click()
  await expect(page.getByRole('link', { name: /Cart, 1 item/ })).toBeVisible()

  // Sign in
  await page.goto('/login?next=/account')
  await page.getByLabel('Email').fill(CUSTOMER.email)
  await page.getByLabel('Password').fill(CUSTOMER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello, Wanjiku')

  // Cart survived sign-in and is now stored on the account
  await page.goto('/cart')
  await expect(page.getByText('HP LaserJet Pro M404 / M405 Pickup Roller').first()).toBeVisible()

  // Wishlist (account)
  await page.goto('/p/brother-tn-2420-toner')
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/p/brother-tn-2420-toner'))
  await page.getByRole('button', { name: /Save Brother TN-2420 .* to wishlist/ }).first().click()
  await saved
  await expect(page.getByRole('button', { name: /Remove Brother TN-2420 .* from wishlist/ }).first()).toBeVisible()
  await page.goto('/account/wishlist')
  await expect(page.getByText('Brother TN-2420 High Yield Toner Cartridge')).toBeVisible()

  // Account pages
  await page.goto('/account/orders')
  await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible()

  // Sign out
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/')
})

test('anonymous visitors are sent to sign in from account pages', async ({ page }) => {
  await page.goto('/account/orders')
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Forders/)
})

test('part request can be submitted', async ({ page }) => {
  await page.goto('/support/part-request?brand=HP&model=M404dn')
  await page.getByLabel('Problem / error / part needed').fill('Printer shows paper jam with no paper inside')
  await page.getByLabel('Your name').fill('E2E Tester')
  await page.getByLabel('Phone').fill('0712345678')
  await page.getByRole('button', { name: 'Submit Request' }).click()
  await expect(page.getByText(/Request received/)).toBeVisible()
})
