import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as DistributionTypes from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import { isHostTelemetryEnabled, isTelemetryEnabled } from './telemetryEnabled'

const mockDistribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock('@/platform/distribution/types', async () => ({
  ...(await vi.importActual<typeof DistributionTypes>(
    '@/platform/distribution/types'
  )),
  get isCloud() {
    return mockDistribution.isCloud
  }
}))

describe('telemetryEnabled', () => {
  beforeEach(() => {
    mockDistribution.isCloud = false
    remoteConfig.value = {}
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('is enabled on cloud builds regardless of the host flag', () => {
    mockDistribution.isCloud = true
    expect(isTelemetryEnabled()).toBe(true)
  })

  it('is enabled off-cloud when the host enable_telemetry flag is on', () => {
    remoteConfig.value = { enable_telemetry: true }
    expect(isHostTelemetryEnabled()).toBe(true)
    expect(isTelemetryEnabled()).toBe(true)
  })

  it('is disabled off-cloud when the host flag is off or absent', () => {
    expect(isHostTelemetryEnabled()).toBe(false)
    expect(isTelemetryEnabled()).toBe(false)

    remoteConfig.value = { enable_telemetry: false }
    expect(isTelemetryEnabled()).toBe(false)
  })

  it('honors the dev override above the server flag', () => {
    remoteConfig.value = { enable_telemetry: false }
    localStorage.setItem('ff:enable_telemetry', 'true')
    expect(isTelemetryEnabled()).toBe(true)
  })
})
