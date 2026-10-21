<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import {
  COMPARE_MAX,
  COMPARE_MIN,
  positionFromPointer,
  stepPosition
} from '@/components/common/videoCompare'
import type { ThumbnailVariant } from '@/lib/hub/types'

const { primaryUrl, secondaryUrl, variant, title } = defineProps<{
  primaryUrl: string
  secondaryUrl?: string
  variant?: ThumbnailVariant
  title: string
}>()

const compareRoot = useTemplateRef<HTMLElement>('compareRoot')
const comparePosition = ref(50)

useEventListener(compareRoot, 'pointermove', (event: PointerEvent) => {
  if (!compareRoot.value) return
  comparePosition.value = positionFromPointer(
    event.clientX,
    compareRoot.value.getBoundingClientRect()
  )
})

function onCompareKeydown(event: KeyboardEvent) {
  const next = stepPosition(comparePosition.value, event.key, event.shiftKey)
  if (next === undefined) return
  event.preventDefault()
  comparePosition.value = next
}
</script>

<template>
  <div
    v-if="variant === 'compareSlider' && secondaryUrl"
    ref="compareRoot"
    class="relative size-full touch-pan-y overflow-hidden"
  >
    <img
      :src="primaryUrl"
      :alt="`${title} - After`"
      loading="lazy"
      decoding="async"
      draggable="false"
      class="size-full object-cover select-none"
    />
    <div
      class="absolute inset-0 overflow-hidden"
      :style="{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }"
    >
      <img
        :src="secondaryUrl"
        :alt="`${title} - Before`"
        loading="lazy"
        decoding="async"
        draggable="false"
        class="size-full object-cover select-none"
      />
    </div>
    <div
      class="absolute inset-y-0 w-1 cursor-ew-resize bg-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow"
      :style="{ left: `${comparePosition}%` }"
      role="slider"
      tabindex="0"
      :aria-label="`${title} image comparison`"
      aria-orientation="horizontal"
      :aria-valuemin="COMPARE_MIN"
      :aria-valuemax="COMPARE_MAX"
      :aria-valuenow="Math.round(comparePosition)"
      :aria-valuetext="`${Math.round(comparePosition)}%`"
      @click.stop.prevent
      @keydown="onCompareKeydown"
    />
  </div>
  <div
    v-else-if="variant === 'hoverDissolve' && secondaryUrl"
    class="group/thumb relative size-full overflow-hidden"
  >
    <img
      :src="primaryUrl"
      :alt="`${title} - 1`"
      loading="lazy"
      decoding="async"
      draggable="false"
      class="size-full object-cover transition-opacity duration-500 select-none"
    />
    <img
      :src="secondaryUrl"
      :alt="`${title} - 2`"
      loading="lazy"
      decoding="async"
      draggable="false"
      class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 select-none group-hover/thumb:opacity-100"
    />
  </div>
  <img
    v-else
    :src="primaryUrl"
    :alt="title"
    loading="lazy"
    decoding="async"
    draggable="false"
    :class="
      cn(
        'size-full object-cover transition-transform select-none',
        variant === 'zoomHover' || variant === 'hoverZoom'
          ? 'duration-500 group-hover:scale-125'
          : 'duration-300 group-hover:scale-105'
      )
    "
  />
</template>
