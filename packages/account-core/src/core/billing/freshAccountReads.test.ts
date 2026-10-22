import { describe, expect, it, vi } from 'vitest'

import type { SessionSnapshot } from '#/core/session'
import type { BillingTransport } from './billingContracts'
import { sessionBillingScopeSource } from './billingScope'
import { createCreditsReader } from './credits'
import { createBillingStatusReader } from './status'
import {
  authenticated,
  credential,
  httpOk,
  httpStatus
} from './__fixtures__/billingTestFixtures'

const READERS = [
  {
    name: 'status',
    create: createBillingStatusReader,
    body: {
      is_active: false,
      has_funds: true,
      scoped_has_funds: { agent: true },
      max_seats: 1,
      occupied_seats: 1,
      scheduled_change: null,
      team_credit_stop: null
    }
  },
  {
    name: 'balance',
    create: createCreditsReader,
    body: { amount_micros: 200_000_000, currency: 'USD' }
  }
]

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}

function session() {
  let snapshot: SessionSnapshot = authenticated(credential())
  const listeners = new Set<(next: SessionSnapshot) => void>()
  return {
    scopeSource: sessionBillingScopeSource({
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }),
    switchWorkspace: () => {
      snapshot = authenticated(
        credential({
          workspace: { id: 'ws-2', name: 'Other', type: 'team' }
        })
      )
      listeners.forEach((listener) => listener(snapshot))
    }
  }
}

describe('fresh account reads', () => {
  it.for(READERS)(
    '$name supersedes a pre-consent read while later ordinary callers join the fresh request',
    async ({ create, body }) => {
      const old = deferred()
      const fresh = deferred()
      const transport = vi
        .fn<BillingTransport>()
        .mockImplementationOnce(async () => {
          await old.promise
          return httpOk(body)
        })
        .mockImplementation(async () => {
          await fresh.promise
          return httpOk(body)
        })
      const reader = create({ transport, scopeSource: session().scopeSource })
      const beforeConsent = reader.read()
      const afterConsent = reader.read({ fresh: true })

      old.resolve()
      expect(await beforeConsent).toEqual({
        status: 'error',
        code: 'SUPERSEDED'
      })
      expect(reader.getSnapshot()).toBeUndefined()
      const joined = reader.read()
      expect(transport).toHaveBeenCalledTimes(2)
      fresh.resolve()

      expect(await afterConsent).toMatchObject({ status: 'ok' })
      expect(await joined).toEqual(await afterConsent)
      expect(reader.getSnapshot()).toMatchObject({
        scope: { workspaceId: 'ws-1' }
      })
      reader.dispose()
    }
  )

  it.for(READERS)(
    '$name keeps a fresh snapshot after a late pre-consent denial',
    async ({ create, body }) => {
      const old = deferred()
      const transport = vi
        .fn<BillingTransport>()
        .mockImplementationOnce(async () => {
          await old.promise
          return httpStatus(403)
        })
        .mockResolvedValue(httpOk(body))
      const reader = create({ transport, scopeSource: session().scopeSource })
      const beforeConsent = reader.read()
      const current = await reader.read({ fresh: true })
      const snapshot = reader.getSnapshot()
      expect(current).toMatchObject({ status: 'ok' })
      expect(snapshot).toBeDefined()

      old.resolve()

      expect(await beforeConsent).toEqual({
        status: 'error',
        code: 'SUPERSEDED'
      })
      expect(reader.getSnapshot()).toEqual(snapshot)
      reader.dispose()
    }
  )

  it.for(READERS)(
    '$name still rejects a fresh read after the workspace changes',
    async ({ create, body }) => {
      const gate = deferred()
      const host = session()
      const transport = vi.fn<BillingTransport>(async () => {
        await gate.promise
        return httpOk(body)
      })
      const reader = create({ transport, scopeSource: host.scopeSource })
      const pending = reader.read({ fresh: true })
      expect(transport).toHaveBeenCalledOnce()
      host.switchWorkspace()
      gate.resolve()

      expect(await pending).toEqual({ status: 'error', code: 'SUPERSEDED' })
      expect(reader.getSnapshot()).toBeUndefined()
      reader.dispose()
    }
  )
})
