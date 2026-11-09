import { toRaw } from 'vue'
import { fromZodError } from 'zod-validation-error'

import { resolveTheme } from '@comfyorg/theme-core/resolveTheme'
import { themePresetSchema } from '@comfyorg/theme-core/themePresetSchema'
import type { ThemePreset } from '@comfyorg/theme-core/themePresetSchema'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useApp } from '@/scripts/appInstance'
import { uploadFile } from '@/scripts/utils'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { applyTheme } from './applyTheme'
import { useThemeStore } from './themeStore'

let latestThemeSwitch = 0

function persistSplashColors() {
  try {
    const body = getComputedStyle(document.body)
    localStorage.setItem('comfy-splash-bg', body.backgroundColor)
    localStorage.setItem('comfy-splash-fg', body.color)
  } catch {
    return
  }
}

export const useThemeService = () => {
  const themeStore = useThemeStore()
  const settingStore = useSettingStore()
  const nodeDefStore = useNodeDefStore()
  const {
    toastErrorHandler,
    wrapWithErrorHandling,
    wrapWithErrorHandlingAsync
  } = useErrorHandling()

  async function persistCustomThemePresets() {
    await settingStore.set(
      'Comfy.CustomColorPalettes',
      themeStore.customPresets
    )
  }

  async function deleteCustomThemePreset(id: string) {
    if (!themeStore.deleteCustomPreset(id)) {
      toastErrorHandler(new Error(`Palette with id ${id} does not exist`))
      return
    }
    await persistCustomThemePresets()
  }

  function validateThemePreset(data: unknown): data is ThemePreset {
    const result = themePresetSchema.safeParse(data)
    if (!result.success) {
      toastErrorHandler(fromZodError(result.error))
      return false
    }
    return true
  }

  async function addCustomThemePreset(data: unknown) {
    if (!validateThemePreset(data)) return
    if (!themeStore.addCustomPreset(data)) {
      toastErrorHandler(new Error(`Palette with id ${data.id} already exists`))
      return
    }
    await persistCustomThemePresets()
    return data
  }

  async function setActiveTheme(id: string) {
    const preset = themeStore.presetsLookup[id]
    if (!preset) {
      toastErrorHandler(new Error(`Color palette ${id} not found`))
      return
    }
    const theme = resolveTheme(preset)
    const root = document.documentElement
    const themeSwitch = ++latestThemeSwitch
    root.dataset.paletteSwitching = ''
    try {
      applyTheme(theme, {
        style: root.style,
        canvas: useApp().canvas,
        dataTypes: nodeDefStore.nodeDataTypes,
        backgroundImage: settingStore.get('Comfy.Canvas.BackgroundImage')
      })
      themeStore.activePresetId = id
    } finally {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (themeSwitch !== latestThemeSwitch) return
          delete root.dataset.paletteSwitching
          persistSplashColors()
        })
      )
    }
  }

  function exportThemePreset(id: string) {
    const preset = themeStore.presetsLookup[id]
    if (!preset) {
      toastErrorHandler(new Error(`Color palette ${id} not found`))
      return
    }
    downloadBlob(
      preset.id + '.json',
      new Blob([JSON.stringify(toRaw(preset), null, 2)], {
        type: 'application/json'
      })
    )
  }

  async function importThemePreset(): Promise<ThemePreset | undefined> {
    const file = await uploadFile('application/json')
    const text = await file.text()
    const data: unknown = JSON.parse(text)
    return addCustomThemePreset(data)
  }

  return {
    getActiveTheme: () => themeStore.activeTheme,
    addCustomThemePreset: wrapWithErrorHandlingAsync(addCustomThemePreset),
    deleteCustomThemePreset: wrapWithErrorHandlingAsync(
      deleteCustomThemePreset
    ),
    setActiveTheme: wrapWithErrorHandlingAsync(setActiveTheme),
    exportThemePreset: wrapWithErrorHandling(exportThemePreset),
    importThemePreset: wrapWithErrorHandlingAsync(importThemePreset)
  }
}

export function useLegacyColorPaletteService() {
  const service = useThemeService()
  return {
    getActiveColorPalette: () => service.getActiveTheme().preset,
    addCustomColorPalette: service.addCustomThemePreset,
    deleteCustomColorPalette: service.deleteCustomThemePreset,
    loadColorPalette: service.setActiveTheme,
    exportColorPalette: service.exportThemePreset,
    importColorPalette: service.importThemePreset
  }
}
