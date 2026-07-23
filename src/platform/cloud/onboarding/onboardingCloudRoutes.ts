import type { RouteRecordRaw } from 'vue-router'

import { getOAuthRequestId } from '@/platform/cloud/oauth/oauthState'

// `oauth_request_id` capture lives in the global router.beforeEach guard
// (src/router.ts), which runs before any per-route beforeEnter. Per-route
// guards read it back via getOAuthRequestId().
//
// When an already-signed-in user is bounced to login/signup mid-OAuth, we skip
// the sign-in step and jump straight to consent. The consent challenge fetch
// (GET /oauth/authorize) is authenticated by the Cloud *session cookie*, which
// is a separate credential from the Firebase client login that `isLoggedIn`
// reflects. The post-login resume path mints that cookie via
// `createSessionOrThrow` (see useOAuthPostLoginRedirect); the already-signed-in
// path must do the same. Without it the consent fetch is unauthenticated, the
// backend 302s it to login, and the consent view fails with
// "OAuth request failed. Please restart from the client app."
export async function oauthConsentRedirect() {
  const oauthRequestId = getOAuthRequestId()
  if (!oauthRequestId) return { name: 'cloud-user-check' }

  try {
    const { useSessionCookie } =
      await import('@/platform/auth/session/useSessionCookie')
    await useSessionCookie().createSessionOrThrow()
  } catch (error) {
    // Best effort: if the cookie can't be minted (e.g. an expired Firebase
    // token), still land on the consent view so it can surface the failure and
    // prompt the user to restart from the client app, rather than silently
    // dropping the OAuth flow.
    console.warn(
      'Failed to establish Cloud session cookie before OAuth consent:',
      error
    )
  }

  return {
    name: 'cloud-oauth-consent',
    query: { oauth_request_id: oauthRequestId }
  }
}

export const cloudOnboardingRoutes: RouteRecordRaw[] = [
  {
    path: '/cloud',
    component: () =>
      import('@/platform/cloud/onboarding/components/CloudLayoutView.vue'),
    children: [
      {
        path: 'login',
        name: 'cloud-login',
        component: () =>
          import('@/platform/cloud/onboarding/CloudLoginView.vue'),
        beforeEnter: async (to, _from, next) => {
          if (!to.query.switchAccount) {
            const { useCurrentUser } =
              await import('@/composables/auth/useCurrentUser')
            const { isLoggedIn } = useCurrentUser()

            if (isLoggedIn.value) {
              return next(await oauthConsentRedirect())
            }
          }
          next()
        }
      },
      {
        path: 'signup',
        name: 'cloud-signup',
        component: () =>
          import('@/platform/cloud/onboarding/CloudSignupView.vue'),
        beforeEnter: async (to, _from, next) => {
          if (!to.query.switchAccount) {
            const { useCurrentUser } =
              await import('@/composables/auth/useCurrentUser')
            const { isLoggedIn } = useCurrentUser()

            if (isLoggedIn.value) {
              return next(await oauthConsentRedirect())
            }
          }
          next()
        }
      },
      {
        path: 'forgot-password',
        name: 'cloud-forgot-password',
        component: () =>
          import('@/platform/cloud/onboarding/CloudForgotPasswordView.vue')
      },
      {
        path: 'survey',
        name: 'cloud-survey',
        component: () =>
          import('@/platform/cloud/onboarding/CloudSurveyView.vue'),
        meta: { requiresAuth: true, hideHero: true }
      },
      {
        path: 'user-check',
        name: 'cloud-user-check',
        component: () =>
          import('@/platform/cloud/onboarding/UserCheckView.vue'),
        meta: { requiresAuth: true, hideHero: true }
      },
      {
        path: 'sorry-contact-support',
        name: 'cloud-sorry-contact-support',
        component: () =>
          import('@/platform/cloud/onboarding/CloudSorryContactSupportView.vue')
      },
      {
        path: 'auth-timeout',
        name: 'cloud-auth-timeout',
        component: () =>
          import('@/platform/cloud/onboarding/CloudAuthTimeoutView.vue'),
        props: true
      },
      {
        path: 'subscribe',
        name: 'cloud-subscribe',
        component: () =>
          import('@/platform/cloud/onboarding/CloudSubscriptionRedirectView.vue'),
        meta: { requiresAuth: true }
      }
    ]
  },
  {
    path: '/oauth',
    component: () =>
      import('@/platform/cloud/onboarding/components/OAuthLayoutView.vue'),
    children: [
      {
        path: 'consent',
        name: 'cloud-oauth-consent',
        component: () => import('@/platform/cloud/oauth/OAuthConsentView.vue')
      }
    ]
  }
]
