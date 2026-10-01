import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthog = vi.hoisted(() => ({
  get_distinct_id: vi.fn(),
  getFeatureFlag: vi.fn(),
  onFeatureFlags: vi.fn()
}))

vi.mock<unknown>(import('posthog-js'), () => ({ default: posthog }))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

describe('readExperimentVariant', () => {
  beforeEach(() => {
    vi.resetModules()
    posthog.get_distinct_id.mockReturnValue('person-a')
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

    const first = readExperimentVariant('waits-for-flags')
    const second = readExperimentVariant('waits-for-flags')
    await vi.waitFor(() =>
      expect(posthog.onFeatureFlags).toHaveBeenCalledOnce()
    )
    expect(posthog.getFeatureFlag).not.toHaveBeenCalled()

    flagsReady()

    await expect(Promise.all([first, second])).resolves.toEqual([
      'treatment',
      'treatment'
    ])
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

  it('reads a fresh assignment after identity changes', async () => {
    posthog.onFeatureFlags.mockImplementation((callback) => {
      callback()
      return vi.fn()
    })
    const { readExperimentVariant } = await import('./postHogExperimentClient')

    await expect(readExperimentVariant('placement')).resolves.toBe('treatment')
    posthog.get_distinct_id.mockReturnValue('person-b')
    posthog.getFeatureFlag.mockReturnValue('control')

    await expect(readExperimentVariant('placement')).resolves.toBe('control')
    expect(posthog.getFeatureFlag).toHaveBeenCalledTimes(2)
  })
})
