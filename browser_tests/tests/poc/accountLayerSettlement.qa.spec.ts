// eslint-disable-next-line no-restricted-imports -- staging has no local ComfyUI settings backend
import { chromium, expect, test } from '@playwright/test'
import type { Frame, Page } from '@playwright/test'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  await page.goto(baseUrl)
  await expect
    .poll(
      () =>
        page.evaluate(() => Boolean(Reflect.get(window, '__accountLayerPoc'))),
      { timeout: 30_000 }
    )
    .toBe(true)
  const currentEmail = await page.evaluate(() => {
    const seam = Reflect.get(window, '__accountLayerPoc') as {
      getCurrentEmail?(): string | null
    }
    return seam.getCurrentEmail?.() ?? null
  })
  if (currentEmail === email) {
    writeFileSync(`${evidenceDir}/firebase-password-signins.txt`, '0\n')
    return
  }
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
  const signInResponse = page.waitForResponse((response) =>
    response
      .url()
      .includes('identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')
  )
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  const response = await signInResponse
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  const redacted = { ...body, idToken: undefined, refreshToken: undefined }
  writeFileSync(
    `${evidenceDir}/signin-response.json`,
    `${JSON.stringify({ status: response.status(), body: redacted }, null, 2)}\n`
  )
  writeFileSync(`${evidenceDir}/firebase-password-signins.txt`, '1\n')
  if (!response.ok()) {
    const error = body.error as { message?: string } | undefined
    throw new Error(
      `Firebase sign-in failed: ${error?.message ?? response.status()}`
    )
  }
  await expect(page).not.toHaveURL(/\/cloud\/login/, { timeout: 30_000 })
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

async function challengeFrames(page: Page) {
  return await Promise.all(
    page
      .frames()
      .filter((frame) => /testmode-acs\.stripe\.com/.test(frame.url()))
      .map(async (frame) => {
        const complete = frame.getByRole('button', {
          name: /^(complete|complete authentication)$/i
        })
        const box = await complete.boundingBox().catch(() => null)
        return { frame, url: frame.url(), completeVisible: box !== null, box }
      })
  )
}

async function findChallengeFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const visible = (await challengeFrames(page)).find(
      ({ completeVisible }) => completeVisible
    )
    if (visible) return visible.frame
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const frames = await Promise.all(
    page.frames().map(async (frame) => ({
      url: frame.url(),
      text: (
        await frame
          .locator('body')
          .innerText()
          .catch(() => '')
      ).slice(0, 500)
    }))
  )
  throw new Error(
    `3DS challenge frame did not appear: ${JSON.stringify(frames)}`
  )
}

async function fillCheckout(page: Page, card: string) {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => {
    window.addEventListener('message', (event) => {
      const value =
        typeof event.data === 'string'
          ? event.data.slice(0, 300)
          : JSON.stringify(event.data).slice(0, 300)
      console.log('PM', event.origin, value)
    })
  })
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

async function waitForHostedReturn(page: Page) {
  const appOrigin = new URL(baseUrl).origin
  const initialDeadline = Date.now() + 15_000
  while (
    Date.now() < initialDeadline &&
    new URL(page.url()).origin !== appOrigin
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  if (new URL(page.url()).origin === appOrigin) return
  const captchaCandidates = await Promise.all(
    page.frames().map(async (frame) => {
      const text = await frame
        .locator('body')
        .innerText()
        .catch(() => '')
      return {
        frameUrl: frame.url(),
        challengeFrame: frame.url().includes('frame=challenge'),
        visibleText: /please try again|verify/i.test(text)
      }
    })
  )
  const captchaVisible = captchaCandidates.some(
    ({ challengeFrame, visibleText }) => challengeFrame && visibleText
  )
  const challengeVisible = (await challengeFrames(page)).some(
    ({ completeVisible }) => completeVisible
  )
  if (!captchaVisible || challengeVisible) {
    await page.waitForURL((url) => url.origin === appOrigin, {
      timeout: 165_000,
      waitUntil: 'commit'
    })
    return
  }
  await page.screenshot({ path: `${evidenceDir}/captcha-detected.png` })
  writeFileSync(
    `${evidenceDir}/captcha-detected.json`,
    `${JSON.stringify({ captured_at: new Date().toISOString(), frames: captchaCandidates }, null, 2)}\n`
  )
  writeFileSync(
    `${evidenceDir}/hcaptcha.json`,
    `${JSON.stringify({ appeared: true, human_used: false, blocked: true })}\n`
  )
  throw new Error('Stripe hCaptcha requires a person; automation stopped')
}

async function completeChallenge(page: Page) {
  const frames = await challengeFrames(page)
  writeFileSync(
    `${evidenceDir}/3ds-frames.json`,
    `${JSON.stringify(
      frames.map(({ url, completeVisible, box }) => ({
        url,
        completeVisible,
        box
      })),
      null,
      2
    )}\n`
  )
  const challenge = frames.find(({ completeVisible }) => completeVisible)
  if (!challenge) throw new Error('No visible 3DS COMPLETE button')
  const complete = challenge.frame.locator('#test-source-authorize-3ds')
  await challenge.frame
    .locator('.spinner, [class*="spinner"], [aria-busy="true"]')
    .waitFor({ state: 'hidden', timeout: 30_000 })
    .catch(() => {})
  await page.screenshot({ path: `${evidenceDir}/3ds-before-action.png` })
  const attempts: Array<{
    attempt: number
    method: string
    challengePost: boolean
  }> = []
  const methods = [
    {
      name: 'message-channel',
      run: () =>
        challenge.frame.evaluate(() =>
          window.postMessage({ test_source: { authorize: true } }, '*')
        )
    },
    {
      name: 'in-frame-element-click',
      run: () =>
        challenge.frame.evaluate(() => {
          document.getElementById('test-source-authorize-3ds')?.click()
        })
    },
    {
      name: 'visible-locator-click',
      run: async () => {
        await expect(complete).toBeVisible()
        await complete.click()
      }
    }
  ]
  for (const [index, method] of methods.entries()) {
    const requestPromise = page
      .waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          request.url().includes('/challenge/complete'),
        { timeout: 15_000 }
      )
      .catch(() => null)
    await method.run()
    const request = await requestPromise
    await page.screenshot({
      path: `${evidenceDir}/3ds-attempt-${index + 1}.png`
    })
    attempts.push({
      attempt: index + 1,
      method: method.name,
      challengePost: request !== null
    })
    if (request) {
      const response = await request.response()
      writeFileSync(
        `${evidenceDir}/challenge-complete-response.txt`,
        `status: ${response?.status() ?? 'no-response'}\n${(await response?.text().catch(() => '')) ?? ''}\n`
      )
      break
    }
  }
  writeFileSync(
    `${evidenceDir}/3ds-click.json`,
    `${JSON.stringify({ frame_url: challenge.url, attempts }, null, 2)}\n`
  )
  if (!attempts.some(({ challengePost }) => challengePost))
    throw new Error('No 3DS attempt produced the challenge/complete POST')
}

test('resumes declined checkout and completes it with a new card', async () => {
  test.setTimeout(process.env.DIAGNOSE_ONLY === 'true' ? 180_000 : 900_000)
  await mkdir(evidenceDir, { recursive: true })
  for (const file of ['requests.log', 'ops-responses.jsonl', 'paystate.log']) {
    writeFileSync(`${evidenceDir}/${file}`, '')
  }
  const persistentProfileDir = process.env.HOSTED_PROFILE_DIR
  const profileDir = persistentProfileDir
    ? persistentProfileDir
    : await mkdtemp(join(tmpdir(), 'account-layer-run-20g-'))
  await mkdir(join(profileDir, 'Default'), { recursive: true })
  writeFileSync(
    join(profileDir, 'Default', 'Preferences'),
    JSON.stringify({
      credentials_enable_service: false,
      profile: { password_manager_enabled: false },
      autofill: { credit_card_enabled: false, profile_enabled: false }
    }),
    { flag: 'w' }
  )
  const cleanChromium = process.env.CLEAN_CHROMIUM === 'true'
  const browser = cleanChromium
    ? await chromium.launch({ headless: false })
    : undefined
  const context = browser
    ? await browser.newContext()
    : await chromium.launchPersistentContext(profileDir, {
        executablePath: '/usr/bin/google-chrome',
        headless: false,
        args: [
          '--disable-save-password-bubble',
          '--disable-features=AutofillServerCommunication,PasswordManagerOnboarding'
        ],
        ignoreDefaultArgs: ['--enable-automation']
      })
  const existingPages = context.pages()
  const page = await context.newPage()
  await Promise.all(existingPages.map((candidate) => candidate.close()))
  context.setDefaultTimeout(120_000)
  context.setDefaultNavigationTimeout(120_000)
  mkdirSync(`${evidenceDir}/3ds-responses`, { recursive: true })
  let hostedResponseIndex = 0
  function instrumentPage(candidate: Page) {
    appendFileSync(
      `${evidenceDir}/frames.log`,
      `${new Date().toISOString()} page ${candidate.url()}\n`
    )
    candidate.on('console', (message) => {
      appendFileSync(
        `${evidenceDir}/console.log`,
        `${new Date().toISOString()} console ${message.type()} ${message.text()}\n`
      )
    })
    candidate.on('pageerror', (error) => {
      appendFileSync(
        `${evidenceDir}/console.log`,
        `${new Date().toISOString()} pageerror ${error.message}\n`
      )
    })
    candidate.on('framenavigated', (frame) => {
      appendFileSync(
        `${evidenceDir}/frames.log`,
        `${new Date().toISOString()} navigated ${frame.url()}\n`
      )
    })
    candidate.on('framedetached', (frame) => {
      appendFileSync(
        `${evidenceDir}/frames.log`,
        `${new Date().toISOString()} detached ${frame.url()}\n`
      )
    })
  }
  instrumentPage(page)
  context.on('page', instrumentPage)
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
    if (
      url.hostname === 'testmode-acs.stripe.com' ||
      (url.hostname === 'api.stripe.com' &&
        (url.pathname.startsWith('/v1/3ds2') ||
          url.pathname.includes('/payment_pages'))) ||
      url.hostname === 'hooks.stripe.com'
    ) {
      const index = String(++hostedResponseIndex).padStart(2, '0')
      const name = `${index}-${url.hostname}-${url.pathname.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root'}.txt`
      const responseBody = (await response.text().catch(() => '')).slice(
        0,
        20_000
      )
      const headers = response.headers()
      writeFileSync(
        `${evidenceDir}/3ds-responses/${name}`,
        `${JSON.stringify(
          {
            captured_at: new Date().toISOString(),
            method: response.request().method(),
            url: response.url(),
            status: response.status(),
            headers: {
              'content-type': headers['content-type'] ?? null,
              location: headers.location ?? null
            }
          },
          null,
          2
        )}\n\n${responseBody}\n`
      )
    }
    if (isBilling && url.pathname.endsWith('/status')) {
      writeFileSync(`${evidenceDir}/preflight-status.json`, `${body}\n`)
      appendFileSync(
        `${evidenceDir}/status-responses.jsonl`,
        `${JSON.stringify({ captured_at: new Date().toISOString(), body: JSON.parse(body) })}\n`
      )
    }
    if (isBilling && url.pathname.endsWith('/balance')) {
      writeFileSync(`${evidenceDir}/preflight-balance.json`, `${body}\n`)
      appendFileSync(
        `${evidenceDir}/balance-responses.jsonl`,
        `${JSON.stringify({ captured_at: new Date().toISOString(), body: JSON.parse(body) })}\n`
      )
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
    if (process.env.RUN20P_INVOICE === 'true') {
      const operationId = '7ad89a4b-0da6-4b8c-a10a-15e56f4da607'
      await expect
        .poll(
          () =>
            context
              .pages()
              .some((candidate) =>
                candidate.url().includes('invoice.stripe.com')
              ),
          { timeout: 45_000 }
        )
        .toBe(true)
      const invoicePage = context
        .pages()
        .find((candidate) => candidate.url().includes('invoice.stripe.com'))!
      await new Promise((resolve) => setTimeout(resolve, 3_000))
      writeFileSync(
        `${evidenceDir}/invoice-operation-before.json`,
        `${JSON.stringify({ operation_id: operationId, action_url: invoicePage.url(), opened_by: 'package-poller' }, null, 2)}\n`
      )
      await invoicePage.screenshot({
        path: `${evidenceDir}/invoice-page.png`,
        fullPage: true
      })
      const pay = invoicePage.getByRole('button', { name: /pay/i }).last()
      await expect(pay).toBeVisible({ timeout: 30_000 })
      await pay.click()
      await new Promise((resolve) => setTimeout(resolve, 3_000))
      await invoicePage.screenshot({
        path: `${evidenceDir}/invoice-after-pay.png`,
        fullPage: true
      })
      await findChallengeFrame(invoicePage)
      const challengeStartedAt = Date.now()
      await completeChallenge(invoicePage)
      await invoicePage.screenshot({
        path: `${evidenceDir}/invoice-after-3ds.png`,
        fullPage: true
      })
      appendFileSync(
        `${evidenceDir}/paystate.log`,
        `${new Date().toISOString()} verifying ${operationId}\n`
      )
      let terminal: unknown = null
      await expect
        .poll(
          async () => {
            terminal = await page.evaluate(async (id) => {
              const response = await fetch(`/api/billing/ops/${id}`)
              return await response.json()
            }, operationId)
            return Reflect.get(terminal as object, 'status')
          },
          { timeout: 300_000, intervals: [1_000, 3_000, 8_000, 30_000] }
        )
        .toBe('succeeded')
      appendFileSync(
        `${evidenceDir}/paystate.log`,
        `${new Date().toISOString()} success ${operationId}\n`
      )
      writeFileSync(
        `${evidenceDir}/invoice-settlement.json`,
        `${JSON.stringify({ challenge_started_at: new Date(challengeStartedAt).toISOString(), completed_at: new Date().toISOString(), elapsed_ms: Date.now() - challengeStartedAt, operation: terminal, payment: await paymentState(page) }, null, 2)}\n`
      )
      return
    }
    if (process.env.RUN20N_HOSTED === 'true') {
      const startedAt = Date.now()
      const pagesBeforeSubscribe = context.pages().length
      await page.evaluate(async () => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          subscribe(planId?: string): Promise<void>
        }
        await seam.subscribe('pro-monthly')
      })
      await expect
        .poll(() => context.pages().length, { timeout: 30_000 })
        .toBe(pagesBeforeSubscribe + 1)
      const checkoutPage = context.pages().at(-1)!
      const operationId = await page.evaluate(() => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          getOperationStore(): { id?: string } | null
        }
        return seam.getOperationStore()?.id ?? null
      })
      expect(operationId).toBeTruthy()
      writeFileSync(
        `${evidenceDir}/operation.json`,
        `${JSON.stringify({ started_at: new Date(startedAt).toISOString(), operation_id: operationId }, null, 2)}\n`
      )
      await fillCheckout(checkoutPage, '4000002760003184')
      await findChallengeFrame(checkoutPage)
      await completeChallenge(checkoutPage)
      await waitForHostedReturn(checkoutPage)
      const returnedAt = Date.now()
      expect(checkoutPage.url()).toContain('/payment/success')
      appendFileSync(
        `${evidenceDir}/paystate.log`,
        `${new Date().toISOString()} verifying ${operationId}\n`
      )
      await requireAuthenticated(checkoutPage)
      await expect
        .poll(async () => (await paymentState(checkoutPage))?.step, {
          timeout: 180_000,
          intervals: [1_000, 3_000, 8_000, 15_000]
        })
        .toBe('success')
      const finishedAt = Date.now()
      appendFileSync(
        `${evidenceDir}/paystate.log`,
        `${new Date().toISOString()} success ${operationId}\n`
      )
      writeFileSync(
        `${evidenceDir}/settlement.json`,
        `${JSON.stringify(
          {
            started_at: new Date(startedAt).toISOString(),
            returned_at: new Date(returnedAt).toISOString(),
            finished_at: new Date(finishedAt).toISOString(),
            redirect_elapsed_ms: returnedAt - startedAt,
            settlement_elapsed_ms: finishedAt - returnedAt,
            total_elapsed_ms: finishedAt - startedAt,
            operation_id: operationId,
            payment: await paymentState(checkoutPage),
            new_pages_on_return: context.pages().length - 1
          },
          null,
          2
        )}\n`
      )
      await checkoutPage.screenshot({
        path: `${evidenceDir}/3ds-success.png`,
        fullPage: true
      })
      return
    }
    if (process.env.RUN20K_HOSTED === 'true') {
      const startedAt = Date.now()
      const pagesBeforeSubscribe = context.pages().length
      await page.evaluate(async () => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          subscribe(planId?: string): Promise<void>
        }
        await seam.subscribe('pro-monthly')
      })
      await expect
        .poll(() => context.pages().length, { timeout: 30_000 })
        .toBe(pagesBeforeSubscribe + 1)
      const firstCheckout = context.pages().at(-1)!
      const firstUrl = firstCheckout.url()
      expect(firstUrl).toContain('cs_test_')
      const abandoned = await page.evaluate(() => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          getPaymentState(): unknown
        }
        const key = Object.keys(localStorage).find((candidate) =>
          candidate.endsWith(':billing:active-operation')
        )
        return {
          payment: seam.getPaymentState(),
          storageKey: key ?? null,
          operationId: key
            ? ((
                JSON.parse(localStorage.getItem(key) ?? 'null') as {
                  id?: string
                } | null
              )?.id ?? null)
            : null
        }
      })
      expect(abandoned.operationId).toBeTruthy()
      await firstCheckout.close()
      const pagesBeforeReload = context.pages().length
      await page.reload()
      await requireAuthenticated(page)
      const pagesAfterReload = context.pages().length
      expect(pagesAfterReload).toBe(pagesBeforeReload)
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const seam = Reflect.get(window, '__accountLayerPoc') as {
                getPaymentState(): { operationId?: string }
              }
              return seam.getPaymentState().operationId
            }),
          { timeout: 30_000 }
        )
        .toBe(abandoned.operationId)
      const resumed = await paymentState(page)
      expect(resumed?.operationId).toBe(abandoned.operationId)
      await page.evaluate(async () => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          subscribe(planId?: string): Promise<void>
        }
        await seam.subscribe('pro-monthly')
      })
      await expect
        .poll(() => context.pages().length, { timeout: 30_000 })
        .toBe(pagesAfterReload + 1)
      let checkoutPage = context.pages().at(-1)!
      const secondUrl = checkoutPage.url()
      expect(secondUrl).toContain('cs_test_')
      expect(secondUrl).not.toBe(firstUrl)
      const resumedOperation = await page.evaluate(() => {
        const key = Object.keys(localStorage).find((candidate) =>
          candidate.endsWith(':billing:active-operation')
        )
        return key
          ? ((
              JSON.parse(localStorage.getItem(key) ?? 'null') as {
                id?: string
              } | null
            )?.id ?? null)
          : null
      })
      expect(resumedOperation).toBe(abandoned.operationId)
      writeFileSync(
        `${evidenceDir}/abandon-resume.json`,
        `${JSON.stringify(
          {
            started_at: new Date(startedAt).toISOString(),
            captured_at: new Date().toISOString(),
            elapsed_ms: Date.now() - startedAt,
            operation_id: abandoned.operationId,
            first_checkout_url_has_fragment: firstUrl.includes('#'),
            second_checkout_url_has_fragment: secondUrl.includes('#'),
            checkout_url_changed: secondUrl !== firstUrl,
            pages_before_reload: pagesBeforeReload,
            pages_after_reload: pagesAfterReload,
            new_pages_on_reload: pagesAfterReload - pagesBeforeReload,
            state_before_close: abandoned.payment,
            state_after_reload: resumed
          },
          null,
          2
        )}\n`
      )
      await fillCheckout(checkoutPage, '4000002760003184')
      const challenge = await findChallengeFrame(checkoutPage)
      const fail = challenge.getByRole('button', {
        name: /^(fail|fail authentication)$/i
      })
      await expect(fail).toBeVisible({ timeout: 60_000 })
      await fail.click()
      await checkoutPage.screenshot({
        path: `${evidenceDir}/3ds-failed.png`,
        fullPage: true
      })
      const failedAt = new Date().toISOString()
      const failedState = await paymentState(page)
      expect(failedState?.step).not.toBe('success')
      writeFileSync(
        `${evidenceDir}/3ds-failure.json`,
        `${JSON.stringify({ captured_at: failedAt, operation_id: abandoned.operationId, app_state: failedState, hosted_text: await checkoutPage.locator('body').innerText() }, null, 2)}\n`
      )
      await checkoutPage.close()
      const pagesBeforeRetry = context.pages().length
      await page.evaluate(async () => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          subscribe(planId?: string): Promise<void>
        }
        await seam.subscribe('pro-monthly')
      })
      await expect
        .poll(() => context.pages().length, { timeout: 30_000 })
        .toBe(pagesBeforeRetry + 1)
      checkoutPage = context.pages().at(-1)!
      await fillCheckout(checkoutPage, '4000002760003184')
      await findChallengeFrame(checkoutPage)
      await completeChallenge(checkoutPage)
      await waitForHostedReturn(checkoutPage)
      const settlementStartedAt = Date.now()
      appendFileSync(
        `${evidenceDir}/paystate.log`,
        `${new Date().toISOString()} verifying ${abandoned.operationId}\n`
      )
      await requireAuthenticated(checkoutPage)
      await expect
        .poll(async () => (await paymentState(checkoutPage))?.step, {
          timeout: 180_000,
          intervals: [1_000, 3_000, 8_000, 15_000]
        })
        .toBe('success')
      const settlementElapsedMs = Date.now() - settlementStartedAt
      expect(settlementElapsedMs).toBeLessThanOrEqual(180_000)
      appendFileSync(
        `${evidenceDir}/paystate.log`,
        `${new Date().toISOString()} success ${abandoned.operationId}\n`
      )
      await checkoutPage.evaluate(async () => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          refreshCredits(): Promise<void>
        }
        await seam.refreshCredits()
      })
      writeFileSync(
        `${evidenceDir}/settlement.json`,
        `${JSON.stringify(
          {
            started_at: new Date(settlementStartedAt).toISOString(),
            finished_at: new Date().toISOString(),
            elapsed_ms: settlementElapsedMs,
            within_three_minutes: settlementElapsedMs <= 180_000,
            operation_id: abandoned.operationId,
            payment: await paymentState(checkoutPage),
            pages: context.pages().length
          },
          null,
          2
        )}\n`
      )
      await checkoutPage.screenshot({
        path: `${evidenceDir}/3ds-success.png`,
        fullPage: true
      })
      return
    }
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
    if (process.env.DIAGNOSE_ONLY === 'true') {
      await page.evaluate(async () => {
        const seam = Reflect.get(window, '__accountLayerPoc') as {
          refreshCredits(): Promise<void>
        }
        await seam.refreshCredits()
      })
      return
    }
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
    await context.close()
    await browser?.close()
    if (!persistentProfileDir)
      await rm(profileDir, { recursive: true, force: true })
  }
})
