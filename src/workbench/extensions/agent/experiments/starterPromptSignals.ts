import { api } from '@/scripts/api'

import type {
  CanvasPresence,
  StarterPromptProfile
} from '@/workbench/extensions/agent/experiments/starterPromptPersonalization'
import { normalizeStarterPromptProfile } from '@/workbench/extensions/agent/experiments/starterPromptPersonalization'

/**
 * Signal adapters for the personalized starter prompt selector.
 *
 * Both adapters are read-only and fail closed: an unreadable profile or an
 * unavailable graph degrades to the static baseline rather than surfacing an
 * error, because starter prompts render before the user has typed anything.
 *
 * Nothing calls these yet. The V2 strategies stay inactive until the
 * experiment flag, telemetry, and black-box coverage land.
 */

/** Settings key the Cloud onboarding survey writes its answers under. */
const ONBOARDING_SURVEY_KEY = 'onboarding_survey'

export type StarterPromptProfileRead =
  | { source: 'survey'; profile: StarterPromptProfile }
  | { source: 'unavailable'; profile: null }

const UNAVAILABLE: StarterPromptProfileRead = Object.freeze({
  source: 'unavailable',
  profile: null
})

/**
 * Reads the stored onboarding survey answers and keeps only the three fields
 * the selector consumes. Returns `unavailable` for a missing, empty,
 * unreadable, or unrecognized survey; never throws and never retries.
 */
export async function readStarterPromptProfile(
  signal?: AbortSignal
): Promise<StarterPromptProfileRead> {
  let payload: unknown
  try {
    const response = await api.fetchApi(`/settings/${ONBOARDING_SURVEY_KEY}`, {
      method: 'GET',
      signal,
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) return UNAVAILABLE
    payload = await response.json()
  } catch {
    return UNAVAILABLE
  }

  const answers = storedSurveyValue(payload)
  if (!answers) return UNAVAILABLE
  const profile = normalizeStarterPromptProfile(answers)
  if (!profile) return UNAVAILABLE
  return Object.freeze({ source: 'survey', profile })
}

/**
 * Maps the graph the panel is attached to onto the selector's canvas signal.
 * `present` only when the graph actually holds a node, so an attached but
 * empty canvas reads the same as no canvas at all.
 *
 * The graph is passed in rather than read from a store: `workbench/` cannot
 * import `renderer/`, and the panel that will call this already holds it.
 */
export function canvasPresenceOf(
  graph: { nodes?: { length: number } | null } | null | undefined
): CanvasPresence {
  return (graph?.nodes?.length ?? 0) > 0 ? 'present' : 'empty'
}

/**
 * The settings endpoint answers `{ value: <stored> }`, and an unanswered
 * survey is recorded as `null` or `{}`.
 */
function storedSurveyValue(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  if (!('value' in payload)) return null
  const value = payload.value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const answers = value as Record<string, unknown>
  return Object.keys(answers).length > 0 ? answers : null
}
