import type { AgentStarterPromptId } from '@/platform/telemetry/types'
import { fnv1a } from '@/platform/workflow/persistence/base/hashUtil'

/**
 * Stable ids for the empty state's starter prompts, one per slot, index-aligned
 * with `agent.suggestedPrompts` in the locale files exactly as the chips' icons
 * already are.
 *
 * The copy is owned by product and is expected to change; these ids are not,
 * which is the whole point of them — an event keyed on display text cannot
 * survive a rewrite, and an event keyed on nothing cannot tell the five chips
 * apart. A prompt added to the locale array needs its id added here in the same
 * position; until then the extra chip reports `unregistered` rather than
 * borrowing a neighbour's identity.
 */
export const STARTER_PROMPT_IDS = [
  'generate_image',
  'list_workflows',
  'find_workflow',
  'explain_selected_node',
  'build_video_workflow'
] as const satisfies readonly AgentStarterPromptId[]

/** What the empty state knows about the chip that was clicked. */
export interface AgentStarterPromptAttribution {
  promptId: AgentStarterPromptId
  promptIndex: number
  promptCount: number
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
 * 8 hex chars of FNV-1a over the displayed text: identifies the copy a click
 * was made against without carrying the copy, so a rewrite under a stable
 * `prompt_id` is visible in the data instead of silently merging two prompts.
 * Reuses the hash the workflow draft keys already use — same properties needed,
 * no second implementation.
 */
export function starterPromptTextHash(text: string): string {
  return fnv1a(text).toString(16).padStart(8, '0')
}

export function starterPromptAttribution(
  text: string,
  index: number,
  count: number,
  locale: string
): AgentStarterPromptAttribution {
  return {
    promptId: starterPromptIdAt(index),
    promptIndex: index,
    promptCount: count,
    promptTextHash: starterPromptTextHash(text),
    locale
  }
}
