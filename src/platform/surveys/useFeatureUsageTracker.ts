import { computed, reactive, shallowRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

interface FeatureUsage {
  useCount: number
  firstUsed: number
  lastUsed: number
}

type FeatureUsageRecord = Partial<Record<string, FeatureUsage>>

interface PendingUsageDelta {
  useCountDelta: number
  firstUsed: number
  lastUsed: number
  recordedAt: number
  baseUsage?: FeatureUsage | null
}

interface PendingReset {
  baseline?: FeatureUsage | null
  requestedAt: number
}

type ParsedUsageData =
  | {
      status: 'valid' | 'partial'
      usageData: FeatureUsageRecord
      invalidFeatureIds: ReadonlySet<string>
    }
  | { status: 'invalid' }

type PendingFeatureUsageRecord = Partial<Record<string, PendingUsageDelta[]>>

const STORAGE_KEY = 'Comfy.FeatureUsage'
const MAX_USAGE_COUNT = Number.MAX_SAFE_INTEGER - 1
const MAX_PENDING_USAGE_DELTAS = 100
const MAX_TIMESTAMP = Date.UTC(2100, 0, 1)
const MAX_CLOCK_SKEW = 5 * 60 * 1_000
const pendingResets = reactive(new Set<string>())
const pendingResetUsage = new Map<string, PendingReset>()
const reportedErrorTypes = new Set<string>()
const pendingUsageData = shallowRef<PendingFeatureUsageRecord>({})
const usageSnapshot = shallowRef<FeatureUsageRecord>({})

export function resetFeatureUsageTrackerStateForTest() {
  if (import.meta.env.MODE !== 'test') return
  pendingResets.clear()
  pendingResetUsage.clear()
  reportedErrorTypes.clear()
  pendingUsageData.value = {}
  usageSnapshot.value = {}
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

function normalizeTimestamp(value: unknown) {
  const timestamp = safeInteger(value)
  if (timestamp === undefined || timestamp <= 0) return
  return Math.min(timestamp, MAX_TIMESTAMP)
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
        lastUsed !== undefined &&
        firstUsed <= lastUsed
        ? [[featureId, { useCount, firstUsed, lastUsed }]]
        : []
    })
  )
}

function parseUsageData(value: string | null): ParsedUsageData {
  if (value === null) {
    return {
      status: 'valid',
      usageData: {},
      invalidFeatureIds: new Set()
    }
  }

  try {
    const parsedValue: unknown = JSON.parse(value)
    if (!isRecord(parsedValue)) return { status: 'invalid' }
    const usageData = normalizeUsageData(parsedValue)
    const invalidFeatureIds = new Set(
      Object.keys(parsedValue).filter(
        (featureId) => !Object.hasOwn(usageData, featureId)
      )
    )
    return {
      status: invalidFeatureIds.size === 0 ? 'valid' : 'partial',
      usageData,
      invalidFeatureIds
    }
  } catch {
    reportStorageError(
      new DOMException('Invalid feature usage JSON', 'SyntaxError'),
      'error_parsing_feature_usage'
    )
    return { status: 'invalid' }
  }
}

function reconcileDeletedPendingUsage(
  oldUsageData: FeatureUsageRecord,
  currentUsageData: FeatureUsageRecord,
  invalidFeatureIds: ReadonlySet<string>
) {
  pendingUsageData.value = Object.fromEntries(
    Object.entries(pendingUsageData.value).flatMap(
      ([featureId, pendingDeltas]) => {
        if (!pendingDeltas) return []
        const existed = usageFor(oldUsageData, featureId)
        const exists = usageFor(currentUsageData, featureId)
        const retainedDeltas =
          !existed || exists || invalidFeatureIds.has(featureId)
            ? pendingDeltas
            : pendingDeltas.filter(
                ({ baseUsage, recordedAt }) =>
                  baseUsage === undefined ||
                  (baseUsage === null &&
                    (!isOrderableUsage(existed) ||
                      recordedAt >= existed.lastUsed))
              )
        return retainedDeltas.length > 0
          ? [[featureId, retainedDeltas] as const]
          : []
      }
    )
  )
}

function didUsageAdvance(
  baseline: FeatureUsage | null | undefined,
  storedUsage: FeatureUsage | undefined,
  requestedAt: number
) {
  if (!storedUsage) return false
  if (baseline === undefined) {
    return isOrderableUsage(storedUsage) && storedUsage.lastUsed > requestedAt
  }
  if (baseline === null) return true
  return (
    storedUsage.useCount > baseline.useCount ||
    (isOrderableUsage(storedUsage) &&
      isOrderableUsage(baseline) &&
      storedUsage.lastUsed > baseline.lastUsed)
  )
}

function isOrderableUsage(usage: FeatureUsage) {
  const latestReasonableTimestamp = Date.now() + MAX_CLOCK_SKEW
  return (
    usage.firstUsed <= latestReasonableTimestamp &&
    usage.lastUsed <= latestReasonableTimestamp
  )
}

function isSameOrNewerGeneration(usage: FeatureUsage, baseline: FeatureUsage) {
  if (sameUsage(usage, baseline)) return true
  if (!isOrderableUsage(usage) || !isOrderableUsage(baseline)) return false
  return (
    usage.firstUsed <= baseline.firstUsed &&
    usage.useCount >= baseline.useCount &&
    usage.lastUsed >= baseline.lastUsed
  )
}

function isWrittenGeneration(usage: FeatureUsage, expectedUsage: FeatureUsage) {
  return (
    usage.firstUsed === expectedUsage.firstUsed &&
    usage.useCount >= expectedUsage.useCount &&
    usage.lastUsed >= expectedUsage.lastUsed
  )
}

function reconcilePendingResets(
  storedUsageData: FeatureUsageRecord,
  invalidFeatureIds: ReadonlySet<string> = new Set()
) {
  for (const featureId of pendingResets) {
    if (invalidFeatureIds.has(featureId)) continue
    const pendingReset = pendingResetUsage.get(featureId)
    if (!pendingReset) continue
    const { baseline, requestedAt } = pendingReset
    const storedUsage = usageFor(storedUsageData, featureId)
    const resetFinished = baseline !== undefined && !storedUsage
    if (resetFinished || didUsageAdvance(baseline, storedUsage, requestedAt)) {
      pendingResets.delete(featureId)
      pendingResetUsage.delete(featureId)
    }
  }
}

function reconcileStoredUsage(
  currentUsageData: FeatureUsageRecord,
  invalidFeatureIds: ReadonlySet<string>
) {
  pendingUsageData.value = Object.fromEntries(
    Object.entries(pendingUsageData.value).flatMap(
      ([featureId, pendingDeltas]) => {
        if (!pendingDeltas) return []
        const storedUsage = usageFor(currentUsageData, featureId)
        const retainedDeltas = pendingDeltas.filter(({ baseUsage }) => {
          if (baseUsage === undefined || baseUsage === null) return true
          if (invalidFeatureIds.has(featureId)) return true
          return (
            storedUsage !== undefined &&
            isSameOrNewerGeneration(storedUsage, baseUsage)
          )
        })
        return retainedDeltas.length > 0
          ? [[featureId, retainedDeltas] as const]
          : []
      }
    )
  )
  reconcilePendingResets(currentUsageData, invalidFeatureIds)
}

function reconcileAndSetSnapshot(parsedUsageData: ParsedUsageData) {
  if (parsedUsageData.status === 'invalid') return
  reconcileStoredUsage(
    parsedUsageData.usageData,
    parsedUsageData.invalidFeatureIds
  )
  usageSnapshot.value = parsedUsageData.usageData
}

function reconcileExternalStorage(event: StorageEvent) {
  let storageArea: Storage
  try {
    storageArea = localStorage
  } catch (error) {
    reportStorageError(error, 'error_accessing_feature_usage_event_storage')
    return
  }
  if (event.storageArea !== storageArea) return
  if (event.key !== null && event.key !== STORAGE_KEY) return

  const oldUsage =
    event.key === null
      ? {
          status: 'valid' as const,
          usageData: usageSnapshot.value,
          invalidFeatureIds: new Set<string>()
        }
      : parseUsageData(event.oldValue)
  try {
    const currentUsage = parseUsageData(localStorage.getItem(STORAGE_KEY))
    if (currentUsage.status !== 'invalid') {
      if (oldUsage.status !== 'invalid') {
        reconcileDeletedPendingUsage(
          oldUsage.usageData,
          currentUsage.usageData,
          currentUsage.invalidFeatureIds
        )
      }
      reconcileAndSetSnapshot(currentUsage)
    }
  } catch (error) {
    reportStorageError(error, 'error_reconciling_feature_usage_event')
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

function repairFutureTimestamp(timestamp: number, now: number) {
  return timestamp > now + MAX_CLOCK_SKEW ? now : timestamp
}

function incrementUsage(
  usage: FeatureUsage | undefined,
  now: number
): FeatureUsage {
  if (!usage) {
    return { useCount: 1, firstUsed: now, lastUsed: now }
  }
  const lastUsed = repairFutureTimestamp(usage.lastUsed, now)
  return {
    useCount: Math.min(usage.useCount + 1, MAX_USAGE_COUNT),
    firstUsed: Math.min(repairFutureTimestamp(usage.firstUsed, now), lastUsed),
    lastUsed: Math.max(lastUsed, now)
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
    (mergedUsageData, [featureId, pendingDeltas]) => {
      if (!pendingDeltas) return mergedUsageData
      return pendingDeltas.reduce((usageWithPendingDeltas, pendingDelta) => {
        const storedUsage = usageFor(usageWithPendingDeltas, featureId)
        return {
          ...usageWithPendingDeltas,
          [featureId]: {
            useCount: Math.min(
              (storedUsage?.useCount ?? 0) + pendingDelta.useCountDelta,
              MAX_USAGE_COUNT
            ),
            firstUsed: Math.min(
              storedUsage?.firstUsed ?? pendingDelta.firstUsed,
              pendingDelta.firstUsed
            ),
            lastUsed: Math.max(
              storedUsage?.lastUsed ?? pendingDelta.lastUsed,
              pendingDelta.lastUsed
            )
          }
        }
      }, mergedUsageData)
    },
    usageData
  )
}

function sameUsage(
  left: FeatureUsage | null | undefined,
  right: FeatureUsage | null | undefined
) {
  if (left === null || right === null) return false
  if (left === right) return true
  if (!left || !right) return false
  return (
    left.useCount === right.useCount &&
    left.firstUsed === right.firstUsed &&
    left.lastUsed === right.lastUsed
  )
}

function incrementPendingDelta(delta: PendingUsageDelta, now: number) {
  return {
    ...delta,
    useCountDelta: Math.min(delta.useCountDelta + 1, MAX_USAGE_COUNT),
    firstUsed: Math.min(delta.firstUsed, now),
    lastUsed: Math.max(delta.lastUsed, now),
    recordedAt: now
  }
}

function boundPendingDeltas(pendingDeltas: PendingUsageDelta[]) {
  if (pendingDeltas.length <= MAX_PENDING_USAGE_DELTAS) return pendingDeltas
  const [oldest, secondOldest, ...remainingDeltas] = pendingDeltas
  return [
    {
      useCountDelta: Math.min(
        oldest.useCountDelta + secondOldest.useCountDelta,
        MAX_USAGE_COUNT
      ),
      firstUsed: Math.min(oldest.firstUsed, secondOldest.firstUsed),
      lastUsed: Math.max(oldest.lastUsed, secondOldest.lastUsed),
      recordedAt: Math.max(oldest.recordedAt, secondOldest.recordedAt)
    },
    ...remainingDeltas
  ]
}

function recordPendingUsage(
  featureId: string,
  now: number,
  baseUsage: FeatureUsage | null | undefined
) {
  const pendingDeltas = pendingUsageFor(featureId) ?? []
  const previousDelta = pendingDeltas.at(-1)
  const baseMatches =
    previousDelta !== undefined && sameUsage(previousDelta.baseUsage, baseUsage)
  const nextDelta: PendingUsageDelta = baseMatches
    ? incrementPendingDelta(previousDelta, now)
    : {
        useCountDelta: 1,
        firstUsed: Math.min(baseUsage?.firstUsed ?? now, now),
        lastUsed: now,
        recordedAt: now,
        baseUsage
      }
  const nextDeltas = baseMatches
    ? [...pendingDeltas.slice(0, -1), nextDelta]
    : [...pendingDeltas, nextDelta]
  pendingUsageData.value = {
    ...pendingUsageData.value,
    [featureId]: boundPendingDeltas(nextDeltas)
  }
}

function applyPendingResets(usageData: FeatureUsageRecord): FeatureUsageRecord {
  return [...pendingResets].reduce(withoutFeature, usageData)
}

function writeStorageAndReadBack(value: string) {
  localStorage.setItem(STORAGE_KEY, value)
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    reportStorageError(error, 'error_reading_feature_usage_verification')
  }
}

function writeAndVerifyUsage(
  value: string,
  expectedUsageData: FeatureUsageRecord
) {
  const readBack = writeStorageAndReadBack(value)
  if (readBack === undefined) return true
  const parsedReadBack = parseUsageData(readBack)
  if (parsedReadBack.status === 'invalid') return false
  return (
    Object.entries(expectedUsageData).every(([featureId, expectedUsage]) => {
      const storedUsage = usageFor(parsedReadBack.usageData, featureId)
      return (
        expectedUsage !== undefined &&
        storedUsage !== undefined &&
        isWrittenGeneration(storedUsage, expectedUsage)
      )
    }) &&
    [...pendingResets].every(
      (featureId) => usageFor(parsedReadBack.usageData, featureId) === undefined
    )
  )
}

function writeAndVerifyReset(value: string, featureId: string) {
  const readBack = writeStorageAndReadBack(value)
  if (readBack === undefined) return true
  const parsedReadBack = parseUsageData(readBack)
  return (
    parsedReadBack.status !== 'invalid' &&
    usageFor(parsedReadBack.usageData, featureId) === undefined
  )
}

function persistUsageData(featureId: string, now: number) {
  let oldValue: string | null = null
  let usageData = applyPendingUsage(applyPendingResets(usageSnapshot.value))
  let newValue = ''
  let storageWritten = false
  let baseUsage: FeatureUsage | null | undefined

  try {
    oldValue = localStorage.getItem(STORAGE_KEY)
    const parsedUsageData = parseUsageData(oldValue)
    const currentUsageData =
      parsedUsageData.status === 'invalid' ? {} : parsedUsageData.usageData
    reconcileAndSetSnapshot(parsedUsageData)
    const resetAdjustedUsageData = applyPendingResets(currentUsageData)
    baseUsage = usageFor(resetAdjustedUsageData, featureId) ?? null
    const mergedUsageData = applyPendingUsage(resetAdjustedUsageData)
    const nextUsage = incrementUsage(usageFor(mergedUsageData, featureId), now)
    usageData = {
      ...mergedUsageData,
      [featureId]: nextUsage
    }
    newValue = JSON.stringify(usageData)

    storageWritten = writeAndVerifyUsage(newValue, usageData)
    if (storageWritten) {
      pendingResets.clear()
      pendingResetUsage.clear()
      pendingUsageData.value = {}
      usageSnapshot.value = usageData
    } else {
      reportStorageError(
        new DOMException(
          'Feature usage storage changed before verification',
          'InvalidStateError'
        ),
        'error_verifying_feature_usage'
      )
      recordPendingUsage(featureId, now, baseUsage)
    }
  } catch (error) {
    reportStorageError(error, 'error_persisting_feature_usage')
    recordPendingUsage(featureId, now, baseUsage)
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
    const currentUsageData =
      parsedUsageData.status === 'invalid' ? {} : parsedUsageData.usageData
    const pendingReset = pendingResetUsage.get(featureId)
    if (pendingReset && parsedUsageData.status !== 'invalid') {
      if (!parsedUsageData.invalidFeatureIds.has(featureId)) {
        pendingResetUsage.set(featureId, {
          ...pendingReset,
          baseline: usageFor(currentUsageData, featureId) ?? null
        })
      }
    }
    reconcileAndSetSnapshot(parsedUsageData)
    usageData = applyPendingUsage(applyPendingResets(currentUsageData))
    newValue = JSON.stringify(usageData)
    storageWritten = writeAndVerifyReset(newValue, featureId)
    if (storageWritten) {
      pendingResets.clear()
      pendingResetUsage.clear()
      pendingUsageData.value = {}
      usageSnapshot.value = usageData
    } else {
      reportStorageError(
        new DOMException(
          'Feature usage storage changed before verification',
          'InvalidStateError'
        ),
        'error_verifying_feature_usage_reset'
      )
    }
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
  try {
    const currentUsage = parseUsageData(localStorage.getItem(STORAGE_KEY))
    reconcileAndSetSnapshot(currentUsage)
  } catch (error) {
    reportStorageError(error, 'error_reading_feature_usage')
  }

  const usage = computed(() =>
    usageFor(
      applyPendingUsage(applyPendingResets(usageSnapshot.value)),
      featureId
    )
  )
  const useCount = computed(() => usage.value?.useCount ?? 0)

  function trackUsage() {
    const now = Date.now()
    persistUsageData(featureId, now)
  }

  function reset() {
    pendingResets.add(featureId)
    if (!pendingResetUsage.has(featureId)) {
      pendingResetUsage.set(featureId, { requestedAt: Date.now() })
    }
    pendingUsageData.value = withoutFeature(pendingUsageData.value, featureId)
    resetUsageData(featureId)
  }

  return {
    usage,
    useCount,
    trackUsage,
    reset
  }
}
