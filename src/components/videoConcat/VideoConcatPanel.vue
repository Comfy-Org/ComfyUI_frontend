<template>
  <div class="flex flex-col gap-2" @pointerdown.stop>
    <div
      v-if="!clips.length"
      data-testid="video-concat-empty"
      class="flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-node-border bg-node p-4 text-center"
    >
      <i class="icon-[lucide--film] size-6 text-muted-foreground" />
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('videoConcat.noClips') }}
      </p>
    </div>
    <template v-else>
      <div class="overflow-hidden rounded-lg bg-node">
        <div class="relative w-full" :style="aspectRatioStyle">
          <video
            v-if="currentClip?.url"
            :key="`${index}:${currentClip.url}`"
            ref="videoRef"
            data-testid="video-concat-preview"
            :src="currentClip.url"
            :muted="isMuted"
            class="block size-full object-contain"
            preload="metadata"
            crossorigin="anonymous"
            playsinline
            @loadedmetadata="handlePreviewMetadata"
            @timeupdate="handleTimeUpdate"
            @ended="handleEnded"
            @error="handlePreviewError"
          />
        </div>
      </div>

      <VideoConcatPlaybackBar
        v-model:playing="isPlaying"
        v-model:muted="isMuted"
        :current-time="currentTime"
        :total-duration="totalDuration"
        @seek="seek"
      />

      <VideoConcatClipStrip
        :clips
        :active-name="currentClip?.name"
        :metadata
        :mismatched-names="mismatchedSizes.map((size) => size.name)"
        @reorder="(from, to) => emit('reorder', from, to)"
        @select="seekToClip"
        @metadata="storeMetadata"
      />

      <p
        v-if="hasMixedSizes"
        data-testid="video-concat-size-warning"
        class="m-0 flex items-start gap-1.5 text-xs text-warning"
      >
        <i class="mt-0.5 icon-[lucide--triangle-alert]" />
        {{ sizeWarning }}
      </p>

      <div
        class="grid grid-cols-[minmax(80px,min-content)_minmax(125px,1fr)] gap-y-0.5 border-t border-node-border py-2"
      >
        <template v-for="row in metadataRows" :key="row.label">
          <span class="truncate">
            {{ row.label }}
          </span>
          <span
            :class="
              cn('text-right', row.warning ? 'text-warning' : 'text-foreground')
            "
          >
            {{ row.value }}
          </span>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import VideoConcatClipStrip from '@/components/videoConcat/VideoConcatClipStrip.vue'
import VideoConcatPlaybackBar from '@/components/videoConcat/VideoConcatPlaybackBar.vue'
import { useSequencePlayback } from '@/composables/videoConcat/useSequencePlayback'
import type {
  ClipMetadata,
  ConcatClip
} from '@/composables/videoConcat/useVideoConcatClips'
import { useVideoEditFormats } from '@/composables/video/useVideoEditFormats'
import { cn } from '@comfyorg/tailwind-utils'

const { clips } = defineProps<{
  clips: ConcatClip[]
}>()

const emit = defineEmits<{
  reorder: [from: number, to: number]
}>()

const { t } = useI18n()
const { formatDuration } = useVideoEditFormats()

const videoRef = useTemplateRef<HTMLVideoElement>('videoRef')
const isMuted = ref(false)
const metadata = ref<Record<string, ClipMetadata>>({})

function storeMetadata(url: string, value: ClipMetadata) {
  metadata.value = { ...metadata.value, [url]: value }
}

watch(
  () => clips.map((clip) => clip.url),
  (displayedUrls) => {
    metadata.value = Object.fromEntries(
      Object.entries(metadata.value).filter(([url]) =>
        displayedUrls.includes(url)
      )
    )
  }
)

const clipMetadata = computed(() =>
  clips.map((clip) => (clip.url ? metadata.value[clip.url] : undefined))
)
const playable = computed(() => clips.map((clip) => Boolean(clip.url)))
const durations = computed(() =>
  clips.map((clip) =>
    clip.url ? (metadata.value[clip.url]?.duration ?? 0) : 0
  )
)

const {
  index,
  isPlaying,
  currentTime,
  totalDuration,
  seek,
  seekToClip,
  reset,
  handleLoadedMetadata,
  handleTimeUpdate,
  handleEnded
} = useSequencePlayback(videoRef, durations, playable)

const currentClip = computed(() => clips[index.value])

watch(() => clips.map((clip) => `${clip.name}=${clip.url}`).join('|'), reset)

function handlePreviewError() {
  if (isPlaying.value) handleEnded()
}

function handlePreviewMetadata(event: Event) {
  const video = event.target
  const url = currentClip.value?.url
  if (video instanceof HTMLVideoElement && url && !metadata.value[url]) {
    storeMetadata(url, {
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      width: video.videoWidth,
      height: video.videoHeight,
      thumbnail: ''
    })
  }
  handleLoadedMetadata()
}

const knownSizes = computed(() =>
  clips.flatMap((clip, index) => {
    const value = clipMetadata.value[index]
    return value && value.width > 0 && value.height > 0
      ? [
          {
            name: clip.name,
            position: index + 1,
            width: value.width,
            height: value.height
          }
        ]
      : []
  })
)

const mismatchedSizes = computed(() => {
  const [reference, ...others] = knownSizes.value
  return others.filter(
    (size) => size.width !== reference.width || size.height !== reference.height
  )
})

const hasMixedSizes = computed(() => mismatchedSizes.value.length > 0)

const sizeWarning = computed(() =>
  t('videoConcat.mixedDimensionsWarning', {
    ...knownSizes.value[0],
    clips: mismatchedSizes.value
      .map((size) => t('videoConcat.clipSize', size))
      .join(', ')
  })
)

const aspectRatioStyle = computed(() => {
  const size = currentClip.value?.url
    ? metadata.value[currentClip.value.url]
    : undefined
  return size?.width && size.height
    ? { aspectRatio: `${size.width} / ${size.height}` }
    : { aspectRatio: '16 / 9' }
})

const dimensionsValue = computed(() => {
  if (hasMixedSizes.value) return t('videoConcat.mixedDimensions')
  const size = knownSizes.value[0]
  return size ? t('videoEdit.resolution', size) : '—'
})

const metadataRows = computed(() => [
  { label: t('videoConcat.clips'), value: String(clips.length) },
  {
    label: t('videoEdit.duration'),
    value: formatDuration(totalDuration.value)
  },
  {
    label: t('videoEdit.dimensions'),
    value: dimensionsValue.value,
    warning: hasMixedSizes.value
  }
])
</script>
