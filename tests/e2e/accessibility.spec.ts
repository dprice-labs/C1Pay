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
