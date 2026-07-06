import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

/**
 * Tests for the router-installed redemption of desktop login codes.
 *
 * The code lives only in the preserved-query stash (the tracker strips it
 * from the URL at capture time); redemption fires from router.afterEach and
 * an auth watcher, so every test drives a real in-memory router:
 * - Redemption requires explicit user approval, asked once per code
 * - A valid code with an authenticated user is redeemed exactly once
 * - A session appearing without any navigation redeems via the auth watcher
 * - Terminal backend responses (400/403/404/409/410) drop the code with an
 *   error toast
 * - Transient failures (network/timeout/5xx) schedule one delayed in-page
 *   retry; once the per-code attempt budget is spent the code is dropped
 *   with an error toast
 * - Each distinct code gets its own approval and attempt budget
 * - Unauthenticated sessions keep the stash for a later trigger
 *
 * The fake clock (installed for every test) keeps the retry timers scheduled
 * by transient failures from leaking into later tests: afterEach discards
 * them with vi.useRealTimers().
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
  currentUser: { uid: string; getIdToken: () => Promise<string> } | null
  getIdToken: () => Promise<string>
}

const mockUserGetIdToken = vi.hoisted(() => vi.fn())
const mockStoreGetIdToken = vi.hoisted(() => vi.fn())

// The store must be reactive so the module's watcher on currentUser fires
// without a navigation. The mock factory result is cached across
// vi.resetModules(), so the factory reads a hoisted holder that beforeEach
// refills with a fresh reactive store per test: the never-stopped watchers
// from earlier tests' module generations stay subscribed to earlier stores
// and remain dormant.
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

// vi.resetModules() gives each test a fresh module-scoped redemption state,
// but it also resets the preserved-query manager's in-memory map, so the
// manager must be imported in the same registry generation as the module
// under test.
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

  it('re-asks for approval when a different code arrives after a transient failure', async () => {
    const { trigger, seedStash } = await setup()
    seedStash(VALID_CODE)
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(okResponse())

    await trigger()
    expect(mockConfirm).toHaveBeenCalledTimes(1)

    seedStash(SECOND_CODE)
    await trigger()

    expect(mockConfirm).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenLastCalledWith(
      REDEEM_URL,
      expect.objectContaining({ body: JSON.stringify({ code: SECOND_CODE }) })
    )
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

      seedStash(VALID_CODE)
      await trigger()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(stashedCode()).toBeUndefined()
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

    // The budget is spent: re-capturing the dead code and waiting out another
    // retry window never fires a third attempt.
    seedStash(VALID_CODE)
    await trigger()
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    expect(mockFetch).toHaveBeenCalledTimes(2)
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
    // The token must come straight from the Firebase user:
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

  it('keeps the stash while unauthenticated and redeems once a session appears before a later trigger', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockAuthStore.currentUser = null

    await trigger()

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(stashedCode()).toBe(VALID_CODE)

    mockFetch.mockResolvedValue(okResponse())
    mockAuthStore.currentUser = {
      uid: 'user-1',
      getIdToken: mockUserGetIdToken
    }
    await trigger()

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(stashedCode()).toBeUndefined()
  })

  it('redeems through the auth watcher when a session appears without any navigation', async () => {
    const { trigger, seedStash, stashedCode } = await setup()
    seedStash(VALID_CODE)
    mockAuthStore.currentUser = null
    mockFetch.mockResolvedValue(okResponse())

    // The first completed navigation installs the watcher; without a session
    // nothing redeems yet.
    await trigger()
    expect(mockFetch).not.toHaveBeenCalled()

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
