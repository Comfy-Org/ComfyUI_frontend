import type { Component } from 'vue'
import type { RouterHistory, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

import type { SessionSnapshot } from '@comfyorg/account-core/session'
import type { BillingEntry, BillingIntent } from '@comfyorg/billing-contract'
import {
  BILLING_INTENTS,
  billingIntentPath,
  buildReturnUrl,
  parseBillingEntry
} from '@comfyorg/billing-contract'

import { BILLING_WEB_ENV } from '@/config/env'
import { recordBillingEntry } from '@/entry/billingEntry'
import { bindEntryWorkspace } from '@/entry/workspaceBinding'
import {
  billingWebSessionClient,
  billingWebSessionPhase
} from '@/session/billingWebSession'
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

/**
 * Rebinds the tab to a newly-arrived entry's workspace and, only when that
 * actually changes the binding, mints for it right away — so a credential
 * for the workspace this tab is leaving is never left to answer a request
 * meant for the new one. A signed-out tab's call is a no-op: `ensureFresh`
 * with no user to mint for resolves immediately.
 */
function defaultOnEntryWorkspace(workspaceId: string): void {
  if (!bindEntryWorkspace(workspaceId)) return
  void billingWebSessionClient().ensureFresh(undefined, { workspaceId })
}

/** Plan selection is the host app's: billing-web only takes a chosen plan to checkout. */
function hostOwnsPlanSelection(entry: BillingEntry): boolean {
  return (
    entry.intent === 'pricing' ||
    (entry.intent === 'checkout' && entry.plan === undefined)
  )
}

/** Echoes the host's own workspace back, leaving this tab's binding alone. */
function hostReturnHref(entry: BillingEntry): string | undefined {
  return buildReturnUrl({
    target: entry.returnTo,
    environment: BILLING_WEB_ENV,
    workspace: entry.workspaceId
  })?.href
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
 * left behind. A link that still needs a plan chosen goes back to its host
 * before any session is asked for; with nowhere to go back to, it is an entry
 * error.
 */
export function createBillingRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
  readPhase: () => BillingWebSessionPhase = billingWebSessionPhase,
  onEntryWorkspace: (workspaceId: string) => void = defaultOnEntryWorkspace,
  leave: (href: string) => void = leaveForHost
) {
  const router = createRouter({ history, routes })

  function recordUnknownReturn(): boolean {
    recordBillingEntry({ status: 'error', code: 'UNKNOWN_RETURN_TARGET' })
    return true
  }

  /** False once the link has left this tab for its host. */
  function sendToHost(entry: BillingEntry): boolean {
    const href = hostReturnHref(entry)
    if (href === undefined) return recordUnknownReturn()
    leave(href)
    return false
  }

  function admitEntry(entry: BillingEntry): boolean {
    recordBillingEntry({ status: 'ok', entry })
    if (entry.workspaceId !== undefined) onEntryWorkspace(entry.workspaceId)
    return true
  }

  function readEntry(fullPath: string): boolean {
    const result = parseBillingEntry(fullPath)
    if (result.status === 'error') {
      recordBillingEntry(result)
      return true
    }
    const { entry } = result
    if (hostOwnsPlanSelection(entry)) return sendToHost(entry)
    // Every way out of checkout leads back to the host, so a checkout with
    // no resolvable return is an entry error rather than a dead-ended form.
    if (entry.intent === 'checkout' && hostReturnHref(entry) === undefined) {
      return recordUnknownReturn()
    }
    return admitEntry(entry)
  }

  router.beforeEach((to) => {
    if (to.path === APP_ENTRY_PATH) recordBillingEntry(undefined)
    else if (to.path !== SIGN_IN_PATH && !readEntry(to.fullPath)) return false
    if (to.path === SIGN_IN_PATH || readPhase() === 'authenticated') return true
    return { path: SIGN_IN_PATH, query: { returnTo: to.fullPath } }
  })

  return router
}
