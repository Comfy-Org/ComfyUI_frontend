import { useStorage } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { isCloud, isDesktop, isNightly } from '@/platform/distribution/types'

import { useFeatureUsageTracker } from './useFeatureUsageTracker'

/** @public */
export interface FeatureSurveyConfig {
  featureId: string
  typeformId: string
  triggerThreshold?: number
  delayMs?: number
  sampleRate?: number
  enabled?: boolean
}

interface SurveyState {
  seenSurveys: Record<string, number>
  lastSurveyShown: number | null
  optedOut: boolean
}

const STORAGE_KEY = 'Comfy.SurveyState'
const GLOBAL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
const DEFAULT_THRESHOLD = 3
const DEFAULT_DELAY_MS = 5000
const DEFAULT_SAMPLE_RATE = 1

function getStorageState() {
  return useStorage<SurveyState>(STORAGE_KEY, {
    seenSurveys: {},
    lastSurveyShown: null,
    optedOut: false
  })
}

export function useSurveyEligibility(
  config: MaybeRefOrGetter<FeatureSurveyConfig>
) {
  const state = getStorageState()
  const resolvedConfig = computed(() => toValue(config))

  const { useCount } = useFeatureUsageTracker(resolvedConfig.value.featureId)

  const threshold = computed(
    () => resolvedConfig.value.triggerThreshold ?? DEFAULT_THRESHOLD
  )
  const delayMs = computed(
    () => resolvedConfig.value.delayMs ?? DEFAULT_DELAY_MS
  )
  const sampleRate = computed(
    () => resolvedConfig.value.sampleRate ?? DEFAULT_SAMPLE_RATE
  )
  const enabled = computed(() => resolvedConfig.value.enabled ?? true)

  const isNightlyLocalhost = computed(() => isNightly && !isCloud && !isDesktop)

  const hasReachedThreshold = computed(() => useCount.value >= threshold.value)

  const hasSeenSurvey = computed(
    () => !!state.value.seenSurveys[resolvedConfig.value.featureId]
  )

  const isInGlobalCooldown = computed(() => {
    if (!state.value.lastSurveyShown) return false
    return Date.now() - state.value.lastSurveyShown < GLOBAL_COOLDOWN_MS
  })

  const hasOptedOut = computed(() => state.value.optedOut)

  const isEligible = computed(() => {
    if (!enabled.value) return false
    if (!isNightlyLocalhost.value) return false
    if (!hasReachedThreshold.value) return false
    if (hasSeenSurvey.value) return false
    if (isInGlobalCooldown.value) return false
    if (hasOptedOut.value) return false

    if (sampleRate.value < 1) {
      const userId = getUserSamplingId()
      if (!isUserInSample(userId, sampleRate.value)) return false
    }

    return true
  })

  function markSurveyShown() {
    const now = Date.now()
    state.value.seenSurveys[resolvedConfig.value.featureId] = now
    state.value.lastSurveyShown = now
  }

  function optOut() {
    state.value.optedOut = true
  }

  function resetState() {
    state.value = {
      seenSurveys: {},
      lastSurveyShown: null,
      optedOut: false
    }
  }

  return {
    isEligible,
    hasReachedThreshold,
    hasSeenSurvey,
    isInGlobalCooldown,
    hasOptedOut,
    delayMs,
    markSurveyShown,
    optOut,
    resetState
  }
}

const USER_SAMPLING_ID_KEY = 'Comfy.SurveyUserId'

function getUserSamplingId(): string {
  let id = localStorage.getItem(USER_SAMPLING_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(USER_SAMPLING_ID_KEY, id)
  }
  return id
}

function isUserInSample(userId: string, sampleRate: number): boolean {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const normalized = Math.abs(hash) / 0x7fffffff
  return normalized < sampleRate
}
