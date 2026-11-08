/** @knipIgnoreUsedByStackedPR */
export const OUTPUTS_PAGE = 30

export type OutputsTrayState =
  | { phase: 'closed' }
  | {
      phase: 'open'
      selected: ReadonlySet<string>
      revealed: number
      more: 'idle' | 'loading' | 'failed'
    }

export type OutputsTrayEvent =
  | { type: 'opened' }
  | { type: 'closed' }
  | { type: 'tileToggled'; key: string }
  | { type: 'selectionCleared' }
  | { type: 'moreRevealed' }
  | { type: 'moreRequested' }
  | { type: 'moreLoaded'; advanced: boolean }
  | { type: 'added' }
  | { type: 'downloaded' }

function toggled(
  selected: ReadonlySet<string>,
  key: string
): ReadonlySet<string> {
  const next = new Set(selected)
  if (!next.delete(key)) next.add(key)
  return next
}

export function reduceOutputsTray(
  state: OutputsTrayState,
  event: OutputsTrayEvent
): OutputsTrayState {
  if (state.phase === 'closed')
    return event.type === 'opened'
      ? {
          phase: 'open',
          selected: new Set(),
          revealed: OUTPUTS_PAGE,
          more: 'idle'
        }
      : state

  switch (event.type) {
    case 'opened':
      return state
    case 'closed':
    case 'added':
      return { phase: 'closed' }
    case 'tileToggled':
      return { ...state, selected: toggled(state.selected, event.key) }
    case 'selectionCleared':
    case 'downloaded':
      return { ...state, selected: new Set() }
    case 'moreRevealed':
      return { ...state, revealed: state.revealed + OUTPUTS_PAGE }
    case 'moreRequested':
      return { ...state, more: 'loading' }
    case 'moreLoaded':
      return event.advanced
        ? { ...state, revealed: state.revealed + OUTPUTS_PAGE, more: 'idle' }
        : { ...state, more: 'failed' }
  }
}
