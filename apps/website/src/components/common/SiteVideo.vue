<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import { buildVideoSources, videoKey } from '../../utils/video'
import type { VideoFormat } from '../../utils/video'

const {
  name,
  baseUrl,
  width = 1280,
  formats = ['webm', 'mp4'],
  poster,
  alt,
  autoplay = false,
  loop = false,
  muted = autoplay,
  controls = false,
  preload = autoplay ? 'auto' : 'metadata',
  containerClass,
  videoClass
} = defineProps<{
  name: string
  baseUrl: string
  width?: number
  formats?: VideoFormat[]
  poster?: string
  alt?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
  preload?: 'auto' | 'metadata' | 'none'
  containerClass?: string
  videoClass?: string
}>()

const sources = computed(() =>
  buildVideoSources({ name, baseUrl, width, formats })
)
const remountKey = computed(() => videoKey(sources.value))
const decorative = computed(() => !alt && !controls)
</script>

<template>
  <div :class="cn('relative', containerClass)">
    <video
      :key="remountKey"
      :class="cn('size-full', videoClass)"
      :poster
      :preload
      :autoplay
      :loop
      :muted
      :controls
      :aria-label="alt"
      :aria-hidden="decorative ? true : undefined"
      playsinline
    >
      <source
        v-for="source in sources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
      />
    </video>
  </div>
</template>
