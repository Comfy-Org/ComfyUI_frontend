<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

import VideoPlayOverlay from '@/platform/assets/components/VideoPlayOverlay.vue'
import { computeFanLayout } from '@/renderer/extensions/linearMode/fanLayout'
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import {
  getMediaType,
  mediaTypes
} from '@/renderer/extensions/linearMode/mediaTypes'
import { cn } from '@comfyorg/tailwind-utils'

// depth: recency rank, 0 = newest. total: number of cards in the fan.
// src: a pre-decoded image to display; video/other render straight from card.
const { card, depth, total, src } = defineProps<{
  card: InProgressItem
  depth: number
  total: number
  src?: string
}>()

// Skip the drop-in entrance entirely when the user prefers reduced motion.
const reducedMotion = usePreferredReducedMotion()
const mounted = ref(reducedMotion.value === 'reduce')
onMounted(() => {
  if (!mounted.value) requestAnimationFrame(() => (mounted.value = true))
})

const mediaType = computed(() =>
  card.state === 'image' && card.output ? getMediaType(card.output) : 'images'
)

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
      <img v-if="src" :src="src" alt="" class="size-full object-cover" />
      <template v-else-if="mediaType === 'video' && card.output">
        <video
          class="size-full object-cover"
          preload="metadata"
          :src="card.output.url"
        />
        <VideoPlayOverlay size="sm" />
      </template>
      <i
        v-else-if="card.output"
        :class="cn(mediaTypes[mediaType]?.iconClass, 'm-auto block size-12')"
      />
    </div>
  </div>
</template>
