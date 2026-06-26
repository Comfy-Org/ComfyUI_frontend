import { afterEach, describe, expect, it, vi } from 'vitest'

import { ServerFeatureFlag } from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'

import { CORE_SETTINGS } from './coreSettings'

function getDefault(id: string) {
  const setting = CORE_SETTINGS.find((s) => s.id === id)
  if (!setting) throw new Error(`Setting ${id} not found`)
  const { defaultValue } = setting
  return typeof defaultValue === 'function' ? defaultValue() : defaultValue
}

describe('Comfy.Notification.ShowVersionUpdates default', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('follows the show_version_updates server feature flag', () => {
    const getServerFeature = vi
      .spyOn(api, 'getServerFeature')
      .mockReturnValue(false)

    expect(getDefault('Comfy.Notification.ShowVersionUpdates')).toBe(false)
    expect(getServerFeature).toHaveBeenCalledWith(
      ServerFeatureFlag.SHOW_VERSION_UPDATES,
      true
    )
  })
})
