<script setup lang="ts">
// What came back, filling the panel the way a model's result does. A video is
// not a larger image: it needs its own controls, and the browser refusing to
// play it is not the run having failed.
const { url, name, mime } = defineProps<{
  url: string
  name: string
  mime: string
}>()

const frame = 'size-full object-contain'
</script>

<template>
  <div
    class="relative aspect-video max-h-[70dvh] w-full flex-1 overflow-hidden bg-black/20"
  >
    <video
      v-if="mime.startsWith('video/')"
      :src="url"
      controls
      playsinline
      :class="frame"
      data-testid="workflow-run-output"
    />
    <img
      v-else
      :src="url"
      :alt="name"
      :class="frame"
      data-testid="workflow-run-output"
    />
  </div>
</template>
