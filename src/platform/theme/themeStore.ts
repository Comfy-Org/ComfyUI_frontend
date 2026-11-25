import { defineStore } from 'pinia'
import { mapValues } from 'es-toolkit'
import { computed, ref } from 'vue'

import {
  BUILT_IN_THEME_PRESETS,
  DEFAULT_THEME_PRESET
} from '@comfyorg/theme-core/builtInThemePresets'
import { resolveTheme } from '@comfyorg/theme-core/resolveTheme'
import { adjustColor } from '@comfyorg/shared-frontend-utils/colorUtil'
import type {
  ThemePreset,
  ThemePresets
} from '@comfyorg/theme-core/themePresetSchema'

/** A theme an extension provides: a palette preset and an optional stylesheet URL. */
export interface ProvidedTheme {
  preset: ThemePreset
  stylesheetUrl?: string
}

interface RegisteredTheme extends ProvidedTheme {
  source: string
}

export const useThemeStore = defineStore('theme', () => {
  const customPresets = ref<ThemePresets>({})
  const providedThemes = ref<Partial<Record<string, RegisteredTheme>>>({})
  const activePresetId = ref<string>(DEFAULT_THEME_PRESET.id)
  const presetsLookup = computed<Partial<ThemePresets>>(() => ({
    ...BUILT_IN_THEME_PRESETS,
    ...customPresets.value,
    ...mapValues(providedThemes.value, (theme) => theme?.preset)
  }))
  const presets = computed(() =>
    Object.values(presetsLookup.value).filter(
      (preset): preset is ThemePreset => preset !== undefined
    )
  )
  const activeTheme = computed(() =>
    resolveTheme(
      presetsLookup.value[activePresetId.value] ?? DEFAULT_THEME_PRESET
    )
  )
  const colorScheme = computed(() => activeTheme.value.colorScheme)

  function toNodeColor(color?: string): string {
    if (!color) return ''
    const lightness = activeTheme.value.canvas.nodeLightness
    return lightness ? adjustColor(color, { lightness }) : color
  }

  function addCustomPreset(preset: ThemePreset) {
    if (preset.id in presetsLookup.value) return false
    customPresets.value[preset.id] = preset
    activePresetId.value = preset.id
    return true
  }

  function deleteCustomPreset(id: string) {
    if (!(id in customPresets.value)) return false
    delete customPresets.value[id]
    activePresetId.value = BUILT_IN_THEME_PRESETS.dark.id
    return true
  }

  function isCustomPreset(id: string) {
    return id in customPresets.value && !(id in providedThemes.value)
  }

  function addProvidedTheme(source: string, theme: ProvidedTheme) {
    const id = theme.preset.id
    const owner =
      providedThemes.value[id]?.source ??
      (Object.hasOwn(BUILT_IN_THEME_PRESETS, id) ? 'core' : undefined)
    if (owner) return { added: false as const, owner }
    providedThemes.value[id] = { ...theme, source }
    return { added: true as const }
  }

  function stylesheetUrlFor(id: string) {
    return providedThemes.value[id]?.stylesheetUrl
  }

  return {
    customPresets,
    activePresetId,
    presetsLookup,
    presets,
    activeTheme,
    colorScheme,
    toNodeColor,
    isCustomPreset,
    addProvidedTheme,
    stylesheetUrlFor,
    addCustomPreset,
    deleteCustomPreset
  }
})
