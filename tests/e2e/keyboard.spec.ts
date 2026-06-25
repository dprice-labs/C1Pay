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

  // Step 1: search + select via keyboard
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).focus()
  await page.keyboard.type(`e2e_kb_t_`)
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

  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).focus()
  await page.keyboard.type(`e2e_kb_rt_`)
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

// TODO(4.3/4.4): Add keyboard tests for Pay, Decline, Cancel once those stories ship.
//   Flows live on /inbox; buttons will be inside RequestCard components.
