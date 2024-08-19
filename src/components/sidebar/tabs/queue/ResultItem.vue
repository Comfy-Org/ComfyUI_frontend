<template>
  <div class="result-container" ref="resultContainer">
    <template
      v-if="result.mediaType === 'images' || result.mediaType === 'gifs'"
    >
      <div class="image-preview-mask">
        <Button
          icon="pi pi-eye"
          severity="secondary"
          @click="emit('preview', result)"
          rounded
        />
      </div>
      <img :src="result.url" class="task-output-image" />
    </template>
    <!-- TODO: handle more media types -->
    <div v-else class="task-result-preview">
      <i class="pi pi-file"></i>
      <span>{{ result.mediaType }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ResultItemImpl } from '@/stores/queueStore'
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'

const props = defineProps<{
  result: ResultItemImpl
}>()

const emit = defineEmits<{
  (e: 'preview', ResultItemImpl): void
}>()

const resultContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  if (props.result.mediaType === 'images') {
    resultContainer.value?.querySelectorAll('img').forEach((img) => {
      img.draggable = true
    })
  }
})
</script>

<style scoped>
.result-container {
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.task-output-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.image-preview-mask {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.result-container:hover .image-preview-mask {
  opacity: 1;
}
</style>
