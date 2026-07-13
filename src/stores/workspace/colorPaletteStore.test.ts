import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  CORE_COLOR_PALETTES,
  DEFAULT_DARK_COLOR_PALETTE,
  DEFAULT_LIGHT_COLOR_PALETTE
} from '@/constants/coreColorPalettes'
import type { Palette } from '@/schemas/colorPaletteSchema'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

function createPalette(overrides: Partial<Palette> = {}): Palette {
  return {
    id: 'custom',
    name: 'Custom',
    colors: {
      node_slot: {},
      litegraph_base: {},
      comfy_base: {}
    },
    ...overrides
  }
}

describe('useColorPaletteStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('adds and deletes custom palettes', () => {
    const store = useColorPaletteStore()
    const palette = createPalette()

    store.addCustomPalette(palette)

    expect(store.isCustomPalette('custom')).toBe(true)
    expect(store.activePaletteId).toBe('custom')
    expect(store.palettesLookup.custom).toStrictEqual(palette)

    store.deleteCustomPalette('custom')

    expect(store.isCustomPalette('custom')).toBe(false)
    expect(store.activePaletteId).toBe(CORE_COLOR_PALETTES.dark.id)
  })

  it('rejects duplicate and missing custom palette operations', () => {
    const store = useColorPaletteStore()

    expect(() =>
      store.addCustomPalette(
        createPalette({
          id: CORE_COLOR_PALETTES.dark.id
        })
      )
    ).toThrow(`Palette with id ${CORE_COLOR_PALETTES.dark.id} already exists`)

    expect(() => store.deleteCustomPalette('missing')).toThrow(
      'Palette with id missing does not exist'
    )
  })

  it('completes dark palettes and mirrors menu background when secondary is missing', () => {
    const store = useColorPaletteStore()
    const completed = store.completePalette(
      createPalette({
        colors: {
          node_slot: {},
          litegraph_base: {},
          comfy_base: {
            'comfy-menu-bg': '#101010'
          }
        }
      })
    )

    expect(completed.colors.comfy_base['comfy-menu-secondary-bg']).toBe(
      '#101010'
    )
    expect(completed.colors.node_slot.CLIP).toBe(
      DEFAULT_DARK_COLOR_PALETTE.colors.node_slot.CLIP
    )
  })

  it('completes light palettes without overwriting an existing secondary menu background', () => {
    const store = useColorPaletteStore()
    const completed = store.completePalette(
      createPalette({
        light_theme: true,
        colors: {
          node_slot: {},
          litegraph_base: {},
          comfy_base: {
            'comfy-menu-bg': '#ffffff',
            'comfy-menu-secondary-bg': '#eeeeee'
          }
        }
      })
    )

    expect(completed.colors.comfy_base['comfy-menu-secondary-bg']).toBe(
      '#eeeeee'
    )
    expect(completed.colors.node_slot.CLIP).toBe(
      DEFAULT_LIGHT_COLOR_PALETTE.colors.node_slot.CLIP
    )
  })
})
