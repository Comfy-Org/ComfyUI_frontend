import { useStorage } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import { createOnceGate } from '@/platform/telemetry/onceGate'
import type { AgentOnboardingNotShownReason } from '@/platform/telemetry/types'

export interface CoachStep {
  target: string
  title: string
  body: string
  placement: 'left-center' | 'left-end' | 'graph-bottom' | 'left-start'
  toolbarTarget?: string
}

export const SHARED_ONBOARDING_KEY = 'Comfy.AgentPanel.onboarded'

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

const notShownGate = createOnceGate()
export const resetOnboardingNotShownReports = notShownGate.reset

/**
 * Once per scope and reason for the session, like the tour engine's
 * `not_started`. True when this call was the one that reported.
 */
export function reportOnboardingNotShown(
  reason: AgentOnboardingNotShownReason,
  scope: string | undefined
): boolean {
  if (!notShownGate.first(`${scope ?? ''}:${reason}`)) return false
  useTelemetry()?.trackAgentOnboardingNotShown({ reason })
  return true
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

  return { active, seen, index, step, isLast, next, finish }
}
