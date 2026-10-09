export type CreditTransitionNoticePhase =
  | 'idle'
  | 'armed'
  | 'shown'
  | 'dismissed'

export type CreditTransitionNoticeState =
  | {
      identity: string
      scopedHasFunds: boolean
      phase: 'idle' | 'dismissed'
    }
  | {
      identity: string
      scopedHasFunds: false
      phase: 'armed' | 'shown'
    }

export type CreditTransitionNoticeEvent =
  | { type: 'scopedRead'; identity: string; scopedHasFunds: boolean }
  | { type: 'shown'; identity: string }
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
      return state.phase === 'armed' ? { ...state, phase: 'shown' } : state
    case 'dismissed':
      return { ...state, phase: 'dismissed' }
    default:
      return event satisfies never
  }
}

export function isCreditTransitionNoticeShown(
  state: CreditTransitionNoticeState | null,
  identity: string
): boolean {
  if (state === null || state.identity !== identity) return false
  return state.phase === 'armed' || state.phase === 'shown'
}
