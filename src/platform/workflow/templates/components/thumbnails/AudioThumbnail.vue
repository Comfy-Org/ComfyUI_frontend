<template>
  <BaseThumbnail>
    <div
      class="flex size-full items-center justify-center p-4"
      :style="{
        backgroundImage: 'url(/assets/images/default-template.png)',
        backgroundRepeat: 'round'
      }"
    >
      <audio
        controls
        class="relative w-full"
        :src="src"
        data-testid="audio-player"
        @click.stop
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import BaseThumbnail from '@/platform/workflow/templates/components/thumbnails/BaseThumbnail.vue'

defineProps<{
  src: string
}>()
</script>
