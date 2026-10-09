import type { Component } from 'vue'
import type { RouterHistory, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

import type {
  WebEntryBounceReason,
  WebEntryBounceTarget
} from '@comfyorg/account-core/billing'
import type { SessionSnapshot } from '@comfyorg/account-core/session'
import type {
  BillingEntry,
  BillingIntent,
  ReturnTarget
} from '@comfyorg/billing-contract'
import {
  BILLING_INTENTS,
  billingIntentPath,
  buildReturnUrl,
  parseBillingEntry,
  resolveReturnTarget
} from '@comfyorg/billing-contract'

import { pricingTableUrl } from '@/checkout/cloudLinks'
import { awaitCheckoutUiVariant } from '@/config/checkoutUi'
import { BILLING_WEB_ENV } from '@/config/env'
import { recordBillingEntry } from '@/entry/billingEntry'
import {
  billingWebLivePhase,
  billingWebPhase,
  onBillingWebEntryWorkspace
} from '@/session/billingWebAuth'
import {
  reportEntryBounced,
  reportEntryReceived,
  reportEntryRejected
} from '@/telemetry/webEntryTelemetry'
import BillingHomeView from '@/views/BillingHomeView.vue'
import CheckoutRouteView from '@/views/CheckoutRouteView.vue'
import EntryErrorView from '@/views/EntryErrorView.vue'
import InvoicesView from '@/views/InvoicesView.vue'
import PaymentMethodsView from '@/views/PaymentMethodsView.vue'
import ResultView from '@/views/ResultView.vue'
import SignInView from '@/views/SignInView.vue'
import SubscriptionView from '@/views/SubscriptionView.vue'
import TopupRouteView from '@/views/TopupRouteView.vue'

/** The app's own front door, outside the entry contract: it names no product. */
const APP_ENTRY_PATH = '/'

export const SIGN_IN_PATH = '/sign-in'

const INTENT_VIEWS: Record<BillingIntent, Component> = {
  pricing: EntryErrorView,
  subscription: SubscriptionView,
  checkout: CheckoutRouteView,
  'top-up': TopupRouteView,
  'payment-methods': PaymentMethodsView,
  invoices: InvoicesView,
  result: ResultView
}

const routes: RouteRecordRaw[] = [
  {
    path: APP_ENTRY_PATH,
    name: 'billing',
    component: BillingHomeView
  },
  {
    path: SIGN_IN_PATH,
    name: 'sign-in',
    component: SignInView
  },
  ...BILLING_INTENTS.map((intent) => ({
    path: billingIntentPath(intent),
    name: intent,
    component: INTENT_VIEWS[intent]
  })),
  {
    // A URL the contract does not describe is an entry error, not a redirect:
    // bouncing a customer to another surface would hide the misdirected link.
    // `App` renders the error surface for any failed parse, whatever route
    // matched; this record keeps the table total so the router stays quiet.
    path: '/:pathMatch(.*)*',
    name: 'entry-error',
    component: EntryErrorView
  }
]

export type BillingWebSessionPhase = SessionSnapshot['phase']

const isPlanlessCheckout = (entry: BillingEntry) =>
  entry.intent === 'checkout' && entry.plan === undefined

/**
 * Only a tab already signed in when the link is routed can keep a planless
 * checkout, and only on its customer's full-page flag. Anyone else is sent
 * back synchronously, without waiting on sign-in or asking for the flag.
 */
function fullPageKeepsPlanless(): false | Promise<boolean> {
  if (billingWebLivePhase.value !== 'authenticated') return false
  return awaitCheckoutUiVariant().then((variant) => variant === 'full_page')
}

/** A link read from the URL, and whether its checkout `return_to` was replaced to read it. */
interface Arrival {
  readonly entry: BillingEntry
  readonly returnRewritten: boolean
}

interface HostDestination {
  readonly href: string | undefined
  readonly to: WebEntryBounceTarget
}

/** Echoes the host's own workspace back, leaving this tab's binding alone. */
function returnHref(
  target: ReturnTarget,
  entry: BillingEntry
): string | undefined {
  return buildReturnUrl({
    target,
    environment: BILLING_WEB_ENV,
    workspace: entry.workspaceId
  })?.href
}

const CHECKOUT_PATH = billingIntentPath('checkout')
const CHECKOUT_FALLBACK_RETURN: ReturnTarget = 'comfyui_credits'

const linkUrl = (fullPath: string) =>
  new URL(fullPath, 'https://billing.invalid')

function followsLinkReturn(url: URL): boolean {
  const target = url.searchParams.get('return_to')
  return (
    target !== null &&
    resolveReturnTarget(target, BILLING_WEB_ENV) !== undefined
  )
}

/**
 * A checkout's `return_to` is optional. One that is missing, outside the
 * registry, or without a destination in this family is ignored, never
 * followed, and the checkout returns to Plan & Credits instead.
 */
function withCheckoutReturn(fullPath: string): string {
  const url = linkUrl(fullPath)
  if (url.pathname !== CHECKOUT_PATH || followsLinkReturn(url)) return fullPath
  url.searchParams.set('return_to', CHECKOUT_FALLBACK_RETURN)
  return `${url.pathname}${url.search}`
}

/**
 * Where a checkout that names no plan goes to have one picked. Platform has
 * no pricing table, so its link goes back to its own `return_to`, or to
 * Platform's billing page when that is not one billing may follow.
 */
function planPicker(
  entry: BillingEntry,
  followsReturn: boolean
): HostDestination {
  if (entry.product !== 'platform')
    return {
      href: pricingTableUrl(
        entry.teamCreditStopId === undefined ? 'default' : 'team',
        entry.workspaceId
      ),
      to: 'pricing_table'
    }
  const to = followsReturn ? entry.returnTo : 'platform_billing'
  return { href: returnHref(to, entry), to }
}

function leaveForHost(href: string): void {
  window.location.replace(href)
}

/**
 * Billing is never public: every route but the sign-in page needs a live
 * workspace session, and `pending` is not one — a restored identity that
 * mints afterwards is carried back by the sign-in page's own redirect.
 *
 * The entry is read before the guard runs, so a link we cannot read explains
 * itself even to a visitor the guard turns away: that failure is the link's,
 * and signing in would not repair it. The sign-in page is the one route that
 * leaves the entry alone, because it is where that visitor was sent. The app's
 * own entry path carries no product request and clears what a previous link
 * left behind. A link that still needs a plan chosen goes where one is picked
 * before any session is asked for, unless the full-page flag of a tab that is
 * already signed in keeps a planless checkout to explain it; with nowhere to
 * go back to, it is an entry error. The phase is read on every route, sign-in
 * included, because it is what settles which sign-in this page load runs on.
 */
export function createBillingRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
  readPhase: () =>
    | BillingWebSessionPhase
    | Promise<BillingWebSessionPhase> = billingWebPhase,
  onEntryWorkspace: (workspaceId: string) => void = onBillingWebEntryWorkspace,
  leave: (href: string) => void = leaveForHost
) {
  const router = createRouter({ history, routes })
  let latestNavigation = 0

  function recordUnknownReturn(): boolean {
    reportEntryRejected('UNKNOWN_RETURN_TARGET')
    recordBillingEntry({ status: 'error', code: 'UNKNOWN_RETURN_TARGET' })
    return true
  }

  /** False once the link has left this tab for its host. */
  function sendToHost(
    { href, to }: HostDestination,
    reason: WebEntryBounceReason
  ): boolean {
    if (href === undefined) return recordUnknownReturn()
    reportEntryBounced({ reason, to })
    leave(href)
    return false
  }

  function admitEntry({ entry, returnRewritten }: Arrival): boolean {
    recordBillingEntry({ status: 'ok', entry })
    reportEntryReceived(entry)
    if (returnRewritten)
      reportEntryBounced({
        reason: 'return_target_rewritten',
        to: entry.returnTo
      })
    if (entry.workspaceId !== undefined) onEntryWorkspace(entry.workspaceId)
    return true
  }

  /**
   * The tab stays unbound to the link's workspace until the flag answers, and
   * an answer that arrives after a newer navigation started acts on nothing.
   */
  function readPlanless(
    arrival: Arrival,
    pickPlanAt: HostDestination
  ): boolean | Promise<boolean> {
    const kept = fullPageKeepsPlanless()
    if (kept === false) return sendToHost(pickPlanAt, 'planless_checkout')
    const navigation = latestNavigation
    return kept.then((full) => {
      if (navigation !== latestNavigation) return false
      return full
        ? admitEntry(arrival)
        : sendToHost(pickPlanAt, 'planless_checkout')
    })
  }

  function readEntry(fullPath: string): boolean | Promise<boolean> {
    const readable = withCheckoutReturn(fullPath)
    const result = parseBillingEntry(readable)
    if (result.status === 'error') {
      reportEntryRejected(result.code)
      recordBillingEntry(result)
      return true
    }
    const { entry } = result
    if (entry.intent === 'pricing')
      return sendToHost(
        { href: returnHref(entry.returnTo, entry), to: entry.returnTo },
        'pricing_link'
      )
    const arrival = { entry, returnRewritten: readable !== fullPath }
    if (isPlanlessCheckout(entry))
      return readPlanless(
        arrival,
        planPicker(entry, followsLinkReturn(linkUrl(fullPath)))
      )
    return admitEntry(arrival)
  }

  router.beforeEach(async (to) => {
    latestNavigation += 1
    if (to.path === APP_ENTRY_PATH) recordBillingEntry(undefined)
    else if (to.path !== SIGN_IN_PATH && !(await readEntry(to.fullPath)))
      return false
    const phase = await readPhase()
    if (to.path === SIGN_IN_PATH || phase === 'authenticated') return true
    return { path: SIGN_IN_PATH, query: { returnTo: to.fullPath } }
  })

  return router
}
