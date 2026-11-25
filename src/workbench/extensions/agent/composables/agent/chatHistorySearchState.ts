export type ChatHistorySearchState = {
  status: 'idle' | 'searching'
  text: string
}

export type ChatHistorySearchEvent =
  | { type: 'type'; text: string }
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
    case 'escape':
      return {
        state: initialChatHistorySearchState,
        effect: state.text === '' ? 'leaveHistory' : 'none'
      }
  }
}
