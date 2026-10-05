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
import type { BillingOperationState } from './operationState.js'

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
  attemptStartedAt: z.number().finite(),
  /** This tab issued the operation and has not yet seen it succeed. */
  awaited: z.literal(true).optional(),
  /** The end this tab saw it reach, kept only by a store that retains settled pointers. */
  settled: z.enum(['succeeded', 'reconciliation_needed']).optional(),
  /** The hosted step this page redirected to; the page it returns to reports the return. */
  redirect: z
    .object({
      destination: z.enum(['stripe', 'billing_web']),
      step: z.enum([
        'authentication',
        'payment_method',
        'invoice_payment',
        'checkout'
      ]),
      method_kind: z.enum(['card', 'alipay', 'other']).optional()
    })
    .optional()
})

export type BillingOperationPointer = z.infer<typeof PointerSchema>

type SettledPhase = NonNullable<BillingOperationPointer['settled']>

export function operationPointerKey(scope: BillingScope): string {
  return `${POINTER_KEY_PREFIX}:${scope.userId}:${scope.workspaceId}`
}

export interface OperationPointerStore {
  read: (scope: BillingScope) => BillingOperationPointer | undefined
  write: (scope: BillingScope, pointer: BillingOperationPointer) => void
  /** Clears only when the stored pointer names `operationId`, or unconditionally without one. */
  clear: (scope: BillingScope, operationId?: string) => void
  /**
   * What the operation's phase does to the pointer naming it. A client-side
   * timeout is this tab giving up, not the server finishing: an operation
   * awaiting bank authentication stays pending for hours, so the pointer
   * outlives it. A superseded operation belongs to a scope this tab left, and
   * its pointer waits under that scope's key for a return. A failure clears
   * it, so a reload offers a fresh attempt. A success, or an operation the
   * server parked for reconciliation, clears it too, unless the store retains
   * settled pointers.
   */
  settle: (state: BillingOperationState) => void
}

export interface OperationPointerStoreOptions {
  /**
   * Keep a settled pointer, marked with how it ended, so a page that is the
   * checkout itself can read it back after a reload.
   */
  readonly retainSettled?: boolean
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

/** A success is no longer awaited; an operation still being reconciled is. */
function settledPointer(
  pointer: BillingOperationPointer,
  phase: SettledPhase
): BillingOperationPointer {
  if (phase === 'reconciliation_needed') return { ...pointer, settled: phase }
  const { awaited: _seen, ...rest } = pointer
  return { ...rest, settled: phase }
}

export function createOperationPointerStore(
  storage: BillingOperationPointerStorage,
  now: () => number = Date.now,
  { retainSettled = false }: OperationPointerStoreOptions = {}
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

  const write = (scope: BillingScope, pointer: BillingOperationPointer) =>
    attempt(
      () =>
        storage.setItem(operationPointerKey(scope), JSON.stringify(pointer)),
      undefined
    )

  const clear = (scope: BillingScope, operationId?: string) => {
    if (operationId !== undefined && read(scope)?.operationId !== operationId) {
      return
    }
    attempt(() => storage.removeItem(operationPointerKey(scope)), undefined)
  }

  const retain = (state: BillingOperationState, phase: SettledPhase) => {
    const pointer = read(state.scope)
    if (pointer?.operationId !== state.id) return
    write(state.scope, settledPointer(pointer, phase))
  }

  const settle = (state: BillingOperationState) => {
    switch (state.phase) {
      case 'pending':
      case 'timed_out':
      case 'superseded':
        return
      case 'failed':
        clear(state.scope, state.id)
        return
      case 'succeeded':
      case 'reconciliation_needed':
        if (retainSettled) retain(state, state.phase)
        else clear(state.scope, state.id)
    }
  }

  return { read, write, clear, settle }
}

/** A store for hosts without tab-local storage: nothing is ever recovered. */
export const NO_POINTER_STORE: OperationPointerStore = {
  read: () => undefined,
  write: () => {},
  clear: () => {},
  settle: () => {}
}
