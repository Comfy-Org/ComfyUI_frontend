import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type * as VueI18n from 'vue-i18n'

import { useNodeColorOptions } from '@/composables/graph/useNodeColorOptions'
import type { IColorable } from '@/lib/litegraph/src/interfaces'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof VueI18n>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: vi.fn()
}))

vi.mock('@/utils/colorUtil', () => ({
  adjustColor: (color: string, options: { lightness?: number }) => {
    const lightness = options.lightness ?? 0
    return `adjusted(${color}, ${lightness})`
  }
}))

const mockColorPaletteStore = {
  completedActivePalette: {
    light_theme: false
  },
  $id: 'colorPalette',
  $state: {} as any,
  $patch: vi.fn(),
  $reset: vi.fn(),
  $subscribe: vi.fn(),
  $onAction: vi.fn(),
  $dispose: vi.fn(),
  _customProperties: new Set(),
  _p: {} as any
}

describe('useNodeColorOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(useColorPaletteStore).mockReturnValue(
      mockColorPaletteStore as any
    )

    // Mock LGraphCanvas.node_colors
    vi.spyOn(LGraphCanvas, 'node_colors', 'get').mockReturnValue({
      red: { bgcolor: '#ff0000', color: '#ffffff' },
      blue: { bgcolor: '#0000ff', color: '#ffffff' }
    } as any)

    // Mock LiteGraph.NODE_DEFAULT_BGCOLOR
    vi.spyOn(LiteGraph, 'NODE_DEFAULT_BGCOLOR', 'get').mockReturnValue(
      '#999999'
    )
  })

  describe('Basic Configuration', () => {
    test('should generate color options with default config', () => {
      const { colorOptions } = useNodeColorOptions()

      expect(colorOptions.value).toHaveLength(3) // NO_COLOR + red + blue
      expect(colorOptions.value[0].name).toBe('noColor')
      expect(colorOptions.value[1].name).toBe('red')
      expect(colorOptions.value[2].name).toBe('blue')
    })

    test('should include ring colors when configured', () => {
      const { colorOptions } = useNodeColorOptions({
        includeRingColors: true
      })

      const firstOption = colorOptions.value[0]
      expect(firstOption.value).toHaveProperty('dark')
      expect(firstOption.value).toHaveProperty('light')
      expect(firstOption.value).toHaveProperty('ringDark')
      expect(firstOption.value).toHaveProperty('ringLight')
    })

    test('should not include ring colors by default', () => {
      const { colorOptions } = useNodeColorOptions()

      const firstOption = colorOptions.value[0]
      expect(firstOption.value).toHaveProperty('dark')
      expect(firstOption.value).toHaveProperty('light')
      expect(firstOption.value).not.toHaveProperty('ringDark')
      expect(firstOption.value).not.toHaveProperty('ringLight')
    })

    test('should use localizedName as function when configured', () => {
      const { colorOptions } = useNodeColorOptions({
        localizedNameAsFunction: true
      })

      const firstOption = colorOptions.value[0]
      expect(typeof firstOption.localizedName).toBe('function')
      if (typeof firstOption.localizedName === 'function') {
        expect(firstOption.localizedName()).toBe('color.noColor')
      }
    })

    test('should use localizedName as string by default', () => {
      const { colorOptions } = useNodeColorOptions()

      const firstOption = colorOptions.value[0]
      expect(typeof firstOption.localizedName).toBe('string')
      expect(firstOption.localizedName).toBe('color.noColor')
    })
  })

  describe('NO_COLOR_OPTION', () => {
    test('should provide NO_COLOR_OPTION', () => {
      const { NO_COLOR_OPTION } = useNodeColorOptions()

      expect(NO_COLOR_OPTION.value.name).toBe('noColor')
      expect(NO_COLOR_OPTION.value.localizedName).toBe('color.noColor')
    })
  })

  describe('getColorValue', () => {
    test('should generate color variants with default adjustments', () => {
      const { getColorValue } = useNodeColorOptions()

      const variants = getColorValue('#ff0000')

      expect(variants.dark).toBe('adjusted(#ff0000, 0)')
      expect(variants.light).toBe('adjusted(#ff0000, 0.5)')
    })

    test('should generate color variants with custom adjustments', () => {
      const { getColorValue } = useNodeColorOptions({
        lightnessAdjustments: {
          dark: 0.3,
          light: 0.4
        }
      })

      const variants = getColorValue('#ff0000')

      expect(variants.dark).toBe('adjusted(#ff0000, 0.3)')
      expect(variants.light).toBe('adjusted(#ff0000, 0.4)')
    })

    test('should include ring colors when configured', () => {
      const { getColorValue } = useNodeColorOptions({
        includeRingColors: true,
        lightnessAdjustments: {
          ringDark: 0.5,
          ringLight: 0.1
        }
      })

      const variants = getColorValue('#ff0000')

      expect(variants.ringDark).toBe('adjusted(#ff0000, 0.5)')
      expect(variants.ringLight).toBe('adjusted(#ff0000, 0.1)')
    })
  })

  describe('applyColorToItems', () => {
    test('should apply color to items', () => {
      const { applyColorToItems } = useNodeColorOptions()

      const mockItem1 = {
        setColorOption: vi.fn()
      } as unknown as IColorable

      const mockItem2 = {
        setColorOption: vi.fn()
      } as unknown as IColorable

      applyColorToItems([mockItem1, mockItem2], 'red')

      expect(mockItem1.setColorOption).toHaveBeenCalledWith({
        bgcolor: '#ff0000',
        color: '#ffffff'
      })
      expect(mockItem2.setColorOption).toHaveBeenCalledWith({
        bgcolor: '#ff0000',
        color: '#ffffff'
      })
    })

    test('should reset color when noColor is selected', () => {
      const { applyColorToItems } = useNodeColorOptions()

      const mockItem = {
        setColorOption: vi.fn()
      } as unknown as IColorable

      applyColorToItems([mockItem], 'noColor')

      expect(mockItem.setColorOption).toHaveBeenCalledWith(null)
    })
  })

  describe('getCurrentColorName', () => {
    test('should return null for empty items', () => {
      const { getCurrentColorName } = useNodeColorOptions()

      expect(getCurrentColorName([])).toBe(null)
    })

    test('should return noColor for items with no color', () => {
      const { getCurrentColorName } = useNodeColorOptions()

      const mockItem = {
        getColorOption: vi.fn(() => null)
      } as unknown as IColorable

      expect(getCurrentColorName([mockItem])).toBe('noColor')
    })

    test('should return color name for items with matching color', () => {
      const { getCurrentColorName } = useNodeColorOptions()

      const mockItem = {
        getColorOption: vi.fn(() => ({
          bgcolor: '#ff0000',
          color: '#ffffff'
        }))
      } as unknown as IColorable

      expect(getCurrentColorName([mockItem])).toBe('red')
    })

    test('should return null when items have different colors', () => {
      const { getCurrentColorName } = useNodeColorOptions()

      const mockItem1 = {
        getColorOption: vi.fn(() => ({
          bgcolor: '#ff0000',
          color: '#ffffff'
        }))
      } as unknown as IColorable

      const mockItem2 = {
        getColorOption: vi.fn(() => ({
          bgcolor: '#0000ff',
          color: '#ffffff'
        }))
      } as unknown as IColorable

      expect(getCurrentColorName([mockItem1, mockItem2])).toBe(null)
    })
  })

  describe('isLightTheme', () => {
    test('should reflect color palette store light theme setting', () => {
      mockColorPaletteStore.completedActivePalette.light_theme = false
      const { isLightTheme } = useNodeColorOptions()

      expect(isLightTheme.value).toBe(false)

      mockColorPaletteStore.completedActivePalette.light_theme = true
      const { isLightTheme: isLightTheme2 } = useNodeColorOptions()

      expect(isLightTheme2.value).toBe(true)
    })
  })
})
