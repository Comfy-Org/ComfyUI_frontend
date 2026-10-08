import { until } from '@vueuse/core'
import { delay } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import {
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'
import type {
  LocationQueryRaw,
  NavigationGuardNext,
  RouteLocationNormalized
} from 'vue-router'

import { readSsoError, ssoStartUrl } from '@comfyorg/account-core/sso'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { CloudSignIn } from '@/platform/auth/session/cloudIdentityBoot'
import { cloudSignIn } from '@/platform/auth/session/cloudIdentityBoot'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import {
  hasRecentSsoReentry,
  markSsoReentry,
  readSsoHint
} from '@/platform/auth/session/ssoReentryStorage'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import LayoutDefault from '@/views/layouts/LayoutDefault.vue'

import { captureOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import { SSO_ENTRY_OPEN_QUERY } from '@/platform/cloud/onboarding/sso/ssoEntryQuery'
import { decideSsoReentry } from '@/platform/cloud/onboarding/sso/ssoReentry'
import {
  hasPendingDesktopLoginCode,
  installDesktopLoginRedemption
} from '@/platform/cloud/onboarding/desktopLoginRedemption'
import { PRESERVED_QUERY_DEFINITIONS } from '@/platform/navigation/preservedQueryDefinitions'
import { installPreservedQueryTracker } from '@/platform/navigation/preservedQueryTracker'
import { unmatchedRouteRedirect } from '@/platform/navigation/unmatchedRoute'
import { preserveLoggedOutShareAuthAttribution } from '@/platform/workflow/sharing/utils/shareAuthAttribution'

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
  if (isCloud) return import.meta.env.BASE_URL || '/'
  return window.location.pathname
}

const basePath = getBasePath()

function trackPageView(): void {
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
    },
    { path: '/:pathMatch(.*)*', redirect: unmatchedRouteRedirect }
  ],

  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)

router.beforeEach((to, _from, next) => {
  captureOAuthRequestId(to.query)
  next()
})

router.afterEach(() => {
  trackPageView()
})

const PUBLIC_ROUTE_SIGN_IN_TIMEOUT_MS = 3_000

if (isCloud) {
  const { flags } = useFeatureFlags()
  const PUBLIC_ROUTE_NAMES = new Set([
    'cloud-login',
    'cloud-signup',
    'cloud-forgot-password',
    'cloud-oauth-consent',
    'cloud-sorry-contact-support'
  ])
  const PUBLIC_ROUTE_PATHS = new Set([
    '/cloud/login',
    '/cloud/signup',
    '/cloud/forgot-password',
    '/oauth/consent',
    '/cloud/sorry-contact-support'
  ])

  function isPublicRoute(to: RouteLocationNormalized) {
    const name = String(to.name)
    if (PUBLIC_ROUTE_NAMES.has(name)) return true
    const path = to.path
    return PUBLIC_ROUTE_PATHS.has(path)
  }
  async function publicRouteSignIn(): Promise<CloudSignIn> {
    return Promise.race([
      cloudSignIn(),
      delay(PUBLIC_ROUTE_SIGN_IN_TIMEOUT_MS).then(() => 'signed_out' as const)
    ])
  }
  const watchedSessions = new WeakSet<object>()
  /** Re-runs this guard on the current route, which then sends the tab to sign-in. */
  function rerouteWhenSignedOutElsewhere(): void {
    const webSession = useCloudWebSessionStore()
    if (watchedSessions.has(webSession)) return
    watchedSessions.add(webSession)
    webSession.onSignedOutElsewhere(() => {
      const { path, query, hash } = router.currentRoute.value
      void router.replace({ path, query, hash, force: true })
    })
  }
  /** A lapsed SSO session goes back through its identity provider, once per tab per window. */
  function sendToSignIn(
    to: RouteLocationNormalized,
    query: LocationQueryRaw,
    next: NavigationGuardNext
  ): void {
    const ssoError = flags.ssoEnabled
      ? readSsoError(to.query.sso_error)
      : undefined
    const reentry = decideSsoReentry({
      ssoEnabled: flags.ssoEnabled,
      sessionEnd: useCloudWebSessionStore().sessionEnd(),
      hint: readSsoHint(),
      attempt: ssoError ? 'failed' : hasRecentSsoReentry() ? 'recent' : 'none'
    })
    if (reentry.kind === 'sso-redirect' && markSsoReentry()) {
      window.location.assign(
        ssoStartUrl({
          email: reentry.email,
          returnTo: to.fullPath,
          origin: window.location.origin
        })
      )
      return next(false)
    }
    next({
      name: 'cloud-login',
      query: {
        ...query,
        ...(reentry.kind !== 'login' && SSO_ENTRY_OPEN_QUERY),
        ...(ssoError && { sso_error: ssoError })
      }
    })
  }

  // Global authentication guard
  router.beforeEach(async (to, _from, next) => {
    rerouteWhenSignedOutElsewhere()
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

    let signIn = isPublicRoute(to)
      ? await publicRouteSignIn()
      : await cloudSignIn()
    if (signIn === 'pending' && !isPublicRoute(to)) {
      await useCloudWebSessionStore().whenDecided()
      signIn = await cloudSignIn()
    }
    const needsFirebaseForDesktopCode =
      signIn === 'signed_in' &&
      authStore.currentUser === null &&
      !authStore.signedInWithSso &&
      hasPendingDesktopLoginCode()
    const isLoggedIn = signIn === 'signed_in' && !needsFirebaseForDesktopCode
    preserveLoggedOutShareAuthAttribution(to.query, isLoggedIn)

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

    const query = {
      ...(to.fullPath !== '/' && {
        previousFullPath: encodeURIComponent(to.fullPath)
      }),
      ...(needsFirebaseForDesktopCode && { switchAccount: 'true' })
    }

    // Check if route requires authentication
    if (to.meta.requiresAuth && !isLoggedIn) {
      return sendToSignIn(to, query, next)
    }

    // Handle other protected routes
    if (!isLoggedIn) {
      // For Electron, use dialog
      if (isDesktop) {
        const dialogService = useDialogService()
        const loginSuccess = await dialogService.showSignInDialog()
        return loginSuccess ? next() : next(false)
      }

      return sendToSignIn(to, query, next)
    }

    // User is logged in - check if they need onboarding (when enabled)
    // For root path, check actual user status to handle waitlisted users
    if (!isDesktop && to.path === '/') {
      if (!flags.onboardingSurveyEnabled) {
        return next()
      }
      // Import auth functions dynamically to avoid circular dependency
      const { getSurveyCompletedStatus } =
        await import('@/platform/cloud/onboarding/auth')
      try {
        // Check user's actual status
        const surveyCompleted = await getSurveyCompletedStatus(
          useAuthStore().userId
        )

        // Survey is required for all users (when feature flag enabled)
        if (!surveyCompleted) {
          return next({ name: 'cloud-survey' })
        }
      } catch (error) {
        console.error('Failed to check user status:', error)
        // On error, redirect to user-check as fallback
        return next({ name: 'cloud-user-check' })
      }
    }

    // User is logged in and accessing protected route
    return next()
  })

  installDesktopLoginRedemption(router)
}

export default router
