<script setup lang="ts">
import Loader from '@/components/loader/Loader.vue'

const { latentPreview } = defineProps<{
  latentPreview?: string
}>()
</script>
<template>
  <img
    v-if="latentPreview"
    data-testid="linear-latent-preview"
    class="block size-10 rounded-sm object-cover"
    :src="latentPreview"
  />
  <div
    v-else
    data-testid="linear-skeleton"
    class="flex size-10 items-center justify-center rounded-sm bg-secondary-background"
  >
    <Loader variant="loader-circle" size="sm" class="text-muted-foreground" />
  </div>
</template>
