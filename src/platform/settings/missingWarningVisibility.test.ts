import { describe, expect, it } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'

import { isMissingWarningVisible } from './missingWarningVisibility'

describe('isMissingWarningVisible', () => {
  it('hides only the kind whose setting is switched off', () => {
    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.Workflow.ShowMissingModelsWarning'] =
      false
    settingStore.settingValues['Comfy.Workflow.ShowMissingMediaWarning'] = true

    expect(isMissingWarningVisible('models')).toBe(false)
    expect(isMissingWarningVisible('media')).toBe(true)
    expect(isMissingWarningVisible('nodes')).toBe(true)
  })
})
