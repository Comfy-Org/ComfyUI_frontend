import type { AgentStarterPromptId } from '@/platform/telemetry/types'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'

/**
 * Stable ids for the empty state's starter prompts, index-aligned with both
 * `agent.suggestedPrompts.cloud` and `agent.suggestedPrompts.local` in the
 * English locale, and with the icon list in `EmptyState.vue`.
 *
 * The copy is owned by product and is expected to change; these ids are not,
 * which is the whole point of them — an event keyed on display text cannot
 * survive a rewrite, and an event keyed on nothing cannot tell the five chips
 * apart. An appended prompt needs its id added here; until then that extra chip
 * reports `unregistered`.
 */
export const STARTER_PROMPT_IDS = [
  'slot_1',
  'slot_2',
  'slot_3',
  'slot_4',
  'slot_5'
] as const satisfies readonly AgentStarterPromptId[]

/** What the empty state knows about the chip that was clicked. */
export interface AgentStarterPromptAttribution {
  promptId: AgentStarterPromptId
  promptIndex: number
  promptCount: number
  promptTextHash: string
  locale: string
  assignment?: 'control' | 'test'
}

/** What the composer holds until the draft is submitted, or replaced. */
export interface AgentStarterPromptSource {
  id: AgentStarterPromptId
  clickId: string
  assignment?: 'control' | 'test'
}

export function starterPromptIdAt(index: number): AgentStarterPromptId {
  return STARTER_PROMPT_IDS[index] ?? 'unregistered'
}

export function starterPromptAttribution(
  text: string,
  index: number,
  count: number,
  locale: string,
  assignment: 'control' | 'test' = 'control'
): AgentStarterPromptAttribution {
  return {
    promptId: starterPromptIdAt(index),
    promptIndex: index,
    promptCount: count,
    promptTextHash: hashPath(text),
    locale,
    assignment
  }
}
