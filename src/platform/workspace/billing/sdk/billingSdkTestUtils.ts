import type {
  BillingDeclineReason,
  BillingOperationIdentity,
  BillingOperationKind,
  BillingOperationLifecycle,
  BillingOperationState,
  BillingPresentationState,
  BillingServerCode,
  FailedBillingOperation,
  PendingBillingOperation
} from '@comfyorg/account-core/billing'
import { readBillingErrorCode } from '@comfyorg/account-core/billing'
import { vi } from 'vitest'

import type { BillingSdk } from './createBillingSdk'

/** A server code minted the one sanctioned way, so a test cannot invent one. */
export function serverCode(code: string): BillingServerCode | undefined {
  return readBillingErrorCode({ code, message: 'server text' })
}

const IDENTITY_CORE = {
  id: 'op-1',
  kind: 'topup',
  scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
  observedAt: 0,
  attemptStartedAt: 0
} as const

const IDENTITY = {
  ...IDENTITY_CORE,
  presentation: 'hosted',
  hostedDestination: 'stripe'
} as const satisfies BillingOperationIdentity

/** The presentation stays a variant, so a hosted override carries a destination. */
type PendingOverrides = Partial<
  Omit<PendingBillingOperation, 'presentation' | 'hostedDestination'>
> &
  Partial<BillingPresentationState>

export function pendingTopup(
  overrides: PendingOverrides = {}
): PendingBillingOperation {
  const { presentation, hostedDestination, ...rest } = overrides
  const identity: BillingOperationIdentity =
    presentation === 'embedded'
      ? { ...IDENTITY_CORE, presentation }
      : {
          ...IDENTITY_CORE,
          presentation: 'hosted',
          hostedDestination: hostedDestination ?? IDENTITY.hostedDestination
        }
  return {
    ...identity,
    phase: 'pending',
    customerActionSeen: false,
    ...rest
  }
}

export function failedTopup(
  declineReason: BillingDeclineReason = 'card_declined'
): FailedBillingOperation {
  return { ...IDENTITY, phase: 'failed', declineReason, retryable: true }
}

/** A settled subscription-rail operation, for a command result's `operation`. */
export function settledOperation<
  P extends 'succeeded' | 'timed_out' | 'reconciliation_needed'
>(
  phase: P,
  kind: BillingOperationKind = 'cancel'
): BillingOperationIdentity & { readonly phase: P } {
  return { ...IDENTITY, kind, phase }
}

export function failedOperation(
  kind: BillingOperationKind = 'cancel'
): FailedBillingOperation {
  return {
    ...IDENTITY,
    kind,
    phase: 'failed',
    declineReason: 'generic',
    retryable: false
  }
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
    plans: fakeReader(),
    paymentMethods: fakeReader(),
    topup: {
      createTopupCheckout: vi.fn(),
      createHostedTopupCheckout: vi.fn()
    },
    commands: {
      subscribe: vi.fn(),
      previewSubscribe: vi.fn(),
      resubscribe: vi.fn(),
      cancelSubscription: vi.fn(),
      openPaymentPortal: vi.fn()
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
