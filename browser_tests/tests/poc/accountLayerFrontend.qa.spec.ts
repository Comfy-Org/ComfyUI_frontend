// eslint-disable-next-line no-restricted-imports -- staging has no local ComfyUI settings backend
import { expect, test } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const evidenceDir =
  '/home/c_byrne/workspaces/comfy-account-layer/.concept-poc/account-layer-refactor/08-qa/evidence/run-6-frontend'
const paymentsEvidenceDir =
  '/home/c_byrne/workspaces/comfy-account-layer/.concept-poc/account-layer-refactor/07-poc/consumer-frontend/evidence/payments'
const testUrl = process.env.PLAYWRIGHT_TEST_URL ?? 'http://localhost:5173'
const storagePrefix = 'comfyui-frontend-account-layer-poc:'

interface AccountLayerDebug {
  billingRequests: number
  sessionExchanges: number
  credentialLifetimeMs: number | null
  refreshScheduleDelayMs: number | null
  refreshCredits(): Promise<void>
  signOut(): Promise<void>
  billingPosts: number
  openUrlCalls: number
  lastCheckoutUrl: string | null
  payment: { step: string }
  injectOperationResponse(response: {
    status: string
    action_url?: string
    reason_code?: string
    no_charge_confirmed?: boolean
  }): Promise<void>
  showBillingModal(): void
}

function isPackageExchange(request: Request) {
  if (!request.url().includes('/auth/token')) return false
  const body = request.postData()
  return body?.includes('identityToken') && body.includes('workspaceId')
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
  const personalUse = page.getByRole('button', { name: 'Personal use' })
  await personalUse
    .waitFor({ state: 'visible', timeout: 5_000 })
    .catch(() => {})
  if (await personalUse.isVisible()) await personalUse.click()
  const onboarding = page.getByRole('heading', {
    name: "Let's get to know you"
  })
  for (let step = 0; step < 12 && (await onboarding.isVisible()); step++) {
    const next = page.getByRole('button', { name: /^(Next|Submit)$/ })
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click()
    else
      await page.getByRole('group').last().getByRole('button').first().click()
  }
}

async function snapshot(page: Page) {
  return await page.evaluate(() => {
    const debug = Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
    return {
      billingRequests: debug.billingRequests,
      sessionExchanges: debug.sessionExchanges,
      credentialLifetimeMs: debug.credentialLifetimeMs,
      refreshScheduleDelayMs: debug.refreshScheduleDelayMs
    }
  })
}

async function refreshCredits(page: Page) {
  await page.evaluate(async () => {
    const debug = Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
    await debug.refreshCredits()
  })
}

async function packageKeys(page: Page) {
  return await page.evaluate(
    (prefix) =>
      Object.keys(sessionStorage).filter((key) => key.startsWith(prefix)),
    storagePrefix
  )
}

test.beforeAll(async () => {
  await Promise.all([
    mkdir(evidenceDir, { recursive: true }),
    mkdir(paymentsEvidenceDir, { recursive: true })
  ])
})

test.setTimeout(60_000)

test('refreshes exactly at the natural five-minute boundary', async ({
  page
}) => {
  const start = Date.now()
  await page.clock.install({ time: start })
  let packageExchanges = 0
  let firebaseRequests = 0
  page.on('request', (request) => {
    if (isPackageExchange(request)) packageExchanges++
    else if (request.url().includes('googleapis.com')) firebaseRequests++
  })
  await signIn(page)
  const panel = page.getByTestId('account-layer-poc')
  await expect(panel).toHaveText(/\d+/, { timeout: 30_000 })
  const initial = await snapshot(page)
  const delay = initial.refreshScheduleDelayMs ?? 0
  expect(delay).toBeGreaterThan(0)
  const before = packageExchanges
  await page.clock.runFor(delay - 1)
  expect(packageExchanges).toBe(before)
  await page.clock.runFor(1)
  await expect.poll(() => packageExchanges).toBe(before + 1)
  await writeFile(
    `${evidenceDir}/natural-refresh.log`,
    `clock=playwright\nearly-exchanges=0\nboundary-exchanges=1\nforced=false\nconsumer-requests=0\nfirebase-sdk-requests=${firebaseRequests}\n`
  )
})

test('counts one re-mint and one replay, then refuses a second replay', async ({
  page
}) => {
  let armed = false
  let balanceAttempts = 0
  let packageExchanges = 0
  await page.route('**/api/billing/balance', async (route) => {
    if (!armed) return route.continue()
    balanceAttempts++
    if (balanceAttempts === 1 || balanceAttempts >= 3) {
      return route.fulfill({ status: 401, body: '{}' })
    }
    return route.continue()
  })
  page.on('request', (request) => {
    if (armed && isPackageExchange(request)) packageExchanges++
  })
  await signIn(page)
  await expect(page.getByTestId('account-layer-poc')).toHaveText(/\d+/)
  armed = true
  await refreshCredits(page)
  expect(balanceAttempts).toBe(2)
  expect(packageExchanges).toBe(1)
  await refreshCredits(page)
  expect(balanceAttempts).toBe(4)
  expect(packageExchanges).toBe(2)
  await writeFile(
    `${evidenceDir}/401-replay.log`,
    'route-installed-before-goto=true\nfirst-401-exchanges=1\nfirst-401-replays=1\nsecond-401-replays=0\nowner.exchange=package\nowner.balance=package\n'
  )
})

for (const failure of ['500', 'malformed'] as const) {
  test(`balance ${failure} fails visibly without a stale value`, async ({
    page
  }) => {
    let armed = false
    await page.route('**/api/billing/balance', (route) => {
      if (!armed) return route.continue()
      return route.fulfill({
        status: failure === '500' ? 500 : 200,
        body: failure === '500' ? '{}' : '{"unexpected":true}'
      })
    })
    await signIn(page)
    const panel = page.getByTestId('account-layer-poc')
    await expect(panel).toHaveText(/\d+/)
    armed = true
    await refreshCredits(page)
    await expect(panel.getByRole('alert')).toHaveText('Error')
    await expect(panel).not.toHaveText(/^\d+$/)
    await page.screenshot({ path: `${evidenceDir}/balance-${failure}.png` })
  })
}

for (const failure of ['500', 'abort'] as const) {
  test(`host exchange ${failure} fails closed`, async ({ page }) => {
    await page.route('**/auth/token', async (route) => {
      if (!isPackageExchange(route.request())) return route.continue()
      if (failure === '500') return route.fulfill({ status: 500, body: '{}' })
      return route.abort('timedout')
    })
    await signIn(page)
    const panel = page.getByTestId('account-layer-poc')
    await expect(panel.getByRole('alert')).toBeVisible({ timeout: 30_000 })
    expect(await packageKeys(page)).toHaveLength(0)
    await page.screenshot({ path: `${evidenceDir}/exchange-${failure}.png` })
  })
}

test('sign-out during a boundary exchange cancels the timer and late write', async ({
  page
}) => {
  const start = Date.now()
  await page.clock.install({ time: start })
  let release: (() => void) | undefined
  let armed = false
  let exchanges = 0
  await page.route('**/auth/token', async (route) => {
    if (!armed || !isPackageExchange(route.request())) return route.continue()
    exchanges++
    await new Promise<void>((resolve) => (release = resolve))
    await route.continue()
  })
  await signIn(page)
  await expect(page.getByTestId('account-layer-poc')).toHaveText(/\d+/)
  const initial = await snapshot(page)
  armed = true
  await page.clock.runFor(initial.refreshScheduleDelayMs ?? 0)
  await expect.poll(() => exchanges).toBe(1)
  await page.evaluate(async () => {
    const debug = Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
    await debug.signOut()
  })
  expect(await packageKeys(page)).toHaveLength(0)
  release?.()
  await page.clock.runFor(1_000)
  expect(exchanges).toBe(1)
  expect(await packageKeys(page)).toHaveLength(0)
  await writeFile(
    `${evidenceDir}/signout-race.log`,
    'boundary-exchanges=1\ntimer-cancelled=true\nlate-storage-writes=0\n'
  )
})

test('mounts shared checkout in both hosts and drives safe payment states', async ({
  page
}) => {
  await page.addInitScript(() => {
    window.open = (url) => {
      Reflect.set(window, '__accountLayerOpenedUrl', String(url))
      return window
    }
  })
  await signIn(page)
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()
  const settingsDialog = page.getByTestId('settings-dialog')
  await settingsDialog
    .locator('nav')
    .getByRole('button', { name: 'Plan & Credits' })
    .click()
  const settingsHost = settingsDialog.locator(
    '[data-testid^="account-layer-billing-settings-step-"]'
  )
  await expect(settingsHost).toBeVisible()
  await page.evaluate(() => {
    const debug = Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
    debug.showBillingModal()
  })
  const modalHost = page.locator(
    '[data-testid^="account-layer-billing-modal-step-"]'
  )
  await expect(modalHost).toBeVisible()
  await expect(settingsHost).toHaveAttribute(
    'data-copy-key',
    (await modalHost.getAttribute('data-copy-key')) ?? ''
  )
  await modalHost.getByTestId('account-layer-subscribe').dblclick()
  await expect
    .poll(async () => (await snapshot(page)).sessionExchanges)
    .toBeGreaterThan(0)
  const checkout = await page.evaluate(() => {
    const debug = Reflect.get(window, '__accountLayerPoc') as AccountLayerDebug
    return {
      billingPosts: debug.billingPosts,
      openUrlCalls: debug.openUrlCalls,
      lastCheckoutUrl: debug.lastCheckoutUrl
    }
  })
  expect(checkout.billingPosts).toBe(1)
  expect(checkout.openUrlCalls).toBe(1)
  const states = [
    {
      name: 'verifying',
      response: {
        status: 'pending',
        action_url: 'https://checkout.stripe.test/verify'
      }
    },
    {
      name: 'canceled',
      response: { status: 'canceled', no_charge_confirmed: true }
    },
    {
      name: 'declined',
      response: { status: 'failed', reason_code: 'insufficient_funds' }
    },
    { name: 'processing_error', response: { status: 'timeout' } },
    {
      name: 'payment_received_hold',
      response: { status: 'payment_received_hold' }
    }
  ] as const
  const copyKeys: Record<string, string | null> = {}
  for (const state of states) {
    await page.evaluate(async (response) => {
      const debug = Reflect.get(
        window,
        '__accountLayerPoc'
      ) as AccountLayerDebug
      await debug.injectOperationResponse(response)
    }, state.response)
    await expect(modalHost).toHaveAttribute(
      'data-testid',
      `account-layer-billing-modal-step-${state.name}`
    )
    copyKeys[state.name] = await modalHost.getAttribute('data-copy-key')
  }
  await modalHost.screenshot({
    path: `${paymentsEvidenceDir}/modal-payment-received-hold.png`
  })
  await settingsHost.screenshot({
    path: `${paymentsEvidenceDir}/settings-payment-received-hold.png`
  })
  await writeFile(
    `${paymentsEvidenceDir}/runtime-proof.json`,
    JSON.stringify(
      {
        bothHostsIdentical:
          (await settingsHost.getAttribute('data-copy-key')) ===
          (await modalHost.getAttribute('data-copy-key')),
        billingPosts: checkout.billingPosts,
        openUrlCalls: checkout.openUrlCalls,
        checkoutUrlTestMode:
          checkout.lastCheckoutUrl?.includes('cs_test_') ?? null,
        copyKeys
      },
      null,
      2
    )
  )
})
