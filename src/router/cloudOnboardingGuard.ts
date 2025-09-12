import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

export async function cloudOnboardingGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const requiresAuth = to.meta.requiresAuth
  const authStore = useFirebaseAuthStore()
  const authHeader = await authStore.getAuthHeader()
  const isLoggedIn = !!authHeader

  // Check authentication for protected routes
  if (requiresAuth && !isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // Allow special check routes to handle their own logic
  const specialRoutes = ['/user-check', '/invite-check']
  if (specialRoutes.includes(to.path)) {
    next()
    return
  }

  // If logged in and going to main app, do user check first
  if (isLoggedIn && to.path === '/') {
    next({ name: 'cloud-user-check' })
    return
  }

  // Allow auth pages when not logged in
  const authPages = ['/login', '/signup', '/forgot-password']
  if (!isLoggedIn && authPages.includes(to.path)) {
    next()
    return
  }

  // If logged in and trying to access auth pages, redirect to user check
  if (isLoggedIn && authPages.includes(to.path)) {
    next({ name: 'cloud-user-check' })
    return
  }

  next()
}
