/**
 * A real billing core over a scripted transport: the readers, the lifecycle,
 * and the commands are the ones the package ships, so every composable test
 * exercises the merged API rather than a stand-in for it.
 */
import { vi } from 'vitest'

import type {
  BillingHttpResponse,
  BillingOpStatus,
  BillingRequest,
  BillingResult,
  BillingStatusData,
  BillingTransport
} from '@comfyorg/account/billing'
import {
  OPERATION_POLL_TIMING,
  TOPUP_ROUTE,
  createBillingCommands,
  createBillingOperationLifecycle,
  createBillingStatusReader,
  createCapabilitiesReader,
  createCreditsReader,
  createTopupCommand,
  operationRoute
} from '@comfyorg/account/billing'
import type {
  AccountCredential,
  SessionClient,
  SessionSnapshot
} from '@comfyorg/account/session'

import type { BillingClient } from '../billingClient'

export const NOW = 1_000_000

function credential(): AccountCredential {
  return {
    token: 'workspace-jwt',
    expiresAt: NOW + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read']
  }
}

/** The readers and the lifecycle consult only the snapshot and its changes. */
function outsideBillingContract(member: string) {
  return () => {
    throw new Error(`billing harness session: ${member} is never called`)
  }
}

function fakeSession(): SessionClient {
  const session = credential()
  const snapshot: SessionSnapshot = {
    phase: 'authenticated',
    user: { uid: session.uid, getIdToken: async () => 'id-token' },
    session
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    attachIdentity: outsideBillingContract('attachIdentity'),
    getToken: outsideBillingContract('getToken'),
    ensureFresh: outsideBillingContract('ensureFresh'),
    remint: outsideBillingContract('remint'),
    invalidate: outsideBillingContract('invalidate'),
    clearStoredCredential: outsideBillingContract('clearStoredCredential')
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

export const CAPABILITIES = {
  can_cancel: false,
  can_change_seats: false,
  can_downgrade_to_personal: false,
  can_invite_members: false,
  can_reactivate: false,
  can_subscribe_self_serve: true,
  can_top_up: true
}

function capabilitiesBody(overrides: Record<string, unknown> = {}) {
  return {
    capabilities: CAPABILITIES,
    expires_at: new Date(NOW + 10 * 60 * 1000).toISOString(),
    resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
    revision: 42,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    },
    ...overrides
  }
}

export function balance(amountMicros: number) {
  return { amount_micros: amountMicros, currency: 'USD' }
}

export const BASELINE_MICROS = 12_500_000
const TOPPED_UP_MICROS = 22_500_000

export function opStatus(
  overrides: Partial<BillingOpStatus> = {}
): BillingOpStatus {
  return {
    id: 'op-1',
    status: 'pending',
    started_at: '2026-09-14T00:00:00.000Z',
    ...overrides
  }
}

export function httpOk(body: unknown): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: 200, body, header: () => null }
  }
}

export const NO_RESPONSE: BillingResult<BillingHttpResponse> = {
  status: 'error',
  code: 'REQUEST_FAILED'
}

type Answer = BillingResult<BillingHttpResponse>

/** Answers per route are consumed in order; the last one repeats. */
function fakeTransport() {
  const calls: BillingRequest[] = []
  const queues = new Map<string, Answer[]>()
  const keyOf = (method: string, route: string) => `${method} ${route}`
  const transport: BillingTransport = vi.fn(async (request) => {
    calls.push(request)
    const key = keyOf(request.method, request.route)
    const queue = queues.get(key)
    if (queue === undefined) return NO_RESPONSE
    const [head, ...rest] = queue
    if (rest.length > 0) queues.set(key, rest)
    return head
  })
  return {
    transport,
    calls,
    answer(method: 'GET' | 'POST', route: string, ...answers: Answer[]) {
      queues.set(keyOf(method, route), answers)
    },
    routes: () => calls.map((call) => `${call.method} ${call.route}`)
  }
}

export interface HarnessOptions {
  readonly embedded?: boolean
  readonly capabilities?: Record<string, unknown>
  readonly balances?: readonly number[]
}

export function createBillingHarness(options: HarnessOptions = {}) {
  const session = fakeSession()
  const { transport, calls, answer, routes } = fakeTransport()
  const readerOptions = { transport, session }
  const capabilities = createCapabilitiesReader(readerOptions)
  const credits = createCreditsReader(readerOptions)
  const statusReader = createBillingStatusReader(readerOptions)
  const lifecycle = createBillingOperationLifecycle({
    transport,
    session,
    statusReader,
    embeddedCheckoutAvailable: () => options.embedded === true
  })
  let attempts = 0
  const idempotencyKey = () => `key-${++attempts}`
  const client: BillingClient = {
    lifecycle,
    capabilities,
    credits,
    status: statusReader,
    topup: createTopupCommand({
      transport,
      lifecycle,
      capabilities,
      credits,
      idempotencyKey
    }),
    commands: createBillingCommands({
      transport,
      lifecycle,
      statusReader,
      capabilities,
      credits,
      idempotencyKey
    })
  }

  answer(
    'GET',
    '/billing/capabilities',
    httpOk(capabilitiesBody(options.capabilities))
  )
  answer('GET', '/billing/status', httpOk(STATUS_DATA))
  answer(
    'GET',
    '/billing/balance',
    ...(options.balances ?? [BASELINE_MICROS, TOPPED_UP_MICROS]).map((micros) =>
      httpOk(balance(micros))
    )
  )
  answer(
    'POST',
    TOPUP_ROUTE,
    httpOk({
      amount_cents: 1000,
      billing_op_id: 'op-1',
      status: 'pending',
      topup_id: 'topup-1'
    })
  )
  answer(
    'GET',
    operationRoute('op-1'),
    httpOk(opStatus({ status: 'succeeded' }))
  )

  return { client, calls, answer, routes }
}

/** Lets every read, the POST, and the first poll cadence settle. */
export async function settle<T>(result: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(OPERATION_POLL_TIMING.maxMs)
  return result
}

export function postedBodies(calls: readonly BillingRequest[]) {
  return calls
    .filter((call) => call.method === 'POST')
    .map((call) => ({ route: call.route, body: call.body }))
}
