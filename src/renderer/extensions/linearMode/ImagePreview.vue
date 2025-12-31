<script setup lang="ts">
import { useTemplateRef } from 'vue'

import ZoomPane from '@/components/ui/ZoomPane.vue'

const { src } = defineProps<{
  src: string
}>()

const imageRef = useTemplateRef('imageRef')
</script>
<template>
  <ZoomPane v-slot="slotProps" class="flex-1 w-full">
    <img ref="imageRef" :src v-bind="slotProps" />
  </ZoomPane>
  <span
    class="self-center z-10"
    v-text="
      imageRef?.naturalWidth && imageRef?.naturalHeight
        ? `${imageRef.naturalWidth} x ${imageRef.naturalHeight}`
        : ''
    "
  />
</template>
