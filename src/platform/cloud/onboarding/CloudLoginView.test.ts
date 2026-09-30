import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useSsoPromptStore } from '@/platform/auth/sso/ssoPromptStore'
import CloudLoginView from '@/platform/cloud/onboarding/CloudLoginView.vue'

vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock(
  import('@/platform/cloud/onboarding/composables/usePostAuthRedirect'),
  () => ({
    usePostAuthRedirect: () => ({ onAuthSuccess: vi.fn() })
  })
)

const isEmbeddedWebView = vi.hoisted(() => ({ value: false }))
vi.mock(import('@comfyorg/account-core/webviewDetection'), () => ({
  isEmbeddedWebView: () => isEmbeddedWebView.value
}))

const FREE_RUN_MESSAGES = {
  auth: {
    login: {
      cloudNewUser: 'New to Comfy?',
      cloudSignUp: 'Sign up here',
      freeRunsSuffix: 'to get {count} free run. | to get {count} free runs.',
      insecureContextWarning: 'This connection is insecure'
    }
  }
}

async function renderLoginView(
  url = '/cloud/login',
  messages: {
    auth?: { login?: Partial<typeof FREE_RUN_MESSAGES.auth.login> }
  } = {}
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
        CloudSignInForm: {
          emits: ['submit'],
          template: `<form data-testid="signin-form" @submit.prevent="$emit('submit', { email: 'ada@corp.example', password: 'pw' })"><button type="submit">submit-email</button></form>`
        }
      }
    }
  })
}

afterEach(() => {
  isEmbeddedWebView.value = false
})

const SSO = enMessages.auth.sso

function stubDiscover(answer: () => Promise<Response>) {
  const fetchSpy = vi.fn<typeof fetch>(answer)
  vi.stubGlobal('fetch', fetchSpy)
  const assign = vi
    .spyOn(window.location, 'assign')
    .mockImplementation(() => {})
  return { fetchSpy, assign }
}

const discoverAnswer =
  (body: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status })

function startedReturnTo(assign: { mock: { calls: unknown[][] } }) {
  const url = new URL(String(assign.mock.calls[0][0]))
  return {
    path: url.pathname,
    email: url.searchParams.get('email'),
    returnTo: url.searchParams.get('return_to')
  }
}

describe('CloudLoginView email sign-in discovers SSO first', () => {
  it('sends an SSO domain to SSO start instead of the password sign-in', async () => {
    const { assign } = stubDiscover(discoverAnswer({ sso: true }))
    const user = userEvent.setup()
    await renderLoginView('/cloud/login?previousFullPath=%2Fworkflows%2Fx')

    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )
    await user.click(screen.getByRole('button', { name: 'submit-email' }))

    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(startedReturnTo(assign)).toEqual({
      path: '/api/auth/sso/start',
      email: 'ada@corp.example',
      returnTo: '/workflows/x'
    })
    expect(useAuthActions().signInWithEmail).not.toHaveBeenCalled()
  })

  it.for([
    ['a non-SSO domain', discoverAnswer({ sso: false })],
    ['a discover 5xx', discoverAnswer({ code: 'INTERNAL_ERROR' }, 500)],
    [
      'a discover network failure',
      async () => {
        throw new TypeError('Failed to fetch')
      }
    ]
  ] as const)('falls through to password sign-in on %s', async ([, answer]) => {
    const { assign } = stubDiscover(answer)
    const user = userEvent.setup()
    await renderLoginView()

    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )
    await user.click(screen.getByRole('button', { name: 'submit-email' }))

    await waitFor(() =>
      expect(useAuthActions().signInWithEmail).toHaveBeenCalledWith(
        'ada@corp.example',
        'pw'
      )
    )
    expect(assign).not.toHaveBeenCalled()
  })
})

describe('CloudLoginView discover lifecycle', () => {
  function deferDiscover() {
    let answer!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const stubs = stubDiscover(() => pending)
    return { ...stubs, answer }
  }

  it('ignores a second submit while discover is in flight', async () => {
    const { fetchSpy, answer } = deferDiscover()
    const user = userEvent.setup()
    await renderLoginView()
    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )

    await user.click(screen.getByRole('button', { name: 'submit-email' }))
    await user.click(screen.getByRole('button', { name: 'submit-email' }))
    answer(new Response(JSON.stringify({ sso: false })))

    await waitFor(() =>
      expect(useAuthActions().signInWithEmail).toHaveBeenCalledOnce()
    )
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('neither redirects nor signs in after the page is left mid-discover', async () => {
    const { fetchSpy, assign, answer } = deferDiscover()
    const user = userEvent.setup()
    const { unmount } = await renderLoginView()
    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )
    await user.click(screen.getByRole('button', { name: 'submit-email' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce())

    unmount()
    answer(new Response(JSON.stringify({ sso: true })))

    await expect
      .poll(() => fetchSpy.mock.calls[0][1]?.signal?.aborted)
      .toBe(true)
    expect(assign).not.toHaveBeenCalled()
    expect(useAuthActions().signInWithEmail).not.toHaveBeenCalled()
  })
})

describe('CloudLoginView Continue with SSO', () => {
  async function continueWithSso(url = '/cloud/login') {
    const user = userEvent.setup()
    await renderLoginView(url, enMessages)
    await user.click(screen.getByRole('button', { name: SSO.continueWithSso }))
    await user.type(screen.getByLabelText(SSO.emailLabel), 'ada@corp.example')
    await user.click(screen.getByRole('button', { name: SSO.continue }))
  }

  it('redirects an SSO email with a sanitized return path', async () => {
    const { assign } = stubDiscover(discoverAnswer({ sso: true }))

    await continueWithSso(
      '/cloud/login?previousFullPath=https%3A%2F%2Fevil.example%2F'
    )

    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(startedReturnTo(assign).returnTo).toBe('/cloud/user-check')
  })

  it('explains a non-SSO email and keeps the other sign-in options', async () => {
    const { assign } = stubDiscover(discoverAnswer({ sso: false }))

    await continueWithSso()

    expect(await screen.findByText(SSO.notSetUp)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: enMessages.auth.login.loginWithGoogle
      })
    ).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it('says SSO could not be checked when discover fails', async () => {
    stubDiscover(async () => {
      throw new TypeError('Failed to fetch')
    })

    await continueWithSso()

    expect(await screen.findByText(SSO.unavailable)).toBeInTheDocument()
  })
})

describe('CloudLoginView SSO failures', () => {
  it.for([
    ['SSO_USER_SUSPENDED', SSO.errors.suspended],
    ['SSO_INVALID_STATE', SSO.errors.expired],
    ['SSO_SOMETHING_NEW', SSO.errors.failed]
  ] as const)(
    'explains ?sso_error=%s in plain language',
    async ([code, message]) => {
      await renderLoginView(`/cloud/login?sso_error=${code}`, enMessages)

      expect(screen.getByText(message)).toBeInTheDocument()
    }
  )

  it('clears the error and opens the SSO form on retry', async () => {
    const user = userEvent.setup()
    await renderLoginView('/cloud/login?sso_error=RATE_LIMITED', enMessages)

    await user.click(screen.getByRole('button', { name: SSO.tryAgain }))

    await waitFor(() =>
      expect(screen.queryByText(SSO.errors.rateLimited)).not.toBeInTheDocument()
    )
    expect(screen.getByLabelText(SSO.emailLabel)).toBeInTheDocument()
  })

  it('offers SSO with the email prefilled after an sso_required refusal', async () => {
    useSsoPromptStore().show('ada@corp.example')
    await renderLoginView('/cloud/login', enMessages)

    expect(
      screen.getByText(enMessages.auth.errors.ssoRequired)
    ).toBeInTheDocument()
    expect(screen.getByLabelText(SSO.emailLabel)).toHaveValue(
      'ada@corp.example'
    )
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

  it.for([true, false])(
    'renders the insecure-context warning only over plain HTTP (secure: %s)',
    async (secure: boolean) => {
      vi.stubGlobal('isSecureContext', secure)
      const { unmount } = await renderLoginView('/cloud/login', {
        auth: {
          login: { insecureContextWarning: 'This connection is insecure' }
        }
      })

      const warning = screen.queryByText('This connection is insecure')
      if (secure) {
        expect(warning).not.toBeInTheDocument()
      } else {
        expect(
          warning,
          'a self-hosted HTTP origin can have credentials intercepted, so the warning must render'
        ).toBeInTheDocument()
      }
      unmount()
    }
  )

  it('does not region-gate sign-in, because an existing account already completed sign-up', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    await renderLoginView()

    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )

    expect(screen.getByTestId('signin-form')).toBeInTheDocument()
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
