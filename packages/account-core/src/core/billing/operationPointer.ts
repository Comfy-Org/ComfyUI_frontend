/**
 * The tab-local pointer to an operation this tab is observing, so a reload
 * reattaches to the same `billing_op_id` instead of starting a replacement
 * charge. The host supplies the storage (origin-scoped `sessionStorage` in a
 * browser); the SDK owns the key, the shape, and the rule for when the
 * pointer may go.
 *
 * The pointer is keyed by scope, so a workspace switch neither reads nor
 * clears another workspace's operation, and switching back finds it again.
 */
import { z } from 'zod'

import type { BillingScope } from './billingScope.js'
import type {
  BillingOperationPhase,
  BillingOperationState
} from './operationState.js'

export interface BillingOperationPointerStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const POINTER_KEY_PREFIX = 'comfy:billing:operation'

export const OPERATION_POINTER_MAX_AGE_MS = 24 * 60 * 60_000

const PointerSchema = z.object({
  operationId: z.string().min(1),
  kind: z.enum(['subscription', 'topup', 'cancel']),
  presentation: z.enum(['embedded', 'hosted']),
  attemptStartedAt: z.number().finite()
})

export type BillingOperationPointer = z.infer<typeof PointerSchema>

/**
 * A client-side timeout is this tab giving up, not the server finishing:
 * an operation awaiting bank authentication stays pending for hours, so the
 * pointer outlives it. A superseded operation belongs to a scope this tab
 * left, and its pointer waits under that scope's key for a return.
 * `reconciliation_needed` is terminal for polling, so retaining its pointer
 * would re-poll a settled operation on every reload.
 */
const CLEARS_POINTER: Record<BillingOperationPhase, boolean> = {
  pending: false,
  timed_out: false,
  superseded: false,
  succeeded: true,
  failed: true,
  reconciliation_needed: true
}

export function operationPointerKey(scope: BillingScope): string {
  return `${POINTER_KEY_PREFIX}:${scope.userId}:${scope.workspaceId}`
}

export interface OperationPointerStore {
  read: (scope: BillingScope) => BillingOperationPointer | undefined
  write: (scope: BillingScope, pointer: BillingOperationPointer) => void
  /** Clears only when the stored pointer names `operationId`, or unconditionally without one. */
  clear: (scope: BillingScope, operationId?: string) => void
  clearIfTerminal: (state: BillingOperationState) => void
}

/** Storage that throws (private mode, quota) reads as empty and writes as a no-op. */
function attempt<T>(read: () => T, fallback: T): T {
  try {
    return read()
  } catch {
    return fallback
  }
}

function decodePointer(
  raw: string | null,
  now: number
): BillingOperationPointer | undefined {
  if (raw === null) return undefined
  const parsed = PointerSchema.safeParse(attempt(() => JSON.parse(raw), null))
  if (!parsed.success) return undefined
  const age = now - parsed.data.attemptStartedAt
  return age >= 0 && age <= OPERATION_POINTER_MAX_AGE_MS
    ? parsed.data
    : undefined
}

export function createOperationPointerStore(
  storage: BillingOperationPointerStorage,
  now: () => number = Date.now
): OperationPointerStore {
  const read = (scope: BillingScope) => {
    const key = operationPointerKey(scope)
    const pointer = decodePointer(
      attempt(() => storage.getItem(key), null),
      now()
    )
    if (pointer === undefined) attempt(() => storage.removeItem(key), undefined)
    return pointer
  }

  const clear = (scope: BillingScope, operationId?: string) => {
    if (operationId !== undefined && read(scope)?.operationId !== operationId) {
      return
    }
    attempt(() => storage.removeItem(operationPointerKey(scope)), undefined)
  }

  return {
    read,
    write: (scope, pointer) =>
      attempt(
        () =>
          storage.setItem(operationPointerKey(scope), JSON.stringify(pointer)),
        undefined
      ),
    clear,
    clearIfTerminal: (state) => {
      if (CLEARS_POINTER[state.phase]) clear(state.scope, state.id)
    }
  }
}

/** A store for hosts without tab-local storage: nothing is ever recovered. */
export const NO_POINTER_STORE: OperationPointerStore = {
  read: () => undefined,
  write: () => {},
  clear: () => {},
  clearIfTerminal: () => {}
}
