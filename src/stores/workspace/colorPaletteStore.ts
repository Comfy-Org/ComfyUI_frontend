import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ColorPalettes, Palette } from '@/types/colorPaletteTypes'
import {
  CORE_COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE
} from '@/constants/coreColorPalettes'

export const useColorPaletteStore = defineStore('colorPalette', () => {
  const customPalettes = ref<ColorPalettes>({})
  const activePaletteId = ref<string>(DEFAULT_COLOR_PALETTE.id)

  const palettesLookup = computed(() => ({
    ...CORE_COLOR_PALETTES,
    ...customPalettes.value
  }))

  const palettes = computed(() => Object.values(palettesLookup.value))
  const activePalette = computed(
    () => palettesLookup.value[activePaletteId.value]
  )

  function addCustomPalette(palette: Palette) {
    if (palette.id in palettesLookup.value) {
      throw new Error(`Palette with id ${palette.id} already exists`)
    }

    customPalettes.value[palette.id] = palette
    activePaletteId.value = palette.id
  }

  function deleteCustomPalette(id: string) {
    if (!(id in customPalettes.value)) {
      throw new Error(`Palette with id ${id} does not exist`)
    }

    delete customPalettes.value[id]
    activePaletteId.value = CORE_COLOR_PALETTES.dark.id
  }

  return {
    // State
    customPalettes,
    activePaletteId,

    // Getters
    palettesLookup,
    palettes,
    activePalette,

    // Actions
    addCustomPalette,
    deleteCustomPalette
  }
})
