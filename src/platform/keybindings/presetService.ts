import { toRaw } from 'vue'
import { fromZodError } from 'zod-validation-error'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { uploadFile } from '@/scripts/utils'
import { useDialogService } from '@/services/dialogService'

import { KeybindingImpl } from './keybinding'
import { useKeybindingService } from './keybindingService'
import { useKeybindingStore } from './keybindingStore'
import type { KeybindingPreset } from './types'
import { zKeybindingPreset } from './types'

const PRESETS_DIR = 'keybindings'

function presetFilePath(name: string): string {
  const trimmed = name.trim()
  if (
    !trimmed ||
    trimmed === 'default' ||
    trimmed.toLowerCase().endsWith('.json') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('..') ||
    trimmed.startsWith('.')
  ) {
    throw new Error(t('g.keybindingPresets.invalidPresetName'))
  }
  return `${PRESETS_DIR}/${trimmed}.json`
}

function buildPresetFromStore(
  name: string,
  keybindingStore: ReturnType<typeof useKeybindingStore>
): KeybindingPreset {
  const newBindings = Object.values(toRaw(keybindingStore.getUserKeybindings()))
  const unsetBindings = Object.values(
    toRaw(keybindingStore.getUserUnsetKeybindings())
  )
  return { name, newBindings, unsetBindings }
}

export function useKeybindingPresetService() {
  const keybindingStore = useKeybindingStore()
  const keybindingService = useKeybindingService()
  const settingStore = useSettingStore()
  const dialogService = useDialogService()
  const toast = useToastStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  async function listPresets(): Promise<string[]> {
    const files = await api.listUserDataFullInfo(PRESETS_DIR)
    return files
      .map((f) => f.path.replace(/\.json$/, ''))
      .filter((name) => name.length > 0)
  }

  async function loadPreset(name: string): Promise<KeybindingPreset> {
    const resp = await api.getUserData(presetFilePath(name))
    if (!resp.ok) {
      throw new Error(t('g.keybindingPresets.loadPresetFailed', { name }))
    }
    const data = await resp.json()
    const result = zKeybindingPreset.safeParse(data)
    if (!result.success) {
      throw new Error(
        t('g.keybindingPresets.invalidPresetFile') +
          ': ' +
          fromZodError(result.error).message
      )
    }
    return { ...result.data, name }
  }

  function applyPreset(preset: KeybindingPreset) {
    keybindingStore.resetAllKeybindings()
    for (const binding of preset.unsetBindings) {
      keybindingStore.unsetKeybinding(new KeybindingImpl(binding))
    }
    for (const binding of preset.newBindings) {
      keybindingStore.addUserKeybinding(new KeybindingImpl(binding))
    }
    keybindingStore.savedPresetData = preset
    keybindingStore.currentPresetName = preset.name
  }

  async function savePreset(name: string) {
    const preset = buildPresetFromStore(name, keybindingStore)
    await api.storeUserData(presetFilePath(name), JSON.stringify(preset), {
      overwrite: true,
      stringify: false
    })
    keybindingStore.savedPresetData = preset
    keybindingStore.currentPresetName = name
    await keybindingService.persistUserKeybindings()
    await settingStore.set('Comfy.Keybinding.CurrentPreset', name)
    toast.add({
      severity: 'success',
      summary: t('g.keybindingPresets.presetSaved', { name })
    })
  }

  async function deletePreset(name: string) {
    const confirmed = await dialogService.confirm({
      title: t('g.keybindingPresets.deletePresetTitle'),
      message: t('g.keybindingPresets.deletePresetMessage', { name }),
      type: 'delete'
    })
    if (!confirmed) return

    const resp = await api.deleteUserData(presetFilePath(name))
    if (!resp.ok) {
      throw new Error(t('g.keybindingPresets.deletePresetFailed', { name }))
    }

    if (keybindingStore.currentPresetName === name) {
      keybindingStore.resetAllKeybindings()
      keybindingStore.currentPresetName = 'default'
      keybindingStore.savedPresetData = null
      await keybindingService.persistUserKeybindings()
      await settingStore.set('Comfy.Keybinding.CurrentPreset', 'default')
    }

    toast.add({
      severity: 'info',
      summary: t('g.keybindingPresets.presetDeleted', { name })
    })
  }

  function exportPreset() {
    const preset = buildPresetFromStore(
      keybindingStore.currentPresetName,
      keybindingStore
    )
    downloadBlob(
      `${preset.name}.json`,
      new Blob([JSON.stringify(preset, null, 2)], {
        type: 'application/json'
      })
    )
  }

  async function importPreset() {
    const file = await uploadFile('application/json')
    const text = await file.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(t('g.keybindingPresets.invalidPresetFile'))
    }
    const result = zKeybindingPreset.safeParse(data)
    if (!result.success) {
      throw new Error(
        t('g.keybindingPresets.invalidPresetFile') +
          ': ' +
          fromZodError(result.error).message
      )
    }
    const preset = result.data
    applyPreset(preset)
    keybindingStore.currentPresetName = 'default'
    keybindingStore.savedPresetData = null
    await keybindingService.persistUserKeybindings()
    await settingStore.set('Comfy.Keybinding.CurrentPreset', 'default')
    toast.add({
      severity: 'success',
      summary: t('g.keybindingPresets.presetImported')
    })
  }

  async function switchPreset(targetName: string) {
    if (keybindingStore.isCurrentPresetModified) {
      const result = await dialogService.confirm({
        title: t('g.keybindingPresets.unsavedChangesTitle'),
        message: t('g.keybindingPresets.unsavedChangesMessage'),
        type: 'dirtyClose'
      })

      if (result === null) return
      if (result) {
        if (keybindingStore.currentPresetName !== 'default') {
          await savePreset(keybindingStore.currentPresetName)
        } else {
          const name = await dialogService.prompt({
            title: t('g.keybindingPresets.saveAsNewPreset'),
            message: t('g.keybindingPresets.presetNamePrompt'),
            defaultValue: ''
          })
          if (!name) return
          const trimmedName = name.trim()
          if (!trimmedName) return
          const existingPresets = await listPresets()
          if (existingPresets.includes(trimmedName)) {
            const overwrite = await dialogService.confirm({
              title: t('g.keybindingPresets.overwritePresetTitle'),
              message: t('g.keybindingPresets.overwritePresetMessage', {
                name: trimmedName
              }),
              type: 'overwrite'
            })
            if (!overwrite) return
          }
          await savePreset(trimmedName)
        }
      }
    }

    if (targetName === 'default') {
      keybindingStore.resetAllKeybindings()
      keybindingStore.currentPresetName = 'default'
      keybindingStore.savedPresetData = null
      await keybindingService.persistUserKeybindings()
      await settingStore.set('Comfy.Keybinding.CurrentPreset', 'default')
      return
    }

    const preset = await loadPreset(targetName)
    applyPreset(preset)
    await keybindingService.persistUserKeybindings()
    await settingStore.set('Comfy.Keybinding.CurrentPreset', targetName)
  }

  return {
    listPresets: wrapWithErrorHandlingAsync(listPresets),
    loadPreset: wrapWithErrorHandlingAsync(loadPreset),
    savePreset: wrapWithErrorHandlingAsync(savePreset),
    deletePreset: wrapWithErrorHandlingAsync(deletePreset),
    exportPreset,
    importPreset: wrapWithErrorHandlingAsync(importPreset),
    switchPreset: wrapWithErrorHandlingAsync(switchPreset),
    applyPreset
  }
}
