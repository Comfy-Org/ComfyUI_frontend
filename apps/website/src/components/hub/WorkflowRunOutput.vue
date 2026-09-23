<script setup lang="ts">
// What came back. A video is not a larger image: it needs its own controls,
// and the browser refusing to play it is not the run having failed.
const { url, name, mime } = defineProps<{
  url: string
  name: string
  mime: string
}>()

const frame = 'w-full rounded-2xl bg-hub-surface'
</script>

<template>
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
</template>
