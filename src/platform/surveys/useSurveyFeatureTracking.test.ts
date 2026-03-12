import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSurveyConfig = vi.hoisted(() =>
  vi.fn<(featureId: string) => { enabled: boolean } | undefined>()
)

vi.mock('./surveyRegistry', () => ({
  getSurveyConfig
}))

describe('useSurveyFeatureTracking', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    getSurveyConfig.mockReset()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('tracks usage when config is enabled', async () => {
    getSurveyConfig.mockReturnValue({ enabled: true })

    const { useSurveyFeatureTracking } =
      await import('./useSurveyFeatureTracking')
    const { trackFeatureUsed, useCount } =
      useSurveyFeatureTracking('test-feature')

    expect(useCount.value).toBe(0)

    trackFeatureUsed()

    expect(useCount.value).toBe(1)
  })

  it('does not track when config is disabled', async () => {
    getSurveyConfig.mockReturnValue({ enabled: false })

    const { useSurveyFeatureTracking } =
      await import('./useSurveyFeatureTracking')
    const { trackFeatureUsed, useCount } =
      useSurveyFeatureTracking('disabled-feature')

    trackFeatureUsed()

    expect(useCount.value).toBe(0)
  })

  it('tracks usage when config exists without enabled field', async () => {
    getSurveyConfig.mockReturnValue({} as { enabled: boolean })

    const { useSurveyFeatureTracking } =
      await import('./useSurveyFeatureTracking')
    const { trackFeatureUsed, useCount } = useSurveyFeatureTracking(
      'implicit-enabled-feature'
    )

    trackFeatureUsed()

    expect(useCount.value).toBe(1)
  })

  it('does not track when config does not exist', async () => {
    getSurveyConfig.mockReturnValue(undefined)

    const { useSurveyFeatureTracking } =
      await import('./useSurveyFeatureTracking')
    const { trackFeatureUsed, useCount } = useSurveyFeatureTracking(
      'nonexistent-feature'
    )

    trackFeatureUsed()

    expect(useCount.value).toBe(0)
  })
})
