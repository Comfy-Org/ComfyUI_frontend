/**
 * The routes and steps a buy-credits checkout needs, shared by the specs that
 * exercise it. Every destination the dialog can reach is fulfilled locally,
 * including the two the popup navigates to, so no request leaves the machine.
 */
import type { BrowserContext, Page, Route } from '@playwright/test'
import { expect } from '@playwright/test'

import type { BillingCapabilitiesResponse } from '@comfyorg/ingest-types'

import { MODELS_ACCOUNT_UID, MODELS_WORKSPACE_ID } from './modelsAccount'

export const STRIPE_CHECKOUT_URL = 'https://checkout.stripe.com/c/pay_e2e'
/** `WORKSHOP_CREDITS_URL` for the `PUBLIC_WORKSHOP_CLOUD_ENV=test` build. */
export const CLOUD_CREDITS_URL =
  'https://testcloud.comfy.org/?settings=plan-credits'

export interface RouteReply {
  readonly status: number
  readonly body: unknown
}

export const FEATURES_FLAG_ON: RouteReply = {
  status: 200,
  body: { billing_sdk_topup_enabled: true }
}

export const FEATURES_FLAG_OFF: RouteReply = {
  status: 200,
  body: { billing_sdk_topup_enabled: false }
}

export const FEATURES_UNAVAILABLE: RouteReply = {
  status: 500,
  body: { code: 'INTERNAL_ERROR', message: 'features are down' }
}

export const CHECKOUT_CREATED: RouteReply = {
  status: 200,
  body: { checkout_url: STRIPE_CHECKOUT_URL, session_id: 'cs_e2e' }
}

export const CHECKOUT_NOT_DEPLOYED: RouteReply = {
  status: 404,
  body: { code: 'NOT_FOUND', message: 'off' }
}

const CAPABILITIES: BillingCapabilitiesResponse = {
  capabilities: {
    can_cancel: false,
    can_change_seats: false,
    can_downgrade_to_personal: false,
    can_invite_members: false,
    can_reactivate: false,
    can_subscribe_self_serve: true,
    can_top_up: true
  },
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  resolved_for: {
    user_id: MODELS_ACCOUNT_UID,
    workspace_id: MODELS_WORKSPACE_ID
  },
  revision: 1,
  rollout_defaults_applied: {
    can_downgrade_to_personal: false,
    can_subscribe_self_serve: false,
    can_top_up: false
  }
}

interface CheckoutRequestBody {
  readonly amount_cents?: unknown
  readonly return_url?: unknown
  readonly idempotency_key?: unknown
}

export interface CheckoutPost {
  readonly method: string
  readonly authorization: string | null
  readonly idempotencyKeyHeader: string | null
  readonly body: CheckoutRequestBody
}

export interface BuyCreditsTraffic {
  readonly featureReads: string[]
  readonly capabilityReads: string[]
  readonly checkoutPosts: CheckoutPost[]
}

function fulfillJson(route: Route, reply: RouteReply) {
  return route.fulfill({
    status: reply.status,
    contentType: 'application/json',
    body: JSON.stringify(reply.body)
  })
}

function fulfillPage(route: Route, heading: string) {
  return route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><title>${heading}</title><h1>${heading}</h1>`
  })
}

export async function stubBuyCredits(
  context: BrowserContext,
  replies: { readonly features: RouteReply; readonly checkout: RouteReply }
): Promise<BuyCreditsTraffic> {
  const traffic: BuyCreditsTraffic = {
    featureReads: [],
    capabilityReads: [],
    checkoutPosts: []
  }

  await context.route('**/api/features', (route) => {
    const request = route.request()
    if (!request.headers()['authorization']) {
      return fulfillJson(route, { status: 200, body: {} })
    }
    traffic.featureReads.push(request.url())
    return fulfillJson(route, replies.features)
  })

  await context.route('**/api/billing/capabilities', (route) => {
    traffic.capabilityReads.push(route.request().url())
    return fulfillJson(route, { status: 200, body: CAPABILITIES })
  })

  await context.route('**/api/billing/topup/checkout', (route) => {
    const request = route.request()
    const headers = request.headers()
    traffic.checkoutPosts.push({
      method: request.method(),
      authorization: headers['authorization'] ?? null,
      idempotencyKeyHeader: headers['idempotency-key'] ?? null,
      body: (request.postDataJSON() ?? {}) as CheckoutRequestBody
    })
    return fulfillJson(route, replies.checkout)
  })

  await context.route(
    (url) => url.hostname === 'checkout.stripe.com',
    (route) => fulfillPage(route, 'Stripe Checkout')
  )
  await context.route(
    (url) =>
      url.hostname === 'testcloud.comfy.org' &&
      !url.pathname.startsWith('/api'),
    (route) => fulfillPage(route, 'Comfy Cloud credits')
  )

  return traffic
}

/**
 * The request evidence a scenario is judged on. The attempt id and the local
 * port are replaced so every expected value can be written as a literal.
 */
export function describeCheckoutPost(origin: string, post: CheckoutPost) {
  const returnUrl = String(post.body.return_url)
  return {
    method: post.method,
    authorization: post.authorization,
    sendsIdempotencyKeyHeader: post.idempotencyKeyHeader !== null,
    headerEchoesBodyKey:
      post.idempotencyKeyHeader === post.body.idempotency_key,
    carriesIdempotencyKey: post.body.idempotency_key !== undefined,
    amountCents: post.body.amount_cents,
    returnUrl: returnUrl
      .replace(origin, '<origin>')
      .replace(/workshopTopUpReturn=[^&]+/, 'workshopTopUpReturn=<attempt>')
  }
}

export async function signIn(
  page: Page,
  account: { email: string; password: string }
): Promise<void> {
  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
}

export async function openBuyCredits(page: Page): Promise<void> {
  await page
    .getByTestId('desktop-nav-cta')
    .getByTestId('header-account')
    .click()
  await page.getByTestId('account-add-credits').click()
  await expect(page.getByTestId('buy-credits-dialog')).toBeVisible()
}

/** Picks the $50 pack and continues, answering with the claimed checkout tab. */
export async function buyFiftyDollars(page: Page): Promise<Page> {
  await page.getByTestId('buy-credits-pack-50').click()
  const popup = page.waitForEvent('popup')
  await page.getByTestId('buy-credits-continue').click()
  return popup
}
