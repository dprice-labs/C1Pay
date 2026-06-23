import { test, expect, type Page } from '@playwright/test'
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

async function auditPage(page: Page, route: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations, formatViolations(results.violations, route)).toEqual([])
}

test('login page has zero violations', async ({ page }) => {
  await page.goto('/login')
  await auditPage(page, '/login')
})

test('register page has zero violations', async ({ page }) => {
  await page.goto('/register')
  await auditPage(page, '/register')
})

test('authenticated pages have zero violations', async ({ page }) => {
  const username = `e2e_a11y_${uniqueSuffix()}`
  await register(page, username)
  await login(page, username)

  await auditPage(page, '/')

  await page.goto('/send')
  await auditPage(page, '/send')

  await page.goto('/request')
  await auditPage(page, '/request')

  await page.goto('/history')
  await auditPage(page, '/history')
})
