import { test, expect, type Page } from '@playwright/test'

// Self-contained helpers per spec-file convention (story 6.4 ruled out a shared utils.ts —
// every e2e spec carries its own register/login/uniqueSuffix).
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

// fullyParallel: a Date.now()-only suffix can collide across workers.
function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

// The heart of AC#3 as an automated check: the document must never scroll horizontally
// at any contract viewport. Measured the same way the Task 1 audit found the failures.
async function expectNoHorizontalScroll(page: Page) {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflows, 'page must not scroll horizontally at this viewport').toBe(false)
}

// The contract (story 6.3 AC#4): the exact viewports the suite must drive.
const VIEWPORTS = {
  mobile: { width: 375, height: 667 }, // iPhone SE
  tablet: { width: 768, height: 1024 }, // iPad portrait
  desktop: { width: 1280, height: 800 },
} as const

// A single unbroken token (no spaces) far wider than a 375px column — guards the
// confirm-screen Note row, whose break-words/min-w-0 wrap is the only thing keeping
// a long note from overflowing the card at mobile.
const LONG_NOTE = 'supercalifragilisticexpialidocioussupercalifragilisticexpialidocious'

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} (${viewport.width}px)`, () => {
    test.use({ viewport })

    test('home + send funnel — flow operable, no horizontal scroll', async ({ page }) => {
      const suffix = uniqueSuffix()
      const sender = `e2e_rsp_s_${suffix}`
      // A deliberately long recipient username also guards the send step-2 line and
      // step-3 confirm row (the worst-case overflow surfaces Task 1 found at mobile).
      const target = `e2e_rsp_supercalifragilisticexpialidocious_t_${suffix}`

      await register(page, target)
      await register(page, sender)
      await login(page, sender)

      // Home is operable: the balance heading (h1) is present and nothing scrolls sideways.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoHorizontalScroll(page)

      await page.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(page).toHaveURL('/send')

      // Step 1 → select recipient. Type the FULL suffixed name (prefix search is
      // non-deterministic under parallel workers) and click the option <li> directly.
      await page
        .getByRole('combobox', { name: 'Search for a recipient by username' })
        .fill(target)
      await expect(page.getByRole('option').filter({ hasText: target })).toBeVisible()
      await page.getByRole('option').filter({ hasText: target }).click()

      // Step 2 → amount + a long unbroken note, so step 3's confirm card is
      // checked with BOTH overflow surfaces present (the recipient row AND the note row).
      await expect(page.getByText('Step 2 of 3')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.getByLabel('Amount (USD)').fill('10')
      await page.getByLabel('Note (optional)').fill(LONG_NOTE)
      await page.getByRole('button', { name: 'Continue' }).click()

      // Step 3 → confirm. No horizontal scroll even with the long recipient name + long note.
      await expect(page.getByText('Step 3 of 3')).toBeVisible()
      await expect(page.getByText(LONG_NOTE)).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.getByRole('button', { name: 'Confirm & Send' }).click()

      // Back home, balance updated, still no horizontal scroll.
      await expect(page).toHaveURL('/')
      await expectNoHorizontalScroll(page)
    })
  })
}

// Mobile-only: the long-content list rows (history, inbox) are the Task 4 overflow surfaces.
// We build a real long-username row inline so the guard is deterministic under parallel workers.
test.describe('mobile (375px) — long-content list overflow', () => {
  test.use({ viewport: VIEWPORTS.mobile })

  test('history and inbox do not scroll horizontally with a long username + large amount', async ({
    page,
  }) => {
    const suffix = uniqueSuffix()
    const longName = `e2e_rsp_supercalifragilisticexpialidocious_${suffix}`
    const sender = `e2e_rsp_io_${suffix}`

    await register(page, longName)
    await register(page, sender)

    // Sender → long-named user: sender's HISTORY row now carries the long name + a wide amount.
    await login(page, sender)
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Search for a recipient by username' })
      .fill(longName)
    await expect(page.getByRole('option').filter({ hasText: longName })).toBeVisible()
    await page.getByRole('option').filter({ hasText: longName }).click()
    await page.getByLabel('Amount (USD)').fill('123.45')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Confirm & Send' }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/history')
    await expect(page.getByText(longName)).toBeVisible()
    await expectNoHorizontalScroll(page)

    // Long-named user → requests money FROM sender: sender's INBOX now carries the long requester name.
    // This also exercises the REQUEST confirm screen (symmetric break-words fix to /send) — assert
    // no horizontal scroll through its steps, with a long note to stress the confirm card's note row.
    await login(page, longName)
    await page.getByRole('button', { name: 'Request', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Search for a recipient by username' })
      .fill(sender)
    await expect(page.getByRole('option').filter({ hasText: sender })).toBeVisible()
    await page.getByRole('option').filter({ hasText: sender }).click()
    await expect(page.getByText('Step 2 of 3')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.getByLabel('Amount (USD)').fill('678.90')
    await page.getByLabel('Note (optional)').fill(LONG_NOTE)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Step 3 of 3')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.getByRole('button', { name: 'Confirm & Request' }).click()
    await expect(page).toHaveURL('/')

    await login(page, sender)
    await page.goto('/inbox')
    await expect(page.getByText(longName)).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
