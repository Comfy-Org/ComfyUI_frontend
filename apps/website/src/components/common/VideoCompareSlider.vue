<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener, useMounted } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
import type { HTMLAttributes } from 'vue'

import {
  COMPARE_MAX,
  COMPARE_MIN,
  positionFromPointer,
  stepPosition
} from './videoCompare'

const SYNC_TOLERANCE_S = 0.15

const {
  beforeSrc,
  afterSrc,
  beforeLabel,
  afterLabel,
  sliderLabel,
  class: className
} = defineProps<{
  beforeSrc: string
  afterSrc: string
  beforeLabel: string
  afterLabel: string
  sliderLabel: string
  class?: HTMLAttributes['class']
}>()

const position = defineModel<number>('position', { default: 50 })

const container = useTemplateRef<HTMLElement>('container')
const beforeVideo = useTemplateRef<HTMLVideoElement>('beforeVideo')
const afterVideo = useTemplateRef<HTMLVideoElement>('afterVideo')
const isDragging = ref(false)
// Server markup carries no clip sources, so nothing downloads until the
// island hydrates, which with client:visible is when it scrolls into view.
const isMounted = useMounted()

function moveTo(clientX: number) {
  const bounds = container.value?.getBoundingClientRect()
  if (!bounds) return
  position.value = positionFromPointer(clientX, bounds)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  isDragging.value = true
  moveTo(event.clientX)
}

useEventListener('pointermove', (event) => {
  if (!isDragging.value) return
  if (event.buttons === 0) {
    isDragging.value = false
    return
  }
  moveTo(event.clientX)
})
useEventListener(['pointerup', 'pointercancel'], () => {
  isDragging.value = false
})

function onKeyDown(event: KeyboardEvent) {
  const next = stepPosition(position.value, event.key, event.shiftKey)
  if (next === undefined) return
  event.preventDefault()
  position.value = next
}

function syncAfterToBefore() {
  const before = beforeVideo.value
  const after = afterVideo.value
  if (!before || !after) return
  if (Math.abs(after.currentTime - before.currentTime) > SYNC_TOLERANCE_S) {
    after.currentTime = before.currentTime
  }
}
</script>

<template>
  <div
    ref="container"
    data-testid="video-compare-surface"
    :class="
      cn(
        'relative isolate aspect-video w-full cursor-ew-resize touch-pan-y overflow-hidden bg-primary-comfy-ink select-none',
        className
      )
    "
    @pointerdown="onPointerDown"
  >
    <video
      ref="beforeVideo"
      :key="beforeSrc"
      data-testid="video-compare-before"
      :src="isMounted ? beforeSrc : undefined"
      autoplay
      loop
      muted
      playsinline
      aria-hidden="true"
      class="absolute inset-0 size-full object-cover"
      @timeupdate="syncAfterToBefore"
    />
    <video
      ref="afterVideo"
      :key="afterSrc"
      data-testid="video-compare-after"
      :src="isMounted ? afterSrc : undefined"
      autoplay
      loop
      muted
      playsinline
      aria-hidden="true"
      class="absolute inset-0 size-full object-cover"
      :style="{ clipPath: `inset(0 0 0 ${position}%)` }"
    />

    <span
      class="pointer-events-none absolute top-4 left-4 rounded-full bg-transparency-ink-t80 px-3 py-1 text-xs font-bold tracking-wide text-primary-warm-white uppercase"
    >
      {{ beforeLabel }}
    </span>
    <span
      class="pointer-events-none absolute top-4 right-4 rounded-full bg-transparency-ink-t80 px-3 py-1 text-xs font-bold tracking-wide text-primary-warm-white uppercase"
    >
      {{ afterLabel }}
    </span>

    <div
      role="slider"
      tabindex="0"
      :aria-label="sliderLabel"
      :aria-valuemin="COMPARE_MIN"
      :aria-valuemax="COMPARE_MAX"
      :aria-valuenow="Math.round(position)"
      :aria-valuetext="`${Math.round(position)}%`"
      class="absolute inset-y-0 w-0.5 -translate-x-1/2 touch-none bg-primary-warm-white outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow"
      :style="{ left: `${position}%` }"
      @keydown="onKeyDown"
    >
      <span
        class="absolute top-1/2 left-1/2 flex size-9 -translate-1/2 items-center justify-center rounded-full bg-primary-warm-white text-primary-comfy-ink shadow-lg"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
        >
          <path d="M8 12H16M8 12L11 9M8 12L11 15M16 12L13 9M16 12L13 15" />
        </svg>
      </span>
    </div>
  </div>
</template>
