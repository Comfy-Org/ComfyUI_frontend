import { setTimeout as wait } from 'node:timers/promises'

import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  zBillingBalanceResponse,
  zBillingCapabilityDenials,
  zCreateTopupCheckoutResponse,
  zHostedTopupCheckout
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
    await payment.goto(destination.href, { waitUntil: 'domcontentloaded' })
    if (!stripeCheckoutOrigins.has(new URL(payment.url()).origin)) {
      throw new TopUpError('Checkout left the expected Stripe origin')
    }
    const cardNumber = payment.locator('input#cardNumber')
    const cardOption = payment.getByRole('radio', { name: /^card$/i })
    if (!(await cardNumber.isVisible()) && (await cardOption.isVisible())) {
      await cardOption.click()
    }
    await cardNumber.fill('4242424242424242', { timeout: 25_000 })
    await payment.locator('input#cardExpiry').fill('1234')
    await payment.locator('input#cardCvc').fill('123')
    const billingName = payment.locator('input#billingName')
    if (await billingName.isVisible())
      await billingName.fill('Cloud Preview Smoke')
    const billingCountry = payment.locator('select#billingCountry')
    if (await billingCountry.isVisible())
      await billingCountry.selectOption('US')
    const manualAddress = payment.getByText('Enter address manually', {
      exact: true
    })
    if (await manualAddress.isVisible()) await manualAddress.click()
    const addressLine = payment.locator('input#billingAddressLine1')
    if (await addressLine.isVisible()) await addressLine.fill('123 Test Street')
    const city = payment.locator('input#billingLocality')
    if (await city.isVisible()) await city.fill('Portland')
    const state = payment.locator('select#billingAdministrativeArea')
    if (await state.isVisible()) await state.selectOption('OR')
    const postalCode = payment.locator('input#billingPostalCode')
    if (await postalCode.isVisible()) await postalCode.fill('97201')
    const emailInput = payment.locator('input#email')
    if ((await emailInput.isVisible()) && !(await emailInput.inputValue())) {
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
    await payment
      .getByRole('button', { name: /^Pay(?:\s+\$5(?:\.00)?(?:\s+USD)?)?$/i })
      .click()
    console.log('Submitted the Stripe test card ending in 4242 once.')

    phase = 'Cloud credit fulfillment'
    const deadline = Date.now() + 120_000
    let status = await getStatus()
    while (
      ['open', 'payment_processing', 'credits_applying'].includes(
        status.state
      ) &&
      Date.now() < deadline
    ) {
      await wait(4_000)
      status = await getStatus()
    }
    if (
      status.state !== 'fulfilled' ||
      status.payment_amount_cents !== BigInt(amountCents)
    ) {
      throw new TopUpError(`Cloud checkout ended in state ${status.state}`)
    }
    phase = 'updated balance read'
    const after = balanceSchema.parse(
      await cloudRequest(cloud, '/billing/balance')
    )
    console.log(
      `Cloud checkout fulfilled. Balance changed from ${before.amount_micros} to ${after.amount_micros} ${after.currency} micros.`
    )
    if (after.amount_micros <= before.amount_micros) {
      throw new TopUpError(
        'Cloud reported fulfillment but the credit balance did not increase'
      )
    }
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
