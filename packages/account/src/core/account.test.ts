import { describe, expect, it, vi } from 'vitest'
import {
  AccountError,
  MalformedResponseError,
  createBillingClient,
  createSessionClient
} from './index'
import type {
  AccountHostAdapter,
  SchedulerPort,
  TransportRequest,
  WorkspaceCredential
} from './index'

class FakeScheduler implements SchedulerPort {
  time = 0
  next = 1
  jobs = new Map<number, { at: number; fn: () => void }>()
  now = () => this.time
  schedule(fn: () => void, delayMs: number) {
    const id = this.next++
    this.jobs.set(id, { at: this.time + delayMs, fn })
    return id
  }
  cancel(handle: unknown) {
    if (typeof handle === 'number') this.jobs.delete(handle)
  }
  advance(ms: number) {
    this.time += ms
    const due = [...this.jobs].filter(([, job]) => job.at <= this.time)
    for (const [id, job] of due) {
      this.jobs.delete(id)
      job.fn()
    }
  }
}

function credential(
  workspaceId: string,
  expiresAt = 600_000
): WorkspaceCredential {
  return { token: `token-${workspaceId}`, workspaceId, expiresAt }
}

function adapter(kind: 'map' | 'json' = 'map') {
  const scheduler = new FakeScheduler()
  const records = new Map<string, unknown>()
  const trace: TransportRequest<unknown>[] = []
  let workspace = 'A'
  let exchangeBody: unknown = credential('A')
  let balanceBody: unknown = { balance: 7 }
  let balanceStatus = 200
  let clearFails = false
  const key = (value: {
    namespace: string
    userId: string
    workspaceId: string
  }) =>
    kind === 'map'
      ? `${value.namespace}:${value.userId}:${value.workspaceId}`
      : JSON.stringify(value)
  const host: AccountHostAdapter = {
    namespace: `fake-${kind}`,
    scheduler,
    acquireIdentity: async () => ({ userId: 'user', token: 'identity' }),
    getActiveWorkspace: () => workspace,
    storage: {
      read: async (value) => records.get(key(value)) ?? null,
      write: async (value, record) => void records.set(key(value), record),
      clear: async (value) => {
        if (clearFails) throw new Error('disk')
        records.delete(key(value))
      }
    },
    operations: {
      exchange: {
        idempotent: true,
        makeRequest: ({ identity, workspaceId }, signal) => ({
          method: 'POST',
          path: '/auth/token',
          headers: {},
          body: { identityToken: identity.token, workspaceId },
          signal
        }),
        response: { decode: (value) => decodeCredential(value) },
        mapError: (status) => new AccountError(`exchange ${status}`, status)
      },
      balance: {
        idempotent: true,
        makeRequest: (_input, signal) => ({
          method: 'GET',
          path: '/billing/balance',
          headers: {},
          signal
        }),
        response: { decode: (value) => decodeBalance(value) },
        mapError: (status) => new AccountError(`balance ${status}`, status)
      }
    },
    transport: async (request) => {
      trace.push(request)
      return {
        status: request.path.includes('balance') ? balanceStatus : 200,
        body: request.path.includes('balance') ? balanceBody : exchangeBody
      }
    }
  }
  return {
    host,
    scheduler,
    records,
    trace,
    setWorkspace: (value: string) => (workspace = value),
    setExchange: (value: unknown) => (exchangeBody = value),
    setBalance: (value: unknown, status = 200) => {
      balanceBody = value
      balanceStatus = status
    },
    failClear: () => (clearFails = true)
  }
}

function decodeCredential(value: unknown): WorkspaceCredential {
  if (
    !value ||
    typeof value !== 'object' ||
    !('token' in value) ||
    !('workspaceId' in value) ||
    !('expiresAt' in value)
  )
    throw new MalformedResponseError()
  const item = value as Record<string, unknown>
  if (
    typeof item.token !== 'string' ||
    typeof item.workspaceId !== 'string' ||
    typeof item.expiresAt !== 'number'
  )
    throw new MalformedResponseError()
  return {
    token: item.token,
    workspaceId: item.workspaceId,
    expiresAt: item.expiresAt
  }
}

function decodeBalance(value: unknown): { balance: number } {
  if (
    !value ||
    typeof value !== 'object' ||
    !('balance' in value) ||
    typeof (value as Record<string, unknown>).balance !== 'number'
  )
    throw new MalformedResponseError()
  return { balance: (value as { balance: number }).balance }
}

describe.for(['map', 'json'] as const)(
  'TP-3a adapter %s conformance',
  (kind) => {
    it('TP-1a: restores, exchanges, persists, reads balance, and clears', async () => {
      const fake = adapter(kind)
      const first = createSessionClient(fake.host)
      await first.establishSession()
      const second = createSessionClient(fake.host)
      await second.bootstrap()
      expect(second.getState().phase).toBe('authenticated')
      const billing = createBillingClient(second, fake.host)
      await billing.refreshCredits()
      expect(billing.getCreditsState()).toEqual({
        phase: 'value',
        value: { balance: 7 }
      })
      expect((await second.clearSession()).ok).toBe(true)
    })

    it('TP-3a PM-3: corrupt and mismatched records fail closed', async () => {
      const fake = adapter(kind)
      fake.records.set(
        kind === 'map'
          ? 'fake-map:user:A'
          : JSON.stringify({
              namespace: 'fake-json',
              userId: 'user',
              workspaceId: 'A'
            }),
        { bad: true }
      )
      const client = createSessionClient(fake.host)
      await client.bootstrap()
      expect(client.getState().phase).toBe('signed-out')
    })
  }
)

it('TP-2a PM-4: refresh fires at expiry minus five minutes, not one ms earlier', async () => {
  const fake = adapter()
  const client = createSessionClient(fake.host)
  await client.establishSession()
  expect(fake.trace).toHaveLength(1)
  fake.scheduler.advance(299_999)
  expect(fake.trace).toHaveLength(1)
  fake.scheduler.advance(1)
  await vi.waitFor(() => expect(fake.trace).toHaveLength(2))
})

it('TP-2a S146: transient refresh retains credential and caps retry', async () => {
  const fake = adapter()
  const client = createSessionClient(fake.host)
  await client.establishSession()
  fake.host.transport = async () => {
    throw new AccountError('offline')
  }
  await expect(client.refresh()).rejects.toThrow('offline')
  const state = client.getState()
  expect(state.phase).toBe('authenticated')
  if (state.phase === 'authenticated')
    expect(state.refreshError?.message).toBe('offline')
  expect(
    [...fake.scheduler.jobs.values()].every(
      (job) => job.at - fake.scheduler.time <= 300_000
    )
  ).toBe(true)
})

it('TP-2b: idempotent 401 replays once; unsafe and second 401 do not loop', async () => {
  const fake = adapter()
  let calls = 0
  fake.host.transport = async () => ({
    status: ++calls <= 2 ? 401 : 200,
    body: {}
  })
  const client = createSessionClient(fake.host)
  await expect(client.establishSession()).rejects.toThrow('exchange 401')
  expect(calls).toBe(2)
  fake.host.operations.exchange.idempotent = false
  calls = 0
  await expect(client.establishSession()).rejects.toThrow('exchange 401')
  expect(calls).toBe(1)
})

it('regression: balance 401 refreshes the session and replays with the new credential', async () => {
  const fake = adapter()
  let exchanges = 0
  let balanceCalls = 0
  fake.host.operations.balance.makeRequest = ({ credential }, signal) => ({
    method: 'GET',
    path: '/billing/balance',
    headers: { authorization: credential.token },
    signal
  })
  fake.host.transport = async (request) => {
    fake.trace.push(request)
    if (request.path.includes('auth')) {
      exchanges++
      return {
        status: 200,
        body: {
          ...credential('A', 600_000 + exchanges),
          token: `token-${exchanges}`
        }
      }
    }
    balanceCalls++
    return balanceCalls === 1
      ? { status: 401, body: {} }
      : { status: 200, body: { balance: 7 } }
  }
  const session = createSessionClient(fake.host)
  await session.establishSession()
  const billing = createBillingClient(session, fake.host)

  await billing.refreshCredits()

  expect(balanceCalls).toBe(2)
  expect(exchanges).toBe(2)
  expect(fake.trace.at(-1)?.headers.authorization).toBe('token-2')
  expect(billing.getCreditsState()).toEqual({
    phase: 'value',
    value: { balance: 7 }
  })
})

it('TP-4 PM-3: credits preserve 7, 0, -2 and reject malformed payloads', async () => {
  const fake = adapter()
  const session = createSessionClient(fake.host)
  await session.establishSession()
  const billing = createBillingClient(session, fake.host)
  for (const balance of [7, 0, -2]) {
    fake.setBalance({ balance })
    await billing.refreshCredits()
    expect(billing.getCreditsState()).toEqual({
      phase: 'value',
      value: { balance }
    })
  }
  fake.setBalance({ balance: 'bad' })
  const observed: string[] = []
  billing.subscribeCredits((state) => observed.push(state.phase))
  await billing.refreshCredits()
  expect(billing.getCreditsState().phase).toBe('error')
  expect(observed).toEqual(['loading', 'error'])
  fake.setBalance({ message: 'boom' }, 500)
  await billing.refreshCredits()
  expect(billing.getCreditsState().phase).toBe('error')
})

it('TP-4 PM-2: a late workspace A balance cannot replace B', async () => {
  const fake = adapter()
  const session = createSessionClient(fake.host)
  await session.establishSession()
  const billing = createBillingClient(session, fake.host)
  let release: ((value: { status: number; body: unknown }) => void) | undefined
  fake.host.transport = (request) =>
    request.path.includes('balance')
      ? new Promise((resolve) => (release = resolve))
      : Promise.resolve({ status: 200, body: credential('B') })
  const pending = billing.refreshCredits()
  fake.setWorkspace('B')
  await session.switchWorkspace('B')
  release?.({ status: 200, body: { balance: 99 } })
  await pending
  expect(billing.getCreditsState().phase).toBe('idle')
})

it('does not restore a cleared session after an in-flight refresh fails', async () => {
  const fake = adapter()
  const client = createSessionClient(fake.host)
  await client.establishSession()
  let rejectRefresh: ((error: Error) => void) | undefined
  fake.host.transport = () =>
    new Promise((_resolve, reject) => {
      rejectRefresh = reject
    })

  const pending = client.refresh()
  await client.clearSession()
  rejectRefresh?.(new AccountError('offline'))

  await expect(pending).rejects.toThrow('offline')
  expect(client.getState().phase).toBe('signed-out')
  expect(fake.scheduler.jobs.size).toBe(0)
})

it('billing dispose unsubscribes from the session and clears listeners', async () => {
  const fake = adapter()
  const session = createSessionClient(fake.host)
  await session.establishSession()
  const billing = createBillingClient(session, fake.host)
  const listener = vi.fn()
  billing.subscribeCredits(listener)
  await billing.refreshCredits()
  listener.mockClear()

  billing.dispose()
  await session.clearSession()

  expect(listener).not.toHaveBeenCalled()
  expect(billing.getCreditsState().phase).toBe('value')
})

it('TP-3a: clear failure reports failure while remaining signed out', async () => {
  const fake = adapter()
  const client = createSessionClient(fake.host)
  await client.establishSession()
  fake.failClear()
  expect((await client.clearSession()).ok).toBe(false)
  expect(client.getState().phase).toBe('signed-out')
})
