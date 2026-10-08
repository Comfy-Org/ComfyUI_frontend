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

/**
 * Funds returned, so re-arm for the next handoff and let it report again -
 * unless this user already closed the notice, which outlives the refill.
 */
function refilled(
  state: CreditTransitionNoticeState
): CreditTransitionNoticeState {
  const dismissed = state.phase === 'dismissed'
  return {
    ...state,
    scopedHasFunds: true,
    phase: dismissed ? 'dismissed' : 'idle'
  }
}

/**
 * The falling edge, and only from an observed `true`. A second `false` read is
 * not a second handoff, and a closed notice does not reopen on one.
 */
function exhausted(
  state: CreditTransitionNoticeState
): CreditTransitionNoticeState {
  const arms = state.scopedHasFunds && state.phase !== 'dismissed'
  return {
    ...state,
    scopedHasFunds: false,
    phase: arms ? 'armed' : state.phase
  }
}

function reduceScopedRead(
  state: CreditTransitionNoticeState | null,
  identity: string,
  scopedHasFunds: boolean
): CreditTransitionNoticeState {
  // A first read, or the first read after an identity switch, starts a fresh
  // episode and witnesses no handoff.
  const fresh = state === null || state.identity !== identity
  if (fresh) return { identity, scopedHasFunds, phase: 'idle' }
  return scopedHasFunds ? refilled(state) : exhausted(state)
}

/**
 * Only an armed episode owes an impression; a re-render of one already
 * reported, or of a closed one, owes nothing.
 */
function reduceShown(
  state: CreditTransitionNoticeState
): CreditTransitionNoticeState {
  return state.phase === 'armed' ? { ...state, phase: 'reported' } : state
}

/**
 * `null` means no scoped balance has been observed yet, which is why a `false`
 * first read cannot arm the notice: with no prior `true` there is no handoff to
 * have witnessed, only a user who was already out of scoped credit.
 *
 * `shown` and `dismissed` for an identity this state does not hold return it
 * untouched. Both originate from the rendered notice, which only renders for
 * the armed identity, so that case is unreachable rather than merely unlikely.
 */
export function reduceCreditTransitionNotice(
  state: CreditTransitionNoticeState | null,
  event: CreditTransitionNoticeEvent
): CreditTransitionNoticeState | null {
  if (event.type === 'scopedRead')
    return reduceScopedRead(state, event.identity, event.scopedHasFunds)
  if (state === null || state.identity !== event.identity) return state
  if (event.type === 'shown') return reduceShown(state)
  return { ...state, phase: 'dismissed' }
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
