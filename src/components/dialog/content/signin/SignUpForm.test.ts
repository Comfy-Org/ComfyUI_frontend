import { Form, FormField } from '@primevue/forms'
import { render, screen } from '@testing-library/vue'
import Button from '@/components/ui/button/Button.vue'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import ProgressSpinner from 'primevue/progressspinner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
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
const mockTurnstileEnforced = ref(false)
const mockReset = vi.fn()

vi.mock('@/composables/auth/useTurnstile', () => ({
  useTurnstile: () => ({
    enabled: mockTurnstileEnabled,
    enforced: mockTurnstileEnforced
  })
}))

// Stub the real widget (which loads the external Turnstile script) with a
// component that exposes a spyable reset() so we can assert SignUpForm wires it.
vi.mock('./TurnstileWidget.vue', async () => {
  const { defineComponent } = await import('vue')
  return {
    default: defineComponent({
      name: 'TurnstileWidget',
      setup(_, { expose }) {
        expose({ reset: mockReset })
        return () => null
      }
    })
  }
})

describe('SignUpForm', () => {
  beforeEach(() => {
    mockLoadingRef.value = false
    mockTurnstileEnabled.value = false
    mockTurnstileEnforced.value = false
    mockReset.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderComponent() {
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
        }
      }
    })
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
    it('resets the widget when loading returns to false (failed submit)', async () => {
      mockTurnstileEnabled.value = true
      renderComponent()
      await nextTick()

      // Simulate a submit that started (loading=true) then failed without
      // navigating away (loading=false). The spent token must be reset.
      mockLoadingRef.value = true
      await nextTick()
      mockLoadingRef.value = false
      await nextTick()

      expect(mockReset).toHaveBeenCalledOnce()
    })

    it('does not reset the widget on the initial render', async () => {
      mockTurnstileEnabled.value = true
      renderComponent()
      await nextTick()

      expect(mockReset).not.toHaveBeenCalled()
    })
  })
})
