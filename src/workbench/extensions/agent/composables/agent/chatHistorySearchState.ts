/**
 * `text` is the raw field value. The effective query is `text.trim()`:
 * whitespace-only text is `idle` (the list is unfiltered) but stays in the
 * field. "No results" is a view of `searching`, not a stored state.
 */
export type ChatHistorySearchState = {
  status: 'idle' | 'searching'
  text: string
}

export type ChatHistorySearchEvent =
  | { type: 'type'; text: string }
  | { type: 'clear' }
  | { type: 'escape' }

export type ChatHistorySearchEffect = 'none' | 'leaveHistory'

export const initialChatHistorySearchState: ChatHistorySearchState = {
  status: 'idle',
  text: ''
}

function stateForText(text: string): ChatHistorySearchState {
  return { status: text.trim() === '' ? 'idle' : 'searching', text }
}

export function transitionChatHistorySearch(
  state: ChatHistorySearchState,
  event: ChatHistorySearchEvent
): { state: ChatHistorySearchState; effect: ChatHistorySearchEffect } {
  switch (event.type) {
    case 'type':
      return { state: stateForText(event.text), effect: 'none' }
    case 'clear':
      return { state: initialChatHistorySearchState, effect: 'none' }
    case 'escape':
      // Esc first empties the field (even whitespace), then leaves History.
      return {
        state: initialChatHistorySearchState,
        effect: state.text === '' ? 'leaveHistory' : 'none'
      }
  }
}
