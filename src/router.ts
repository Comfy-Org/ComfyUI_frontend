import * as Sentry from '@sentry/vue'
import { until } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import LayoutDefault from '@/views/layouts/LayoutDefault.vue'

import { installPreservedQueryTracker } from '@/platform/navigation/preservedQueryTracker'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

// Tab-scoped flag: once we've evaluated the onboarding-survey gate for a
// browser-tab session, don't re-evaluate it on subsequent navigations.
// sessionStorage survives `window.location.reload()` in the same tab but
// is fresh for new tabs — exactly the semantics we want.
const SURVEY_GATE_SESSION_KEY = 'comfy.survey_gate_evaluated_this_session'

const cloudOnboardingRoutes = isCloud
  ? (await import('./platform/cloud/onboarding/onboardingCloudRoutes'))
      .cloudOnboardingRoutes
  : []

const isFileProtocol = window.location.protocol === 'file:'

/**
 * Determine base path for the router.
 * - Electron: always root
 * - Cloud: use Vite's BASE_URL (configured at build time)
 * - Standard web (including reverse proxy subpaths): use window.location.pathname
 *   to support deployments like http://mysite.com/ComfyUI/
 */
function getBasePath(): string {
  if (isDesktop) return '/'
  if (isCloud) return import.meta.env?.BASE_URL || '/'
  return window.location.pathname
}

const basePath = getBasePath()

function trackPageView(): void {
  if (!isCloud || typeof window === 'undefined') return

  useTelemetry()?.trackPageView(document.title, {
    path: window.location.href
  })
}

const router = createRouter({
  history: isFileProtocol
    ? createWebHashHistory()
    : // Base path must be specified to ensure correct relative paths
      // Example: For URL 'http://localhost:7801/ComfyBackendDirect',
      // we need this base path or assets will incorrectly resolve from 'http://localhost:7801/'
      createWebHistory(basePath),
  routes: [
    ...(isCloud ? cloudOnboardingRoutes : []),
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
        }
      ]
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

installPreservedQueryTracker(router, [
  {
    namespace: PRESERVED_QUERY_NAMESPACES.TEMPLATE,
    keys: ['template', 'source', 'mode']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.SHARE,
    keys: ['share']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.INVITE,
    keys: ['invite']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.CREATE_WORKSPACE,
    keys: ['create_workspace']
  }
])

router.afterEach(() => {
  trackPageView()
})

if (isCloud) {
  const { flags } = useFeatureFlags()
  const PUBLIC_ROUTE_NAMES = new Set([
    'cloud-login',
    'cloud-signup',
    'cloud-forgot-password',
    'cloud-sorry-contact-support'
  ])
  const PUBLIC_ROUTE_PATHS = new Set([
    '/cloud/login',
    '/cloud/signup',
    '/cloud/forgot-password',
    '/cloud/sorry-contact-support'
  ])

  function isPublicRoute(to: RouteLocationNormalized) {
    const name = String(to.name)
    if (PUBLIC_ROUTE_NAMES.has(name)) return true
    const path = to.path
    return PUBLIC_ROUTE_PATHS.has(path)
  }
  // Global authentication guard
  router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()

    // Wait for Firebase auth to initialize
    // Timeout after 16 seconds
    if (!authStore.isInitialized) {
      try {
        const { isInitialized } = storeToRefs(authStore)
        await until(isInitialized).toBe(true, { timeout: 16_000 })
      } catch (error) {
        console.error('Auth initialization failed:', error)
        return next({ name: 'cloud-auth-timeout' })
      }
    }

    // Pass authenticated users
    const authHeader = await authStore.getAuthHeader()
    const isLoggedIn = !!authHeader

    // Allow public routes
    if (isPublicRoute(to)) {
      return next()
    }

    // Special handling for user-check
    // These routes need auth but handle their own routing logic
    if (to.name === 'cloud-user-check') {
      if (to.meta.requiresAuth && !isLoggedIn) {
        return next({ name: 'cloud-login' })
      }
      return next()
    }

    // Prevent redirect loop when coming from user-check
    if (_from.name === 'cloud-user-check' && to.path === '/') {
      return next()
    }

    const query =
      to.fullPath === '/'
        ? undefined
        : { previousFullPath: encodeURIComponent(to.fullPath) }

    // Check if route requires authentication
    if (to.meta.requiresAuth && !isLoggedIn) {
      return next({
        name: 'cloud-login',
        query
      })
    }

    // Handle other protected routes
    if (!isLoggedIn) {
      // For Electron, use dialog
      if (isDesktop) {
        const dialogService = useDialogService()
        const loginSuccess = await dialogService.showSignInDialog()
        return loginSuccess ? next() : next(false)
      }

      // For web, redirect to login
      return next({
        name: 'cloud-login',
        query
      })
    }

    // User is logged in - check if they need onboarding (when enabled)
    // For root path, check actual user status to handle waitlisted users.
    //
    // The survey gate is intentionally gated once per browser-tab session.
    // sessionStorage persists across `window.location.reload()` in the same
    // tab, so background reloads (token refresh races, GraphCanvas's 401
    // recovery, the remote-config 10-minute poll, etc.) cannot re-bounce a
    // working user mid-session. A fresh tab gets a fresh check, which
    // matches the intent of showing the survey to first-time and existing-
    // but-never-prompted users.
    if (!isDesktop && isLoggedIn && to.path === '/') {
      if (!flags.onboardingSurveyEnabled) {
        return next()
      }
      if (sessionStorage.getItem(SURVEY_GATE_SESSION_KEY)) {
        return next()
      }
      // Import auth functions dynamically to avoid circular dependency
      const { getSurveyCompletedStatus } =
        await import('@/platform/cloud/onboarding/auth')
      try {
        // Check user's actual status
        const surveyCompleted = await getSurveyCompletedStatus()

        // Mark this session as gate-evaluated regardless of outcome.
        // If we redirect to /cloud/survey, the user fills it out and the
        // next /cloud-user-check call sees a completed survey on its own
        // server round-trip; this flag only suppresses re-evaluation of
        // the *same* request on subsequent navigations within this tab.
        sessionStorage.setItem(SURVEY_GATE_SESSION_KEY, '1')

        // Survey is required for all users (when feature flag enabled).
        // getSurveyCompletedStatus returns true for ambiguous responses
        // (404/5xx/network) so this branch only fires on a definitive
        // "user has no survey saved" signal — see auth.ts for the policy.
        if (!surveyCompleted) {
          Sentry.addBreadcrumb({
            category: 'navigation',
            message: 'survey gate → /cloud/survey',
            level: 'info',
            data: {
              from_path: _from.fullPath,
              from_name: String(_from.name ?? ''),
              initial_load: _from.name === undefined
            }
          })
          return next({ name: 'cloud-survey' })
        }
      } catch (error) {
        // Most likely an auth error from getSurveyCompletedStatus.
        // Don't bounce to /cloud-user-check — that re-runs the same checks
        // and can produce a redirect loop. Let the user proceed; the auth
        // layer will handle re-authentication on the next API call.
        sessionStorage.setItem(SURVEY_GATE_SESSION_KEY, '1')
        console.error('Failed to check survey status:', error)
      }
    }

    // User is logged in and accessing protected route
    return next()
  })
}

export default router
