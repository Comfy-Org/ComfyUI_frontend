import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'

const loading = vi.hoisted(() => ({ value: false }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get loading() {
      return loading.value
    }
  })
}))

const LOGIN_COPY = enMessages.auth.login

function renderForm(
  authError?: string,
  messages: Record<string, object | string> = {}
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/cloud/forgot-password',
        name: 'cloud-forgot-password',
        component: { template: '<div />' }
      }
    ]
  })
  return render(CloudSignInForm, {
    props: { authError },
    global: {
      plugins: [
        router,
        PrimeVue,
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ]
    }
  })
}

/** Renders with real English copy, which the field-level queries need. */
const renderRealForm = () => renderForm(undefined, enMessages)

const emailField = () =>
  screen.getByPlaceholderText(LOGIN_COPY.emailPlaceholder)
const passwordField = () =>
  screen.getByPlaceholderText(LOGIN_COPY.passwordPlaceholder)
const submitButton = () =>
  screen.getByRole('button', { name: LOGIN_COPY.loginButton })

beforeEach(() => {
  setActivePinia(createPinia())
  loading.value = false
})

describe('CloudSignInForm', () => {
  it('renders the auth error inline', () => {
    renderForm('The password you entered is incorrect.')

    expect(
      screen.getByText('The password you entered is incorrect.')
    ).toBeInTheDocument()
  })

  it('renders nothing when there is no auth error', () => {
    renderForm()

    expect(
      screen.queryByText('The password you entered is incorrect.')
    ).not.toBeInTheDocument()
  })
})

describe('CloudSignInForm password manager support', () => {
  // Password managers key off these attributes. They break silently on a
  // refresh and nobody notices for weeks, so they are pinned explicitly.
  it('marks the email field for autofill with a stable id', () => {
    renderRealForm()

    expect(emailField()).toHaveAttribute('id', 'cloud-sign-in-email')
    expect(emailField()).toHaveAttribute('name', 'email')
    expect(emailField()).toHaveAttribute('autocomplete', 'email')
  })

  it('marks the password field as current-password, not new-password', () => {
    renderRealForm()

    expect(passwordField()).toHaveAttribute('id', 'cloud-sign-in-password')
    expect(passwordField()).toHaveAttribute('autocomplete', 'current-password')
  })

  it('binds both labels to their inputs', () => {
    renderRealForm()

    // getByLabelText resolves through for/id, so it passing *is* the assertion
    // that the association exists.
    expect(screen.getByLabelText(LOGIN_COPY.emailLabel)).toBe(emailField())
    expect(screen.getByLabelText(LOGIN_COPY.passwordLabel)).toBe(
      passwordField()
    )
  })
})

describe('CloudSignInForm submit gating', () => {
  // PrimeVue leaves `$form.valid` undefined until a field is touched, so the
  // pristine button is enabled and submitting it is what surfaces the errors.
  // The gate that matters is the one below: an invalid form cannot emit.
  it('disables submit once a field is touched and invalid', async () => {
    const user = userEvent.setup()
    renderRealForm()

    await user.type(emailField(), 'not-an-email')

    await waitFor(() => {
      expect(submitButton()).toBeDisabled()
    })
  })

  it('enables submit once both fields are filled', async () => {
    const user = userEvent.setup()
    renderRealForm()

    await user.type(emailField(), 'user@example.com')
    await user.type(passwordField(), 'Password1!')

    await waitFor(() => {
      expect(submitButton()).toBeEnabled()
    })
  })

  it('surfaces a field error for a malformed email', async () => {
    const user = userEvent.setup()
    renderRealForm()

    await user.type(emailField(), 'not-an-email')
    await user.type(passwordField(), 'Password1!')
    await user.click(submitButton())

    await waitFor(() => {
      expect(
        screen.getByText(enMessages.validation.invalidEmail)
      ).toBeInTheDocument()
    })
  })

  it('does not emit submit for a malformed email, by button or by Enter', async () => {
    const user = userEvent.setup()
    const { emitted } = renderRealForm()

    await user.type(emailField(), 'not-an-email')
    await user.type(passwordField(), 'Password1!')
    await user.click(submitButton())
    await user.type(passwordField(), '{Enter}')

    expect(emitted().submit).toBeUndefined()
  })

  it('submits on Enter from the password field', async () => {
    const user = userEvent.setup()
    const { emitted } = renderRealForm()

    await user.type(emailField(), 'user@example.com')
    // Enter inside a field is how most people submit a login form; a handler
    // wired only to the button's click would never fire here.
    await user.type(passwordField(), 'Password1!{Enter}')

    await waitFor(() => {
      expect(emitted().submit).toBeTruthy()
    })
    expect(emitted().submit[0]).toEqual([
      { email: 'user@example.com', password: 'Password1!' }
    ])
  })
})

describe('CloudSignInForm in-flight state', () => {
  // `loading` is store-global, so any auth action in flight disables this
  // button — including one started elsewhere in the app.
  it('disables submit and marks it busy while an auth action runs', () => {
    loading.value = true
    renderRealForm()

    expect(submitButton()).toBeDisabled()
    expect(submitButton()).toHaveAttribute('aria-busy', 'true')
  })

  it('does not emit submit while loading', async () => {
    const user = userEvent.setup()
    loading.value = true
    const { emitted } = renderRealForm()

    await user.click(submitButton())

    expect(emitted().submit).toBeUndefined()
  })
})
