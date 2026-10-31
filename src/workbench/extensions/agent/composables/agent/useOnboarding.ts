import { useStorage } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { AgentOnboardingNotShownMetadata } from '@comfyorg/telemetry/types'

import { AGENT_ONBOARDED_SCOPES_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

export interface CoachStep {
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

function settingsRecordSeen(scopedKey: string): boolean {
  return onboardedScopes().includes(scopedKey)
}

interface PendingScopeChange {
  seen: boolean
  /** The owner generation this change was queued under. */
  generation: number
}

const pendingScopeChanges = new Map<string, PendingScopeChange>()
let settingsWrites: Promise<void> = Promise.resolve()
let scopeOwner: string | null = null
let scopeOwnerGeneration = 0

/**
 * The stored value is one whole array and `api.fetchApi` picks up whichever
 * credentials are current when a request leaves, so a write queued for one
 * account must never be sent — nor applied to the settings cache — once
 * another account owns the session. The panel publishes the account and
 * workspace scope in front of the user; changing it retires the work queued
 * under the previous one.
 */
export function setOnboardingScopeOwner(scopedKey: string | null): void {
  if (scopedKey === scopeOwner) return
  scopeOwner = scopedKey
  scopeOwnerGeneration += 1
}

function ownedScopeChanges(): Map<string, boolean> {
  const owned = new Map<string, boolean>()
  const retired: string[] = []
  for (const [scope, change] of pendingScopeChanges) {
    if (change.generation === scopeOwnerGeneration) {
      owned.set(scope, change.seen)
      continue
    }
    // A change left over from another owner cannot be written under this one.
    // Its optimistic cache entry goes with it, or the next mount would read the
    // scope as saved and its local completion flag would never re-queue it.
    pendingScopeChanges.delete(scope)
    if (change.seen) retired.push(scope)
  }
  if (retired.length > 0) {
    useSettingStore().settingValues[AGENT_ONBOARDED_SCOPES_SETTING_ID] =
      onboardedScopes().filter((scope) => !retired.includes(scope))
  }
  return owned
}

const ONBOARDING_WRITE_FAILURE = {
  surface: 'agent',
  errorType: 'failure_persisting_agent_onboarding_completion',
  level: 'warning'
} as const

function withScopeChanges(
  scopes: readonly string[],
  changes: ReadonlyMap<string, boolean>
): string[] {
  const kept = scopes.filter((scope) => !changes.has(scope))
  const added = [...changes].filter(([, seen]) => seen).map(([scope]) => scope)
  return [...kept, ...added]
}

type StoredScopesRead =
  | { ok: true; scopes: string[] }
  | { ok: false; status: number }

async function readStoredOnboardedScopes(): Promise<StoredScopesRead> {
  const response = await api.fetchApi(
    `/settings/${encodeURIComponent(AGENT_ONBOARDED_SCOPES_SETTING_ID)}`
  )
  if (response.status === 404) return { ok: true, scopes: [] }
  if (!response.ok) return { ok: false, status: response.status }
  return { ok: true, scopes: scopeList(await response.json()) }
}

/** The list to store, or null when the stored list could not be read. */
function scopesToStore(
  stored: StoredScopesRead,
  changes: ReadonlyMap<string, boolean>
): string[] | null {
  if (stored.ok) return withScopeChanges(stored.scopes, changes)
  reportError(
    `Failed to read onboarded scopes (${stored.status})`,
    ONBOARDING_WRITE_FAILURE
  )
  return null
}

function settleScopeChanges(
  stored: readonly string[],
  changes: ReadonlyMap<string, boolean>
): void {
  for (const [scope, seen] of changes) {
    if (pendingScopeChanges.get(scope)?.seen === seen)
      pendingScopeChanges.delete(scope)
  }
  useSettingStore().settingValues[AGENT_ONBOARDED_SCOPES_SETTING_ID] =
    withScopeChanges(stored, ownedScopeChanges())
}

async function writeOnboardedScopes(): Promise<void> {
  const generation = scopeOwnerGeneration
  const stillOwned = () => generation === scopeOwnerGeneration
  const changes = ownedScopeChanges()
  if (changes.size === 0) return
  try {
    const stored = await readStoredOnboardedScopes()
    if (!stillOwned()) return
    const merged = scopesToStore(stored, changes)
    if (!merged) return
    const response = await api.storeSetting(
      AGENT_ONBOARDED_SCOPES_SETTING_ID,
      merged
    )
    if (!stillOwned()) return
    if (!response.ok) {
      reportError(
        `Failed to store onboarded scopes (${response.status})`,
        ONBOARDING_WRITE_FAILURE
      )
      return
    }
    settleScopeChanges(merged, changes)
  } catch (error) {
    reportError(error, ONBOARDING_WRITE_FAILURE)
  }
}

function persistSeenToSettings(scopedKey: string, seen: boolean): void {
  if (
    seen &&
    settingsRecordSeen(scopedKey) &&
    !pendingScopeChanges.has(scopedKey)
  )
    return
  pendingScopeChanges.set(scopedKey, {
    seen,
    generation: scopeOwnerGeneration
  })
  useSettingStore().settingValues[AGENT_ONBOARDED_SCOPES_SETTING_ID] =
    withScopeChanges(onboardedScopes(), new Map([[scopedKey, seen]]))
  settingsWrites = settingsWrites.then(writeOnboardedScopes)
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
