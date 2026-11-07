import type { AgentStarterPromptId } from '@comfyorg/telemetry/types'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'

/**
 * Index-aligned prompt/icon slots; indices past the table are `unregistered`.
 * Pair ids with the displayed-label hash and source locale to identify copy.
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
}

/** What the composer holds until the draft is submitted, or replaced. */
export interface AgentStarterPromptSource {
  id: AgentStarterPromptId
  clickId: string
}

export function starterPromptIdAt(index: number): AgentStarterPromptId {
  return STARTER_PROMPT_IDS[index] ?? 'unregistered'
}

/**
 * `count` is the size of the rendered set; `visibleCount` is how many of that
 * set the viewer could actually see, which is smaller in a narrow panel. They
 * are two separate facts and are reported as two separate fields on purpose —
 * folding the width-dependent one into `promptCount` would make a set change
 * and a panel resize indistinguishable in analytics.
 * `visibleCount` defaults to `count` for callers with no layout to measure.
 */
export function starterPromptAttribution(
  text: string,
  index: number,
  count: number,
  locale: string,
  visibleCount: number = count
): AgentStarterPromptAttribution {
  return {
    promptId: starterPromptIdAt(index),
    promptIndex: index,
    promptCount: count,
    visiblePromptCount: visibleCount,
    promptTextHash: hashPath(text),
    locale
  }
}
