import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
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

const inChina = vi.hoisted(() => ({
  value: false,
  pending: null as Promise<boolean> | null,
  /** Holds detection in its pending state; returns the settle function. */
  defer(): (inChina: boolean) => void {
    let settle!: (inChina: boolean) => void
    this.pending = new Promise<boolean>((resolve) => {
      settle = resolve
    })
    return settle
  },
  /** Detection that never settles, as on a network that blackholes. */
  hang() {
    this.pending = new Promise<boolean>(() => {})
  },
  reject(error: Error) {
    this.pending = Promise.reject(error)
  }
}))
vi.mock('@/utils/networkUtil', () => ({
  isInChina: () => inChina.pending ?? Promise.resolve(inChina.value)
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
      signUpWithGoogle: 'Sign up with Google',
      signUpWithGithub: 'Sign up with GitHub',
      regionRestrictionChina: 'Email sign-up is unavailable in your region.'
    }
  }
}

async function renderSignupView(
  url = '/cloud/signup',
  messages: typeof MESSAGES = MESSAGES
) {
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
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ],
      stubs: { SignUpForm: { template: '<form data-testid="signup-form" />' } }
    }
  })
}

beforeEach(() => {
  inChina.value = false
  inChina.pending = null
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

    await waitFor(() => {
      expect(screen.getByTestId('signup-form')).toBeInTheDocument()
    })
    expect(
      screen.queryByText('Email sign-up is unavailable in your region.')
    ).not.toBeInTheDocument()
  })

  it('withholds the sign-up form while region detection is still pending', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const settle = inChina.defer()
    await renderSignupView()

    await user.click(screen.getByRole('button', { name: 'Use email instead' }))

    await waitFor(() => {
      expect(screen.getByTestId('region-check-pending')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()

    settle(false)

    await waitFor(() => {
      expect(screen.getByTestId('signup-form')).toBeInTheDocument()
    })
  })

  it('releases the sign-up form when region detection fails', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    inChina.reject(new Error('probe failed'))
    await renderSignupView()

    await user.click(screen.getByRole('button', { name: 'Use email instead' }))

    await waitFor(() => {
      expect(screen.getByTestId('signup-form')).toBeInTheDocument()
    })
  })

  it('keeps the form withheld however long detection takes', async () => {
    // Fake timers must predate mount, or a fallback scheduled during mount runs
    // on the real clock and escapes the drain below.
    vi.useFakeTimers()
    try {
      const user = (await import('@testing-library/user-event')).default.setup({
        advanceTimers: vi.advanceTimersByTime
      })
      inChina.hang()
      await renderSignupView()

      await user.click(
        screen.getByRole('button', { name: 'Use email instead' })
      )
      expect(screen.getByTestId('region-check-pending')).toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(60_000)

      expect(
        screen.queryByTestId('signup-form'),
        'a caller-side fallback deciding "not in China" on detection\'s behalf would resurrect the submit race this view exists to close'
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('region-check-pending')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('never renders the sign-up form inside China, pending or settled', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const settle = inChina.defer()
    await renderSignupView()

    await user.click(screen.getByRole('button', { name: 'Use email instead' }))

    await waitFor(() => {
      expect(screen.getByTestId('region-check-pending')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()

    settle(true)

    await waitFor(() => {
      expect(
        screen.getByText('Email sign-up is unavailable in your region.')
      ).toBeInTheDocument()
    })
    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()
  })

  it('returns to the social buttons with sign-up wording', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    await renderSignupView('/cloud/signup', enMessages)

    await user.click(screen.getByRole('button', { name: 'Use email instead' }))

    expect(
      screen.getByRole('button', {
        name: 'Sign up with Google or GitHub instead'
      })
    ).toBeInTheDocument()
  })

  it.for([
    ['pending', null],
    ['inside China', true],
    ['outside China', false]
  ] as const)('offers social sign-up %s', async ([, resolved]) => {
    if (resolved === null) {
      inChina.defer()
    } else {
      inChina.value = resolved
    }
    await renderSignupView()

    expect(
      screen.getByRole('button', { name: 'Sign up with Google' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sign up with GitHub' })
    ).toBeInTheDocument()
  })
})
