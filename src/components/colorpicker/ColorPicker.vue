<template>
  <div class="color-picker-container">
    <!-- Color Preview -->
    <div 
      class="color-preview"
      :style="{ backgroundColor: selectedColor }"
      @click="togglePicker"
    >
    </div>

    <!-- Color Picker Panel -->
    <div 
      v-if="isOpen"
      class="color-picker-panel"
      ref="pickerPanel"
    >
      <!-- Color Gradient Picker -->
      <div class="color-gradient-container">
        <div 
          class="color-gradient"
          ref="colorGradient"
          @mousedown="startGradientDrag"
        >
          <div 
            class="gradient-cursor"
            :style="{ left: `${gradientX}%` }"
          ></div>
        </div>
      </div>

      <!-- RGB Inputs -->
      <div class="rgb-inputs">
        <div class="input-group">
          <label>R</label>
          <input
            v-model.number="red"
            type="number"
            min="0"
            max="255"
            class="rgb-input"
            @input="updateFromRGB"
          />
        </div>
        <div class="input-group">
          <label>G</label>
          <input
            v-model.number="green"
            type="number"
            min="0"
            max="255"
            class="rgb-input"
            @input="updateFromRGB"
          />
        </div>
        <div class="input-group">
          <label>B</label>
          <input
            v-model.number="blue"
            type="number"
            min="0"
            max="255"
            class="rgb-input"
            @input="updateFromRGB"
          />
        </div>
      </div>

      <!-- Hex Display -->
      <div class="hex-display">
        <span class="hex-label">Hex:</span>
        <span class="hex-value">{{ hexValue }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// Props
const { color = '#000000', disabled = false, isOpen = false } = defineProps<{
  color?: string
  disabled?: boolean
  isOpen?: boolean
}>()

// Emits
const emit = defineEmits<{
  'update:color': [color: string]
  'update:open': [open: boolean]
  'update:rgb': [rgb: { red: number, green: number, blue: number }]
  'change': [color: string]
}>()

// Reactive state
const red = ref(0)
const green = ref(0)
const blue = ref(0)
const gradientX = ref(0)
const isDragging = ref(false)

// Template refs
const pickerPanel = ref<HTMLElement>()
const colorGradient = ref<HTMLElement>()

// Computed properties
const selectedColor = computed(() => {
  return `rgb(${red.value}, ${green.value}, ${blue.value})`
})

const hexValue = computed(() => {
  const toHex = (value: number) => {
    const hex = Math.round(value).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(red.value)}${toHex(green.value)}${toHex(blue.value)}`
})

// Methods
const togglePicker = () => {
  if (disabled) return
  emit('update:open', !isOpen)
}

const updateFromRGB = () => {
  // Clamp values
  red.value = Math.max(0, Math.min(255, red.value))
  green.value = Math.max(0, Math.min(255, green.value))
  blue.value = Math.max(0, Math.min(255, blue.value))
  
  updateGradientPosition()
  emitChange()
}

const updateFromGradient = () => {
  // Convert gradient position to RGB
  const hue = (gradientX.value / 100) * 360
  const rgb = hslToRgb(hue, 100, 50)
  
  red.value = rgb.r
  green.value = rgb.g
  blue.value = rgb.b
  
  emitChange()
}

const updateGradientPosition = () => {
  // Convert RGB to HSL to get hue for gradient position
  const hsl = rgbToHsl(red.value, green.value, blue.value)
  gradientX.value = (hsl.h / 360) * 100
}

const startGradientDrag = (event: MouseEvent) => {
  if (!colorGradient.value) return
  
  isDragging.value = true
  updateGradientFromEvent(event)
  
  document.addEventListener('mousemove', handleGradientDrag)
  document.addEventListener('mouseup', stopGradientDrag)
}

const handleGradientDrag = (event: MouseEvent) => {
  if (!isDragging.value) return
  updateGradientFromEvent(event)
}

const stopGradientDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleGradientDrag)
  document.removeEventListener('mouseup', stopGradientDrag)
}

const updateGradientFromEvent = (event: MouseEvent) => {
  if (!colorGradient.value) return
  
  const rect = colorGradient.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  
  gradientX.value = x * 100
  updateFromGradient()
}

// Color conversion utilities
const hslToRgb = (h: number, s: number, l: number) => {
  h /= 360
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h * 6) % 2 - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0

  if (h < 1/6) {
    r = c; g = x; b = 0
  } else if (h < 2/6) {
    r = x; g = c; b = 0
  } else if (h < 3/6) {
    r = 0; g = c; b = x
  } else if (h < 4/6) {
    r = 0; g = x; b = c
  } else if (h < 5/6) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2

  if (delta === 0) {
    h = 0
  } else {
    if (max === r) {
      h = ((g - b) / delta) % 6
    } else if (max === g) {
      h = (b - r) / delta + 2
    } else {
      h = (r - g) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }

  return { h, s: 100, l: l * 100 }
}

const emitChange = () => {
  emit('update:color', hexValue.value)
  emit('change', hexValue.value)
  // Also emit the RGB values for the store
  emit('update:rgb', { red: red.value, green: green.value, blue: blue.value })
}

const parseColor = (colorStr: string) => {
  // Parse hex color
  const hex = colorStr.replace('#', '')
  if (hex.length === 6) {
    red.value = parseInt(hex.substr(0, 2), 16)
    green.value = parseInt(hex.substr(2, 2), 16)
    blue.value = parseInt(hex.substr(4, 2), 16)
    updateGradientPosition()
  }
}

// Lifecycle
onMounted(() => {
  parseColor(color)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleGradientDrag)
  document.removeEventListener('mouseup', stopGradientDrag)
})

// Watchers
watch(() => color, (newColor) => {
  parseColor(newColor)
})
</script>

<style scoped>
.color-picker-container {
  @apply relative inline-block;
}

.color-preview {
  @apply w-12 h-8 rounded border border-gray-300 cursor-pointer flex items-center justify-center text-xs text-white font-mono shadow-sm transition-all duration-200;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
}

.color-preview:hover {
  @apply shadow-md transform scale-105;
}

.color-picker-panel {
  @apply absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl p-4 z-50;
  min-width: 240px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.color-gradient-container {
  @apply mb-4;
}

.color-gradient {
  @apply w-full h-8 rounded border border-gray-300 cursor-pointer relative;
  background: linear-gradient(to right, 
    #ff0000 0%, #ffff00 17%, #00ff00 33%, 
    #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%
  );
}

.gradient-cursor {
  @apply absolute top-1/2 w-4 h-4 border-2 border-white rounded-full shadow-lg bg-white;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.rgb-inputs {
  @apply flex gap-2 mb-3;
}

.input-group {
  @apply flex flex-col flex-1;
}

.input-group label {
  @apply text-xs font-medium text-gray-700 mb-1;
}

.rgb-input {
  @apply w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}

.hex-display {
  @apply flex items-center gap-2 text-sm;
}

.hex-label {
  @apply font-medium text-gray-700;
}

.hex-value {
  @apply font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded;
}

/* Disabled state */
.color-picker-container.disabled .color-preview {
  @apply opacity-50 cursor-not-allowed;
}

.color-picker-container.disabled .color-preview:hover {
  @apply transform-none shadow-sm;
}
</style>
