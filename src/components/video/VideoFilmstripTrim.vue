<template>
  <div class="flex h-16 w-full items-stretch gap-px" @pointerdown.stop>
    <button
      type="button"
      :class="
        cn(
          'flex w-14 shrink-0 items-center justify-center rounded-l-lg border-none bg-component-node-widget-background px-4 text-muted-foreground',
          !disabled &&
            'cursor-pointer hover:bg-component-node-widget-background-hovered',
          disabled && 'cursor-default opacity-50'
        )
      "
      :disabled="disabled"
      :aria-label="
        isPlaying ? t('loadVideoTrim.pause') : t('loadVideoTrim.play')
      "
      @click="togglePlay"
    >
      <i
        :class="
          cn(
            isPlaying ? 'icon-[lucide--pause]' : 'icon-[lucide--play]',
            !isPlaying && 'ml-0.5',
            'size-5'
          )
        "
      />
    </button>

    <div
      ref="trackRef"
      data-testid="trim-track"
      :class="
        cn(
          'relative min-w-0 flex-1 rounded-r-lg bg-component-node-widget-background',
          isDraggingTimeline ? 'cursor-ew-resize' : 'cursor-default'
        )
      "
      @pointerdown.stop="startScrubDrag"
      @contextmenu.prevent.stop
    >
      <div
        v-if="isScrubDragging"
        data-testid="scrub-tooltip"
        class="pointer-events-none absolute bottom-full z-30 mb-1 flex -translate-x-1/2 flex-col items-center"
        :style="playheadStyle"
      >
        <span
          class="rounded-lg bg-interface-menu-surface px-2.5 py-1 text-sm font-semibold text-base-foreground tabular-nums"
        >
          {{ playheadFrame }}
        </span>
        <span
          class="size-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-interface-menu-surface"
        />
      </div>

      <div
        v-if="trimEnabled && (activeHandle === 'min' || activeHandle === 'max')"
        data-testid="trim-handle-tooltip"
        class="pointer-events-none absolute bottom-full z-10 mb-1 flex -translate-x-1/2 flex-col items-center"
        :style="activeHandleTooltipStyle"
      >
        <span
          class="rounded-lg bg-interface-menu-surface px-2.5 py-1 text-sm font-semibold text-base-foreground tabular-nums"
        >
          {{ activeHandleFrame }}
        </span>
        <span
          class="size-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-interface-menu-surface"
        />
      </div>

      <div
        data-testid="filmstrip-track"
        class="pointer-events-none absolute top-2 flex h-12 items-stretch overflow-hidden"
        :style="{
          left: `${HANDLE_WIDTH_PX}px`,
          right: `${HANDLE_WIDTH_PX}px`
        }"
        aria-hidden="true"
      >
        <img
          v-for="(thumbnail, index) in thumbnails"
          :key="index"
          data-testid="filmstrip-thumbnail"
          :src="thumbnail"
          alt=""
          draggable="false"
          class="h-full w-auto shrink-0 select-none"
        />
        <div
          v-if="isFilmstripLoading"
          class="flex size-full items-stretch gap-px overflow-hidden"
          data-testid="filmstrip-skeleton"
          :aria-busy="true"
          :aria-label="t('loadVideoTrim.loadingFilmstrip')"
        >
          <Skeleton
            v-for="index in FILMSTRIP_SAMPLE_COUNT"
            :key="index"
            class="h-full min-w-10 flex-1 rounded-none"
          />
        </div>
      </div>

      <div
        v-if="trimEnabled && startNorm > 0"
        class="pointer-events-none absolute inset-y-0 left-0 bg-black/50"
        :style="leftDimStyle"
      />
      <div
        v-if="trimEnabled && endNorm < 1"
        class="pointer-events-none absolute inset-y-0 right-0 bg-black/50"
        :style="rightDimStyle"
      />

      <div
        v-if="trimEnabled"
        class="pointer-events-none absolute inset-y-0 flex"
        :style="selectionStyle"
      >
        <button
          v-if="!disabled && totalFrames > 1"
          type="button"
          data-testid="handle-start"
          :class="
            cn(
              'pointer-events-auto flex w-4 shrink-0 cursor-ew-resize',
              'items-center justify-center bg-video-trim-selection-background',
              'rounded-l-lg border-none p-0'
            )
          "
          :aria-label="t('loadVideoTrim.adjustStartFrame')"
          @pointerdown.stop="startDrag('min', $event)"
        >
          <span class="h-4 w-px rounded-full bg-secondary-background" />
        </button>

        <div class="flex min-w-0 flex-1 flex-col">
          <div :class="cn('h-2 shrink-0', trimSelectionBarClass)" />
          <div class="h-12 shrink-0" />
          <div :class="cn('h-2 shrink-0', trimSelectionBarClass)" />
        </div>

        <button
          v-if="!disabled && totalFrames > 1"
          type="button"
          data-testid="handle-end"
          :class="
            cn(
              'pointer-events-auto flex w-4 shrink-0 cursor-ew-resize',
              'items-center justify-center bg-video-trim-selection-background',
              'rounded-r-lg border-none p-0'
            )
          "
          :aria-label="t('loadVideoTrim.adjustEndFrame')"
          @pointerdown.stop="startDrag('max', $event)"
        >
          <span class="h-4 w-px rounded-full bg-secondary-background" />
        </button>
      </div>

      <div
        data-testid="playhead"
        class="absolute top-2 z-20 flex h-12 w-3 -translate-x-1/2 cursor-ew-resize touch-none items-stretch justify-center"
        :style="playheadStyle"
        @pointerdown.stop="startScrubDrag"
      >
        <div
          class="pointer-events-none w-0.5 bg-video-trim-playhead-background"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { clamp } from 'es-toolkit'

import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { timelineInsetLeftStyle } from '@/components/video/timelineInsetStyle'
import { FILMSTRIP_SAMPLE_COUNT } from '@/composables/video/useVideoFilmstrip'
import { useRangeEditor } from '@/composables/useRangeEditor'
import type { RangeValue } from '@/lib/litegraph/src/types/widgets'
import { denormalize } from '@/utils/mathUtil'
import { cn } from '@comfyorg/tailwind-utils'

const HANDLE_WIDTH_PX = 16

const {
  totalFrames,
  thumbnails,
  disabled = false,
  trimEnabled = true
} = defineProps<{
  totalFrames: number
  thumbnails: string[]
  disabled?: boolean
  trimEnabled?: boolean
}>()

const startFrame = defineModel<number>('startFrame', { required: true })
const endFrame = defineModel<number>('endFrame', { required: true })
const playheadFrame = defineModel<number>('playheadFrame', { required: true })
const isPlaying = defineModel<boolean>('isPlaying', { default: false })

const emit = defineEmits<{
  scrub: [frame: number]
}>()

const { t } = useI18n()

const trackRef = useTemplateRef<HTMLDivElement>('trackRef')
const isScrubDragging = ref(false)
const frameMax = computed(() => Math.max(totalFrames - 1, 0))

const rangeValue = computed<RangeValue>({
  get: () => ({
    min: startFrame.value,
    max: endFrame.value
  }),
  set: (value) => {
    startFrame.value = Math.round(value.min)
    endFrame.value = Math.round(value.max)
  }
})

const contentInsetX = computed(() => HANDLE_WIDTH_PX)

const { startDrag, activeHandle } = useRangeEditor({
  trackRef,
  modelValue: rangeValue,
  valueMin: toRef(() => 0),
  valueMax: frameMax,
  showMidpoint: toRef(() => false),
  contentInsetX
})

const isDraggingTimeline = computed(
  () => isScrubDragging.value || activeHandle.value !== null
)

const isFilmstripLoading = computed(() => thumbnails.length === 0)

const trimSelectionBarClass = computed(() =>
  isFilmstripLoading.value
    ? 'bg-component-node-widget-background'
    : 'bg-video-trim-selection-background'
)

function pointerToFrame(event: PointerEvent) {
  const el = trackRef.value
  if (!el) return playheadFrame.value
  const rect = el.getBoundingClientRect()
  const inset = HANDLE_WIDTH_PX
  const contentWidth = Math.max(rect.width - 2 * inset, 1)
  const normalized = clamp(
    (event.clientX - rect.left - inset) / contentWidth,
    0,
    1
  )
  return Math.round(denormalize(normalized, 0, frameMax.value))
}

const scrubFrameMin = computed(() => (trimEnabled ? startFrame.value : 0))
const scrubFrameMax = computed(() =>
  trimEnabled ? endFrame.value : frameMax.value
)

function scrubToFrame(frame: number) {
  const clamped = clamp(frame, scrubFrameMin.value, scrubFrameMax.value)
  playheadFrame.value = clamped
  emit('scrub', clamped)
}

function updateScrubFromPointer(event: PointerEvent) {
  const frame = pointerToFrame(event)
  if (frame === playheadFrame.value) return
  scrubToFrame(frame)
}

let cleanupScrubDrag: (() => void) | null = null

function startScrubDrag(event: PointerEvent) {
  if (disabled || totalFrames <= 1 || event.button !== 0) return

  const el = trackRef.value
  if (!el) return

  cleanupScrubDrag?.()

  isScrubDragging.value = true
  scrubToFrame(pointerToFrame(event))
  el.setPointerCapture(event.pointerId)

  const onMove = (moveEvent: PointerEvent) => {
    updateScrubFromPointer(moveEvent)
  }

  const endDrag = () => {
    isScrubDragging.value = false
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', endDrag)
    el.removeEventListener('lostpointercapture', endDrag)
    cleanupScrubDrag = null
  }

  cleanupScrubDrag = endDrag

  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('lostpointercapture', endDrag)
}

onBeforeUnmount(() => {
  isScrubDragging.value = false
  cleanupScrubDrag?.()
})

const startNorm = computed(() =>
  frameMax.value <= 0 ? 0 : startFrame.value / frameMax.value
)
const endNorm = computed(() =>
  frameMax.value <= 0 ? 1 : endFrame.value / frameMax.value
)

const playheadNorm = computed(() =>
  frameMax.value <= 0 ? 0 : playheadFrame.value / frameMax.value
)

const playheadStyle = computed(() => timelineInsetLeftStyle(playheadNorm.value))

const leftDimStyle = computed(() => ({
  width: `calc(${startNorm.value} * (100% - 2rem))`
}))

const rightDimStyle = computed(() => ({
  width: `calc(${1 - endNorm.value} * (100% - 2rem))`
}))

const selectionStyle = computed(() => ({
  left: `calc(${startNorm.value} * (100% - 2rem))`,
  width: `calc((${endNorm.value} - ${startNorm.value}) * (100% - 2rem) + 2rem)`
}))

const activeHandleFrame = computed(() => {
  if (activeHandle.value === 'min') return startFrame.value
  if (activeHandle.value === 'max') return endFrame.value
  return 0
})

const activeHandleTooltipStyle = computed(() => {
  const norm = activeHandle.value === 'min' ? startNorm.value : endNorm.value
  return timelineInsetLeftStyle(norm)
})

function togglePlay() {
  if (disabled) return
  isPlaying.value = !isPlaying.value
}
</script>
