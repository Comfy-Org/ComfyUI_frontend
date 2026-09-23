import type {
  AccountIdentity,
  AccountUser
} from '@comfyorg/account-core/session'

/**
 * The identity is built from the freshly reset module graph on every
 * `freshSession`, because the session client only accepts an identity branded
 * by the very instance of the package it was itself loaded with.
 */
const h = vi.hoisted(() => ({
  identity: undefined as AccountIdentity | undefined,
  deliver: undefined as ((user: AccountUser | null) => void) | undefined
}))

vi.mock<unknown>(import('@/config/firebase'), () => ({
  get billingWebIdentity() {
    return h.identity
  }
}))

const STORAGE_KEY = 'comfy.billing-web.session.v1'

function signedInUser(): AccountUser {
  return { uid: 'uid-1', getIdToken: vi.fn(async () => 'id-token') }
}

function mintedFetch() {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          token: 'jwt-1',
          permissions: ['workspace:read'],
          expires_at: new Date(Date.now() + 90 * 60_000).toISOString(),
          workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
          role: 'owner'
        }),
        { status: 200 }
      )
  )
}

function hungFetch() {
  return vi.fn<typeof fetch>(() => new Promise<Response>(() => {}))
}

async function freshSession({ configured = true } = {}) {
  vi.resetModules()
  const { createTestIdentity } = await import('@comfyorg/account-core/testing')
  h.identity = configured
    ? createTestIdentity<AccountUser>({
        onUserChanged: (callback) => {
          h.deliver = callback
          return () => undefined
        }
      })
    : undefined
  const module = await import('@/session/billingWebSession')
  const session = module.useBillingWebSession()
  return {
    session,
    phase: module.billingWebSessionPhase,
    client: module.billingWebSessionClient(),
    projection: () => ({
      phase: session.phase.value,
      uid: session.user.value?.uid ?? null,
      hasSession: session.session.value !== undefined
    })
  }
}

beforeEach(() => {
  sessionStorage.clear()
  h.identity = undefined
  h.deliver = undefined
})

describe('useBillingWebSession', () => {
  it('starts pending, before the identity has answered', async () => {
    vi.stubGlobal('fetch', hungFetch())

    const { projection } = await freshSession()

    expect(projection()).toEqual({
      phase: 'pending',
      uid: null,
      hasSession: false
    })
  })

  it('settles signed out when the deployment has no identity configuration', async () => {
    vi.stubGlobal('fetch', hungFetch())

    const { projection } = await freshSession({ configured: false })

    expect(projection()).toEqual({
      phase: 'signed-out',
      uid: null,
      hasSession: false
    })
  })

  it.for([
    [
      'nobody signed in',
      null,
      hungFetch,
      { phase: 'signed-out', uid: null, hasSession: false }
    ],
    [
      'a mint still in flight',
      signedInUser(),
      hungFetch,
      { phase: 'minting', uid: 'uid-1', hasSession: false }
    ],
    [
      'a minted workspace session',
      signedInUser(),
      mintedFetch,
      { phase: 'authenticated', uid: 'uid-1', hasSession: true }
    ]
  ] as const)('projects %s', async ([, user, makeFetch, expected]) => {
    vi.stubGlobal('fetch', makeFetch())
    const { client, projection } = await freshSession()

    h.deliver?.(user)
    // The client no longer auto-mints on identity delivery (see
    // `billingWebSession.ts`); production drives this through
    // `useSignInController`, so a test asking for a minted or in-flight
    // result asks for it the same explicit way.
    if (user) void client.ensureFresh(user)

    await vi.waitFor(() => expect(projection()).toEqual(expected))
  })

  it('reports the same phase to the router guard', async () => {
    vi.stubGlobal('fetch', mintedFetch())
    const { client, phase, projection } = await freshSession()
    const user = signedInUser()

    h.deliver?.(user)
    void client.ensureFresh(user)

    await vi.waitFor(() => expect(phase()).toBe('authenticated'))
    expect(projection().phase).toBe('authenticated')
  })
})

describe('a refused mint', () => {
  it('surfaces the failure instead of falling back to a personal session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ error: 'not a member' }), {
            status: 403
          })
      )
    )
    const { client, session } = await freshSession()
    const user = signedInUser()

    h.deliver?.(user)
    void client.ensureFresh(user, { workspaceId: 'ws-team' })

    await vi.waitFor(() => expect(session.phase.value).toBe('error'))
    expect(session.session.value).toBeUndefined()
    expect(session.failure.value?.code).toBe('ACCESS_DENIED')
  })
})

describe('the credential cache', () => {
  it('writes the minted credential once and serves it back without a second mint', async () => {
    const mint = mintedFetch()
    vi.stubGlobal('fetch', mint)
    const { client, projection } = await freshSession()
    const user = signedInUser()
    h.deliver?.(user)
    void client.ensureFresh(user)
    await vi.waitFor(() => expect(projection().phase).toBe('authenticated'))

    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(mint).toHaveBeenCalledOnce()
    const secondFetch = vi.fn<typeof fetch>()
    const cached = await client.ensureFresh(signedInUser(), {
      fetchImpl: secondFetch
    })

    expect(cached?.status).toBe('ok')
    expect(
      secondFetch,
      'a fresh cache must satisfy the read'
    ).not.toHaveBeenCalled()
  })

  it('still mints when sessionStorage throws outright', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('storage disabled')
      },
      removeItem: () => {
        throw new Error('storage disabled')
      }
    })
    vi.stubGlobal('fetch', mintedFetch())
    const { client } = await freshSession()

    const result = await client.ensureFresh(signedInUser())

    expect(
      result?.status,
      'disabled storage must degrade to memory-only, never break sign-in'
    ).toBe('ok')
  })
})
