import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'

import { getAuthStatus } from '@/api/simpleAuth'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

export async function cloudOnboardingGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const requiresAuth = to.meta.requiresAuth
  const status = getAuthStatus()
  const authStore = useFirebaseAuthStore()
  const authHeader = await authStore.getAuthHeader()
  const isLoggedIn = !!authHeader

  if (requiresAuth && !isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (isLoggedIn) {
    const path = to.path

    if (
      !status.emailVerified &&
      path !== '/verify-email' &&
      path !== '/login' &&
      path !== '/signup' &&
      !path.startsWith('/code/')
    ) {
      next('/verify-email')
      return
    }

    if (
      status.emailVerified &&
      !status.surveyCompleted &&
      path !== '/survey' &&
      path !== '/verify-email'
    ) {
      next('/survey')
      return
    }

    if (
      status.surveyCompleted &&
      !status.whitelisted &&
      path !== '/waitlist' &&
      path !== '/survey' &&
      path !== '/claim-invite'
    ) {
      next('/waitlist')
      return
    }

    if (status.surveyCompleted && status.whitelisted) {
      if (
        path === '/login' ||
        path === '/signup' ||
        path === '/survey' ||
        path === '/waitlist'
      ) {
        next('/')
        return
      }
    }
  }

  next()
}
