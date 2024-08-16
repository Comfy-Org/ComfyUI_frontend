<template>
  <div class="result-container" ref="resultContainer">
    <Image
      v-if="result.mediaType === 'images'"
      :src="result.url"
      alt="Task Output"
      width="100%"
      height="100%"
    />
    <!-- TODO: handle more media types -->
    <div v-else class="task-result-preview">
      <i class="pi pi-file"></i>
      <span>{{ result.mediaType }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ResultItemImpl } from '@/stores/queueStore'
import Image from 'primevue/image'
import { onMounted, ref } from 'vue'

const props = defineProps<{
  result: ResultItemImpl
}>()

const resultContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  if (props.result.mediaType === 'images') {
    resultContainer.value.querySelectorAll('img').forEach((img) => {
      img.draggable = true
    })
  }
})
</script>

<style scoped>
.result-container {
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

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
  position: static;
  display: contents;
}
</style>
