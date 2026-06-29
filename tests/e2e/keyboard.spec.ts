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

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

test('skip link — keyboard only', async ({ page }) => {
  const username = `e2e_kb_skip_${uniqueSuffix()}`
  await register(page, username)
  await login(page, username)

  // Hard navigate to home so focus state is clean (no SPA navigation residue).
  // Wait for the balance heading (client-rendered via Zustand store) to confirm
  // React hydration is complete before exercising keyboard navigation.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Tab once — skip link is the first focusable element in the layout
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Skip to content' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  // tabIndex={-1} on <main> allows focus to land here
  await expect(page.locator('#main-content')).toBeFocused()
})

test('register — keyboard only', async ({ page }) => {
  const username = `e2e_kb_reg_${uniqueSuffix()}`
  await page.goto('/register')
  await page.getByLabel('Username').focus()
  await page.keyboard.type(username)
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/login')
})

test('login — keyboard only', async ({ page }) => {
  const username = `e2e_kb_login_${uniqueSuffix()}`
  await register(page, username)
  await page.goto('/login')
  await page.getByLabel('Username').focus()
  await page.keyboard.type(username)
  await page.keyboard.press('Tab')
  await page.keyboard.type(PASSWORD)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/')
})

test('send money — keyboard only', async ({ page }) => {
  const suffix = uniqueSuffix()
  const sender = `e2e_kb_s_${suffix}`
  const target = `e2e_kb_t_${suffix}`

  await register(page, target)
  await register(page, sender)
  await login(page, sender)

  await page.goto('/send')
  await expect(page.getByRole('heading', { name: 'Send money', level: 1 })).toBeVisible()

  // Step 1: search + select via keyboard.
  // Type the full suffixed username so the prefix `ilike` match resolves to this
  // test's own target only — a bare `e2e_kb_t_` prefix would also match targets
  // created by other parallel workers (and prior un-torn-down runs), making the
  // selected `results[0]` non-deterministic.
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).focus()
  await page.keyboard.type(target)
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  // Focus management should place focus on amount input
  await expect(page.getByLabel('Amount (USD)')).toBeFocused()

  // Step 2: enter amount via keyboard
  await page.keyboard.type('10')
  await page.keyboard.press('Enter')

  // Focus management should place focus on Back button
  await expect(page.getByRole('button', { name: 'Back' }).last()).toBeFocused()

  // Step 3: tab to Confirm and activate
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/')
})

test('request money — keyboard only', async ({ page }) => {
  const suffix = uniqueSuffix()
  const requester = `e2e_kb_rq_${suffix}`
  const target = `e2e_kb_rt_${suffix}`

  await register(page, target)
  await register(page, requester)
  await login(page, requester)

  await page.goto('/request')
  await expect(page.getByRole('heading', { name: 'Request money', level: 1 })).toBeVisible()

  // Full suffixed username scopes the prefix search to this test's own target
  // (see send-money test above for why a bare prefix is non-deterministic).
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).focus()
  await page.keyboard.type(target)
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  await expect(page.getByLabel('Amount (USD)')).toBeFocused()
  await page.keyboard.type('5')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', { name: 'Back' }).last()).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/')
})

test('logout — keyboard only', async ({ page }) => {
  const username = `e2e_kb_out_${uniqueSuffix()}`
  await register(page, username)
  await login(page, username)

  await page.getByRole('button', { name: 'Sign out' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/login')
})

// AC3 (logical tab order) + AC4 (no focus traps) — verified explicitly on the send
// funnel's step 2, the AC's named subject. The forward tab sequence must match the
// visual reading order, Shift+Tab must walk it in reverse, and Tab past the last
// control must be able to LEAVE the funnel (proving the step is not a focus trap).
test('tab order and no focus trap — send funnel step 2 (keyboard only)', async ({ page }) => {
  const suffix = uniqueSuffix()
  const sender = `e2e_kb_ord_s_${suffix}`
  const target = `e2e_kb_ord_t_${suffix}`

  await register(page, target)
  await register(page, sender)
  await login(page, sender)

  await page.goto('/send')
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).focus()
  await page.keyboard.type(target)
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  // AC3: forward tab order matches visual reading order
  await expect(page.getByLabel('Amount (USD)')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Note (optional)')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Back' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused()

  // AC3 (reverse): Shift+Tab walks the same sequence backwards
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Back' })).toBeFocused()

  // AC4: no focus trap — Tab past the last control escapes the funnel form
  // (focus does NOT wrap back to the amount input).
  await page.getByRole('button', { name: 'Continue' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Amount (USD)')).not.toBeFocused()
})

// AC#2 (story 6.5): Epic 4 resolve actions are keyboard-operable with correct focus management.
// When a resolved card unmounts (router.refresh() removes it from DOM), focus must land on the
// section heading, not fall to <body> (WCAG 2.4.3 / 2.4.7 failure).

test('pay request — keyboard only + focus on Inbox heading after resolve', async ({ page }) => {
  const suffix = uniqueSuffix()
  const payer = `e2e_kb_pay_${suffix}`
  const requester = `e2e_kb_rq_${suffix}`

  await register(page, requester)
  await register(page, payer)

  // requester → payer (so payer has an incoming pending request)
  await login(page, requester)
  await page.goto('/request')
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).fill(payer)
  await expect(page.getByRole('option').filter({ hasText: payer })).toBeVisible()
  await page.getByRole('option').filter({ hasText: payer }).click()
  await page.getByLabel('Amount (USD)').fill('5')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & Request' }).click()
  await expect(page).toHaveURL('/')

  await login(page, payer)
  await page.goto('/inbox')
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay' })).toBeVisible()

  // Keyboard: focus Pay button and activate with Enter
  await page.getByRole('button', { name: 'Pay' }).focus()
  await expect(page.getByRole('button', { name: 'Pay' })).toBeFocused()
  await page.keyboard.press('Enter')

  // Card leaves the pending list after router.refresh()
  await expect(page.getByRole('button', { name: 'Pay' })).not.toBeVisible({ timeout: 8_000 })

  // Focus must be on the Inbox heading, not lost to <body> (WCAG 2.4.3)
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeFocused()
})

test('decline request — keyboard only + focus on Inbox heading after resolve', async ({ page }) => {
  const suffix = uniqueSuffix()
  const decliner = `e2e_kb_dec_${suffix}`
  const requester = `e2e_kb_decrq_${suffix}`

  await register(page, requester)
  await register(page, decliner)

  await login(page, requester)
  await page.goto('/request')
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).fill(decliner)
  await expect(page.getByRole('option').filter({ hasText: decliner })).toBeVisible()
  await page.getByRole('option').filter({ hasText: decliner }).click()
  await page.getByLabel('Amount (USD)').fill('5')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & Request' }).click()
  await expect(page).toHaveURL('/')

  await login(page, decliner)
  await page.goto('/inbox')
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Decline' })).toBeVisible()

  await page.getByRole('button', { name: 'Decline' }).focus()
  await expect(page.getByRole('button', { name: 'Decline' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', { name: 'Decline' })).not.toBeVisible({ timeout: 8_000 })

  // Focus must be on the Inbox heading, not lost to <body>
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeFocused()
})

test('cancel outgoing request — keyboard only + focus on Outgoing requests heading after resolve', async ({
  page,
}) => {
  const suffix = uniqueSuffix()
  const canceller = `e2e_kb_can_${suffix}`
  const target = `e2e_kb_cant_${suffix}`

  await register(page, target)
  await register(page, canceller)

  // canceller sends a request TO target (canceller sees it as outgoing)
  await login(page, canceller)
  await page.goto('/request')
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).fill(target)
  await expect(page.getByRole('option').filter({ hasText: target })).toBeVisible()
  await page.getByRole('option').filter({ hasText: target }).click()
  await page.getByLabel('Amount (USD)').fill('5')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & Request' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/inbox')
  await expect(page.getByRole('heading', { name: 'Outgoing requests', level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

  await page.getByRole('button', { name: 'Cancel' }).focus()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', { name: 'Cancel' })).not.toBeVisible({ timeout: 8_000 })

  // Focus must be on the Outgoing requests heading, not lost to <body>
  await expect(page.getByRole('heading', { name: 'Outgoing requests', level: 2 })).toBeFocused()
})
