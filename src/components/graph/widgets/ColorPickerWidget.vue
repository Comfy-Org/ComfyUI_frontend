<template>
  <div class="color-picker-widget">
    <div
      :style="{ width: widgetWidth }"
      class="flex items-center gap-2 p-2 rounded-lg border border-surface-300 bg-surface-0 w-full"
    >
      <!-- Color picker preview and popup trigger -->
      <div class="relative">
        <div
          :style="{ backgroundColor: parsedColor.hex }"
          class="w-4 h-4 rounded border-2 border-surface-400 cursor-pointer hover:border-surface-500 transition-colors"
          title="Click to edit color"
          @click="toggleColorPicker"
        />

        <!-- Color picker popover -->
        <Popover ref="colorPickerPopover" class="!p-0">
          <ColorPicker
            v-model="colorValue"
            format="hex"
            class="border-none"
            @update:model-value="updateColorFromPicker"
          />
        </Popover>
      </div>

      <!-- Color component inputs -->
      <div class="flex gap-5">
        <InputNumber
          v-for="component in colorComponents"
          :key="component.name"
          v-model="component.value"
          :min="component.min"
          :max="component.max"
          :step="component.step"
          :placeholder="component.name"
          class="flex-1 text-xs max-w-8"
          :pt="{
            pcInputText: {
              root: {
                class: 'max-w-12'
              }
            }
          }"
          :show-buttons="false"
          size="small"
          @update:model-value="updateColorFromComponents"
        />
      </div>

      <!-- Format dropdown -->
      <Select
        v-model="currentFormat"
        :options="colorFormats"
        option-label="label"
        option-value="value"
        class="w-24 ml-3"
        size="small"
        :pt="{
          pcInputText: {
            root: {
              class: 'max-w-12'
            }
          }
        }"
        @update:model-value="handleFormatChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ColorPicker from 'primevue/colorpicker'
import InputNumber from 'primevue/inputnumber'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'

import type { ComponentWidget } from '@/scripts/domWidget'

interface ColorComponent {
  name: string
  value: number
  min: number
  max: number
  step: number
}

interface ParsedColor {
  hex: string
  rgb: { r: number; g: number; b: number; a: number }
  hsl: { h: number; s: number; l: number; a: number }
  hsv: { h: number; s: number; v: number; a: number }
}

type ColorFormat = 'rgba' | 'hsla' | 'hsva' | 'hex'

const modelValue = defineModel<string>({ required: true })

const { widget } = defineProps<{
  widget: ComponentWidget<string>
}>()

// Color format options
const colorFormats = [
  { label: 'RGBA', value: 'rgba' },
  { label: 'HSLA', value: 'hsla' },
  { label: 'HSVA', value: 'hsva' },
  { label: 'HEX', value: 'hex' }
]

// Current format state
const currentFormat = ref<ColorFormat>('rgba')

// Color picker popover reference
const colorPickerPopover = ref()

// Internal color value for the PrimeVue ColorPicker
const colorValue = ref<string>('#ff0000')

// Calculate widget width based on node size with padding
const widgetWidth = computed(() => {
  if (!widget?.node?.size) return 'auto'

  const nodeWidth = widget.node.size[0]
  const WIDGET_PADDING = 16 // Account for padding around the widget
  const maxWidth = Math.max(200, nodeWidth - WIDGET_PADDING) // Minimum 200px, but scale with node

  return `${maxWidth}px`
})

// Parse color string to various formats
const parsedColor = computed<ParsedColor>(() => {
  const value = modelValue.value || '#ff0000'

  // Handle different input formats
  if (value.startsWith('#')) {
    return parseHexColor(value)
  } else if (value.startsWith('rgb')) {
    return parseRgbaColor(value)
  } else if (value.startsWith('hsl')) {
    return parseHslaColor(value)
  } else if (value.startsWith('hsv')) {
    return parseHsvaColor(value)
  }

  return parseHexColor('#ff0000') // Default fallback
})

// Get color components based on current format
const colorComponents = computed<ColorComponent[]>(() => {
  const { rgb, hsl, hsv } = parsedColor.value

  switch (currentFormat.value) {
    case 'rgba':
      return [
        { name: 'R', value: rgb.r, min: 0, max: 255, step: 1 },
        { name: 'G', value: rgb.g, min: 0, max: 255, step: 1 },
        { name: 'B', value: rgb.b, min: 0, max: 255, step: 1 },
        { name: 'A', value: rgb.a, min: 0, max: 1, step: 0.01 }
      ]
    case 'hsla':
      return [
        { name: 'H', value: hsl.h, min: 0, max: 360, step: 1 },
        { name: 'S', value: hsl.s, min: 0, max: 100, step: 1 },
        { name: 'L', value: hsl.l, min: 0, max: 100, step: 1 },
        { name: 'A', value: hsl.a, min: 0, max: 1, step: 0.01 }
      ]
    case 'hsva':
      return [
        { name: 'H', value: hsv.h, min: 0, max: 360, step: 1 },
        { name: 'S', value: hsv.s, min: 0, max: 100, step: 1 },
        { name: 'V', value: hsv.v, min: 0, max: 100, step: 1 },
        { name: 'A', value: hsv.a, min: 0, max: 1, step: 0.01 }
      ]
    case 'hex':
      return [] // No components for hex format
    default:
      return []
  }
})

// Watch for changes in modelValue to update colorValue
watch(
  () => modelValue.value,
  (newValue) => {
    if (newValue && newValue !== colorValue.value) {
      colorValue.value = parsedColor.value.hex
    }
  },
  { immediate: true }
)

// Toggle color picker popover
function toggleColorPicker(event: Event) {
  colorPickerPopover.value.toggle(event)
}

// Update color from picker
function updateColorFromPicker(value: string) {
  colorValue.value = value
  updateModelValue(parseHexColor(value))
}

// Update color from component inputs
function updateColorFromComponents() {
  const components = colorComponents.value
  if (components.length === 0) return

  let newColor: ParsedColor
  const rgbFromHsl = hslToRgb(
    components[0].value,
    components[1].value,
    components[2].value,
    components[3].value
  )
  const rgbFromHsv = hsvToRgb(
    components[0].value,
    components[1].value,
    components[2].value,
    components[3].value
  )

  switch (currentFormat.value) {
    case 'rgba':
      newColor = {
        hex: rgbToHex(
          components[0].value,
          components[1].value,
          components[2].value
        ),
        rgb: {
          r: components[0].value,
          g: components[1].value,
          b: components[2].value,
          a: components[3].value
        },
        hsl: rgbToHsl(
          components[0].value,
          components[1].value,
          components[2].value,
          components[3].value
        ),
        hsv: rgbToHsv(
          components[0].value,
          components[1].value,
          components[2].value,
          components[3].value
        )
      }
      break
    case 'hsla':
      newColor = {
        hex: rgbToHex(rgbFromHsl.r, rgbFromHsl.g, rgbFromHsl.b),
        rgb: rgbFromHsl,
        hsl: {
          h: components[0].value,
          s: components[1].value,
          l: components[2].value,
          a: components[3].value
        },
        hsv: rgbToHsv(rgbFromHsl.r, rgbFromHsl.g, rgbFromHsl.b, rgbFromHsl.a)
      }
      break
    case 'hsva':
      newColor = {
        hex: rgbToHex(rgbFromHsv.r, rgbFromHsv.g, rgbFromHsv.b),
        rgb: rgbFromHsv,
        hsl: rgbToHsl(rgbFromHsv.r, rgbFromHsv.g, rgbFromHsv.b, rgbFromHsv.a),
        hsv: {
          h: components[0].value,
          s: components[1].value,
          v: components[2].value,
          a: components[3].value
        }
      }
      break
    default:
      return
  }

  updateModelValue(newColor)
}

// Handle format change
function handleFormatChange() {
  updateModelValue(parsedColor.value)
}

// Update the model value based on current format
function updateModelValue(color: ParsedColor) {
  switch (currentFormat.value) {
    case 'rgba':
      modelValue.value = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`
      break
    case 'hsla':
      modelValue.value = `hsla(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%, ${color.hsl.a})`
      break
    case 'hsva':
      modelValue.value = `hsva(${color.hsv.h}, ${color.hsv.s}%, ${color.hsv.v}%, ${color.hsv.a})`
      break
    case 'hex':
      modelValue.value = color.hex
      break
  }

  colorValue.value = color.hex
}

// Color parsing functions
function parseHexColor(hex: string): ParsedColor {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1

  return {
    hex,
    rgb: { r, g, b, a },
    hsl: rgbToHsl(r, g, b, a),
    hsv: rgbToHsv(r, g, b, a)
  }
}

function parseRgbaColor(rgba: string): ParsedColor {
  const match = rgba.match(/rgba?\(([^)]+)\)/)
  if (!match) return parseHexColor('#ff0000')

  const [r, g, b, a = 1] = match[1].split(',').map((v) => parseFloat(v.trim()))

  return {
    hex: rgbToHex(r, g, b),
    rgb: { r, g, b, a },
    hsl: rgbToHsl(r, g, b, a),
    hsv: rgbToHsv(r, g, b, a)
  }
}

function parseHslaColor(hsla: string): ParsedColor {
  const match = hsla.match(/hsla?\(([^)]+)\)/)
  if (!match) return parseHexColor('#ff0000')

  const [h, s, l, a = 1] = match[1]
    .split(',')
    .map((v) => parseFloat(v.trim().replace('%', '')))
  const rgb = hslToRgb(h, s, l, a)

  return {
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    hsl: { h, s, l, a },
    hsv: rgbToHsv(rgb.r, rgb.g, rgb.b, rgb.a)
  }
}

function parseHsvaColor(hsva: string): ParsedColor {
  const match = hsva.match(/hsva?\(([^)]+)\)/)
  if (!match) return parseHexColor('#ff0000')

  const [h, s, v, a = 1] = match[1]
    .split(',')
    .map((val) => parseFloat(val.trim().replace('%', '')))
  const rgb = hsvToRgb(h, s, v, a)

  return {
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    hsl: rgbToHsl(rgb.r, rgb.g, rgb.b, rgb.a),
    hsv: { h, s, v, a }
  }
}

// Color conversion utility functions
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
  )
}

function rgbToHsl(r: number, g: number, b: number, a: number) {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number, s: number
  const l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
      default:
        h = 0
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a
  }
}

function rgbToHsv(r: number, g: number, b: number, a: number) {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number
  const v = max
  const s = max === 0 ? 0 : (max - min) / max

  if (max === min) {
    h = 0
  } else {
    const d = max - min
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
      default:
        h = 0
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
    a
  }
}

function hslToRgb(h: number, s: number, l: number, a: number) {
  h /= 360
  s /= 100
  l /= 100

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a
  }
}

function hsvToRgb(h: number, s: number, v: number, a: number) {
  h /= 360
  s /= 100
  v /= 100

  const c = v * s
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
  const m = v - c

  let r: number, g: number, b: number

  if (h < 1 / 6) {
    ;[r, g, b] = [c, x, 0]
  } else if (h < 2 / 6) {
    ;[r, g, b] = [x, c, 0]
  } else if (h < 3 / 6) {
    ;[r, g, b] = [0, c, x]
  } else if (h < 4 / 6) {
    ;[r, g, b] = [0, x, c]
  } else if (h < 5 / 6) {
    ;[r, g, b] = [x, 0, c]
  } else {
    ;[r, g, b] = [c, 0, x]
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a
  }
}
</script>

<style scoped>
.color-picker-widget {
  min-height: 40px;
  overflow: hidden; /* Prevent overflow outside node bounds */
}

/* Ensure proper styling for small inputs */
:deep(.p-inputnumber-input) {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

:deep(.p-select) {
  font-size: 0.75rem;
}

:deep(.p-select .p-select-label) {
  padding: 0.25rem 0.5rem;
}

:deep(.p-colorpicker) {
  border: none;
}
</style>
