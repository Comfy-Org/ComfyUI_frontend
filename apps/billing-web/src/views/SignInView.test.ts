import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory } from 'vue-router'

import type { SessionErrorCode } from '@comfyorg/account-core/session'

import type { SignInState } from '@/auth/signInState'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'
import SignInView from '@/views/SignInView.vue'

const h = vi.hoisted(() => ({
  available: true,
  initialState: undefined as SignInState | undefined,
  sessionFailureCode: undefined as SessionErrorCode | undefined,
  signInWith: vi.fn(),
  submitEmail: vi.fn(),
  retryMint: vi.fn(),
  retryAvailability: vi.fn()
}))

vi.mock(import('@/auth/useSignInController'), async () => {
  const { computed, ref } = await import('vue')
  return {
    useSignInController: () => ({
      state: ref<SignInState>(h.initialState ?? { step: 'idle' }),
      busy: computed(() => false),
      leaving: computed(() => false),
      errorMessage: computed(() => ''),
      sessionFailureCode: computed(() => h.sessionFailureCode),
      available: computed(() => h.available),
      signInWith: h.signInWith,
      submitEmail: h.submitEmail,
      retryMint: h.retryMint,
      retryAvailability: h.retryAvailability
    })
  }
})

async function renderSignIn() {
  const router = createBillingRouter(createMemoryHistory(), () => 'signed-out')
  await router.push('/sign-in')
  await router.isReady()
  render(SignInView, {
    global: { plugins: [createBillingI18n(), router] }
  })
}

beforeEach(() => {
  h.available = true
  h.retryAvailability.mockClear()
  h.initialState = undefined
  h.sessionFailureCode = undefined
})

describe('SignInView', () => {
  it('hands the entered credentials to the controller once', async () => {
    await renderSignIn()

    await userEvent.click(
      screen.getByRole('button', { name: 'Use email instead' })
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'someone@comfy.org'
    )
    await userEvent.type(screen.getByLabelText('Password'), 'sup3r-secret!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(h.submitEmail).toHaveBeenCalledExactlyOnceWith({
      email: 'someone@comfy.org',
      password: 'sup3r-secret!'
    })
  })

  it('holds the form back until a malformed email is corrected', async () => {
    await renderSignIn()

    await userEvent.click(
      screen.getByRole('button', { name: 'Use email instead' })
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'not-an-email'
    )
    await userEvent.type(screen.getByLabelText('Password'), 'sup3r-secret!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email address')
    expect(h.submitEmail).not.toHaveBeenCalled()
  })

  it('offers no way in when the deployment has no identity configuration', async () => {
    h.available = false
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sign-in is unavailable'
    )
    expect(
      screen.getByRole('button', { name: 'Sign in with Google' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Sign in with GitHub' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Use email instead' })
    ).toBeDisabled()
  })

  it('offers a retry when sign-in is unavailable', async () => {
    h.available = false
    await renderSignIn()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(h.retryAvailability).toHaveBeenCalledOnce()
  })

  it('shows no retry button once sign-in is available', async () => {
    await renderSignIn()

    expect(
      screen.queryByRole('button', { name: 'Try again' })
    ).not.toBeInTheDocument()
  })

  it.for([
    {
      block: 'the email form',
      clicks: ['Use email instead'],
      focused: () => screen.getByRole('textbox', { name: 'Email' })
    },
    {
      block: 'the provider buttons',
      clicks: ['Use email instead', 'Sign in with Google or GitHub instead'],
      focused: () => screen.getByRole('button', { name: 'Sign in with Google' })
    }
  ])(
    'moves focus into $block when it swaps in',
    async ({ clicks, focused }) => {
      await renderSignIn()

      for (const name of clicks) {
        await userEvent.click(screen.getByRole('button', { name }))
      }

      expect(focused()).toHaveFocus()
    }
  )

  it('shows the generic retry prompt when the mint fails for no named reason', async () => {
    h.initialState = {
      step: 'signedIn',
      origin: 'interactive',
      mintFailed: true
    }
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You are signed in, but your workspace session could not be started'
    )
  })

  it.for([
    ['ACCESS_DENIED', "This account can't manage billing for that workspace."],
    [
      'WORKSPACE_NOT_FOUND',
      "This account can't access that workspace. Reopen billing from the app while signed in with the right account."
    ]
  ] as const)('names the workspace refusal for %s', async ([code, message]) => {
    h.initialState = {
      step: 'signedIn',
      origin: 'interactive',
      mintFailed: true
    }
    h.sessionFailureCode = code
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })

  it.for([
    'NOT_AUTHENTICATED',
    'INVALID_FIREBASE_TOKEN',
    'TOKEN_EXCHANGE_FAILED'
  ] as const)(
    'keeps the generic retry prompt for %s, not the catch-all "something went wrong"',
    async (code) => {
      h.initialState = {
        step: 'signedIn',
        origin: 'interactive',
        mintFailed: true
      }
      h.sessionFailureCode = code
      await renderSignIn()

      expect(screen.getByRole('alert')).toHaveTextContent(
        'You are signed in, but your workspace session could not be started'
      )
    }
  )

  it('offers no sign-in when the shared session holds but the workspace is refused (SO4)', async () => {
    h.available = false
    h.initialState = { step: 'signedIn', origin: 'restored', mintFailed: true }
    h.sessionFailureCode = 'ACCESS_DENIED'
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(
      "This account can't manage billing for that workspace."
    )
    expect(
      screen.queryByRole('button', { name: 'Sign in with Google' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Retry session' })
    ).toBeInTheDocument()
  })
})
