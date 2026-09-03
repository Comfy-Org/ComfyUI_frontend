// eslint-disable-next-line no-restricted-imports -- staging has no local ComfyUI settings backend
import { chromium, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_TEST_URL ?? 'http://127.0.0.1:5193'
const evidenceDir =
  process.env.ACCOUNT_LAYER_EVIDENCE_DIR ??
  '/home/c_byrne/workspaces/comfy-account-layer/.concept-poc/account-layer-refactor/08-qa/evidence/run-20f-frontend'
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
  await expect
    .poll(
      () =>
        page.evaluate(() => Boolean(Reflect.get(window, '__accountLayerPoc'))),
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
  const signedInEmail = await page.evaluate(() => {
    const authKey = Object.keys(localStorage).find((key) =>
      key.startsWith('firebase:authUser:')
    )
    if (!authKey) return null
    const value: unknown = JSON.parse(localStorage.getItem(authKey) ?? 'null')
    return value && typeof value === 'object' && 'email' in value
      ? Reflect.get(value, 'email')
      : null
  })
  expect(signedInEmail).toBe(process.env.E2E_EMAIL)
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
  const city = page.locator(
    'input[name="billingLocality"], input[autocomplete="address-level2"]'
  )
  if (await city.isVisible()) {
    await city.fill('San Francisco')
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
  test.setTimeout(process.env.DIAGNOSE_ONLY === 'true' ? 180_000 : 900_000)
  await mkdir(evidenceDir, { recursive: true })
  for (const file of ['requests.log', 'ops-responses.jsonl', 'paystate.log']) {
    writeFileSync(`${evidenceDir}/${file}`, '')
  }
  const profileDir = await mkdtemp(join(tmpdir(), 'account-layer-run-20f-'))
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
  context.setDefaultTimeout(120_000)
  context.setDefaultNavigationTimeout(120_000)
  const consoleMessages: string[] = []
  page.on('console', (message) => consoleMessages.push(message.text()))
  context.on('response', async (response) => {
    const url = new URL(response.url())
    const path = url.pathname.replace(/\/ops\/[^/]+$/, '/ops/[redacted]')
    const isBilling = url.pathname.includes('/api/billing/')
    const body =
      isBilling || !response.ok() ? await response.text().catch(() => '') : ''
    appendFileSync(
      `${evidenceDir}/requests.log`,
      `${response.request().method()} ${url.origin}${path}${url.search} ${response.status()}${body ? ` ${body}` : ''}\n`
    )
    if (isBilling && url.pathname.endsWith('/status')) {
      writeFileSync(`${evidenceDir}/preflight-status.json`, `${body}\n`)
    }
    if (isBilling && url.pathname.endsWith('/balance')) {
      writeFileSync(`${evidenceDir}/preflight-balance.json`, `${body}\n`)
    }
    if (isBilling && !response.ok()) {
      writeFileSync(`${evidenceDir}/error-billing.json`, `${body}\n`)
    }
    if (url.pathname.includes('/ops/')) {
      try {
        const text = await response.text()
        const body: unknown = JSON.parse(text)
        appendFileSync(
          `${evidenceDir}/ops-responses.jsonl`,
          `${JSON.stringify(body)}\n`
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
    writeFileSync(
      `${evidenceDir}/readiness-debug.json`,
      `${JSON.stringify(
        await page.evaluate(() => {
          const seam = Reflect.get(window, '__accountLayerPoc') as {
            exchangeError: string | null
            workspace: unknown
            sessionExchanges: number
            getSessionPhase(): string
          }
          return {
            sessionPhase: seam.getSessionPhase(),
            sessionExchanges: seam.sessionExchanges,
            exchangeError: seam.exchangeError,
            workspace: seam.workspace
          }
        }),
        null,
        2
      )}\n`
    )
    await page.screenshot({
      path: `${evidenceDir}/frontend-after-sign-in.png`,
      fullPage: true
    })
    if (process.env.DIAGNOSE_ONLY === 'true') return
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
    const shouldCancelExisting =
      process.env.E2E_EMAIL !== process.env.FIXTURE_B_EMAIL
    appendFileSync(
      `${evidenceDir}/preflight.log`,
      `cancel-existing=${shouldCancelExisting ? 'started' : 'skipped-free-fixture'}\n`
    )
    const canceled = shouldCancelExisting
      ? await page
          .evaluate(() => {
            const seam = Reflect.get(window, '__accountLayerPoc') as {
              cancelSubscription(): Promise<void>
            }
            return seam.cancelSubscription()
          })
          .then(() => recordPaymentStateUntilTerminal(page))
          .catch(() => null)
      : null
    appendFileSync(
      `${evidenceDir}/preflight.log`,
      canceled
        ? `cancel-existing=${canceled.step} no-charge-confirmed=${canceled.noChargeConfirmed}\n`
        : shouldCancelExisting
          ? 'cancel-existing=not-active\n'
          : 'cancel-existing=free-fixture\n'
    )
    if (canceled) {
      await page.screenshot({ path: `${evidenceDir}/cancel-terminal.png` })
    }
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/billing/subscribe'
    )
    const checkoutPagePromise = context
      .waitForEvent('page', { timeout: 20_000 })
      .catch(() => null)
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
    const openedCheckoutPage = await checkoutPagePromise
    const checkoutPage = openedCheckoutPage ?? (await context.newPage())
    if (!openedCheckoutPage) {
      appendFileSync(
        `${evidenceDir}/harness.log`,
        'window.open did not create a page within 20s; navigated a second tab to the captured checkout URL\n'
      )
      await checkoutPage.goto(checkoutUrl, { timeout: 120_000 })
    }
    await fillCheckout(
      checkoutPage,
      process.env.STRIPE_TEST_CARD ?? '4242424242424242'
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
  } catch (error) {
    const diagnostic = await page
      .evaluate(() => {
        const seam = Reflect.get(window, '__accountLayerPoc') as
          | {
              getSessionPhase?(): string
              getPaymentState?(): unknown
              workspace?: unknown
              exchangeError?: string | null
            }
          | undefined
        return {
          url: window.location.href,
          sessionPhase: seam?.getSessionPhase?.() ?? null,
          paymentState: seam?.getPaymentState?.() ?? null,
          workspace: seam?.workspace ?? null,
          exchangeError: seam?.exchangeError ?? null
        }
      })
      .catch(() => ({ url: page.url(), evaluationFailed: true }))
    writeFileSync(
      `${evidenceDir}/failure-diagnostic.json`,
      `${JSON.stringify(
        {
          error: String(error),
          diagnostic,
          consoleMessages,
          lastRequests: readFileSync(`${evidenceDir}/requests.log`, 'utf8')
            .split('\n')
            .slice(-51)
        },
        null,
        2
      )}\n`
    )
    await page
      .screenshot({ path: `${evidenceDir}/failure.png`, fullPage: true })
      .catch(() => {})
    throw error
  } finally {
    writeFileSync(
      `${evidenceDir}/console.log`,
      `${consoleMessages.join('\n')}\n`
    )
    await context.close()
    await rm(profileDir, { recursive: true, force: true })
  }
})
