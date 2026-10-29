<template>
  <div
    data-testid="video-concat-clip"
    :data-clip-name="name"
    :aria-current="active || undefined"
    :class="
      cn(
        'relative aspect-video w-24 shrink-0 touch-none overflow-hidden rounded-md border-2 bg-input outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary' : 'border-transparent',
        dragging
          ? 'cursor-grabbing border-dashed border-foreground opacity-40'
          : 'cursor-grab'
      )
    "
  >
    <img
      v-if="thumbnail"
      data-testid="video-concat-clip-thumbnail"
      :src="thumbnail"
      alt=""
      draggable="false"
      class="pointer-events-none block size-full object-cover"
    />
    <Skeleton
      v-else-if="loading"
      class="pointer-events-none size-full rounded-none"
    />
    <div v-else class="absolute inset-0 flex items-center justify-center">
      <i class="icon-[lucide--video-off] size-5 text-muted-foreground" />
    </div>
    <span
      class="pointer-events-none absolute top-1 left-1 rounded-sm bg-black/60 px-1 text-xs font-semibold text-white tabular-nums"
    >
      {{ position }}
    </span>
    <span
      v-if="duration"
      class="pointer-events-none absolute right-1 bottom-1 rounded-sm bg-black/60 px-1 text-xs text-white tabular-nums"
    >
      {{ formatTimecode(duration) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { toRef, watch } from 'vue'

import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { useVideoEditFormats } from '@/composables/video/useVideoEditFormats'
import { useVideoFilmstrip } from '@/composables/video/useVideoFilmstrip'
import type { ClipMetadata } from '@/composables/videoConcat/useVideoConcatClips'
import { cn } from '@comfyorg/tailwind-utils'

const {
  name,
  url,
  position,
  active = false,
  dragging = false
} = defineProps<{
  name: string
  url?: string
  position: number
  active?: boolean
  dragging?: boolean
}>()

const emit = defineEmits<{
  metadata: [metadata: ClipMetadata]
}>()

const { formatTimecode } = useVideoEditFormats()
const { thumbnail, duration, width, height, loading } = useVideoFilmstrip(
  toRef(() => url)
)

watch([duration, width, height, thumbnail], () => {
  if (duration.value <= 0) return
  emit('metadata', {
    duration: duration.value,
    width: width.value,
    height: height.value,
    thumbnail: thumbnail.value
  })
})
</script>
