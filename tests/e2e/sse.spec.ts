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

test('EventSource auto-reconnects after /api/sse route is temporarily blocked', async ({ page }) => {
  const username = `sse_reconnect_${Date.now()}`
  const password = 'password123'

  await registerAndLogin(page, username, password)

  // Wait for the initial SSE connection
  await page.waitForRequest((req) => req.url().includes('/api/sse'))

  // Block the SSE route to simulate a network interruption
  await page.route('**/api/sse', (route) => route.abort())

  // Wait for EventSource to attempt reconnect (aborted connections trigger immediate retry)
  const reconnectPromise = page.waitForRequest((req) => req.url().includes('/api/sse'), {
    timeout: 10000,
  })

  // Unblock the route
  await page.unrouteAll()

  // Verify the EventSource reconnected
  const reconnectRequest = await reconnectPromise
  expect(reconnectRequest.url()).toContain('/api/sse')
})
