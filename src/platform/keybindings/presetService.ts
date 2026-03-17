import { toRaw } from 'vue'
import { fromZodError } from 'zod-validation-error'

import { downloadBlob } from '@/base/common/downloadUtil'
import UnsavedChangesContent from '@/components/dialog/content/setting/keybinding/UnsavedChangesContent.vue'
import UnsavedChangesHeader from '@/components/dialog/content/setting/keybinding/UnsavedChangesHeader.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { uploadFile } from '@/scripts/utils'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

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
  const dialogStore = useDialogStore()
  const toast = useToastStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  async function switchToDefaultPreset({ resetBindings = true } = {}) {
    if (resetBindings) keybindingStore.resetAllKeybindings()
    keybindingStore.currentPresetName = 'default'
    keybindingStore.savedPresetData = null
    await keybindingService.persistUserKeybindings()
    await settingStore.set('Comfy.Keybinding.CurrentPreset', 'default')
  }

  const UNSAVED_DIALOG_KEY = 'unsaved-keybinding-changes'

  function showUnsavedChangesDialog(
    presetName: string
  ): Promise<boolean | null> {
    return new Promise((resolve) => {
      dialogService.showSmallLayoutDialog({
        key: UNSAVED_DIALOG_KEY,
        headerComponent: UnsavedChangesHeader,
        headerProps: { presetName },
        component: UnsavedChangesContent,
        props: {
          onResult: (result: boolean | null) => {
            resolve(result)
            dialogStore.closeDialog({ key: UNSAVED_DIALOG_KEY })
          }
        },
        dialogComponentProps: {
          onClose: () => resolve(null)
        }
      })
    })
  }

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
    // Snapshot savedPresetData from the store's actual state after applying,
    // because addUserKeybinding may auto-unset conflicting defaults beyond
    // what the raw preset specifies.
    keybindingStore.savedPresetData = buildPresetFromStore(
      preset.name,
      keybindingStore
    )
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
      summary: t('g.keybindingPresets.presetSaved', { name }),
      life: 3000
    })
  }

  async function deletePreset(name: string) {
    const confirmed = await dialogService.confirm({
      title: t('g.keybindingPresets.deletePresetTitle'),
      message: t('g.keybindingPresets.deletePresetWarning'),
      type: 'delete'
    })
    if (!confirmed) return

    const resp = await api.deleteUserData(presetFilePath(name))
    if (!resp.ok) {
      throw new Error(t('g.keybindingPresets.deletePresetFailed', { name }))
    }

    if (keybindingStore.currentPresetName === name) {
      await switchToDefaultPreset()
    }

    toast.add({
      severity: 'info',
      summary: t('g.keybindingPresets.presetDeleted', { name }),
      life: 3000
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

    // Save the imported preset file to storage
    await api.storeUserData(
      presetFilePath(preset.name),
      JSON.stringify(preset),
      { overwrite: true, stringify: false }
    )

    // Switch to the imported preset (handles dirty check)
    await switchPreset(preset.name)

    toast.add({
      severity: 'success',
      summary: t('g.keybindingPresets.presetImported'),
      life: 3000
    })
  }

  async function promptAndSaveNewPreset(): Promise<boolean> {
    const name = await dialogService.prompt({
      title: t('g.keybindingPresets.saveAsNewPreset'),
      message: t('g.keybindingPresets.presetNamePrompt'),
      defaultValue: ''
    })
    if (!name) return false
    const trimmedName = name.trim()
    if (!trimmedName) return false
    const existingPresets = await listPresets()
    if (existingPresets.includes(trimmedName)) {
      const overwrite = await dialogService.confirm({
        title: t('g.keybindingPresets.overwritePresetTitle'),
        message: t('g.keybindingPresets.overwritePresetMessage', {
          name: trimmedName
        }),
        type: 'overwrite'
      })
      if (!overwrite) return false
    }
    await savePreset(trimmedName)
    return true
  }

  async function switchPreset(targetName: string) {
    if (keybindingStore.isCurrentPresetModified) {
      const displayName =
        keybindingStore.currentPresetName === 'default'
          ? t('g.keybindingPresets.default')
          : keybindingStore.currentPresetName
      const result = await showUnsavedChangesDialog(displayName)

      if (result === null) return
      if (result) {
        if (keybindingStore.currentPresetName !== 'default') {
          await savePreset(keybindingStore.currentPresetName)
        } else {
          const saved = await promptAndSaveNewPreset()
          if (!saved) return
        }
      }
    }

    if (targetName === 'default') {
      await switchToDefaultPreset()
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
    switchToDefaultPreset: wrapWithErrorHandlingAsync(switchToDefaultPreset),
    promptAndSaveNewPreset: wrapWithErrorHandlingAsync(promptAndSaveNewPreset),
    applyPreset
  }
}
