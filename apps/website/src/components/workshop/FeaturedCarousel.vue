<script setup lang="ts">
import { computed } from 'vue'

import type { FeaturedSlide } from './FeaturedBanner.vue'

const { slides, activeIndex } = defineProps<{
  slides: readonly FeaturedSlide[]
  activeIndex: number
}>()

const emit = defineEmits<{ go: [index: number] }>()

interface Neighbour {
  readonly index: number
  readonly title: string
  readonly url: string
}

// The pictures either side are the way to the slides either side: a reader
// reaches for the one they can already see rather than for a mark standing in
// for it. A slide whose media is a video has no still to show at rest, so the
// search steps over it to the next one that does.
function nearestPicture(step: number): Neighbour | undefined {
  for (let hop = 1; hop < slides.length; hop++) {
    const index =
      (activeIndex + step * hop + slides.length * hop) % slides.length
    const slide = slides[index]
    if (index !== activeIndex && slide?.media?.kind === 'image')
      return { index, title: slide.title, url: slide.media.url }
  }
  return undefined
}

const active = computed(() => slides[activeIndex])
const sides = computed(() =>
  [
    { side: 'left', neighbour: nearestPicture(-1) },
    { side: 'right', neighbour: nearestPicture(1) }
  ].flatMap(({ side, neighbour }) =>
    neighbour ? [{ side, ...neighbour }] : []
  )
)

// The three stand in one row rather than one over the other, so a neighbour
// keeps its own name under it where the middle one keeps its own. The middle
// takes half the row and a neighbour a quarter, which is what makes the open
// slide read as the open one without dimming being the only thing saying so.
const OPEN = 'w-full shrink-0 sm:w-1/2'
const NEIGHBOUR = 'w-1/4 shrink-0 max-sm:hidden'
const FRAME = 'h-44 overflow-hidden rounded-2xl sm:h-52 lg:h-60 short:h-40'
const CAPTION = 'flex min-w-0 items-center gap-2 px-2 pt-3 text-left'
</script>

<template>
  <div class="flex justify-center overflow-hidden">
    <button
      v-for="{ side, index, title, url } in sides"
      :key="side"
      type="button"
      :class="[
        NEIGHBOUR,
        'cursor-pointer opacity-40 transition-opacity outline-none hover:opacity-70 focus-visible:opacity-100',
        side === 'right' && 'order-last'
      ]"
      data-testid="featured-neighbour"
      @click="emit('go', index)"
    >
      <div :class="FRAME">
        <img
          :src="url"
          alt=""
          class="size-full object-cover"
          decoding="async"
        />
      </div>
      <p :class="[CAPTION, 'truncate text-sm text-primary-warm-gray']">
        {{ title }}
      </p>
    </button>

    <a
      :href="active?.href"
      :class="[OPEN, 'group outline-none']"
      data-testid="featured-slide-link"
    >
      <div
        :class="[
          FRAME,
          'border border-transparency-white-t8 group-focus-visible:ring-3 group-focus-visible:ring-primary-comfy-yellow/50'
        ]"
      >
        <slot />
      </div>
      <div :class="CAPTION" data-testid="featured-now-showing">
        <span class="truncate text-sm font-medium text-primary-warm-white">
          {{ active?.title }}
        </span>
        <span
          class="shrink-0 rounded-full bg-hub-surface px-3 py-1 text-xs whitespace-nowrap text-content-secondary"
        >
          {{ active?.kind }}
        </span>
      </div>
    </a>
  </div>
</template>
