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

function readRootProperty(property: string) {
  return document.documentElement.style.getPropertyValue(property)
}

function clearRootThemeAfterTest() {
  onTestFinished(() => {
    for (const property of [
      '--background',
      '--node',
      '--node-header',
      '--secondary',
      '--border',
      '--muted'
    ]) {
      document.documentElement.style.removeProperty(property)
    }
  })
}

describe('useColorPaletteService theme variables', () => {
  it.for([
    {
      paletteId: 'dark',
      expected: {
        '--background': '',
        '--node': '',
        '--node-header': '',
        '--secondary': '',
        '--border': ''
      }
    },
    {
      paletteId: 'light',
      expected: {
        '--background': '',
        '--node': '',
        '--node-header': '',
        '--secondary': '',
        '--border': ''
      }
    },
    {
      paletteId: 'nord',
      expected: {
        '--background': '#161b22',
        '--node': '#161b22',
        '--node-header': '#2e3440',
        '--secondary': '',
        '--border': 'color-mix(in srgb, #161b22 75.5%, #fff)'
      }
    },
    {
      paletteId: 'solarized',
      expected: {
        '--background': '#073642',
        '--node': '#073642',
        '--node-header': '#094656',
        '--secondary': '',
        '--border': 'color-mix(in srgb, #073642 75.5%, #fff)'
      }
    }
  ])(
    'applies the $paletteId palette to the theme variables',
    async ({ paletteId, expected }) => {
      clearRootThemeAfterTest()

      await useColorPaletteService().loadColorPalette(paletteId)

      expect({
        '--background': readRootProperty('--background'),
        '--node': readRootProperty('--node'),
        '--node-header': readRootProperty('--node-header'),
        '--secondary': readRootProperty('--secondary'),
        '--border': readRootProperty('--border')
      }).toEqual(expected)
    }
  )

  it('lets a palette theme override derived values and clears them when a core palette loads', async () => {
    clearRootThemeAfterTest()
    const store = useColorPaletteStore()
    const nord = store.palettesLookup.nord
    assert.exists(nord)
    store.addCustomPalette({
      ...nord,
      id: 'custom-theme',
      colors: { ...nord.colors, theme: { node: '#123456', muted: '#654321' } }
    })
    const service = useColorPaletteService()

    await service.loadColorPalette('custom-theme')
    expect([
      readRootProperty('--node'),
      readRootProperty('--muted'),
      readRootProperty('--background')
    ]).toEqual(['#123456', '#654321', '#161b22'])

    await service.loadColorPalette('dark')
    expect([
      readRootProperty('--node'),
      readRootProperty('--muted'),
      readRootProperty('--background')
    ]).toEqual(['', '', ''])
  })
})

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
