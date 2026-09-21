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
 * Driver contract. Every transition returns `commands` and at most one
 * `step`:
 *
 * - `commands` are infallible bookkeeping (`release-records`, `report`). The
 *   driver runs them in array order, unconditionally, before the step. They
 *   never produce an event.
 * - `step` is the one fallible effect the machine is waiting on. Its outcome
 *   is the next event, and only its outcome: `stepEvent()` is the whole
 *   mapping, so a driver cannot pick a different event or skip one. A
 *   transition into a terminal state has no step.
 *
 * A `report` command carries what only the table knows: the `errorType` and
 * the `outcome` tag (`recovered` when the rollback put the graph back,
 * `degraded` otherwise). The driver owns the reporting `context`
 * (`graphId`, `nodeId`), which it has in scope and the table does not.
 *
 * Because reports run before the step, a failed step never suppresses the
 * reports that describe already-known facts. This is a deliberate change
 * from the inline `materialize()`, where a throwing `restore()` escapes
 * before the add and cleanup failures are reported: here `removing ->
 * restoring` reports `add_failed` (and `rollback_failed`) first, then runs
 * `restore-records`, and a restore failure adds `restore_failed` on top.
 * Telemetry order is therefore add, cleanup, restore, in every outcome.
 *
 * A terminal state is only observable once its guarantee holds: `settled`
 * means the successor is attached, `restored` means the records are back,
 * `stranded` means the restore itself failed and the graph and stores
 * disagree.
 *
 * An event with no meaning in the current phase returns the state unchanged
 * with no commands and no step, so duplicate or stale delivery is harmless
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

/**
 * `recovered`: the failure was contained and the graph matches the records.
 * `degraded`: the graph or stores may disagree with what the user sees.
 */
type ReplacementOutcome = 'recovered' | 'degraded'

/** Infallible bookkeeping; the driver runs these in order, before the step. */
export type ReplacementCommand =
  | { readonly kind: 'release-records' }
  | {
      readonly kind: 'report'
      readonly errorType: ReplacementErrorType
      readonly outcome: ReplacementOutcome
      readonly cause: unknown
    }

/** The single fallible effect a non-terminal state waits on. */
export type ReplacementStep =
  | 'add-successor'
  | 'configure-successor'
  | 'remove-successor'
  | 'restore-records'

export type StepResult = { ok: true } | { ok: false; cause: unknown }

export interface ReplacementTransition {
  readonly state: ReplacementState
  readonly commands: readonly ReplacementCommand[]
  readonly step: ReplacementStep | null
}

const STEP_EVENTS = {
  'add-successor': { ok: 'add-succeeded', failed: 'add-failed' },
  'configure-successor': {
    ok: 'configure-succeeded',
    failed: 'configure-failed'
  },
  'remove-successor': { ok: 'cleanup-succeeded', failed: 'cleanup-failed' },
  'restore-records': { ok: 'restore-succeeded', failed: 'restore-failed' }
} as const satisfies Record<
  ReplacementStep,
  { ok: ReplacementEvent['type']; failed: ReplacementEvent['type'] }
>

/**
 * The only way a step outcome becomes an event. A failure carries its cause
 * by identity so the eventual `report` command points at the original error.
 */
export function stepEvent(
  step: ReplacementStep,
  result: StepResult
): ReplacementEvent {
  const { ok, failed } = STEP_EVENTS[step]
  return result.ok ? { type: ok } : { type: failed, cause: result.cause }
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
  outcome: ReplacementOutcome,
  cause: unknown
): ReplacementCommand {
  return { kind: 'report', errorType, outcome, cause }
}

function fromPending(event: ReplacementEvent): ReplacementTransition | null {
  if (event.type !== 'release') return null
  return {
    state: { phase: 'released' },
    commands: [{ kind: 'release-records' }],
    step: 'add-successor'
  }
}

function fromReleased(event: ReplacementEvent): ReplacementTransition | null {
  switch (event.type) {
    case 'add-succeeded':
      return {
        state: { phase: 'committed' },
        commands: [],
        step: 'configure-successor'
      }
    case 'add-failed':
      return {
        state: { phase: 'removing', cause: event.cause },
        commands: [],
        step: 'remove-successor'
      }
    default:
      return null
  }
}

function fromCommitted(event: ReplacementEvent): ReplacementTransition | null {
  switch (event.type) {
    case 'configure-succeeded':
      return { state: { phase: 'settled' }, commands: [], step: null }
    case 'configure-failed':
      return {
        state: { phase: 'settled' },
        commands: [
          report(
            'agent_node_materialize_configure_failed',
            'degraded',
            event.cause
          )
        ],
        step: null
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
        commands: [
          report('agent_node_materialize_add_failed', 'recovered', addCause)
        ],
        step: 'restore-records'
      }
    case 'cleanup-failed':
      return {
        state: { phase: 'restoring' },
        commands: [
          report('agent_node_materialize_add_failed', 'degraded', addCause),
          report(
            'agent_node_materialize_rollback_failed',
            'degraded',
            event.cause
          )
        ],
        step: 'restore-records'
      }
    default:
      return null
  }
}

function fromRestoring(event: ReplacementEvent): ReplacementTransition | null {
  switch (event.type) {
    case 'restore-succeeded':
      return { state: { phase: 'restored' }, commands: [], step: null }
    case 'restore-failed':
      return {
        state: { phase: 'stranded' },
        commands: [
          report(
            'agent_node_materialize_restore_failed',
            'degraded',
            event.cause
          )
        ],
        step: null
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
  return legalTransition(state, event) ?? { state, commands: [], step: null }
}
