import {
  NavigationGuardNext,
  RouteLocationNormalized,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'

import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useUserStore } from '@/stores/userStore'
import { isElectron } from '@/utils/envUtil'
import LayoutDefault from '@/views/layouts/LayoutDefault.vue'

import { cloudOnboardingRoutes } from './onboardingCloudRoutes'

const PUBLIC_ROUTE_NAMES = new Set([
  'cloud-login',
  'cloud-signup',
  'cloud-forgot-password',
  'cloud-verify-email',
  'cloud-sorry-contact-support'
])

const isPublicRoute = (to: RouteLocationNormalized) => {
  const name = String(to.name)
  if (PUBLIC_ROUTE_NAMES.has(name)) return true
  const path = to.path
  if (
    path === '/cloud/login' ||
    path === '/cloud/signup' ||
    path === '/cloud/forgot-password' ||
    path === '/cloud/verify-email' ||
    path === '/cloud/sorry-contact-support'
  )
    return true
  if (path.startsWith('/cloud/code')) return true
  return false
}

const isFileProtocol = window.location.protocol === 'file:'

// Determine base path for the router
// - Electron: always root
// - Web: rely on Vite's BASE_URL (configured via vite.config `base`)
function getBasePath(): string {
  if (isElectron()) return '/'
  // Vite injects BASE_URL at build/dev time; default is '/'
  const viteBase = (import.meta as any).env?.BASE_URL || '/'
  return viteBase
}

const basePath = getBasePath()

const guardElectronAccess = (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  if (isElectron()) {
    next()
  } else {
    next('/')
  }
}

const router = createRouter({
  history: isFileProtocol
    ? createWebHashHistory()
    : // Base path must be specified to ensure correct relative paths
      // Example: For URL 'http://localhost:7801/ComfyBackendDirect',
      // we need this base path or assets will incorrectly resolve from 'http://localhost:7801/'
      createWebHistory(basePath),
  routes: [
    // Cloud onboarding routes
    ...cloudOnboardingRoutes,
    {
      path: '/',
      component: LayoutDefault,
      children: [
        {
          path: '',
          name: 'GraphView',
          component: () => import('@/views/GraphView.vue'),
          beforeEnter: async (_to, _from, next) => {
            // Then check user store
            const userStore = useUserStore()
            await userStore.initialize()
            if (userStore.needsLogin) {
              next('/user-select')
            } else {
              next()
            }
          }
        },
        {
          path: 'user-select',
          name: 'UserSelectView',
          component: () => import('@/views/UserSelectView.vue')
        },
        {
          path: 'server-start',
          name: 'ServerStartView',
          component: () => import('@/views/ServerStartView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: 'install',
          name: 'InstallView',
          component: () => import('@/views/InstallView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: 'welcome',
          name: 'WelcomeView',
          component: () => import('@/views/WelcomeView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: 'not-supported',
          name: 'NotSupportedView',
          component: () => import('@/views/NotSupportedView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: 'download-git',
          name: 'DownloadGitView',
          component: () => import('@/views/DownloadGitView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: 'manual-configuration',
          name: 'ManualConfigurationView',
          component: () => import('@/views/ManualConfigurationView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: '/metrics-consent',
          name: 'MetricsConsentView',
          component: () => import('@/views/MetricsConsentView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: 'desktop-start',
          name: 'DesktopStartView',
          component: () => import('@/views/DesktopStartView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: 'maintenance',
          name: 'MaintenanceView',
          component: () => import('@/views/MaintenanceView.vue'),
          beforeEnter: guardElectronAccess
        },
        {
          path: 'desktop-update',
          name: 'DesktopUpdateView',
          component: () => import('@/views/DesktopUpdateView.vue'),
          beforeEnter: guardElectronAccess
        }
      ]
    },
    // Catch-all: redirect unknown routes
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found-redirect',
      redirect: '/'
    }
  ],

  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// Global authentication guard
router.beforeEach(async (to, _from, next) => {
  const authStore = useFirebaseAuthStore()

  // Wait for Firebase auth to initialize with timeout
  if (!authStore.isInitialized) {
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          unwatch()
          reject(new Error('Authentication initialization timeout'))
        }, 16000) // 16 second timeout

        const unwatch = authStore.$subscribe((_, state) => {
          if (state.isInitialized) {
            clearTimeout(timeout)
            unwatch()
            resolve()
          }
        })
      })
    } catch (error) {
      console.error('Auth initialization failed:', error)
      // Navigate to auth timeout recovery page
      return next({ name: 'cloud-auth-timeout' })
    }
  }

  // Check if user is authenticated
  const authHeader = await authStore.getAuthHeader()
  const isLoggedIn = !!authHeader

  // Allow public routes
  if (isPublicRoute(to)) {
    return next()
  }

  // Special handling for user-check and invite-check routes
  // These routes need auth but handle their own routing logic
  if (to.name === 'cloud-user-check' || to.name === 'cloud-invite-check') {
    if (to.meta.requiresAuth && !isLoggedIn) {
      return next({ name: 'cloud-login' })
    }
    return next()
  }

  // Prevent redirect loop when coming from user-check
  if (_from.name === 'cloud-user-check' && to.path === '/') {
    return next()
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isLoggedIn) {
    return next({ name: 'cloud-login' })
  }

  // Handle other protected routes
  if (!isPublicRoute(to) && !isLoggedIn) {
    // For Electron, use dialog
    if (isElectron()) {
      const dialogService = useDialogService()
      const loginSuccess = await dialogService.showSignInDialog()
      return loginSuccess ? next() : next(false)
    }

    // For web, redirect to login
    return next({ name: 'cloud-login' })
  }

  // User is logged in - check if they need onboarding
  // For root path, check actual user status to handle waitlisted users
  if (!isElectron() && isLoggedIn && to.path === '/') {
    try {
      // Import auth functions dynamically to avoid circular dependency
      const { getUserCloudStatus, getSurveyCompletedStatus } = await import(
        '@/api/auth'
      )

      // Check user's actual status
      const userStatus = await getUserCloudStatus()
      const surveyCompleted = await getSurveyCompletedStatus()

      // If user is not active (waitlisted), redirect based on survey status
      if (userStatus.status !== 'active') {
        if (!surveyCompleted) {
          return next({ name: 'cloud-survey' })
        } else {
          return next({ name: 'cloud-waitlist' })
        }
      }
      // User is active, allow access to root
    } catch (error) {
      console.error('Failed to check user status:', error)
      // On error, redirect to user-check as fallback
      return next({ name: 'cloud-user-check' })
    }
  }

  // User is logged in and accessing protected route
  return next()
})

export default router
