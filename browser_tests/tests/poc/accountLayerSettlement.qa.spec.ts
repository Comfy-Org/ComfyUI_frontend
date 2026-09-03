// eslint-disable-next-line no-restricted-imports -- staging has no local ComfyUI settings backend
import { chromium, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_TEST_URL ?? 'http://127.0.0.1:5193'
const evidenceDir =
  '/home/c_byrne/workspaces/comfy-account-layer/.concept-poc/account-layer-refactor/08-qa/evidence/run-16-frontend'
const terminalSteps = [
  'success',
  'canceled',
  'declined',
  'processing_error',
  'payment_received_hold'
] as const

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
  await page.goto(`${baseUrl}/cloud/login`)
  await page.getByRole('button', { name: /use email/i }).click()
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await expect(page).not.toHaveURL(/\/cloud\/login/)
  await waitForStableUrl(page)
}

async function requireAuthenticated(page: Page) {
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

async function pauseBetweenFields() {
  await new Promise((resolve) => setTimeout(resolve, 500))
}

async function fillCheckout(page: Page, card: string) {
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByText(/test mode|sandbox/i).first()).toBeVisible({
    timeout: 30_000
  })
  const email = page.locator('input[type=email]')
  if (await email.isVisible()) {
    await email.pressSequentially(process.env.E2E_EMAIL ?? '', { delay: 60 })
    await pauseBetweenFields()
  }
  await page
    .getByRole('textbox', { name: 'Card number' })
    .pressSequentially(card, { delay: 60 })
  await pauseBetweenFields()
  await page
    .getByRole('textbox', { name: 'Expiration' })
    .pressSequentially('1234', { delay: 60 })
  await pauseBetweenFields()
  await page
    .getByRole('textbox', { name: /Credit or debit card CVC\/CVV/ })
    .pressSequentially('123', { delay: 60 })
  await pauseBetweenFields()
  await page
    .getByRole('textbox', { name: 'Cardholder name' })
    .pressSequentially('Account Layer PoC', { delay: 60 })
  await pauseBetweenFields()
  const postal = page.locator(
    'input[name="billingPostalCode"], input[autocomplete="postal-code"]'
  )
  const address = page.locator(
    'input[name="billingAddressLine1"], input[autocomplete="address-line1"]'
  )
  if (await address.isVisible()) {
    await address.fill('123 Test St')
    await pauseBetweenFields()
  }
  if (await postal.isVisible()) {
    await postal.pressSequentially('94107', { delay: 60 })
    await pauseBetweenFields()
  }
  const saveInformation = page.getByRole('checkbox', {
    name: /save my (information|info)/i
  })
  if (await saveInformation.isChecked().catch(() => false)) {
    await page.getByText(/save my (information|info)/i).click()
  }
  await expect(saveInformation).not.toBeChecked()
  await expect(page.locator('input[type="tel"]')).toBeHidden()
  const submit = page.locator('.SubmitButton')
  await submit.click()
  const declineLink = page.getByRole('button', {
    name: /no thanks|not now|skip/i
  })
  if (await declineLink.isVisible().catch(() => false))
    await declineLink.click()
}

function redactedOperation(body: unknown) {
  if (!body || typeof body !== 'object') return body
  const value = { ...body } as Record<string, unknown>
  for (const key of [
    'id',
    'billing_op_id',
    'customer_id',
    'subscription_id',
    'email'
  ]) {
    if (key in value) value[key] = '[redacted]'
  }
  return value
}

async function paymentState(page: Page) {
  return page.evaluate(() => {
    const seam = Reflect.get(window, '__accountLayerPoc') as
      | {
          getPaymentState(): {
            step: string
            operationId?: string
            reasonKey?: string
            noChargeConfirmed: boolean
          }
        }
      | undefined
    return seam?.getPaymentState() ?? null
  })
}

async function recordPaymentStateUntilTerminal(page: Page) {
  let previous = ''
  await expect
    .poll(
      async () => {
        const state = await paymentState(page)
        if (!state) return false
        const serialized = JSON.stringify(state)
        if (serialized !== previous) {
          appendFileSync(
            `${evidenceDir}/paystate.log`,
            `${new Date().toISOString()} ${serialized}\n`
          )
          previous = serialized
        }
        return terminalSteps.includes(
          state.step as (typeof terminalSteps)[number]
        )
      },
      { timeout: 320_000, intervals: [1_000] }
    )
    .toBe(true)
  const state = await paymentState(page)
  if (!state) throw new Error('Payment state seam disappeared after settlement')
  return state
}

test('completes hosted subscription and captures terminal operation', async () => {
  test.setTimeout(900_000)
  await mkdir(evidenceDir, { recursive: true })
  for (const file of [
    'preflight.log',
    'requests.log',
    'ops-responses.jsonl',
    'paystate.log'
  ]) {
    writeFileSync(`${evidenceDir}/${file}`, '')
  }
  const profileDir = await mkdtemp(join(tmpdir(), 'account-layer-run-16-'))
  await mkdir(join(profileDir, 'Default'))
  writeFileSync(
    join(profileDir, 'Default', 'Preferences'),
    JSON.stringify({
      credentials_enable_service: false,
      profile: { password_manager_enabled: false },
      autofill: { credit_card_enabled: false, profile_enabled: false }
    }),
    { flag: 'w' }
  )
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: '/usr/bin/google-chrome',
    headless: false,
    args: [
      '--disable-save-password-bubble',
      '--disable-features=AutofillServerCommunication,PasswordManagerOnboarding'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  })
  const page = context.pages()[0] ?? (await context.newPage())
  context.on('response', async (response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith('/api/billing/')) return
    const path = url.pathname.replace(/\/ops\/[^/]+$/, '/ops/[redacted]')
    appendFileSync(
      `${evidenceDir}/requests.log`,
      `${response.request().method()} ${path} ${response.status()}\n`
    )
    if (url.pathname.includes('/ops/')) {
      try {
        const text = await response.text()
        const body: unknown = JSON.parse(text)
        appendFileSync(
          `${evidenceDir}/ops-responses.jsonl`,
          `${JSON.stringify(redactedOperation(body))}\n`
        )
      } catch (error) {
        appendFileSync(
          `${evidenceDir}/ops-responses.jsonl`,
          `${JSON.stringify({ capture_error: String(error) })}\n`
        )
      }
    }
  })
  try {
    await signIn(page)
    await requireAuthenticated(page)
    const activeOperation = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((candidate) =>
        candidate.endsWith(':billing:active-operation')
      )
      return key ? { key, value: localStorage.getItem(key) } : null
    })
    appendFileSync(
      `${evidenceDir}/preflight.log`,
      `step-zero=${activeOperation ? 'active-operation-found' : 'clean'}\n`
    )
    if (activeOperation) await recordPaymentStateUntilTerminal(page)
    const creditsBefore = await page.evaluate(() => {
      const seam = Reflect.get(window, '__accountLayerPoc') as {
        getCredits(): unknown
      }
      return seam.getCredits()
    })
    appendFileSync(`${evidenceDir}/preflight.log`, 'cancel-existing=started\n')
    const canceled = await page
      .evaluate(() => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          cancelSubscription(): Promise<void>
        }
        return seam.cancelSubscription()
      })
      .then(() => recordPaymentStateUntilTerminal(page))
      .catch(() => null)
    appendFileSync(
      `${evidenceDir}/preflight.log`,
      canceled
        ? `cancel-existing=${canceled.step} no-charge-confirmed=${canceled.noChargeConfirmed}\n`
        : 'cancel-existing=not-active\n'
    )
    if (canceled) {
      await page.screenshot({ path: `${evidenceDir}/cancel-terminal.png` })
    }
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/billing/subscribe'
    )
    const checkoutPagePromise = context.waitForEvent('page')
    await page.evaluate(() => {
      const seam = Reflect.get(window, '__accountLayerPoc') as {
        subscribe(planId: string): Promise<void>
      }
      void seam.subscribe('pro-monthly')
    })
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    const checkoutUrl = String(body.payment_method_url ?? body.action_url ?? '')
    expect(checkoutUrl).toContain('cs_test_')
    const checkoutPage = await checkoutPagePromise
    await fillCheckout(checkoutPage, '4242424242424242')
    const captcha = checkoutPage
      .getByText(/hcaptcha|verify you are human/i)
      .first()
    console.log(
      `HUMAN: complete any visible Stripe verification in Chrome on display :1; captcha visible=${await captcha.isVisible().catch(() => false)}; waiting up to 600 s for settlement`
    )
    await checkoutPage
      .waitForURL((url) => url.origin === new URL(baseUrl).origin, {
        timeout: 600_000,
        waitUntil: 'commit'
      })
      .catch(async (error: unknown) => {
        if (!checkoutPage.isClosed())
          await checkoutPage.screenshot({
            path: `${evidenceDir}/captcha-hard-stop.png`
          })
        throw error
      })
    const terminal = await recordPaymentStateUntilTerminal(page)
    expect(terminalSteps).toContain(terminal.step)
    await page.evaluate(async () => {
      const seam = Reflect.get(window, '__accountLayerPoc') as {
        refreshCredits(): Promise<void>
      }
      await seam.refreshCredits()
    })
    const creditsAfter = await page.evaluate(() => {
      const seam = Reflect.get(window, '__accountLayerPoc') as {
        getCredits(): unknown
      }
      return seam.getCredits()
    })
    writeFileSync(
      `${evidenceDir}/credits-before-after.json`,
      `${JSON.stringify({ before: creditsBefore, after: creditsAfter }, null, 2)}\n`
    )
    expect(
      readFileSync(`${evidenceDir}/ops-responses.jsonl`, 'utf8').length
    ).toBeGreaterThan(0)
    await page.screenshot({ path: `${evidenceDir}/subscription-success.png` })
  } finally {
    await context.close()
    await rm(profileDir, { recursive: true, force: true })
  }
})
