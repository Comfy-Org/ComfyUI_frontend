export type PanelEvent =
  | { type: 'modeEnteredFromTrigger' }
  | { type: 'modeLeft'; hasContent: boolean }
  | { type: 'caretPressed' }
  | { type: 'collapsePressed' }
  | { type: 'stripPressed' }
  | { type: 'sendStarted' }

export type PanelState = 'open' | 'closed'

/**
 * Pure transition for whether the panel under the trigger is open. It is a
 * state of its own because it outlives the mode: the person can annotate
 * with it closed and read it with the mode off.
 */
export function reducePanel(state: PanelState, event: PanelEvent): PanelState {
  switch (event.type) {
    case 'modeEnteredFromTrigger':
    case 'stripPressed':
      return 'open'
    case 'modeLeft':
      return event.hasContent ? state : 'closed'
    case 'caretPressed':
      return state === 'open' ? 'closed' : 'open'
    case 'collapsePressed':
    case 'sendStarted':
      return 'closed'
  }
}
