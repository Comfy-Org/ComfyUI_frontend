<template>
  <div
    ref="container"
    class="w-full h-full relative comfy-load-3d"
    data-capture-wheel="true"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @mousedown.stop
    @mousemove.stop
    @mouseup.stop
    @contextmenu.stop.prevent
    @dragover.prevent.stop="handleDragOver"
    @dragleave.stop="handleDragLeave"
    @drop.prevent.stop="handleDrop"
  >
    <LoadingOverlay
      ref="loadingOverlayRef"
      :loading="props.loading"
      :loading-message="props.loadingMessage"
    />
    <div
      v-if="!isPreview && isDragging"
      class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
    >
      <div
        class="px-6 py-4 bg-blue-500/20 border-2 border-dashed border-blue-400 rounded-lg text-blue-100 text-lg font-medium"
      >
        {{ dragMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import LoadingOverlay from '@/components/load3d/LoadingOverlay.vue'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

const props = defineProps<{
  initializeLoad3d: (containerRef: HTMLElement) => Promise<void>
  cleanup: () => void
  loading: boolean
  loadingMessage: string
  onModelDrop?: (file: File) => void | Promise<void>
  isPreview: boolean
}>()

const container = ref<HTMLElement | null>(null)
const loadingOverlayRef = ref<InstanceType<typeof LoadingOverlay> | null>(null)
const isDragging = ref(false)
const dragMessage = ref('')

const SUPPORTED_EXTENSIONS = ['.gltf', '.glb', '.obj', '.fbx', '.stl']

function isValidModelFile(file: File): boolean {
  const fileName = file.name.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
}

function handleDragOver(event: DragEvent) {
  if (!event.dataTransfer) return

  const hasFiles = event.dataTransfer.types.includes('Files')

  if (!hasFiles) return

  isDragging.value = true

  event.dataTransfer.dropEffect = 'copy'
  dragMessage.value = t('load3d.dropToLoad')
}

function handleDragLeave() {
  isDragging.value = false
}

async function handleDrop(event: DragEvent) {
  isDragging.value = false

  if (!event.dataTransfer || !props.onModelDrop) return

  const files = Array.from(event.dataTransfer.files)

  if (files.length === 0) return

  const modelFile = files.find(isValidModelFile)

  if (modelFile) {
    await props.onModelDrop(modelFile)
  } else {
    useToastStore().addAlert(t('load3d.unsupportedFileType'))
  }
}

onMounted(() => {
  if (container.value) {
    void props.initializeLoad3d(container.value)
  }
})

onUnmounted(() => {
  props.cleanup()
})
</script>
