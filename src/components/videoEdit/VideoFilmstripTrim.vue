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
      :aria-label="isPlaying ? t('videoEdit.pause') : t('videoEdit.play')"
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
          disabled || totalFrames <= 1
            ? 'cursor-default'
            : isScrubDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
        )
      "
      role="slider"
      :tabindex="disabled || totalFrames <= 1 ? -1 : 0"
      :aria-valuemin="scrubMinFrame"
      :aria-valuemax="scrubMaxFrame"
      :aria-valuenow="playheadFrame"
      :aria-label="t('videoEdit.seekVideo')"
      @pointerdown.stop="startScrubDrag"
      @keydown="handleTrackKeydown"
      @contextmenu.prevent.stop
    >
      <span v-if="isFilmstripLoading" role="status" class="sr-only">
        {{ t('videoEdit.loadingFilmstrip') }}
      </span>
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
        v-if="activeHandle === 'min' || activeHandle === 'max'"
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
          class="h-full min-w-0 flex-1 object-cover select-none"
        />
        <div
          v-if="isFilmstripLoading"
          class="flex size-full items-stretch gap-px overflow-hidden"
          data-testid="filmstrip-skeleton"
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
              'pointer-events-auto flex shrink-0 cursor-ew-resize',
              'items-center justify-center bg-video-trim-selection-background',
              'rounded-l-lg border-none p-0'
            )
          "
          :style="{ width: `${HANDLE_WIDTH_PX}px` }"
          :aria-label="t('videoEdit.adjustStartFrame')"
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
              'pointer-events-auto flex shrink-0 cursor-ew-resize',
              'items-center justify-center bg-video-trim-selection-background',
              'rounded-r-lg border-none p-0'
            )
          "
          :style="{ width: `${HANDLE_WIDTH_PX}px` }"
          :aria-label="t('videoEdit.adjustEndFrame')"
          @pointerdown.stop="startDrag('max', $event)"
        >
          <span class="h-4 w-px rounded-full bg-secondary-background" />
        </button>
      </div>

      <div
        data-testid="playhead"
        :class="
          cn(
            'absolute top-2 z-20 flex h-12 w-3 -translate-x-1/2 touch-none items-stretch justify-center',
            isScrubDragging ? 'cursor-grabbing' : 'cursor-grab'
          )
        "
        :style="playheadStyle"
        @pointerdown.stop="startScrubDrag"
      >
        <div
          class="pointer-events-none flex w-1.5 items-center justify-center rounded-full bg-video-trim-playhead-background"
        >
          <span class="h-4 w-px rounded-full bg-secondary-background" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useRangeEditor } from '@/composables/useRangeEditor'
import { useTimelineScrub } from '@/composables/video/useTimelineScrub'
import { FILMSTRIP_SAMPLE_COUNT } from '@/composables/video/useVideoFilmstrip'
import type { RangeValue } from '@/lib/litegraph/src/types/widgets'
import { cn } from '@comfyorg/tailwind-utils'

const HANDLE_WIDTH_PX = 16
const TRACK_CONTENT_SPAN = `(100% - ${HANDLE_WIDTH_PX * 2}px)`

function timelineInsetLeftStyle(normalized: number) {
  return {
    left: `calc(${normalized} * ${TRACK_CONTENT_SPAN} + ${HANDLE_WIDTH_PX}px)`
  }
}

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
  contentInsetX,
  handleCenterOffsetX: toRef(() => HANDLE_WIDTH_PX / 2)
})

const scrubMinFrame = computed(() => (trimEnabled ? startFrame.value : 0))
const scrubMaxFrame = computed(() =>
  trimEnabled ? endFrame.value : frameMax.value
)

const { isScrubDragging, startScrubDrag, scrubToFrame } = useTimelineScrub(
  playheadFrame,
  {
    trackRef,
    frameMax,
    scrubMin: scrubMinFrame,
    scrubMax: scrubMaxFrame,
    contentInsetX: HANDLE_WIDTH_PX,
    isDisabled: () => disabled || totalFrames <= 1,
    onScrub: (frame) => emit('scrub', frame)
  }
)

function handleTrackKeydown(event: KeyboardEvent) {
  if (disabled || totalFrames <= 1) return
  const seekTargets: Record<string, number> = {
    ArrowLeft: playheadFrame.value - 1,
    ArrowDown: playheadFrame.value - 1,
    ArrowRight: playheadFrame.value + 1,
    ArrowUp: playheadFrame.value + 1,
    Home: scrubMinFrame.value,
    End: scrubMaxFrame.value
  }
  const target = seekTargets[event.key]
  if (target === undefined) return
  event.preventDefault()
  scrubToFrame(target)
}

const isFilmstripLoading = computed(() => thumbnails.length === 0)

const trimSelectionBarClass = computed(() =>
  isFilmstripLoading.value
    ? 'bg-component-node-widget-background'
    : 'bg-video-trim-selection-background'
)

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
  width: `calc(${startNorm.value} * ${TRACK_CONTENT_SPAN})`
}))

const rightDimStyle = computed(() => ({
  width: `calc(${1 - endNorm.value} * ${TRACK_CONTENT_SPAN})`
}))

const selectionStyle = computed(() => ({
  left: `calc(${startNorm.value} * ${TRACK_CONTENT_SPAN})`,
  width: `calc((${endNorm.value} - ${startNorm.value}) * ${TRACK_CONTENT_SPAN} + ${HANDLE_WIDTH_PX * 2}px)`
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
