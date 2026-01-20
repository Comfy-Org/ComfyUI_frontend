import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SURVEY_STATE_KEY = 'Comfy.SurveyState'
const FEATURE_USAGE_KEY = 'Comfy.FeatureUsage'
const USER_SAMPLING_ID_KEY = 'Comfy.SurveyUserId'

const mockIsNightly = vi.hoisted(() => ({ value: true }))
const mockIsCloud = vi.hoisted(() => ({ value: false }))
const mockIsDesktop = vi.hoisted(() => ({ value: false }))

vi.mock('@/platform/distribution/types', () => ({
  get isNightly() {
    return mockIsNightly.value
  },
  get isCloud() {
    return mockIsCloud.value
  },
  get isDesktop() {
    return mockIsDesktop.value
  }
}))

describe('useSurveyEligibility', () => {
  const defaultConfig = {
    featureId: 'test-feature',
    typeformId: 'abc123'
  }

  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))

    mockIsNightly.value = true
    mockIsCloud.value = false
    mockIsDesktop.value = false
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  function setFeatureUsage(featureId: string, useCount: number) {
    const existing = JSON.parse(localStorage.getItem(FEATURE_USAGE_KEY) ?? '{}')
    existing[featureId] = {
      useCount,
      firstUsed: Date.now() - 1000,
      lastUsed: Date.now()
    }
    localStorage.setItem(FEATURE_USAGE_KEY, JSON.stringify(existing))
  }

  describe('eligibility checks', () => {
    it('is not eligible when not nightly', async () => {
      mockIsNightly.value = false
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility(defaultConfig)

      expect(isEligible.value).toBe(false)
    })

    it('is not eligible on cloud', async () => {
      mockIsCloud.value = true
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility(defaultConfig)

      expect(isEligible.value).toBe(false)
    })

    it('is not eligible on desktop', async () => {
      mockIsDesktop.value = true
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility(defaultConfig)

      expect(isEligible.value).toBe(false)
    })

    it('is not eligible below threshold', async () => {
      setFeatureUsage('test-feature', 2)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible, hasReachedThreshold } =
        useSurveyEligibility(defaultConfig)

      expect(hasReachedThreshold.value).toBe(false)
      expect(isEligible.value).toBe(false)
    })

    it('is eligible when all conditions met', async () => {
      setFeatureUsage('test-feature', 3)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility(defaultConfig)

      expect(isEligible.value).toBe(true)
    })

    it('respects custom threshold', async () => {
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility({
        ...defaultConfig,
        triggerThreshold: 10
      })

      expect(isEligible.value).toBe(false)
    })

    it('is not eligible when survey already seen', async () => {
      setFeatureUsage('test-feature', 5)
      localStorage.setItem(
        SURVEY_STATE_KEY,
        JSON.stringify({
          seenSurveys: { 'test-feature': Date.now() },
          lastSurveyShown: null,
          optedOut: false
        })
      )

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible, hasSeenSurvey } = useSurveyEligibility(defaultConfig)

      expect(hasSeenSurvey.value).toBe(true)
      expect(isEligible.value).toBe(false)
    })

    it('is not eligible during global cooldown', async () => {
      setFeatureUsage('test-feature', 5)
      const thirteenDaysAgo = Date.now() - 13 * 24 * 60 * 60 * 1000
      localStorage.setItem(
        SURVEY_STATE_KEY,
        JSON.stringify({
          seenSurveys: { 'other-feature': thirteenDaysAgo },
          lastSurveyShown: thirteenDaysAgo,
          optedOut: false
        })
      )

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible, isInGlobalCooldown } =
        useSurveyEligibility(defaultConfig)

      expect(isInGlobalCooldown.value).toBe(true)
      expect(isEligible.value).toBe(false)
    })

    it('is eligible after global cooldown expires', async () => {
      setFeatureUsage('test-feature', 5)
      const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000
      localStorage.setItem(
        SURVEY_STATE_KEY,
        JSON.stringify({
          seenSurveys: { 'other-feature': fifteenDaysAgo },
          lastSurveyShown: fifteenDaysAgo,
          optedOut: false
        })
      )

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible, isInGlobalCooldown } =
        useSurveyEligibility(defaultConfig)

      expect(isInGlobalCooldown.value).toBe(false)
      expect(isEligible.value).toBe(true)
    })

    it('is not eligible when opted out', async () => {
      setFeatureUsage('test-feature', 5)
      localStorage.setItem(
        SURVEY_STATE_KEY,
        JSON.stringify({
          seenSurveys: {},
          lastSurveyShown: null,
          optedOut: true
        })
      )

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible, hasOptedOut } = useSurveyEligibility(defaultConfig)

      expect(hasOptedOut.value).toBe(true)
      expect(isEligible.value).toBe(false)
    })

    it('is not eligible when config disabled', async () => {
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility({
        ...defaultConfig,
        enabled: false
      })

      expect(isEligible.value).toBe(false)
    })
  })

  describe('actions', () => {
    it('markSurveyShown marks feature as seen and sets cooldown', async () => {
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible, markSurveyShown, hasSeenSurvey, isInGlobalCooldown } =
        useSurveyEligibility(defaultConfig)

      expect(isEligible.value).toBe(true)

      markSurveyShown()

      expect(hasSeenSurvey.value).toBe(true)
      expect(isInGlobalCooldown.value).toBe(true)
      expect(isEligible.value).toBe(false)
    })

    it('optOut prevents all future surveys', async () => {
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible, optOut, hasOptedOut } =
        useSurveyEligibility(defaultConfig)

      expect(isEligible.value).toBe(true)

      optOut()

      expect(hasOptedOut.value).toBe(true)
      expect(isEligible.value).toBe(false)
    })

    it('resetState clears all survey state', async () => {
      setFeatureUsage('test-feature', 5)
      localStorage.setItem(
        SURVEY_STATE_KEY,
        JSON.stringify({
          seenSurveys: { 'test-feature': Date.now() },
          lastSurveyShown: Date.now(),
          optedOut: true
        })
      )

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { resetState, hasSeenSurvey, isInGlobalCooldown, hasOptedOut } =
        useSurveyEligibility(defaultConfig)

      expect(hasSeenSurvey.value).toBe(true)
      expect(isInGlobalCooldown.value).toBe(true)
      expect(hasOptedOut.value).toBe(true)

      resetState()

      expect(hasSeenSurvey.value).toBe(false)
      expect(isInGlobalCooldown.value).toBe(false)
      expect(hasOptedOut.value).toBe(false)
    })
  })

  describe('sampling', () => {
    it('creates stable user sampling ID', async () => {
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility({
        ...defaultConfig,
        sampleRate: 0.5
      })

      // Access isEligible to trigger sampling check
      void isEligible.value

      const userId = localStorage.getItem(USER_SAMPLING_ID_KEY)
      expect(userId).toBeTruthy()
      expect(userId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('reuses existing user sampling ID', async () => {
      const existingId = '12345678-1234-1234-1234-123456789012'
      localStorage.setItem(USER_SAMPLING_ID_KEY, existingId)
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      useSurveyEligibility({ ...defaultConfig, sampleRate: 0.5 })

      expect(localStorage.getItem(USER_SAMPLING_ID_KEY)).toBe(existingId)
    })

    it('sample rate of 0 excludes all users', async () => {
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility({
        ...defaultConfig,
        sampleRate: 0
      })

      expect(isEligible.value).toBe(false)
    })

    it('sample rate of 1 includes all users', async () => {
      setFeatureUsage('test-feature', 5)

      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { isEligible } = useSurveyEligibility({
        ...defaultConfig,
        sampleRate: 1
      })

      expect(isEligible.value).toBe(true)
    })
  })

  describe('config values', () => {
    it('exposes delayMs from config', async () => {
      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { delayMs } = useSurveyEligibility({
        ...defaultConfig,
        delayMs: 10000
      })

      expect(delayMs.value).toBe(10000)
    })

    it('uses default delayMs when not specified', async () => {
      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { delayMs } = useSurveyEligibility(defaultConfig)

      expect(delayMs.value).toBe(5000)
    })
  })

  describe('persistence', () => {
    it('loads existing state from localStorage', async () => {
      setFeatureUsage('test-feature', 5)
      localStorage.setItem(
        SURVEY_STATE_KEY,
        JSON.stringify({
          seenSurveys: { 'test-feature': 1000 },
          lastSurveyShown: 1000,
          optedOut: false
        })
      )

      vi.resetModules()
      const { useSurveyEligibility } = await import('./useSurveyEligibility')
      const { hasSeenSurvey } = useSurveyEligibility(defaultConfig)

      expect(hasSeenSurvey.value).toBe(true)
    })
  })
})
