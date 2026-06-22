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

test('recipient balance updates live when money is sent', async ({ browser }) => {
  // Random suffix: tests/e2e runs fullyParallel, so a Date.now()-only suffix can collide
  // across workers (flagged in Story 3.2 review).
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const sender = `e2e_rt_sender_${suffix}`
  const recipient = `e2e_rt_recipient_${suffix}`

  // Two browser contexts → isolated cookies, so the two pages are genuinely different
  // logged-in users (a single context would share one session).
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  try {
    await register(pageA, sender)
    await register(pageB, recipient)
    await login(pageA, sender)

    // Make B's SSE registration deterministic before A sends. The in-memory emitter has no
    // replay: a BALANCE_UPDATED emitted before B's stream registers server-side would be
    // dropped, flaking this test on a slow worker. /api/sse returns its response headers only
    // AFTER register() runs, so awaiting that response proves B is registered. Set the waiter
    // up BEFORE the login navigation that opens the stream so it can't be missed.
    const bSseRegistered = pageB.waitForResponse((r) => new URL(r.url()).pathname === '/api/sse', {
      timeout: 15_000,
    })
    await login(pageB, recipient)
    await bSseRegistered

    // Both land on home and open their SSE connection. Recipient starts at $1,000.00.
    await expect(pageB.getByRole('heading', { level: 1 })).toHaveText(/\$1,000\.00/)

    // A sends $25 to B through the send funnel. The home "Send" control is a Base UI
    // Button rendered as an <a> with nativeButton={false}, which gives it role="button"
    // (not "link") — select by its button role accordingly.
    await pageA.getByRole('button', { name: 'Send', exact: true }).click()
    await pageA.getByLabel('Search for a recipient by username').fill(recipient)
    await pageA
      .getByRole('option')
      .filter({ hasText: recipient })
      .getByRole('button')
      .click()
    await pageA.getByLabel('Amount (USD)').fill('25')
    await pageA.getByRole('button', { name: 'Continue' }).click()
    await pageA.getByRole('button', { name: 'Confirm & Send' }).click()
    await expect(pageA).toHaveURL('/')

    // AC #5: sender's debit is reflected after returning home.
    await expect(pageA.getByRole('heading', { level: 1 })).toHaveText(/\$975\.00/)

    // AC #6: recipient is credited LIVE with no reload. expect() auto-retries until the
    // SSE BALANCE_UPDATED event lands (within NFR1's ~1s under local conditions).
    // Never call pageB.reload() — the live push is the whole point of this test.
    await expect(pageB.getByRole('heading', { level: 1 })).toHaveText(/\$1,025\.00/)
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})
