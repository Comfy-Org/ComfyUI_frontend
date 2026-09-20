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
 *                        └--add-failed--> removing --cleanup-*--> restoring --restore-succeeded--> restored
 *                                                                    │
 *                                                                    └--restore-failed--> stranded
 * ```
 *
 * Commit point is `add` success. A `configure()` failure after that is an
 * effect to report, not a reason to restore: the successor is attached and
 * consistent with the stores, and removing it would also drop the layout
 * entry it adopted. After an `add` failure, taking the half-added successor
 * out is best-effort and its failure is reported separately; restoring the
 * authoritative records is unconditional, and no state is terminal until the
 * driver has reported the outcome of that restore.
 *
 * Driver contract: run every returned effect in array order, then feed the
 * result of the last asynchronous or fallible effect back as the matching
 * event. A terminal state is only observable once its guarantee holds:
 * `settled` means the successor is attached, `restored` means the records are
 * back, `stranded` means the restore itself failed and the graph and stores
 * disagree.
 *
 * An event with no meaning in the current phase returns the state unchanged
 * with no effects, so duplicate or stale delivery is harmless
 * (`docs/guidance/state-and-effects.md`, section 2).
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
  /** Terminal success: the successor is attached, configured or not. */
  | { phase: 'settled' }
  /** `add` failed; removing the half-added successor is in flight. */
  | { phase: 'removing'; cause: unknown }
  /** Successor removal finished (either way); restoring records is in flight. */
  | { phase: 'restoring' }
  /** Terminal failure: the authoritative records are back. */
  | { phase: 'restored' }
  /** Terminal failure: the records could not be restored. */
  | { phase: 'stranded' }

export type ReplacementEvent =
  | { type: 'release' }
  | { type: 'add-succeeded' }
  | { type: 'add-failed'; cause: unknown }
  | { type: 'configure-succeeded' }
  | { type: 'configure-failed'; cause: unknown }
  | { type: 'cleanup-succeeded' }
  | { type: 'cleanup-failed'; cause: unknown }
  | { type: 'restore-succeeded' }
  | { type: 'restore-failed'; cause: unknown }

type ReplacementErrorType =
  | 'agent_node_materialize_add_failed'
  | 'agent_node_materialize_rollback_failed'
  | 'agent_node_materialize_restore_failed'
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

export function initialReplacementState(): ReplacementState {
  return { phase: 'pending' }
}

export function isTerminal(state: ReplacementState): boolean {
  return (
    state.phase === 'settled' ||
    state.phase === 'restored' ||
    state.phase === 'stranded'
  )
}

function report(
  errorType: ReplacementErrorType,
  cause: unknown
): ReplacementEffect {
  return { kind: 'report', errorType, cause }
}

function fromPending(event: ReplacementEvent): ReplacementTransition | null {
  if (event.type !== 'release') return null
  return {
    state: { phase: 'released' },
    effects: [{ kind: 'release-records' }, { kind: 'add-successor' }]
  }
}

function fromReleased(event: ReplacementEvent): ReplacementTransition | null {
  switch (event.type) {
    case 'add-succeeded':
      return {
        state: { phase: 'committed' },
        effects: [{ kind: 'configure-successor' }]
      }
    case 'add-failed':
      return {
        state: { phase: 'removing', cause: event.cause },
        effects: [{ kind: 'remove-successor' }]
      }
    default:
      return null
  }
}

function fromCommitted(event: ReplacementEvent): ReplacementTransition | null {
  switch (event.type) {
    case 'configure-succeeded':
      return { state: { phase: 'settled' }, effects: [] }
    case 'configure-failed':
      return {
        state: { phase: 'settled' },
        effects: [
          report('agent_node_materialize_configure_failed', event.cause)
        ]
      }
    default:
      return null
  }
}

function fromRemoving(
  addCause: unknown,
  event: ReplacementEvent
): ReplacementTransition | null {
  switch (event.type) {
    case 'cleanup-succeeded':
      return {
        state: { phase: 'restoring' },
        effects: [
          { kind: 'restore-records' },
          report('agent_node_materialize_add_failed', addCause)
        ]
      }
    case 'cleanup-failed':
      return {
        state: { phase: 'restoring' },
        effects: [
          { kind: 'restore-records' },
          report('agent_node_materialize_add_failed', addCause),
          report('agent_node_materialize_rollback_failed', event.cause)
        ]
      }
    default:
      return null
  }
}

function fromRestoring(event: ReplacementEvent): ReplacementTransition | null {
  switch (event.type) {
    case 'restore-succeeded':
      return { state: { phase: 'restored' }, effects: [] }
    case 'restore-failed':
      return {
        state: { phase: 'stranded' },
        effects: [report('agent_node_materialize_restore_failed', event.cause)]
      }
    default:
      return null
  }
}

function legalTransition(
  state: ReplacementState,
  event: ReplacementEvent
): ReplacementTransition | null {
  switch (state.phase) {
    case 'pending':
      return fromPending(event)
    case 'released':
      return fromReleased(event)
    case 'committed':
      return fromCommitted(event)
    case 'removing':
      return fromRemoving(state.cause, event)
    case 'restoring':
      return fromRestoring(event)
    case 'settled':
    case 'restored':
    case 'stranded':
      return null
  }
}

export function transition(
  state: ReplacementState,
  event: ReplacementEvent
): ReplacementTransition {
  return legalTransition(state, event) ?? { state, effects: [] }
}
