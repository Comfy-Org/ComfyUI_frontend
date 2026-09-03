// eslint-disable-next-line no-restricted-imports -- staging has no local ComfyUI settings backend
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const evidenceDir =
  '/home/c_byrne/workspaces/comfy-account-layer/.concept-poc/account-layer-refactor/07-poc/consumer-frontend/evidence'
const testUrl = process.env.PLAYWRIGHT_TEST_URL ?? 'http://localhost:5173'

interface AccountLayerDebug {
  billingRequests: number
  sessionExchanges: number
  lastBillingToken: string | null
  lastSessionToken: string | null
  lastBillingSessionExchange: number | null
  credentialLifetimeMs: number | null
  refreshScheduleDelayMs: number | null
  refreshCredits(): Promise<void>
  runScheduledRefresh(): void
  signOut(): Promise<void>
}

async function signIn(page: Page) {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) throw new Error('E2E credentials are unavailable')

  await page.goto(`${testUrl}/cloud/login`)
  await page.getByRole('button', { name: /use email/i }).click()
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await expect(page).not.toHaveURL(/\/cloud\/login/)
}

async function debugSnapshot(page: Page) {
  return await page.evaluate(
    () => Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
  )
}

async function refreshCredits(page: Page) {
  await page.evaluate(async () => {
    const debug = Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
    await debug.refreshCredits()
  })
}

test.beforeAll(async () => mkdir(evidenceDir, { recursive: true }))

test.setTimeout(60_000)

test('uses the account package for session, billing, replay, errors, and sign-out', async ({
  page
}) => {
  await signIn(page)

  const credits = page.getByTestId('account-layer-poc')
  await expect(credits).toHaveText(/\d+/, { timeout: 30_000 })
  const initial = await debugSnapshot(page)
  expect(initial.sessionExchanges).toBeGreaterThan(0)
  expect(initial.billingRequests).toBeGreaterThan(0)
  expect(initial.lastBillingToken).toBe(initial.lastSessionToken)
  expect(initial.lastBillingSessionExchange).toBe(initial.sessionExchanges)
  await page.screenshot({ path: `${evidenceDir}/signed-in-credits.png` })

  let balanceAttempts = 0
  await page.route('**/api/billing/balance', async (route) => {
    balanceAttempts++
    if (balanceAttempts === 1) {
      await route.fulfill({ status: 401, body: '{"message":"once"}' })
      return
    }
    await route.continue()
  })
  await refreshCredits(page)
  await expect(credits).toHaveText(/\d+/)
  const replayed = await debugSnapshot(page)
  expect(balanceAttempts).toBe(2)
  expect(replayed.sessionExchanges).toBe(initial.sessionExchanges + 1)
  expect(replayed.lastBillingToken).toBe(replayed.lastSessionToken)
  expect(replayed.lastBillingSessionExchange).toBe(replayed.sessionExchanges)
  await page.unroute('**/api/billing/balance')

  await page.route('**/api/billing/balance', (route) =>
    route.fulfill({ status: 500, body: '{"message":"forced"}' })
  )
  await refreshCredits(page)
  await expect(credits.getByRole('alert')).toHaveText('Error')
  await page.screenshot({ path: `${evidenceDir}/balance-500-error.png` })
  await page.unroute('**/api/billing/balance')
  await refreshCredits(page)
  await expect(credits).toHaveText(/\d+/)

  await page.evaluate(async () => {
    const debug = Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
    await debug.signOut()
  })
  await expect(credits).toBeHidden()
  const signedOut = await debugSnapshot(page)
  await page.goto(`${testUrl}/cloud/login`)
  await expect(page).toHaveURL(/\/cloud\/login/)

  await writeFile(
    `${evidenceDir}/debug-snapshots.json`,
    JSON.stringify(
      {
        initial: {
          billingRequests: initial.billingRequests,
          sessionExchanges: initial.sessionExchanges,
          tokenContinuity:
            initial.lastBillingToken === initial.lastSessionToken,
          billingSessionExchange: initial.lastBillingSessionExchange
        },
        replay: {
          balanceAttempts,
          sessionExchanges: replayed.sessionExchanges,
          tokenContinuity:
            replayed.lastBillingToken === replayed.lastSessionToken,
          billingSessionExchange: replayed.lastBillingSessionExchange
        },
        signedOut: {
          sessionExchanges: signedOut.sessionExchanges,
          creditsHidden: true
        }
      },
      null,
      2
    )
  )
})

test('refreshes at the natural five-minute buffer boundary', async ({
  page
}) => {
  await signIn(page)
  const credits = page.getByTestId('account-layer-poc')
  await expect(credits).toHaveText(/\d+/, { timeout: 30_000 })
  const initial = await debugSnapshot(page)
  expect(initial.refreshScheduleDelayMs).not.toBeNull()
  expect(initial.credentialLifetimeMs).not.toBeNull()
  expect(
    (initial.credentialLifetimeMs ?? 0) - (initial.refreshScheduleDelayMs ?? 0)
  ).toBeGreaterThanOrEqual(299_000)
  expect(
    (initial.credentialLifetimeMs ?? 0) - (initial.refreshScheduleDelayMs ?? 0)
  ).toBeLessThanOrEqual(301_000)

  const boundaryDelay = initial.refreshScheduleDelayMs ?? 0
  await page.evaluate(() => {
    const debug = Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
    debug.runScheduledRefresh()
  })
  await expect
    .poll(async () => (await debugSnapshot(page)).sessionExchanges)
    .toBeGreaterThan(initial.sessionExchanges)
  await refreshCredits(page)
  const refreshed = await debugSnapshot(page)
  expect(refreshed.lastBillingToken).toBe(refreshed.lastSessionToken)
  expect(refreshed.lastBillingSessionExchange).toBe(refreshed.sessionExchanges)
  await writeFile(
    `${evidenceDir}/natural-refresh.log`,
    `scheduler=debug-hook\nbuffer-ms=300000\nscheduled-delay-ms=${boundaryDelay}\ncredential-lifetime-ms=${initial.credentialLifetimeMs}\nexchange-before=${initial.sessionExchanges}\nexchange-after=${refreshed.sessionExchanges}\nnext-balance-used-refreshed-session=true\n`
  )
})
