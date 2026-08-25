<template>
  <div
    ref="root"
    class="relative touch-none overflow-hidden select-none"
    role="group"
    :aria-label="label"
  >
    <video
      ref="baseVideo"
      :src="baseSrc"
      class="pointer-events-none absolute inset-0 size-full object-cover"
      :muted="baseMuted"
      :autoplay="motionAllowed"
      loop
      playsinline
      aria-hidden="true"
      data-testid="compare-clip"
    />

    <div
      class="absolute inset-0 overflow-hidden"
      :style="{ clipPath: `inset(0 ${100 - position}% 0 0)` }"
    >
      <video
        ref="overlayVideo"
        :src="overlaySrc"
        class="pointer-events-none absolute inset-0 size-full object-cover"
        :muted="overlayMuted"
        :autoplay="motionAllowed"
        loop
        playsinline
        aria-hidden="true"
        data-testid="compare-clip"
      />
    </div>

    <div
      class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-white"
      :style="{ left: `${position}%` }"
      role="slider"
      tabindex="0"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(position)"
      @keydown="onKeydown"
    >
      <span
        class="absolute top-1/2 left-1/2 flex size-6 -translate-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm"
      >
        <i
          class="icon-[lucide--chevrons-left-right] size-3.5 text-black"
          aria-hidden="true"
        />
      </span>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { usePreferredReducedMotion, useEventListener } from '@vueuse/core'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

const {
  baseSrc,
  overlaySrc,
  label,
  baseMuted = true,
  overlayMuted = true,
  startPosition = 50
} = defineProps<{
  baseSrc: string
  overlaySrc: string
  label: string
  baseMuted?: boolean
  overlayMuted?: boolean
  startPosition?: number
}>()

const root = useTemplateRef<HTMLElement>('root')
const baseVideo = useTemplateRef<HTMLVideoElement>('baseVideo')
const overlayVideo = useTemplateRef<HTMLVideoElement>('overlayVideo')

/** Handle position as a 0–100 percentage from the left edge. */
const position = ref(startPosition)

function setPosition(value: number) {
  position.value = Math.max(0, Math.min(100, value))
}

function positionFromPointer(event: PointerEvent) {
  const el = root.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width === 0) return
  setPosition(((event.clientX - rect.left) / rect.width) * 100)
}

const isDragging = ref(false)

useEventListener(root, 'pointerdown', (event: PointerEvent) => {
  // Overlay controls (mute, close) live in the slot on top of the videos;
  // a press on one must click it, not start a compare drag.
  if ((event.target as HTMLElement).closest('button')) return
  isDragging.value = true
  root.value?.setPointerCapture(event.pointerId)
  positionFromPointer(event)
})

useEventListener(root, 'pointermove', (event: PointerEvent) => {
  if (isDragging.value) positionFromPointer(event)
})

function endDrag(event: PointerEvent) {
  isDragging.value = false
  root.value?.releasePointerCapture(event.pointerId)
}

useEventListener(root, 'pointerup', endDrag)
useEventListener(root, 'pointercancel', endDrag)

/**
 * Respect the OS "reduce motion" setting: hold both clips on their first frame
 * instead of looping indefinitely, satisfying WCAG 2.2.2 without extra chrome.
 */
const reducedMotion = usePreferredReducedMotion()
const motionAllowed = computed(() => reducedMotion.value !== 'reduce')

watchEffect(() => {
  if (motionAllowed.value) return
  baseVideo.value?.pause()
  overlayVideo.value?.pause()
})

const KEY_STEP = 5

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') setPosition(position.value - KEY_STEP)
  else if (event.key === 'ArrowRight') setPosition(position.value + KEY_STEP)
  else if (event.key === 'Home') setPosition(0)
  else if (event.key === 'End') setPosition(100)
  else return
  event.preventDefault()
}

/** Realigns the overlay clip to the base clip's timeline so they stay in step. */
function syncPlayback() {
  if (baseVideo.value && overlayVideo.value) {
    overlayVideo.value.currentTime = baseVideo.value.currentTime
  }
}

defineExpose({ syncPlayback })
</script>
