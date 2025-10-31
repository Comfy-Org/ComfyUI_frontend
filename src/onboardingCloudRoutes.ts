import type { RouteRecordRaw } from 'vue-router'

export const cloudOnboardingRoutes: RouteRecordRaw[] = [
  {
    path: '/cloud',
    component: () =>
      import('@/platform/onboarding/cloud/components/CloudLayoutView.vue'),
    children: [
      {
        path: 'code/:code',
        name: 'cloud-invite-code',
        component: () =>
          import('@/platform/onboarding/cloud/CloudInviteEntryView.vue')
      },
      {
        path: 'login',
        name: 'cloud-login',
        component: () =>
          import('@/platform/onboarding/cloud/CloudLoginView.vue'),
        beforeEnter: async (to, _from, next) => {
          // Only redirect if not explicitly switching accounts
          if (!to.query.switchAccount) {
            const { useCurrentUser } = await import(
              '@/composables/auth/useCurrentUser'
            )
            const { isLoggedIn } = useCurrentUser()

            if (isLoggedIn.value) {
              // User is already logged in, redirect to user-check
              // user-check will handle survey, waitlist, or main page routing
              return next({ name: 'cloud-user-check' })
            }
          }
          next()
        }
      },
      {
        path: 'signup',
        name: 'cloud-signup',
        component: () =>
          import('@/platform/onboarding/cloud/CloudSignupView.vue')
      },
      {
        path: 'forgot-password',
        name: 'cloud-forgot-password',
        component: () =>
          import('@/platform/onboarding/cloud/CloudForgotPasswordView.vue')
      },
      {
        path: 'survey',
        name: 'cloud-survey',
        component: () =>
          import('@/platform/onboarding/cloud/CloudSurveyView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'waitlist',
        name: 'cloud-waitlist',
        component: () =>
          import('@/platform/onboarding/cloud/CloudWaitlistView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'user-check',
        name: 'cloud-user-check',
        component: () =>
          import('@/platform/onboarding/cloud/UserCheckView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'invite-check',
        name: 'cloud-invite-check',
        component: () =>
          import('@/platform/onboarding/cloud/InviteCheckView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'claim-invite',
        name: 'cloud-claim-invite',
        component: () =>
          import('@/platform/onboarding/cloud/CloudClaimInviteView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'verify-email',
        name: 'cloud-verify-email',
        redirect: (to) => ({
          name: 'cloud-user-check',
          query: to.query
        })
      },
      {
        path: 'sorry-contact-support',
        name: 'cloud-sorry-contact-support',
        component: () =>
          import('@/platform/onboarding/cloud/CloudSorryContactSupportView.vue')
      },
      {
        path: 'auth-timeout',
        name: 'cloud-auth-timeout',
        component: () =>
          import('@/platform/onboarding/cloud/CloudAuthTimeoutView.vue'),
        props: true
      }
    ]
  }
]
