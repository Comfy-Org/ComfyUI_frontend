<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  labels,
  dimmed = false
} = defineProps<{
  label: string
  labels: { expand: string; collapse: string }
  /** Fades the panel on wide screens and tucks the sheet away on phones. */
  dimmed?: boolean
}>()

const wide = useMediaQuery('(min-width: 1024px)')
const expanded = ref(false)
let swipeFrom: number | undefined
let swiped = false

function grab(event: PointerEvent) {
  swipeFrom = event.clientY
  swiped = false
}

function release(event: PointerEvent) {
  if (swipeFrom === undefined) return
  const distance = event.clientY - swipeFrom
  swipeFrom = undefined
  if (Math.abs(distance) < 24) return
  swiped = true
  expanded.value = distance < 0
}

function toggle() {
  if (!swiped) expanded.value = !expanded.value
  swiped = false
}
</script>

<template>
  <aside
    :aria-label="label"
    :class="
      cn(
        'pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex max-h-[80%] flex-col rounded-t-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light/90 shadow-2xl shadow-black/50 backdrop-blur-xl transition-opacity lg:inset-x-auto lg:top-3 lg:bottom-3 lg:left-3 lg:max-h-none lg:w-80 lg:rounded-2xl',
        dimmed && 'pointer-events-none opacity-40 max-lg:hidden'
      )
    "
  >
    <div
      v-if="$slots.above && !expanded"
      class="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 justify-center"
    >
      <slot name="above" />
    </div>
    <button
      v-if="!wide"
      type="button"
      :aria-expanded="expanded"
      :aria-label="expanded ? labels.collapse : labels.expand"
      class="flex h-6 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-none"
      @pointerdown="grab"
      @pointerup="release"
      @click="toggle"
    >
      <span class="h-1 w-10 rounded-full bg-transparency-white-t20" />
    </button>
    <div
      v-if="wide || expanded"
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 lg:pt-2"
    >
      <slot />
    </div>
    <div v-else class="px-3">
      <slot name="peek" />
    </div>
    <div v-if="$slots.footer" class="shrink-0 p-3">
      <slot name="footer" />
    </div>
  </aside>
</template>
