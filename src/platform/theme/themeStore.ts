import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  BUILT_IN_THEME_PRESETS,
  DEFAULT_THEME_PRESET
} from '@comfyorg/theme-core/builtInThemePresets'
import { resolveTheme } from '@comfyorg/theme-core/resolveTheme'
import type {
  ThemePreset,
  ThemePresets
} from '@comfyorg/theme-core/themePresetSchema'

export const useThemeStore = defineStore('theme', () => {
  const customPresets = ref<ThemePresets>({})
  const activePresetId = ref<string>(DEFAULT_THEME_PRESET.id)
  const presetsLookup = computed<Partial<ThemePresets>>(() => ({
    ...BUILT_IN_THEME_PRESETS,
    ...customPresets.value
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
    return id in customPresets.value
  }

  return {
    customPresets,
    activePresetId,
    presetsLookup,
    presets,
    activeTheme,
    colorScheme,
    isCustomPreset,
    addCustomPreset,
    deleteCustomPreset
  }
})
