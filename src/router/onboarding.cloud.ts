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
  }
]
