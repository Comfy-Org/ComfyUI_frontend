import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

describe('useTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when not in cloud distribution', async () => {
    const { useTelemetry } = await import('@/platform/telemetry')
    const provider = useTelemetry()

    // Should return null for OSS builds
    expect(provider).toBeNull()
  }, 10000)

  it('should return null consistently for OSS builds', async () => {
    const { useTelemetry } = await import('@/platform/telemetry')

    const provider1 = useTelemetry()
    const provider2 = useTelemetry()

    // Both should be null for OSS builds
    expect(provider1).toBeNull()
    expect(provider2).toBeNull()
  })
})
