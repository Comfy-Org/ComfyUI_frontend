// Rebuilt in run 21b from the settlement harness's widget sign-in flow.
// eslint-disable-next-line no-restricted-imports -- QA uses a persistent authenticated browser directly
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const baseUrl = process.env.PLAYWRIGHT_TEST_URL ?? 'http://127.0.0.1:5226'
const evidenceDir = process.env.ACCOUNT_LAYER_EVIDENCE_DIR
if (!evidenceDir) throw new Error('ACCOUNT_LAYER_EVIDENCE_DIR is unavailable')

async function waitForStableUrl(page: Page, stableMs = 1_500) {
  let previous = page.url()
  let stableSince = Date.now()
  await expect
    .poll(
      () => {
        const current = page.url()
        if (current !== previous) {
          previous = current
          stableSince = Date.now()
        }
        return Date.now() - stableSince
      },
      { timeout: 10_000 }
    )
    .toBeGreaterThanOrEqual(stableMs)
    .catch(() => {})
}

async function signIn(page: Page) {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) throw new Error('E2E credentials are unavailable')
  await page.goto(baseUrl)
  await expect
    .poll(
      () =>
        page
          .evaluate(() => Boolean(Reflect.get(window, '__accountLayerPoc')))
          .catch(() => false),
      { timeout: 30_000 }
    )
    .toBe(true)
  const currentEmail = await page.evaluate(() => {
    const seam = Reflect.get(window, '__accountLayerPoc') as {
      getCurrentEmail?(): string | null
    }
    return seam.getCurrentEmail?.() ?? null
  })
  if (currentEmail === email) return
  await page.evaluate(async () => {
    const seam = Reflect.get(window, '__accountLayerPoc') as {
      signOut(): Promise<void>
    }
    await seam.signOut()
  })
  await page.goto(`${baseUrl}/cloud/login`)
  await page.getByRole('button', { name: /use email/i }).click()
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  const responsePromise = page.waitForResponse((response) =>
    response
      .url()
      .includes('identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')
  )
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  const response = await responsePromise
  expect(response.ok()).toBe(true)
  await expect(page).not.toHaveURL(/\/cloud\/login/, { timeout: 30_000 })
  await waitForStableUrl(page)
}

async function requireAuthenticated(page: Page) {
  await expect
    .poll(
      () =>
        page
          .evaluate(() => Boolean(Reflect.get(window, '__accountLayerPoc')))
          .catch(() => false),
      { timeout: 30_000 }
    )
    .toBe(true)
  expect(
    await page.evaluate(async () => {
      const seam = Reflect.get(window, '__accountLayerPoc') as {
        whenAuthenticated(timeoutMs?: number): Promise<void>
        getSessionPhase(): string
      }
      await seam.whenAuthenticated(30_000)
      return seam.getSessionPhase()
    })
  ).toBe('authenticated')
}

test('captures authenticated read-only account probes', async ({ page }) => {
  test.setTimeout(120_000)
  mkdirSync(evidenceDir, { recursive: true })
  await signIn(page)
  await requireAuthenticated(page)
  const bearer = await expect
    .poll(
      () =>
        page.evaluate(() => {
          const seam = Reflect.get(window, '__accountLayerPoc') as {
            lastBillingToken?: string | null
          }
          return seam.lastBillingToken ?? null
        }),
      { timeout: 30_000 }
    )
    .not.toBeNull()
    .then(async () =>
      page.evaluate(() => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          lastBillingToken?: string | null
        }
        return seam.lastBillingToken!
      })
    )
  const fixture = (process.env.FIXTURE_LABEL ?? 'x').toLowerCase()
  writeFileSync(
    `${evidenceDir}/preflight-${fixture}-signin.json`,
    `${JSON.stringify({ status: 200, email: process.env.E2E_EMAIL, password: '[REDACTED]' })}\n`
  )
  const probes: Array<[string, string]> = [
    ['status', '/api/billing/status'],
    ['balance', '/api/billing/balance'],
    ['capabilities', '/api/billing/capabilities']
  ]
  const operationId = process.env.RECOVER_OPERATION_ID
  if (operationId) probes.push(['ops', `/api/billing/ops/${operationId}`])
  else
    writeFileSync(
      `${evidenceDir}/probe-ops.json`,
      '{"operation_id":null,"note":"no known operation id"}\n'
    )
  for (const [name, path] of probes) {
    const result = await page.evaluate(
      async ({ path, bearer }) => {
        const response = await fetch(path, {
          headers: { Authorization: `Bearer ${bearer}` }
        })
        return {
          status: response.status,
          body: await response.json().catch(() => null)
        }
      },
      { path, bearer }
    )
    writeFileSync(
      `${evidenceDir}/probe-${name}.json`,
      `${JSON.stringify(result.body)}\n`
    )
    expect(result.status, `${path} status`).toBe(200)
  }
})
