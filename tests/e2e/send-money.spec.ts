import { test, expect, type Page } from '@playwright/test'

const PASSWORD = 'password123'

async function registerUser(page: Page, username: string) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/login')
}

async function loginUser(page: Page, username: string) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

test('send money flow — search, amount, confirm, balance updates', async ({ page }) => {
  const suffix = Date.now()
  const senderName = `e2e_sender_${suffix}`
  const recipientName = `e2e_recipient_${suffix}`

  await registerUser(page, recipientName)
  await registerUser(page, senderName)
  await loginUser(page, senderName)

  // Verify starting balance
  const balanceText = await page.getByRole('heading', { level: 1 }).textContent()
  expect(balanceText).toContain('$1,000.00')

  // Navigate to send flow
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page).toHaveURL('/send')
  await expect(page.getByText('Step 1 of 3')).toBeVisible()

  // Step 1: search and select recipient
  await page.getByLabel('Search for a recipient by username').fill(recipientName)
  const resultButton = page
    .getByRole('option')
    .filter({ hasText: recipientName })
    .getByRole('button')
  await expect(resultButton).toBeVisible()
  await resultButton.click()

  // Step 2: enter amount
  await expect(page.getByText('Step 2 of 3')).toBeVisible()
  await expect(page.getByText(recipientName)).toBeVisible()
  await page.getByLabel('Amount (USD)').fill('25')
  await page.getByRole('button', { name: 'Continue' }).click()

  // Step 3: verify summary and confirm
  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await expect(page.getByText('$25.00')).toBeVisible()
  await expect(page.getByText(recipientName)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & Send' }).click()

  // Should redirect to home with updated balance
  await expect(page).toHaveURL('/')
  const updatedBalance = await page.getByRole('heading', { level: 1 }).textContent()
  expect(updatedBalance).toContain('$975.00')
})

test('send money — insufficient balance shows explicit error', async ({ page }) => {
  const suffix = Date.now()
  const senderName = `e2e_sender_bal_${suffix}`
  const recipientName = `e2e_recipient_bal_${suffix}`

  await registerUser(page, recipientName)
  await registerUser(page, senderName)
  await loginUser(page, senderName)

  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page).toHaveURL('/send')

  await page.getByLabel('Search for a recipient by username').fill(recipientName)
  const resultButton = page
    .getByRole('option')
    .filter({ hasText: recipientName })
    .getByRole('button')
  await expect(resultButton).toBeVisible()
  await resultButton.click()

  // Try to send more than balance ($1,000.00)
  await page.getByLabel('Amount (USD)').fill('9999')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & Send' }).click()

  // Should show explicit insufficient balance error. Scope to the form's error alert —
  // Next.js renders an always-present empty #__next-route-announcer__ with role="alert",
  // so a bare getByRole('alert') is ambiguous in strict mode.
  const errorAlert = page.getByRole('alert').filter({ hasText: 'Insufficient balance' })
  await expect(errorAlert).toContainText('Insufficient balance')
  await expect(errorAlert).toContainText('$1,000.00')
  await expect(errorAlert).toContainText('$9,999.00')

  // Should remain on /send
  await expect(page).toHaveURL('/send')
})
