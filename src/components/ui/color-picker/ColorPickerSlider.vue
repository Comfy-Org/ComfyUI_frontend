<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { hsbToRgb, rgbToHex } from '@/utils/colorUtil'

const {
  type,
  hue = 0,
  saturation = 100,
  brightness = 100
} = defineProps<{
  type: 'hue' | 'alpha'
  hue?: number
  saturation?: number
  brightness?: number
}>()

const modelValue = defineModel<number>({ required: true })

const { t } = useI18n()

const max = computed(() => (type === 'hue' ? 360 : 100))

const fraction = computed(() => modelValue.value / max.value)

const trackBackground = computed(() => {
  if (type === 'hue') {
    return 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
  }
  const rgb = hsbToRgb({ h: hue, s: saturation, b: brightness })
  const hex = rgbToHex(rgb)
  return `linear-gradient(to right, transparent, ${hex})`
})

const containerStyle = computed(() => {
  if (type === 'alpha') {
    return {
      backgroundImage:
        'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%)',
      backgroundSize: '8px 8px',
      touchAction: 'none'
    }
  }
  return {
    background: trackBackground.value,
    touchAction: 'none'
  }
})

const ariaLabel = computed(() =>
  type === 'hue' ? t('colorPicker.hue') : t('colorPicker.alpha')
)

function clamp(v: number, min: number, maxVal: number) {
  return Math.max(min, Math.min(maxVal, v))
}

function updateFromPointer(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  modelValue.value = Math.round(x * max.value)
}

function handlePointerDown(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  updateFromPointer(e)
}

function handlePointerMove(e: PointerEvent) {
  if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return
  updateFromPointer(e)
}

function handleKeydown(e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 1
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      modelValue.value = clamp(modelValue.value - step, 0, max.value)
      break
    case 'ArrowRight':
      e.preventDefault()
      modelValue.value = clamp(modelValue.value + step, 0, max.value)
      break
  }
}
</script>

<template>
  <div
    role="slider"
    tabindex="0"
    :aria-label="ariaLabel"
    :aria-valuenow="modelValue"
    :aria-valuemin="0"
    :aria-valuemax="max"
    class="relative flex h-4 cursor-pointer items-center rounded-full p-px outline-none focus-visible:ring-2 focus-visible:ring-highlight"
    :style="containerStyle"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @keydown="handleKeydown"
  >
    <div
      v-if="type === 'alpha'"
      class="absolute inset-0 rounded-full"
      :style="{ background: trackBackground }"
    />
    <div
      class="pointer-events-none absolute aspect-square h-full -translate-x-1/2 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.6)]"
      :style="{ left: `${fraction * 100}%` }"
    />
  </div>
</template>
