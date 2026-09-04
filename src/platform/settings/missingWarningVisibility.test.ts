import { describe, expect, it, vi } from 'vitest'

const mockSettings = vi.hoisted(() => ({
  values: {} as Record<string, boolean>
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => mockSettings.values[key]
  })
}))

import { isMissingWarningVisible } from './missingWarningVisibility'

describe('isMissingWarningVisible', () => {
  it('hides only the kind whose setting is switched off', () => {
    mockSettings.values = {
      'Comfy.RightSidePanel.ShowErrorsTab': true,
      'Comfy.Workflow.ShowMissingMediaWarning': true,
      'Comfy.Workflow.ShowMissingModelsWarning': false
    }

    expect(isMissingWarningVisible('media')).toBe(true)
    expect(isMissingWarningVisible('models')).toBe(false)
    expect(isMissingWarningVisible('nodes')).toBe(true)
  })

  it('hides every kind while the issues tab is off', () => {
    mockSettings.values = {
      'Comfy.RightSidePanel.ShowErrorsTab': false,
      'Comfy.Workflow.ShowMissingNodesWarning': true
    }

    expect(isMissingWarningVisible('nodes')).toBe(false)
  })
})
