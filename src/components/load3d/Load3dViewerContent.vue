<template>
  <div
    ref="viewerContentRef"
    class="flex w-full"
    :class="[maximized ? 'h-full' : 'h-[70vh]']"
    @mouseenter="viewer.handleMouseEnter"
    @mouseleave="viewer.handleMouseLeave"
  >
    <div ref="mainContentRef" class="flex-1 relative">
      <div
        ref="containerRef"
        class="absolute w-full h-full comfy-load-3d-viewer"
        @resize="viewer.handleResize"
        @dragover.prevent.stop="handleDragOver"
        @dragleave.stop="handleDragLeave"
        @drop.prevent.stop="handleDrop"
      />
      <div
        v-if="isDragging"
        class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
      >
        <div
          class="px-6 py-4 bg-blue-500/20 border-2 border-dashed border-blue-400 rounded-lg text-blue-100 text-lg font-medium"
        >
          {{ dragMessage }}
        </div>
      </div>
    </div>

    <div class="w-72 flex flex-col">
      <div class="flex-1 overflow-y-auto p-4">
        <div class="space-y-2">
          <div class="p-2 space-y-4">
            <SceneControls
              v-model:background-color="viewer.backgroundColor.value"
              v-model:show-grid="viewer.showGrid.value"
              :has-background-image="viewer.hasBackgroundImage.value"
              @update-background-image="viewer.handleBackgroundImageUpdate"
            />
          </div>

          <div class="p-2 space-y-4">
            <ModelControls
              v-model:up-direction="viewer.upDirection.value"
              v-model:material-mode="viewer.materialMode.value"
            />
          </div>

          <div class="p-2 space-y-4">
            <CameraControls
              v-model:camera-type="viewer.cameraType.value"
              v-model:fov="viewer.fov.value"
            />
          </div>

          <div class="p-2 space-y-4">
            <LightControls
              v-model:light-intensity="viewer.lightIntensity.value"
            />
          </div>

          <div class="p-2 space-y-4">
            <ExportControls @export-model="viewer.exportModel" />
          </div>
        </div>
      </div>

      <div class="p-4">
        <div class="flex gap-2">
          <Button
            icon="pi pi-times"
            severity="secondary"
            :label="t('g.cancel')"
            @click="handleCancel"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { onBeforeUnmount, onMounted, ref, toRaw } from 'vue'

import CameraControls from '@/components/load3d/controls/viewer/ViewerCameraControls.vue'
import ExportControls from '@/components/load3d/controls/viewer/ViewerExportControls.vue'
import LightControls from '@/components/load3d/controls/viewer/ViewerLightControls.vue'
import ModelControls from '@/components/load3d/controls/viewer/ViewerModelControls.vue'
import SceneControls from '@/components/load3d/controls/viewer/ViewerSceneControls.vue'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useLoad3dService } from '@/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  node: LGraphNode
}>()

// Drag and drop state
const isDragging = ref(false)
const dragMessage = ref('')
const SUPPORTED_EXTENSIONS = ['.gltf', '.glb', '.obj', '.fbx', '.stl']

function isValidModelFile(file: File): boolean {
  const fileName = file.name.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
}

const viewerContentRef = ref<HTMLDivElement>()
const containerRef = ref<HTMLDivElement>()
const mainContentRef = ref<HTMLDivElement>()
const maximized = ref(false)
const mutationObserver = ref<MutationObserver | null>(null)

const viewer = useLoad3dService().getOrCreateViewer(toRaw(props.node))

function handleDragOver(event: DragEvent) {
  if (viewer.isPreview.value) return

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

  if (viewer.isPreview.value) return

  if (!event.dataTransfer) return

  const files = Array.from(event.dataTransfer.files)

  if (files.length === 0) return

  const modelFile = files.find(isValidModelFile)

  if (modelFile) {
    await viewer.handleModelDrop(modelFile)
  } else {
    useToastStore().addAlert(t('load3d.unsupportedFileType'))
  }
}

onMounted(async () => {
  const source = useLoad3dService().getLoad3d(props.node)
  if (source && containerRef.value) {
    await viewer.initializeViewer(containerRef.value, source)
  }

  if (viewerContentRef.value) {
    mutationObserver.value = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'maximized'
        ) {
          maximized.value =
            (mutation.target as HTMLElement).getAttribute('maximized') ===
            'true'

          setTimeout(() => {
            viewer.refreshViewport()
          }, 0)
        }
      })
    })

    mutationObserver.value.observe(viewerContentRef.value, {
      attributes: true,
      attributeFilter: ['maximized']
    })
  }

  window.addEventListener('resize', viewer.handleResize)
})

const handleCancel = () => {
  viewer.restoreInitialState()
  useDialogStore().closeDialog()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', viewer.handleResize)

  if (mutationObserver.value) {
    mutationObserver.value.disconnect()
    mutationObserver.value = null
  }

  // we will manually cleanup the viewer in dialog close handler
})
</script>

<style scoped>
:deep(.p-panel-content) {
  padding: 0;
}
</style>
