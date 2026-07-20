<script setup lang="ts">
import { Loader2 } from '@lucide/vue'

const {
  src,
  alt,
  caption,
  width,
  height,
  priority = false,
  running = false
} = defineProps<{
  src: string | null
  alt: string
  caption: string
  width: number
  height: number
  priority?: boolean
  running?: boolean
}>()
</script>

<template>
  <figure>
    <div
      class="relative overflow-hidden rounded-[0.375em] bg-black/30"
      :style="{ aspectRatio: `${width} / ${height}` }"
    >
      <img
        v-if="src && !running"
        :src
        :alt
        :width
        :height
        :fetchpriority="priority ? 'high' : undefined"
        class="size-full object-cover"
        decoding="async"
      />
      <div
        v-else
        class="flex size-full items-center justify-center text-[0.7em] text-white/40"
      >
        <span v-if="running" class="flex items-center gap-[0.4em]">
          <Loader2 class="size-[1em] animate-spin" aria-hidden="true" />
          Running
        </span>
        <span v-else>Queue to generate</span>
      </div>
    </div>
    <figcaption class="pt-[0.35em] text-center text-[0.7em] text-white/60">
      {{ src && !running ? caption : '—' }}
    </figcaption>
  </figure>
</template>
