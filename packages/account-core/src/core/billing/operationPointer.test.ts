import { describe, expect, it } from 'vitest'

import type { BillingOperationPointerStorage } from './operationPointer.js'
import {
  OPERATION_POINTER_MAX_AGE_MS,
  createOperationPointerStore,
  operationPointerKey
} from './operationPointer.js'
import type { BillingOperationState } from './operationState.js'

const SCOPE = { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' } as const
const OTHER_WORKSPACE = { ...SCOPE, workspaceId: 'ws-2' } as const

const POINTER = {
  operationId: 'op-1',
  kind: 'topup',
  presentation: 'embedded',
  attemptStartedAt: 10_000
} as const

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

function terminal(
  phase: BillingOperationState['phase'],
  operationId = 'op-1'
): BillingOperationState {
  const identity = {
    id: operationId,
    kind: 'topup',
    scope: SCOPE,
    presentation: 'embedded',
    observedAt: 10_000,
    attemptStartedAt: 10_000
  } as const
  if (phase === 'pending') {
    return { ...identity, phase, customerActionSeen: false }
  }
  if (phase === 'failed') {
    return { ...identity, phase, declineReason: 'generic', retryable: false }
  }
  return { ...identity, phase }
}

describe('createOperationPointerStore', () => {
  it('round-trips a pointer under its scope only', () => {
    const storage = memoryStorage()
    const store = createOperationPointerStore(storage, () => 20_000)

    store.write(SCOPE, POINTER)

    expect(store.read(SCOPE)).toEqual(POINTER)
    expect(store.read(OTHER_WORKSPACE)).toBeUndefined()
    expect([...storage.entries.keys()]).toEqual([operationPointerKey(SCOPE)])
  })

  it('drops a pointer that is malformed, from the future, or past its age', () => {
    const storage = memoryStorage()
    const store = createOperationPointerStore(storage, () => 20_000)
    const key = operationPointerKey(SCOPE)

    storage.setItem(key, '{not json')
    expect(store.read(SCOPE)).toBeUndefined()
    expect(storage.getItem(key)).toBeNull()

    storage.setItem(key, JSON.stringify({ ...POINTER, kind: 'refund' }))
    expect(store.read(SCOPE)).toBeUndefined()

    storage.setItem(
      key,
      JSON.stringify({ ...POINTER, attemptStartedAt: 30_000 })
    )
    expect(store.read(SCOPE)).toBeUndefined()

    storage.setItem(
      key,
      JSON.stringify({
        ...POINTER,
        attemptStartedAt: 20_000 - OPERATION_POINTER_MAX_AGE_MS - 1
      })
    )
    expect(store.read(SCOPE)).toBeUndefined()
    expect(storage.entries.size).toBe(0)
  })

  it('clears by operation id only when the stored pointer names it', () => {
    const store = createOperationPointerStore(memoryStorage(), () => 20_000)
    store.write(SCOPE, POINTER)

    store.clear(SCOPE, 'op-2')
    expect(store.read(SCOPE)).toEqual(POINTER)

    store.clear(SCOPE, 'op-1')
    expect(store.read(SCOPE)).toBeUndefined()
  })

  it('keeps the pointer through a timeout or supersession and clears it on settlement', () => {
    const store = createOperationPointerStore(memoryStorage(), () => 20_000)

    for (const phase of ['pending', 'timed_out', 'superseded'] as const) {
      store.write(SCOPE, POINTER)
      store.clearIfTerminal(terminal(phase))
      expect(store.read(SCOPE)).toEqual(POINTER)
    }

    for (const phase of [
      'succeeded',
      'failed',
      'reconciliation_needed'
    ] as const) {
      store.write(SCOPE, POINTER)
      store.clearIfTerminal(terminal(phase))
      expect(store.read(SCOPE)).toBeUndefined()
    }

    store.write(SCOPE, POINTER)
    store.clearIfTerminal(terminal('succeeded', 'op-2'))
    expect(store.read(SCOPE)).toEqual(POINTER)
  })

  it('treats storage that throws as empty and writes as no-ops', () => {
    const throwing: BillingOperationPointerStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      }
    }
    const store = createOperationPointerStore(throwing, () => 20_000)

    expect(() => store.write(SCOPE, POINTER)).not.toThrow()
    expect(store.read(SCOPE)).toBeUndefined()
    expect(() => store.clear(SCOPE)).not.toThrow()
  })
})
