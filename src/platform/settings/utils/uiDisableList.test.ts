import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDisabledCommands,
  isCommandDisabled
} from '@/platform/settings/utils/uiDisableList'

const mockGetSetting = vi.fn()

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

describe('uiDisableList', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockGetSetting.mockReset()
  })

  describe('getDisabledCommands', () => {
    it('returns an empty array when the setting is unset', () => {
      mockGetSetting.mockReturnValue(undefined)
      expect(getDisabledCommands()).toEqual([])
    })

    it('returns the configured disabled command IDs', () => {
      mockGetSetting.mockReturnValue(['Comfy.SaveWorkflow'])
      expect(getDisabledCommands()).toEqual(['Comfy.SaveWorkflow'])
    })
  })

  describe('isCommandDisabled', () => {
    it('returns true when the command ID is disabled', () => {
      mockGetSetting.mockReturnValue(['Comfy.SaveWorkflow'])
      expect(isCommandDisabled('Comfy.SaveWorkflow')).toBe(true)
    })

    it('returns false when the command ID is not disabled', () => {
      mockGetSetting.mockReturnValue(['Comfy.SaveWorkflow'])
      expect(isCommandDisabled('Comfy.OpenWorkflow')).toBe(false)
    })
  })
})
