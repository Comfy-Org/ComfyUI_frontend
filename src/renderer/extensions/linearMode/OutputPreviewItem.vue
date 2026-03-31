<script setup lang="ts">
import LinearProgressBar from '@/renderer/extensions/linearMode/LinearProgressBar.vue'

const { latentPreview } = defineProps<{
  latentPreview?: string
}>()
</script>
<template>
  <div class="w-10">
    <img
      v-if="latentPreview"
      data-testid="linear-latent-preview"
      class="block size-10 rounded-sm object-cover"
      :src="latentPreview"
    />
    <div
      v-else
      data-testid="linear-skeleton"
      class="skeleton-shimmer size-10 rounded-sm"
    />
    <LinearProgressBar class="mt-1 h-1 w-10" rounded />
  </div>
</template>
