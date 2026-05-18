import type { RouteRecordRaw } from 'vue-router'

import { getOAuthRequestId } from '@/platform/cloud/oauth/oauthState'

// `oauth_request_id` capture lives in the global router.beforeEach guard
// (src/router.ts), which runs before any per-route beforeEnter. Per-route
// guards read it back via getOAuthRequestId().
function oauthConsentRedirect() {
  const oauthRequestId = getOAuthRequestId()
  return oauthRequestId
    ? {
        name: 'cloud-oauth-consent',
        query: { oauth_request_id: oauthRequestId }
      }
    : { name: 'cloud-user-check' }
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
          // Only redirect if not explicitly switching accounts
          if (!to.query.switchAccount) {
            const { useCurrentUser } =
              await import('@/composables/auth/useCurrentUser')
            const { isLoggedIn } = useCurrentUser()

            if (isLoggedIn.value) {
              return next(oauthConsentRedirect())
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
              return next(oauthConsentRedirect())
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
        meta: { requiresAuth: true }
      },
      {
        path: 'oauth/consent',
        name: 'cloud-oauth-consent',
        component: () => import('@/platform/cloud/oauth/OAuthConsentView.vue')
      },
      {
        path: 'user-check',
        name: 'cloud-user-check',
        component: () =>
          import('@/platform/cloud/onboarding/UserCheckView.vue'),
        meta: { requiresAuth: true }
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
  }
]
