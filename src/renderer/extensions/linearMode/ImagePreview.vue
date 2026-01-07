<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import ZoomPane from '@/components/ui/ZoomPane.vue'

const { src } = defineProps<{
  src: string
}>()

const imageRef = useTemplateRef('imageRef')
const width = ref('')
const height = ref('')
</script>
<template>
  <ZoomPane v-slot="slotProps" class="flex-1 w-full">
    <img
      ref="imageRef"
      :src
      v-bind="slotProps"
      @load="
        () => {
          if (!imageRef) return
          width = `${imageRef.naturalWidth}`
          height = `${imageRef.naturalHeight}`
        }
      "
    />
  </ZoomPane>
  <span class="self-center z-10" v-text="`${width} x ${height}`" />
</template>
