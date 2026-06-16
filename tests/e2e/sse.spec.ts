import { test, expect } from '@playwright/test'

async function registerAndLogin(
  page: import('@playwright/test').Page,
  username: string,
  password: string,
) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/')
}

test('SSE connection to /api/sse is opened when the protected home page loads', async ({ page }) => {
  const username = `sse_user_${Date.now()}`
  const password = 'password123'

  const sseRequestPromise = page.waitForRequest((req) => req.url().includes('/api/sse'))

  await registerAndLogin(page, username, password)

  const sseRequest = await sseRequestPromise
  expect(sseRequest.url()).toContain('/api/sse')
  expect(sseRequest.method()).toBe('GET')
})

test('EventSource reconnects with HTTP 200 after a network interruption', async ({ page }) => {
  const username = `sse_reconnect_${Date.now()}`
  const password = 'password123'

  await registerAndLogin(page, username, password)

  // Confirm initial SSE connection established
  await page.waitForRequest((req) => req.url().includes('/api/sse'))

  // Register response listener before triggering the drop so we don't miss the reconnect
  const reconnectResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/sse') && resp.status() === 200,
    { timeout: 15000 },
  )

  // Briefly take the network offline then restore — drops the SSE connection with a single
  // error event (errorStreak = 1, below the 3-cap), then EventSource reconnects on restore.
  await page.context().setOffline(true)
  await page.context().setOffline(false)

  const reconnectResponse = await reconnectResponsePromise
  expect(reconnectResponse.status()).toBe(200)
})
