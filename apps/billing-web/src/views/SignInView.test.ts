import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory } from 'vue-router'

import type { SignInState } from '@/auth/signInState'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'
import SignInView from '@/views/SignInView.vue'

const h = vi.hoisted(() => ({
  available: true,
  signInWith: vi.fn(),
  submitEmail: vi.fn(),
  retryMint: vi.fn()
}))

vi.mock(import('@/auth/useSignInController'), async () => {
  const { computed, ref } = await import('vue')
  return {
    useSignInController: () => ({
      state: ref<SignInState>({ step: 'idle' }),
      busy: computed(() => false),
      leaving: computed(() => false),
      errorMessage: computed(() => ''),
      available: computed(() => h.available),
      signInWith: h.signInWith,
      submitEmail: h.submitEmail,
      retryMint: h.retryMint
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
})
