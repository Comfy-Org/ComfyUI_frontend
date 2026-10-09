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
