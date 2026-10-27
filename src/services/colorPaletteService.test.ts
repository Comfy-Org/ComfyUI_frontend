import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

import { useToast } from '@/components/ui/toast/toastStore'
import { CORE_COLOR_PALETTES } from '@/constants/coreColorPalettes'
import { themeSchema } from '@/schemas/colorPaletteSchema'
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

function readRootProperty(property: string) {
  return document.documentElement.style.getPropertyValue(property)
}

function clearRootThemeAfterTest() {
  onTestFinished(() => {
    for (const key of themeSchema.keyof().options) {
      document.documentElement.style.removeProperty(`--${key}`)
    }
  })
}

describe('useColorPaletteService theme variables', () => {
  it.for([
    {
      paletteId: 'dark',
      expected: {
        '--background': '#171718',
        '--node': 'var(--card)',
        '--node-header': '#202121',
        '--node-foreground': '#a0a0a0',
        '--secondary': '#262729',
        '--border': '#494a50'
      }
    },
    {
      paletteId: 'light',
      expected: {
        '--background': '#ffffff',
        '--node': 'var(--card)',
        '--node-header': 'var(--secondary)',
        '--node-foreground': '#444444',
        '--secondary': '#e9e9e9',
        '--border': '#b4b4b4'
      }
    },
    {
      paletteId: 'nord',
      expected: {
        '--background': '#161b22',
        '--node': '#161b22',
        '--node-header': '#2e3440',
        '--node-foreground': '#bcc2c8',
        '--secondary': '#2e3440',
        '--border': 'color-mix(in srgb, #161b22 75.5%, #fff)'
      }
    },
    {
      paletteId: 'solarized',
      expected: {
        '--background': '#073642',
        '--node': '#073642',
        '--node-header': '#094656',
        '--node-foreground': '#657b83',
        '--secondary': '#094656',
        '--border': 'color-mix(in srgb, #073642 75.5%, #fff)'
      }
    },
    {
      paletteId: 'spooky',
      expected: {
        '--background': '#0c0910',
        '--node': '#140f19',
        '--node-header': '#2b1640',
        '--node-foreground': '#c8b6d6',
        '--secondary': '#22182c',
        '--border': '#45305a'
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
        '--node-foreground': readRootProperty('--node-foreground'),
        '--secondary': readRootProperty('--secondary'),
        '--border': readRootProperty('--border')
      }).toEqual(expected)
    }
  )

  it('lets a palette theme override derived values and restores the core theme when a core palette loads', async () => {
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
    ]).toEqual(['var(--card)', '#3c3d42', '#171718'])
  })

  it('starts a light custom palette without a theme from the light theme', async () => {
    clearRootThemeAfterTest()
    const store = useColorPaletteStore()
    const nord = store.palettesLookup.nord
    assert.exists(nord)
    store.addCustomPalette({ ...nord, id: 'custom-light', light_theme: true })

    await useColorPaletteService().loadColorPalette('custom-light')

    expect({
      '--primary': readRootProperty('--primary'),
      '--warning': readRootProperty('--warning'),
      colorScheme: document.documentElement.style.colorScheme
    }).toEqual({
      '--primary': '#31b9f4',
      '--warning': '#c77700',
      colorScheme: 'light'
    })
  })

  it('re-enables transitions when applying a palette fails', async () => {
    clearRootThemeAfterTest()
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })
    vi.spyOn(
      CSSStyleDeclaration.prototype,
      'setProperty'
    ).mockImplementationOnce(() => {
      throw new Error('style not writable')
    })

    await useColorPaletteService().loadColorPalette('nord')
    vi.runAllTimers()

    expect(document.documentElement.dataset.paletteSwitching).toBeUndefined()
  })

  it('keeps transitions off until the latest of two quick switches settles', async () => {
    clearRootThemeAfterTest()
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })
    const service = useColorPaletteService()

    await service.loadColorPalette('nord')
    vi.advanceTimersToNextFrame()
    await service.loadColorPalette('solarized')
    vi.advanceTimersToNextFrame()

    expect(document.documentElement.dataset.paletteSwitching).toBe('')
    vi.runAllTimers()
    expect(document.documentElement.dataset.paletteSwitching).toBeUndefined()
  })

  it('leaves legacy palette variables to the theme aliases for core palettes', async () => {
    clearRootThemeAfterTest()
    onTestFinished(() => {
      document.documentElement.style.removeProperty('--comfy-menu-bg')
    })
    const service = useColorPaletteService()

    await service.loadColorPalette('nord')
    const nordMenuBg = readRootProperty('--comfy-menu-bg')
    await service.loadColorPalette('dark')

    expect([nordMenuBg, readRootProperty('--comfy-menu-bg')]).toEqual([
      '#161b22',
      ''
    ])
  })

  it.for([
    { paletteId: 'dark', expected: ['#222', '#ddd', '#4e4e4e'] },
    { paletteId: 'light', expected: ['#C9C9C9', '#222', '#888'] }
  ])(
    'restores the $paletteId legacy control colors after switching palettes',
    async ({ paletteId, expected }) => {
      clearRootThemeAfterTest()
      onTestFinished(() => {
        document.documentElement.style.removeProperty('--comfy-input-bg')
        document.documentElement.style.removeProperty('--input-text')
        document.documentElement.style.removeProperty('--border-color')
      })
      const service = useColorPaletteService()

      await service.loadColorPalette('solarized')
      await service.loadColorPalette(paletteId)

      expect([
        readRootProperty('--comfy-input-bg'),
        readRootProperty('--input-text'),
        readRootProperty('--border-color')
      ]).toEqual(expected)
    }
  )

  it('keeps the dark palette theme equal to the stylesheet defaults', () => {
    const cssDir = join(
      process.cwd(),
      'packages',
      'design-system',
      'src',
      'css'
    )
    const paletteCss = readFileSync(join(cssDir, '_palette.css'), 'utf8')
    const styleCss = readFileSync(join(cssDir, 'style.css'), 'utf8')
    const palette = Object.fromEntries(
      [...paletteCss.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(
        ([, name, hex]) => [name, hex.toLowerCase()]
      )
    )
    palette.white = '#ffffff'
    const rootBlock = styleCss.slice(
      styleCss.indexOf(':root {'),
      styleCss.indexOf('}', styleCss.indexOf(':root {'))
    )
    const stylesheetDefaults = Object.fromEntries(
      [...rootBlock.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(
        ([, token, value]) => [
          token,
          palette[/^var\(--color-([\w-]+)\)$/.exec(value)?.[1] ?? ''] ?? value
        ]
      )
    )
    const darkTheme = useColorPaletteStore().palettesLookup.dark?.colors.theme

    expect(darkTheme).toEqual(
      Object.fromEntries(
        Object.keys(darkTheme ?? {}).map((token) => [
          token,
          stylesheetDefaults[token]
        ])
      )
    )
  })

  it.for(
    Object.values(CORE_COLOR_PALETTES).flatMap(({ id, colors }) =>
      colors.theme ? [{ paletteId: id, theme: colors.theme }] : []
    )
  )(
    'applies every theme token the $paletteId palette sets',
    async ({ paletteId, theme }) => {
      clearRootThemeAfterTest()

      await useColorPaletteService().loadColorPalette(paletteId)

      const tokens = Object.keys(theme).map((token) => `--${token}`)
      expect(
        Object.fromEntries(tokens.map((name) => [name, readRootProperty(name)]))
      ).toEqual(
        Object.fromEntries(
          Object.entries(theme).map(([token, value]) => [`--${token}`, value])
        )
      )
    }
  )

  it.for(
    Object.values(CORE_COLOR_PALETTES).flatMap(({ id, colors }) => {
      const image = colors.litegraph_base.BACKGROUND_IMAGE
      return image?.startsWith('/assets/') ? [{ paletteId: id, image }] : []
    })
  )('ships the $paletteId canvas background image', ({ image }) => {
    expect(existsSync(join(process.cwd(), 'public', image))).toBe(true)
  })

  it('lists every shipped palette file as a selectable palette', () => {
    const shipped = readdirSync(join(process.cwd(), 'src/assets/palettes')).map(
      (file) => basename(file, '.json')
    )

    expect(useColorPaletteStore().palettes.map(({ id }) => id)).toEqual(
      expect.arrayContaining(shipped)
    )
  })
})

describe('useColorPaletteService', () => {
  it.for([
    { paletteId: 'dark', expected: 'rgb(0 0 0 / 0.4)' },
    { paletteId: 'light', expected: 'rgb(0 0 0 / 0.15)' }
  ])(
    'sets the shadow color from the $paletteId palette theme',
    async ({ paletteId, expected }) => {
      clearRootThemeAfterTest()

      await useColorPaletteService().loadColorPalette(paletteId)

      expect(readRootProperty('--shadow-color')).toBe(expected)
    }
  )

  it('keeps the current palette and reports an error when asked to load an unknown palette', async () => {
    clearRootThemeAfterTest()
    const service = useColorPaletteService()
    await service.loadColorPalette('nord')

    await service.loadColorPalette('unknown')

    expect(readRootProperty('--background')).toBe('#161b22')
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        description: 'Color palette unknown not found'
      })
    )
  })

  it('removes a custom palette legacy shadow once the next palette omits it', async () => {
    clearRootThemeAfterTest()
    onTestFinished(() => {
      document.documentElement.style.removeProperty(SHADOW_PROPERTY)
    })
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
    const customValue = readRootProperty(SHADOW_PROPERTY)
    await service.loadColorPalette('dark')

    expect([customValue, readRootProperty(SHADOW_PROPERTY)]).toEqual([
      customShadow,
      ''
    ])
  })
})
