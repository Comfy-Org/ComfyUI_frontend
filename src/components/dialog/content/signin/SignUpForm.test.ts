import { Form, FormField } from '@primevue/forms'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import Button from '@/components/ui/button/Button.vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import PrimeVue from 'primevue/config'
import ProgressSpinner from 'primevue/progressspinner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import SignUpForm from './SignUpForm.vue'

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn()
}))

const mockLoadingRef = ref(false)
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    get loading() {
      return mockLoadingRef.value
    }
  }))
}))

const mockTurnstileEnabled = ref(false)
const mockTurnstileToken = ref('')
const mockTurnstileUnavailable = ref(false)
const mockReset = vi.fn()
let emitTurnstileToken: ((token: string) => void) | undefined
let emitTurnstileUnavailable: ((unavailable: boolean) => void) | undefined

// The reset-on-toggle behavior lives in useTurnstileGate itself (see
// useTurnstile.test.ts); this fake just wires token/unavailable through to
// `waiting` the same way so SignUpForm's submit gating can be exercised.
vi.mock('@/composables/auth/useTurnstile', () => ({
  useTurnstile: () => ({
    enabled: mockTurnstileEnabled
  }),
  useTurnstileGate: () => ({
    token: mockTurnstileToken,
    unavailable: mockTurnstileUnavailable,
    waiting: computed(
      () =>
        mockTurnstileEnabled.value &&
        !mockTurnstileToken.value &&
        !mockTurnstileUnavailable.value
    )
  })
}))

// Stub the real widget (which loads the external Turnstile script) with one that
// exposes a spyable reset() and lets a test drive the v-model token/unavailable
// the way a solved challenge (or a broken/slow widget) would.
vi.mock('./TurnstileWidget.vue', async () => {
  const { defineComponent: defineMock } = await import('vue')
  return {
    default: defineMock({
      name: 'TurnstileWidget',
      emits: ['update:token', 'update:unavailable'],
      setup(_, { expose, emit }) {
        expose({ reset: mockReset })
        emitTurnstileToken = (token: string) => emit('update:token', token)
        emitTurnstileUnavailable = (unavailable: boolean) =>
          emit('update:unavailable', unavailable)
        return () => null
      }
    })
  }
})

const signUpButton = enMessages.auth.signup.signUpButton

function globalOptions() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return {
    plugins: [PrimeVue, i18n],
    components: {
      Form,
      FormField,
      Button,
      InputText,
      Password,
      ProgressSpinner
    }
  }
}

describe('SignUpForm', () => {
  beforeEach(() => {
    mockLoadingRef.value = false
    mockTurnstileEnabled.value = false
    mockTurnstileToken.value = ''
    mockTurnstileUnavailable.value = false
    mockReset.mockClear()
    emitTurnstileToken = undefined
    emitTurnstileUnavailable = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderComponent(props: Record<string, unknown> = {}) {
    const user = userEvent.setup()
    const utils = render(SignUpForm, { global: globalOptions(), props })
    return { ...utils, user }
  }

  /** Render through a host that keeps a ref, so the parent-facing exposed
   * `resetTurnstile()` can be invoked the way SignInContent would. */
  function renderWithRef() {
    const formRef = ref<{ resetTurnstile: () => void } | null>(null)
    const Host = defineComponent({
      setup() {
        return () => h(SignUpForm, { ref: formRef })
      }
    })
    const utils = render(Host, { global: globalOptions() })
    return {
      ...utils,
      form: () => {
        if (!formRef.value) throw new Error('form not mounted')
        return formRef.value
      }
    }
  }

  const expectedValues = {
    email: 'new@example.com',
    password: 'Password1!',
    confirmPassword: 'Password1!'
  }

  async function fillValidSignup(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
      screen.getByPlaceholderText(enMessages.auth.signup.emailPlaceholder),
      expectedValues.email
    )
    await user.type(
      screen.getByPlaceholderText(enMessages.auth.signup.passwordPlaceholder),
      expectedValues.password
    )
    await user.type(
      screen.getByPlaceholderText(
        enMessages.auth.login.confirmPasswordPlaceholder
      ),
      expectedValues.confirmPassword
    )
  }

  describe('Password manager autofill attributes', () => {
    it('renders email input with attributes Chrome needs to recognize the field', () => {
      renderComponent()

      const emailInput = screen.getByPlaceholderText(
        enMessages.auth.signup.emailPlaceholder
      )
      expect(emailInput).toHaveAttribute('id', 'comfy-org-sign-up-email')
      expect(emailInput).toHaveAttribute('name', 'email')
      expect(emailInput).toHaveAttribute('autocomplete', 'email')
      expect(emailInput).toHaveAttribute('type', 'email')
    })

    it('renders password input with new-password autofill attributes', () => {
      renderComponent()

      const passwordInput = screen.getByPlaceholderText(
        enMessages.auth.signup.passwordPlaceholder
      )
      expect(passwordInput).toHaveAttribute('id', 'comfy-org-sign-up-password')
      expect(passwordInput).toHaveAttribute('name', 'password')
      expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')
    })

    it('renders confirm-password input with distinct name and new-password autocomplete', () => {
      renderComponent()

      const confirmPasswordInput = screen.getByPlaceholderText(
        enMessages.auth.login.confirmPasswordPlaceholder
      )
      expect(confirmPasswordInput).toHaveAttribute(
        'id',
        'comfy-org-sign-up-confirm-password'
      )
      expect(confirmPasswordInput).toHaveAttribute('name', 'confirmPassword')
      expect(confirmPasswordInput).toHaveAttribute(
        'autocomplete',
        'new-password'
      )
    })
  })

  describe('Turnstile single-use token reset', () => {
    it('exposes resetTurnstile() that resets the rendered widget', async () => {
      mockTurnstileEnabled.value = true
      const { form } = renderWithRef()
      await nextTick()

      form().resetTurnstile()

      expect(mockReset).toHaveBeenCalledOnce()
    })

    it('does not reset the widget on the initial render', async () => {
      mockTurnstileEnabled.value = true
      renderWithRef()
      await nextTick()

      expect(mockReset).not.toHaveBeenCalled()
    })
  })

  // Regression coverage for the shadow-mode race: previously submit was only
  // gated in 'enforce' mode, so most real signups in 'shadow' mode raced
  // ahead of the async Cloudflare challenge and reached the backend with an
  // empty token. Gating now depends only on whether the widget is enabled
  // (shadow or enforce both render it), so both modes behave identically here.
  describe('Turnstile submit gating', () => {
    it('disables the submit button until a token is present', async () => {
      mockTurnstileEnabled.value = true
      renderComponent()
      await nextTick()

      expect(screen.getByRole('button', { name: signUpButton })).toBeDisabled()
    })

    it('does not emit submit while the token is empty', async () => {
      mockTurnstileEnabled.value = true
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })
      await fillValidSignup(user)

      await user.click(screen.getByRole('button', { name: signUpButton }))

      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('emits submit with the token once the challenge is solved', async () => {
      mockTurnstileEnabled.value = true
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })
      await fillValidSignup(user)

      emitTurnstileToken!('token-xyz')
      await nextTick()
      await user.click(screen.getByRole('button', { name: signUpButton }))

      expect(onSubmit).toHaveBeenCalledWith(expectedValues, 'token-xyz')
    })

    it('emits submit without a token once the widget reports itself unavailable (broken/slow load fallback)', async () => {
      mockTurnstileEnabled.value = true
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })
      await fillValidSignup(user)

      emitTurnstileUnavailable!(true)
      await nextTick()
      await user.click(screen.getByRole('button', { name: signUpButton }))

      expect(onSubmit).toHaveBeenCalledWith(expectedValues, undefined)
    })
  })
})
