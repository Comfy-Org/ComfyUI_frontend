import { useStorage } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { AgentOnboardingNotShownMetadata } from '@/platform/telemetry/types'
import { accountScope } from '@/platform/workflow/persistence/base/accountScope'
import { agentStorage } from '@/platform/workflow/persistence/base/agentStorage'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

export interface CoachStep {
  target: string
  title: string
  body: string
  placement: 'left-center' | 'left-end' | 'graph-bottom' | 'left-start'
  toolbarTarget?: string
  tooltip?: string
}

export function scopedOnboardingKey(
  userId: string | undefined,
  workspaceId: string | null | undefined
): string | null {
  const scope = accountScope(userId, workspaceId)
  return scope === null ? null : StorageKeys.agentOnboarded(scope)
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
    surface: 'agent',
    errorType: 'failure_locating_agent_coach_target',
    level: 'warning',
    context: { target, step }
  })
}

export function hasSeenCoach(scopedKey: string): boolean {
  try {
    return agentStorage.getItem(scopedKey) === 'true'
  } catch {
    return false
  }
}

/**
 * Clear the persisted flag with no live tour to notify. Only for the deferred
 * case, where no `useOnboarding` instance is mounted to take `restart()`; a
 * mounted tour must go through the transition so it reacts without a remount.
 */
export function resetCoach(scopedKey: string): void {
  try {
    agentStorage.removeItem(scopedKey)
  } catch {
    return
  }
}

const shownScopes = new Set<string>()
const reportedDeferrals = new Set<string>()
/** A coach paused mid-way by App Mode or a tour was already shown, so it stays quiet. */
export function trackCoachDeferral(
  scope: string,
  reason: Exclude<
    AgentOnboardingNotShownMetadata['reason'],
    'target_missing'
  > | null
): void {
  if (reason === null) {
    shownScopes.add(scope)
    return
  }
  const key = `${scope}:${reason}`
  if (shownScopes.has(scope) || reportedDeferrals.has(key)) return
  reportedDeferrals.add(key)
  useTelemetry()?.trackAgentOnboardingNotShown({ reason })
}

export function useOnboarding(
  steps: MaybeRefOrGetter<CoachStep[]>,
  storageKey: string
) {
  const seen = useStorage(storageKey, false, agentStorage)
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

  function previous(): void {
    if (!active.value || index.value === 0) return
    index.value -= 1
  }

  /**
   * Replay from the first card. `seen` is the same reactive storage ref the
   * tour reads, so clearing it here reaches every consumer; the caller does not
   * have to poke localStorage and remount to be noticed.
   */
  function restart(): void {
    index.value = 0
    seen.value = false
  }

  return { active, index, step, isLast, next, previous, finish, restart }
}
