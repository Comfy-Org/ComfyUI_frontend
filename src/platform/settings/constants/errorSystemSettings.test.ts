import { describe, expect, it } from 'vitest'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'

const errorSystemSettings = CORE_SETTINGS.filter(
  (setting) => setting.category?.[1] === 'Error System'
)

describe('Error System settings', () => {
  it('registers each setting under its own category leaf', () => {
    const leaves = errorSystemSettings.map((setting) => setting.category?.[2])

    expect(leaves.every(Boolean)).toBe(true)
    expect(new Set(leaves).size).toBe(leaves.length)
  })

  it('sorts the Issues tab switch ahead of the missing warnings', () => {
    const ordered = [...errorSystemSettings]
      .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0))
      .map((setting) => setting.id)

    expect(ordered).toEqual([
      'Comfy.RightSidePanel.ShowErrorsTab',
      'Comfy.Workflow.ShowMissingNodesWarning',
      'Comfy.Workflow.ShowMissingModelsWarning',
      'Comfy.Workflow.ShowMissingMediaWarning'
    ])
  })

  it('exposes every missing warning as an enabled boolean switch', () => {
    const warnings = errorSystemSettings.filter((setting) =>
      setting.id.startsWith('Comfy.Workflow.ShowMissing')
    )

    expect(warnings).toHaveLength(3)
    for (const setting of warnings) {
      expect(setting.type).toBe('boolean')
      expect(setting.defaultValue).toBe(true)
    }
  })
})
