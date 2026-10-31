import { api } from '@/scripts/api'

import type {
  CanvasPresence,
  StarterPromptProfile
} from '@/workbench/extensions/agent/experiments/starterPromptPersonalization'
import { normalizeStarterPromptProfile } from '@/workbench/extensions/agent/experiments/starterPromptPersonalization'

const ONBOARDING_SURVEY_KEY = 'onboarding_survey'

export type StarterPromptProfileRead =
  | { source: 'survey'; profile: StarterPromptProfile }
  | { source: 'unavailable'; profile: null }

const UNAVAILABLE: StarterPromptProfileRead = Object.freeze({
  source: 'unavailable',
  profile: null
})

/**
 * Reads the stored onboarding survey. Resolves to `unavailable` for a missing,
 * empty, unreadable, or unrecognized survey; never rejects and never retries.
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

  const answers = nonEmptySurveyAnswersFromSettingsPayload(payload)
  if (!answers) return UNAVAILABLE
  const profile = normalizeStarterPromptProfile(answers)
  if (!profile) return UNAVAILABLE
  return Object.freeze({ source: 'survey', profile })
}

/** Reads `present` only when the given graph holds at least one node. */
export function canvasPresenceOf(
  graph: { nodes?: { length: number } | null } | null | undefined
): CanvasPresence {
  return (graph?.nodes?.length ?? 0) > 0 ? 'present' : 'empty'
}

function nonEmptySurveyAnswersFromSettingsPayload(
  payload: unknown
): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  if (!('value' in payload)) return null
  const value = payload.value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const answers = value as Record<string, unknown>
  return Object.keys(answers).length > 0 ? answers : null
}
