<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import { buildVideoSources, videoKey } from '../../utils/video'
import type { VideoFormat } from '../../utils/video'

/**
 * Autoplay note: browsers require `muted` for autoplay to actually start.
 * `muted` is a Boolean prop, so Vue coerces an omitted value to `false`
 * (see https://vuejs.org/guide/components/props#boolean-casting) — that
 * means we cannot fall back to `autoplay` inside the component. Callers
 * that pass `autoplay` must also pass `muted` explicitly.
 */
const {
  name,
  baseUrl,
  width = 1280,
  formats = ['webm', 'mp4'],
  poster,
  alt,
  autoplay = false,
  loop = false,
  muted = false,
  controls = false,
  preload,
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

if (import.meta.env.DEV && autoplay && !muted) {
  console.warn(
    `[SiteVideo] "${name}" uses autoplay without muted. Browsers block ` +
      'unmuted autoplay by default; pass `muted` explicitly.'
  )
}

const resolvedPreload = computed(
  () => preload ?? (autoplay ? 'auto' : 'metadata')
)
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
      :preload="resolvedPreload"
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
