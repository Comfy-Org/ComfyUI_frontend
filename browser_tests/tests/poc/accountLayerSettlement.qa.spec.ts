// eslint-disable-next-line no-restricted-imports -- staging has no local ComfyUI settings backend
import { chromium, expect, test } from '@playwright/test'
import type { Page, Response } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_TEST_URL ?? 'http://127.0.0.1:5193'
const evidenceDir =
  '/home/c_byrne/workspaces/comfy-account-layer/.concept-poc/account-layer-refactor/08-qa/evidence/run-14-frontend'

async function waitForStableUrl(page: Page, stableMs = 1_500) {
  let previous = page.url()
  let stableSince = Date.now()
  await expect
    .poll(() => {
      const current = page.url()
      if (current !== previous) {
        previous = current
        stableSince = Date.now()
      }
      return Date.now() - stableSince
    })
    .toBeGreaterThanOrEqual(stableMs)
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
  await waitForStableUrl(page)
  const announcement = page.locator('.whats-new-popup-container')
  await announcement
    .waitFor({ state: 'visible', timeout: 5_000 })
    .catch(() => {})
  if (await announcement.isVisible()) {
    await announcement.getByRole('button', { name: /close/i }).click()
  }
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
  const postal = page.getByRole('textbox', { name: /ZIP|postal/i })
  if (await postal.isVisible()) {
    await postal.pressSequentially('94107', { delay: 60 })
    await pauseBetweenFields()
  }
  const saveInformation = page.getByRole('checkbox', {
    name: /save my information/i
  })
  if (await saveInformation.isChecked().catch(() => false)) {
    await saveInformation.uncheck()
  }
  await page.locator('button[type=submit], .SubmitButton').first().click()
}

function redactedOperation(body: unknown) {
  if (!body || typeof body !== 'object') return body
  const value = { ...body } as Record<string, unknown>
  for (const key of ['id', 'billing_op_id', 'customer_id', 'subscription_id']) {
    if (key in value) value[key] = '[redacted]'
  }
  return value
}

test('completes hosted subscription and terminal operation polling', async () => {
  test.setTimeout(900_000)
  await mkdir(evidenceDir, { recursive: true })
  const profileDir = await mkdtemp(join(tmpdir(), 'account-layer-run-14-'))
  const requests: string[] = []
  const operations: unknown[] = []
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  })
  const page = context.pages()[0] ?? (await context.newPage())
  await page.addInitScript(() => {
    window.open = () => window
  })
  page.on('response', async (response: Response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith('/api/billing/')) return
    const path = url.pathname.replace(/\/ops\/[^/]+$/, '/ops/[redacted]')
    requests.push(`${response.request().method()} ${path} ${response.status()}`)
    if (url.pathname.includes('/ops/')) {
      const body: unknown = await response.json().catch(() => null)
      operations.push(redactedOperation(body))
    }
  })
  try {
    await signIn(page)
    await requireAuthenticated(page)
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/billing/subscribe'
    )
    await page.evaluate(() => {
      const seam = Reflect.get(window, '__accountLayerPoc') as {
        subscribe(): Promise<void>
      }
      return seam.subscribe()
    })
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    const checkoutUrl = String(body.payment_method_url ?? body.action_url ?? '')
    expect(checkoutUrl).toContain('cs_test_')
    await page.goto(checkoutUrl)
    await fillCheckout(page, '4242424242424242')
    const captcha = page.getByText(/hcaptcha|verify you are human/i).first()
    if (await captcha.isVisible().catch(() => false)) {
      console.log(
        'HUMAN: solve the captcha in the Chrome window on display :1 (waiting up to 600 s)'
      )
    }
    await page
      .waitForURL((url) => url.origin === new URL(baseUrl).origin, {
        timeout: 600_000,
        waitUntil: 'commit'
      })
      .catch(async (error: unknown) => {
        await page.screenshot({ path: `${evidenceDir}/captcha-hard-stop.png` })
        throw error
      })
    await expect
      .poll(() => operations.length, { timeout: 30_000 })
      .toBeGreaterThan(0)
    await writeFile(`${evidenceDir}/requests.log`, `${requests.join('\n')}\n`)
    await writeFile(
      `${evidenceDir}/ops-responses.json`,
      `${JSON.stringify(operations, null, 2)}\n`
    )
    await writeFile(
      `${evidenceDir}/results.json`,
      `${JSON.stringify(
        {
          subscription: operations.some((item) =>
            JSON.stringify(item).includes('succeeded')
          )
            ? 'succeeded'
            : 'not-terminal',
          node: process.version
        },
        null,
        2
      )}\n`
    )
    expect(
      operations.some((item) => JSON.stringify(item).includes('succeeded'))
    ).toBe(true)
    await page.screenshot({ path: `${evidenceDir}/subscription-succeeded.png` })
  } finally {
    await context.close()
    await rm(profileDir, { recursive: true, force: true })
  }
})
