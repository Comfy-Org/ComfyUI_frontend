import { Form, FormField } from '@primevue/forms'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import Button from '@/components/ui/button/Button.vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

// The real widget loads an external Turnstile script; this stub exposes a
// spyable reset() and lets a test drive the token/unavailable v-models.
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
      Password
    }
  }
}

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockLoadingRef.value = false
    mockTurnstileEnabled.value = false
    mockTurnstileToken.value = ''
    mockTurnstileUnavailable.value = false
    emitTurnstileToken = undefined
    emitTurnstileUnavailable = undefined
  })

  function renderComponent(props: Record<string, unknown> = {}) {
    const user = userEvent.setup()
    const utils = render(SignUpForm, { global: globalOptions(), props })
    return { ...utils, user }
  }

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

  it('hides password requirements when the field loses focus', async () => {
    const { user } = renderComponent()
    const passwordInput = screen.getByLabelText(
      enMessages.auth.signup.passwordLabel
    )
    const confirmPasswordInput = screen.getByLabelText(
      enMessages.auth.login.confirmPasswordLabel
    )
    const requirementsText = `${enMessages.validation.password.requirements}:`

    expect(screen.queryByText(requirementsText)).not.toBeInTheDocument()

    await user.type(passwordInput, 'short')
    const requirements = screen.getByText(requirementsText)
    expect(requirements).toBeInTheDocument()

    await user.tab()

    expect(confirmPasswordInput).toHaveFocus()
    expect(requirements).not.toBeInTheDocument()
  })

  describe('submit while loading', () => {
    const submitButton = () =>
      screen.getByRole('button', { name: signUpButton })

    it('keeps its accessible name and disables while loading', async () => {
      mockLoadingRef.value = true
      renderComponent()
      await nextTick()

      expect(submitButton()).toBeDisabled()
      expect(submitButton()).toHaveAttribute('aria-busy', 'true')
    })

    it('does not emit submit when clicked', async () => {
      mockLoadingRef.value = true
      const { user, emitted } = renderComponent()
      await nextTick()

      await user.click(submitButton())

      expect(emitted().submit).toBeUndefined()
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

      expect(
        onSubmit,
        'gating on enabled (not enforce) is what stops a shadow-mode signup racing ahead with an empty token'
      ).not.toHaveBeenCalled()
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

  describe('Turnstile wait hint accessibility', () => {
    it('announces the wait politely while the challenge is pending', async () => {
      mockTurnstileEnabled.value = true
      renderComponent()
      await nextTick()

      const hint = screen.getByRole('status')
      expect(
        hint,
        'the hint is the only thing telling a screen-reader user why submit is unavailable'
      ).toHaveTextContent(enMessages.auth.turnstile.submitBlockedHint)
      expect(hint).toHaveAttribute('aria-live', 'polite')
    })

    it('points the disabled submit button at the hint', async () => {
      mockTurnstileEnabled.value = true
      const { user } = renderComponent()
      await fillValidSignup(user)
      await nextTick()

      const submit = screen.getByRole('button', { name: signUpButton })
      expect(
        submit,
        'an otherwise-valid form must stay disabled while the challenge is pending'
      ).toBeDisabled()
      expect(submit).toHaveAttribute(
        'aria-describedby',
        screen.getByRole('status').id
      )
    })

    it('drops the description once the challenge resolves', async () => {
      mockTurnstileEnabled.value = true
      renderComponent()
      await nextTick()

      emitTurnstileToken!('token-xyz')
      await nextTick()

      expect(
        screen.getByRole('button', { name: signUpButton })
      ).not.toHaveAttribute('aria-describedby')
    })
  })

  describe('double-submit throttling', () => {
    it('emits once when the button is clicked twice in quick succession', async () => {
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })
      await fillValidSignup(user)
      const submit = screen.getByRole('button', { name: signUpButton })

      await user.click(submit)
      await user.click(submit)

      expect(
        onSubmit,
        'an impatient double-click would otherwise create the account twice'
      ).toHaveBeenCalledOnce()
    })
  })
})
