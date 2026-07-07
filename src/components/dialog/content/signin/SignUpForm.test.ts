import { Form, FormField } from '@primevue/forms'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import PrimeVue from 'primevue/config'
import ProgressSpinner from 'primevue/progressspinner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { SignUpData } from '@/schemas/signInSchema'

import SignUpForm from './SignUpForm.vue'

// Minimal stand-in for @primevue/forms `Form` that lets a test drive the
// component's `@submit` handler directly, without depending on async zod
// resolution or on the submit button (which the template hides while loading).
// It renders the real slot content (so inputs still render) plus a test-only
// trigger that always exists and emits a valid FormSubmitEvent on click, so we
// can fire a submit even while `loading` hides the real button.
const VALID_SIGNUP_VALUES: SignUpData = {
  email: 'new-user@example.com',
  password: 'ValidPass1!',
  confirmPassword: 'ValidPass1!'
}
const FORM_SUBMIT_TRIGGER = 'form-stub-submit'
const FormStub = defineComponent({
  name: 'Form',
  emits: ['submit'],
  setup(_props, { slots, emit }) {
    return () =>
      h('form', { 'data-testid': 'form-stub' }, [
        // The real Form exposes a `$form` slot prop; a valid one renders the
        // submit button enabled.
        slots.default?.({ valid: true }),
        h('button', {
          type: 'button',
          'data-testid': FORM_SUBMIT_TRIGGER,
          onClick: () =>
            emit('submit', { valid: true, values: VALID_SIGNUP_VALUES })
        })
      ])
  }
})

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
const mockTurnstileEnforced = ref(false)
const mockReset = vi.fn()
let emitTurnstileToken: ((token: string) => void) | undefined

vi.mock('@/composables/auth/useTurnstile', () => ({
  useTurnstile: () => ({
    enabled: mockTurnstileEnabled,
    enforced: mockTurnstileEnforced
  })
}))

// Stub the real widget (which loads the external Turnstile script) with one that
// exposes a spyable reset() and lets a test drive the v-model token the way a
// solved challenge would.
vi.mock('./TurnstileWidget.vue', async () => {
  const { defineComponent: defineMock } = await import('vue')
  return {
    default: defineMock({
      name: 'TurnstileWidget',
      emits: ['update:token'],
      setup(_, { expose, emit }) {
        expose({ reset: mockReset })
        emitTurnstileToken = (token: string) => emit('update:token', token)
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
    mockTurnstileEnforced.value = false
    mockReset.mockClear()
    emitTurnstileToken = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderComponent(
    props: Record<string, unknown> = {},
    options: { stubForm?: boolean } = {}
  ) {
    const user = userEvent.setup()
    const utils = render(SignUpForm, {
      global: {
        ...globalOptions(),
        // Replace the real Form with a stub so a test can drive @submit directly.
        stubs: options.stubForm ? { Form: FormStub } : {}
      },
      props
    })
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

  // The stubbed Form's test-only trigger; clicking it fires the component's
  // @submit handler with a valid FormSubmitEvent (see FormStub).
  function getSubmitTrigger() {
    return screen.getByTestId(FORM_SUBMIT_TRIGGER)
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

  describe('submit guarding', () => {
    it('emits submit only once for a rapid double-submit (leading-edge throttle)', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderComponent({ onSubmit }, { stubForm: true })

      const trigger = getSubmitTrigger()

      // Two valid submits within the 1500ms window: useThrottleFn(fn, 1500, false)
      // is leading-edge only (trailing: false), so the second must be dropped.
      await user.click(trigger)
      await user.click(trigger)

      expect(onSubmit).toHaveBeenCalledTimes(1)
      // onSubmit now emits (values, turnstileToken); the token is undefined here.
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new-user@example.com' }),
        undefined
      )
    })

    it('emits nothing when a valid submit fires while loading', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderComponent({ onSubmit }, { stubForm: true })

      // A signup request is already in flight. Even though the FormSubmitEvent is
      // valid, the `if (loading.value) return` guard in onSubmit must swallow it.
      mockLoadingRef.value = true
      await user.click(getSubmitTrigger())

      expect(onSubmit).not.toHaveBeenCalled()
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

  describe('Turnstile token hygiene', () => {
    it('clears the stale token when Turnstile becomes disabled', async () => {
      mockTurnstileEnabled.value = true
      mockTurnstileEnforced.value = true
      const { user } = renderComponent()
      await fillValidSignup(user)

      emitTurnstileToken!('stale-token')
      await nextTick()
      expect(
        screen.getByRole('button', { name: signUpButton })
      ).not.toBeDisabled()

      mockTurnstileEnabled.value = false
      await nextTick()

      // re-enable: the stale token must have been cleared so submit is blocked again
      mockTurnstileEnabled.value = true
      await nextTick()

      expect(screen.getByRole('button', { name: signUpButton })).toBeDisabled()
    })
  })

  describe('Turnstile submit gating', () => {
    it('disables the submit button in enforce mode until a token is present', async () => {
      mockTurnstileEnabled.value = true
      mockTurnstileEnforced.value = true
      renderComponent()
      await nextTick()

      expect(screen.getByRole('button', { name: signUpButton })).toBeDisabled()
    })

    it('does not emit submit in enforce mode while the token is empty', async () => {
      mockTurnstileEnabled.value = true
      mockTurnstileEnforced.value = true
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })
      await fillValidSignup(user)

      await user.click(screen.getByRole('button', { name: signUpButton }))

      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('emits submit with the token in enforce mode once the challenge is solved', async () => {
      mockTurnstileEnabled.value = true
      mockTurnstileEnforced.value = true
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })
      await fillValidSignup(user)

      emitTurnstileToken!('token-xyz')
      await nextTick()
      await user.click(screen.getByRole('button', { name: signUpButton }))

      expect(onSubmit).toHaveBeenCalledWith(expectedValues, 'token-xyz')
    })

    it('emits submit without a token in shadow mode (never blocks)', async () => {
      mockTurnstileEnabled.value = true
      mockTurnstileEnforced.value = false
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })
      await fillValidSignup(user)

      await user.click(screen.getByRole('button', { name: signUpButton }))

      expect(onSubmit).toHaveBeenCalledWith(expectedValues, undefined)
    })
  })
})
