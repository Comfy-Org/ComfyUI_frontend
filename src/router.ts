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
  NavigationGuardReturn,
  RouteLocationNormalized,
  Router
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
import { trackSsoRequiredShown } from '@/platform/auth/sso/ssoTelemetry'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'
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

function trackPageView(): void {
  useTelemetry()?.trackPageView(document.title, {
    path: window.location.href
  })
}

/** Creates the app router with its routes and navigation guards. */
export async function createAppRouter(): Promise<Router> {
  const cloudOnboardingRoutes = isCloud
    ? (await import('./platform/cloud/onboarding/onboardingCloudRoutes'))
        .cloudOnboardingRoutes
    : []

  const router = createRouter({
    history:
      window.location.protocol === 'file:'
        ? createWebHashHistory()
        : createWebHistory(getBasePath()),
    routes: [
      ...cloudOnboardingRoutes,
      {
        path: '/',
        component: LayoutDefault,
        children: [
          {
            path: '',
            name: 'GraphView',
            component: () =>
              bootstrapTracer.settle(
                'bootstrap/graph-view-chunk',
                () => import('@/views/GraphView.vue')
              ),
            beforeEnter: async () => {
              const userStore = useUserStore()
              await userStore.initialize()
              if (userStore.needsLogin) return '/user-select'
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

  router.beforeEach((to) => {
    captureOAuthRequestId(to.query)
  })

  router.afterEach(() => {
    trackPageView()
  })

  if (isCloud) installCloudAuthGuards(router)

  return router
}

const PUBLIC_ROUTE_SIGN_IN_TIMEOUT_MS = 3_000

function installCloudAuthGuards(router: Router): void {
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
  /** Closes the signed-in tab's dialogs and re-runs this guard on the current route, which then sends the tab to sign-in. */
  function rerouteWhenSignedOutElsewhere(): void {
    const webSession = useCloudWebSessionStore()
    if (watchedSessions.has(webSession)) return
    watchedSessions.add(webSession)
    webSession.onSignedOutElsewhere(() => {
      const dialogs = useDialogStore()
      dialogs.dialogStack
        .map(({ key }) => key)
        .forEach((key) => dialogs.closeDialog({ key }))
      const { path, query, hash } = router.currentRoute.value
      void router.replace({ path, query, hash, force: true })
    })
  }
  /** A lapsed SSO session goes back through its identity provider, once per tab per window. */
  function sendToSignIn(
    to: RouteLocationNormalized,
    query: LocationQueryRaw
  ): NavigationGuardReturn {
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
      trackSsoRequiredShown('cloud_app', 'session_expired', 'redirect')
      window.location.assign(
        ssoStartUrl({
          email: reentry.email,
          returnTo: to.fullPath,
          origin: window.location.origin
        })
      )
      return false
    }
    return {
      name: 'cloud-login',
      query: {
        ...query,
        ...(reentry.kind !== 'login' && SSO_ENTRY_OPEN_QUERY),
        ...(ssoError && { sso_error: ssoError })
      }
    }
  }

  router.beforeEach(async (to, from) => {
    rerouteWhenSignedOutElsewhere()
    const authStore = useAuthStore()

    if (!authStore.isInitialized) {
      try {
        const { isInitialized } = storeToRefs(authStore)
        await until(isInitialized).toBe(true, { timeout: 16_000 })
      } catch (error) {
        console.error('Auth initialization failed:', error)
        return { name: 'cloud-auth-timeout' }
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

    if (isPublicRoute(to)) {
      return
    }

    if (to.name === 'cloud-user-check') {
      if (to.meta.requiresAuth && !isLoggedIn) {
        return {
          name: 'cloud-login',
          query: needsFirebaseForDesktopCode
            ? { switchAccount: 'true' }
            : undefined
        }
      }
      return
    }

    if (from.name === 'cloud-user-check' && to.path === '/') {
      return
    }

    const query = {
      ...(to.fullPath !== '/' && {
        previousFullPath: encodeURIComponent(to.fullPath)
      }),
      ...(needsFirebaseForDesktopCode && { switchAccount: 'true' })
    }

    if (to.meta.requiresAuth && !isLoggedIn) {
      return sendToSignIn(to, query)
    }

    if (!isLoggedIn) {
      if (isDesktop) {
        const loginSuccess = await useAuthDialogs().showSignInDialog()
        return loginSuccess
      }

      return sendToSignIn(to, query)
    }

    if (!isDesktop && to.path === '/') {
      if (!flags.onboardingSurveyEnabled) {
        return
      }
      const { getSurveyCompletedStatus } =
        await import('@/platform/cloud/onboarding/auth')
      try {
        const surveyCompleted = await getSurveyCompletedStatus(
          useAuthStore().userId
        )

        if (!surveyCompleted) {
          return { name: 'cloud-survey' }
        }
      } catch (error) {
        console.error('Failed to check user status:', error)
        return { name: 'cloud-user-check' }
      }
    }

    return
  })

  installDesktopLoginRedemption(router)
}
