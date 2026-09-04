// eslint-disable-next-line no-restricted-imports -- staging has no local ComfyUI settings backend
import { chromium, expect, test } from '@playwright/test'
import type { Frame, Page } from '@playwright/test'
import { appendFileSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'

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

test('completes invoice-stage 3DS in app and settles', async () => {
  test.setTimeout(420_000)
  await mkdir(evidenceDir, { recursive: true })
  for (const file of [
    'requests.log',
    'ops-responses.jsonl',
    'status-responses.jsonl',
    'balance-responses.jsonl',
    'paystate.log'
  ])
    writeFileSync(`${evidenceDir}/${file}`, '')
  const operationId = process.env.ACCOUNT_LAYER_OPERATION_ID
  if (!operationId) throw new Error('ACCOUNT_LAYER_OPERATION_ID is unavailable')
  const profileDir = process.env.HOSTED_PROFILE_DIR
  if (!profileDir) throw new Error('HOSTED_PROFILE_DIR is unavailable')
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: '/usr/bin/google-chrome',
    headless: false,
    args: ['--disable-save-password-bubble'],
    ignoreDefaultArgs: ['--enable-automation']
  })
  const page = context.pages()[0] ?? (await context.newPage())
  context.setDefaultTimeout(120_000)
  let challengeCompletedAt: number | null = null
  context.on('response', async (response) => {
    const url = new URL(response.url())
    const body = await response.text().catch(() => '')
    appendFileSync(
      `${evidenceDir}/requests.log`,
      `${new Date().toISOString()} ${response.request().method()} ${url.origin}${url.pathname} ${response.status()}\n`
    )
    if (url.pathname.includes('/ops/'))
      appendFileSync(
        `${evidenceDir}/ops-responses.jsonl`,
        `${JSON.stringify({ captured_at: new Date().toISOString(), body: JSON.parse(body) })}\n`
      )
    if (url.pathname.endsWith('/status'))
      appendFileSync(
        `${evidenceDir}/status-responses.jsonl`,
        `${JSON.stringify({ captured_at: new Date().toISOString(), body: JSON.parse(body) })}\n`
      )
    if (url.pathname.endsWith('/balance'))
      appendFileSync(
        `${evidenceDir}/balance-responses.jsonl`,
        `${JSON.stringify({ captured_at: new Date().toISOString(), body: JSON.parse(body) })}\n`
      )
    if (url.pathname.includes('/challenge/complete')) {
      challengeCompletedAt = Date.now()
      writeFileSync(
        `${evidenceDir}/challenge-complete-response.txt`,
        `status: ${response.status()}\n${body}\n`
      )
    }
  })
  try {
    await signIn(page)
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
      if ((await next.isVisible()) && (await next.isEnabled()))
        await next.click()
      else
        await page.getByRole('group').last().getByRole('button').first().click()
    }
    await waitForStableUrl(page)
    await requireAuthenticated(page)
    const stored = await page.evaluate(
      () =>
        Object.entries(localStorage).find(([key]) =>
          key.endsWith(':billing:active-operation')
        ) ?? null
    )
    writeFileSync(
      `${evidenceDir}/resume-source.json`,
      `${JSON.stringify({ stored, operation_id: operationId }, null, 2)}\n`
    )
    const challenge = await findChallengeFrame(page)
    await page.screenshot({
      path: `${evidenceDir}/invoice-3ds-frame.png`,
      fullPage: true
    })
    const lastNextAction = await page.evaluate(() => ({
      present: Boolean(
        Reflect.get(Reflect.get(window, '__accountLayerPoc'), 'lastNextAction')
      ),
      captured_at: new Date().toISOString()
    }))
    writeFileSync(
      `${evidenceDir}/lastNextAction.json`,
      `${JSON.stringify(lastNextAction, null, 2)}\n`
    )
    expect(challenge.url()).toContain('testmode-acs.stripe.com')
    await completeChallenge(page)
    expect(challengeCompletedAt).not.toBeNull()
    let terminal: Record<string, unknown> | null = null
    let status: Record<string, unknown> | null = null
    let balance: Record<string, unknown> | null = null
    await expect
      .poll(
        async () => {
          ;[terminal, status, balance] = await page.evaluate(
            async (id) =>
              Promise.all([
                fetch(`/api/billing/ops/${id}`).then((response) =>
                  response.json()
                ),
                fetch('/api/billing/status').then((response) =>
                  response.json()
                ),
                fetch('/api/billing/balance').then((response) =>
                  response.json()
                )
              ]),
            operationId
          )
          return `${terminal?.status}:${status?.tier}:${Number(Reflect.get(balance ?? {}, 'balance_micros') ?? Reflect.get(balance ?? {}, 'credits') ?? 0) > 0}`
        },
        { timeout: 300_000, intervals: [1_000, 3_000, 8_000, 30_000] }
      )
      .toBe('succeeded:PRO:true')
    const finishedAt = Date.now()
    writeFileSync(
      `${evidenceDir}/settlement.json`,
      `${JSON.stringify({ completed_at: new Date(finishedAt).toISOString(), elapsed_from_challenge_complete_ms: finishedAt - (challengeCompletedAt ?? finishedAt), operation: terminal, status, balance, payment: await paymentState(page) }, null, 2)}\n`
    )
    await page.screenshot({
      path: `${evidenceDir}/terminal-widget.png`,
      fullPage: true
    })
  } finally {
    await context.close()
  }
})
