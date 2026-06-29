<template>
  <div
    class="flex flex-col gap-2"
    :class="!videoUrl && 'min-h-0 flex-1 pb-3'"
    @pointerdown.stop
  >
    <MediaUploadEmpty
      v-if="!videoUrl"
      fill
      accept="video/*"
      :disabled="uploadDisabled"
      :uploading
      :on-drag-over
      :on-drag-drop
      @browse="emit('browse')"
    />
    <div
      v-else
      data-testid="video-preview-container"
      class="relative w-full"
      :style="videoAspectRatioStyle"
      @mouseenter="isVideoHovered = true"
      @mouseleave="isVideoHovered = false"
    >
      <div
        class="relative size-full overflow-hidden rounded-lg bg-node-component-surface"
      >
        <video
          ref="videoRef"
          data-testid="video-preview"
          :src="videoUrl"
          class="size-full object-contain"
          preload="auto"
          muted
          playsinline
          @loadedmetadata="handleVideoMetadata"
          @timeupdate="handleTimeUpdate"
        />
        <div
          v-if="filmstripLoading"
          class="absolute inset-0 flex flex-col items-center justify-center gap-0 bg-node-component-surface"
          data-testid="video-preview-loading"
          :aria-busy="true"
          :aria-label="t('loadVideoTrim.loadingVideo')"
        >
          <Loader size="md" variant="loader-circle" />
          <p class="text-sm text-muted-foreground">
            {{ t('loadVideoTrim.loadingVideo') }}
          </p>
        </div>
      </div>
      <TooltipHint
        v-if="isVideoHovered && !filmstripLoading"
        :content="t('g.remove')"
      >
        <button
          type="button"
          data-testid="video-remove-button"
          :class="removeButtonClass"
          :aria-label="t('g.remove')"
          @pointerdown.stop
          @click.stop="emit('remove')"
        >
          <i class="icon-[lucide--x] size-4" />
        </button>
      </TooltipHint>
    </div>

    <div
      v-if="videoUrl"
      class="grid grid-cols-[minmax(80px,min-content)_minmax(125px,1fr)] gap-1"
    >
      <WidgetToggleSwitch
        v-model="trimEnabled"
        class="col-span-full grid grid-cols-subgrid"
        :widget="trimToggleWidget"
      />

      <VideoFilmstripTrim
        v-model:start-frame="startFrame"
        v-model:end-frame="endFrame"
        v-model:playhead-frame="playheadFrame"
        v-model:is-playing="isPlaying"
        class="col-span-full mt-2"
        :trim-enabled="trimEnabled"
        :total-frames="effectiveTotalFrames"
        :thumbnails="thumbnails"
        @scrub="handleScrub"
      />

      <WidgetInputNumberInput
        v-if="trimEnabled"
        v-model="startFrame"
        root-class="col-span-full grid grid-cols-subgrid items-center"
        :widget="startFrameWidget"
      />

      <WidgetInputNumberInput
        v-if="trimEnabled"
        v-model="endFrame"
        root-class="col-span-full grid grid-cols-subgrid items-center"
        :widget="endFrameWidget"
      />

      <div v-if="trimEnabled" class="col-span-full grid grid-cols-2 gap-1">
        <TooltipHint
          :content="t('loadVideoTrim.setStartFrame')"
          :disabled="setStartFrameDisabled"
        >
          <button
            type="button"
            :class="WidgetInputActionButtonClass"
            :disabled="setStartFrameDisabled"
            :aria-label="t('loadVideoTrim.setStartFrame')"
            @click="setStartFrame"
          >
            <i class="icon-[lucide--skip-back] size-4" />
          </button>
        </TooltipHint>
        <TooltipHint
          :content="t('loadVideoTrim.setEndFrame')"
          :disabled="setEndFrameDisabled"
        >
          <button
            type="button"
            :class="WidgetInputActionButtonClass"
            :disabled="setEndFrameDisabled"
            :aria-label="t('loadVideoTrim.setEndFrame')"
            @click="setEndFrame"
          >
            <i class="icon-[lucide--skip-forward] size-4" />
          </button>
        </TooltipHint>
      </div>

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
import { clamp } from 'es-toolkit'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import MediaUploadEmpty from '@/components/video/MediaUploadEmpty.vue'
import VideoFilmstripTrim from '@/components/video/VideoFilmstripTrim.vue'
import TooltipHint from '@/components/ui/tooltip/TooltipHint.vue'
import {
  DEFAULT_VIDEO_FPS,
  useVideoFilmstrip
} from '@/composables/video/useVideoFilmstrip'
import { WidgetInputActionButtonClass } from '@/renderer/extensions/vueNodes/widgets/components/layout'
import WidgetInputNumberInput from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumberInput.vue'
import WidgetToggleSwitch from '@/renderer/extensions/vueNodes/widgets/components/WidgetToggleSwitch.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const {
  videoUrl,
  uploading = false,
  uploadDisabled = false,
  onDragOver,
  onDragDrop
} = defineProps<{
  videoUrl?: string
  uploading?: boolean
  uploadDisabled?: boolean
  onDragOver?: (event: DragEvent) => boolean
  onDragDrop?: (event: DragEvent) => boolean | Promise<boolean>
}>()

const emit = defineEmits<{
  browse: []
  remove: []
}>()

const removeButtonClass =
  'absolute top-2 right-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-base-foreground text-base-background shadow-interface transition-colors duration-200 hover:bg-base-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'

const trimEnabled = defineModel<boolean>('trimEnabled', { default: false })
const startFrame = defineModel<number>('startFrame', { default: 0 })
const endFrame = defineModel<number>('endFrame', { default: 0 })
const playheadFrame = defineModel<number>('playheadFrame', { default: 0 })

const { t } = useI18n()
const videoRef = useTemplateRef<HTMLVideoElement>('videoRef')
const isVideoHovered = ref(false)
const isPlaying = ref(false)
const isSeeking = ref(false)
const videoIntrinsicSize = ref<{ width: number; height: number } | null>(null)
let activeSeekId = 0

const videoUrlRef = computed(() => videoUrl)
const {
  thumbnails,
  duration,
  totalFrames,
  width,
  height,
  fps,
  fileSize,
  loading: filmstripLoading
} = useVideoFilmstrip(videoUrlRef)

const effectiveTotalFrames = computed(() => Math.max(totalFrames.value, 1))

const frameMax = computed(() => Math.max(totalFrames.value - 1, 0))

const controlsDisabled = computed(() => !trimEnabled.value || !videoUrl)

const setStartFrameDisabled = computed(
  () => controlsDisabled.value || startFrame.value <= 0
)

const setEndFrameDisabled = computed(
  () => controlsDisabled.value || endFrame.value >= frameMax.value
)

const trimToggleWidget = computed(
  (): SimplifiedWidget<boolean> => ({
    name: 'trim_enabled',
    label: t('loadVideoTrim.trimVideo'),
    type: 'toggle',
    value: trimEnabled.value
  })
)

const startFrameWidget = computed(
  (): SimplifiedWidget<number> => ({
    name: 'start_frame',
    label: t('loadVideoTrim.startFrame'),
    type: 'number',
    value: startFrame.value,
    options: {
      min: 0,
      max: Math.max(endFrame.value - 1, 0),
      step: 1,
      step2: 1,
      precision: 0,
      disabled: !videoUrl
    }
  })
)

const endFrameWidget = computed(
  (): SimplifiedWidget<number> => ({
    name: 'end_frame',
    label: t('loadVideoTrim.endFrame'),
    type: 'number',
    value: endFrame.value,
    options: {
      min: Math.min(startFrame.value + 1, effectiveTotalFrames.value - 1),
      max: Math.max(effectiveTotalFrames.value - 1, 0),
      step: 1,
      step2: 1,
      precision: 0,
      disabled: !videoUrl
    }
  })
)

const videoAspectRatioStyle = computed(() => {
  const intrinsic = videoIntrinsicSize.value
  const aspectWidth = width.value || intrinsic?.width
  const aspectHeight = height.value || intrinsic?.height
  if (aspectWidth && aspectHeight) {
    return { aspectRatio: `${aspectWidth} / ${aspectHeight}` }
  }
  return { aspectRatio: '16 / 9' }
})

const metadataRows = computed(() => [
  {
    label: t('loadVideoTrim.duration'),
    value: formatDuration(duration.value)
  },
  {
    label: t('loadVideoTrim.frames'),
    value: String(effectiveTotalFrames.value)
  },
  {
    label: t('loadVideoTrim.fileSize'),
    value: formatFileSize(fileSize.value)
  }
])

const resolutionLabel = computed(() => {
  const intrinsic = videoIntrinsicSize.value
  const displayWidth = width.value || intrinsic?.width
  const displayHeight = height.value || intrinsic?.height
  if (!displayWidth || !displayHeight) return ''
  return t('loadVideoTrim.resolution', {
    width: displayWidth,
    height: displayHeight
  })
})

watch(
  () => videoUrl,
  () => {
    startFrame.value = 0
    playheadFrame.value = 0
    endFrame.value = 0
    isPlaying.value = false
    videoIntrinsicSize.value = null
  }
)

watch(
  totalFrames,
  (frames) => {
    if (!videoUrl || frames <= 0) return
    const lastFrame = Math.max(frames - 1, 0)
    if (endFrame.value === 0 || endFrame.value > lastFrame) {
      endFrame.value = lastFrame
    }
    playheadFrame.value = clamp(playheadFrame.value, 0, frameMax.value)
  },
  { immediate: true }
)

watch([startFrame, endFrame], ([start, end]) => {
  if (start >= end && end > 0) {
    startFrame.value = Math.max(end - 1, 0)
  }
  resolvePlayheadTrimCollision()
})

watch(isPlaying, (playing) => {
  void handlePlaybackChange(playing)
})

async function handlePlaybackChange(playing: boolean) {
  const video = videoRef.value
  if (!video) return
  if (playing) {
    const startAt = trimEnabled.value
      ? clamp(playheadFrame.value, startFrame.value, endFrame.value)
      : clamp(playheadFrame.value, 0, frameMax.value)
    await seekPreviewToFrame(startAt)
    if (!isPlaying.value) return
    void video.play()
  } else {
    video.pause()
  }
}

function frameToTime(frame: number) {
  if (duration.value > 0 && frameMax.value > 0) {
    return (frame / frameMax.value) * duration.value
  }
  return frame / (fps.value || DEFAULT_VIDEO_FPS)
}

function clampSeekTime(video: HTMLVideoElement, time: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return Math.max(time, 0)
  }
  return clamp(time, 0, Math.max(video.duration - 0.001, 0))
}

function waitForVideoSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      video.removeEventListener('seeked', finish)
      video.removeEventListener('error', finish)
      resolve()
    }
    video.addEventListener('seeked', finish, { once: true })
    video.addEventListener('error', finish, { once: true })
  })
}

async function seekPreviewToFrame(frame: number) {
  const video = videoRef.value
  if (!video) return

  const clamped = clamp(frame, 0, frameMax.value)
  playheadFrame.value = clamped

  const targetTime = clampSeekTime(video, frameToTime(clamped))
  if (Math.abs(video.currentTime - targetTime) <= 0.0001) return

  const seekId = ++activeSeekId
  isSeeking.value = true
  video.currentTime = targetTime
  await waitForVideoSeek(video)

  if (seekId === activeSeekId) {
    isSeeking.value = false
  }
}

function resolvePlayheadTrimCollision() {
  if (!trimEnabled.value) return

  const start = startFrame.value
  const end = endFrame.value
  const previous = playheadFrame.value
  if (previous < start) {
    playheadFrame.value = start
  } else if (previous > end) {
    playheadFrame.value = end
  }
  if (!isPlaying.value && playheadFrame.value !== previous) {
    void seekPreviewToFrame(playheadFrame.value)
  }
}

function handleScrub(frame: number) {
  isPlaying.value = false
  void seekPreviewToFrame(frame)
}

function handleVideoMetadata() {
  const video = videoRef.value
  if (video?.videoWidth && video.videoHeight) {
    videoIntrinsicSize.value = {
      width: video.videoWidth,
      height: video.videoHeight
    }
  }
  void seekPreviewToFrame(playheadFrame.value)
}

function handleTimeUpdate() {
  const video = videoRef.value
  if (!video || !isPlaying.value || isSeeking.value) return

  const frame = Math.round(video.currentTime * (fps.value || DEFAULT_VIDEO_FPS))
  const minFrame = trimEnabled.value ? startFrame.value : 0
  const maxFrame = trimEnabled.value ? endFrame.value : frameMax.value
  playheadFrame.value = clamp(frame, minFrame, maxFrame)

  if (frame >= maxFrame) {
    isPlaying.value = false
    void seekPreviewToFrame(maxFrame)
  }
}

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

function formatDuration(seconds: number) {
  if (!seconds) return '0s'
  return `${Math.round(seconds)}s`
}

function formatFileSize(bytes?: number) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
