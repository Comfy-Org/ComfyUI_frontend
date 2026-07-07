<script setup lang="ts">
import { computed } from 'vue'

const {
  url,
  filename,
  mediaType = 'image'
} = defineProps<{
  url: string
  filename: string
  mediaType?: string
}>()

const isVideo = computed(() => mediaType.startsWith('video'))
</script>

<template>
  <button
    type="button"
    class="rounded-agent border-agent-border bg-agent-surface focus-visible:ring-agent-accent relative block aspect-square overflow-hidden border focus-visible:ring-2 focus-visible:outline-none"
  >
    <video
      v-if="isVideo"
      :src="url"
      class="size-full object-cover"
      autoplay
      muted
      loop
      playsinline
    />
    <img v-else :src="url" :alt="filename" class="size-full object-cover" />
  </button>
</template>
