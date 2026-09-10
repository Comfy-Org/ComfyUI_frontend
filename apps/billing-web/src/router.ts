import type { RouterHistory, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

import BillingHomeView from '@/views/BillingHomeView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'billing',
    component: BillingHomeView
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

export function createBillingRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL)
) {
  return createRouter({ history, routes })
}
