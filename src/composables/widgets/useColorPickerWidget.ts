import type { LGraphNode } from '@comfyorg/litegraph'
import { ref } from 'vue'

import ColorPickerWidget from '@/components/graph/widgets/ColorPickerWidget.vue'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgetTypes'

const PADDING = 8

interface ColorPickerWidgetOptions {
  defaultValue?: string
  defaultFormat?: 'rgba' | 'hsla' | 'hsva' | 'hex'
  minHeight?: number
  serialize?: boolean
}

export const useColorPickerWidget = (
  options: ColorPickerWidgetOptions = {}
) => {
  const {
    defaultValue = 'rgba(255, 0, 0, 1)',
    minHeight = 48,
    serialize = true
  } = options

  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    // Initialize widget value as string
    const widgetValue = ref<string>(defaultValue)

    // Create the main widget instance
    const widget = new ComponentWidgetImpl<string>({
      node,
      name: inputSpec.name,
      component: ColorPickerWidget,
      inputSpec,
      options: {
        // Required: getter for widget value
        getValue: () => widgetValue.value,

        // Required: setter for widget value
        setValue: (value: string | any) => {
          // Handle different input types
          if (typeof value === 'string') {
            // Validate and normalize color string
            const normalizedValue = normalizeColorString(value)
            if (normalizedValue) {
              widgetValue.value = normalizedValue
            }
          } else if (typeof value === 'object' && value !== null) {
            // Handle object input (e.g., from PrimeVue ColorPicker)
            if (value.hex) {
              widgetValue.value = value.hex
            } else {
              // Try to convert object to string
              widgetValue.value = String(value)
            }
          } else {
            // Fallback to string conversion
            widgetValue.value = String(value)
          }
        },

        // Optional: minimum height for the widget
        getMinHeight: () => minHeight + PADDING,

        // Optional: whether to serialize this widget's value
        serialize
      }
    })

    // Register the widget with the node
    addWidget(node, widget as any)

    return widget
  }

  return widgetConstructor
}

/**
 * Normalizes color string inputs to ensure consistent format
 * @param colorString - The input color string
 * @returns Normalized color string or null if invalid
 */
function normalizeColorString(colorString: string): string | null {
  if (!colorString || typeof colorString !== 'string') {
    return null
  }

  const trimmed = colorString.trim()

  // Handle hex colors
  if (trimmed.startsWith('#')) {
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(trimmed)) {
      // Convert 3-digit hex to 6-digit
      if (trimmed.length === 4) {
        return (
          '#' +
          trimmed[1] +
          trimmed[1] +
          trimmed[2] +
          trimmed[2] +
          trimmed[3] +
          trimmed[3]
        )
      }
      return trimmed.toLowerCase()
    }
    return null
  }

  // Handle rgb/rgba colors
  if (trimmed.startsWith('rgb')) {
    const rgbaMatch = trimmed.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
    )
    if (rgbaMatch) {
      const [, r, g, b, a] = rgbaMatch
      const red = Math.max(0, Math.min(255, parseInt(r)))
      const green = Math.max(0, Math.min(255, parseInt(g)))
      const blue = Math.max(0, Math.min(255, parseInt(b)))
      const alpha = a ? Math.max(0, Math.min(1, parseFloat(a))) : 1

      if (alpha === 1) {
        return `rgb(${red}, ${green}, ${blue})`
      } else {
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`
      }
    }
    return null
  }

  // Handle hsl/hsla colors
  if (trimmed.startsWith('hsl')) {
    const hslaMatch = trimmed.match(
      /hsla?\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*(?:,\s*([\d.]+))?\s*\)/
    )
    if (hslaMatch) {
      const [, h, s, l, a] = hslaMatch
      const hue = Math.max(0, Math.min(360, parseInt(h)))
      const saturation = Math.max(0, Math.min(100, parseInt(s)))
      const lightness = Math.max(0, Math.min(100, parseInt(l)))
      const alpha = a ? Math.max(0, Math.min(1, parseFloat(a))) : 1

      if (alpha === 1) {
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`
      } else {
        return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`
      }
    }
    return null
  }

  // Handle hsv/hsva colors (custom format)
  if (trimmed.startsWith('hsv')) {
    const hsvaMatch = trimmed.match(
      /hsva?\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*(?:,\s*([\d.]+))?\s*\)/
    )
    if (hsvaMatch) {
      const [, h, s, v, a] = hsvaMatch
      const hue = Math.max(0, Math.min(360, parseInt(h)))
      const saturation = Math.max(0, Math.min(100, parseInt(s)))
      const value = Math.max(0, Math.min(100, parseInt(v)))
      const alpha = a ? Math.max(0, Math.min(1, parseFloat(a))) : 1

      if (alpha === 1) {
        return `hsv(${hue}, ${saturation}%, ${value}%)`
      } else {
        return `hsva(${hue}, ${saturation}%, ${value}%, ${alpha})`
      }
    }
    return null
  }

  // Handle named colors by converting to hex (basic set)
  const namedColors: Record<string, string> = {
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    white: '#ffffff',
    black: '#000000',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    orange: '#ffa500',
    purple: '#800080',
    pink: '#ffc0cb',
    brown: '#a52a2a',
    gray: '#808080',
    grey: '#808080'
  }

  const lowerTrimmed = trimmed.toLowerCase()
  if (namedColors[lowerTrimmed]) {
    return namedColors[lowerTrimmed]
  }

  // If we can't parse it, return null
  return null
}

// Export types for use in other modules
export type { ColorPickerWidgetOptions }
