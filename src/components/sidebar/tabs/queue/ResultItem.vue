<template>
  <div
    ref="resultContainer"
    class="result-container"
    @click="handlePreviewClick"
  >
    <ComfyImage
      v-if="result.isImage"
      :src="result.url"
      class="task-output-image"
      :contain="imageFit === 'contain'"
      :alt="result.filename"
    />
    <ResultVideo v-else-if="result.isVideo" :result="result" />
    <ResultAudio v-else-if="result.isAudio" :result="result" />
    <div v-else class="task-result-preview">
      <i class="pi pi-file" />
      <span>{{ result.mediaType }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import ComfyImage from '@/components/common/ComfyImage.vue'
import { ResultItemImpl } from '@/stores/queueStore'
import { useSettingStore } from '@/stores/settingStore'

import ResultAudio from './ResultAudio.vue'
import ResultVideo from './ResultVideo.vue'

const props = defineProps<{
  result: ResultItemImpl
}>()

const emit = defineEmits<{
  (e: 'preview', result: ResultItemImpl): void
}>()

const resultContainer = ref<HTMLElement | null>(null)
const settingStore = useSettingStore()
const imageFit = computed<string>(() =>
  settingStore.get('Comfy.Queue.ImageFit')
)

const handlePreviewClick = () => {
  if (props.result.supportsPreview) {
    emit('preview', props.result)
  }
}

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
  cursor: pointer;
  transition: transform 0.2s ease;
}

.result-container:hover {
  transform: scale(1.02);
}
</style>
