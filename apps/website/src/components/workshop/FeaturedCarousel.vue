<script setup lang="ts">
import { computed } from 'vue'

import type { FeaturedSlide } from './FeaturedBanner.vue'

const { slides, activeIndex } = defineProps<{
  slides: readonly FeaturedSlide[]
  activeIndex: number
}>()

const emit = defineEmits<{ go: [index: number] }>()

// The pictures either side are the way to the slides either side: a reader
// reaches for the one they can already see rather than for a mark standing in
// for it. A slide whose media is a video has no still to show at rest, so the
// search steps over it to the next one that does.
function nearestPicture(step: number) {
  for (let hop = 1; hop < slides.length; hop++) {
    const index =
      (activeIndex + step * hop + slides.length * hop) % slides.length
    const slide = slides[index]
    if (index !== activeIndex && slide?.media?.kind === 'image')
      return { slide, index }
  }
  return undefined
}

const neighbours = computed(() =>
  [
    { ...nearestPicture(-1), side: 'left' as const },
    { ...nearestPicture(1), side: 'right' as const }
  ].filter((neighbour) => neighbour.slide !== undefined)
)
</script>

<template>
  <div class="relative flex items-center justify-center overflow-hidden py-4">
    <button
      v-for="{ slide, index, side } in neighbours"
      :key="side"
      type="button"
      :aria-label="slide!.title"
      :class="[
        'absolute top-1/2 aspect-21/9 h-4/5 -translate-y-1/2 cursor-pointer overflow-hidden rounded-2xl opacity-30 transition-opacity outline-none hover:opacity-50 focus-visible:opacity-70 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
        side === 'left' ? 'left-0 -translate-x-12' : 'right-0 translate-x-12'
      ]"
      @click="emit('go', index!)"
    >
      <img
        :src="slide!.media!.url"
        alt=""
        class="size-full object-cover"
        decoding="async"
      />
    </button>

    <a
      :href="slides[activeIndex]?.href"
      class="relative z-10 aspect-21/9 h-44 shrink-0 overflow-hidden rounded-3xl border border-transparency-white-t8 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 sm:h-52 lg:h-60 short:h-40"
      data-testid="featured-slide-link"
    >
      <slot />
    </a>
  </div>
</template>
