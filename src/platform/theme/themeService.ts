import { toRaw } from 'vue'
import { fromZodError } from 'zod-validation-error'

import {
  BUILT_IN_THEME_PRESETS,
  DEFAULT_THEME_PRESET
} from '@comfyorg/theme-core/builtInThemePresets'
import { resolveTheme } from '@comfyorg/theme-core/resolveTheme'
import { themePresetSchema } from '@comfyorg/theme-core/themePresetSchema'
import type {
  ThemePreset,
  ThemePresets
} from '@comfyorg/theme-core/themePresetSchema'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useApp } from '@/scripts/appInstance'
import { uploadFile } from '@/scripts/utils'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { applyTheme } from './applyTheme'
import { useThemeStore } from './themeStore'
import type { ProvidedTheme } from './themeStore'

let latestThemeSwitch = 0
let activeStylesheet: HTMLStyleElement | undefined
let cancelPendingStylesheet: (() => void) | undefined

function loadThemeStylesheet(url: string) {
  const element = document.createElement('style')
  element.dataset.themeStylesheet = url
  element.textContent = `@import url(${JSON.stringify(url)}) layer(presets);`
  return new Promise<HTMLStyleElement | undefined>((resolve) => {
    const settle = (loaded: HTMLStyleElement | undefined) => {
      cancelPendingStylesheet = undefined
      if (!loaded) element.remove()
      resolve(loaded)
    }
    cancelPendingStylesheet = () => settle(undefined)
    element.addEventListener('load', () => settle(element), { once: true })
    element.addEventListener(
      'error',
      () => {
        console.warn(`Theme stylesheet ${url} failed to load`)
        settle(undefined)
      },
      { once: true }
    )
    document.head.append(element)
  })
}

function replaceActiveStylesheet(next: HTMLStyleElement | undefined) {
  if (activeStylesheet !== next) activeStylesheet?.remove()
  activeStylesheet = next
}

function availableCustomPresetId(id: string, presets: ThemePresets) {
  let candidate = `${id}-custom`
  let suffix = 2
  while (
    Object.hasOwn(presets, candidate) ||
    Object.hasOwn(BUILT_IN_THEME_PRESETS, candidate)
  ) {
    candidate = `${id}-custom-${suffix++}`
  }
  return candidate
}

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

  async function loadCustomThemePresets() {
    const presets = settingStore.exists('Comfy.CustomColorPalettes')
      ? settingStore.get('Comfy.CustomColorPalettes')
      : {}
    const conflicts = Object.keys(presets).filter((id) =>
      Object.hasOwn(BUILT_IN_THEME_PRESETS, id)
    )
    const migrated = { ...presets }
    const previousId = settingStore.exists('Comfy.ColorPalette')
      ? settingStore.get('Comfy.ColorPalette')
      : DEFAULT_THEME_PRESET.id
    let activeId = previousId
    for (const id of conflicts) {
      const newId = availableCustomPresetId(id, migrated)
      migrated[newId] = { ...migrated[id], id: newId }
      delete migrated[id]
      if (activeId === id) activeId = newId
    }
    themeStore.customPresets = migrated
    if (!conflicts.length && activeId === previousId) return

    await settingStore.setMany({
      'Comfy.CustomColorPalettes': migrated,
      ...(activeId !== previousId ? { 'Comfy.ColorPalette': activeId } : {})
    })
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
    cancelPendingStylesheet?.()
    const stylesheetUrl = themeStore.stylesheetUrlFor(id)
    const stylesheet = stylesheetUrl
      ? await loadThemeStylesheet(stylesheetUrl)
      : undefined
    if (themeSwitch !== latestThemeSwitch) {
      stylesheet?.remove()
      return
    }
    root.dataset.paletteSwitching = ''
    let committed = false
    try {
      applyTheme(theme, {
        style: root.style,
        canvas: useApp().canvas,
        dataTypes: nodeDefStore.nodeDataTypes,
        backgroundImage: settingStore.get('Comfy.Canvas.BackgroundImage')
      })
      if (theme.stylesheet) root.dataset.theme = theme.stylesheet
      else delete root.dataset.theme
      replaceActiveStylesheet(stylesheet)
      committed = true
      themeStore.activePresetId = id
    } finally {
      if (!committed) stylesheet?.remove()
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (themeSwitch !== latestThemeSwitch) return
          delete root.dataset.paletteSwitching
          persistSplashColors()
        })
      )
    }
  }

  async function registerProvidedThemes(
    source: string,
    themes: readonly ProvidedTheme[]
  ) {
    const accepted = themes.flatMap((theme) => {
      const parsed = themePresetSchema.safeParse(theme.preset)
      if (!parsed.success) {
        console.warn(
          `${source} provided an invalid theme`,
          fromZodError(parsed.error).message
        )
        return []
      }
      const result = themeStore.addProvidedTheme(source, {
        preset: parsed.data,
        stylesheetUrl: theme.stylesheetUrl
      })
      if (!result.added) {
        console.warn(
          `${source} provided theme ${parsed.data.id}, which ${result.owner} already provides`
        )
        return []
      }
      return [parsed.data.id]
    })
    const storedId = settingStore.get('Comfy.ColorPalette')
    if (accepted.includes(storedId)) await setActiveTheme(storedId)
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
    loadCustomThemePresets: wrapWithErrorHandlingAsync(loadCustomThemePresets),
    addCustomThemePreset: wrapWithErrorHandlingAsync(addCustomThemePreset),
    deleteCustomThemePreset: wrapWithErrorHandlingAsync(
      deleteCustomThemePreset
    ),
    setActiveTheme: wrapWithErrorHandlingAsync(setActiveTheme),
    registerProvidedThemes: wrapWithErrorHandlingAsync(registerProvidedThemes),
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
