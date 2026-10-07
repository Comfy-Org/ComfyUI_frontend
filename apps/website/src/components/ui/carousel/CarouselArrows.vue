<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  prevLabel,
  nextLabel,
  atStart = false,
  atEnd = false
} = defineProps<{
  prevLabel: string
  nextLabel: string
  /** Dims the arrow with nowhere left to go. It stays mounted, so paging to
    an end never drops the focus the reader is standing on. */
  atStart?: boolean
  atEnd?: boolean
}>()

const emit = defineEmits<{ prev: []; next: [] }>()

function goBack() {
  if (!atStart) emit('prev')
}

function goForward() {
  if (!atEnd) emit('next')
}

const arrowClass =
  'flex size-11 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-xs transition-colors outline-none hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
</script>

<template>
  <div class="flex shrink-0 gap-2">
    <button
      type="button"
      :class="cn(arrowClass, atStart && 'opacity-40')"
      :aria-label="prevLabel"
      :aria-disabled="atStart || undefined"
      data-testid="carousel-prev"
      @click="goBack"
    >
      <ChevronLeft class="size-5" aria-hidden="true" />
    </button>
    <button
      type="button"
      :class="cn(arrowClass, atEnd && 'opacity-40')"
      :aria-label="nextLabel"
      :aria-disabled="atEnd || undefined"
      data-testid="carousel-next"
      @click="goForward"
    >
      <ChevronRight class="size-5" aria-hidden="true" />
    </button>
  </div>
</template>
