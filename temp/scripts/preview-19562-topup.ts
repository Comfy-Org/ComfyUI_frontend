import { setTimeout as wait } from 'node:timers/promises'

import { chromium } from '@playwright/test'
import type { Frame, Locator, Page } from '@playwright/test'
import {
  zBillingBalanceResponse,
  zBillingCapabilityDenials,
  zCreateTopupCheckoutResponse,
  zHostedTopupCheckout,
  zHostedTopupCheckoutList
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import type { ComfyApp } from '../../src/scripts/app'

const preview = 'https://pr-19562.testenvs.comfy.org'
const stripeCheckoutOrigins = new Set([
  'https://checkout.stripe.com',
  'https://checkout.comfy.org'
])
const account = 'smoke-test+open-on-cloud-preview@comfy.org'
const amountCents = 500
const idempotencyKey = 'preview-19562-smoke-test-topup-2026-11-18'
const balanceSchema = zBillingBalanceResponse.pick({
  amount_micros: true,
  currency: true
})
const eligibilitySchema = z.object({
  capabilities: z.object({ can_top_up: z.boolean() }),
  denied_reasons: zBillingCapabilityDenials
    .pick({ can_top_up: true })
    .optional()
})
const errorSchema = z.object({ code: z.string().regex(/^[A-Z0-9_]{1,60}$/) })
const stripeConfirmationSchema = z.object({
  status: z.string().optional(),
  payment_status: z.string().optional(),
  payment_intent: z.object({ status: z.string() }).optional()
})

let phase = 'credential and preview checks'

class TopUpError extends Error {}

function stripeFrames(page: Page) {
  return page.frames().filter((frame) => {
    const origin = URL.canParse(frame.url()) ? new URL(frame.url()).origin : ''
    return (
      stripeCheckoutOrigins.has(origin) || origin === 'https://js.stripe.com'
    )
  })
}

async function visibleStripeControl(
  page: Page,
  locate: (frame: Frame) => Locator,
  timeout = 0
) {
  const deadline = Date.now() + timeout
  do {
    for (const frame of stripeFrames(page)) {
      const control = locate(frame).filter({ visible: true }).first()
      if (await control.isVisible()) return control
    }
    if (Date.now() >= deadline) return undefined
    await wait(500)
  } while (Date.now() < deadline)
}

async function captureStripeForm(page: Page, name: string) {
  await page
    .screenshot({
      path: `temp/preview-checkout-evidence/${name}.png`,
      fullPage: true,
      mask: page
        .frames()
        .flatMap((frame) => [
          frame.locator('input'),
          frame.getByText(account, { exact: true })
        ]),
      timeout: 5000
    })
    .catch(() => undefined)
}

const cardNumberSelector =
  'input#cardNumber, input[name="cardnumber"], input[name="number"], input[autocomplete="cc-number"], input[placeholder="1234 1234 1234 1234"]'
const cardChoiceLabel =
  /^(?:Card|Credit or debit card|Credit card|Debit card|Pay by card|Pay with card|Use a card|Pay without Link|Continue as guest)(?:\b|$)/i

async function findCardFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + 35_000
  const openedChoices = new Set<string>()
  while (Date.now() < deadline) {
    for (const frame of stripeFrames(page)) {
      if (await frame.locator(cardNumberSelector).first().isVisible())
        return frame
      const cardChoice = frame
        .getByRole('radio', { name: cardChoiceLabel })
        .or(frame.getByRole('button', { name: cardChoiceLabel }))
        .or(
          frame.getByRole('link', {
            name: /^(?:Pay without Link|Continue as guest)$/i
          })
        )
        .filter({ visible: true })
        .first()
      if (!(await cardChoice.isVisible())) continue
      const label =
        (await cardChoice.textContent({ timeout: 3000 }))?.trim() ?? ''
      if (openedChoices.has(label)) continue
      await cardChoice.click({ timeout: 3000 })
      openedChoices.add(label)
    }
    await wait(500)
  }
  const layout = await page.evaluate(() => ({
    paymentOptions: [
      ...document.querySelectorAll('h1,h2,h3,button,[role="radio"],label,a')
    ]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) =>
        (element.getAttribute('aria-label') ?? element.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
      )
      .filter((text) =>
        /^(?:Card|Credit|Debit|Link|Pay|Checkout|Billing|Sandbox|Test mode|Continue|Use|Other|Choose|Expired|Verify)\b/i.test(
          text
        )
      )
      .map((text) =>
        text
          .replace(/https?:\/\/\S+|\S+@\S+|\d{4,}/g, '[redacted]')
          .slice(0, 80)
      )
      .slice(0, 20),
    cardControls: [...document.querySelectorAll('input')]
      .filter((input) =>
        /card|address|billing/i.test(`${input.id} ${input.name}`)
      )
      .map((input) => `${input.id}:${input.name}`),
    hasCardChoice: [
      ...document.querySelectorAll('button, [role="radio"]')
    ].some((element) => /^Card$/i.test(element.textContent?.trim() ?? '')),
    hasHumanVerification:
      /verify (that )?you are human|checking your browser|security check|captcha/i.test(
        document.body.innerText
      ),
    hasCheckoutError:
      /something went wrong|checkout session has expired|checkout is not available|access denied/i.test(
        document.body.innerText
      )
  }))
  const frameOrigins = page.frames().map((frame) => new URL(frame.url()).origin)
  await captureStripeForm(page, 'stripe-form-before-payment')
  throw new TopUpError(
    `Stripe card form unavailable ${JSON.stringify({ ...layout, frameOrigins })}`
  )
}

async function cloudRequest(
  page: Page,
  route: string,
  payload?: Record<string, string | number>
): Promise<unknown> {
  const result = await page.evaluate(
    async ({ origin, route, payload }) => {
      const app = (window as Window & { app?: ComfyApp }).app
      if (location.origin !== origin || !app) {
        throw new Error('Preview editor unavailable')
      }
      const response = await app.api.fetchApi(route, {
        timeoutMs: 12_000,
        skipStatusRetry: true,
        ...(payload && {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      })
      return {
        status: response.status,
        body: await response.json().catch(() => null)
      }
    },
    { origin: preview, route, payload }
  )
  if (result.status >= 200 && result.status < 300) return result.body
  const error = errorSchema.safeParse(result.body)
  const code = error.success ? ` ${error.data.code}` : ''
  throw new TopUpError(`Cloud ${phase} returned HTTP ${result.status}${code}`)
}

async function verifyCreditGrant(
  cloud: Page,
  sessionId: string,
  before?: number
) {
  phase = 'Cloud credit fulfillment'
  const statusRoute = `/billing/topup/checkouts/${encodeURIComponent(sessionId)}`
  const getStatus = async () =>
    zHostedTopupCheckout.parse(await cloudRequest(cloud, statusRoute))
  const deadline = Date.now() + 120_000
  let status = await getStatus()
  while (
    ['open', 'payment_processing', 'credits_applying'].includes(status.state) &&
    Date.now() < deadline
  ) {
    await wait(4_000)
    status = await getStatus()
  }
  phase = 'updated balance read'
  const after = balanceSchema.parse(
    await cloudRequest(cloud, '/billing/balance')
  )
  console.log(
    `Cloud checkout state ${status.state}. Balance ${after.amount_micros} ${after.currency} micros.`
  )
  if (
    status.state !== 'fulfilled' ||
    status.amount_cents !== BigInt(amountCents)
  ) {
    throw new TopUpError(`Cloud checkout ended in state ${status.state}`)
  }
  if (before !== undefined && after.amount_micros <= before) {
    throw new TopUpError(
      'Cloud reported fulfillment but the credit balance did not increase'
    )
  }
  console.log(
    before === undefined
      ? 'Verified the existing $5 credit top-up without another submission.'
      : `Verified the $5 credit top-up. Previous balance ${before} ${after.currency} micros.`
  )
}

async function main() {
  const { SMOKE_ACCOUNT_EMAIL: email, SMOKE_ACCOUNT_PASSWORD: password } =
    process.env
  if (email !== account || !password) {
    throw new TopUpError('The dedicated preview smoke credentials are required')
  }
  const response = await fetch(`${preview}/api/features`, {
    redirect: 'error',
    signal: AbortSignal.timeout(12_000)
  })
  const config = z.object({
    firebase_config: z.object({ projectId: z.literal('dreamboothy-dev') })
  })
  if (!response.ok || !config.safeParse(await response.json()).success) {
    throw new TopUpError('The target must use the development Firebase project')
  }

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ locale: 'en-US' })
    const cloud = await context.newPage()
    phase = 'preview sign-in'
    await cloud.goto(`${preview}/cloud/login`)
    if (new URL(cloud.url()).origin !== preview) {
      throw new TopUpError('Login left the expected preview')
    }
    await cloud.getByRole('button', { name: 'Use email instead' }).click()
    await cloud.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
    await cloud.getByLabel('Password', { exact: true }).fill(password)
    const loginResponse = cloud.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.origin === 'https://identitytoolkit.googleapis.com' &&
        url.pathname === '/v1/accounts:signInWithPassword' &&
        response.request().method() === 'POST'
      )
    })
    await cloud.getByRole('button', { name: 'Sign in', exact: true }).click()
    if (!(await loginResponse).ok()) {
      throw new TopUpError('Firebase rejected the dedicated preview account')
    }
    await cloud.waitForFunction(
      () => Boolean((window as Window & { app?: ComfyApp }).app?.api),
      undefined,
      { timeout: 45_000 }
    )
    console.log('Signed in to Cloud preview #19562 with the smoke account.')

    phase = 'top-up eligibility check'
    const eligibility = eligibilitySchema.parse(
      await cloudRequest(cloud, '/billing/capabilities')
    )
    if (!eligibility.capabilities.can_top_up) {
      const denial =
        eligibility.denied_reasons?.can_top_up ?? 'no reason returned'
      throw new TopUpError(
        `Cloud did not allow this workspace to add credits (${denial})`
      )
    }

    phase = 'starting balance read'
    const before = balanceSchema.parse(
      await cloudRequest(cloud, '/billing/balance')
    )
    phase = 'existing checkout status read'
    const existing = zHostedTopupCheckoutList
      .parse(await cloudRequest(cloud, '/billing/topup/checkouts'))
      .checkouts.filter(
        ({ amount_cents, session_id }) =>
          amount_cents === BigInt(amountCents) &&
          /^cs_test_[a-zA-Z0-9]+$/.test(session_id)
      )
    if (existing.length !== 1)
      throw new TopUpError(
        'Could not identify a single existing $5 Stripe test checkout'
      )
    const [priorCheckout] = existing
    if (!priorCheckout)
      throw new TopUpError('The existing Stripe test checkout is unavailable')
    const priorStatus = zHostedTopupCheckout.parse(
      await cloudRequest(
        cloud,
        `/billing/topup/checkouts/${encodeURIComponent(priorCheckout.session_id)}`
      )
    )
    if (priorStatus.state !== 'open') {
      await verifyCreditGrant(cloud, priorCheckout.session_id)
      return
    }
    console.log('Verified the existing Stripe test checkout is open.')
    phase = 'top-up checkout creation'
    const checkout = zCreateTopupCheckoutResponse.parse(
      await cloudRequest(cloud, '/billing/topup/checkout', {
        amount_cents: amountCents,
        return_url: 'https://testcloud.comfy.org/?topup=complete',
        idempotency_key: idempotencyKey
      })
    )
    const destination = new URL(checkout.checkout_url)
    const sessionMode = checkout.session_id?.startsWith('cs_test_')
      ? 'test'
      : checkout.session_id?.startsWith('cs_live_')
        ? 'live'
        : checkout.session_id
          ? 'other'
          : 'missing'
    const matchingCheckoutPath = Boolean(
      checkout.session_id &&
      destination.pathname.split('/').includes(checkout.session_id)
    )
    if (
      !stripeCheckoutOrigins.has(destination.origin) ||
      !checkout.session_id ||
      !/^cs_test_[a-zA-Z0-9]+$/.test(checkout.session_id) ||
      checkout.session_id !== priorCheckout.session_id ||
      !matchingCheckoutPath
    ) {
      throw new TopUpError(
        `Cloud checkout did not pass the Stripe test-mode check (${destination.origin}, session mode ${sessionMode}, matching path ${matchingCheckoutPath})`
      )
    }

    const statusRoute = `/billing/topup/checkouts/${encodeURIComponent(checkout.session_id)}`
    const getStatus = async () =>
      zHostedTopupCheckout.parse(await cloudRequest(cloud, statusRoute))
    phase = 'initial checkout status read'
    const initial = await getStatus()
    if (initial.amount_cents !== BigInt(amountCents)) {
      throw new TopUpError('The Stripe test checkout amount was unexpected')
    }
    if (initial.state !== 'open') {
      throw new TopUpError(`The one-time checkout is already ${initial.state}`)
    }
    console.log('Verified a Stripe test-mode checkout for a $5 credit top-up.')

    phase = 'Stripe test form'
    const payment = await context.newPage()
    await payment.bringToFront()
    const stripePage = await payment.goto(destination.href, {
      waitUntil: 'domcontentloaded'
    })
    if (!stripeCheckoutOrigins.has(new URL(payment.url()).origin)) {
      throw new TopUpError('Checkout left the expected Stripe origin')
    }
    if (!stripePage?.ok()) {
      throw new TopUpError(
        `Stripe Checkout page returned HTTP ${stripePage?.status() ?? 'unknown'}`
      )
    }
    const cardFrame = await findCardFrame(payment)
    const cardOrigin = new URL(cardFrame.url()).origin
    if (
      !stripeCheckoutOrigins.has(cardOrigin) &&
      cardOrigin !== 'https://js.stripe.com'
    ) {
      throw new TopUpError(
        'The card form was not hosted by the verified Stripe checkout'
      )
    }
    console.log(`The test card form is visible at ${cardOrigin}.`)
    await cardFrame
      .locator(cardNumberSelector)
      .first()
      .fill('4242424242424242', { timeout: 8_000 })
    await cardFrame
      .locator(
        'input#cardExpiry, input[name="expiry"], input[autocomplete="cc-exp"]'
      )
      .first()
      .fill('1234', { timeout: 8_000 })
    await cardFrame
      .locator('input#cardCvc, input[name="cvc"], input[autocomplete="cc-csc"]')
      .first()
      .fill('123', { timeout: 8_000 })
    const saveInformation = await visibleStripeControl(payment, (frame) =>
      frame.getByRole('checkbox', {
        name: 'Save my information for faster checkout',
        exact: true
      })
    )
    if (saveInformation) {
      await saveInformation.uncheck({ timeout: 8000 })
    } else {
      const linkOptIn = await visibleStripeControl(payment, (frame) =>
        frame.getByText('Save my information for faster checkout', {
          exact: true
        })
      )
      const linkPhone = await visibleStripeControl(payment, (frame) =>
        frame.getByText('Mobile number', { exact: true })
      )
      if (linkOptIn && linkPhone) {
        await linkOptIn.click({ timeout: 8000 })
      }
    }
    const linkPhone = await visibleStripeControl(payment, (frame) =>
      frame.getByText('Mobile number', { exact: true })
    )
    await linkPhone?.waitFor({ state: 'hidden', timeout: 8000 })
    const billingCountry = await visibleStripeControl(payment, (frame) =>
      frame.locator('select#billingCountry')
    )
    await billingCountry?.selectOption('US')
    const manualAddress = await visibleStripeControl(payment, (frame) =>
      frame.getByText('Enter address manually', { exact: true })
    )
    await manualAddress?.click()
    for (const [selector, value] of [
      ['input#billingName', 'Cloud Preview Smoke'],
      ['input#billingAddressLine1', '123 Test Street'],
      ['input#billingLocality', 'Portland'],
      ['input#billingPostalCode', '97201']
    ]) {
      const field = await visibleStripeControl(payment, (frame) =>
        frame.locator(selector)
      )
      await field?.fill(value)
    }
    const state = await visibleStripeControl(payment, (frame) =>
      frame.locator('select#billingAdministrativeArea')
    )
    await state?.selectOption('OR')
    const emailInput = await visibleStripeControl(payment, (frame) =>
      frame.locator('input#email')
    )
    if (emailInput && !(await emailInput.inputValue())) {
      await emailInput.fill(email)
    }
    const displayedSession = new URL(payment.url())
    if (
      !stripeCheckoutOrigins.has(displayedSession.origin) ||
      !displayedSession.pathname.split('/').includes(checkout.session_id)
    ) {
      throw new TopUpError(
        'The verified test checkout session changed before submission'
      )
    }
    phase = 'Stripe test submission'
    const buttonNames = (
      await Promise.all(
        stripeFrames(payment).map((frame) =>
          frame
            .evaluate(() =>
              [
                ...document.querySelectorAll(
                  'button,input[type="submit"],[role="button"]'
                )
              ]
                .filter((button) => button.getClientRects().length > 0)
                .filter(
                  (button) =>
                    button.getAttribute('type') === 'submit' ||
                    /^(Pay|Confirm)/i.test(button.textContent?.trim() ?? '')
                )
                .map((button) => ({
                  type: button.getAttribute('type'),
                  disabled: button.hasAttribute('disabled'),
                  label: (
                    button.getAttribute('aria-label') ??
                    button.textContent ??
                    ''
                  )
                    .trim()
                    .replace(/https?:\/\/\S+|\S+@\S+|\d{4,}/g, '[redacted]')
                    .slice(0, 90)
                }))
            )
            .catch(() => [])
        )
      )
    ).flat()
    console.log(
      `Stripe checkout payment buttons ${JSON.stringify(buttonNames)}`
    )
    const submit = await visibleStripeControl(
      payment,
      (frame) =>
        frame
          .locator('button[type="submit"], input[type="submit"]')
          .filter({
            hasText: /^\s*(?:Pay(?!\s+with\b|Pal)|Confirm payment)/i,
            visible: true
          })
          .or(
            frame
              .getByRole('button', {
                name: /^(?:Pay(?:\s|$)(?!with\b)|Confirm payment)/i
              })
              .filter({ visible: true })
          ),
      10_000
    )
    try {
      if (!submit) throw new Error('Stripe Pay control unavailable')
      await submit.click({ trial: true, timeout: 8_000 })
    } catch {
      await captureStripeForm(payment, 'stripe-submit-before-payment')
      throw new TopUpError('The Stripe Pay button was not actionable')
    }
    payment.on('response', async (confirmation) => {
      const url = new URL(confirmation.url())
      if (
        (url.origin !== 'https://api.stripe.com' &&
          !stripeCheckoutOrigins.has(url.origin)) ||
        !url.pathname.endsWith('/confirm') ||
        confirmation.request().method() !== 'POST' ||
        !confirmation.ok()
      )
        return
      const result = stripeConfirmationSchema.safeParse(
        await confirmation.json().catch(() => null)
      )
      if (
        result.success &&
        (result.data.status === 'complete' ||
          result.data.payment_status === 'paid' ||
          result.data.payment_intent?.status === 'succeeded')
      )
        console.log('Stripe acknowledged the test payment.')
    })
    if ((await getStatus()).state !== 'open') {
      await verifyCreditGrant(cloud, checkout.session_id)
      return
    }
    await submit.click({ timeout: 10_000, noWaitAfter: true })
    console.log('Submitted the Stripe test card ending in 4242 once.')

    await verifyCreditGrant(cloud, checkout.session_id, before.amount_micros)
  } finally {
    await browser.close()
  }
}

try {
  await main()
} catch (error) {
  console.error(
    error instanceof TopUpError
      ? error.message
      : `The test stopped during ${phase}.`
  )
  process.exitCode = 1
}
