import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import type { StarterPromptStrategy } from '@/workbench/extensions/agent/experiments/starterPromptPersonalization'

export const STARTER_PROMPT_PERSONALIZATION_FLAG =
  'agent-starter-prompt-personalization'

export const STARTER_PROMPT_STRATEGIES = [
  'static',
  'profile',
  'canvas',
  'profile_canvas'
] as const satisfies readonly StarterPromptStrategy[]

export const INACTIVE_STARTER_PROMPT_STRATEGY =
  'static' satisfies StarterPromptStrategy

export interface StarterPromptStrategyResolution {
  strategy: StarterPromptStrategy
  source: 'inactive' | 'qa-override'
  reportsExposure: false
}

const INACTIVE: StarterPromptStrategyResolution = Object.freeze({
  strategy: INACTIVE_STARTER_PROMPT_STRATEGY,
  source: 'inactive',
  reportsExposure: false
})

function isStarterPromptStrategy(
  value: unknown
): value is StarterPromptStrategy {
  return STARTER_PROMPT_STRATEGIES.some((strategy) => strategy === value)
}

function qaOverride(): unknown {
  const sessionOverride = getSessionOverride<unknown>(
    STARTER_PROMPT_PERSONALIZATION_FLAG
  )
  return sessionOverride !== undefined
    ? sessionOverride
    : getDevOverride<unknown>(STARTER_PROMPT_PERSONALIZATION_FLAG)
}

/**
 * Resolves which starter prompt strategy to render. Reads no authenticated
 * assignment, so every caller outside an employee QA override resolves to the
 * static baseline and `reportsExposure` is always `false`.
 */
export function resolveStarterPromptStrategy(): StarterPromptStrategyResolution {
  const override = qaOverride()
  if (!isStarterPromptStrategy(override)) return INACTIVE
  return Object.freeze({
    strategy: override,
    source: 'qa-override',
    reportsExposure: false
  })
}
