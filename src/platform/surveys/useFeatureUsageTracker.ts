import { useStorage } from '@vueuse/core'
import { computed, reactive, shallowRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Partial<Record<string, FeatureUsage>>

interface PendingFeatureUsage {
  useCountDelta: number
  firstUsed: number
  lastUsed: number
  baseUsage?: FeatureUsage | null
}

interface PendingReset {
  baseline?: FeatureUsage | null
}

type ParsedUsageData =
  | { status: 'valid'; usageData: FeatureUsageRecord }
  | { status: 'partial'; usageData: FeatureUsageRecord }
  | { status: 'invalid' }

type PendingFeatureUsageRecord = Partial<Record<string, PendingFeatureUsage>>

const STORAGE_KEY = 'Comfy.FeatureUsage'
const MAX_USAGE_COUNT = Number.MAX_SAFE_INTEGER - 1
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000
const resetVersions = new Map<string, number>()
const pendingResets = reactive(new Set<string>())
const pendingResetUsage = new Map<string, PendingReset>()
const reportedErrorTypes = new Set<string>()
const pendingUsageData = shallowRef<PendingFeatureUsageRecord>({})

export function resetFeatureUsageTrackerStateForTest() {
  if (import.meta.env.MODE !== 'test') return
  resetVersions.clear()
  pendingResets.clear()
  pendingResetUsage.clear()
  reportedErrorTypes.clear()
  pendingUsageData.value = {}
}

function reportStorageError(error: unknown, errorType: string) {
  if (reportedErrorTypes.has(errorType)) return
  reportedErrorTypes.add(errorType)
  reportError(error, { errorType, surface: 'platform' })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return
  if (typeof value === 'string' && value.trim() === '') return

  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

function isValidUseCount(value: number | undefined): value is number {
  return value !== undefined && value >= 0 && value <= MAX_USAGE_COUNT
}

function normalizeTimestamp(value: unknown, now = Date.now()) {
  const timestamp = safeInteger(value)
  if (timestamp === undefined || timestamp <= 0) return
  return timestamp > now + MAX_CLOCK_SKEW_MS ? now : timestamp
}

function normalizeUsageData(value: unknown): FeatureUsageRecord {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).flatMap(([featureId, usage]) => {
      if (!isRecord(usage)) return []

      const useCount = safeInteger(usage.useCount)
      const firstUsed = normalizeTimestamp(usage.firstUsed)
      const lastUsed = normalizeTimestamp(usage.lastUsed)
      return isValidUseCount(useCount) &&
        firstUsed !== undefined &&
        lastUsed !== undefined
        ? [[featureId, { useCount, firstUsed, lastUsed }]]
        : []
    })
  )
}

function parseUsageData(value: string | null): ParsedUsageData {
  if (!value) return { status: 'valid', usageData: {} }

  try {
    const parsedValue: unknown = JSON.parse(value)
    if (!isRecord(parsedValue)) return { status: 'invalid' }
    const usageData = normalizeUsageData(parsedValue)
    return {
      status:
        Object.keys(usageData).length === Object.keys(parsedValue).length
          ? 'valid'
          : 'partial',
      usageData
    }
  } catch (error) {
    reportStorageError(error, 'error_parsing_feature_usage')
    return { status: 'invalid' }
  }
}

function clearPendingState() {
  pendingResets.clear()
  pendingResetUsage.clear()
  pendingUsageData.value = {}
}

function reconcileDeletedPendingUsage(
  oldUsageData: FeatureUsageRecord,
  storedUsageData: FeatureUsageRecord
) {
  pendingUsageData.value = Object.fromEntries(
    Object.entries(pendingUsageData.value).filter(
      ([featureId, pendingUsage]) => {
        if (!pendingUsage) return false
        const existed = usageFor(oldUsageData, featureId)
        const exists = usageFor(storedUsageData, featureId)
        if (!existed || exists) return true
        return existed.lastUsed < pendingUsage.firstUsed
      }
    )
  )
}

function didUsageAdvance(
  baseline: FeatureUsage | null | undefined,
  storedUsage: FeatureUsage | undefined
) {
  if (!storedUsage || baseline === undefined) return false
  if (baseline === null) return true
  return (
    storedUsage.useCount > baseline.useCount ||
    storedUsage.lastUsed > baseline.lastUsed
  )
}

function reconcilePendingResets(storedUsageData: FeatureUsageRecord) {
  for (const featureId of pendingResets) {
    const pendingReset = pendingResetUsage.get(featureId)
    if (!pendingReset) continue
    const { baseline } = pendingReset
    const storedUsage = usageFor(storedUsageData, featureId)
    const resetFinished = baseline !== undefined && !storedUsage
    if (resetFinished || didUsageAdvance(baseline, storedUsage)) {
      pendingResets.delete(featureId)
      pendingResetUsage.delete(featureId)
    }
  }
}

function reconcileStoredUsage(storedUsageData: FeatureUsageRecord) {
  pendingUsageData.value = Object.fromEntries(
    Object.entries(pendingUsageData.value).filter(
      ([featureId, pendingUsage]) =>
        !pendingUsage?.baseUsage || usageFor(storedUsageData, featureId)
    )
  )
  reconcilePendingResets(storedUsageData)
}

function reconcileExternalStorage(event: StorageEvent) {
  let storageArea: Storage
  try {
    storageArea = localStorage
  } catch {
    return
  }
  if (event.storageArea !== storageArea) return
  if (event.key === null) {
    clearPendingState()
    return
  }
  if (event.key !== STORAGE_KEY) return

  const oldUsage = parseUsageData(event.oldValue)
  const storedUsage = parseUsageData(event.newValue)
  if (oldUsage.status !== 'valid' || storedUsage.status !== 'valid') return
  reconcileDeletedPendingUsage(oldUsage.usageData, storedUsage.usageData)

  try {
    const currentUsage = parseUsageData(localStorage.getItem(STORAGE_KEY))
    if (currentUsage.status === 'valid') {
      reconcilePendingResets(currentUsage.usageData)
    }
  } catch {
    return
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', reconcileExternalStorage)
}

function usageFor(
  usageData: FeatureUsageRecord,
  featureId: string
): FeatureUsage | undefined {
  return Object.hasOwn(usageData, featureId) ? usageData[featureId] : undefined
}

function pendingUsageFor(featureId: string) {
  return Object.hasOwn(pendingUsageData.value, featureId)
    ? pendingUsageData.value[featureId]
    : undefined
}

function incrementUsage(
  usage: FeatureUsage | undefined,
  now: number
): FeatureUsage {
  return {
    useCount: Math.min((usage?.useCount ?? 0) + 1, MAX_USAGE_COUNT),
    firstUsed: usage?.firstUsed ?? now,
    lastUsed: Math.max(usage?.lastUsed ?? now, now)
  }
}

function dispatchStorageUpdate(oldValue: string | null, newValue: string) {
  try {
    const storageArea = localStorage
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: STORAGE_KEY,
        oldValue,
        newValue,
        storageArea
      })
    )
  } catch (error) {
    reportStorageError(error, 'error_dispatching_feature_usage')
  }
}

function withoutFeature<T>(
  usageData: Partial<Record<string, T>>,
  featureId: string
): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(usageData).filter(([id]) => id !== featureId)
  )
}

function applyPendingUsage(usageData: FeatureUsageRecord): FeatureUsageRecord {
  return Object.entries(pendingUsageData.value).reduce(
    (mergedUsageData, [featureId, pendingUsage]) => {
      if (!pendingUsage) return mergedUsageData
      const storedUsage = usageFor(mergedUsageData, featureId)
      return {
        ...mergedUsageData,
        [featureId]: {
          useCount: Math.min(
            (storedUsage?.useCount ?? 0) + pendingUsage.useCountDelta,
            MAX_USAGE_COUNT
          ),
          firstUsed: Math.min(
            storedUsage?.firstUsed ?? pendingUsage.firstUsed,
            pendingUsage.firstUsed
          ),
          lastUsed: Math.max(
            storedUsage?.lastUsed ?? pendingUsage.lastUsed,
            pendingUsage.lastUsed
          )
        }
      }
    },
    usageData
  )
}

function recordPendingUsage(
  featureId: string,
  usage: FeatureUsage,
  now: number,
  baseUsage: FeatureUsage | null | undefined
) {
  const pendingUsage = pendingUsageFor(featureId)
  pendingUsageData.value = {
    ...pendingUsageData.value,
    [featureId]: {
      useCountDelta: Math.min(
        (pendingUsage?.useCountDelta ?? 0) + 1,
        MAX_USAGE_COUNT
      ),
      firstUsed: pendingUsage?.firstUsed ?? usage.firstUsed,
      lastUsed: Math.max(pendingUsage?.lastUsed ?? now, now),
      baseUsage:
        pendingUsage?.baseUsage !== undefined
          ? pendingUsage.baseUsage
          : baseUsage
    }
  }
}

function applyPendingResets(usageData: FeatureUsageRecord): FeatureUsageRecord {
  return [...pendingResets].reduce(withoutFeature, usageData)
}

function withoutNewlyResetFeatures(
  usageData: FeatureUsageRecord,
  observedResetVersions: ReadonlyMap<string, number>
): FeatureUsageRecord {
  return Object.fromEntries(
    Object.entries(usageData).filter(
      ([featureId]) =>
        (resetVersions.get(featureId) ?? 0) <=
        (observedResetVersions.get(featureId) ?? 0)
    )
  )
}

function persistUsageData(
  featureId: string,
  now: number,
  currentUsageData: FeatureUsageRecord
) {
  let oldValue: string | null = null
  const fallbackUsageData = applyPendingUsage(
    applyPendingResets(currentUsageData)
  )
  let usageData = {
    ...fallbackUsageData,
    [featureId]: incrementUsage(usageFor(fallbackUsageData, featureId), now)
  }
  let newValue = ''
  let storageWritten = false
  let baseUsage: FeatureUsage | null | undefined

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    const parsedUsageData = parseUsageData(oldValue)
    const storedUsageData =
      parsedUsageData.status === 'invalid' ? {} : parsedUsageData.usageData
    if (parsedUsageData.status === 'valid') {
      reconcileStoredUsage(storedUsageData)
    }
    const resetAdjustedUsageData = applyPendingResets(storedUsageData)
    baseUsage = usageFor(resetAdjustedUsageData, featureId) ?? null
    const mergedUsageData = applyPendingUsage(resetAdjustedUsageData)
    usageData = {
      ...mergedUsageData,
      [featureId]: incrementUsage(usageFor(mergedUsageData, featureId), now)
    }
    newValue = JSON.stringify(usageData)

    localStorage.setItem(STORAGE_KEY, newValue)
    storageWritten = true
    pendingResets.clear()
    pendingResetUsage.clear()
    pendingUsageData.value = {}
  } catch (error) {
    reportStorageError(error, 'error_persisting_feature_usage')
    const failedUsage = usageFor(usageData, featureId)
    if (failedUsage) {
      recordPendingUsage(featureId, failedUsage, now, baseUsage)
    }
  }

  if (storageWritten) {
    dispatchStorageUpdate(oldValue, newValue)
  }
  return { storageWritten, usageData }
}

function resetUsageData(featureId: string) {
  let oldValue: string | null = null
  let usageData: FeatureUsageRecord = {}
  let newValue = ''
  let storageWritten = false

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    const parsedUsageData = parseUsageData(oldValue)
    const storedUsageData =
      parsedUsageData.status === 'invalid' ? {} : parsedUsageData.usageData
    const pendingReset = pendingResetUsage.get(featureId)
    if (pendingReset && parsedUsageData.status === 'valid') {
      pendingResetUsage.set(featureId, {
        ...pendingReset,
        baseline: usageFor(storedUsageData, featureId) ?? null
      })
    }
    if (parsedUsageData.status === 'valid') {
      reconcileStoredUsage(storedUsageData)
    }
    usageData = applyPendingUsage(applyPendingResets(storedUsageData))
    newValue = JSON.stringify(usageData)
    localStorage.setItem(STORAGE_KEY, newValue)
    storageWritten = true
    pendingResets.clear()
    pendingResetUsage.clear()
    pendingUsageData.value = {}
  } catch (error) {
    reportStorageError(error, 'error_resetting_feature_usage')
  }

  if (storageWritten) {
    dispatchStorageUpdate(oldValue, newValue)
  }
  return { storageWritten, usageData }
}

/**
 * Tracks feature usage for survey eligibility.
 * Persists to localStorage.
 */
export function useFeatureUsageTracker(featureId: string) {
  const usageData = useStorage<FeatureUsageRecord>(STORAGE_KEY, {})
  let observedResetVersions = new Map(resetVersions)

  const usage = computed(() =>
    usageFor(
      applyPendingUsage(
        applyPendingResets(normalizeUsageData(usageData.value))
      ),
      featureId
    )
  )
  const useCount = computed(() => usage.value?.useCount ?? 0)

  function trackUsage() {
    const now = Date.now()
    const normalizedUsageData = normalizeUsageData(usageData.value)
    const currentUsageData = withoutNewlyResetFeatures(
      normalizedUsageData,
      observedResetVersions
    )
    observedResetVersions = new Map(resetVersions)

    const persisted = persistUsageData(featureId, now, currentUsageData)
    if (persisted.storageWritten) usageData.value = persisted.usageData
  }

  function reset() {
    const resetVersion = (resetVersions.get(featureId) ?? 0) + 1
    resetVersions.set(featureId, resetVersion)
    observedResetVersions.set(featureId, resetVersion)
    pendingResets.add(featureId)
    pendingResetUsage.set(featureId, {})
    pendingUsageData.value = withoutFeature(pendingUsageData.value, featureId)
    const persisted = resetUsageData(featureId)
    if (persisted.storageWritten) usageData.value = persisted.usageData
  }

  return {
    usage,
    useCount,
    trackUsage,
    reset
  }
}
