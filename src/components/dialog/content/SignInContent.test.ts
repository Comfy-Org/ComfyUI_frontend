import { render, screen, waitFor } from '@testing-library/vue'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SignInContent from '@/components/dialog/content/SignInContent.vue'

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    signInWithGoogle: vi.fn(),
    signInWithGithub: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    accessError: ref(false)
  })
}))

vi.mock('@/base/webviewDetection', () => ({ isEmbeddedWebView: () => false }))
vi.mock('@/utils/hostWhitelist', () => ({
  isHostWhitelisted: () => true,
  normalizeHost: (host: string) => host
}))
vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: ref({}),
  configValueOrDefault: (_config: unknown, _key: string, fallback: string) =>
    fallback
}))

const inChina = vi.hoisted(() => ({
  value: false,
  pending: null as Promise<boolean> | null,
  /** Detection that never settles, as on a network that blackholes. */
  hang() {
    this.pending = new Promise<boolean>(() => {})
  },
  /** Holds detection pending; returns the settle function. */
  defer(): (inChina: boolean) => void {
    let settle!: (inChina: boolean) => void
    this.pending = new Promise<boolean>((resolve) => {
      settle = resolve
    })
    return settle
  },
  reject(error: Error) {
    this.pending = Promise.reject(error)
  }
}))
vi.mock('@/utils/networkUtil', () => ({
  isInChina: () => inChina.pending ?? Promise.resolve(inChina.value)
}))

const MESSAGES = {
  auth: {
    login: {
      title: 'Sign in',
      newUser: 'New user?',
      signUp: 'Sign up',
      orContinueWith: 'or continue with',
      loginWithGoogle: 'Sign in with Google',
      loginWithGithub: 'Sign in with GitHub',
      useApiKey: 'Use API key',
      termsText: 'Terms',
      termsLink: 'Terms of Service',
      andText: 'and',
      privacyLink: 'Privacy Policy',
      questionsContactPrefix: 'Questions?',
      insecureContextWarning: 'Insecure context'
    },
    signup: {
      title: 'Sign up',
      alreadyHaveAccount: 'Already have an account?',
      signIn: 'Sign in',
      signUpWithGoogle: 'Sign up with Google',
      signUpWithGithub: 'Sign up with GitHub',
      regionRestrictionChina: 'Email sign-up is unavailable in your region.'
    },
    apiKey: { helpText: 'Help', generateKey: 'Generate key' },
    reauthRequired: { title: 'Reauth', message: 'Reauth' }
  },
  g: { comfy: 'Comfy' },
  toastMessages: { useApiKeyTip: 'Tip' }
}

function renderSignInContent() {
  return render(SignInContent, {
    props: { onSuccess: vi.fn() },
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: MESSAGES } })
      ],
      stubs: {
        SignUpForm: { template: '<form data-testid="signup-form" />' },
        SignInForm: { template: '<form data-testid="signin-form" />' },
        ApiKeyForm: true,
        Divider: true,
        Message: { template: '<div><slot /></div>' }
      }
    }
  })
}

async function switchToSignUp(advanceTimers?: (ms: number) => void) {
  const user = (await import('@testing-library/user-event')).default.setup(
    advanceTimers ? { advanceTimers } : {}
  )
  await user.click(screen.getByText('Sign up'))
}

beforeEach(() => {
  inChina.value = false
  inChina.pending = null
})

describe('SignInContent', () => {
  it('links legal terms directly to canonical Comfy pages', () => {
    renderSignInContent()

    expect(
      screen.getByRole('link', { name: 'Terms of Service' })
    ).toHaveAttribute('href', 'https://comfy.org/terms-of-service/')
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' })
    ).toHaveAttribute('href', 'https://comfy.org/privacy-policy/')
  })

  it('withholds the sign-up form while region detection is pending', async () => {
    const settle = inChina.defer()
    renderSignInContent()
    await switchToSignUp()

    expect(screen.getByTestId('region-check-pending')).toBeInTheDocument()
    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Sign up with Google/ }),
      'only email sign-up is gated on region; third-party auth never waits on the probe'
    ).toBeInTheDocument()

    settle(false)

    await waitFor(() => {
      expect(screen.getByTestId('signup-form')).toBeInTheDocument()
    })
  })

  it('never renders the sign-up form inside China, pending or settled', async () => {
    const settle = inChina.defer()
    renderSignInContent()
    await switchToSignUp()

    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()

    settle(true)

    await waitFor(() => {
      expect(
        screen.getByText('Email sign-up is unavailable in your region.')
      ).toBeInTheDocument()
    })
    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()
  })

  it('renders the sign-up form outside China', async () => {
    renderSignInContent()
    await switchToSignUp()

    await waitFor(() => {
      expect(screen.getByTestId('signup-form')).toBeInTheDocument()
    })
    expect(
      screen.queryByText('Email sign-up is unavailable in your region.')
    ).not.toBeInTheDocument()
  })

  it('releases the sign-up form when region detection fails', async () => {
    inChina.reject(new Error('probe failed'))
    renderSignInContent()
    await switchToSignUp()

    await waitFor(() => {
      expect(screen.getByTestId('signup-form')).toBeInTheDocument()
    })
  })

  it('keeps the form withheld however long detection takes', async () => {
    // Fake timers must predate mount, or a fallback scheduled during mount runs
    // on the real clock and escapes the drain below.
    vi.useFakeTimers()
    try {
      inChina.hang()
      renderSignInContent()
      await switchToSignUp(vi.advanceTimersByTime)

      expect(screen.getByTestId('region-check-pending')).toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(60_000)

      expect(
        screen.queryByTestId('signup-form'),
        "no caller-side fallback may release the form on detection's behalf"
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('region-check-pending')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves sign-in ungated by region', async () => {
    inChina.value = true
    renderSignInContent()

    await waitFor(() => {
      expect(screen.getByTestId('signin-form')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('region-check-pending')).not.toBeInTheDocument()
  })

  it('offers social sign-up inside China', async () => {
    inChina.value = true
    renderSignInContent()
    await switchToSignUp()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Sign up with Google/ })
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /Sign up with GitHub/ })
    ).toBeInTheDocument()
  })
})
