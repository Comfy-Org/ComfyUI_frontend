import { useStorage } from '@vueuse/core'
import { computed, reactive, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type {
  AgentOnboardingCard,
  AgentOnboardingNotShownMetadata
} from '@comfyorg/telemetry/types'

import { AGENT_ONBOARDED_SCOPES_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'

export interface CoachStep {
  card: AgentOnboardingCard
  target: string
  title: string
  body: string
  placement: 'left-center' | 'left-end' | 'left-start'
  tooltip?: string
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
    surface: 'agent',
    errorType: 'failure_locating_agent_coach_target',
    level: 'warning',
    context: { target, step }
  })
}

function scopeList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((scope): scope is string => typeof scope === 'string')
}

function onboardedScopes(): readonly string[] {
  return scopeList(
    useSettingStore().settingValues[AGENT_ONBOARDED_SCOPES_SETTING_ID]
  )
}

const replayRequested = reactive(new Set<string>())

function settingsRecordSeen(scopedKey: string): boolean {
  return (
    !replayRequested.has(scopedKey) && onboardedScopes().includes(scopedKey)
  )
}

const unsavedScopes = new Map<string, boolean>()
let settingsWrites: Promise<void> = Promise.resolve()
let reportedWriteFailure = false

function reportWriteFailure(failure: unknown): void {
  if (reportedWriteFailure) return
  reportedWriteFailure = true
  reportError(failure, {
    surface: 'agent',
    errorType: 'failure_persisting_agent_onboarding_completion',
    level: 'warning'
  })
}

async function writeSeen(scopedKey: string, seen: boolean): Promise<void> {
  const scopes = onboardedScopes()
  if (
    scopes.includes(scopedKey) === seen &&
    unsavedScopes.get(scopedKey) !== seen
  ) {
    unsavedScopes.delete(scopedKey)
    return
  }
  const next = seen
    ? [...new Set([...scopes, scopedKey])]
    : scopes.filter((scope) => scope !== scopedKey)
  const outcome = await useSettingStore().setWithOutcome(
    AGENT_ONBOARDED_SCOPES_SETTING_ID,
    next
  )
  if (outcome.status === 'refused') {
    unsavedScopes.set(scopedKey, seen)
    reportWriteFailure(
      `Failed to store onboarded scopes (${outcome.statusCode})`
    )
  } else if (outcome.status === 'unconfirmed') {
    unsavedScopes.set(scopedKey, seen)
    reportWriteFailure(outcome.cause)
  } else if (outcome.status === 'saved') {
    unsavedScopes.delete(scopedKey)
  }
}

function persistSeenToSettings(scopedKey: string, seen: boolean): void {
  if (seen) replayRequested.delete(scopedKey)
  else replayRequested.add(scopedKey)
  settingsWrites = settingsWrites
    .then(() => writeSeen(scopedKey, seen))
    .catch(reportWriteFailure)
}

function localStorageRecordsSeen(scopedKey: string): boolean {
  try {
    return localStorage.getItem(scopedKey) === 'true'
  } catch {
    return false
  }
}

export function hasSeenCoach(scopedKey: string): boolean {
  return localStorageRecordsSeen(scopedKey) || settingsRecordSeen(scopedKey)
}

/**
 * Clear the persisted flag with no live tour to notify; a mounted tour must use
 * `restart()` so it reacts without a remount.
 */
export function resetCoach(scopedKey: string): void {
  persistSeenToSettings(scopedKey, false)
  try {
    localStorage.removeItem(scopedKey)
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
  storageKey = SHARED_ONBOARDING_KEY
) {
  const seenLocally = useStorage(storageKey, false)
  if (seenLocally.value) persistSeenToSettings(storageKey, true)
  else if (unsavedScopes.get(storageKey) === false)
    persistSeenToSettings(storageKey, false)
  const seen = computed(
    () => seenLocally.value || settingsRecordSeen(storageKey)
  )
  const index = ref(0)
  const step = computed(() => toValue(steps)[index.value])
  const active = computed(() => !seen.value && !!step.value)
  const isLast = computed(() => index.value === toValue(steps).length - 1)

  function markSeen(value: boolean): void {
    seenLocally.value = value
    persistSeenToSettings(storageKey, value)
  }

  function finish(): void {
    markSeen(true)
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

  function restart(): void {
    index.value = 0
    markSeen(false)
  }

  return { active, index, step, isLast, next, previous, finish, restart }
}
