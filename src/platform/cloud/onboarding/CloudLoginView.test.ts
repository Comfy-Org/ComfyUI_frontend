import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import CloudLoginView from '@/platform/cloud/onboarding/CloudLoginView.vue'

const authActions = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithGithub: vi.fn(),
  signInWithEmail: vi.fn(),
  lastAuthErrorMessage: { value: '' }
}))
vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => authActions
}))

const onAuthSuccess = vi.hoisted(() => vi.fn())
vi.mock('@/platform/cloud/onboarding/composables/usePostAuthRedirect', () => ({
  usePostAuthRedirect: () => ({ onAuthSuccess })
}))

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

const isEmbeddedWebView = vi.hoisted(() => ({ value: false }))
vi.mock('@/base/webviewDetection', () => ({
  isEmbeddedWebView: () => isEmbeddedWebView.value
}))

const FREE_RUN_MESSAGES = {
  auth: {
    login: {
      cloudNewUser: 'New to Comfy?',
      cloudSignUp: 'Sign up here',
      freeRunsSuffix: 'to get {count} free run. | to get {count} free runs.'
    }
  }
}

async function renderLoginView(
  url = '/cloud/login',
  messages: Partial<typeof FREE_RUN_MESSAGES> = {}
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cloud/login', name: 'cloud-login', component: CloudLoginView },
      {
        path: '/cloud/signup',
        name: 'cloud-signup',
        component: { template: '<div />' }
      }
    ]
  })
  await router.push(url)
  await router.isReady()
  return render(CloudLoginView, {
    global: {
      plugins: [
        router,
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ],
      stubs: {
        Message: true,
        CloudSignInForm: { template: '<form data-testid="signin-form" />' }
      }
    }
  })
}

afterEach(() => {
  isEmbeddedWebView.value = false
  authActions.lastAuthErrorMessage.value = ''
  vi.clearAllMocks()
})

/**
 * Drives the email sign-in path and returns the banner text CloudSignInForm
 * ends up with. The form is stubbed to a plain submit button; that the banner
 * renders from that prop is covered by CloudSignInForm.test.ts.
 */
async function submitEmailSignIn() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cloud/login', name: 'cloud-login', component: CloudLoginView }
    ]
  })
  await router.push('/cloud/login')
  await router.isReady()

  render(CloudLoginView, {
    global: {
      plugins: [
        router,
        createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
      ],
      stubs: {
        RouterLink: true,
        Message: true,
        CloudSocialAuthButtons: true,
        CloudSignInForm: {
          props: ['authError'],
          template:
            '<div><span v-if="authError" data-testid="auth-error">{{ authError }}</span>' +
            "<button data-testid=\"do-submit\" @click=\"$emit('submit', { email: 'a@b.co', password: 'pw123456' })\" /></div>"
        }
      }
    }
  })

  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
  )
  await user.click(screen.getByTestId('do-submit'))
  await nextTick()
}

describe('CloudLoginView email sign-in failures', () => {
  it('surfaces the failure inline instead of losing it', async () => {
    authActions.signInWithEmail.mockImplementation(() => {
      authActions.lastAuthErrorMessage.value = 'auth.errors.auth/wrong-password'
      return Promise.resolve(undefined)
    })

    await submitEmailSignIn()

    expect(screen.getByTestId('auth-error')).toHaveTextContent(
      'auth.errors.auth/wrong-password'
    )
  })

  it('falls back to generic copy when no message was recorded', async () => {
    authActions.signInWithEmail.mockResolvedValue(undefined)

    await submitEmailSignIn()

    expect(screen.getByTestId('auth-error')).toHaveTextContent(
      'auth.errors.generic'
    )
  })

  it('does not redirect on a failed sign-in', async () => {
    authActions.signInWithEmail.mockResolvedValue(undefined)

    await submitEmailSignIn()

    expect(onAuthSuccess).not.toHaveBeenCalled()
  })

  it('redirects and shows no banner on a successful sign-in', async () => {
    authActions.signInWithEmail.mockResolvedValue({ user: {} })

    await submitEmailSignIn()

    expect(onAuthSuccess).toHaveBeenCalled()
    expect(screen.queryByTestId('auth-error')).not.toBeInTheDocument()
  })
})

describe('CloudLoginView', () => {
  it('advertises the free runs offered on sign-up', async () => {
    await renderLoginView('/cloud/login', FREE_RUN_MESSAGES)

    expect(screen.getByText(/to get 5 free runs\./)).toBeInTheDocument()
  })

  it('carries the incoming query onto the sign-up link', async () => {
    await renderLoginView(
      '/cloud/login?previousFullPath=%2Ffoo%3Fx%3D1&switchAccount=1&oauth_request_id=abc'
    )

    const href = screen
      .getByRole('link', { name: 'auth.login.cloudSignUp' })
      .getAttribute('href')

    expect(href).toBe(
      '/cloud/signup?previousFullPath=/foo?x=1&switchAccount=1&oauth_request_id=abc'
    )
  })

  it('swaps the social buttons for the email form on request', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    await renderLoginView()

    expect(
      screen.getByRole('button', { name: 'auth.login.loginWithGoogle' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('signin-form')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )

    expect(screen.getByTestId('signin-form')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'auth.login.loginWithGoogle' })
    ).not.toBeInTheDocument()
  })

  it('shows the in-app browser notice only inside an embedded webview', async () => {
    const { unmount } = await renderLoginView()
    expect(
      screen.queryByTestId('google-sso-in-app-browser-notice')
    ).not.toBeInTheDocument()
    unmount()

    isEmbeddedWebView.value = true
    await renderLoginView()
    expect(
      screen.getByTestId('google-sso-in-app-browser-notice')
    ).toBeInTheDocument()
  })
})
