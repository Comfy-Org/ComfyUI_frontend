/**
 * Node replacement at the Agent/litegraph boundary as a pure state machine.
 *
 * The materializer swaps a placeholder or stale node for a successor built
 * from the authoritative CRDT record. Today that sequence, its commit point
 * and its rollback live inline in `agentNodeMaterializer.materialize()`. This
 * module names the states and events so the driver becomes a loop that
 * executes effects and feeds results back, and so every (state, event) pair
 * is decided in one table instead of by control flow.
 *
 * Phases, in order along the happy path:
 *
 * ```
 * pending --release--> released --add-succeeded--> committed --configure-*--> settled
 *                        │
 *                        └--add-failed--> restoring --cleanup-*--> restored
 * ```
 *
 * Commit point is `add` success. A `configure()` failure after that is an
 * effect to report, not a reason to restore: the successor is attached and
 * consistent with the stores, and removing it would also drop the layout
 * entry it adopted. Restoring the authoritative records after an `add`
 * failure is unconditional; taking the half-added successor out is
 * best-effort and its failure is reported separately.
 *
 * No graph, store or reporting import: this file is pure. Wiring the driver
 * is PM-1293 PR-2.
 */

export type ReplacementState =
  /** Successor exists in memory; the records are still authoritative. */
  | { phase: 'pending' }
  /** Records released from the stores; `add` is in flight. */
  | { phase: 'released' }
  /** `add` succeeded: the successor owns the id and layout entry. */
  | { phase: 'committed' }
  /** Terminal success. `configureFailure` is set when configure threw. */
  | { phase: 'settled'; configureFailure?: unknown }
  /** `add` failed; removing the half-added successor is in flight. */
  | { phase: 'restoring'; cause: unknown }
  /** Terminal failure: records restored. `cleanupFailure` set when removal threw. */
  | { phase: 'restored'; cause: unknown; cleanupFailure?: unknown }

export type ReplacementEvent =
  | { type: 'release' }
  | { type: 'add-succeeded' }
  | { type: 'add-failed'; cause: unknown }
  | { type: 'configure-succeeded' }
  | { type: 'configure-failed'; cause: unknown }
  | { type: 'cleanup-succeeded' }
  | { type: 'cleanup-failed'; cause: unknown }

type ReplacementErrorType =
  | 'agent_node_materialize_add_failed'
  | 'agent_node_materialize_rollback_failed'
  | 'agent_node_materialize_configure_failed'

/** Commands for the driver, to run in array order. */
export type ReplacementEffect =
  | { kind: 'release-records' }
  | { kind: 'add-successor' }
  | { kind: 'configure-successor' }
  | { kind: 'remove-successor' }
  | { kind: 'restore-records' }
  | { kind: 'report'; errorType: ReplacementErrorType; cause: unknown }

export interface ReplacementTransition {
  state: ReplacementState
  effects: ReplacementEffect[]
}

export class IllegalReplacementTransition extends Error {
  constructor(state: ReplacementState, event: ReplacementEvent) {
    super(
      `Node replacement in phase '${state.phase}' cannot handle event '${event.type}'`
    )
    this.name = 'IllegalReplacementTransition'
  }
}

export function initialReplacementState(): ReplacementState {
  return { phase: 'pending' }
}

export function isTerminal(state: ReplacementState): boolean {
  return state.phase === 'settled' || state.phase === 'restored'
}

export function transition(
  state: ReplacementState,
  event: ReplacementEvent
): ReplacementTransition {
  switch (state.phase) {
    case 'pending':
      if (event.type === 'release') {
        return {
          state: { phase: 'released' },
          effects: [{ kind: 'release-records' }, { kind: 'add-successor' }]
        }
      }
      break
    case 'released':
      if (event.type === 'add-succeeded') {
        return {
          state: { phase: 'committed' },
          effects: [{ kind: 'configure-successor' }]
        }
      }
      if (event.type === 'add-failed') {
        return {
          state: { phase: 'restoring', cause: event.cause },
          effects: [{ kind: 'remove-successor' }]
        }
      }
      break
    case 'committed':
      if (event.type === 'configure-succeeded') {
        return { state: { phase: 'settled' }, effects: [] }
      }
      if (event.type === 'configure-failed') {
        return {
          state: { phase: 'settled', configureFailure: event.cause },
          effects: [
            {
              kind: 'report',
              errorType: 'agent_node_materialize_configure_failed',
              cause: event.cause
            }
          ]
        }
      }
      break
    case 'restoring':
      if (event.type === 'cleanup-succeeded') {
        return {
          state: { phase: 'restored', cause: state.cause },
          effects: [
            { kind: 'restore-records' },
            {
              kind: 'report',
              errorType: 'agent_node_materialize_add_failed',
              cause: state.cause
            }
          ]
        }
      }
      if (event.type === 'cleanup-failed') {
        return {
          state: {
            phase: 'restored',
            cause: state.cause,
            cleanupFailure: event.cause
          },
          effects: [
            { kind: 'restore-records' },
            {
              kind: 'report',
              errorType: 'agent_node_materialize_add_failed',
              cause: state.cause
            },
            {
              kind: 'report',
              errorType: 'agent_node_materialize_rollback_failed',
              cause: event.cause
            }
          ]
        }
      }
      break
    case 'settled':
    case 'restored':
      break
  }
  throw new IllegalReplacementTransition(state, event)
}
