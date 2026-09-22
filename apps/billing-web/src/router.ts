import type { Component } from 'vue'
import type { RouterHistory, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

import type { SessionSnapshot } from '@comfyorg/account-core/session'
import type { BillingIntent } from '@comfyorg/billing-contract'
import {
  BILLING_INTENTS,
  billingIntentPath,
  parseBillingEntry
} from '@comfyorg/billing-contract'

import { recordBillingEntry } from '@/entry/billingEntry'
import { billingWebSessionPhase } from '@/session/billingWebSession'
import BillingHomeView from '@/views/BillingHomeView.vue'
import CheckoutView from '@/views/CheckoutView.vue'
import EntryErrorView from '@/views/EntryErrorView.vue'
import InvoicesView from '@/views/InvoicesView.vue'
import PaymentMethodsView from '@/views/PaymentMethodsView.vue'
import ResultView from '@/views/ResultView.vue'
import SignInView from '@/views/SignInView.vue'
import SubscriptionView from '@/views/SubscriptionView.vue'

/** The app's own front door, outside the entry contract: it names no product. */
const APP_ENTRY_PATH = '/'

const SIGN_IN_PATH = '/sign-in'

const INTENT_VIEWS: Record<BillingIntent, Component> = {
  pricing: SubscriptionView,
  subscription: SubscriptionView,
  checkout: CheckoutView,
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
 * Billing is never public: every route but the sign-in page needs a live
 * workspace session, and `pending` is not one — a restored identity that
 * mints afterwards is carried back by the sign-in page's own redirect.
 *
 * The entry is read before the guard runs, so a link we cannot read explains
 * itself even to a visitor the guard turns away: that failure is the link's,
 * and signing in would not repair it. The sign-in page is the one route that
 * leaves the entry alone, because it is where that visitor was sent. The app's
 * own entry path carries no product request and clears what a previous link
 * left behind.
 */
export function createBillingRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
  readPhase: () => BillingWebSessionPhase = billingWebSessionPhase
) {
  const router = createRouter({ history, routes })

  router.beforeEach((to) => {
    if (to.path === APP_ENTRY_PATH) {
      recordBillingEntry(undefined)
    } else if (to.path !== SIGN_IN_PATH) {
      recordBillingEntry(parseBillingEntry(to.fullPath))
    }
    if (to.path === SIGN_IN_PATH || readPhase() === 'authenticated') return true
    return { path: SIGN_IN_PATH, query: { returnTo: to.fullPath } }
  })

  return router
}
