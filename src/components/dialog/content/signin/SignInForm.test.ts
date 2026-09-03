import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import SignInForm from './SignInForm.vue'

// Mock firebase auth modules
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
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn()
}))

// Mock the auth composables and stores
const mockSendPasswordReset = vi.fn()
vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: vi.fn(() => ({
    sendPasswordReset: mockSendPasswordReset
  }))
}))

const mockLoadingRef = ref(false)
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    get loading() {
      return mockLoadingRef.value
    }
  }))
}))

// Mock toast
const mockToastAdd = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: vi.fn(() => ({
    success: (...args: unknown[]) => mockToastAdd('success', ...args),
    error: (...args: unknown[]) => mockToastAdd('error', ...args),
    info: (...args: unknown[]) => mockToastAdd('info', ...args),
    warning: (...args: unknown[]) => mockToastAdd('warning', ...args),
    loading: (...args: unknown[]) => mockToastAdd('loading', ...args),
    custom: (...args: unknown[]) => mockToastAdd('custom', ...args)
  }))
}))

const forgotPasswordText = enMessages.auth.login.forgotPassword
const loginButtonText = enMessages.auth.login.loginButton

describe('SignInForm', () => {
  beforeEach(() => {
    mockLoadingRef.value = false
  })

  function renderComponent(props: Record<string, unknown> = {}) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    const user = userEvent.setup()
    const result = render(SignInForm, {
      global: {
        plugins: [i18n]
      },
      props
    })
    return { ...result, user }
  }

  function getEmailInput() {
    return screen.getByPlaceholderText(enMessages.auth.login.emailPlaceholder)
  }

  function getPasswordInput() {
    return screen.getByPlaceholderText(
      enMessages.auth.login.passwordPlaceholder
    )
  }

  describe('Forgot Password Link', () => {
    it('shows toast and focuses email input when clicked while disabled', async () => {
      const { user } = renderComponent()

      const emailInput = getEmailInput()
      const focusSpy = vi.spyOn(emailInput, 'focus')

      await user.click(screen.getByText(forgotPasswordText))

      expect(mockToastAdd).toHaveBeenCalledWith(
        'warning',
        enMessages.auth.login.emailPlaceholder,
        { duration: 5000 }
      )

      expect(focusSpy).toHaveBeenCalled()

      expect(mockSendPasswordReset).not.toHaveBeenCalled()
    })
  })

  describe('Form Submission', () => {
    it('disables submit for invalid input and re-enables it after correction', async () => {
      const { user } = renderComponent()
      const submit = screen.getByRole('button', { name: loginButtonText })

      expect(submit).toBeEnabled()

      await user.type(getEmailInput(), 'invalid-email')
      expect(submit).toBeDisabled()

      await user.clear(getEmailInput())
      await user.type(getEmailInput(), 'test@example.com')
      expect(submit).toBeEnabled()
    })

    it('emits submit event when form is submitted with valid data', async () => {
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })

      await user.type(getEmailInput(), 'test@example.com')
      await user.type(getPasswordInput(), 'password123')
      await user.click(screen.getByRole('button', { name: loginButtonText }))

      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      })
    })

    it('does not emit submit event when form data is invalid', async () => {
      const onSubmit = vi.fn()
      const { user } = renderComponent({ onSubmit })

      await user.type(getEmailInput(), 'invalid-email')
      await user.type(getPasswordInput(), 'password123')
      await user.click(screen.getByRole('button', { name: loginButtonText }))

      expect(onSubmit).not.toHaveBeenCalled()
      expect(
        screen.getByText(enMessages.validation.invalidEmail)
      ).toBeInTheDocument()
      expect(getEmailInput()).toHaveAccessibleDescription(
        enMessages.validation.invalidEmail
      )
    })
  })

  describe('Loading State', () => {
    it('shows spinner when loading', () => {
      mockLoadingRef.value = true
      renderComponent()

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: loginButtonText })
      ).not.toBeInTheDocument()
    })

    it('shows button when not loading', () => {
      renderComponent()

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: loginButtonText })
      ).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('renders email input with correct attributes', () => {
      renderComponent()

      const emailInput = getEmailInput()
      expect(emailInput).toHaveAttribute('id', 'comfy-org-sign-in-email')
      expect(emailInput).toHaveAttribute('autocomplete', 'email')
      expect(emailInput).toHaveAttribute('name', 'email')
      expect(emailInput).toHaveAttribute('type', 'text')
    })

    it('renders password input with correct attributes', () => {
      renderComponent()

      const passwordInput = getPasswordInput()
      expect(passwordInput).toHaveAttribute('id', 'comfy-org-sign-in-password')
      expect(passwordInput).toHaveAttribute('name', 'password')
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('toggles password visibility', async () => {
      const { user } = renderComponent()

      await user.click(
        screen.getByRole('button', { name: enMessages.auth.showPassword })
      )

      expect(getPasswordInput()).toHaveAttribute('type', 'text')
      expect(
        screen.getByRole('button', { name: enMessages.auth.hidePassword })
      ).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Forgot Password with valid email', () => {
    it('calls sendPasswordReset when email is valid', async () => {
      const { user } = renderComponent()

      await user.type(getEmailInput(), 'test@example.com')
      await user.click(screen.getByText(forgotPasswordText))

      expect(mockSendPasswordReset).toHaveBeenCalledWith('test@example.com')
      expect(mockToastAdd).not.toHaveBeenCalled()
    })
  })
})
