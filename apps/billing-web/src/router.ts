import type { RouterHistory, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

import type { SessionSnapshot } from '@comfyorg/account/session'

import { billingWebSessionPhase } from '@/session/billingWebSession'
import BillingHomeView from '@/views/BillingHomeView.vue'
import SignInView from '@/views/SignInView.vue'

const SIGN_IN_PATH = '/sign-in'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'billing',
    component: BillingHomeView
  },
  {
    path: SIGN_IN_PATH,
    name: 'sign-in',
    component: SignInView
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

export type BillingWebSessionPhase = SessionSnapshot['phase']

/**
 * Billing is never public: every route but the sign-in page needs a live
 * workspace session, and `pending` is not one — a restored identity that
 * mints afterwards is carried back by the sign-in page's own redirect.
 */
export function createBillingRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
  readPhase: () => BillingWebSessionPhase = billingWebSessionPhase
) {
  const router = createRouter({ history, routes })
  router.beforeEach((to) => {
    if (to.path === SIGN_IN_PATH || readPhase() === 'authenticated') return true
    return { path: SIGN_IN_PATH, query: { returnTo: to.fullPath } }
  })
  return router
}
