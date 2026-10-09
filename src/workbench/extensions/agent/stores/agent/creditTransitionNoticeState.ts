/**
 * The Agent credit-transition notice episode: one state, one pure transition.
 *
 * The notice tells a user that their free Agent-scoped grant just ran out and
 * later activity draws on the workspace balance. It may only appear after an
 * **observed** `true` -> `false` handoff on the scoped balance, it reports one
 * impression per episode, and a dismissal outlives a refill.
 *
 * Those three rules were four separate refs that had to agree, which let them
 * disagree: a `reported` identity with nothing armed, an episode armed and
 * dismissed at once, or refs pointing at different identities. Everything here
 * is one record keyed by identity, so an identity switch invalidates the
 * episode structurally instead of by remembering to reset each ref.
 *
 * Pure by design (`docs/guidance/state-and-effects.md` section 2): no Vue, no
 * store and no telemetry, so every phase crossed with every event is a table
 * test.
 */

/**
 * - `idle` — observed, nothing to show. The resting phase, and where a refill
 *   returns an episode so the next handoff can arm again.
 * - `armed` — an observed handoff happened; the notice may render and still
 *   owes an impression.
 * - `reported` — rendered and counted. Still visible; it just must not count
 *   twice.
 * - `dismissed` — the user closed it. Terminal for this identity: a refill does
 *   not reopen it.
 */
export type CreditTransitionNoticePhase =
  | 'idle'
  | 'armed'
  | 'reported'
  | 'dismissed'

export interface CreditTransitionNoticeState {
  /** The `user:workspace` pair this episode belongs to. */
  identity: string
  /** Last defined Agent-scoped funds read seen for `identity`. */
  scopedHasFunds: boolean
  phase: CreditTransitionNoticePhase
}

export type CreditTransitionNoticeEvent =
  /** A defined Agent-scoped funds read. Undefined reads never reach here. */
  | { type: 'scopedRead'; identity: string; scopedHasFunds: boolean }
  /** The notice reached the screen and telemetry is available to record it. */
  | { type: 'shown'; identity: string }
  /** The user closed the notice. */
  | { type: 'dismissed'; identity: string }

function reduceScopedRead(
  state: CreditTransitionNoticeState | null,
  identity: string,
  scopedHasFunds: boolean
): CreditTransitionNoticeState {
  if (state === null || state.identity !== identity)
    return { identity, scopedHasFunds, phase: 'idle' }
  if (state.phase === 'dismissed') return { ...state, scopedHasFunds }
  if (scopedHasFunds) return { ...state, scopedHasFunds, phase: 'idle' }
  const phase = state.scopedHasFunds ? 'armed' : state.phase
  return { ...state, scopedHasFunds, phase }
}

export function reduceCreditTransitionNotice(
  state: CreditTransitionNoticeState | null,
  event: CreditTransitionNoticeEvent
): CreditTransitionNoticeState | null {
  if (event.type === 'scopedRead')
    return reduceScopedRead(state, event.identity, event.scopedHasFunds)
  if (state === null || state.identity !== event.identity) return state
  switch (event.type) {
    case 'shown':
      return state.phase === 'armed' ? { ...state, phase: 'reported' } : state
    case 'dismissed':
      return { ...state, phase: 'dismissed' }
    default:
      return event satisfies never
  }
}

/**
 * Whether the notice should render for `identity` on this episode alone. The
 * caller still applies the billing trust gate and the funds signals, which are
 * live reads rather than episode state.
 */
export function isCreditTransitionNoticeOpen(
  state: CreditTransitionNoticeState | null,
  identity: string
): boolean {
  if (state === null || state.identity !== identity) return false
  return state.phase === 'armed' || state.phase === 'reported'
}
