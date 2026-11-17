export type PanelEvent =
  | { type: 'modeEnteredFromTrigger' }
  | { type: 'modeLeft'; hasContent: boolean }
  | { type: 'caretPressed' }
  | { type: 'collapsePressed' }
  | { type: 'stripPressed' }
  | { type: 'sendStarted'; opensThinking: boolean }
  | { type: 'requestEnded' }
  | { type: 'thinkingToggled' }
  | { type: 'tallerPressed' }
  | { type: 'startedOver' }

export type PanelState = 'closed' | 'questions' | 'thinking' | 'thinkingTall'

export function reducePanel(state: PanelState, event: PanelEvent): PanelState {
  switch (event.type) {
    case 'stripPressed':
      return 'questions'
    case 'modeEnteredFromTrigger':
      return state
    case 'modeLeft':
      return event.hasContent ? state : 'closed'
    case 'caretPressed':
      return state === 'questions' ? 'closed' : 'questions'
    case 'collapsePressed':
    case 'startedOver':
      return 'closed'
    case 'sendStarted':
      return event.opensThinking ? 'thinking' : 'closed'
    case 'requestEnded':
      return state === 'questions' ? state : 'closed'
    case 'thinkingToggled':
      return isThinkingPanel(state) ? 'closed' : 'thinking'
    case 'tallerPressed':
      if (state === 'thinking') return 'thinkingTall'
      return state === 'thinkingTall' ? 'thinking' : state
  }
}

export function isThinkingPanel(state: PanelState): boolean {
  return state === 'thinking' || state === 'thinkingTall'
}
