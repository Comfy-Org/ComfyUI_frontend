import {
  NavigationGuardNext,
  RouteLocationNormalized,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'

import { getMe } from '@/api/auth'
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
  'verify-email'
])

const isPublicRoute = (to: RouteLocationNormalized) => {
  const name = String(to.name)
  if (PUBLIC_ROUTE_NAMES.has(name)) return true
  const path = to.path
  if (path === '/login' || path === '/signup' || path === '/forgot-password')
    return true
  if (path.startsWith('/code')) return true
  if (path.startsWith('/verify-email')) return true
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
            // Check onboarding status first
            const me = await getMe()
            if (me) {
              // const emailVerified =
              //   localStorage.getItem('emailVerified') === 'true'

              // if (!emailVerified) {
              //   return next('/verify-email')
              // }
              if (!me.surveyCompleted) {
                return next('/survey')
              }
              if (!me.whitelisted) {
                return next('/waitlist')
              }
            }

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

  // Wait for Firebase auth to initialize
  if (!authStore.isInitialized) {
    await new Promise<void>((resolve) => {
      const unwatch = authStore.$subscribe((_, state) => {
        if (state.isInitialized) {
          unwatch()
          resolve()
        }
      })
    })
  }

  // Check if user is authenticated
  const authHeader = await authStore.getAuthHeader()
  const isLoggedIn = !!authHeader

  // Allow public routes without authentication
  if (isPublicRoute(to)) {
    // If logged in and trying to access login/signup, redirect based on status
    if (
      isLoggedIn &&
      (to.name === 'cloud-login' || to.name === 'cloud-signup')
    ) {
      try {
        const me = await getMe()
        if (me && !me.surveyCompleted) {
          return next({ name: 'cloud-survey' })
        }
        if (me && !me.whitelisted) {
          return next({ name: 'cloud-waitlist' })
        }
        return next({ path: '/' })
      } catch (error) {
        console.error('Error fetching user status:', error)
        return next({ path: '/' })
      }
    }
    // Allow access to public routes
    return next()
  }

  // Handle protected routes
  if (!isLoggedIn) {
    // For Electron, use dialog
    if (isElectron()) {
      const dialogService = useDialogService()
      const loginSuccess = await dialogService.showSignInDialog()
      return loginSuccess ? next() : next(false)
    }

    // For web, redirect to login
    return next({ name: 'cloud-login' })
  }

  // User is logged in and accessing protected route
  return next()
})

export default router
