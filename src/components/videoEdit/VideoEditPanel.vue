<template>
  <div class="flex flex-col gap-2" @pointerdown.stop>
    <div
      v-if="!videoUrl"
      data-testid="video-edit-empty"
      class="flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-node-stroke bg-node-component-surface p-4 text-center"
    >
      <i class="icon-[lucide--film] size-6 text-muted-foreground" />
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('videoEdit.noVideoSource') }}
      </p>
    </div>
    <div
      v-else
      data-testid="video-preview-container"
      :class="
        cn(
          'overflow-hidden rounded-lg bg-node-component-surface',
          hasCrop && 'p-1.5'
        )
      "
    >
      <div class="relative w-full" :style="videoAspectRatioStyle">
        <video
          ref="videoRef"
          data-testid="video-preview"
          :src="videoUrl"
          :muted="isMuted"
          :controls="isFullscreen"
          class="block size-full object-contain"
          preload="metadata"
          crossorigin="anonymous"
          playsinline
          @loadedmetadata="handleVideoMetadata"
          @timeupdate="handleVideoTimeUpdate"
          @ended="isPlaying = false"
        />
        <VideoCropOverlay
          v-if="hasCrop && !loading && width > 0 && height > 0"
          v-model="cropBounds"
          :source-width="width"
          :source-height="height"
          :locked-ratio="lockedRatio"
        />
        <div
          v-if="loading"
          class="absolute inset-0 flex flex-col items-center justify-center gap-0 bg-node-component-surface"
          data-testid="video-preview-loading"
          :aria-busy="true"
          :aria-label="t('videoEdit.loadingVideo')"
        >
          <Loader size="md" variant="loader-circle" />
          <p class="text-sm text-muted-foreground">
            {{ t('videoEdit.loadingVideo') }}
          </p>
        </div>
        <div
          v-else-if="error"
          class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-node-component-surface"
          data-testid="video-preview-error"
          role="alert"
        >
          <i class="icon-[lucide--video-off] size-6 text-muted-foreground" />
          <p class="m-0 text-sm text-muted-foreground">
            {{
              error === 'canvas-unavailable'
                ? t('videoEdit.canvasUnavailable')
                : t('videoEdit.loadFailed')
            }}
          </p>
          <button
            type="button"
            data-testid="video-preview-retry"
            class="mt-1 cursor-pointer rounded-md border-none bg-component-node-widget-background px-3 py-1 text-sm text-base-foreground hover:bg-component-node-widget-background-hovered"
            @click="emit('retry')"
          >
            {{ t('videoEdit.retry') }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="videoUrl"
      data-testid="video-playback-controls"
      class="flex h-8 items-center gap-2 px-1"
    >
      <button
        type="button"
        data-testid="playback-toggle"
        :class="
          cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-component-node-foreground',
            loading
              ? 'cursor-default opacity-50'
              : 'cursor-pointer hover:bg-component-node-widget-background-hovered'
          )
        "
        :disabled="loading"
        :aria-label="isPlaying ? t('videoEdit.pause') : t('videoEdit.play')"
        @click="isPlaying = !isPlaying"
      >
        <i
          :class="
            cn(
              isPlaying ? 'icon-[lucide--pause]' : 'icon-[lucide--play]',
              'size-4'
            )
          "
        />
      </button>
      <span
        data-testid="playback-timecode"
        class="shrink-0 text-component-node-foreground-secondary tabular-nums"
      >
        {{ timecodeLabel }}
      </span>
      <Slider
        class="min-w-0 flex-1"
        :model-value="[playheadFrame]"
        :min="0"
        :max="Math.max(frameMax, 1)"
        :step="1"
        :disabled="loading || frameMax <= 0"
        :aria-label="t('videoEdit.seekVideo')"
        @update:model-value="handleSliderSeek"
      />
      <button
        type="button"
        data-testid="playback-fullscreen"
        class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-component-node-foreground-secondary hover:bg-component-node-widget-background-hovered"
        :aria-label="t('videoEdit.fullscreen')"
        @click="enterFullscreen"
      >
        <i class="icon-[lucide--maximize] size-4" />
      </button>
      <button
        type="button"
        data-testid="playback-mute"
        class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-component-node-foreground-secondary hover:bg-component-node-widget-background-hovered"
        :aria-label="isMuted ? t('videoEdit.unmute') : t('videoEdit.mute')"
        @click="isMuted = !isMuted"
      >
        <i
          :class="
            cn(
              isMuted ? 'icon-[lucide--volume-x]' : 'icon-[lucide--volume-2]',
              'size-4'
            )
          "
        />
      </button>
    </div>

    <div
      v-if="videoUrl"
      class="grid grid-cols-[minmax(80px,min-content)_minmax(125px,1fr)] gap-1"
    >
      <VideoFilmstripTrim
        v-if="hasTrim"
        v-model:start-frame="startFrame"
        v-model:end-frame="endFrame"
        v-model:playhead-frame="playheadFrame"
        class="col-span-full"
        :total-frames="effectiveTotalFrames"
        :thumbnail="thumbnail"
        :tile-aspect-ratio="
          width > 0 && height > 0 ? width / height : undefined
        "
        :loading="loading"
        @scrub="handleScrub"
      />

      <WidgetInputNumberInput
        v-if="hasTrim"
        v-model="startFrame"
        root-class="col-span-full grid grid-cols-subgrid items-center"
        :widget="startFrameWidget"
      />

      <WidgetInputNumberInput
        v-if="hasTrim"
        v-model="endFrame"
        root-class="col-span-full grid grid-cols-subgrid items-center"
        :widget="endFrameWidget"
      />

      <div v-if="hasCrop" class="col-span-full flex items-center gap-2">
        <label :for="ratioSelectId" class="text-xs text-muted-foreground">
          {{ t('imageCrop.ratio') }}
        </label>
        <Select v-model="selectedRatio" :disabled="!canLockRatio">
          <SelectTrigger :id="ratioSelectId" class="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="key in ratioKeys" :key="key" :value="key">
              {{ key === 'custom' ? t('imageCrop.custom') : key }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon"
          :variant="isLockEnabled ? 'primary' : 'secondary'"
          class="size-7"
          :disabled="!canLockRatio"
          :aria-label="
            isLockEnabled
              ? t('imageCrop.unlockRatio')
              : t('imageCrop.lockRatio')
          "
          @click="isLockEnabled = !isLockEnabled"
        >
          <i
            :class="
              isLockEnabled
                ? 'icon-[lucide--lock] size-3.5'
                : 'icon-[lucide--lock-open] size-3.5'
            "
          />
        </Button>
      </div>

      <WidgetBoundingBox
        v-if="hasCrop"
        v-model="cropBounds"
        class="col-span-full"
        :disabled="loading || width <= 0"
      />

      <div
        class="col-span-full mt-2 grid grid-cols-subgrid gap-y-0.5 border-t border-node-stroke py-2"
      >
        <div
          v-for="row in metadataRows"
          :key="row.label"
          class="col-span-full grid grid-cols-subgrid py-0.5"
        >
          <span class="truncate text-node-component-slot-text">
            {{ row.label }}
          </span>
          <span class="text-right text-component-node-foreground">
            {{ row.value }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, ref, toRef, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { clamp } from 'es-toolkit'

import WidgetBoundingBox from '@/components/boundingbox/WidgetBoundingBox.vue'
import Loader from '@/components/loader/Loader.vue'
import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import VideoCropOverlay from '@/components/videoEdit/VideoCropOverlay.vue'
import VideoFilmstripTrim from '@/components/videoEdit/VideoFilmstripTrim.vue'
import { useCropRatioLock } from '@/composables/video/useCropRatioLock'
import { useTrimPlayback } from '@/composables/video/useTrimPlayback'
import { useVideoEditFormats } from '@/composables/video/useVideoEditFormats'
import { DEFAULT_VIDEO_FPS } from '@/composables/video/useVideoFilmstrip'
import type { FilmstripError } from '@/composables/video/useVideoFilmstrip'
import type { VideoEditFeature } from '@/lib/litegraph/src/types/widgets'
import type { Bounds } from '@/renderer/core/layout/types'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumberInput.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { frameToTime, timeToFrame } from '@/utils/videoFrameUtil'
import { cn } from '@comfyorg/tailwind-utils'

const {
  features,
  videoUrl,
  thumbnail,
  totalFrames,
  duration,
  fps,
  fileSize,
  width,
  height,
  loading = false,
  error = null
} = defineProps<{
  features: VideoEditFeature[]
  videoUrl?: string
  thumbnail: string
  totalFrames: number
  duration: number
  fps: number
  fileSize?: number
  width: number
  height: number
  loading?: boolean
  error?: FilmstripError | null
}>()

const emit = defineEmits<{
  retry: []
}>()

const startFrame = defineModel<number>('startFrame', { default: 0 })
const endFrame = defineModel<number>('endFrame', { default: 0 })
const playheadFrame = defineModel<number>('playheadFrame', { default: 0 })
const cropBounds = defineModel<Bounds>('cropBounds', {
  default: () => ({ x: 0, y: 0, width: 0, height: 0 })
})

const { t } = useI18n()
const { formatDuration, formatFileSize, formatTimecode } = useVideoEditFormats()

const videoRef = useTemplateRef<HTMLVideoElement>('videoRef')
const videoIntrinsicSize = ref<{ width: number; height: number } | null>(null)
const isMuted = ref(false)
const isFullscreen = ref(false)

const hasTrim = computed(() => features.includes('trim'))
const ratioSelectId = useId()
const hasCrop = computed(() => features.includes('crop'))

const effectiveTotalFrames = computed(() => Math.max(totalFrames, 1))
const frameMax = computed(() => Math.max(totalFrames - 1, 0))

const toTime = (frame: number) =>
  frameToTime(frame, duration, totalFrames, fps || DEFAULT_VIDEO_FPS)
const toFrame = (time: number) =>
  timeToFrame(time, duration, totalFrames, fps || DEFAULT_VIDEO_FPS)

const { isPlaying, seekPreviewToFrame, handleScrub, handleTimeUpdate } =
  useTrimPlayback({
    videoRef,
    frameMax,
    startFrame,
    endFrame,
    playheadFrame,
    frameToTime: toTime,
    timeToFrame: toFrame
  })

useEventListener(document, 'fullscreenchange', () => {
  const video = videoRef.value
  const active =
    document.fullscreenElement != null && document.fullscreenElement === video
  isFullscreen.value = active
  if (!active && video) {
    isPlaying.value = !video.paused
  }
})

function enterFullscreen() {
  const video = videoRef.value
  if (!video) return
  void video.requestFullscreen().catch(() => {})
}

function handleVideoTimeUpdate() {
  if (isFullscreen.value) return
  handleTimeUpdate()
}

const { lockedRatio, ratioKeys, selectedRatio, isLockEnabled, canLockRatio } =
  useCropRatioLock(cropBounds, {
    sourceWidth: toRef(() => width),
    sourceHeight: toRef(() => height)
  })

const startFrameWidget = computed(
  (): SimplifiedWidget<number> => ({
    name: 'start_frame',
    label: t('videoEdit.startFrame'),
    type: 'number',
    value: startFrame.value,
    options: {
      min: 0,
      max: Math.max(endFrame.value - 1, 0),
      step: 1,
      step2: 1,
      precision: 0,
      disabled: !videoUrl || loading
    }
  })
)

const endFrameWidget = computed(
  (): SimplifiedWidget<number> => ({
    name: 'end_frame',
    label: t('videoEdit.endFrame'),
    type: 'number',
    value: endFrame.value,
    options: {
      min: Math.min(startFrame.value + 1, effectiveTotalFrames.value - 1),
      max: Math.max(effectiveTotalFrames.value - 1, 0),
      step: 1,
      step2: 1,
      precision: 0,
      disabled: !videoUrl || loading
    }
  })
)

const videoAspectRatioStyle = computed(() => {
  const intrinsic = videoIntrinsicSize.value
  const aspectWidth = width || intrinsic?.width
  const aspectHeight = height || intrinsic?.height
  if (aspectWidth && aspectHeight) {
    return { aspectRatio: `${aspectWidth} / ${aspectHeight}` }
  }
  return { aspectRatio: '16 / 9' }
})

const timecodeLabel = computed(() =>
  t('videoEdit.timecode', {
    current: formatTimecode(toTime(playheadFrame.value)),
    total: formatTimecode(duration)
  })
)

function handleSliderSeek(value: number[] | undefined) {
  const frame = value?.[0]
  if (typeof frame !== 'number') return
  const minFrame = hasTrim.value ? startFrame.value : 0
  const maxFrame = hasTrim.value ? endFrame.value : frameMax.value
  handleScrub(clamp(frame, minFrame, maxFrame))
}

const selectedDurationSeconds = computed(() =>
  Math.max(toTime(endFrame.value + 1) - toTime(startFrame.value), 0)
)

const selectedFrameCount = computed(() =>
  Math.max(endFrame.value - startFrame.value + 1, 0)
)

const dimensionsValue = computed(() => {
  const intrinsic = videoIntrinsicSize.value
  const displayWidth = width || intrinsic?.width
  const displayHeight = height || intrinsic?.height
  if (!displayWidth || !displayHeight) return '—'
  return t('videoEdit.resolution', {
    width: displayWidth,
    height: displayHeight
  })
})

const metadataRows = computed(() => [
  {
    label: t('videoEdit.dimensions'),
    value: dimensionsValue.value
  },
  {
    label: t('videoEdit.duration'),
    value: hasTrim.value
      ? t('videoEdit.selectedOfTotal', {
          selected: formatDuration(selectedDurationSeconds.value),
          total: formatDuration(duration)
        })
      : formatDuration(duration)
  },
  {
    label: t('videoEdit.frameRate'),
    value:
      fps > 0
        ? t('videoEdit.frameRateValue', { count: Math.round(fps * 100) / 100 })
        : '—'
  },
  {
    label: t('videoEdit.frames'),
    value: hasTrim.value
      ? t('videoEdit.selectedOfTotal', {
          selected: selectedFrameCount.value,
          total: effectiveTotalFrames.value
        })
      : String(effectiveTotalFrames.value)
  },
  {
    label: t('videoEdit.fileSize'),
    value: formatFileSize(fileSize)
  }
])

watch(
  toRef(() => videoUrl),
  () => {
    playheadFrame.value = hasTrim.value ? startFrame.value : 0
    isPlaying.value = false
    videoIntrinsicSize.value = null
  }
)

function handleVideoMetadata() {
  const video = videoRef.value
  if (video?.videoWidth && video.videoHeight) {
    videoIntrinsicSize.value = {
      width: video.videoWidth,
      height: video.videoHeight
    }
  }
  if (hasTrim.value) void seekPreviewToFrame(playheadFrame.value)
}
</script>
