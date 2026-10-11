import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import CloudSignupView from '@/platform/cloud/onboarding/CloudSignupView.vue'

vi.mock(import('@/composables/auth/useAuthActions'))
vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(
  import('@/platform/cloud/onboarding/composables/usePostAuthRedirect'),
  () => ({
    usePostAuthRedirect: () => ({ onAuthSuccess: vi.fn() })
  })
)

vi.mock(import('@comfyorg/account-core/webviewDetection'), () => ({
  isEmbeddedWebView: () => false
}))
vi.mock(import('@/platform/telemetry'))

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
vi.mock(import('@comfyorg/account-ui/auth/regionProbe'), () => ({
  isInChina: () => inChina.pending ?? Promise.resolve(inChina.value)
}))

const freeTier = vi.hoisted(() => ({ value: false }))
vi.mock<unknown>(
  import('@/platform/cloud/onboarding/composables/useFreeTierOnboarding'),
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

const SignUpFormStub = defineComponent({
  emits: ['submit'],
  setup: () => ({ email: ref(''), resetTurnstile: () => undefined }),
  template: `
    <form data-testid="signup-form" @submit.prevent="$emit('submit', { email, password: 'hunter22' }, 'turnstile-token')">
      <input v-model="email" aria-label="Sign-up email" />
      <button type="submit">Create account</button>
    </form>`
})

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
      stubs: { SignUpForm: SignUpFormStub }
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

describe('CloudSignupView SSO', () => {
  let assign: Mock<(url: string | URL) => void>

  beforeEach(() => {
    assign = vi.fn<(url: string | URL) => void>()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
  })

  const discoverReplies = (body: unknown, status = 200) =>
    respondToFetch('/api/auth/sso/discover', () =>
      Response.json(body, { status })
    )

  async function signUpWithEmail(email: string) {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Use email instead' }))
    await user.type(await screen.findByLabelText('Sign-up email'), email)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
  }

  it('signs up with Firebase without asking ingest when the flag is off', async () => {
    discoverReplies({ sso: true })
    await renderSignupView()

    await signUpWithEmail('ada@acme.com')

    await waitFor(() =>
      expect(useAuthActions().signUpWithEmail).toHaveBeenCalledWith(
        'ada@acme.com',
        'hunter22',
        'turnstile-token'
      )
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  it('sends an SSO email to SSO instead of creating a Firebase account', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true
    discoverReplies({ sso: true })
    await renderSignupView()

    await signUpWithEmail('ada@acme.com')

    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    const start = new URL(String(assign.mock.calls[0][0]))
    expect(start.pathname).toBe('/api/auth/sso/start')
    expect(start.searchParams.get('email')).toBe('ada@acme.com')
    expect(useAuthActions().signUpWithEmail).not.toHaveBeenCalled()
  })

  it('signs up with Firebase when SSO discovery is down', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true
    discoverReplies({ code: 'INTERNAL_ERROR', message: 'down' }, 500)
    await renderSignupView()

    await signUpWithEmail('ada@example.com')

    await waitFor(() =>
      expect(useAuthActions().signUpWithEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'hunter22',
        'turnstile-token'
      )
    )
    expect(fetch).toHaveBeenCalledOnce()
    expect(assign).not.toHaveBeenCalled()
  })
})
