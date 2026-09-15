import type {
  BillingDeclineReason,
  BillingOperationIdentity,
  BillingOperationLifecycle,
  BillingOperationState,
  FailedBillingOperation,
  PendingBillingOperation
} from '@comfyorg/account/billing'
import { vi } from 'vitest'

import type { BillingSdk } from './createBillingSdk'

const IDENTITY = {
  id: 'op-1',
  kind: 'topup',
  scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
  presentation: 'hosted',
  observedAt: 0,
  attemptStartedAt: 0
} as const satisfies BillingOperationIdentity

export function pendingTopup(
  overrides: Partial<PendingBillingOperation> = {}
): PendingBillingOperation {
  return {
    ...IDENTITY,
    phase: 'pending',
    customerActionSeen: false,
    ...overrides
  }
}

export function failedTopup(
  declineReason: BillingDeclineReason = 'card_declined'
): FailedBillingOperation {
  return { ...IDENTITY, phase: 'failed', declineReason, retryable: true }
}

export function settledTopup<
  P extends 'succeeded' | 'timed_out' | 'reconciliation_needed' | 'superseded'
>(phase: P): BillingOperationIdentity & { readonly phase: P } {
  return { ...IDENTITY, phase }
}

function fakeReader() {
  return {
    read: vi.fn(),
    getSnapshot: vi.fn(),
    invalidate: vi.fn(),
    dispose: vi.fn()
  }
}

/** A composition root stand-in whose lifecycle the test publishes into. */
export function fakeBillingSdk() {
  const listeners = new Set<(state: BillingOperationState) => void>()
  let snapshot: readonly BillingOperationState[] = []

  const lifecycle: BillingOperationLifecycle = {
    begin: vi.fn(),
    recover: vi.fn(async () => ({ status: 'ok' as const, value: undefined })),
    wake: vi.fn(),
    switchPresentation: vi.fn(() => 'unchanged' as const),
    reportChallengeStarted: vi.fn(),
    reportChallengeSettled: vi.fn(),
    get: (operationId) => snapshot.find((state) => state.id === operationId),
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    settled: vi.fn(),
    dispose: vi.fn()
  }

  const sdk: BillingSdk = {
    lifecycle,
    status: fakeReader(),
    credits: fakeReader(),
    capabilities: fakeReader(),
    topup: {
      createTopupCheckout: vi.fn(),
      createHostedTopupCheckout: vi.fn()
    },
    driveChallenge: vi.fn(async () => 'completed' as const),
    dispose: vi.fn()
  }

  return {
    sdk,
    publish(state: BillingOperationState) {
      snapshot = [
        ...snapshot.filter((current) => current.id !== state.id),
        state
      ]
      for (const listener of [...listeners]) listener(state)
    }
  }
}
