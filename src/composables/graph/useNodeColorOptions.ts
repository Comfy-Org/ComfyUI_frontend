import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ColorOption as CanvasColorOption } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IColorable } from '@/lib/litegraph/src/interfaces'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'

/**
 * Color variants for different themes and display purposes
 */
interface ColorVariants {
  dark: string
  light: string
  ringDark?: string
  ringLight?: string
}

/**
 * Node color option with localized name and theme variants
 */
export interface NodeColorOption {
  name: string
  localizedName: string | (() => string)
  value: ColorVariants
}

/**
 * Configuration for useNodeColorOptions composable
 */
export interface UseNodeColorOptionsConfig {
  /**
   * Whether to include ring color variants for UI elements like borders
   * @default false
   */
  includeRingColors?: boolean

  /**
   * Lightness adjustments for color variants
   * @default { dark: 0, light: 0.5, ringDark: 0.5, ringLight: 0.1 }
   */
  lightnessAdjustments?: {
    dark?: number
    light?: number
    ringDark?: number
    ringLight?: number
  }

  /**
   * Whether localizedName should be a function instead of a string
   * Useful when you need reactive i18n updates
   * @default false
   */
  localizedNameAsFunction?: boolean
}

/**
 * Return type for useNodeColorOptions composable
 */
export interface UseNodeColorOptionsReturn {
  colorOptions: ComputedRef<NodeColorOption[]>
  NO_COLOR_OPTION: ComputedRef<NodeColorOption>
  getColorValue: (color: string) => ColorVariants
  applyColorToItems: (items: IColorable[], colorName: string) => void
  getCurrentColorName: (items: IColorable[]) => string | null
  isLightTheme: ComputedRef<boolean>
}

/**
 * Composable for managing node color options with flexible configuration.
 * Consolidates color picker logic across SetNodeColor, ColorPickerButton, and useNodeCustomization.
 *
 * @param config - Configuration options for color variants and localization
 * @returns Color options, helper functions, and theme information
 *
 * @example
 * ```typescript
 * // Basic usage (2 color variants)
 * const { colorOptions, applyColorToItems } = useNodeColorOptions()
 *
 * // With ring colors (4 color variants)
 * const { colorOptions, NO_COLOR_OPTION } = useNodeColorOptions({
 *   includeRingColors: true,
 *   lightnessAdjustments: { dark: 0.3, light: 0.4, ringDark: 0.5, ringLight: 0.1 }
 * })
 * ```
 */
export function useNodeColorOptions(
  config: UseNodeColorOptionsConfig = {}
): UseNodeColorOptionsReturn {
  const {
    includeRingColors = false,
    lightnessAdjustments = {},
    localizedNameAsFunction = false
  } = config

  const { t } = useI18n()
  const colorPaletteStore = useColorPaletteStore()

  const isLightTheme = computed<boolean>(() =>
    Boolean(colorPaletteStore.completedActivePalette.light_theme)
  )

  // Default lightness adjustments
  const defaultAdjustments = {
    dark: 0,
    light: 0.5,
    ringDark: 0.5,
    ringLight: 0.1
  }

  const adjustments = {
    ...defaultAdjustments,
    ...lightnessAdjustments
  }

  /**
   * Generate color variants for a given base color
   */
  const getColorValue = (color: string): ColorVariants => {
    const variants: ColorVariants = {
      dark: adjustColor(color, { lightness: adjustments.dark }),
      light: adjustColor(color, { lightness: adjustments.light })
    }

    if (includeRingColors) {
      variants.ringDark = adjustColor(color, {
        lightness: adjustments.ringDark
      })
      variants.ringLight = adjustColor(color, {
        lightness: adjustments.ringLight
      })
    }

    return variants
  }

  const nodeColorEntries = Object.entries(LGraphCanvas.node_colors)

  /**
   * The "no color" option that resets nodes to default color
   */
  const NO_COLOR_OPTION = computed<NodeColorOption>(() => {
    const localizedName = localizedNameAsFunction
      ? () => t('color.noColor')
      : t('color.noColor')

    return {
      name: 'noColor',
      localizedName,
      value: getColorValue(LiteGraph.NODE_DEFAULT_BGCOLOR)
    }
  })

  /**
   * All available color options including the "no color" option
   */
  const colorOptions = computed<NodeColorOption[]>(() => {
    const options: NodeColorOption[] = [
      NO_COLOR_OPTION.value,
      ...nodeColorEntries.map(([name, color]) => {
        const localizedName = localizedNameAsFunction
          ? () => t(`color.${name}`)
          : t(`color.${name}`)

        return {
          name,
          localizedName,
          value: getColorValue(color.bgcolor)
        }
      })
    ]

    return options
  })

  /**
   * Apply a color to multiple colorable items
   *
   * @param items - Items that implement IColorable interface
   * @param colorName - Name of the color to apply (or 'noColor' to reset)
   */
  const applyColorToItems = (items: IColorable[], colorName: string): void => {
    const canvasColorOption =
      colorName === NO_COLOR_OPTION.value.name
        ? null
        : LGraphCanvas.node_colors[colorName]

    for (const item of items) {
      item.setColorOption(canvasColorOption)
    }
  }

  /**
   * Get the current color name from a list of items
   * Returns null if items have different colors or no color is set
   *
   * @param items - Items to check color from
   * @returns Color name or null
   */
  const getCurrentColorName = (items: IColorable[]): string | null => {
    if (items.length === 0) return null

    const colorOptions = items.map((item) => item.getColorOption())

    // Check if all items have the same color
    let colorOption: CanvasColorOption | null | false = colorOptions[0]
    if (!colorOptions.every((option) => option === colorOption)) {
      colorOption = false
    }

    // Different colors
    if (colorOption === false) return null

    // No color or default color
    if (colorOption == null || (!colorOption.bgcolor && !colorOption.color)) {
      return NO_COLOR_OPTION.value.name
    }

    // Find matching color name
    return (
      nodeColorEntries.find(
        ([_, color]) =>
          color.bgcolor === colorOption.bgcolor &&
          color.color === colorOption.color
      )?.[0] ?? null
    )
  }

  return {
    colorOptions,
    NO_COLOR_OPTION,
    getColorValue,
    applyColorToItems,
    getCurrentColorName,
    isLightTheme
  }
}
