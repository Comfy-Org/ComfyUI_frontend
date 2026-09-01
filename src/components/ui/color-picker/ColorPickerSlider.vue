<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { hsbToRgb, rgbToHex } from '@/utils/colorUtil'

const { t } = useI18n()

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
</script>

<template>
  <div
    role="slider"
    :aria-label="type === 'hue' ? t('color.hue') : t('color.alpha')"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    class="relative flex h-4 cursor-pointer items-center rounded-full p-px"
    :style="containerStyle"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
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
