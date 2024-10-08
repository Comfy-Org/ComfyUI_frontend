<template>
  <div class="result-container" ref="resultContainer">
    <template v-if="result.isImage">
      <ComfyImage
        :src="result.url"
        class="task-output-image"
        :contain="imageFit === 'contain'"
      />
      <div class="image-preview-mask">
        <Button
          icon="pi pi-eye"
          severity="secondary"
          @click="emit('preview', result)"
          rounded
        />
      </div>
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
import ComfyImage from '@/components/common/ComfyImage.vue'
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useSettingStore } from '@/stores/settingStore'

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
  z-index: 1;
}

.result-container:hover .image-preview-mask {
  opacity: 1;
}
</style>
