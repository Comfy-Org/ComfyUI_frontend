import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import CloudSignupView from '@/platform/cloud/onboarding/CloudSignupView.vue'

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    signInWithGoogle: vi.fn(),
    signInWithGithub: vi.fn(),
    signUpWithEmail: vi.fn()
  })
}))

vi.mock('@/platform/cloud/onboarding/composables/usePostAuthRedirect', () => ({
  usePostAuthRedirect: () => ({ onAuthSuccess: vi.fn() })
}))

vi.mock('@/base/webviewDetection', () => ({ isEmbeddedWebView: () => false }))
vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))

const inChina = vi.hoisted(() => ({ value: false }))
vi.mock('@/utils/networkUtil', () => ({
  isInChina: () => Promise.resolve(inChina.value)
}))

const freeTier = vi.hoisted(() => ({ value: false }))
vi.mock(
  '@/platform/cloud/onboarding/composables/useFreeTierOnboarding',
  () => ({
    useFreeTierOnboarding: () => ({
      isFreeTierEnabled: { value: freeTier.value }
    })
  })
)

const MESSAGES = {
  auth: {
    login: { useEmailInstead: 'Use email instead' },
    signup: {
      signIn: 'Sign in',
      regionRestrictionChina: 'Email sign-up is unavailable in your region.'
    }
  }
}

async function renderSignupView(url = '/cloud/signup') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/cloud/signup',
        name: 'cloud-signup',
        component: CloudSignupView
      },
      {
        path: '/cloud/login',
        name: 'cloud-login',
        component: { template: '<div />' }
      }
    ]
  })
  await router.push(url)
  await router.isReady()
  return render(CloudSignupView, {
    global: {
      plugins: [
        router,
        createI18n({ legacy: false, locale: 'en', messages: { en: MESSAGES } })
      ],
      stubs: { SignUpForm: { template: '<form data-testid="signup-form" />' } }
    }
  })
}

beforeEach(() => {
  inChina.value = false
  freeTier.value = false
})

describe('CloudSignupView', () => {
  it('carries the incoming query onto the sign-in link', async () => {
    await renderSignupView(
      '/cloud/signup?previousFullPath=%2Ffoo%3Fx%3D1&switchAccount=1&oauth_request_id=abc'
    )

    expect(
      screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')
    ).toBe(
      '/cloud/login?previousFullPath=/foo?x=1&switchAccount=1&oauth_request_id=abc'
    )
  })

  it('replaces the sign-up form with the region notice inside China', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    inChina.value = true
    await renderSignupView()

    await user.click(screen.getByRole('button', { name: 'Use email instead' }))

    await waitFor(() => {
      expect(
        screen.getByText('Email sign-up is unavailable in your region.')
      ).toBeInTheDocument()
    })
    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()
  })

  it('renders the sign-up form outside China', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    await renderSignupView()

    await user.click(screen.getByRole('button', { name: 'Use email instead' }))

    expect(screen.getByTestId('signup-form')).toBeInTheDocument()
    expect(
      screen.queryByText('Email sign-up is unavailable in your region.')
    ).not.toBeInTheDocument()
  })
})
