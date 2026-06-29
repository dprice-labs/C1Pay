import { test, expect, type Page, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PASSWORD = 'password123'
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

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

// Random suffix: tests/e2e runs fullyParallel, so a Date.now()-only suffix can collide across workers.
function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
  route: string,
) {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ')
      return `[${route}] ${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.helpUrl}\n  Elements: ${targets}`
    })
    .join('\n\n')
}

// `ready` is a locator unique to the route under test. Asserting it is visible
// before scanning guards against a false green: without it, an error boundary or
// an auth redirect would be audited instead of the real page and still report
// zero violations. Awaiting visibility also lets client hydration settle so axe
// scans the final DOM rather than a partially-rendered one.
async function auditPage(page: Page, route: string, ready: Locator) {
  await expect(ready).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations, formatViolations(results.violations, route)).toEqual([])
}

test('login page has zero violations', async ({ page }) => {
  await page.goto('/login')
  await auditPage(page, '/login', page.getByRole('button', { name: 'Sign in' }))
})

test('register page has zero violations', async ({ page }) => {
  await page.goto('/register')
  await auditPage(page, '/register', page.getByRole('button', { name: 'Create account' }))
})

test('authenticated pages have zero violations', async ({ page }) => {
  const username = `e2e_a11y_${uniqueSuffix()}`
  await register(page, username)
  await login(page, username)

  await auditPage(page, '/', page.locator('#balance-heading'))

  await page.goto('/inbox')
  await auditPage(page, '/inbox', page.getByRole('heading', { name: 'Inbox', level: 1 }))

  await page.goto('/send')
  await auditPage(page, '/send', page.getByRole('heading', { name: 'Send money', level: 1 }))

  await page.goto('/request')
  await auditPage(page, '/request', page.getByRole('heading', { name: 'Request money', level: 1 }))

  await page.goto('/history')
  await auditPage(page, '/history', page.getByRole('heading', { name: 'Transaction history', level: 1 }))
})

// AC#1: axe must scan /inbox with both incoming (Pay/Decline rendered) and outgoing (Cancel
// rendered) requests present. The existing `authenticated pages` test hits /inbox empty —
// an empty inbox hides every Epic 4 control from axe, so buttons are never scanned.
test('inbox populated with incoming + outgoing requests has zero violations', async ({ page }) => {
  const suffix = uniqueSuffix()
  const payer = `e2e_a11y_pay_${suffix}`
  const requester = `e2e_a11y_rq_${suffix}`
  const third = `e2e_a11y_th_${suffix}`

  // Three accounts: requester → payer (incoming for payer); payer → third (outgoing for payer)
  await register(page, third)
  await register(page, requester)
  await register(page, payer)

  // requester sends a request TO payer (payer sees it as incoming)
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

  // payer sends a request TO third (payer sees it as outgoing)
  await login(page, payer)
  await page.goto('/request')
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).fill(third)
  await expect(page.getByRole('option').filter({ hasText: third })).toBeVisible()
  await page.getByRole('option').filter({ hasText: third }).click()
  await page.getByLabel('Amount (USD)').fill('3')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & Request' }).click()
  await expect(page).toHaveURL('/')

  // Navigate to inbox — both incoming (Pay/Decline) and outgoing (Cancel) are rendered
  await page.goto('/inbox')
  // `ready` locator: Pay button is unique to populated incoming state (never shown empty)
  await auditPage(page, '/inbox (populated: incoming + outgoing)', page.getByRole('button', { name: 'Pay' }))
})

// AC#4 (colour-alone): status badges expose state as text, not colour alone.
// AC#4 (explicit reason): insufficient-balance condition is surfaced as explicit text.
test('inbox status badge is text, not colour alone', async ({ page }) => {
  const suffix = uniqueSuffix()
  const payer = `e2e_a11y_badge_pay_${suffix}`
  const requester = `e2e_a11y_badge_rq_${suffix}`

  await register(page, requester)
  await register(page, payer)

  // Create an incoming request for payer
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
  await expect(page.getByRole('button', { name: 'Pay' })).toBeVisible()

  // The badge text "PENDING" must be present as visible text (NFR15 / UX-DR3: never colour alone)
  await expect(page.getByText('PENDING').first()).toBeVisible()

  // The lifecycle indicator aria-label names all possible states
  await expect(
    page.locator('[aria-label="Request lifecycle: PENDING can become PAID, DECLINED, or CANCELLED"]'),
  ).toBeVisible()
})

// AC#4 (explicit reason): the insufficient-balance message states the shortfall explicitly,
// never just a disabled button. Triggered by attempting to pay when balance < request amount.
test('insufficient balance renders explicit reason text, not bare disabled state', async ({ page }) => {
  const suffix = uniqueSuffix()
  // payer starts at $1000; requester asks for $2000 — impossible to pay
  const payer = `e2e_a11y_nsf_pay_${suffix}`
  const requester = `e2e_a11y_nsf_rq_${suffix}`

  await register(page, requester)
  await register(page, payer)

  // requester requests $2000 from payer (more than payer's $1000 starting balance)
  await login(page, requester)
  await page.goto('/request')
  await expect(page.getByText('Step 1 of 3')).toBeVisible()
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).fill(payer)
  await expect(page.getByRole('option').filter({ hasText: payer })).toBeVisible()
  await page.getByRole('option').filter({ hasText: payer }).click()
  await page.getByLabel('Amount (USD)').fill('2000')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & Request' }).click()
  await expect(page).toHaveURL('/')

  await login(page, payer)
  await page.goto('/inbox')
  await expect(page.getByRole('button', { name: 'Pay' })).toBeVisible()

  // The explicit reason text must be visible (UX-DR7/9, AC#4).
  // Filter by text to distinguish from Next.js's __next-route-announcer__ which also has role="alert".
  const nsfAlert = page.getByRole('alert').filter({ hasText: 'Insufficient balance' })
  await expect(nsfAlert).toContainText('Insufficient balance')
  await expect(nsfAlert).toContainText('$1,000.00')
  await expect(nsfAlert).toContainText('$2,000.00')
})

// AC#5: aria-live regions exist for SSE-driven balance and pending-count updates.
// Structural assertion only — confirms the live regions are in the DOM before any event fires.
test('aria-live regions exist for balance and pending count on home page', async ({ page }) => {
  const username = `e2e_a11y_live_${uniqueSuffix()}`
  await register(page, username)
  await login(page, username)

  // Balance aria-live: the LiveBalance span wrapping AmountDisplay (inside h1#balance-heading)
  const balanceLiveRegion = page.locator('#balance-heading [aria-live="polite"]')
  await expect(balanceLiveRegion).toBeVisible()
  await expect(balanceLiveRegion).toHaveAttribute('aria-atomic', 'true')

  // Pending-count aria-live: the sr-only span on the home page
  const pendingLiveRegion = page.locator('span.sr-only[aria-live="polite"]')
  await expect(pendingLiveRegion).toBeAttached()
  await expect(pendingLiveRegion).toHaveAttribute('aria-atomic', 'true')
})

// AC#5 (live): when REQUEST_RECEIVED arrives via SSE, the aria-live pending-count region
// (now in the protected layout) updates its text. Two-client test pattern from realtime.spec.ts.
test('pending-count aria-live region updates live when REQUEST_RECEIVED arrives', async ({ browser }) => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const recipient = `e2e_a11y_rcv_rcpt_${suffix}`
  const requester = `e2e_a11y_rcv_rqst_${suffix}`

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  try {
    await register(pageA, requester)
    await register(pageB, recipient)
    await login(pageA, requester)

    // Register B's SSE stream before A creates the request (emitter has no replay).
    const bSseRegistered = pageB.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/sse',
      { timeout: 15_000 },
    )
    await login(pageB, recipient)
    await bSseRegistered

    // B is on home — the aria-live pending-count region is present.
    const pendingRegion = pageB.locator('[aria-live="polite"][aria-atomic="true"].sr-only')
    await expect(pendingRegion).toContainText('No pending requests')

    // A creates a request targeting B
    await pageA.goto('/request')
    await expect(pageA.getByText('Step 1 of 3')).toBeVisible()
    await pageA.getByRole('combobox', { name: 'Search for a recipient by username' }).fill(recipient)
    await expect(pageA.getByRole('option').filter({ hasText: recipient })).toBeVisible()
    await pageA.getByRole('option').filter({ hasText: recipient }).click()
    await pageA.getByLabel('Amount (USD)').fill('10')
    await pageA.getByRole('button', { name: 'Continue' }).click()
    await pageA.getByRole('button', { name: 'Confirm & Request' }).click()
    await expect(pageA).toHaveURL('/')

    // AC#5: the aria-live pending-count region on B's home page announces the change
    await expect(pendingRegion).toContainText('1 pending request')
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})

test('send page combobox has zero violations when expanded', async ({ page }) => {
  const suffix = uniqueSuffix()
  const searcher = `e2e_a11y_s_${suffix}`
  const target = `e2e_a11y_t_${suffix}`

  // Register a searchable target account, then the searcher.
  await register(page, target)
  await register(page, searcher)
  await login(page, searcher)

  await page.goto('/send')
  await expect(page.getByRole('heading', { name: 'Send money', level: 1 })).toBeVisible()

  // Type a prefix that will match target, triggering the listbox to expand.
  await page.getByRole('combobox', { name: 'Search for a recipient by username' }).fill('e2e_a11y_t_')

  // Wait for at least one option to appear before scanning.
  await expect(page.getByRole('listbox', { name: 'Matching users' })).toBeVisible()
  await expect(page.getByRole('option').first()).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(
    results.violations,
    formatViolations(results.violations, '/send (combobox expanded)'),
  ).toEqual([])
})
