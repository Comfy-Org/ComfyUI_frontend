import type {
  AgentStarterPromptAssignment,
  AgentStarterPromptId
} from '@/platform/telemetry/types'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'

/**
 * Stable ids for the empty state's starter prompts, index-aligned with
 * `agent.suggestedPrompts.{cloud,local}` and the Cloud-only
 * `agent.suggestedPrompts.treatment.cloud` list in the English locale, and with
 * the icon list in `EmptyState.vue`. A Cloud slot shows different copy per arm.
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
  visiblePromptCount: number
  promptTextHash: string
  locale: string
  assignment?: AgentStarterPromptAssignment
}

/** What the composer holds until the draft is submitted, or replaced. */
export interface AgentStarterPromptSource {
  id: AgentStarterPromptId
  clickId: string
  assignment?: AgentStarterPromptAssignment
}

export function starterPromptIdAt(index: number): AgentStarterPromptId {
  return STARTER_PROMPT_IDS[index] ?? 'unregistered'
}

/**
 * `count` is the size of the rendered set; `visibleCount` is how many of that
 * set the viewer could actually see, which is smaller in a narrow panel. They
 * are two separate facts and are reported as two separate fields on purpose —
 * folding the width-dependent one into `promptCount` would make a set change
 * and a panel resize indistinguishable to the starter-prompt set experiment.
 * `visibleCount` defaults to `count` for callers with no layout to measure.
 */
export function starterPromptAttribution(
  text: string,
  index: number,
  count: number,
  locale: string,
  assignment?: AgentStarterPromptAssignment,
  visibleCount: number = count
): AgentStarterPromptAttribution {
  return {
    promptId: starterPromptIdAt(index),
    promptIndex: index,
    promptCount: count,
    visiblePromptCount: visibleCount,
    promptTextHash: hashPath(text),
    locale,
    ...(assignment ? { assignment } : {})
  }
}
