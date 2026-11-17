import { messages } from './messages'
import { isThinkingPanel } from './panelState'
import type { PanelState } from './panelState'
import type { PointState } from './pointState'
import type { ThinkingLog } from './thinkingLog'

export interface SlotFacts {
  panel: PanelState
  phase: PointState['phase']
  hasDraft: boolean
  unsent: number
  thinking: ThinkingLog | null
}

export type SlotView =
  | { kind: 'none' }
  | { kind: 'hint' }
  | { kind: 'summary' }
  | { kind: 'failure' }
  | { kind: 'waiting' }
  | { kind: 'noThinking' }
  | { kind: 'questions' }
  | { kind: 'thinking'; tall: boolean }

function restingView(facts: SlotFacts): SlotView {
  const { phase, thinking } = facts
  if (phase === 'failed') return { kind: 'failure' }
  if (phase === 'waiting') return { kind: 'waiting' }
  if (phase === 'annotating' && !facts.hasDraft && facts.unsent > 0)
    return { kind: 'summary' }
  if (thinking?.text.trim()) return { kind: 'none' }
  if (thinking?.done) return { kind: 'noThinking' }
  const asksForQuestions =
    phase === 'annotating' && !facts.hasDraft && facts.unsent === 0
  return asksForQuestions ? { kind: 'hint' } : { kind: 'none' }
}

export function slotView(facts: SlotFacts): SlotView {
  const { panel, thinking } = facts
  if (panel === 'questions') return { kind: 'questions' }
  if (isThinkingPanel(panel) && thinking)
    return { kind: 'thinking', tall: panel === 'thinkingTall' }
  return restingView(facts)
}

/**
 * What the Ask button does. While a request is in flight it toggles the
 * thinking, folded or open; at any other time it toggles the mode. A request
 * without thinking has nothing to toggle, so the button stays the mode's.
 */
export type AskRole = 'mode' | 'thinkingFolded' | 'thinkingOpen'

export function askRole(
  facts: Pick<SlotFacts, 'panel' | 'phase' | 'thinking'>
): AskRole {
  const { panel, phase, thinking } = facts
  if (phase !== 'waiting' || !thinking) return 'mode'
  return isThinkingPanel(panel) ? 'thinkingOpen' : 'thinkingFolded'
}

/** The tooltip of the Ask button, which says what it does in its role. */
export function askTitle(role: AskRole): string {
  if (role === 'mode') return messages.annotateTooltip
  return role === 'thinkingOpen' ? messages.hideThinking : messages.showThinking
}

/** What assistive technology calls the Ask button, whatever draws it. */
export function askName(role: AskRole): string {
  return role === 'mode' ? messages.annotate : messages.askThinking
}

/** Whether Ask reads as pressed: the mode is on, or the thinking box is open. */
export function askPressed(
  role: AskRole,
  state: { annotating: boolean }
): boolean {
  return role === 'mode' ? state.annotating : role === 'thinkingOpen'
}
