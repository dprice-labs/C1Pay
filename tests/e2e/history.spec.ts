import { test, expect, type Page } from '@playwright/test'

const PASSWORD = 'password123'

async function register(page: Page, username: string) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/login')
}

async function login(page: Page, username: string) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

// Random suffix: tests/e2e runs fullyParallel, so a Date.now()-only suffix can
// collide across workers (flagged in Story 3.2 review).
function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

test('history shows an explicit empty state for a fresh user', async ({ page }) => {
  const suffix = uniqueSuffix()
  const user = `e2e_hist_empty_${suffix}`

  await register(page, user)
  await login(page, user)

  // Navigate via the home link (Server Component → data present on render).
  await page.getByRole('link', { name: 'View transaction history' }).click()
  await expect(page).toHaveURL('/history')

  await expect(page.getByRole('heading', { name: 'Transaction history' })).toBeVisible()
  await expect(page.getByText('No transactions yet.')).toBeVisible()
})

test('sent transaction appears in history with counterparty, direction, and amount', async ({
  page,
}) => {
  const suffix = uniqueSuffix()
  const sender = `e2e_hist_sender_${suffix}`
  const recipient = `e2e_hist_recipient_${suffix}`

  await register(page, recipient)
  await register(page, sender)
  await login(page, sender)

  // Send $25 to the recipient.
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page).toHaveURL('/send')
  await page.getByLabel('Search for a recipient by username').fill(recipient)
  await expect(page.getByRole('option').filter({ hasText: recipient })).toBeVisible()
  await page.getByRole('option').filter({ hasText: recipient }).click()
  await page.getByLabel('Amount (USD)').fill('25')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & Send' }).click()
  await expect(page).toHaveURL('/')

  // Navigate to history — no reload needed (Server Component renders fresh data).
  await page.getByRole('link', { name: 'View transaction history' }).click()
  await expect(page).toHaveURL('/history')

  const row = page.getByRole('listitem').filter({ hasText: recipient })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Sent transaction')
  await expect(row).toContainText('$25.00')
})
