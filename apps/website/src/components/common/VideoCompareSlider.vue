<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener, useMediaQuery, useMounted } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import type { HTMLAttributes } from 'vue'

import { useComparisonPlayback } from './useComparisonPlayback'
import type { ComparisonPlaybackState } from './useComparisonPlayback'

import { prefersReducedMotion } from '@/composables/useReducedMotion'

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
  mediaKind = 'video',
  synchronizedPlayback = false,
  followPointerOnHover = false,
  fit = 'cover',
  comparisonStyle = 'default',
  beforePosterSrc,
  afterPosterSrc,
  beforeLabel,
  afterLabel,
  sliderLabel,
  class: className
} = defineProps<{
  beforeSrc: string
  afterSrc: string
  mediaKind?: 'video' | 'image'
  synchronizedPlayback?: boolean
  followPointerOnHover?: boolean
  fit?: 'cover' | 'contain'
  comparisonStyle?: 'default' | 'workflow'
  beforePosterSrc?: string
  afterPosterSrc?: string
  beforeLabel: string
  afterLabel: string
  sliderLabel: string
  class?: HTMLAttributes['class']
}>()

const mediaClass = computed(() =>
  cn(
    'absolute inset-0 size-full',
    fit === 'contain' ? 'bg-primary-comfy-ink object-contain' : 'object-cover'
  )
)

const position = defineModel<number>('position', { default: 50 })
const time = defineModel<number>('time', { default: 0 })
const paused = defineModel<boolean>('paused', { default: false })
const emit = defineEmits<{ playbackState: [state: ComparisonPlaybackState] }>()

const container = useTemplateRef<HTMLElement>('container')
const beforeVideo = useTemplateRef<HTMLVideoElement>('beforeVideo')
const afterVideo = useTemplateRef<HTMLVideoElement>('afterVideo')
const isDragging = ref(false)
const canHover = useMediaQuery('(any-hover: hover) and (any-pointer: fine)')
const isMounted = useMounted()
const shouldAutoplay = computed(
  () => isMounted.value && !synchronizedPlayback && !prefersReducedMotion()
)

const { state: playbackState, hasBeenVisible } = useComparisonPlayback({
  enabled: () => synchronizedPlayback && mediaKind === 'video',
  beforeSrc: () => beforeSrc,
  afterSrc: () => afterSrc,
  container,
  before: beforeVideo,
  after: afterVideo,
  paused,
  time
})
const loadVideoSources = computed(
  () => isMounted.value && (!synchronizedPlayback || hasBeenVisible.value)
)
const videoPreload = computed(() =>
  synchronizedPlayback && hasBeenVisible.value ? 'auto' : 'none'
)
watch(playbackState, (state) => emit('playbackState', state), {
  immediate: true
})

function moveTo(clientX: number) {
  const bounds = container.value?.getBoundingClientRect()
  if (!bounds) return
  position.value = positionFromPointer(clientX, bounds)
}

function onPointerHover(event: PointerEvent) {
  if (
    !followPointerOnHover ||
    !canHover.value ||
    event.pointerType !== 'mouse' ||
    event.buttons !== 0 ||
    isDragging.value
  )
    return
  moveTo(event.clientX)
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
  if (synchronizedPlayback) return
  const before = beforeVideo.value
  const after = afterVideo.value
  if (!before || !after) return
  if (!before.paused && after.paused) void after.play().catch(() => undefined)
  if (Math.abs(after.currentTime - before.currentTime) > SYNC_TOLERANCE_S) {
    after.currentTime = before.currentTime
  }
}
</script>

<template>
  <div
    ref="container"
    data-testid="video-compare-surface"
    :data-synchronized-comparison="synchronizedPlayback ? '' : undefined"
    :data-playback-group="synchronizedPlayback ? '' : undefined"
    :class="
      cn(
        'relative isolate aspect-video w-full cursor-ew-resize touch-pan-y overflow-hidden bg-primary-comfy-ink select-none',
        className
      )
    "
    @pointerdown="onPointerDown"
    @pointermove="onPointerHover"
  >
    <img
      v-if="mediaKind === 'image'"
      :src="beforeSrc"
      :alt="beforeLabel"
      loading="lazy"
      decoding="async"
      :class="mediaClass"
    />
    <video
      v-else
      ref="beforeVideo"
      :key="beforeSrc"
      data-testid="video-compare-before"
      :src="loadVideoSources ? beforeSrc : undefined"
      :poster="beforePosterSrc"
      :preload="videoPreload"
      :autoplay="shouldAutoplay"
      loop
      muted
      playsinline
      aria-hidden="true"
      :class="mediaClass"
      @timeupdate="syncAfterToBefore"
    />
    <img
      v-if="mediaKind === 'image'"
      :src="afterSrc"
      :alt="afterLabel"
      loading="lazy"
      decoding="async"
      :class="mediaClass"
      :style="{ clipPath: `inset(0 0 0 ${position}%)` }"
    />
    <video
      v-else
      ref="afterVideo"
      :key="afterSrc"
      data-testid="video-compare-after"
      :src="loadVideoSources ? afterSrc : undefined"
      :poster="afterPosterSrc"
      :preload="videoPreload"
      :autoplay="shouldAutoplay"
      loop
      muted
      playsinline
      aria-hidden="true"
      :class="mediaClass"
      :style="{ clipPath: `inset(0 0 0 ${position}%)` }"
    />

    <span
      class="pointer-events-none absolute top-4 left-4 z-10 rounded-full bg-transparency-ink-t80 px-3 py-1 text-xs font-bold tracking-wide text-primary-warm-white uppercase"
    >
      {{ beforeLabel }}
    </span>
    <span
      class="pointer-events-none absolute top-4 right-4 z-10 rounded-full bg-transparency-ink-t80 px-3 py-1 text-xs font-bold tracking-wide text-primary-warm-white uppercase"
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
      :class="
        cn(
          'absolute inset-y-0 touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow',
          comparisonStyle === 'workflow'
            ? 'w-1 cursor-ew-resize bg-white shadow-lg'
            : 'w-0.5 -translate-x-1/2 bg-primary-warm-white'
        )
      "
      :style="{ left: `${position}%` }"
      @keydown="onKeyDown"
    >
      <span
        v-if="comparisonStyle !== 'workflow'"
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
