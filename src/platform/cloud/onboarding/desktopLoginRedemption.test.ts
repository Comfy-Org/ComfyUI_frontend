import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

/**
 * Every test drives a real in-memory router and the real preserved-query
 * manager: the tracker strips the code from the URL at capture time, so the
 * stash is the only carrier, and redemption fires from router.afterEach, an
 * auth watcher, and a delayed retry after a transient failure.
 *
 * The fake clock (installed for every test) keeps those retry timers from
 * leaking into later tests: afterEach discards them with vi.useRealTimers().
 */

const mockConfirm = vi.hoisted(() => vi.fn())
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    confirm: mockConfirm
  })
}))

const mockToastAdd = vi.hoisted(() => vi.fn())
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: mockToastAdd
  })
}))

interface MockAuthStore {
  currentUser: {
    uid: string
    getIdToken: (forceRefresh?: boolean) => Promise<string>
  } | null
  getIdToken: () => Promise<string>
}

const mockUserGetIdToken = vi.hoisted(() => vi.fn())
const mockStoreGetIdToken = vi.hoisted(() => vi.fn())

// Reactive so the module's watcher on currentUser fires without a navigation.
// The mock factory is cached across vi.resetModules(), so it reads a holder
// refilled per test; watchers leaked by earlier module generations stay
// subscribed to earlier stores and remain dormant.
const authStoreHolder = vi.hoisted(() => ({
  store: null as MockAuthStore | null
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => authStoreHolder.store
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `/api${path}`
  }
}))

const VALID_CODE = `dlc_${'A'.repeat(43)}`
const SECOND_CODE = `dlc_${'B'.repeat(43)}`
const REDEEM_URL = '/api/auth/desktop-login-codes/redeem'
const NAMESPACE = 'desktop_login'
const STORAGE_KEY = 'Comfy.PreservedQuery.desktop_login'
const RETRY_DELAY_MS = 5_000

const mockFetch = vi.fn()

let mockAuthStore: MockAuthStore

function okResponse() {
  return new Response(JSON.stringify({ status: 'redeemed' }), { status: 200 })
}

function expectedFetchOptions(code: string) {
  return {
    method: 'POST',
    headers: {
      Authorization: 'Bearer firebase-id-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code }),
    signal: expect.any(AbortSignal)
  }
}

// The triggers fire-and-forget the redemption; a zero-length advance of the
// fake clock yields the event loop so the whole mocked promise chain settles.
async function flushRedemption() {
  await vi.advanceTimersByTimeAsync(0)
}

// vi.resetModules() also resets the preserved-query manager's in-memory map,
// so the manager must be imported alongside the module under test.
async function setup() {
  const { installDesktopLoginRedemption } =
    await import('./desktopLoginRedemption')
  const { capturePreservedQuery, getPreservedQueryParam } =
    await import('@/platform/navigation/preservedQueryManager')

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  installDesktopLoginRedemption(router)

  let navigationCount = 0
  const trigger = async () => {
    await router.push(`/trigger-${navigationCount++}`)
    await flushRedemption()
  }

  return {
    router,
    trigger,
    seedStash: (code: string) =>
      capturePreservedQuery(NAMESPACE, { desktop_login_code: code }, [
        'desktop_login_code'
      ]),
    stashedCode: () => getPreservedQueryParam(NAMESPACE, 'desktop_login_code')
  }
}

describe('installDesktopLoginRedemption', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
    sessionStorage.clear()
    vi.stubGlobal('fetch', mockFetch)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetch.mockReset()
    mockConfirm.mockResolvedValue(true)
    mockUserGetIdToken.mockResolvedValue('firebase-id-token')
    mockAuthStore = reactive({
      currentUser: {
        uid: 'user-1',
        getIdToken: mockUserGetIdToken
      },
      getIdToken: mockStoreGetIdToken
    })
    authStoreHolder.store = mockAuthStore
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does nothing on navigation when no code is stashed', async () => {
    const { trigger } = await setup()

    await trigger()

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('redeems a stashed code once on navigation with the Firebase bearer token after approval', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockFetch.mockResolvedValue(okResponse())

    await trigger()

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'desktopLogin.confirmSummary',
      message: 'desktopLogin.confirmMessage'
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      REDEEM_URL,
      expectedFetchOptions(VALID_CODE)
    )
    expect(stashedCode()).toBeUndefined()
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'desktopLogin.successSummary',
      detail: 'desktopLogin.successDetail',
      life: 4000
    })
  })

  it('does not fetch before the user approves the confirmation dialog', async () => {
    const { trigger, seedStash } = await setup()
    seedStash(VALID_CODE)
    let approve!: (value: boolean) => void
    mockConfirm.mockReturnValue(
      new Promise<boolean>((resolve) => {
        approve = resolve
      })
    )
    mockFetch.mockResolvedValue(okResponse())

    await trigger()
    await vi.waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1))
    expect(mockFetch).not.toHaveBeenCalled()

    approve(true)
    await flushRedemption()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it.for([
    ['declines', false],
    ['dismisses', null]
  ] as const)(
    'clears the stash without a request or toast when the user %s the dialog',
    async ([_label, confirmResult]) => {
      const { trigger, seedStash, stashedCode } = await setup()
      seedStash(VALID_CODE)
      mockConfirm.mockResolvedValue(confirmResult)

      await trigger()

      expect(mockFetch).not.toHaveBeenCalled()
      expect(stashedCode()).toBeUndefined()
      expect(mockToastAdd).not.toHaveBeenCalled()

      // Declining is final for that code: re-capturing it never re-prompts.
      seedStash(VALID_CODE)
      await trigger()

      expect(mockConfirm).toHaveBeenCalledTimes(1)
      expect(mockFetch).not.toHaveBeenCalled()
      expect(stashedCode()).toBeUndefined()
    }
  )

  it('asks for approval at most once per code across transient retries', async () => {
    const { trigger, seedStash } = await setup()
    seedStash(VALID_CODE)
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }))

    await trigger()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('redeems a code hydrated lazily from sessionStorage', async () => {
    const { trigger } = await setup()
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ desktop_login_code: VALID_CODE })
    )
    mockFetch.mockResolvedValue(okResponse())

    await trigger()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      REDEEM_URL,
      expectedFetchOptions(VALID_CODE)
    )
  })

  it('does not redeem or prompt again after a successful redemption', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockFetch.mockResolvedValue(okResponse())

    await trigger()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // A later navigation re-captures the already-redeemed code.
    seedStash(VALID_CODE)
    await trigger()

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(stashedCode()).toBeUndefined()
  })

  it.for([400, 403, 404, 409, 410])(
    'clears the stash, shows an error toast, and never retries on %s',
    async (status) => {
      const { trigger, seedStash, stashedCode } = await setup()
      seedStash(VALID_CODE)
      mockFetch.mockResolvedValue(new Response(null, { status }))

      await trigger()

      expect(stashedCode()).toBeUndefined()
      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'desktopLogin.expiredSummary',
        detail: 'desktopLogin.expiredDetail',
        life: 6000
      })
    }
  )

  it.for([401, 500])(
    'keeps the stash on %s for the scheduled retry without a toast',
    async (status) => {
      const { trigger, seedStash, stashedCode } = await setup()
      seedStash(VALID_CODE)
      mockFetch.mockResolvedValue(new Response(null, { status }))

      await trigger()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(stashedCode()).toBe(VALID_CODE)
      expect(mockToastAdd).not.toHaveBeenCalled()
    }
  )

  it('retries once by itself, then clears the stash and shows an error toast when the budget is spent', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }))

    await trigger()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(stashedCode()).toBe(VALID_CODE)
    expect(mockToastAdd).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(stashedCode()).toBeUndefined()
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'desktopLogin.failedSummary',
      detail: 'desktopLogin.failedDetail',
      life: 6000
    })
  })

  it('forces a token refresh on the retry after a 401', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(okResponse())

    await trigger()
    expect(mockUserGetIdToken).toHaveBeenLastCalledWith(false)

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockUserGetIdToken).toHaveBeenLastCalledWith(true)
    expect(stashedCode()).toBeUndefined()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('passes a timeout signal and treats an aborted request as transient', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockFetch.mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError')
    )

    await trigger()

    expect(mockFetch).toHaveBeenCalledWith(
      REDEEM_URL,
      expectedFetchOptions(VALID_CODE)
    )
    expect(stashedCode()).toBe(VALID_CODE)
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('treats an id token failure as transient without a toast', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockUserGetIdToken.mockRejectedValue(new Error('firebase unavailable'))

    await trigger()

    expect(mockFetch).not.toHaveBeenCalled()
    // authStore.getIdToken surfaces failures through a modal error dialog,
    // which this background flow must never trigger.
    expect(mockStoreGetIdToken).not.toHaveBeenCalled()
    expect(stashedCode()).toBe(VALID_CODE)
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('clears the stash without a dialog or request for a malformed code', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash('not-a-desktop-login-code')

    await trigger()

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(stashedCode()).toBeUndefined()
  })

  it('contains an unexpected internal error instead of rejecting', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { trigger, seedStash } = await setup()
    seedStash(VALID_CODE)
    mockConfirm.mockRejectedValue(new Error('dialog exploded'))

    await expect(trigger()).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(
      '[DesktopLoginRedemption] Redemption failed:',
      expect.any(Error)
    )
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it('keeps the stash while unauthenticated and redeems via the auth watcher once a session appears', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockAuthStore.currentUser = null
    mockFetch.mockResolvedValue(okResponse())

    // The first completed navigation installs the watcher; without a session
    // nothing redeems and the stash is kept.
    await trigger()
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(stashedCode()).toBe(VALID_CODE)

    // A session appearing without any further navigation redeems via the
    // watcher.
    mockAuthStore.currentUser = {
      uid: 'user-1',
      getIdToken: mockUserGetIdToken
    }

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    expect(mockFetch).toHaveBeenCalledWith(
      REDEEM_URL,
      expectedFetchOptions(VALID_CODE)
    )
    expect(stashedCode()).toBeUndefined()
  })

  it.for([
    ['succeeded', () => mockFetch.mockResolvedValueOnce(okResponse())],
    ['was declined', () => mockConfirm.mockResolvedValueOnce(false)]
  ] as const)(
    'gives a second code its own dialog and request after the first code %s',
    async ([_label, arrangeFirstOutcome]) => {
      const { trigger, seedStash, stashedCode } = await setup()
      seedStash(VALID_CODE)
      arrangeFirstOutcome()

      await trigger()
      expect(mockConfirm).toHaveBeenCalledTimes(1)

      seedStash(SECOND_CODE)
      mockFetch.mockResolvedValue(okResponse())
      await trigger()

      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenLastCalledWith(
        REDEEM_URL,
        expect.objectContaining({ body: JSON.stringify({ code: SECOND_CODE }) })
      )
      expect(stashedCode()).toBeUndefined()
    }
  )

  it('gives a second code a fresh attempt budget after the first code exhausted its own', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }))

    await trigger()
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(stashedCode()).toBeUndefined()

    seedStash(SECOND_CODE)
    await trigger()
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(stashedCode()).toBe(SECOND_CODE)

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    expect(mockFetch).toHaveBeenCalledTimes(4)
    expect(stashedCode()).toBeUndefined()
  })

  it('re-asks for approval when the account changes after approval and redeems with the new account token', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(okResponse())

    // user-1 approves; the redeem fails transiently, keeping the code stashed.
    await trigger()
    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(stashedCode()).toBe(VALID_CODE)

    // The session changes to user-2 before the retry: user-1's approval must
    // not authorize redeeming with user-2's token.
    mockAuthStore.currentUser = {
      uid: 'user-2',
      getIdToken: vi.fn().mockResolvedValue('second-user-token')
    }

    await vi.waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    expect(mockFetch).toHaveBeenLastCalledWith(
      REDEEM_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer second-user-token'
        })
      })
    )
    expect(stashedCode()).toBeUndefined()
  })

  it('re-prompts and redeems under the new account when the session changes while the approval dialog is open', async () => {
    const { seedStash, stashedCode, trigger } = await setup()
    seedStash(VALID_CODE)
    let approve!: (value: boolean) => void
    mockConfirm.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        approve = resolve
      })
    )
    mockFetch.mockResolvedValue(okResponse())

    await trigger()
    await vi.waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1))

    // The session swaps to user-2 while user-1's dialog is open: the stale
    // approval must not redeem, and the raced auth trigger is replayed to
    // re-prompt under user-2 without another navigation.
    const secondUser = {
      uid: 'user-2',
      getIdToken: vi.fn().mockResolvedValue('second-user-token')
    }
    mockAuthStore.currentUser = secondUser
    await flushRedemption()
    approve(true)
    await flushRedemption()

    await vi.waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    expect(mockFetch).toHaveBeenCalledWith(
      REDEEM_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer second-user-token'
        })
      })
    )
    expect(stashedCode()).toBeUndefined()
  })

  it.for([
    ['succeeds', () => okResponse()],
    ['fails terminally', () => new Response(null, { status: 404 })]
  ] as const)(
    'processes a newer code stashed mid-flight after the older redemption %s',
    async ([_label, firstResponse]) => {
      const { trigger, seedStash, stashedCode } = await setup()
      seedStash(VALID_CODE)
      let resolveFirstFetch!: (response: Response) => void
      mockFetch.mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirstFetch = resolve
        })
      )

      await trigger()
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))

      // A second code arrives while the first redemption is in flight; it
      // must survive the first's settlement and be processed right after.
      seedStash(SECOND_CODE)
      mockFetch.mockResolvedValue(okResponse())
      resolveFirstFetch(firstResponse())

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
      expect(mockConfirm).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenLastCalledWith(
        REDEEM_URL,
        expect.objectContaining({ body: JSON.stringify({ code: SECOND_CODE }) })
      )
      expect(stashedCode()).toBeUndefined()
    }
  )

  it('coalesces concurrent triggers into one dialog and one request', async () => {
    const { router, seedStash } = await setup()
    seedStash(VALID_CODE)
    let approve!: (value: boolean) => void
    mockConfirm.mockReturnValue(
      new Promise<boolean>((resolve) => {
        approve = resolve
      })
    )
    mockFetch.mockResolvedValue(okResponse())

    await router.push('/burst-1')
    await router.push('/burst-2')
    await vi.waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1))

    approve(true)
    await flushRedemption()

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
