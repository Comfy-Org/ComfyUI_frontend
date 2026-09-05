import { describe, expect, it } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'

import { isMissingWarningVisible } from './missingWarningVisibility'

describe('isMissingWarningVisible', () => {
  it.for([
    { kind: 'nodes', id: 'Comfy.Workflow.ShowMissingNodesWarning' },
    { kind: 'models', id: 'Comfy.Workflow.ShowMissingModelsWarning' },
    { kind: 'media', id: 'Comfy.Workflow.ShowMissingMediaWarning' }
  ] as const)('hides only $kind when its setting is off', ({ kind, id }) => {
    const settingStore = useSettingStore()
    settingStore.settingValues[id] = false

    expect(isMissingWarningVisible(kind)).toBe(false)
    for (const other of ['nodes', 'models', 'media'] as const) {
      if (other !== kind) expect(isMissingWarningVisible(other)).toBe(true)
    }
  })
})
