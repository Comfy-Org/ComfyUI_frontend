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
  '/home/c_byrne/workspaces/comfy-account-layer/.concept-poc/account-layer-refactor/08-qa/evidence/run-20g-frontend'
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

test('resumes declined checkout and completes it with a new card', async () => {
  test.setTimeout(process.env.DIAGNOSE_ONLY === 'true' ? 180_000 : 900_000)
  await mkdir(evidenceDir, { recursive: true })
  for (const file of ['requests.log', 'ops-responses.jsonl', 'paystate.log']) {
    writeFileSync(`${evidenceDir}/${file}`, '')
  }
  const profileDir = await mkdtemp(join(tmpdir(), 'account-layer-run-20g-'))
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
    if (process.env.LIFECYCLE_ONLY === 'true') {
      const operationId = process.env.RECOVER_OPERATION_ID
      if (operationId) {
        appendFileSync(
          `${evidenceDir}/paystate.log`,
          `${new Date().toISOString()} verifying ${operationId}\n`
        )
        await page.evaluate(async (id) => {
          const seam = Reflect.get(window, '__accountLayerPoc') as {
            recoverSubscription(planId: string, intent: string): Promise<void>
            workspace: { activeWorkspaceId: string | null }
          }
          const authKey = Object.keys(localStorage).find((candidate) =>
            candidate.startsWith('firebase:authUser:')
          )
          const authValue: unknown = JSON.parse(
            localStorage.getItem(authKey ?? '') ?? 'null'
          )
          const uid =
            authValue && typeof authValue === 'object' && 'uid' in authValue
              ? Reflect.get(authValue, 'uid')
              : null
          if (typeof uid !== 'string' || !seam.workspace.activeWorkspaceId) {
            throw new Error('Billing operation storage identity is unavailable')
          }
          const key = `comfyui-frontend-account-layer-poc:${uid}:${seam.workspace.activeWorkspaceId}:billing:active-operation`
          localStorage.setItem(key, id)
          await seam.recoverSubscription('pro-monthly', 'resume')
        }, operationId)
        await expect
          .poll(async () => (await paymentState(page))?.step, {
            timeout: 180_000,
            intervals: [3_000, 10_000, 30_000]
          })
          .toBe('success')
        appendFileSync(
          `${evidenceDir}/paystate.log`,
          `${new Date().toISOString()} success ${operationId}\n`
        )
      }
      const action = process.env.LIFECYCLE_ACTION
      const startedAt = Date.now()
      await page.evaluate(async (requestedAction) => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          cancelSubscription(): Promise<void>
          resubscribe(): Promise<void>
          topUp(amount: number): Promise<void>
          openPaymentPortal(): Promise<void>
          refreshCredits(): Promise<void>
          signOut(): Promise<void>
        }
        if (requestedAction === 'cancel') await seam.cancelSubscription()
        if (requestedAction === 'resubscribe') await seam.resubscribe()
        if (requestedAction === 'topup') await seam.topUp(500)
        if (requestedAction === 'portal') await seam.openPaymentPortal()
        await seam.refreshCredits()
        if (requestedAction === 'signout') await seam.signOut()
      }, action)
      if (['cancel', 'resubscribe', 'topup'].includes(action ?? '')) {
        await expect
          .poll(async () => (await paymentState(page))?.step, {
            timeout: 180_000,
            intervals: [3_000, 10_000, 30_000]
          })
          .toBe('success')
      }
      writeFileSync(
        `${evidenceDir}/lifecycle-result.json`,
        `${JSON.stringify(
          {
            action,
            started_at: new Date(startedAt).toISOString(),
            finished_at: new Date().toISOString(),
            elapsed_ms: Date.now() - startedAt,
            payment: await paymentState(page),
            pages: context.pages().map((candidate) => candidate.url())
          },
          null,
          2
        )}\n`
      )
      return
    }
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
    const resumed = await paymentState(page)
    expect(resumed).not.toMatchObject({ step: 'processing_error' })
    writeFileSync(
      `${evidenceDir}/RUN20G-1-state.json`,
      `${JSON.stringify(resumed, null, 2)}\n`
    )
    await page.screenshot({
      path: `${evidenceDir}/RUN20G-1-resumed.png`,
      fullPage: true
    })
    const checkoutUrl = String(
      (resumed as { actionUrl?: string } | null)?.actionUrl ??
        'https://checkout.comfy.org/c/pay/cs_test_c16rnduq05sq3NBBNXb5OzMdUwHOtMB1ci1luoNhgr60Pv4hLYMUSwfyKO'
    )
    expect(checkoutUrl).toMatch(
      /^https:\/\/(checkout\.stripe|checkout\.comfy)\.org\//
    )
    const checkoutPage = await context.newPage()
    await checkoutPage.goto(checkoutUrl, { timeout: 120_000 })
    await checkoutPage.screenshot({
      path: `${evidenceDir}/RUN20G-3-coupon-control.png`,
      fullPage: true
    })
    const promotionControl = checkoutPage.getByText(/add promotion code/i)
    writeFileSync(
      `${evidenceDir}/RUN20G-3-coupon.json`,
      `${JSON.stringify({ present: await promotionControl.isVisible().catch(() => false) })}\n`
    )
    await fillCheckout(checkoutPage, '4000000000000002')
    await expect(
      checkoutPage.getByText(/your card was declined.*try a different card/i)
    ).toBeVisible({ timeout: 60_000 })
    await checkoutPage.screenshot({
      path: `${evidenceDir}/RUN20G-2-inline-decline.png`,
      fullPage: true
    })
    await expect
      .poll(async () => (await paymentState(page))?.step, {
        timeout: 90_000,
        intervals: [30_000]
      })
      .not.toBe('processing_error')
    writeFileSync(
      `${evidenceDir}/RUN20G-2-state-after-90s.json`,
      `${JSON.stringify(await paymentState(page), null, 2)}\n`
    )
    const cardNumber = checkoutPage.getByRole('textbox', {
      name: 'Card number'
    })
    await cardNumber.fill('4242424242424242')
    await checkoutPage.locator('.SubmitButton').click()
    await checkoutPage.waitForURL(
      (url) => url.origin === new URL(baseUrl).origin,
      { timeout: 600_000, waitUntil: 'commit' }
    )
    await page.reload()
    await requireAuthenticated(page)
    const terminal = await paymentState(page)
    await page.screenshot({
      path: `${evidenceDir}/RUN20G-4-success.png`,
      fullPage: true
    })
    writeFileSync(
      `${evidenceDir}/RUN20G-4-terminal.json`,
      `${JSON.stringify(terminal, null, 2)}\n`
    )
    expect(
      readFileSync(`${evidenceDir}/ops-responses.jsonl`, 'utf8').length
    ).toBeGreaterThan(0)
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
