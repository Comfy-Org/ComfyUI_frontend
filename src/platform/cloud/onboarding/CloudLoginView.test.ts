import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen, waitFor } from '@testing-library/vue'
import type { User, UserCredential } from 'firebase/auth'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { captureOAuthRequestId } from '@/platform/cloud/oauth/oauthState'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import CloudLoginView from '@/platform/cloud/onboarding/CloudLoginView.vue'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { useSessionCookie } from '@/platform/auth/session/useSessionCookie'
import { presentSsoRequired } from '@/platform/auth/sso/ssoRequired'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('@/composables/auth/useAuthActions'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('firebase/auth'))

const redirectAfterAuth = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock(
  import('@/platform/cloud/onboarding/composables/usePostAuthRedirect'),
  () => ({
    usePostAuthRedirect: () => ({ onAuthSuccess: redirectAfterAuth })
  })
)

const sessionRequiresSso = vi.hoisted(() =>
  vi.fn<() => Promise<boolean>>(async () => false)
)
vi.mock(import('@/platform/auth/session/useSessionCookie'), () => ({
  useSessionCookie: () =>
    fromPartial<ReturnType<typeof useSessionCookie>>({ sessionRequiresSso })
}))

vi.mock(import('@/platform/auth/sso/ssoRequired'), { spy: true })

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
      freeRunsSuffixGoogle:
        'with Google to get {count} free run. | with Google to get {count} free runs.',
      insecureContextWarning: 'This connection is insecure'
    }
  }
}

const SignInFormStub = defineComponent({
  emits: ['submit'],
  setup: () => ({ email: ref('') }),
  template: `
    <form data-testid="signin-form" @submit.prevent="$emit('submit', { email, password: 'hunter22' })">
      <input v-model="email" aria-label="Password form email" />
      <button type="submit">Log in with password</button>
    </form>`
})

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
      },
      {
        path: '/oauth/consent',
        name: 'cloud-oauth-consent',
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
      stubs: { CloudSignInForm: SignInFormStub }
    }
  })
}

afterEach(() => {
  isEmbeddedWebView.value = false
  remoteConfig.value = {}
  sessionStorage.clear()
})

const OAUTH_REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('CloudLoginView', () => {
  it('hides the free-runs offer when the server sends none', async () => {
    await renderLoginView('/cloud/login', FREE_RUN_MESSAGES)

    expect(screen.queryByText(/free run/)).not.toBeInTheDocument()
  })

  it.for<{
    name: string
    offer: NonNullable<RemoteConfig['free_tier_offer']>
    expected: string
  }>([
    {
      name: 'states the server allowance',
      offer: { job_allowance: 3, requires_google_sign_in: false },
      expected: 'to get 3 free runs.'
    },
    {
      name: 'uses the singular for one run',
      offer: { job_allowance: 1, requires_google_sign_in: false },
      expected: 'to get 1 free run.'
    },
    {
      name: 'names Google when only Google sign-in qualifies',
      offer: { job_allowance: 5, requires_google_sign_in: true },
      expected: 'with Google to get 5 free runs.'
    }
  ])('$name', async ({ offer, expected }) => {
    remoteConfig.value = { free_tier_offer: offer }
    await renderLoginView('/cloud/login', FREE_RUN_MESSAGES)

    expect(screen.getByText(expected)).toBeInTheDocument()
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

const discoverReplies = (body: unknown, status = 200) => {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const discoverCalls = (fetchMock: ReturnType<typeof discoverReplies>) =>
  fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith('/api/auth/sso/discover')
  )

const startParams = (assign: Mock<(url: string | URL) => void>) => {
  const [target] = assign.mock.calls[0]
  const url = new URL(String(target))
  return {
    path: url.pathname,
    email: url.searchParams.get('email'),
    returnTo: url.searchParams.get('return_to')
  }
}

describe('CloudLoginView SSO', () => {
  let assign: Mock<(url: string | URL) => void>

  beforeEach(() => {
    assign = vi.fn<(url: string | URL) => void>()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
  })

  async function signInWithPassword(email: string) {
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )
    await user.type(screen.getByLabelText('Password form email'), email)
    await user.click(
      screen.getByRole('button', { name: 'Log in with password' })
    )
  }

  async function continueWithSso(email: string) {
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'auth.sso.continueWithSso' })
    )
    await user.type(screen.getByLabelText('auth.sso.emailLabel'), email)
    await user.click(screen.getByRole('button', { name: 'auth.sso.submit' }))
  }

  describe('with the flag off', () => {
    it('offers no SSO entry and ignores an sso_error or sso=open', async () => {
      await renderLoginView('/cloud/login?sso_error=SSO_ORG_DISABLED&sso=open')

      expect(
        screen.queryByRole('button', { name: 'auth.sso.continueWithSso' })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('auth.sso.errors.orgDisabled')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByLabelText('auth.sso.emailLabel')
      ).not.toBeInTheDocument()
    })

    it('signs in with Firebase without asking ingest about SSO', async () => {
      const fetchMock = discoverReplies({ sso: true })
      await renderLoginView(`/cloud/login?oauth_request_id=${OAUTH_REQUEST_ID}`)

      await signInWithPassword('ada@acme.com')

      await waitFor(() =>
        expect(useAuthActions().signInWithEmail).toHaveBeenCalledWith(
          'ada@acme.com',
          'hunter22'
        )
      )
      expect(discoverCalls(fetchMock)).toEqual([])
      expect(assign).not.toHaveBeenCalled()
    })
  })

  describe('with the flag on', () => {
    beforeEach(() => {
      vi.mocked(useFeatureFlags().flags).ssoEnabled = true
    })

    it('sends an SSO email to ingest to start, returning to the user check', async () => {
      discoverReplies({ sso: true, organization_name: 'Acme' })
      await renderLoginView()

      await continueWithSso('ada@acme.com')

      await waitFor(() => expect(assign).toHaveBeenCalledOnce())
      expect(startParams(assign)).toEqual({
        path: '/api/auth/sso/start',
        email: 'ada@acme.com',
        returnTo: '/cloud/user-check'
      })
    })

    it('returns to the page the visitor came from', async () => {
      discoverReplies({ sso: true })
      await renderLoginView(
        '/cloud/login?previousFullPath=%2Fworkflows%3Fid%3D7'
      )

      await continueWithSso('ada@acme.com')

      await waitFor(() => expect(assign).toHaveBeenCalledOnce())
      expect(startParams(assign).returnTo).toBe('/workflows?id=7')
    })

    it('returns to the pending OAuth consent ahead of the previous page', async () => {
      discoverReplies({ sso: true })
      await renderLoginView(
        `/cloud/login?previousFullPath=%2Fworkflows&oauth_request_id=${OAUTH_REQUEST_ID}`
      )

      await continueWithSso('ada@acme.com')

      await waitFor(() => expect(assign).toHaveBeenCalledOnce())
      expect(startParams(assign).returnTo).toBe(
        `/oauth/consent?oauth_request_id=${OAUTH_REQUEST_ID}`
      )
    })

    it('still resumes the consent when retrying after an SSO error dropped it from the URL', async () => {
      discoverReplies({ sso: true })
      captureOAuthRequestId({ oauth_request_id: OAUTH_REQUEST_ID })
      await renderLoginView('/cloud/login?sso_error=SSO_IDP_ERROR')

      await continueWithSso('ada@acme.com')

      await waitFor(() => expect(assign).toHaveBeenCalledOnce())
      expect(startParams(assign).returnTo).toBe(
        `/oauth/consent?oauth_request_id=${OAUTH_REQUEST_ID}`
      )
    })

    it.for<{ name: string; status: number; body: unknown; message: string }>([
      {
        name: 'an email without SSO',
        status: 200,
        body: { sso: false },
        message: 'auth.sso.notSso'
      },
      {
        name: 'an email ingest rejects',
        status: 400,
        body: { code: 'INVALID_EMAIL', message: 'bad' },
        message: 'auth.sso.invalidEmail'
      },
      {
        name: 'a discover outage',
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'down' },
        message: 'auth.sso.unavailable'
      }
    ])(
      'explains $name and stays on the page',
      async ({ status, body, message }) => {
        discoverReplies(body, status)
        await renderLoginView()

        await continueWithSso('ada@example.com')

        expect(await screen.findByText(message)).toBeInTheDocument()
        expect(assign).not.toHaveBeenCalled()
      }
    )

    it('sends an SSO email typed into the password form to SSO, not Firebase', async () => {
      discoverReplies({ sso: true })
      await renderLoginView()

      await signInWithPassword('ada@acme.com')

      await waitFor(() => expect(assign).toHaveBeenCalledOnce())
      expect(startParams(assign).email).toBe('ada@acme.com')
      expect(useAuthActions().signInWithEmail).not.toHaveBeenCalled()
    })

    it.for<{ name: string; status: number; body: unknown }>([
      { name: 'a non-SSO email', status: 200, body: { sso: false } },
      {
        name: 'a discover outage',
        status: 503,
        body: { code: 'INTERNAL_ERROR', message: 'down' }
      }
    ])('signs $name in with Firebase', async ({ status, body }) => {
      const fetchMock = discoverReplies(body, status)
      await renderLoginView()

      await signInWithPassword('ada@example.com')

      await waitFor(() =>
        expect(useAuthActions().signInWithEmail).toHaveBeenCalledWith(
          'ada@example.com',
          'hunter22'
        )
      )
      expect(discoverCalls(fetchMock)).toHaveLength(1)
      expect(assign).not.toHaveBeenCalled()
    })

    it.for([
      { query: '', open: false },
      { query: '?sso=open', open: true },
      { query: '?sso=1', open: false }
    ])(
      'opens the SSO entry on arrival for "$query": $open',
      async ({ query, open }) => {
        await renderLoginView(`/cloud/login${query}`)

        expect(screen.queryByLabelText('auth.sso.emailLabel') !== null).toBe(
          open
        )
      }
    )

    it('prefills the email this browser last signed in with through SSO', async () => {
      localStorage.setItem(
        'Comfy.WebSession.SsoHint',
        JSON.stringify({ email: 'ada@acme.com' })
      )
      await renderLoginView('/cloud/login?sso=open')

      expect(screen.getByLabelText('auth.sso.emailLabel')).toHaveValue(
        'ada@acme.com'
      )
    })

    it.for([
      ['SSO_ORG_DISABLED', 'auth.sso.errors.orgDisabled'],
      ['SSO_INVALID_STATE', 'auth.sso.errors.expired'],
      ['RATE_LIMITED', 'auth.sso.errors.rateLimited'],
      ['SSO_SOMETHING_NEW', 'auth.sso.errors.failed']
    ])('explains ?sso_error=%s', async ([code, message]) => {
      await renderLoginView(`/cloud/login?sso_error=${code}`)

      expect(screen.getByText(message)).toBeInTheDocument()
    })

    it('opens on the SSO entry when sent back to it with ?sso=open', async () => {
      await renderLoginView('/cloud/login?sso=open')

      expect(screen.getByLabelText('auth.sso.emailLabel')).toBeInTheDocument()
    })
  })
})

describe('CloudLoginView Firebase sign-in refused for SSO', () => {
  beforeEach(() => {
    const authStore = useAuthStore()
    authStore.currentUser = fromPartial<User>({ email: 'ada@acme.com' })
    vi.spyOn(authStore, 'logout').mockResolvedValue()
  })

  async function signInWithFirebase() {
    vi.mocked(useAuthActions().signInWithEmail).mockResolvedValueOnce(
      fromPartial<UserCredential>({})
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ sso: false }))
    )
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'auth.login.useEmailInstead' })
    )
    await user.type(
      screen.getByLabelText('Password form email'),
      'ada@acme.com'
    )
    await user.click(
      screen.getByRole('button', { name: 'Log in with password' })
    )
  }

  it('with the flag off, redirects as today without asking about the session', async () => {
    sessionRequiresSso.mockResolvedValue(true)
    await renderLoginView()

    await signInWithFirebase()

    await waitFor(() => expect(redirectAfterAuth).toHaveBeenCalledOnce())
    expect(sessionRequiresSso).not.toHaveBeenCalled()
    expect(presentSsoRequired).not.toHaveBeenCalled()
    expect(useAuthStore().logout).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'signs the account out and shows the SSO screen',
      url: '/cloud/login',
      returnTo: '/cloud/user-check'
    },
    {
      name: 'returns SSO to the page the visitor came from',
      url: '/cloud/login?previousFullPath=%2Fworkflows%3Fid%3D7',
      returnTo: '/workflows?id=7'
    }
  ])('with the flag on, $name', async ({ url, returnTo }) => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true
    sessionRequiresSso.mockResolvedValue(true)
    await renderLoginView(url)

    await signInWithFirebase()

    await waitFor(() =>
      expect(presentSsoRequired).toHaveBeenCalledWith({
        email: 'ada@acme.com',
        returnTo
      })
    )
    expect(useAuthStore().logout).toHaveBeenCalledOnce()
    expect(redirectAfterAuth).not.toHaveBeenCalled()
  })

  it('with the flag on, redirects a session ingest accepts', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true
    sessionRequiresSso.mockResolvedValue(false)
    await renderLoginView()

    await signInWithFirebase()

    await waitFor(() => expect(redirectAfterAuth).toHaveBeenCalledOnce())
    expect(presentSsoRequired).not.toHaveBeenCalled()
    expect(useAuthStore().logout).not.toHaveBeenCalled()
  })
})
