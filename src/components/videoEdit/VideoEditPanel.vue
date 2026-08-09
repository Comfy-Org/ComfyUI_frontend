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
      class="relative w-full"
      :style="videoAspectRatioStyle"
    >
      <div
        class="relative size-full overflow-hidden rounded-lg bg-node-component-surface"
      >
        <video
          ref="videoRef"
          data-testid="video-preview"
          :src="videoUrl"
          class="size-full object-contain"
          preload="metadata"
          crossorigin="anonymous"
          playsinline
          @loadedmetadata="handleVideoMetadata"
          @timeupdate="handleTimeUpdate"
        />
        <VideoCropOverlay
          v-if="hasCrop && cropEnabled && !loading && width > 0 && height > 0"
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
      </div>
    </div>

    <div
      v-if="videoUrl"
      class="grid grid-cols-[minmax(80px,min-content)_minmax(125px,1fr)] gap-1"
    >
      <WidgetToggleSwitch
        v-if="hasTrim"
        v-model="trimEnabled"
        class="col-span-full grid grid-cols-subgrid"
        :widget="trimToggleWidget"
      />

      <VideoFilmstripTrim
        v-if="hasTrim"
        v-model:start-frame="startFrame"
        v-model:end-frame="endFrame"
        v-model:playhead-frame="playheadFrame"
        v-model:is-playing="isPlaying"
        class="col-span-full"
        :trim-enabled="trimEnabled"
        :total-frames="effectiveTotalFrames"
        :thumbnails="thumbnails"
        @scrub="handleScrub"
      />

      <WidgetInputNumberInput
        v-if="hasTrim && trimEnabled"
        v-model="startFrame"
        root-class="col-span-full grid grid-cols-subgrid items-center"
        :widget="startFrameWidget"
      />

      <WidgetInputNumberInput
        v-if="hasTrim && trimEnabled"
        v-model="endFrame"
        root-class="col-span-full grid grid-cols-subgrid items-center"
        :widget="endFrameWidget"
      />

      <div
        v-if="hasTrim && trimEnabled"
        class="col-span-full grid grid-cols-2 gap-1"
      >
        <button
          v-tooltip="t('videoEdit.setStartFrame')"
          type="button"
          :class="WidgetInputActionButtonClass"
          :disabled="setStartFrameDisabled"
          :aria-label="t('videoEdit.setStartFrame')"
          @click="setStartFrame"
        >
          <i class="icon-[lucide--skip-back] size-4" />
        </button>
        <button
          v-tooltip="t('videoEdit.setEndFrame')"
          type="button"
          :class="WidgetInputActionButtonClass"
          :disabled="setEndFrameDisabled"
          :aria-label="t('videoEdit.setEndFrame')"
          @click="setEndFrame"
        >
          <i class="icon-[lucide--skip-forward] size-4" />
        </button>
      </div>

      <WidgetToggleSwitch
        v-if="hasCrop"
        v-model="cropEnabled"
        class="col-span-full grid grid-cols-subgrid"
        :widget="cropToggleWidget"
      />

      <div
        v-if="hasCrop && cropEnabled"
        class="col-span-full flex items-center gap-2"
      >
        <label class="text-xs text-muted-foreground">
          {{ t('imageCrop.ratio') }}
        </label>
        <Select v-model="selectedRatio" :disabled="!canLockRatio">
          <SelectTrigger
            class="h-7 w-24 text-xs"
            :aria-label="t('imageCrop.ratio')"
          >
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
        v-if="hasCrop && cropEnabled"
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
          class="col-span-full grid grid-cols-subgrid py-0.5 text-sm"
        >
          <span class="truncate text-muted-foreground">{{ row.label }}</span>
          <span class="text-right text-base-foreground">{{ row.value }}</span>
        </div>
      </div>
      <p
        v-if="resolutionLabel"
        class="col-span-full m-0 border-t border-node-stroke py-3 text-center text-sm text-base-foreground"
      >
        {{ resolutionLabel }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import WidgetBoundingBox from '@/components/boundingbox/WidgetBoundingBox.vue'
import Loader from '@/components/loader/Loader.vue'
import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import VideoCropOverlay from '@/components/videoEdit/VideoCropOverlay.vue'
import VideoFilmstripTrim from '@/components/videoEdit/VideoFilmstripTrim.vue'
import { useCropRatioLock } from '@/composables/video/useCropRatioLock'
import { useTrimPlayback } from '@/composables/video/useTrimPlayback'
import { useVideoEditFormats } from '@/composables/video/useVideoEditFormats'
import { DEFAULT_VIDEO_FPS } from '@/composables/video/useVideoFilmstrip'
import type { VideoEditFeature } from '@/lib/litegraph/src/types/widgets'
import type { Bounds } from '@/renderer/core/layout/types'
import { WidgetInputBaseClass } from '@/renderer/extensions/vueNodes/widgets/components/layout'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumberInput.vue'
import WidgetToggleSwitch from '@/renderer/extensions/vueNodes/widgets/components/WidgetToggleSwitch.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { frameToTime, timeToFrame } from '@/utils/videoFrameUtil'
import { cn } from '@comfyorg/tailwind-utils'

const WidgetInputActionButtonClass = cn(
  WidgetInputBaseClass,
  'flex h-8 cursor-pointer items-center justify-center',
  'not-disabled:hover:bg-component-node-widget-background-hovered',
  'disabled:cursor-not-allowed disabled:bg-component-node-widget-background-disabled',
  'disabled:text-muted-foreground disabled:opacity-50',
  'disabled:hover:bg-component-node-widget-background-disabled'
)

const {
  features,
  videoUrl,
  thumbnails,
  totalFrames,
  duration,
  fps,
  fileSize,
  width,
  height,
  loading = false
} = defineProps<{
  features: VideoEditFeature[]
  videoUrl?: string
  thumbnails: string[]
  totalFrames: number
  duration: number
  fps: number
  fileSize?: number
  width: number
  height: number
  loading?: boolean
}>()

const startFrame = defineModel<number>('startFrame', { default: 0 })
const endFrame = defineModel<number>('endFrame', { default: 0 })
const playheadFrame = defineModel<number>('playheadFrame', { default: 0 })
const cropBounds = defineModel<Bounds>('cropBounds', {
  default: () => ({ x: 0, y: 0, width: 0, height: 0 })
})
const trimEnabled = defineModel<boolean>('trimEnabled', { default: false })
const cropEnabled = defineModel<boolean>('cropEnabled', { default: false })

const { t } = useI18n()
const { formatDuration, formatFileSize } = useVideoEditFormats()

const videoRef = useTemplateRef<HTMLVideoElement>('videoRef')
const videoIntrinsicSize = ref<{ width: number; height: number } | null>(null)

const hasTrim = computed(() => features.includes('trim'))
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
    hasTrimTimeline: hasTrim,
    frameToTime: toTime,
    timeToFrame: toFrame
  })

const { lockedRatio, ratioKeys, selectedRatio, isLockEnabled, canLockRatio } =
  useCropRatioLock(cropBounds, {
    sourceWidth: toRef(() => width),
    sourceHeight: toRef(() => height)
  })

const setStartFrameDisabled = computed(
  () => !videoUrl || loading || startFrame.value <= 0
)

const setEndFrameDisabled = computed(
  () => !videoUrl || loading || endFrame.value >= frameMax.value
)

function setStartFrame() {
  isPlaying.value = false
  startFrame.value = 0
  void seekPreviewToFrame(0)
}

function setEndFrame() {
  isPlaying.value = false
  endFrame.value = frameMax.value
  void seekPreviewToFrame(frameMax.value)
}

const trimToggleWidget = computed(
  (): SimplifiedWidget<boolean> => ({
    name: 'trim_enabled',
    label: t('videoEdit.trimVideo'),
    type: 'toggle',
    value: trimEnabled.value
  })
)

const cropToggleWidget = computed(
  (): SimplifiedWidget<boolean> => ({
    name: 'crop_enabled',
    label: t('videoEdit.cropVideo'),
    type: 'toggle',
    value: cropEnabled.value
  })
)

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

const selectedDurationSeconds = computed(() =>
  Math.max(toTime(endFrame.value + 1) - toTime(startFrame.value), 0)
)

const selectedFrameCount = computed(() =>
  Math.max(endFrame.value - startFrame.value + 1, 0)
)

const metadataRows = computed(() => [
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

const resolutionLabel = computed(() => {
  const intrinsic = videoIntrinsicSize.value
  const displayWidth = width || intrinsic?.width
  const displayHeight = height || intrinsic?.height
  if (!displayWidth || !displayHeight) return ''
  return t('videoEdit.resolution', {
    width: displayWidth,
    height: displayHeight
  })
})

watch(
  toRef(() => videoUrl),
  () => {
    playheadFrame.value = 0
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
