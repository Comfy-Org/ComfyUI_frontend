<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { hue } = defineProps<{
  hue: number
}>()

const saturation = defineModel<number>('saturation', { required: true })
const value = defineModel<number>('value', { required: true })

const containerRef = ref<HTMLElement | null>(null)

const hueBackground = computed(() => `hsl(${hue}, 100%, 50%)`)

const handleStyle = computed(() => ({
  left: `${saturation.value}%`,
  top: `${100 - value.value}%`
}))

function updateFromPointer(e: PointerEvent) {
  const el = containerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  saturation.value = Math.round(x * 100)
  value.value = Math.round((1 - y) * 100)
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
    ref="containerRef"
    role="slider"
    :aria-label="t('color.saturationBrightness')"
    :aria-valuetext="`${saturation}%, ${value}%`"
    class="relative aspect-square w-full cursor-crosshair rounded-sm"
    :style="{ backgroundColor: hueBackground, touchAction: 'none' }"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
  >
    <div
      class="absolute inset-0 rounded-sm bg-linear-to-r from-white to-transparent"
    />
    <div
      class="absolute inset-0 rounded-sm bg-linear-to-b from-transparent to-black"
    />
    <div
      class="pointer-events-none absolute size-3.5 -translate-1/2 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.6)]"
      :style="handleStyle"
    />
  </div>
</template>
