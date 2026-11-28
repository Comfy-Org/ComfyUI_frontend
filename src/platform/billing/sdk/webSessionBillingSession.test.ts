import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

import type { AccountCredential } from '@comfyorg/account-core/session'
import { createSessionBillingTransport } from '@comfyorg/account-core/billing'
import type { BillingResult } from '@comfyorg/account-core/billing'
import type { SessionTokenResult } from '@comfyorg/account-core/sessionTokenMint'
import type {
  WebSession,
  WebSessionErrorCode
} from '@comfyorg/account-core/webSession'

import type {
  WebSessionRequestScope,
  WebSessionRequests
} from '@comfyorg/api-client/webSessionFetch'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { createWebSessionBillingSession } from '@/platform/billing/sdk/webSessionBillingSession'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

vi.mock(import('firebase/auth'))

const WEB_SESSION: WebSession = {
  user: {
    id: 'uid-1',
    email: 'user@example.com',
    emailVerified: true
  },
  csrfToken: 'csrf-token',
  expiresAt: Date.now() + 60 * 60 * 1000,
  absoluteExpiresAt: Date.now() + 24 * 60 * 60 * 1000
}

const REQUEST_SCOPE: WebSessionRequestScope = {
  session: WEB_SESSION,
  epoch: 1,
  workspaceId: 'ws-1'
}

const CREDENTIAL: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60 * 60 * 1000,
  uid: 'uid-1',
  workspace: { id: 'ws-1', name: 'Team', type: 'team' },
  role: 'owner',
  permissions: ['workspace:read']
}

const MINTED = {
  status: 'ok',
  credential: CREDENTIAL
} as const satisfies SessionTokenResult

const REQUEST_FAILED = {
  status: 'error',
  code: 'REQUEST_FAILED'
} as const satisfies BillingResult<never>

const STILL_PENDING = Symbol('still pending')

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setBillingScope() {
  useCloudWebSessionStore().state = {
    phase: 'signed_in',
    session: WEB_SESSION
  }
  useWorkspaceAuthStore().currentWorkspace = {
    id: 'ws-1',
    name: 'Team',
    type: 'team',
    role: 'owner'
  }
}

function abortAwareFetch(
  responses: Response[] = [Response.json({ ok: true })]
): MockedFunction<typeof fetch> {
  const queue = [...responses]
  return vi.fn<typeof fetch>(async (_input, init) => {
    init?.signal?.throwIfAborted()
    return queue.shift() ?? Response.json({ ok: true })
  })
}

function actualTransport(
  requests: Pick<
    WebSessionRequests,
    'scope' | 'workspaceToken' | 'remintWorkspaceToken'
  >,
  fetchImpl = abortAwareFetch()
) {
  setBillingScope()
  const session = createWebSessionBillingSession(
    fromPartial<WebSessionRequests>({
      ...requests,
      workspaceId: () => 'ws-1'
    })
  )
  const transport = createSessionBillingTransport({
    session,
    resolveUrl: (route) => `https://cloud.test${route}`,
    workspaceId: () => 'ws-1',
    fetchImpl
  })
  return { transport, fetchImpl }
}

async function observedPromptly<T>(promise: Promise<T>) {
  const observed = Promise.race([
    promise,
    new Promise<typeof STILL_PENDING>((resolve) =>
      setTimeout(() => resolve(STILL_PENDING), 0)
    )
  ])
  await vi.advanceTimersByTimeAsync(0)
  return observed
}

function refusedWith(code: WebSessionErrorCode) {
  const failure = {
    status: 'error',
    code,
    retryable: false,
    httpStatus: 403
  } as const
  return createWebSessionBillingSession(
    fromPartial<WebSessionRequests>({
      scope: async () => fromPartial({ epoch: 1 }),
      workspaceToken: async () => failure,
      remintWorkspaceToken: async () => failure
    })
  )
}

describe('the web-session billing session', () => {
  it.for([
    ['SSO_REQUIRED', 'SSO_REQUIRED'],
    ['WORKSPACE_ACCESS_DENIED', 'ACCESS_DENIED'],
    ['SESSION_UNAVAILABLE', 'TOKEN_EXCHANGE_FAILED']
  ] as const)(
    'reports a %s mint refusal to billing as %s',
    async ([code, expected]) => {
      const session = refusedWith(code)

      expect(await session.ensureFresh(undefined)).toEqual({
        status: 'error',
        code: expected,
        httpStatus: 403
      })
      expect(await session.remint(undefined)).toEqual({
        status: 'error',
        code: expected,
        httpStatus: 403
      })
    }
  )

  it('does not start session work for a pre-aborted billing request', async () => {
    const mint = deferred<SessionTokenResult>()
    const scope = vi.fn(async () => REQUEST_SCOPE)
    const workspaceToken = vi.fn(() => mint.promise)
    const { transport, fetchImpl } = actualTransport({
      scope,
      workspaceToken,
      remintWorkspaceToken: workspaceToken
    })

    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      signal: AbortSignal.abort()
    })
    const observed = await observedPromptly(pending)
    const callsBeforeRelease = {
      scope: scope.mock.calls.length,
      mint: workspaceToken.mock.calls.length,
      fetch: fetchImpl.mock.calls.length
    }
    mint.resolve(MINTED)
    await pending

    expect(observed).toEqual(REQUEST_FAILED)
    expect(callsBeforeRelease).toEqual({ scope: 0, mint: 0, fetch: 0 })
  })

  it('does not start a late mint after cancellation while reading scope', async () => {
    const scopeResult = deferred<WebSessionRequestScope | undefined>()
    const scope = vi.fn(() => scopeResult.promise)
    const workspaceToken = vi.fn(async () => MINTED)
    const { transport, fetchImpl } = actualTransport({
      scope,
      workspaceToken,
      remintWorkspaceToken: workspaceToken
    })
    const caller = new AbortController()
    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      signal: caller.signal
    })
    await vi.advanceTimersByTimeAsync(0)

    caller.abort()
    const observed = await observedPromptly(pending)
    const callsBeforeRelease = {
      mint: workspaceToken.mock.calls.length,
      fetch: fetchImpl.mock.calls.length
    }
    scopeResult.resolve(REQUEST_SCOPE)
    await pending

    expect(observed).toEqual(REQUEST_FAILED)
    expect(callsBeforeRelease).toEqual({ mint: 0, fetch: 0 })
    expect(workspaceToken).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('settles cancellation during minting and observes a late mint failure', async () => {
    const mint = deferred<SessionTokenResult>()
    const workspaceToken = vi.fn(() => mint.promise)
    const { transport, fetchImpl } = actualTransport({
      scope: async () => REQUEST_SCOPE,
      workspaceToken,
      remintWorkspaceToken: workspaceToken
    })
    const caller = new AbortController()
    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      signal: caller.signal
    })
    await vi.advanceTimersByTimeAsync(0)

    caller.abort()
    const observed = await observedPromptly(pending)
    mint.reject(new TypeError('late mint failure'))
    await pending
    await vi.advanceTimersByTimeAsync(0)

    expect(observed).toEqual(REQUEST_FAILED)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not fetch after a cancelled mint succeeds late', async () => {
    const mint = deferred<SessionTokenResult>()
    const workspaceToken = vi.fn(() => mint.promise)
    const { transport, fetchImpl } = actualTransport({
      scope: async () => REQUEST_SCOPE,
      workspaceToken,
      remintWorkspaceToken: workspaceToken
    })
    const caller = new AbortController()
    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      signal: caller.signal
    })
    await vi.advanceTimersByTimeAsync(0)

    caller.abort()
    const observed = await observedPromptly(pending)
    mint.resolve(MINTED)
    await pending
    await vi.advanceTimersByTimeAsync(0)

    expect(observed).toEqual(REQUEST_FAILED)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('includes web-session minting in the billing request deadline', async () => {
    const mint = deferred<SessionTokenResult>()
    const workspaceToken = vi.fn(() => mint.promise)
    const { transport, fetchImpl } = actualTransport({
      scope: async () => REQUEST_SCOPE,
      workspaceToken,
      remintWorkspaceToken: workspaceToken
    })
    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      timeoutMs: 10_000
    })
    await vi.advanceTimersByTimeAsync(10_000)

    const observed = await observedPromptly(pending)
    mint.resolve(MINTED)
    await pending
    await vi.advanceTimersByTimeAsync(0)

    expect(observed).toEqual(REQUEST_FAILED)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not retry after the shared deadline expires during a 401 re-mint', async () => {
    const remint = deferred<SessionTokenResult>()
    const fetchImpl = abortAwareFetch([
      Response.json({}, { status: 401 }),
      Response.json({ ok: true })
    ])
    const { transport } = actualTransport(
      {
        scope: async () => REQUEST_SCOPE,
        workspaceToken: async () => MINTED,
        remintWorkspaceToken: () => remint.promise
      },
      fetchImpl
    )
    const pending = transport({
      method: 'GET',
      route: '/billing/status',
      timeoutMs: 10_000
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchImpl).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(10_000)

    const observed = await observedPromptly(pending)
    remint.resolve({
      status: 'ok',
      credential: { ...CREDENTIAL, token: 'reminted-jwt' }
    })
    await pending
    await vi.advanceTimersByTimeAsync(0)

    expect(observed).toEqual(REQUEST_FAILED)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('cancels one caller without cancelling its shared mint or another caller', async () => {
    const sharedMint = deferred<SessionTokenResult>()
    const workspaceToken = vi.fn(() => sharedMint.promise)
    const { transport, fetchImpl } = actualTransport({
      scope: async () => REQUEST_SCOPE,
      workspaceToken,
      remintWorkspaceToken: workspaceToken
    })
    const caller = new AbortController()
    const cancelled = transport({
      method: 'GET',
      route: '/billing/status',
      signal: caller.signal
    })
    const continuing = transport({
      method: 'GET',
      route: '/billing/status'
    })
    await vi.advanceTimersByTimeAsync(0)

    caller.abort()
    const cancelledObservation = await observedPromptly(cancelled)
    const continuingObservation = await observedPromptly(continuing)
    sharedMint.resolve(MINTED)
    const continuingResult = await continuing
    await cancelled

    expect(cancelledObservation).toEqual(REQUEST_FAILED)
    expect(continuingObservation).toBe(STILL_PENDING)
    expect(continuingResult).toMatchObject({
      status: 'ok',
      value: { httpStatus: 200 }
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
})
