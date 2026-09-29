<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { slides, activeIndex, fill, aside } = defineProps<{
  slides: readonly { key: string; title: string }[]
  activeIndex: number
  /** How far the current slide has run, 0 to 1. */
  fill: number
  /** Whether the banner keeps a pitch beside the picture, so the dots ride in
   * the strip that names the slide rather than across the whole width. */
  aside?: boolean
}>()

const emit = defineEmits<{ go: [index: number] }>()
</script>

<template>
  <div
    :class="
      cn(
        'pointer-events-none flex gap-2',
        aside ? 'shrink-0' : 'absolute inset-x-8 bottom-5 lg:inset-x-12'
      )
    "
    data-testid="featured-pagination"
  >
    <button
      v-for="(slide, index) in slides"
      :key="slide.key"
      type="button"
      :aria-label="slide.title"
      :aria-current="index === activeIndex ? 'true' : undefined"
      :class="
        cn(
          'group pointer-events-auto min-w-0 cursor-pointer rounded-full py-3 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
          aside ? 'w-6 shrink-0' : 'max-w-12 flex-1'
        )
      "
      @click="emit('go', index)"
    >
      <span
        class="block h-1 overflow-hidden rounded-full bg-transparency-white-t20 group-hover:bg-primary-warm-gray"
      >
        <span
          class="block h-full rounded-full bg-primary-warm-white"
          :style="{ width: index === activeIndex ? `${fill * 100}%` : '0%' }"
        />
      </span>
    </button>
  </div>
</template>
