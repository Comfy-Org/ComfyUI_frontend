<template>
  <Image
    v-if="result.mediaType === 'images'"
    :src="result.url"
    alt="Task Output"
    width="100%"
    height="100%"
    preview
  />
  <!-- TODO: handle more media types -->
  <div v-else class="task-result-preview">
    <i class="pi pi-file"></i>
    <span>{{ result.mediaType }}</span>
  </div>
</template>

<script setup lang="ts">
import { ResultItemImpl } from '@/stores/queueStore'
import Image from 'primevue/image'

const props = defineProps<{
  result: ResultItemImpl
}>()
</script>

<style scoped>
:deep(img) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.p-image-preview {
  position: static !important;
  display: contents !important;
}
</style>
