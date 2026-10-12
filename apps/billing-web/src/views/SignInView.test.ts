import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createMemoryHistory } from 'vue-router'

import type { SessionErrorCode } from '@comfyorg/account-core/session'

import type { SignInState } from '@/auth/signInState'
import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'
import { trackedBillingEvents } from '@/test/trackedBillingEvents'
import SignInView from '@/views/SignInView.vue'

const h = vi.hoisted(() => ({
  available: true,
  initialState: undefined as SignInState | undefined,
  sessionFailureCode: undefined as SessionErrorCode | undefined,
  ssoOrganizationId: undefined as string | undefined,
  ssoEnabled: vi.fn<() => Promise<boolean>>(),
  accountEmail: 'someone@acme.com' as string | null,
  signOut: vi.fn<() => Promise<void>>(),
  signInWith: vi.fn(),
  submitEmail: vi.fn(),
  retryMint: vi.fn(),
  retryAvailability: vi.fn(),
  phase: 'signed-out' as 'signed-out' | 'authenticated',
  onSignedIn: () => {}
}))

vi.mock(import('@/auth/useSignInController'), async () => {
  const { computed, ref } = await import('vue')
  return {
    useSignInController: (onSignedIn: () => void) => {
      h.onSignedIn = onSignedIn
      return {
        state: ref<SignInState>(h.initialState ?? { step: 'idle' }),
        busy: computed(() => false),
        leaving: computed(() => false),
        errorMessage: computed(() => ''),
        sessionFailureCode: computed(() => h.sessionFailureCode),
        ssoOrganizationId: computed(() => h.ssoOrganizationId),
        available: computed(() => h.available),
        signInWith: h.signInWith,
        submitEmail: h.submitEmail,
        retryMint: h.retryMint,
        retryAvailability: h.retryAvailability
      }
    }
  }
})

vi.mock(import('@/config/ssoEnabled'), () => ({
  readBillingWebSsoEnabled: h.ssoEnabled
}))

vi.mock<unknown>(import('@/config/firebase'), () => ({
  resolveBillingWebIdentity: async () => ({
    currentUser: () => ({ email: h.accountEmail }),
    signOut: h.signOut
  })
}))

async function renderSignIn(path = '/sign-in') {
  const router = createBillingRouter(
    createMemoryHistory(),
    () => h.phase,
    () => {}
  )
  await router.push(path)
  await router.isReady()
  render(SignInView, {
    global: { plugins: [createBillingI18n(), router] }
  })
  return router
}

const REFUSED_ENTRY =
  '/v1/subscription?product=comfyui&return_to=comfyui_credits&workspace=ws_refused'

beforeEach(() => {
  h.available = true
  h.retryAvailability.mockClear()
  h.retryMint.mockClear()
  h.initialState = undefined
  h.sessionFailureCode = undefined
  h.ssoOrganizationId = undefined
  h.ssoEnabled.mockResolvedValue(false)
  h.accountEmail = 'someone@acme.com'
  h.signOut.mockResolvedValue(undefined)
  h.phase = 'signed-out'
  recordBillingEntry(undefined)
})

describe('SignInView', () => {
  it('returns to the link it was sent from once signed in', async () => {
    const router = await renderSignIn(
      `/sign-in?returnTo=${encodeURIComponent(REFUSED_ENTRY)}`
    )
    h.phase = 'authenticated'

    h.onSignedIn()

    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe(REFUSED_ENTRY)
    )
  })

  it('leaves the page alone when a sign-in resolves after the tab already moved on', async () => {
    const router = await renderSignIn(
      `/sign-in?returnTo=${encodeURIComponent(REFUSED_ENTRY)}`
    )
    h.phase = 'authenticated'
    await router.replace(REFUSED_ENTRY)
    const replace = vi.spyOn(router, 'replace')

    h.onSignedIn()

    expect(replace).not.toHaveBeenCalled()
  })

  it('hands the entered credentials to the controller once', async () => {
    await renderSignIn()

    await userEvent.click(
      screen.getByRole('button', { name: 'Use email instead' })
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'someone@comfy.org'
    )
    await userEvent.type(screen.getByLabelText('Password'), 'sup3r-secret!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(h.submitEmail).toHaveBeenCalledExactlyOnceWith({
      email: 'someone@comfy.org',
      password: 'sup3r-secret!'
    })
  })

  it('holds the form back until a malformed email is corrected', async () => {
    await renderSignIn()

    await userEvent.click(
      screen.getByRole('button', { name: 'Use email instead' })
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'not-an-email'
    )
    await userEvent.type(screen.getByLabelText('Password'), 'sup3r-secret!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email address')
    expect(h.submitEmail).not.toHaveBeenCalled()
  })

  it('offers no way in when the deployment has no identity configuration', async () => {
    h.available = false
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sign-in is unavailable'
    )
    expect(
      screen.getByRole('button', { name: 'Sign in with Google' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Sign in with GitHub' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Use email instead' })
    ).toBeDisabled()
  })

  it('offers a retry when sign-in is unavailable', async () => {
    h.available = false
    await renderSignIn()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(h.retryAvailability).toHaveBeenCalledOnce()
  })

  it('shows no retry button once sign-in is available', async () => {
    await renderSignIn()

    expect(
      screen.queryByRole('button', { name: 'Try again' })
    ).not.toBeInTheDocument()
  })

  it.for([
    {
      block: 'the email form',
      clicks: ['Use email instead'],
      focused: () => screen.getByRole('textbox', { name: 'Email' })
    },
    {
      block: 'the provider buttons',
      clicks: ['Use email instead', 'Sign in with Google or GitHub instead'],
      focused: () => screen.getByRole('button', { name: 'Sign in with Google' })
    }
  ])(
    'moves focus into $block when it swaps in',
    async ({ clicks, focused }) => {
      await renderSignIn()

      for (const name of clicks) {
        await userEvent.click(screen.getByRole('button', { name }))
      }

      expect(focused()).toHaveFocus()
    }
  )

  it('shows the generic retry prompt when the mint fails for no named reason', async () => {
    h.initialState = {
      step: 'signedIn',
      origin: 'interactive',
      mintFailed: true
    }
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You are signed in, but your workspace session could not be started'
    )
  })

  it.for([
    ['ACCESS_DENIED', "This account can't manage billing for that workspace."],
    ['SSO_REQUIRED', "This account can't manage billing for that workspace."],
    [
      'WORKSPACE_NOT_FOUND',
      "This account can't access that workspace. Reopen billing from the app while signed in with the right account."
    ]
  ] as const)('names the workspace refusal for %s', async ([code, message]) => {
    h.initialState = {
      step: 'signedIn',
      origin: 'interactive',
      mintFailed: true
    }
    h.sessionFailureCode = code
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })

  it.for([
    'NOT_AUTHENTICATED',
    'INVALID_FIREBASE_TOKEN',
    'TOKEN_EXCHANGE_FAILED'
  ] as const)(
    'keeps the generic retry prompt for %s, not the catch-all "something went wrong"',
    async (code) => {
      h.initialState = {
        step: 'signedIn',
        origin: 'interactive',
        mintFailed: true
      }
      h.sessionFailureCode = code
      await renderSignIn()

      expect(screen.getByRole('alert')).toHaveTextContent(
        'You are signed in, but your workspace session could not be started'
      )
    }
  )

  it('offers no sign-in when the shared session holds but the workspace is refused (SO4)', async () => {
    h.available = false
    h.initialState = { step: 'signedIn', origin: 'restored', mintFailed: true }
    h.sessionFailureCode = 'ACCESS_DENIED'
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(
      "This account can't manage billing for that workspace."
    )
    expect(
      screen.queryByRole('button', { name: 'Sign in with Google' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Retry session' })
    ).toBeInTheDocument()
  })

  it('keeps a restored shared-session failure on its retry, never on sign-in', async () => {
    h.available = false
    h.initialState = { step: 'signedIn', origin: 'restored', mintFailed: true }
    h.sessionFailureCode = 'TOKEN_EXCHANGE_FAILED'
    await renderSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You are signed in, but your workspace session could not be started'
    )
    expect(
      screen.queryByRole('button', { name: 'Sign in with Google' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Retry session' })
    ).toBeInTheDocument()
  })

  it.for(['ACCESS_DENIED', 'SSO_REQUIRED', 'WORKSPACE_NOT_FOUND'] as const)(
    'offers a way back to the app instead of a retry for %s',
    async (code) => {
      h.initialState = {
        step: 'signedIn',
        origin: 'interactive',
        mintFailed: true
      }
      h.sessionFailureCode = code
      await renderSignIn(REFUSED_ENTRY)

      expect(
        screen.getByRole('link', { name: 'Return to ComfyUI' })
      ).toHaveAttribute(
        'href',
        'https://testcloud.comfy.org/?settings=plan-credits'
      )
      expect(
        screen.queryByRole('button', { name: 'Retry session' })
      ).not.toBeInTheDocument()
    }
  )

  it('reports a click on the way back to the app', async () => {
    h.initialState = {
      step: 'signedIn',
      origin: 'interactive',
      mintFailed: true
    }
    h.sessionFailureCode = 'ACCESS_DENIED'
    const sent = trackedBillingEvents()
    document.addEventListener('click', (event) => event.preventDefault(), {
      once: true
    })
    await renderSignIn(REFUSED_ENTRY)

    await userEvent.click(
      screen.getByRole('link', { name: 'Return to ComfyUI' })
    )

    expect(sent()).toStrictEqual([
      {
        operation: 'web_return',
        stage: 'clicked',
        outcome: 'pending',
        control: 'host_link'
      }
    ])
  })

  it.for([
    { code: 'NOT_AUTHENTICATED', path: REFUSED_ENTRY },
    { code: undefined, path: REFUSED_ENTRY },
    {
      code: 'WORKSPACE_NOT_FOUND',
      path: '/v1/subscription?product=platform&return_to=platform_account&workspace=ws_refused'
    },
    { code: 'WORKSPACE_NOT_FOUND', path: '/sign-in' }
  ] as const)(
    'keeps the retry for $code arriving at $path',
    async ({ code, path }) => {
      h.initialState = {
        step: 'signedIn',
        origin: 'interactive',
        mintFailed: true
      }
      h.sessionFailureCode = code
      await renderSignIn(path)

      await userEvent.click(
        screen.getByRole('button', { name: 'Retry session' })
      )

      expect(h.retryMint).toHaveBeenCalledOnce()
      expect(
        screen.queryByRole('link', { name: 'Return to ComfyUI' })
      ).not.toBeInTheDocument()
    }
  )

  describe('an SSO_REQUIRED refusal with sso_enabled on', () => {
    const SSO_START = 'https://testcloud.comfy.org/api/auth/sso/start'

    beforeEach(() => {
      h.ssoEnabled.mockResolvedValue(true)
      h.sessionFailureCode = 'SSO_REQUIRED'
      h.initialState = {
        step: 'signedIn',
        origin: 'interactive',
        mintFailed: true
      }
    })

    it.for([
      {
        refusal: 'naming its organization',
        organizationId: 'org_acme',
        path: REFUSED_ENTRY,
        query: 'email=someone%40acme.com&organization=org_acme'
      },
      {
        refusal: 'naming no organization',
        organizationId: undefined,
        path: REFUSED_ENTRY,
        query: 'email=someone%40acme.com'
      }
    ])(
      'signs out and continues with SSO for a refusal $refusal',
      async ({ organizationId, path, query }) => {
        h.ssoOrganizationId = organizationId
        const assign = vi
          .spyOn(window.location, 'assign')
          .mockImplementation(() => {})
        const router = await renderSignIn(path)

        const action = await screen.findByRole('button', {
          name: 'Continue with SSO'
        })
        expect(screen.getByRole('alert')).toHaveTextContent(
          "Your organization requires single sign-onsomeone@acme.com signs in with your organization's single sign-on."
        )
        await userEvent.click(action)

        expect(h.signOut).toHaveBeenCalledOnce()
        const backToThisPage = encodeURIComponent(
          `${window.location.origin}${router.currentRoute.value.fullPath}`
        )
        expect(assign).toHaveBeenCalledExactlyOnceWith(
          `${SSO_START}?${query}&return_to=${backToThisPage}`
        )
      }
    )

    it('reports the notice once and the click as the same attempt', async () => {
      const trackSso = vi
        .spyOn(billingWebTelemetry, 'trackSsoEvent')
        .mockImplementation(() => undefined)
      vi.spyOn(window.location, 'assign').mockImplementation(() => {})
      await renderSignIn(REFUSED_ENTRY)

      await userEvent.click(
        await screen.findByRole('button', { name: 'Continue with SSO' })
      )

      const [[shown], [continued], ...rest] = trackSso.mock.calls
      expect(shown).toEqual({
        name: 'app:sso_required_shown',
        properties: {
          surface: 'billing_web',
          trigger: 'session_refused',
          presentation: 'notice',
          flow_id: expect.any(String)
        }
      })
      expect(continued).toEqual({
        name: 'app:sso_continue_clicked',
        properties: {
          surface: 'billing_web',
          flow_id: shown.properties.flow_id
        }
      })
      expect(rest).toEqual([])
    })

    it('offers nothing it cannot start when neither an organization nor an email is known', async () => {
      h.accountEmail = null
      await renderSignIn(REFUSED_ENTRY)

      await vi.waitFor(() => expect(h.ssoEnabled).toHaveBeenCalled())
      expect(screen.getByRole('alert')).toHaveTextContent(
        "This account can't manage billing for that workspace."
      )
      expect(
        screen.queryByRole('button', { name: 'Continue with SSO' })
      ).toBeNull()
    })

    it('stays on the page when signing out fails', async () => {
      h.signOut.mockRejectedValue(new Error('auth/network-request-failed'))
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      await renderSignIn(REFUSED_ENTRY)

      await userEvent.click(
        await screen.findByRole('button', { name: 'Continue with SSO' })
      )

      expect(assign).not.toHaveBeenCalled()
      expect(
        await screen.findByText(
          'Something went wrong while signing you in. Please try again.'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Continue with SSO' })
      ).toBeInTheDocument()
    })
  })

  it('keeps the workspace refusal for SSO_REQUIRED while sso_enabled is off', async () => {
    const trackSso = vi.spyOn(billingWebTelemetry, 'trackSsoEvent')
    h.sessionFailureCode = 'SSO_REQUIRED'
    h.ssoOrganizationId = 'org_acme'
    h.initialState = {
      step: 'signedIn',
      origin: 'interactive',
      mintFailed: true
    }
    await renderSignIn(REFUSED_ENTRY)

    await vi.waitFor(() => expect(h.ssoEnabled).toHaveBeenCalled())
    expect(screen.getByRole('alert')).toHaveTextContent(
      "This account can't manage billing for that workspace."
    )
    expect(
      screen.queryByRole('button', { name: 'Continue with SSO' })
    ).toBeNull()
    expect(trackSso).not.toHaveBeenCalled()
  })
})
