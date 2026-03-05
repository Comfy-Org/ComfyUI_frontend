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
      class="block size-10 rounded-sm object-cover"
      :src="latentPreview"
    />
    <div v-else class="size-10 rounded-sm skeleton-shimmer" />
    <LinearProgressBar class="w-10 h-1 mt-1" rounded />
  </div>
</template>
