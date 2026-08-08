import { render, screen } from '@testing-library/vue'
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import CloudLoginView from '@/platform/cloud/onboarding/CloudLoginView.vue'

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    signInWithGoogle: vi.fn(),
    signInWithGithub: vi.fn(),
    signInWithEmail: vi.fn()
  })
}))

vi.mock('@/platform/cloud/onboarding/composables/usePostAuthRedirect', () => ({
  usePostAuthRedirect: () => ({ onAuthSuccess: vi.fn() })
}))

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

  it('does not region-gate sign-in, because an existing account already completed sign-up', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    await renderLoginView()

    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )

    expect(screen.getByTestId('signin-form')).toBeInTheDocument()

    const source = await readFile(
      'src/platform/cloud/onboarding/CloudLoginView.vue',
      'utf8'
    )
    expect(source).not.toContain('isInChina')
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
