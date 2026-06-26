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
    await expect(pageA.getByRole('option').filter({ hasText: recipient })).toBeVisible()
    await pageA.getByRole('option').filter({ hasText: recipient }).click()
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

test('request → pay updates inbox badge and balance live', async ({ browser }) => {
  // Random suffix: tests/e2e runs fullyParallel — avoid collisions across workers.
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const sender = `e2e_rqt_sender_${suffix}`
  const recipient = `e2e_rqt_recipient_${suffix}`

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  try {
    // --- Register + login both users ---
    await register(pageA, sender)
    await register(pageB, recipient)
    await login(pageA, sender)
    await login(pageB, recipient)

    // Both start at $1,000.00 on home page.
    await expect(pageA.getByRole('heading', { level: 1 })).toHaveText(/\$1,000\.00/)
    await expect(pageB.getByRole('heading', { level: 1 })).toHaveText(/\$1,000\.00/)

    // --- A navigates to /request and creates a request via the 3-step UI ---
    await pageA.goto('/request')
    await expect(pageA.getByRole('heading', { name: 'Step 1 of 3' })).toBeVisible()

    // Step 1: select recipient
    await pageA.getByLabel('Search for a recipient by username').fill(recipient)
    await expect(pageA.getByRole('option').filter({ hasText: recipient })).toBeVisible()
    await pageA.getByRole('option').filter({ hasText: recipient }).click()

    // Step 2: enter amount (10 USD = 1000 cents)
    await expect(pageA.getByRole('heading', { name: 'Step 2 of 3' })).toBeVisible()
    await pageA.getByLabel('Amount (USD)').fill('10')
    await pageA.getByLabel('Note (optional)').fill('lunch')
    await pageA.getByRole('button', { name: 'Continue' }).click()

    // Step 3: confirm
    await expect(pageA.getByRole('heading', { name: 'Step 3 of 3' })).toBeVisible()
    await expect(pageA.getByText(sender)).toBeVisible() // shows sender username on confirmation card
    await expect(pageA.getByText('$10.00')).toBeVisible()
    await expect(pageA.getByText('lunch')).toBeVisible()
    await pageA.getByRole('button', { name: 'Confirm & Request' }).click()
    await expect(pageA).toHaveURL('/')

    // A's balance is unchanged — no funds move until the recipient pays.
    await expect(pageA.getByRole('heading', { level: 1 })).toHaveText(/\$1,000\.00/)

    // --- Set up B's SSE guard BEFORE events can fire ---
    // The in-memory emitter has no replay; an event emitted before B registers would be lost.
    // waitForResponse on /api/sse proves the stream connection is established server-side.
    const bSseRegistered = pageB.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/sse',
      { timeout: 15_000 },
    )
    await pageB.goto('/inbox')
    await bSseRegistered

    // B's balance is unchanged at $1,000.00 — pending request received but not yet paid.
    await expect(pageB.getByRole('heading', { level: 1 })).toHaveText(/\$1,000\.00/)

    // AC #2: B's inbox badge increments live when REQUEST_RECEIVED arrives.
    await expect(pageB.getByLabel(/pending/)).toContainText('1')

    // --- B navigates to /inbox and pays the request ---
    await expect(pageB.getByRole('heading', { name: 'Inbox' })).toBeVisible()
    await expect(pageB.getByText(sender)).toBeVisible() // sender's username appears as requester in card

    // Click Pay on the request card — RequestCard has a Pay button per item.
    const payBtn = pageB.getByRole('button', { name: 'Pay' }).first()
    await expect(payBtn).toBeEnabled()
    await payBtn.click()
    await expect(pageB).toHaveURL('/')

    // --- AC #4: A receives REQUEST_RESOLVED + BALANCE_UPDATED live ---
    // Sender's balance drops from $1,000.00 to $990.00 (the requested amount).
    await expect(pageA.getByRole('heading', { level: 1 })).toHaveText(/\$990\.00/)

    // B's inbox badge decrements (REQUEST_RESOLVED fired — request is no longer pending).
    await expect(pageB.getByLabel(/pending/)).toContainText('0')
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})
