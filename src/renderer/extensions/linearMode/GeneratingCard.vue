<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import VideoPlayOverlay from '@/platform/assets/components/VideoPlayOverlay.vue'
import { computeFanLayout } from '@/renderer/extensions/linearMode/fanLayout'
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import {
  getMediaType,
  mediaTypes
} from '@/renderer/extensions/linearMode/mediaTypes'
import { cn } from '@comfyorg/tailwind-utils'

// depth: recency rank, 0 = newest. total: number of cards in the fan.
const { card, depth, total } = defineProps<{
  card: InProgressItem
  depth: number
  total: number
}>()

const { t } = useI18n()

// Skip the drop-in entrance entirely when the user prefers reduced motion.
const reducedMotion = usePreferredReducedMotion()
const mounted = ref(reducedMotion.value === 'reduce')
onMounted(() => {
  if (!mounted.value) requestAnimationFrame(() => (mounted.value = true))
})

const mediaType = computed(() =>
  card.state === 'image' && card.output ? getMediaType(card.output) : 'images'
)

// The still image to show (latent preview, then final image output). Video and
// other media render from card.output directly.
const imageSrc = computed(() => {
  if (card.state === 'latent') return card.latentPreviewUrl
  if (card.state === 'image' && card.output && mediaType.value === 'images')
    return card.output.url
  return undefined
})

// Fade the image in once loaded so it never paints half-formed. A later src
// (latent -> final) swaps in place: the browser keeps the prior frame until the
// new one is ready, so it stays loaded.
const loaded = ref(false)

const layout = computed(() => computeFanLayout(depth, total))

// New cards drop in and scale up slightly on first mount.
const ENTER_DROP_PX = 22
const ENTER_SCALE = 0.94

// Positioning lives on this inner element, not the root: the fan's
// <TransitionGroup> rewrites the root's transform to measure moves, which would
// otherwise fling cards to the corner for a frame. The root only carries
// z-index and the fade in/out opacity.
const innerStyle = computed(() => {
  const f = layout.value
  const entering = !mounted.value
  const y = entering ? f.y + ENTER_DROP_PX : f.y
  const scale = f.scale * (entering ? ENTER_SCALE : 1)
  return {
    transform: `translate(-50%, -50%) translateX(${f.x}px) translateY(${y}px) rotate(${f.rotate}deg) scale(${scale})`,
    opacity: f.opacity
  }
})
</script>
<template>
  <div class="absolute inset-0" :style="{ zIndex: layout.z }">
    <div
      class="gen-card absolute top-1/2 left-1/2 size-[min(46cqh,300px)] overflow-hidden rounded-2xl bg-secondary-background shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)] ring-1 ring-border-subtle transition-[transform,opacity] duration-620 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
      :style="innerStyle"
    >
      <img
        v-if="imageSrc"
        :src="imageSrc"
        :alt="
          card.state === 'latent'
            ? t('linearMode.generationPreview')
            : card.output?.filename
        "
        :class="
          cn(
            'size-full object-cover',
            loaded ? 'opacity-100' : 'opacity-0',
            reducedMotion !== 'reduce' && 'transition-opacity duration-300'
          )
        "
        @load="loaded = true"
      />
      <template v-else-if="mediaType === 'video' && card.output">
        <video
          class="size-full object-cover"
          preload="metadata"
          :aria-label="card.output.filename"
          :src="card.output.url"
        />
        <VideoPlayOverlay size="sm" />
      </template>
      <i
        v-else-if="card.output"
        role="img"
        :aria-label="mediaTypes[mediaType]?.content"
        :class="cn(mediaTypes[mediaType]?.iconClass, 'm-auto block size-12')"
      />
    </div>
  </div>
</template>
