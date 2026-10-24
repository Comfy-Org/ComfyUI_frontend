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
      <ToggleGroup
        v-if="resultUrl"
        type="single"
        data-testid="video-concat-preview-mode"
        :model-value="showingResult ? 'result' : 'clips'"
        class="w-full min-w-0 rounded-md bg-input p-1"
        @update:model-value="selectMode"
      >
        <ToggleGroupItem value="clips" size="sm" class="flex-1 px-2">
          {{ t('videoConcat.previewClips') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="result" size="sm" class="flex-1 px-2">
          {{ t('videoConcat.previewResult') }}
        </ToggleGroupItem>
      </ToggleGroup>

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
        :active-name="showingResult ? undefined : currentClip?.name"
        :metadata
        @reorder="(from, to) => emit('reorder', from, to)"
        @select="selectClip"
        @metadata="storeMetadata"
      />

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
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import VideoConcatClipStrip from '@/components/videoConcat/VideoConcatClipStrip.vue'
import VideoConcatPlaybackBar from '@/components/videoConcat/VideoConcatPlaybackBar.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSequencePlayback } from '@/composables/videoConcat/useSequencePlayback'
import type {
  ClipMetadata,
  ConcatClip
} from '@/composables/videoConcat/useVideoConcatClips'
import { useVideoEditFormats } from '@/composables/video/useVideoEditFormats'
import { cn } from '@comfyorg/tailwind-utils'

const { clips, resultUrl } = defineProps<{
  clips: ConcatClip[]
  resultUrl?: string
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

const preferResult = ref(false)
const showingResult = computed(() => preferResult.value && Boolean(resultUrl))
const playbackClips = computed(() =>
  showingResult.value ? [{ name: 'result', url: resultUrl }] : clips
)

const clipMetadata = computed(() =>
  clips.map((clip) => (clip.url ? metadata.value[clip.url] : undefined))
)
const playable = computed(() =>
  playbackClips.value.map((clip) => Boolean(clip.url))
)
const durations = computed(() =>
  playbackClips.value.map((clip) =>
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

const currentClip = computed(() => playbackClips.value[index.value])

watch(
  () => playbackClips.value.map((clip) => `${clip.name}=${clip.url}`).join('|'),
  reset
)

function selectMode(mode: unknown) {
  if (mode !== 'clips' && mode !== 'result') return
  preferResult.value = mode === 'result'
}

async function selectClip(clipIndex: number) {
  if (showingResult.value) {
    preferResult.value = false
    await nextTick()
  }
  seekToClip(clipIndex)
}

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
  clipMetadata.value.flatMap((value) =>
    value && value.width > 0 && value.height > 0
      ? [{ width: value.width, height: value.height }]
      : []
  )
)

const hasMixedSizes = computed(() =>
  knownSizes.value.some(
    (size) =>
      size.width !== knownSizes.value[0].width ||
      size.height !== knownSizes.value[0].height
  )
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
