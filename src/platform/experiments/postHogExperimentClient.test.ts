import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthog = vi.hoisted(() => ({
  getFeatureFlag: vi.fn(),
  onFeatureFlags: vi.fn()
}))

vi.mock<unknown>(import('posthog-js'), () => ({ default: posthog }))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

describe('readExperimentVariant', () => {
  beforeEach(() => {
    vi.resetModules()
    posthog.getFeatureFlag.mockReturnValue('treatment')
  })

  it('waits for flags, then reads once and unsubscribes', async () => {
    let flagsReady = (): void => {}
    const unsubscribe = vi.fn()
    posthog.onFeatureFlags.mockImplementation((callback) => {
      flagsReady = callback
      return unsubscribe
    })
    const { readExperimentVariant } = await import('./postHogExperimentClient')

    const assignment = readExperimentVariant('waits-for-flags')
    await vi.waitFor(() =>
      expect(posthog.onFeatureFlags).toHaveBeenCalledOnce()
    )
    expect(posthog.getFeatureFlag).not.toHaveBeenCalled()

    flagsReady()

    await expect(assignment).resolves.toBe('treatment')
    expect(posthog.getFeatureFlag).toHaveBeenCalledOnce()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('unsubscribes when flags are already loaded', async () => {
    const unsubscribe = vi.fn()
    posthog.onFeatureFlags.mockImplementation((callback) => {
      callback()
      return unsubscribe
    })
    const { readExperimentVariant } = await import('./postHogExperimentClient')

    await expect(readExperimentVariant('already-loaded')).resolves.toBe(
      'treatment'
    )
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('reads the current assignment on each mount', async () => {
    posthog.onFeatureFlags.mockImplementation((callback) => {
      callback()
      return vi.fn()
    })
    const { readExperimentVariant } = await import('./postHogExperimentClient')

    await expect(readExperimentVariant('placement')).resolves.toBe('treatment')
    posthog.getFeatureFlag.mockReturnValue('control')

    await expect(readExperimentVariant('placement')).resolves.toBe('control')
  })

  it('retries an assignment after a transient failure', async () => {
    posthog.onFeatureFlags
      .mockImplementationOnce(() => {
        throw new Error('PostHog unavailable')
      })
      .mockImplementationOnce((callback) => {
        callback()
        return vi.fn()
      })
    const { readExperimentVariant } = await import('./postHogExperimentClient')

    await expect(readExperimentVariant('placement')).rejects.toThrow(
      'PostHog unavailable'
    )
    await expect(readExperimentVariant('placement')).resolves.toBe('treatment')
  })
})
