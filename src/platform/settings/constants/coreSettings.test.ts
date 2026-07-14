import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { CORE_SETTINGS } from './coreSettings'

const mockDist = vi.hoisted(() => ({ isCloud: false }))

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: false,
  isNightly: false,
  get isCloud() {
    return mockDist.isCloud
  }
}))

function getDefault(id: string) {
  const setting = CORE_SETTINGS.find((s) => s.id === id)
  if (!setting) throw new Error(`Setting ${id} not found`)
  const { defaultValue } = setting
  return typeof defaultValue === 'function' ? defaultValue() : defaultValue
}

describe('Comfy.Notification.ShowVersionUpdates default', () => {
  beforeEach(() => {
    mockDist.isCloud = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves to the show_version_updates server flag value', () => {
    vi.spyOn(api, 'getServerFeature').mockReturnValue(true)
    expect(getDefault('Comfy.Notification.ShowVersionUpdates')).toBe(true)

    vi.spyOn(api, 'getServerFeature').mockReturnValue(false)
    expect(getDefault('Comfy.Notification.ShowVersionUpdates')).toBe(false)
  })

  it('falls back to off on local installs when the server flag is unset', () => {
    vi.spyOn(api, 'getServerFeature').mockImplementation(
      (_name, fallback) => fallback
    )
    expect(getDefault('Comfy.Notification.ShowVersionUpdates')).toBe(false)
  })

  it('falls back to on for Cloud when the server flag is unset', () => {
    mockDist.isCloud = true
    vi.spyOn(api, 'getServerFeature').mockImplementation(
      (_name, fallback) => fallback
    )
    expect(getDefault('Comfy.Notification.ShowVersionUpdates')).toBe(true)
  })
})
