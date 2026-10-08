import type { SessionResult } from '@comfyorg/account-core/session'

import type { CheckoutUiState } from '@/config/checkoutUi'

type Phase = 'pending' | 'signed-out' | 'minting' | 'authenticated' | 'error'

const h = vi.hoisted(() => ({
  phase: 'authenticated' as Phase,
  uid: 'uid-1',
  ensureFresh:
    vi.fn<
      (user: undefined, options: unknown) => Promise<SessionResult | undefined>
    >()
}))

vi.mock<unknown>(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org'
}))

vi.mock<unknown>(import('@/session/billingWebSession'), () => ({
  billingWebSessionClient: () => ({
    getSnapshot: () =>
      h.phase === 'authenticated'
        ? {
            phase: 'authenticated',
            user: { uid: h.uid },
            session: { uid: h.uid, workspace: { id: 'ws-team' } }
          }
        : { phase: h.phase, user: null, session: undefined },
    ensureFresh: h.ensureFresh
  })
}))

const fetchMock = vi.fn<typeof fetch>()

function minted(token = 'jwt-1'): SessionResult {
  return {
    status: 'ok',
    session: {
      token,
      expiresAt: Date.now() + 3_600_000,
      uid: h.uid,
      workspace: { id: 'ws-team', name: 'Acme', type: 'team' },
      role: 'owner',
      permissions: []
    }
  }
}

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function answerFlag(value: unknown): Response {
  return answer({ firebase_config: {}, billing_web_checkout_ui: value })
}

beforeEach(() => {
  h.phase = 'authenticated'
  h.uid = 'uid-1'
  h.ensureFresh.mockResolvedValue(minted())
  localStorage.clear()
  vi.stubGlobal('fetch', fetchMock)
})

async function freshCheckoutUi() {
  vi.resetModules()
  return import('@/config/checkoutUi')
}

describe('awaitCheckoutUiVariant', () => {
  it.for<{ name: string; reply: () => Promise<Response>; variant: string }>([
    {
      name: 'full_page',
      reply: async () => answerFlag('full_page'),
      variant: 'full_page'
    },
    {
      name: 'embedded',
      reply: async () => answerFlag('embedded'),
      variant: 'embedded'
    },
    {
      name: 'an unknown value',
      reply: async () => answerFlag('banana'),
      variant: 'embedded'
    },
    {
      name: 'a non-string value',
      reply: async () => answerFlag(42),
      variant: 'embedded'
    },
    {
      name: 'an absent key',
      reply: async () => answer({ firebase_config: {} }),
      variant: 'embedded'
    },
    {
      name: 'a non-object body',
      reply: async () => answer('text'),
      variant: 'embedded'
    },
    {
      name: 'a server error',
      reply: async () => answer({ billing_web_checkout_ui: 'full_page' }, 500),
      variant: 'embedded'
    },
    {
      name: 'a refused request',
      reply: () => Promise.reject(new TypeError('Failed to fetch')),
      variant: 'embedded'
    }
  ])('answers $variant for $name', async ({ reply, variant }) => {
    fetchMock.mockImplementation(reply)
    const { awaitCheckoutUiVariant } = await freshCheckoutUi()

    expect(await awaitCheckoutUiVariant()).toBe(variant)
  })

  it('asks with this session token, pinned to its own workspace, past any cache', async () => {
    fetchMock.mockResolvedValue(answerFlag('full_page'))
    const { awaitCheckoutUiVariant } = await freshCheckoutUi()

    await awaitCheckoutUiVariant()

    expect(h.ensureFresh).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ workspaceId: 'ws-team' })
    )
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'https://testcloud.comfy.org/api/features',
      expect.objectContaining({
        headers: { Authorization: 'Bearer jwt-1' },
        cache: 'no-store'
      })
    )
  })

  it('fails closed when the answer outruns its budget', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockImplementation(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            )
          })
      )
      const { awaitCheckoutUiVariant } = await freshCheckoutUi()

      const variant = awaitCheckoutUiVariant()
      await vi.advanceTimersByTimeAsync(4000)

      expect(await variant).toBe('embedded')
    } finally {
      vi.useRealTimers()
    }
  })

  it.for<Phase>(['pending', 'signed-out', 'minting', 'error'])(
    'answers embedded for a %s visitor without asking the server',
    async (phase) => {
      h.phase = phase
      const { awaitCheckoutUiVariant } = await freshCheckoutUi()

      expect(await awaitCheckoutUiVariant()).toBe('embedded')
      expect(h.ensureFresh).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it.for<{ name: string; result: SessionResult | undefined }>([
    { name: 'nothing', result: undefined },
    {
      name: 'an error',
      result: { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    }
  ])(
    'answers embedded when the session refresh yields $name',
    async ({ result }) => {
      h.ensureFresh.mockResolvedValue(result)
      const { awaitCheckoutUiVariant } = await freshCheckoutUi()

      expect(await awaitCheckoutUiVariant()).toBe('embedded')
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('joins one resolution per user', async () => {
    fetchMock.mockImplementation(async () => answerFlag('full_page'))
    const { awaitCheckoutUiVariant } = await freshCheckoutUi()

    const concurrent = await Promise.all([
      awaitCheckoutUiVariant(),
      awaitCheckoutUiVariant(),
      awaitCheckoutUiVariant()
    ])
    const later = await awaitCheckoutUiVariant()

    expect([...concurrent, later]).toEqual([
      'full_page',
      'full_page',
      'full_page',
      'full_page'
    ])
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('asks again for a different user', async () => {
    fetchMock.mockResolvedValueOnce(answerFlag('full_page'))
    fetchMock.mockResolvedValueOnce(answerFlag('embedded'))
    const { awaitCheckoutUiVariant } = await freshCheckoutUi()

    expect(await awaitCheckoutUiVariant()).toBe('full_page')
    h.uid = 'uid-2'
    expect(await awaitCheckoutUiVariant()).toBe('embedded')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps a failed answer for the rest of the tab', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    fetchMock.mockResolvedValue(answerFlag('full_page'))
    const { awaitCheckoutUiVariant } = await freshCheckoutUi()

    expect(await awaitCheckoutUiVariant()).toBe('embedded')
    expect(await awaitCheckoutUiVariant()).toBe('embedded')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.for(['full_page', 'embedded'])(
    'honours a JSON dev override of %s without asking the server',
    async (variant) => {
      localStorage.setItem(
        'ff:billing_web_checkout_ui',
        JSON.stringify(variant)
      )
      const { awaitCheckoutUiVariant } = await freshCheckoutUi()

      expect(await awaitCheckoutUiVariant()).toBe(variant)
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('rejects a bare-string dev override and asks the server', async () => {
    const warn = vi.mocked(console.warn)
    localStorage.setItem('ff:billing_web_checkout_ui', 'full_page')
    fetchMock.mockResolvedValue(answerFlag('embedded'))
    const { awaitCheckoutUiVariant } = await freshCheckoutUi()

    expect(await awaitCheckoutUiVariant()).toBe('embedded')
    expect(warn).toHaveBeenCalledWith(
      '[ff] Invalid JSON for override "billing_web_checkout_ui":',
      'full_page'
    )
  })

  it('ignores an unrecognised dev override and asks the server', async () => {
    localStorage.setItem('ff:billing_web_checkout_ui', '"banana"')
    fetchMock.mockResolvedValue(answerFlag('full_page'))
    const { awaitCheckoutUiVariant } = await freshCheckoutUi()

    expect(await awaitCheckoutUiVariant()).toBe('full_page')
  })
})

describe('settleCheckoutUi', () => {
  it.for<{ variant: 'embedded' | 'full_page' }>([
    { variant: 'embedded' },
    { variant: 'full_page' }
  ])('settles a resolving state on $variant', async ({ variant }) => {
    const { settleCheckoutUi } = await freshCheckoutUi()

    expect(settleCheckoutUi({ phase: 'resolving' }, variant)).toEqual({
      phase: 'settled',
      variant
    })
  })

  it.for<{ settled: CheckoutUiState; late: 'embedded' | 'full_page' }>([
    { settled: { phase: 'settled', variant: 'embedded' }, late: 'full_page' },
    { settled: { phase: 'settled', variant: 'full_page' }, late: 'embedded' }
  ])(
    'keeps a settled state when $late arrives late',
    async ({ settled, late }) => {
      const { settleCheckoutUi } = await freshCheckoutUi()

      expect(settleCheckoutUi(settled, late)).toBe(settled)
    }
  )
})
