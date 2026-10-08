import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_DARK_COLOR_PALETTE,
  DEFAULT_LIGHT_COLOR_PALETTE
} from '@/constants/coreColorPalettes'
import type { Palette } from '@/schemas/colorPaletteSchema'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const INVALID_COLOR = 'notacolor'

function stubColorSupport() {
  vi.stubGlobal('CSS', {
    supports: (_property: string, value: string) => value !== INVALID_COLOR
  })
}

function customPalette(
  baseId: 'dark' | 'light',
  menuColors: { menuBg: string; secondaryBg?: string }
): Palette {
  const base =
    baseId === 'dark' ? DEFAULT_DARK_COLOR_PALETTE : DEFAULT_LIGHT_COLOR_PALETTE
  const { 'comfy-menu-secondary-bg': _, ...comfyBase } = base.colors.comfy_base
  return {
    ...base,
    id: `custom-${baseId}-${menuColors.menuBg}-${menuColors.secondaryBg}`,
    colors: {
      ...base.colors,
      comfy_base: {
        ...comfyBase,
        'comfy-menu-bg': menuColors.menuBg,
        ...(menuColors.secondaryBg && {
          'comfy-menu-secondary-bg': menuColors.secondaryBg
        })
      }
    }
  }
}

describe('useColorPaletteStore completedActivePalette', () => {
  it.for([
    {
      baseId: 'dark',
      menuBg: '#073642',
      expectedMenuBg: '#073642',
      expectedSecondaryBg: '#073642'
    },
    {
      baseId: 'dark',
      menuBg: INVALID_COLOR,
      expectedMenuBg: '#171718',
      expectedSecondaryBg: '#171718'
    },
    {
      baseId: 'light',
      menuBg: INVALID_COLOR,
      expectedMenuBg: '#FFFFFF',
      expectedSecondaryBg: '#FFFFFF'
    },
    {
      baseId: 'dark',
      menuBg: INVALID_COLOR,
      secondaryBg: '#111111',
      expectedMenuBg: '#171718',
      expectedSecondaryBg: '#111111'
    }
  ] as const)(
    'completes $baseId menu colour $menuBg (secondary $secondaryBg) to $expectedMenuBg',
    ({ baseId, menuBg, secondaryBg, expectedMenuBg, expectedSecondaryBg }) => {
      stubColorSupport()
      const store = useColorPaletteStore()
      store.addCustomPalette(customPalette(baseId, { menuBg, secondaryBg }))

      const { comfy_base } = store.completedActivePalette.colors

      expect(comfy_base['comfy-menu-bg']).toBe(expectedMenuBg)
      expect(comfy_base['comfy-menu-secondary-bg']).toBe(expectedSecondaryBg)
    }
  )

  it('leaves the stored custom palette as the user defined it', () => {
    stubColorSupport()
    const store = useColorPaletteStore()
    const palette = customPalette('dark', { menuBg: INVALID_COLOR })
    const definedColors = structuredClone(palette.colors.comfy_base)
    store.addCustomPalette(palette)

    void store.completedActivePalette

    expect(store.customPalettes[palette.id]?.colors.comfy_base).toEqual(
      definedColors
    )
  })
})
