import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSurveyConfigs: Record<string, { enabled: boolean }> = {}

vi.mock('./surveyRegistry', () => ({
  getSurveyConfig: (featureId: string) => mockSurveyConfigs[featureId]
}))

describe('useSurveyFeatureTracking', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    Object.keys(mockSurveyConfigs).forEach(
      (key) => delete mockSurveyConfigs[key]
    )
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('tracks usage when config is enabled', async () => {
    mockSurveyConfigs['test-feature'] = { enabled: true }

    const { useSurveyFeatureTracking } =
      await import('./useSurveyFeatureTracking')
    const { trackFeatureUsed, useCount } =
      useSurveyFeatureTracking('test-feature')

    expect(useCount.value).toBe(0)

    trackFeatureUsed()

    expect(useCount.value).toBe(1)
  })

  it('does not track when config is disabled', async () => {
    mockSurveyConfigs['disabled-feature'] = { enabled: false }

    const { useSurveyFeatureTracking } =
      await import('./useSurveyFeatureTracking')
    const { trackFeatureUsed, useCount } =
      useSurveyFeatureTracking('disabled-feature')

    trackFeatureUsed()

    expect(useCount.value).toBe(0)
  })

  it('does not track when config does not exist', async () => {
    const { useSurveyFeatureTracking } =
      await import('./useSurveyFeatureTracking')
    const { trackFeatureUsed, useCount } = useSurveyFeatureTracking(
      'nonexistent-feature'
    )

    trackFeatureUsed()

    expect(useCount.value).toBe(0)
  })
})
