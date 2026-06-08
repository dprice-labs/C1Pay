import { test, expect } from '@playwright/test'

test('register → login → access protected page → logout → redirect to login → protected page no longer accessible', async ({ page }) => {
  const username = `e2e_user_${Date.now()}`
  const password = 'password123'

  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/login')

  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')

  await expect(page.getByRole('heading', { name: /signed in/i })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')

  await page.goto('/')
  await expect(page).toHaveURL('/login')
})

test('unauthenticated request to a non-auth API route returns 401 JSON', async ({ request }) => {
  const response = await request.get('/api/accounts')

  expect(response.status()).toBe(401)
  expect(await response.json()).toEqual({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
})
