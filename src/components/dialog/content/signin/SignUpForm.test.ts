import { Form, FormField } from '@primevue/forms'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import Button from '@/components/ui/button/Button.vue'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import ProgressSpinner from 'primevue/progressspinner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

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

describe('SignUpForm', () => {
  beforeEach(() => {
    mockLoadingRef.value = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderComponent(
    props: Record<string, unknown> = {},
    options: { stubForm?: boolean } = {}
  ) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    return render(SignUpForm, {
      global: {
        plugins: [PrimeVue, i18n],
        components: {
          Form,
          FormField,
          Button,
          InputText,
          Password,
          ProgressSpinner
        },
        // Replace the real Form with a stub so a test can drive @submit directly.
        stubs: options.stubForm ? { Form: FormStub } : {}
      },
      props
    })
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
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new-user@example.com' })
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
})
