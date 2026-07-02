import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Unit tests for useDesktopLoginRedemption composable
 *
 * Tests the one-shot redemption of desktop login codes via URL query
 * parameters (?desktop_login_code=dlc_...):
 * - Redemption requires explicit user approval via a confirmation dialog
 * - Valid code with an authenticated user is redeemed exactly once
 * - The redeem request carries a timeout signal; aborts stay transient
 * - Terminal backend responses (400/403/404/409/410) drop the code with an
 *   error toast
 * - Transient failures (network/5xx) keep the stash until the attempt budget
 *   is exhausted, then drop it
 * - Malformed codes are dropped without a request
 * - Unauthenticated sessions keep the stash for the post-login trigger
 * - stripDesktopLoginCodeFromPath sanitizes previousFullPath redirect targets
 */

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  '@/platform/navigation/preservedQueryManager',
  () => preservedQueryMocks
)

const mockRouteQuery = vi.hoisted(() => ({
  value: {} as Record<string, string>
}))
const mockRouterReplace = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => ({
    get query() {
      return mockRouteQuery.value
    }
  }),
  useRouter: () => ({
    replace: mockRouterReplace
  })
}))

const mockToastAdd = vi.hoisted(() => vi.fn())
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: mockToastAdd
  })
}))

const mockConfirm = vi.hoisted(() => vi.fn())
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    confirm: mockConfirm
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

const mockUserGetIdToken = vi.hoisted(() => vi.fn())
const mockAuthStore = vi.hoisted(() => ({
  isInitialized: true,
  currentUser: null as { uid: string; getIdToken: () => Promise<string> } | null
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthStore
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `/api${path}`
  }
}))

const VALID_CODE = `dlc_${'A'.repeat(43)}`
const REDEEM_URL = '/api/auth/desktop-login-codes/redeem'

const mockFetch = vi.fn()

const expectedFetchOptions = () => ({
  method: 'POST',
  headers: {
    Authorization: 'Bearer firebase-id-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ code: VALID_CODE }),
  signal: expect.any(AbortSignal)
})

const importComposable = async () => {
  const { useDesktopLoginRedemption } =
    await import('./useDesktopLoginRedemption')
  return useDesktopLoginRedemption()
}

describe('useDesktopLoginRedemption', () => {
  beforeEach(() => {
    // The composable keeps one-shot state at module scope; reset the module
    // registry so each test starts from an unredeemed page load.
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockRouteQuery.value = {}
    mockRouterReplace.mockResolvedValue(undefined)
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
    mockConfirm.mockResolvedValue(true)
    mockAuthStore.isInitialized = true
    mockUserGetIdToken.mockResolvedValue('firebase-id-token')
    mockAuthStore.currentUser = {
      uid: 'user-1',
      getIdToken: mockUserGetIdToken
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does nothing when no code is present', async () => {
    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalled()
  })

  it('redeems a valid code once with the Firebase bearer token after approval', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'redeemed' }), { status: 200 })
    )

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'desktopLogin.confirmSummary',
      message: 'desktopLogin.confirmMessage'
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(REDEEM_URL, expectedFetchOptions())
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'desktop_login'
    )
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'desktopLogin.successSummary',
      detail: 'desktopLogin.successDetail',
      life: 4000
    })
  })

  it('does not fetch before the user approves the confirmation dialog', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    let approve!: (value: boolean) => void
    mockConfirm.mockReturnValue(
      new Promise<boolean>((resolve) => {
        approve = resolve
      })
    )
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'redeemed' }), { status: 200 })
    )

    const { redeemIfPresent } = await importComposable()
    const pending = redeemIfPresent()
    // Let the composable reach the approval gate.
    await vi.waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1))
    expect(mockFetch).not.toHaveBeenCalled()

    approve(true)
    await pending

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it.for([
    ['declines', false],
    ['dismisses', null]
  ] as const)(
    'clears the stash without a request or toast when the user %s the dialog',
    async ([_label, confirmResult]) => {
      mockRouteQuery.value = { desktop_login_code: VALID_CODE }
      mockConfirm.mockResolvedValue(confirmResult)

      const { redeemIfPresent } = await importComposable()
      await redeemIfPresent()

      expect(mockFetch).not.toHaveBeenCalled()
      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'desktop_login'
      )
      expect(mockToastAdd).not.toHaveBeenCalled()

      // Declining is final for this page load: no second dialog.
      await redeemIfPresent()
      expect(mockConfirm).toHaveBeenCalledTimes(1)
      expect(mockFetch).not.toHaveBeenCalled()
    }
  )

  it('asks for approval at most once per page load across retries', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }))

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()
    await redeemIfPresent()

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('strips the code from the visible URL before redeeming', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE, other: 'param' }
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'redeemed' }), { status: 200 })
    )

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
  })

  it('strips the URL param and clears the stash even after redemption completed', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'redeemed' }), { status: 200 })
    )

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // A later navigation (e.g. a stale link) resurrects the param.
    mockRouterReplace.mockClear()
    preservedQueryMocks.clearPreservedQuery.mockClear()
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    await redeemIfPresent()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'desktop_login'
    )
  })

  it('redeems a code restored from the preserved-query stash', async () => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      desktop_login_code: VALID_CODE
    })
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'redeemed' }), { status: 200 })
    )

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'desktop_login'
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
    // The code never appeared in the visible URL, so nothing to strip.
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('does not redeem again after a successful redemption', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'redeemed' }), { status: 200 })
    )

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()
    await redeemIfPresent()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it.for([400, 403, 404, 409, 410])(
    'clears the stash and shows an error toast on %s',
    async (status) => {
      mockRouteQuery.value = { desktop_login_code: VALID_CODE }
      mockFetch.mockResolvedValue(new Response(null, { status }))

      const { redeemIfPresent } = await importComposable()
      await redeemIfPresent()

      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'desktop_login'
      )
      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'desktopLogin.expiredSummary',
        detail: 'desktopLogin.expiredDetail',
        life: 6000
      })
    }
  )

  it.for([401, 500])(
    'keeps the stash on %s for a later retry',
    async (status) => {
      mockRouteQuery.value = { desktop_login_code: VALID_CODE }
      mockFetch.mockResolvedValue(new Response(null, { status }))

      const { redeemIfPresent } = await importComposable()
      await redeemIfPresent()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
    }
  )

  it('clears the stash once the transient-failure attempt budget is spent', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }))

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()
    expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalled()

    await redeemIfPresent()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'desktop_login'
    )

    // The budget is spent: further triggers never retry the dead code.
    await redeemIfPresent()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('passes a timeout signal and treats an aborted request as transient', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    mockFetch.mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError')
    )

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()

    expect(mockFetch).toHaveBeenCalledWith(REDEEM_URL, expectedFetchOptions())
    expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('treats an id token failure as transient without any dialog or toast', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    mockUserGetIdToken.mockRejectedValue(new Error('firebase unavailable'))

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()

    expect(mockFetch).not.toHaveBeenCalled()
    expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('clears the stash without a request for a malformed code', async () => {
    mockRouteQuery.value = { desktop_login_code: 'not-a-desktop-login-code' }

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'desktop_login'
    )
  })

  it('keeps the stash and skips the request when unauthenticated', async () => {
    mockRouteQuery.value = { desktop_login_code: VALID_CODE }
    mockAuthStore.currentUser = null

    const { redeemIfPresent } = await importComposable()
    await redeemIfPresent()

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })
})

describe('stripDesktopLoginCodeFromPath', () => {
  const importHelper = async () => {
    const { stripDesktopLoginCodeFromPath } =
      await import('./useDesktopLoginRedemption')
    return stripDesktopLoginCodeFromPath
  }

  it('removes the code and keeps the rest of the path', async () => {
    const strip = await importHelper()
    expect(strip(`/some/path?desktop_login_code=${VALID_CODE}&x=1#frag`)).toBe(
      '/some/path?x=1#frag'
    )
  })

  it('removes a lone code query entirely', async () => {
    const strip = await importHelper()
    expect(strip(`/?desktop_login_code=${VALID_CODE}`)).toBe('/')
  })

  it('returns paths without the code unchanged', async () => {
    const strip = await importHelper()
    expect(strip('/some/path?x=1')).toBe('/some/path?x=1')
    expect(strip('/')).toBe('/')
  })
})
