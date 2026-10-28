import { assert, describe, expect, it, vi } from 'vitest'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

import { isMissingWarningVisible } from './missingWarningVisibility'

describe('isMissingWarningVisible', () => {
  it('keeps the legacy popup opt-out separate and persists the new warning choice', async () => {
    const setting = CORE_SETTINGS.find(
      (entry) => entry.id === 'Comfy.ErrorSystem.ShowMissingModels'
    )
    assert.exists(setting)
    const fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValueOnce(
        Response.json({ 'Comfy.Workflow.ShowMissingModelsWarning': false })
      )
      .mockResolvedValueOnce(new Response())
    const store = useSettingStore()
    await store.load()
    store.addSetting(setting)

    expect(isMissingWarningVisible('models')).toBe(true)

    await store.set('Comfy.ErrorSystem.ShowMissingModels', false)

    expect(isMissingWarningVisible('models')).toBe(false)
    expect(fetchApi).toHaveBeenCalledWith(
      '/settings/Comfy.ErrorSystem.ShowMissingModels',
      { method: 'POST', body: 'false' }
    )
    expect(store.settingValues['Comfy.Workflow.ShowMissingModelsWarning']).toBe(
      false
    )
  })

  it('loads a saved warning opt-out independently of the legacy preference', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValueOnce(
      Response.json({
        'Comfy.Workflow.ShowMissingModelsWarning': true,
        'Comfy.ErrorSystem.ShowMissingModels': false
      })
    )
    const setting = CORE_SETTINGS.find(
      (entry) => entry.id === 'Comfy.ErrorSystem.ShowMissingModels'
    )
    assert.exists(setting)
    const store = useSettingStore()
    await store.load()
    store.addSetting(setting)

    expect(isMissingWarningVisible('models')).toBe(false)
    expect(store.settingValues['Comfy.Workflow.ShowMissingModelsWarning']).toBe(
      true
    )
  })

  it.for([
    { kind: 'nodes', id: 'Comfy.Workflow.ShowMissingNodesWarning' },
    { kind: 'models', id: 'Comfy.ErrorSystem.ShowMissingModels' },
    { kind: 'media', id: 'Comfy.Workflow.ShowMissingMediaWarning' }
  ] as const)('hides only $kind when its setting is off', ({ kind, id }) => {
    const settingStore = useSettingStore()
    settingStore.settingValues[id] = false

    expect({
      nodes: isMissingWarningVisible('nodes'),
      models: isMissingWarningVisible('models'),
      media: isMissingWarningVisible('media')
    }).toEqual({ nodes: true, models: true, media: true, [kind]: false })
  })
})
