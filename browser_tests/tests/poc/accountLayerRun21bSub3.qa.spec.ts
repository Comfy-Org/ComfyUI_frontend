// Run 21b sub 3: live host continuity, lifecycle, and authenticated preview probes.
// eslint-disable-next-line no-restricted-imports -- QA drives the local PoC directly
import { expect, test } from '@playwright/test'
import type { Page, Response } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const baseUrl = process.env.PLAYWRIGHT_TEST_URL ?? 'http://127.0.0.1:5226'
const evidenceDir = process.env.ACCOUNT_LAYER_EVIDENCE_DIR!

test.use({ channel: 'chrome', headless: false })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function signIn(page: Page) {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) throw new Error('E2E credentials are unavailable')
  await page.goto(baseUrl)
  await expect
    .poll(
      () =>
        page.evaluate(() => Boolean(Reflect.get(window, '__accountLayerPoc'))),
      { timeout: 30_000 }
    )
    .toBe(true)
  const current = await page.evaluate(() =>
    (
      Reflect.get(window, '__accountLayerPoc') as {
        getCurrentEmail?(): string | null
      }
    ).getCurrentEmail?.()
  )
  if (current !== email) {
    await page.evaluate(() =>
      (
        Reflect.get(window, '__accountLayerPoc') as { signOut(): Promise<void> }
      ).signOut()
    )
    await page.goto(`${baseUrl}/cloud/login`)
    await page.getByRole('button', { name: /use email/i }).click()
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    const response = page.waitForResponse((candidate) =>
      candidate.url().includes('accounts:signInWithPassword')
    )
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    expect((await response).ok()).toBe(true)
    await expect(page).not.toHaveURL(/\/cloud\/login/, { timeout: 30_000 })
  }
  await expect
    .poll(
      () =>
        page
          .evaluate(async () => {
            const seam = Reflect.get(window, '__accountLayerPoc') as {
              whenAuthenticated(timeout?: number): Promise<void>
              getSessionPhase(): string
            }
            await seam.whenAuthenticated(30_000)
            return seam.getSessionPhase()
          })
          .catch(() => 'navigating'),
      { timeout: 40_000 }
    )
    .toBe('authenticated')
}

async function bearer(page: Page) {
  return expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              Reflect.get(window, '__accountLayerPoc') as {
                lastBillingToken?: string
              }
            ).lastBillingToken ?? null
        ),
      { timeout: 30_000 }
    )
    .not.toBeNull()
    .then(() =>
      page.evaluate(
        () =>
          (
            Reflect.get(window, '__accountLayerPoc') as {
              lastBillingToken: string
            }
          ).lastBillingToken
      )
    )
}

async function probe(page: Page, name: string, path: string) {
  const token = await bearer(page)
  const value = await page.evaluate(
    async ({ path, token }) => {
      const response = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return {
        status: response.status,
        body: await response.json().catch(() => null)
      }
    },
    { path, token }
  )
  writeFileSync(
    `${evidenceDir}/${name}.json`,
    `${JSON.stringify(value, null, 2)}\n`
  )
  return value
}

function recordBilling(page: Page) {
  const rows: unknown[] = []
  page.on('response', async (response: Response) => {
    if (!response.url().includes('/api/billing/')) return
    rows.push({
      at: new Date().toISOString(),
      method: response.request().method(),
      url: response.url(),
      status: response.status(),
      request: response.request().postDataJSON?.() ?? null,
      response: await response.json().catch(() => null)
    })
    writeFileSync(
      `${evidenceDir}/request-responses.json`,
      `${JSON.stringify(rows, null, 2)}\n`
    )
  })
}

test('run 21b sub 3 action', async ({ page }) => {
  test.setTimeout(420_000)
  mkdirSync(evidenceDir, { recursive: true })
  recordBilling(page)
  await signIn(page)
  const action = process.env.SUB3_ACTION
  await probe(page, 'before-status', '/api/billing/status')
  await probe(page, 'before-balance', '/api/billing/balance')
  if (process.env.KNOWN_OP)
    await probe(page, 'before-op', `/api/billing/ops/${process.env.KNOWN_OP}`)

  if (action === 'cancel') {
    await page.evaluate(() =>
      (
        Reflect.get(window, '__accountLayerPoc') as {
          cancelSubscription(): Promise<void>
        }
      ).cancelSubscription()
    )
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                Reflect.get(window, '__accountLayerPoc') as {
                  getPaymentState(): { step: string }
                }
              ).getPaymentState().step
          ),
        { timeout: 180_000, intervals: [3_000, 10_000, 30_000] }
      )
      .toBe('success')
  } else if (action === 'coupon') {
    const token = await bearer(page)
    const result = await page.evaluate(
      async ({ token }) => {
        const response = await fetch('/api/billing/preview-subscribe', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            plan_slug: 'pro-monthly',
            promotion_code: 'RUN21B-INVALID'
          })
        })
        return {
          request: {
            method: 'POST',
            url: '/api/billing/preview-subscribe',
            headers: {
              Authorization: '[REDACTED]',
              'Content-Type': 'application/json'
            },
            body: { plan_slug: 'pro-monthly', promotion_code: 'RUN21B-INVALID' }
          },
          response: {
            status: response.status,
            body: await response.json().catch(() => null)
          }
        }
      },
      { token }
    )
    writeFileSync(
      `${evidenceDir}/coupon-request-response.json`,
      `${JSON.stringify(result, null, 2)}\n`
    )
    writeFileSync(
      `${evidenceDir}/state-sequence.json`,
      `${JSON.stringify([{ at: new Date().toISOString(), state: await page.evaluate(() => (Reflect.get(window, '__accountLayerPoc') as { getPaymentState(): unknown }).getPaymentState()) }], null, 2)}\n`
    )
    await page.screenshot({
      path: `${evidenceDir}/coupon-result.png`,
      fullPage: true
    })
  } else if (action === 'hosts') {
    await page
      .getByRole('button', { name: /^Settings/ })
      .first()
      .click()
    const dialog = page.getByTestId('settings-dialog')
    await dialog
      .locator('nav')
      .getByRole('button', { name: 'Plan & Credits' })
      .click()
    await page.evaluate(() =>
      (
        Reflect.get(window, '__accountLayerPoc') as { showBillingModal(): void }
      ).showBillingModal()
    )
    const states: unknown[] = []
    const capture = async (label: string) => {
      const value = await page.evaluate(() => ({
        payment: (
          Reflect.get(window, '__accountLayerPoc') as {
            getPaymentState(): unknown
          }
        ).getPaymentState(),
        parked:
          Object.entries(localStorage).find(([key]) =>
            key.endsWith(':billing:active-operation')
          ) ?? null
      }))
      states.push({ at: new Date().toISOString(), label, ...value })
      writeFileSync(
        `${evidenceDir}/stream-sequence.json`,
        `${JSON.stringify(states, null, 2)}\n`
      )
      return value
    }
    await capture('both-open-before')
    const promise = page.evaluate(() =>
      (
        Reflect.get(window, '__accountLayerPoc') as {
          topUp(amount: number): Promise<void>
        }
      ).topUp(500)
    )
    await sleep(250)
    await capture('settings-to-modal-switch')
    await page.screenshot({
      path: `${evidenceDir}/hosts-first-switch.png`,
      fullPage: true
    })
    await promise
    await capture('first-terminal')
    await probe(page, 'balance-read-1-0s', '/api/billing/balance')
    await sleep(2_000)
    await probe(page, 'balance-read-1-2s', '/api/billing/balance')
    await sleep(8_000)
    await probe(page, 'balance-read-1-10s', '/api/billing/balance')
    const second = page.evaluate(() =>
      (
        Reflect.get(window, '__accountLayerPoc') as {
          topUp(amount: number): Promise<void>
        }
      ).topUp(500)
    )
    await sleep(250)
    await capture('modal-to-settings-switch')
    await page.screenshot({
      path: `${evidenceDir}/hosts-second-switch.png`,
      fullPage: true
    })
    await second
    await capture('second-terminal')
    await probe(page, 'balance-read-2-0s', '/api/billing/balance')
    await sleep(2_000)
    await probe(page, 'balance-read-2-2s', '/api/billing/balance')
    await sleep(8_000)
    await probe(page, 'balance-read-2-10s', '/api/billing/balance')
    const rendered = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('[data-testid^="account-layer-billing-"]')
      ).map((node) => node.getAttribute('data-testid'))
    )
    writeFileSync(
      `${evidenceDir}/rendered-host-steps.json`,
      `${JSON.stringify(rendered, null, 2)}\n`
    )
  }
  await probe(page, 'after-status', '/api/billing/status')
  await probe(page, 'after-balance', '/api/billing/balance')
  if (process.env.KNOWN_OP)
    await probe(page, 'after-op', `/api/billing/ops/${process.env.KNOWN_OP}`)
})
