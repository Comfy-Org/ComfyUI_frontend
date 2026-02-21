import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import ProgressSpinner from 'primevue/progressspinner'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import SignInForm from './SignInForm.vue'

type ComponentInstance = InstanceType<typeof SignInForm>

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
vi.mock('@/composables/auth/useFirebaseAuthActions', () => ({
  useFirebaseAuthActions: vi.fn(() => ({
    sendPasswordReset: mockSendPasswordReset
  }))
}))

let mockLoading = false
vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({
    get loading() {
      return mockLoading
    }
  }))
}))

// Mock toast
const mockToastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: mockToastAdd
  }))
}))

describe('SignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendPasswordReset.mockReset()
    mockToastAdd.mockReset()
    mockLoading = false
  })

  const mountComponent = (
    props = {},
    options = {}
  ): VueWrapper<ComponentInstance> => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return mount(SignInForm, {
      global: {
        plugins: [PrimeVue, i18n, ToastService]
      },
      props,
      ...options
    })
  }

  describe('Forgot Password Link', () => {
    function findForgotPasswordButton(wrapper: VueWrapper<ComponentInstance>) {
      return wrapper
        .findAll('button[type="button"]')
        .find((btn) =>
          btn.text().includes(enMessages.auth.login.forgotPassword)
        )!
    }

    it('shows disabled style when email is empty', async () => {
      const wrapper = mountComponent()
      await nextTick()

      const forgotBtn = findForgotPasswordButton(wrapper)
      expect(forgotBtn.classes()).toContain('text-link-disabled')
    })

    it('shows toast and focuses email input when clicked while disabled', async () => {
      const wrapper = mountComponent()
      const forgotBtn = findForgotPasswordButton(wrapper)

      const mockFocus = vi.fn()
      const mockElement: Partial<HTMLElement> = { focus: mockFocus }
      vi.spyOn(document, 'getElementById').mockReturnValue(
        mockElement as HTMLElement
      )

      await forgotBtn.trigger('click')
      await nextTick()

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'warn',
        summary: enMessages.auth.login.emailPlaceholder,
        life: 5000
      })

      expect(document.getElementById).toHaveBeenCalledWith(
        'comfy-org-sign-in-email'
      )
      expect(mockFocus).toHaveBeenCalled()
      expect(mockSendPasswordReset).not.toHaveBeenCalled()
    })

    it('sends reset email when link is clicked with a valid email', async () => {
      const wrapper = mountComponent()
      await wrapper
        .find('#comfy-org-sign-in-email')
        .setValue('test@example.com')

      const forgotBtn = findForgotPasswordButton(wrapper)
      await forgotBtn.trigger('click')
      expect(mockSendPasswordReset).toHaveBeenCalledWith('test@example.com')
    })
  })

  describe('Form Submission', () => {
    it('does not emit submit event when form is invalid', async () => {
      const wrapper = mountComponent()
      await wrapper.find('form').trigger('submit')
      await nextTick()

      expect(wrapper.emitted('submit')).toBeFalsy()
    })
  })

  describe('Loading State', () => {
    it('shows spinner when loading', async () => {
      mockLoading = true
      const wrapper = mountComponent(
        {},
        {
          global: {
            plugins: [
              PrimeVue,
              createI18n({
                legacy: false,
                locale: 'en',
                messages: { en: enMessages }
              }),
              ToastService
            ],
            stubs: {
              ProgressSpinner: { template: '<div data-testid="spinner" />' }
            }
          }
        }
      )
      await nextTick()

      expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
      expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    })

    it('shows submit button when not loading', () => {
      mockLoading = false
      const wrapper = mountComponent()

      expect(wrapper.findComponent(ProgressSpinner).exists()).toBe(false)
      expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
    })
  })

  describe('Component Structure', () => {
    it('renders email input with correct attributes', () => {
      const wrapper = mountComponent()
      const emailInput = wrapper.findComponent(InputText)

      expect(emailInput.attributes('id')).toBe('comfy-org-sign-in-email')
      expect(emailInput.attributes('autocomplete')).toBe('email')
      expect(emailInput.attributes('type')).toBe('text')
    })

    it('renders password input with correct attributes', () => {
      const wrapper = mountComponent()
      const passwordInput = wrapper.findComponent(Password)

      expect(passwordInput.props('inputId')).toBe('comfy-org-sign-in-password')
      expect(passwordInput.props('feedback')).toBe(false)
      expect(passwordInput.props('toggleMask')).toBe(true)
    })
  })

  describe('Focus Behavior', () => {
    it('focuses email input when handleForgotPassword is called with invalid email', async () => {
      const wrapper = mountComponent()
      const component = wrapper.vm as typeof wrapper.vm & {
        handleForgotPassword: (email: string, valid: boolean) => void
      }

      // Mock getElementById to track focus
      const mockFocus = vi.fn()
      const mockElement: Partial<HTMLElement> = { focus: mockFocus }
      vi.spyOn(document, 'getElementById').mockReturnValue(
        mockElement as HTMLElement
      )

      // Call handleForgotPassword with no email
      await component.handleForgotPassword('', false)

      // Should focus email input
      expect(document.getElementById).toHaveBeenCalledWith(
        'comfy-org-sign-in-email'
      )
      expect(mockFocus).toHaveBeenCalled()
    })

    it('does not focus email input when valid email is provided', async () => {
      const wrapper = mountComponent()
      const component = wrapper.vm as typeof wrapper.vm & {
        handleForgotPassword: (email: string, valid: boolean) => void
      }

      // Mock getElementById
      const mockFocus = vi.fn()
      const mockElement: Partial<HTMLElement> = { focus: mockFocus }
      vi.spyOn(document, 'getElementById').mockReturnValue(
        mockElement as HTMLElement
      )

      // Call handleForgotPassword with valid email
      await component.handleForgotPassword('test@example.com', true)

      expect(document.getElementById).not.toHaveBeenCalled()
      expect(mockFocus).not.toHaveBeenCalled()
      expect(mockSendPasswordReset).toHaveBeenCalledWith('test@example.com')
    })
  })
})
