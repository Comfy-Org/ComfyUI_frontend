import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ColorPalettes, Palette } from '@/types/colorPaletteTypes'
import { CORE_COLOR_PALETTES } from '@/constants/coreColorPalettes'

export const useColorPaletteStore = defineStore('colorPalette', () => {
  const customPalettes = ref<ColorPalettes>({})
  const activePaletteId = ref<string>('')

  const palettes = computed(() => ({
    ...CORE_COLOR_PALETTES,
    ...customPalettes.value
  }))

  const activePalette = computed(() => palettes.value[activePaletteId.value])

  async function addCustomPalette(palette: Palette) {
    customPalettes.value[palette.id] = palette
    activePaletteId.value = palette.id
  }

  function deleteCustomPalette(id: string) {
    delete customPalettes.value[id]
    activePaletteId.value = CORE_COLOR_PALETTES.dark.id
  }

  return {
    // State
    customPalettes,
    activePaletteId,

    // Getters
    palettes,
    activePalette,

    // Actions
    addCustomPalette,
    deleteCustomPalette
  }
})
