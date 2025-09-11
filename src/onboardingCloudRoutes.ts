import type { RouteRecordRaw } from 'vue-router'

export const cloudOnboardingRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'cloud-login',
    component: () => import('@/platform/onboarding/cloud/CloudLoginView.vue')
  },
  {
    path: '/signup',
    name: 'cloud-signup',
    component: () => import('@/platform/onboarding/cloud/CloudSignupView.vue')
  },
  {
    path: '/forgot-password',
    name: 'cloud-forgot-password',
    component: () =>
      import('@/platform/onboarding/cloud/CloudForgotPasswordView.vue')
  },
  {
    path: '/survey',
    name: 'cloud-survey',
    component: () => import('@/platform/onboarding/cloud/CloudSurveyView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/waitlist',
    name: 'cloud-waitlist',
    component: () =>
      import('@/platform/onboarding/cloud/CloudWaitlistView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/code/:inviteCode',
    name: 'invite-entry',
    component: () =>
      import('@/platform/onboarding/cloud/CloudInviteEntryView.vue')
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () =>
      import('@/platform/onboarding/cloud/CloudVerifyEmailView.vue')
  },
  {
    path: '/claim-invite',
    name: 'claim-invite',
    component: () =>
      import('@/platform/onboarding/cloud/CloudClaimInviteView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/sorry-contact-support',
    name: 'sorry-contact-support',
    component: () =>
      import('@/platform/onboarding/cloud/CloudSorryContactSupportView.vue')
  }
]
