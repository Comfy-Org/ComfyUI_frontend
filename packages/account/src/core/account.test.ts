import { describe, expect, it } from 'vitest'
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
        status: 200,
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
    setBalance: (value: unknown) => (balanceBody = value),
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
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(fake.trace).toHaveLength(2)
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
  expect(billing.getCreditsState().phase).not.toBe('value')
})

it('TP-3a: clear failure reports failure while remaining signed out', async () => {
  const fake = adapter()
  const client = createSessionClient(fake.host)
  await client.establishSession()
  fake.failClear()
  expect((await client.clearSession()).ok).toBe(false)
  expect(client.getState().phase).toBe('signed-out')
})
