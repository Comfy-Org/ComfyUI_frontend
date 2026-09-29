import type { Component } from 'vue'
import type { RouterHistory, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

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

import type { PlanlessCheckoutRoute } from '@/config/checkoutUi'
import { planlessCheckoutRoute } from '@/config/checkoutUi'
import { BILLING_WEB_ENV } from '@/config/env'
import { recordBillingEntry } from '@/entry/billingEntry'
import {
  billingWebPhase,
  billingWebSettledPhase,
  onBillingWebEntryWorkspace
} from '@/session/billingWebAuth'
import BillingHomeView from '@/views/BillingHomeView.vue'
import CheckoutRouteView from '@/views/CheckoutRouteView.vue'
import EntryErrorView from '@/views/EntryErrorView.vue'
import InvoicesView from '@/views/InvoicesView.vue'
import PaymentMethodsView from '@/views/PaymentMethodsView.vue'
import ResultView from '@/views/ResultView.vue'
import SignInView from '@/views/SignInView.vue'
import SubscriptionView from '@/views/SubscriptionView.vue'

/** The app's own front door, outside the entry contract: it names no product. */
const APP_ENTRY_PATH = '/'

export const SIGN_IN_PATH = '/sign-in'

const INTENT_VIEWS: Record<BillingIntent, Component> = {
  pricing: EntryErrorView,
  subscription: SubscriptionView,
  checkout: CheckoutRouteView,
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

function planlessRouteForThisVisitor(): Promise<PlanlessCheckoutRoute> {
  return planlessCheckoutRoute(billingWebSettledPhase)
}

/** What the guard does with a link: let it through, stop because it left the tab, or sign in before deciding. */
type EntryVerdict = 'through' | 'left' | 'sign_in'

function signInFor(fullPath: string) {
  return { path: SIGN_IN_PATH, query: { returnTo: fullPath } }
}

/** Echoes the host's own workspace back, leaving this tab's binding alone. */
function hostReturnHref(entry: BillingEntry): string | undefined {
  return buildReturnUrl({
    target: entry.returnTo,
    environment: BILLING_WEB_ENV,
    workspace: entry.workspaceId
  })?.href
}

const CHECKOUT_PATH = billingIntentPath('checkout')
const CHECKOUT_FALLBACK_RETURN: ReturnTarget = 'comfyui_credits'

/**
 * A checkout's `return_to` is optional. One that is missing, outside the
 * registry, or without a destination in this family is ignored, never
 * followed, and the checkout returns to Plan & Credits instead.
 */
function withCheckoutReturn(fullPath: string): string {
  const url = new URL(fullPath, 'https://billing.invalid')
  if (url.pathname !== CHECKOUT_PATH) return fullPath
  const target = url.searchParams.get('return_to')
  if (target !== null && resolveReturnTarget(target, BILLING_WEB_ENV))
    return fullPath
  url.searchParams.set('return_to', CHECKOUT_FALLBACK_RETURN)
  return `${url.pathname}${url.search}`
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
 * left behind. A pricing link goes back to its host before any session is
 * asked for. So does a checkout link with no plan, unless the customer's own
 * `billing_web_checkout_ui` flag keeps it for the full page, which explains
 * it; the flag belongs to a signed-in customer, so that link first waits for
 * the visitor's identity to settle, and a visitor with none still goes back
 * without being asked to sign in. With nowhere to go back to, either is an
 * entry error. The phase is read on every route, sign-in included, because
 * it is what settles which sign-in this page load runs on.
 */
export function createBillingRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
  readPhase: () =>
    | BillingWebSessionPhase
    | Promise<BillingWebSessionPhase> = billingWebPhase,
  onEntryWorkspace: (workspaceId: string) => void = onBillingWebEntryWorkspace,
  leave: (href: string) => void = leaveForHost,
  planlessRoute: () => Promise<PlanlessCheckoutRoute> = planlessRouteForThisVisitor
) {
  const router = createRouter({ history, routes })

  function sendToHost(entry: BillingEntry): EntryVerdict {
    const href = hostReturnHref(entry)
    if (href === undefined) {
      recordBillingEntry({ status: 'error', code: 'UNKNOWN_RETURN_TARGET' })
      return 'through'
    }
    leave(href)
    return 'left'
  }

  function admitEntry(entry: BillingEntry): EntryVerdict {
    recordBillingEntry({ status: 'ok', entry })
    if (entry.workspaceId !== undefined) onEntryWorkspace(entry.workspaceId)
    return 'through'
  }

  /** Until the flag answers, the link has not bound the tab to its workspace. */
  async function readPlanless(entry: BillingEntry): Promise<EntryVerdict> {
    const route = await planlessRoute()
    if (route === 'sign_in') return 'sign_in'
    return route === 'full_page' ? admitEntry(entry) : sendToHost(entry)
  }

  async function readEntry(fullPath: string): Promise<EntryVerdict> {
    const result = parseBillingEntry(withCheckoutReturn(fullPath))
    if (result.status === 'error') {
      recordBillingEntry(result)
      return 'through'
    }
    const { entry } = result
    if (entry.intent === 'pricing') return sendToHost(entry)
    if (isPlanlessCheckout(entry)) return readPlanless(entry)
    return admitEntry(entry)
  }

  function verdictFor(
    path: string,
    fullPath: string
  ): EntryVerdict | Promise<EntryVerdict> {
    if (path === SIGN_IN_PATH) return 'through'
    if (path !== APP_ENTRY_PATH) return readEntry(fullPath)
    recordBillingEntry(undefined)
    return 'through'
  }

  router.beforeEach(async (to) => {
    const verdict = await verdictFor(to.path, to.fullPath)
    if (verdict === 'left') return false
    if (verdict === 'sign_in') return signInFor(to.fullPath)
    const phase = await readPhase()
    if (to.path === SIGN_IN_PATH || phase === 'authenticated') return true
    return signInFor(to.fullPath)
  })

  return router
}
