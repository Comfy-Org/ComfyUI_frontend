/**
 * The session and transport fakes every billing reader suite builds on. A
 * suite keeps what only it needs — its payloads, and the session transitions
 * it drives — so that only the shared contract lives here.
 */
import { vi } from 'vitest'

import type { SessionClient, SessionSnapshot } from '../../session.js'
import type { AccountCredential } from '../../sessionContracts.js'
import type {
  BillingHttpResponse,
  BillingRequest,
  BillingResult,
  BillingTransport
} from '../billingContracts.js'

export function credential(
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  return {
    token: 'workspace-jwt',
    expiresAt: Date.now() + 60 * 60 * 1000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read'],
    ...overrides
  }
}

export function authenticated(session: AccountCredential): SessionSnapshot {
  return {
    phase: 'authenticated',
    user: { uid: session.uid, getIdToken: async () => 'id-token' },
    session
  }
}

/**
 * The two members a reader is allowed to reach for. Anything else is left
 * undefined at runtime rather than quietly answered, so reaching past them
 * fails the test that does it.
 */
export type SessionFake = Pick<SessionClient, 'getSnapshot' | 'subscribe'>

export function httpOk(
  body: unknown,
  headers: Record<string, string> = {}
): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: {
      httpStatus: 200,
      body,
      header: (name) => headers[name] ?? null
    }
  }
}

export function httpStatus(status: number): BillingResult<BillingHttpResponse> {
  return {
    status: 'ok',
    value: { httpStatus: status, body: {}, header: () => null }
  }
}

/** A transport that answers each call from the queue, then repeats the last. */
export function fakeTransport(answers: BillingResult<BillingHttpResponse>[]) {
  const calls: BillingRequest[] = []
  let index = 0
  const transport: BillingTransport = vi.fn(async (request) => {
    calls.push(request)
    const answer = answers[Math.min(index, answers.length - 1)]
    index++
    return answer
  })
  return { transport, calls }
}
