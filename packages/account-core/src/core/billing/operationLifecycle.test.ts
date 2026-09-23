import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../session.js'
import type { AccountCredential } from '../sessionContracts.js'
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import { sessionBillingScopeSource } from './billingScope.js'
import type {
  BillingOperationLifecycleOptions,
  BillingOperationTelemetryEvent,
  IssuedBillingOperation
} from './operationLifecycle.js'
import {
  createBillingOperationLifecycle,
  operationRoute
} from './operationLifecycle.js'
import type { BillingOperationPointerStorage } from './operationPointer.js'
import { operationPointerKey } from './operationPointer.js'
import {
  OPERATION_POLL_BUDGET,
  OPERATION_POLL_TIMING
} from './operationPolicy.js'
import type {
  BillingOpStatus,
  HostedBillingDestination
} from './operationState.js'
import type {
  BillingStatusData,
  BillingStatusReader,
  BillingStatusSnapshot
} from './status.js'

const NOW = 1_000_000
const SCOPE = { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' } as const

function credential(
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  return {
    token: 'workspace-jwt',
    expiresAt: NOW + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read'],
    ...overrides
  }
}

function authenticated(session: AccountCredential): SessionSnapshot {
  return {
    phase: 'authenticated',
    user: { uid: session.uid, getIdToken: async () => 'id-token' },
    session
  }
}

const SIGNED_OUT: SessionSnapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

type SessionFake = Pick<SessionClient, 'getSnapshot' | 'subscribe'>

function fakeSession(initial: SessionSnapshot = authenticated(credential())) {
  let snapshot = initial
  const listeners = new Set<(next: SessionSnapshot) => void>()
  const fake: SessionFake = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  return {
    scopeSource: sessionBillingScopeSource(fake),
    moveTo(next: SessionSnapshot) {
      snapshot = next
      for (const listener of [...listeners]) listener(snapshot)
    }
  }
}

const STATUS_DATA: BillingStatusData = {
  billing_rail: 'stripe',
  has_funds: true,
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  team_credit_stop: null
}

function statusSnapshot(
  overrides: Partial<BillingStatusData> = {}
): BillingResult<BillingStatusSnapshot> {
  return {
    status: 'ok',
    value: {
      status: { ...STATUS_DATA, ...overrides },
      scope: SCOPE,
      readAt: NOW
    }
  }
}

function fakeStatusReader(initial: BillingResult<BillingStatusSnapshot>) {
  let answer = initial
  const read = vi.fn(async () => answer)
  const reader: BillingStatusReader = {
    read,
    getSnapshot: () => undefined,
    dispose: () => {}
  }
  return {
    reader,
    read,
    answer(next: BillingResult<BillingStatusSnapshot>) {
      answer = next
    }
  }
}

function opStatus(overrides: Partial<BillingOpStatus> = {}): BillingOpStatus {
  return {
    id: 'op-1',
    status: 'pending',
    started_at: '2026-09-14T00:00:00.000Z',
    ...overrides
  }
}

function httpOk(body: unknown): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: 200, body, header: () => null }
  }
}

function httpStatus(status: number): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: status, body: {}, header: () => null }
  }
}

type TransportAnswer =
  | BillingResult<BillingHttpResponse>
  | Promise<BillingResult<BillingHttpResponse>>

/** Answers are consumed in order; the last one repeats. */
function fakeTransport(answers: TransportAnswer[]) {
  const calls: BillingRequest[] = []
  const transport: BillingTransport = vi.fn(async (request) => {
    calls.push(request)
    return answers[Math.min(calls.length - 1, answers.length - 1)]
  })
  return { transport, calls }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function memoryStorage(): BillingOperationPointerStorage & {
  entries: Map<string, string>
} {
  const entries = new Map<string, string>()
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key)
  }
}

function storedPointer(storage: BillingOperationPointerStorage) {
  const raw = storage.getItem(operationPointerKey(SCOPE))
  return raw === null ? undefined : (JSON.parse(raw) as unknown)
}

function harness(options: {
  answers?: TransportAnswer[]
  status?: BillingResult<BillingStatusSnapshot>
  embedded?: boolean
  destination?: HostedBillingDestination
  session?: ReturnType<typeof fakeSession>
  storage?: BillingOperationPointerStorage
}) {
  const destination = { current: options.destination ?? 'stripe' }
  const session = options.session ?? fakeSession()
  const status = fakeStatusReader(options.status ?? statusSnapshot())
  const { transport, calls } = fakeTransport(
    options.answers ?? [httpOk(opStatus())]
  )
  const storage = options.storage ?? memoryStorage()
  const telemetry: BillingOperationTelemetryEvent[] = []
  const lifecycleOptions: BillingOperationLifecycleOptions = {
    transport,
    scopeSource: session.scopeSource,
    statusReader: status.reader,
    pointerStorage: storage,
    embeddedCheckoutAvailable: () => options.embedded === true,
    ...(options.destination === undefined
      ? {}
      : { hostedDestination: () => destination.current }),
    onTelemetry: (event) => telemetry.push(event)
  }
  return {
    lifecycle: createBillingOperationLifecycle(lifecycleOptions),
    destination,
    session,
    status,
    calls,
    storage,
    telemetry
  }
}

const issued =
  (value: IssuedBillingOperation = { operationId: 'op-1' }) =>
  async (): Promise<BillingResult<IssuedBillingOperation>> => ({
    status: 'ok',
    value
  })

const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('createBillingOperationLifecycle', () => {
  describe('begin', () => {
    it('issues the command and observes the returned operation to success', async () => {
      const { lifecycle, calls, storage, telemetry } = harness({
        answers: [httpOk(opStatus()), httpOk(opStatus({ status: 'succeeded' }))]
      })
      const issue = vi.fn(issued())

      const began = await lifecycle.begin('topup', issue)
      expect(began).toMatchObject({
        status: 'ok',
        value: {
          id: 'op-1',
          kind: 'topup',
          phase: 'pending',
          presentation: 'hosted'
        }
      })
      expect(issue).toHaveBeenCalledWith(SCOPE)
      expect(storedPointer(storage)).toMatchObject({ operationId: 'op-1' })

      await flush()
      expect(calls.map((call) => call.route)).toEqual([operationRoute('op-1')])
      await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.initialMs * 1.5)

      await expect(lifecycle.settled('op-1')).resolves.toMatchObject({
        phase: 'succeeded',
        id: 'op-1'
      })
      expect(storedPointer(storage)).toBeUndefined()
      expect(telemetry).toEqual([
        {
          name: 'billing.operation.started',
          billing_op_id: 'op-1',
          operation_type: 'topup',
          presentation: 'hosted',
          resumed: false
        },
        expect.objectContaining({
          name: 'billing.operation.succeeded',
          billing_op_id: 'op-1',
          resumed: false,
          duration_ms: OPERATION_POLL_TIMING.initialMs * 1.5
        })
      ])
    })

    it("adopts the backend's pending operation of the same kind instead of issuing a second", async () => {
      const { lifecycle, telemetry } = harness({
        status: statusSnapshot({
          pending_billing_op_id: 'op-9',
          pending_billing_op_type: 'topup',
          action_url: 'https://billing.example/continue'
        }),
        answers: [httpOk(opStatus({ id: 'op-9' }))]
      })
      const issue = vi.fn(issued())

      const began = await lifecycle.begin('topup', issue)

      expect(issue).not.toHaveBeenCalled()
      expect(began).toMatchObject({
        status: 'ok',
        value: {
          id: 'op-9',
          actionUrl: 'https://billing.example/continue',
          customerActionSeen: true
        }
      })
      expect(telemetry[0]).toMatchObject({
        name: 'billing.operation.started',
        billing_op_id: 'op-9',
        resumed: true
      })
    })

    it('shares one in-flight command per kind', async () => {
      const { lifecycle } = harness({})
      const gate = deferred<BillingResult<IssuedBillingOperation>>()
      const issue = vi.fn(() => gate.promise)

      const first = lifecycle.begin('topup', issue)
      const second = lifecycle.begin('topup', issue)
      await flush()
      gate.resolve({ status: 'ok', value: { operationId: 'op-1' } })

      expect(await first).toBe(await second)
      expect(issue).toHaveBeenCalledTimes(1)
    })

    it('does not let a superseded command stand in for the new scope', async () => {
      const session = fakeSession()
      const { lifecycle } = harness({ session })
      const gate = deferred<BillingResult<IssuedBillingOperation>>()
      const stale = vi.fn(() => gate.promise)
      const fresh = vi.fn(issued({ operationId: 'op-2' }))

      const first = lifecycle.begin('topup', stale)
      await flush()
      session.moveTo(
        authenticated(
          credential({
            workspace: { id: 'ws-2', name: 'Team', type: 'team' }
          })
        )
      )
      const second = lifecycle.begin('topup', fresh)
      gate.resolve({ status: 'ok', value: { operationId: 'op-1' } })
      await flush()

      await expect(first).resolves.toEqual({
        status: 'error',
        code: 'SUPERSEDED'
      })
      expect(fresh).toHaveBeenCalledTimes(1)
      await expect(second).resolves.toMatchObject({
        status: 'ok',
        value: { id: 'op-2' }
      })
    })

    it('does not issue when the status read fails', async () => {
      const { lifecycle } = harness({
        status: { status: 'error', code: 'REQUEST_FAILED' }
      })
      const issue = vi.fn(issued())

      await expect(lifecycle.begin('topup', issue)).resolves.toEqual({
        status: 'error',
        code: 'REQUEST_FAILED'
      })
      expect(issue).not.toHaveBeenCalled()
    })

    it('reports SUPERSEDED for a command issued as the workspace changed, keeping the pointer for that workspace', async () => {
      const session = fakeSession()
      const { lifecycle, storage, calls } = harness({ session })
      const gate = deferred<BillingResult<IssuedBillingOperation>>()

      const began = lifecycle.begin('topup', () => gate.promise)
      await flush()
      session.moveTo(
        authenticated(
          credential({
            workspace: { id: 'ws-2', name: 'Team', type: 'team' }
          })
        )
      )
      gate.resolve({ status: 'ok', value: { operationId: 'op-1' } })

      await expect(began).resolves.toEqual({
        status: 'error',
        code: 'SUPERSEDED'
      })
      expect(storedPointer(storage)).toMatchObject({ operationId: 'op-1' })
      expect(lifecycle.get('op-1')).toBeUndefined()
      expect(calls).toHaveLength(0)
    })

    it('reports SUPERSEDED, not the read failure, when the workspace changes under a failing status read', async () => {
      const session = fakeSession()
      const { lifecycle } = harness({
        session,
        status: { status: 'error', code: 'REQUEST_FAILED' }
      })
      const issue = vi.fn(issued())

      const began = lifecycle.begin('topup', issue)
      session.moveTo(
        authenticated(
          credential({
            workspace: { id: 'ws-2', name: 'Team', type: 'team' }
          })
        )
      )

      await expect(began).resolves.toEqual({
        status: 'error',
        code: 'SUPERSEDED'
      })
      expect(issue).not.toHaveBeenCalled()
    })

    it('reports SUPERSEDED, not the command failure, when the workspace changes under a failing command, writing no pointer', async () => {
      const session = fakeSession()
      const { lifecycle, storage } = harness({ session })
      const gate = deferred<BillingResult<IssuedBillingOperation>>()

      const began = lifecycle.begin('topup', () => gate.promise)
      await flush()
      session.moveTo(
        authenticated(
          credential({
            workspace: { id: 'ws-2', name: 'Team', type: 'team' }
          })
        )
      )
      gate.resolve({ status: 'error', code: 'REQUEST_FAILED' })

      await expect(began).resolves.toEqual({
        status: 'error',
        code: 'SUPERSEDED'
      })
      expect(storedPointer(storage)).toBeUndefined()
    })
  })

  describe('polling', () => {
    it('backs off toward the cap, then parks on the slow cadence once the customer is involved', async () => {
      const { lifecycle, calls } = harness({
        answers: [
          httpOk(opStatus()),
          httpOk(opStatus()),
          httpOk(opStatus({ action_url: 'https://billing.example/continue' }))
        ]
      })
      await lifecycle.begin('topup', issued())
      await flush()
      expect(calls).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(1_499)
      expect(calls).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(calls).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(2_250)
      expect(calls).toHaveLength(3)

      await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.parkedMs - 1)
      expect(calls).toHaveLength(3)
      await vi.advanceTimersByTimeAsync(1)
      expect(calls).toHaveLength(4)
    })

    it('joins a wake to the poll in flight rather than issuing a second request', async () => {
      const gate = deferred<BillingResult<BillingHttpResponse>>()
      const { lifecycle, calls } = harness({
        answers: [gate.promise, httpOk(opStatus())]
      })
      await lifecycle.begin('topup', issued())
      await flush()

      lifecycle.wake()
      lifecycle.wake()
      await flush()
      expect(calls).toHaveLength(1)

      gate.resolve(httpOk(opStatus()))
      await flush()
      lifecycle.wake()
      await flush()
      expect(calls).toHaveLength(2)
    })

    it('gives up after the poll budget but keeps the pointer', async () => {
      const { lifecycle, storage, telemetry } = harness({})
      await lifecycle.begin('topup', issued())

      await vi.advanceTimersByTimeAsync(
        OPERATION_POLL_BUDGET.defaultMs + OPERATION_POLL_TIMING.maxMs
      )

      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'timed_out' })
      expect(storedPointer(storage)).toMatchObject({ operationId: 'op-1' })
      expect(telemetry.at(-1)).toMatchObject({
        name: 'billing.operation.timeout',
        failure_category: 'poll_timeout'
      })
    })

    it('widens the budget for an issued embedded challenge before any status echoes it', async () => {
      const { lifecycle } = harness({ embedded: true })
      await lifecycle.begin(
        'topup',
        issued({ operationId: 'op-1', clientSecret: 'pi_secret' })
      )

      await vi.advanceTimersByTimeAsync(
        OPERATION_POLL_BUDGET.defaultMs + OPERATION_POLL_TIMING.maxMs
      )

      expect(lifecycle.get('op-1')).toMatchObject({
        phase: 'pending',
        customerActionSeen: true
      })
    })

    it('widens the budget once the customer is involved', async () => {
      const { lifecycle } = harness({
        answers: [httpOk(opStatus({ authentication_state: 'requires_action' }))]
      })
      await lifecycle.begin('subscription', issued())

      await vi.advanceTimersByTimeAsync(
        OPERATION_POLL_BUDGET.subscriptionDiscoveryMs * 2
      )

      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'pending' })
    })

    it('terminalizes a failure with the coded reason and never the server text', async () => {
      const { lifecycle, storage, telemetry } = harness({
        answers: [
          httpOk(
            opStatus({
              status: 'failed',
              decline_reason: 'card_declined',
              recovery_action: 'replace_payment_method',
              error_message: 'Stripe: Your card was declined (do_not_honor).'
            })
          )
        ]
      })
      await lifecycle.begin('topup', issued())
      await flush()

      const state = lifecycle.get('op-1')
      expect(state).toMatchObject({
        phase: 'failed',
        declineReason: 'card_declined',
        recoveryAction: 'replace_payment_method'
      })
      expect(JSON.stringify(state)).not.toContain('Stripe')
      expect(storedPointer(storage)).toBeUndefined()
      expect(telemetry.at(-1)).toMatchObject({
        name: 'billing.operation.failed',
        failure_category: 'provider_decline',
        decline_reason: 'card_declined'
      })
      expect(JSON.stringify(telemetry)).not.toContain('Stripe')
    })

    it('reports an operation the server cannot find as needing reconciliation', async () => {
      const { lifecycle, telemetry } = harness({ answers: [httpStatus(404)] })
      await lifecycle.begin('topup', issued())
      await flush()

      expect(lifecycle.get('op-1')).toMatchObject({
        phase: 'reconciliation_needed'
      })
      expect(telemetry.at(-1)).toMatchObject({
        failure_category: 'reconciliation_needed'
      })
    })

    it('keeps polling through a transient failure', async () => {
      const { lifecycle, calls } = harness({
        answers: [
          { status: 'error', code: 'REQUEST_FAILED' },
          httpOk(opStatus({ status: 'succeeded' }))
        ]
      })
      await lifecycle.begin('topup', issued())
      await vi.advanceTimersByTimeAsync(1_500)

      expect(calls).toHaveLength(2)
      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'succeeded' })
    })
  })

  describe('scope and session supersession', () => {
    it('supersedes pending operations on a workspace change and discards the late response', async () => {
      const session = fakeSession()
      const gate = deferred<BillingResult<BillingHttpResponse>>()
      const { lifecycle, storage, telemetry } = harness({
        session,
        answers: [gate.promise]
      })
      await lifecycle.begin('topup', issued())
      await flush()

      session.moveTo(
        authenticated(
          credential({
            workspace: { id: 'ws-2', name: 'Team', type: 'team' }
          })
        )
      )
      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'superseded' })

      gate.resolve(httpOk(opStatus({ status: 'succeeded' })))
      await flush()
      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'superseded' })
      expect(storedPointer(storage)).toMatchObject({ operationId: 'op-1' })
      expect(telemetry.at(-1)).toMatchObject({
        name: 'billing.operation.failed',
        failure_category: 'stale_operation'
      })
    })

    it('gives an id re-adopted after supersession its own poll', async () => {
      const session = fakeSession()
      const gate = deferred<BillingResult<BillingHttpResponse>>()
      const { lifecycle, calls, status } = harness({
        session,
        answers: [gate.promise, httpOk(opStatus()), httpOk(opStatus())]
      })
      await lifecycle.begin('topup', issued())
      await flush()
      expect(calls).toHaveLength(1)

      session.moveTo(
        authenticated(
          credential({
            workspace: { id: 'ws-2', name: 'Team', type: 'team' }
          })
        )
      )
      status.answer(
        statusSnapshot({
          pending_billing_op_id: 'op-1',
          pending_billing_op_type: 'topup'
        })
      )
      const readopted = await lifecycle.begin('topup', issued())
      await flush()

      expect(readopted).toMatchObject({
        status: 'ok',
        value: { id: 'op-1', phase: 'pending' }
      })
      expect(calls).toHaveLength(2)

      gate.resolve(httpOk(opStatus({ status: 'succeeded' })))
      await flush()
      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'pending' })
      await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.initialMs * 1.5)
      expect(calls).toHaveLength(3)
    })

    it('supersedes on sign-out and refuses commands without a scope', async () => {
      const session = fakeSession()
      const { lifecycle } = harness({ session })
      await lifecycle.begin('topup', issued())

      session.moveTo(SIGNED_OUT)

      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'superseded' })
      await expect(lifecycle.begin('topup', issued())).resolves.toEqual({
        status: 'error',
        code: 'NOT_AUTHENTICATED'
      })
    })

    it('keeps the pointer across a role change so recover re-adopts the operation', async () => {
      const session = fakeSession()
      const { lifecycle, storage } = harness({
        session,
        answers: [httpOk(opStatus()), httpOk(opStatus())]
      })
      await lifecycle.begin('topup', issued())
      await flush()

      session.moveTo(authenticated(credential({ role: 'member' })))

      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'superseded' })
      expect(storedPointer(storage)).toMatchObject({ operationId: 'op-1' })

      await expect(lifecycle.recover()).resolves.toMatchObject({
        status: 'ok',
        value: {
          id: 'op-1',
          kind: 'topup',
          phase: 'pending',
          scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'member' }
        }
      })
    })
  })

  describe('recover', () => {
    const POINTER = {
      operationId: 'op-1',
      kind: 'subscription',
      presentation: 'hosted',
      attemptStartedAt: NOW - 30_000
    }

    function storageWith(pointer: unknown) {
      const storage = memoryStorage()
      storage.setItem(operationPointerKey(SCOPE), JSON.stringify(pointer))
      return storage
    }

    it("resumes the backend's pending operation with the pointer's attempt time and presentation", async () => {
      const { lifecycle, calls, telemetry } = harness({
        storage: storageWith(POINTER),
        embedded: true,
        status: statusSnapshot({
          pending_billing_op_id: 'op-1',
          pending_billing_op_type: 'subscription',
          payment_intent_client_secret: 'pi_secret'
        })
      })

      const recovered = await lifecycle.recover()

      expect(recovered).toMatchObject({
        status: 'ok',
        value: {
          id: 'op-1',
          kind: 'subscription',
          presentation: 'hosted',
          attemptStartedAt: NOW - 30_000
        }
      })
      await flush()
      expect(calls.map((call) => call.route)).toEqual([operationRoute('op-1')])
      expect(telemetry[0]).toMatchObject({
        name: 'billing.operation.started',
        resumed: true
      })
    })

    it('resumes from the pointer when the status read is unreachable', async () => {
      const { lifecycle } = harness({
        storage: storageWith(POINTER),
        status: { status: 'error', code: 'REQUEST_FAILED' }
      })

      await expect(lifecycle.recover()).resolves.toMatchObject({
        status: 'ok',
        value: { id: 'op-1', phase: 'pending' }
      })
    })

    it('recovers nothing when neither the server nor the pointer names an operation', async () => {
      const { lifecycle, calls, telemetry } = harness({})

      await expect(lifecycle.recover()).resolves.toEqual({
        status: 'ok',
        value: undefined
      })
      expect(calls).toHaveLength(0)
      expect(telemetry).toHaveLength(0)
    })

    it('drops a pointer the server no longer knows without observing it', async () => {
      const storage = storageWith(POINTER)
      const { lifecycle, calls, telemetry } = harness({
        storage,
        answers: [httpStatus(404)]
      })

      await expect(lifecycle.recover()).resolves.toEqual({
        status: 'ok',
        value: undefined
      })
      await vi.advanceTimersByTimeAsync(60_000)

      expect(calls).toHaveLength(1)
      expect(storedPointer(storage)).toBeUndefined()
      expect(lifecycle.get('op-1')).toBeUndefined()
      expect(telemetry).toHaveLength(0)
    })

    it('settles a pointed-at operation the status omits from a single read', async () => {
      const storage = storageWith(POINTER)
      const { lifecycle, calls, telemetry } = harness({
        storage,
        answers: [httpOk(opStatus({ status: 'succeeded' }))]
      })

      await expect(lifecycle.recover()).resolves.toMatchObject({
        status: 'ok',
        value: { id: 'op-1', phase: 'succeeded' }
      })
      await vi.advanceTimersByTimeAsync(60_000)

      expect(calls).toHaveLength(1)
      expect(storedPointer(storage)).toBeUndefined()
      expect(telemetry.map((event) => event.name)).toEqual([
        'billing.operation.started',
        'billing.operation.succeeded'
      ])
    })

    it('keeps observing a pointed-at cancel the status cannot report', async () => {
      const { lifecycle, calls } = harness({
        storage: storageWith({ ...POINTER, kind: 'cancel' }),
        answers: [httpOk(opStatus()), httpOk(opStatus({ status: 'succeeded' }))]
      })

      await expect(lifecycle.recover()).resolves.toMatchObject({
        status: 'ok',
        value: { id: 'op-1', kind: 'cancel', phase: 'pending' }
      })
      expect(calls).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(1_500)
      expect(calls).toHaveLength(2)
      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'succeeded' })
    })
  })

  describe('presentation', () => {
    it('routes hosted when the host cannot drive a challenge', async () => {
      const { lifecycle } = harness({ embedded: false })

      const began = await lifecycle.begin(
        'topup',
        issued({ operationId: 'op-1', clientSecret: 'pi_secret' })
      )

      expect(began).toMatchObject({
        status: 'ok',
        value: { presentation: 'hosted' }
      })
      if (began.status !== 'ok' || began.value.phase !== 'pending') return
      expect(began.value.challenge).toBeUndefined()
    })

    it.for([
      { port: 'absent', destination: undefined, expected: 'stripe' },
      {
        port: 'reporting the billing app',
        destination: 'billing_web',
        expected: 'billing_web'
      }
    ] as const)(
      'reports $expected as the hosted destination when the port is $port',
      async ({ destination, expected }) => {
        const { lifecycle } = harness({ embedded: false, destination })

        await lifecycle.begin(
          'topup',
          issued({ operationId: 'op-1', clientSecret: 'pi_secret' })
        )

        expect(lifecycle.get('op-1')).toMatchObject({
          presentation: 'hosted',
          hostedDestination: expected
        })
      }
    )

    it('re-reads the destination for an operation recovered from the pointer', async () => {
      const storage = memoryStorage()
      storage.setItem(
        operationPointerKey(SCOPE),
        JSON.stringify({
          operationId: 'op-1',
          kind: 'topup',
          presentation: 'hosted',
          attemptStartedAt: NOW - 30_000
        })
      )
      const { lifecycle, destination } = harness({
        storage,
        destination: 'stripe',
        status: { status: 'error', code: 'REQUEST_FAILED' }
      })

      destination.current = 'billing_web'

      await expect(lifecycle.recover()).resolves.toMatchObject({
        status: 'ok',
        value: { presentation: 'hosted', hostedDestination: 'billing_web' }
      })
    })

    it('takes on the destination when it moves to the hosted page, and drops it on the way back', async () => {
      const { lifecycle } = harness({
        embedded: true,
        destination: 'billing_web',
        answers: [
          httpOk(
            opStatus({
              authentication_state: 'requires_action',
              payment_intent_client_secret: 'pi_secret',
              action_url: 'https://billing.example/continue'
            })
          )
        ]
      })
      await lifecycle.begin(
        'topup',
        issued({ operationId: 'op-1', clientSecret: 'pi_secret' })
      )
      await flush()
      expect(lifecycle.get('op-1')).toMatchObject({ presentation: 'embedded' })
      expect(lifecycle.get('op-1')?.hostedDestination).toBeUndefined()

      expect(lifecycle.switchPresentation('op-1', 'hosted')).toBe('switched')
      expect(lifecycle.get('op-1')).toMatchObject({
        presentation: 'hosted',
        hostedDestination: 'billing_web'
      })

      expect(lifecycle.switchPresentation('op-1', 'embedded')).toBe('switched')
      expect(lifecycle.get('op-1')?.hostedDestination).toBeUndefined()
    })

    it('moves a failed embedded challenge to the hosted page under the same id, and back', async () => {
      const { lifecycle, calls, storage, telemetry } = harness({
        embedded: true,
        answers: [
          httpOk(
            opStatus({
              authentication_state: 'requires_action',
              payment_intent_client_secret: 'pi_secret'
            })
          ),
          httpOk(
            opStatus({
              authentication_state: 'requires_action',
              payment_intent_client_secret: 'pi_secret',
              action_url: 'https://billing.example/continue'
            })
          )
        ]
      })
      const issue = vi.fn(
        issued({ operationId: 'op-1', clientSecret: 'pi_secret' })
      )
      await lifecycle.begin('topup', issue)
      await flush()
      expect(lifecycle.get('op-1')).toMatchObject({
        presentation: 'embedded',
        challenge: { clientSecret: 'pi_secret', status: 'required' }
      })

      lifecycle.reportChallengeStarted('op-1')
      await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.parkedMs * 2)
      expect(calls).toHaveLength(1)

      lifecycle.reportChallengeSettled('op-1', 'failed')
      expect(lifecycle.get('op-1')).toMatchObject({
        authenticationState: 'failed_retryable',
        challenge: { status: 'failed' }
      })
      expect(lifecycle.switchPresentation('op-1', 'hosted')).toBe(
        'no_hosted_url'
      )

      await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.parkedMs)
      expect(calls).toHaveLength(2)
      expect(lifecycle.switchPresentation('op-1', 'hosted')).toBe('switched')
      expect(lifecycle.get('op-1')).toMatchObject({
        id: 'op-1',
        presentation: 'hosted',
        actionUrl: 'https://billing.example/continue'
      })
      expect(storedPointer(storage)).toMatchObject({ presentation: 'hosted' })

      expect(lifecycle.switchPresentation('op-1', 'embedded')).toBe('switched')
      expect(lifecycle.get('op-1')).toMatchObject({
        id: 'op-1',
        presentation: 'embedded',
        challenge: { clientSecret: 'pi_secret', status: 'required' }
      })
      expect(storedPointer(storage)).toMatchObject({
        presentation: 'embedded'
      })
      expect(issue).toHaveBeenCalledTimes(1)
      expect(
        telemetry.filter((event) => event.name === 'billing.operation.started')
      ).toHaveLength(1)
    })

    it('refuses a rollback the host cannot present', async () => {
      const { lifecycle } = harness({
        embedded: false,
        answers: [
          httpOk(opStatus({ action_url: 'https://billing.example/continue' }))
        ]
      })
      await lifecycle.begin('topup', issued())
      await flush()

      expect(lifecycle.switchPresentation('op-1', 'embedded')).toBe(
        'embedded_unavailable'
      )
      expect(lifecycle.switchPresentation('op-1', 'hosted')).toBe('unchanged')
      expect(lifecycle.switchPresentation('op-2', 'hosted')).toBe(
        'unknown_operation'
      )
    })

    it('reads the operation back at once when this tab completes the challenge', async () => {
      const { lifecycle, calls } = harness({
        embedded: true,
        answers: [
          httpOk(
            opStatus({
              authentication_state: 'requires_action',
              payment_intent_client_secret: 'pi_secret'
            })
          ),
          httpOk(opStatus({ status: 'succeeded' }))
        ]
      })
      await lifecycle.begin('topup', issued())
      await flush()
      lifecycle.reportChallengeStarted('op-1')

      lifecycle.reportChallengeSettled('op-1', 'completed')
      await flush()

      expect(calls).toHaveLength(2)
      expect(lifecycle.get('op-1')).toMatchObject({ phase: 'succeeded' })
    })
  })

  it('stops observing, settles what was pending, and refuses commands after dispose', async () => {
    const { lifecycle, calls, telemetry } = harness({})
    await lifecycle.begin('topup', issued())
    await flush()
    const settled = lifecycle.settled('op-1')

    lifecycle.dispose()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(calls).toHaveLength(1)
    await expect(settled).resolves.toMatchObject({ phase: 'superseded' })
    expect(telemetry.map((event) => event.name)).toEqual([
      'billing.operation.started'
    ])
    await expect(lifecycle.begin('topup', issued())).resolves.toEqual({
      status: 'error',
      code: 'SUPERSEDED'
    })
    await expect(lifecycle.recover()).resolves.toEqual({
      status: 'error',
      code: 'SUPERSEDED'
    })
  })
})
