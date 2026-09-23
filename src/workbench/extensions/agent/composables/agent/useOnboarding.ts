import { useStorage } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { AgentOnboardingNotShownReason } from '@/platform/telemetry/types'

export interface CoachStep {
  target: string
  title: string
  body: string
  placement: 'left-center' | 'left-end' | 'graph-bottom' | 'left-start'
  toolbarTarget?: string
}

const SHARED_ONBOARDING_KEY = 'Comfy.AgentPanel.onboarded'

export function scopedOnboardingKey(
  userId: string | undefined,
  workspaceId: string | null | undefined
): string | null {
  if (!userId || !workspaceId) return null
  return `${SHARED_ONBOARDING_KEY}.${userId}.${workspaceId}`
}

/**
 * The coach marks recorded one flag for the whole device, while consent is
 * recorded per account and workspace. A user who had seen the marks anywhere
 * therefore joined a new workspace, accepted consent again, and got no
 * guidance. Carry the old flag onto the scope in front of the user, then drop
 * the shared one so later scopes start clean.
 */
export function adoptSharedOnboardingFlag(scopedKey: string): void {
  try {
    if (localStorage.getItem(SHARED_ONBOARDING_KEY) !== 'true') return
    if (localStorage.getItem(scopedKey) === null)
      localStorage.setItem(scopedKey, 'true')
    localStorage.removeItem(SHARED_ONBOARDING_KEY)
  } catch {
    // Storage is unavailable, so the coach marks run again.
  }
}

const reportedMissingTargets = new Set<string>()
/** Once per target per session: every panel mount would otherwise repeat it. */
export function reportMissingCoachTarget(target: string, step: number): void {
  const key = `${target}:${step}`
  if (reportedMissingTargets.has(key)) return
  reportedMissingTargets.add(key)
  useTelemetry()?.trackAgentOnboardingNotShown({
    reason: 'target_missing',
    step
  })
  reportError(new Error('Agent coach target never mounted'), {
    errorType: 'failure_locating_agent_coach_target',
    level: 'warning',
    context: { target, step }
  })
}

export function hasSeenCoach(scopedKey: string): boolean {
  try {
    return localStorage.getItem(scopedKey) === 'true'
  } catch {
    return false
  }
}

const reportedDeferrals = new Set<string>()
export function reportCoachDeferred(
  reason: Exclude<AgentOnboardingNotShownReason, 'target_missing'>,
  scope: string
): void {
  const key = `${scope}:${reason}`
  if (reportedDeferrals.has(key)) return
  reportedDeferrals.add(key)
  useTelemetry()?.trackAgentOnboardingNotShown({ reason })
}

export function useOnboarding(
  steps: MaybeRefOrGetter<CoachStep[]>,
  storageKey = SHARED_ONBOARDING_KEY
) {
  const seen = useStorage(storageKey, false)
  const index = ref(0)
  const step = computed(() => toValue(steps)[index.value])
  const active = computed(() => !seen.value && !!step.value)
  const isLast = computed(() => index.value === toValue(steps).length - 1)

  function finish(): void {
    seen.value = true
  }

  function next(): void {
    if (!active.value) return
    if (isLast.value) finish()
    else index.value += 1
  }

  return { active, index, step, isLast, next, finish }
}
