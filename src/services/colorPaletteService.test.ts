import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { ComfyApp } from '@/scripts/app'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

vi.mock(import('@/scripts/app'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return {
    app: fromPartial<ComfyApp>({
      canvas: { default_connection_color_byType: {}, setDirty: vi.fn() }
    })
  }
})

const SHADOW_PROPERTY = '--interface-floating-panel-shadow'
const SHADOW_FALLBACK = 'var(--palette-interface-floating-panel-shadow)'

function readRootShadow() {
  return document.documentElement.style.getPropertyValue(SHADOW_PROPERTY)
}

function restoreRootShadowAfterTest() {
  const previous = readRootShadow()
  onTestFinished(() => {
    document.documentElement.style.setProperty(SHADOW_PROPERTY, previous)
  })
}

describe('useColorPaletteService', () => {
  it.for([
    { paletteId: 'dark', expected: SHADOW_FALLBACK },
    { paletteId: 'light', expected: '0 2px 16px 0 rgba(0, 0, 0, 0.2)' }
  ])(
    'resolves the floating panel shadow through the palette contract ($paletteId)',
    async ({ paletteId, expected }) => {
      restoreRootShadowAfterTest()

      await useColorPaletteService().loadColorPalette(paletteId)

      expect(readRootShadow()).toBe(expected)
    }
  )

  it('lets a custom palette own the floating panel shadow and falls back once the next palette omits it', async () => {
    restoreRootShadowAfterTest()
    const store = useColorPaletteStore()
    const dark = store.palettesLookup.dark
    assert.exists(dark)
    const customShadow = '0 0 0 9px rgb(1 2 3)'
    store.addCustomPalette({
      ...dark,
      id: 'custom-shadow',
      colors: {
        ...dark.colors,
        comfy_base: {
          ...dark.colors.comfy_base,
          'interface-floating-panel-shadow': customShadow
        }
      }
    })
    const service = useColorPaletteService()

    await service.loadColorPalette('custom-shadow')
    expect(readRootShadow()).toBe(customShadow)

    await service.loadColorPalette('dark')
    expect(readRootShadow()).toBe(SHADOW_FALLBACK)
  })
})
