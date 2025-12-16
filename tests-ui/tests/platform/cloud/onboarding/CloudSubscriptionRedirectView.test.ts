import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { Router } from 'vue-router'

import CloudSubscriptionRedirectView from '@/platform/cloud/onboarding/CloudSubscriptionRedirectView.vue'

vi.mock('@/composables/auth/useFirebaseAuthActions', () => ({
  useFirebaseAuthActions: () => ({
    reportError: vi.fn(),
    accessBillingPortal: vi.fn()
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync:
      <T extends (...args: never[]) => unknown>(fn: T) =>
      (...args: Parameters<T>) =>
        fn(...args)
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isActiveSubscription: { value: false }
  })
}))

const createI18nInstance = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          comfyOrgLogoAlt: 'Comfy org logo'
        },
        subscription: {
          subscribeTo: 'Subscribe to {plan}',
          tiers: {
            standard: { name: 'Standard' },
            creator: { name: 'Creator' },
            pro: { name: 'Pro' }
          }
        }
      }
    }
  })

const createRouterMocks = (overrides: Partial<Router> = {}) => {
  const push = vi.fn()

  const router = {
    push,
    ...overrides
  } as unknown as Router

  return { router, push }
}

const mountView = (query: Record<string, unknown>) => {
  const route = {
    query
  }

  const { router, push } = createRouterMocks()

  const wrapper = mount(CloudSubscriptionRedirectView, {
    global: {
      plugins: [createI18nInstance()],
      mocks: {
        $route: route,
        $router: router
      },
      stubs: {}
    }
  }) as VueWrapper

  return { wrapper, push }
}

describe('CloudSubscriptionRedirectView', () => {
  test('redirects to home when subscriptionType is missing', () => {
    const { push } = mountView({})

    expect(push).toHaveBeenCalledWith('/')
  })

  test('redirects to home when subscriptionType is invalid', () => {
    const { push } = mountView({ subscriptionType: 'invalid' })

    expect(push).toHaveBeenCalledWith('/')
  })

  test('shows subscription copy when subscriptionType is valid', () => {
    const { wrapper, push } = mountView({ subscriptionType: 'creator' })

    // Should not redirect to home
    expect(push).not.toHaveBeenCalledWith('/')

    // Shows copy under logo
    expect(wrapper.text()).toContain('Subscribe to Creator')
  })
})
