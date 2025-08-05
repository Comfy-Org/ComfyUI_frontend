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
      />
    </div>

    <div class="w-72 flex flex-col">
      <div class="flex-1 overflow-y-auto p-4">
        <div class="space-y-2">
          <Panel v-model:collapsed="panelStates.scene" toggleable>
            <template #header>
              <div class="flex items-center gap-2">
                <i class="pi pi-image" />
                <span>{{ t('load3d.viewer.sceneSettings') }}</span>
              </div>
            </template>
            <div class="p-4 space-y-4">
              <SceneControls
                v-model:background-color="viewer.backgroundColor.value"
                v-model:show-grid="viewer.showGrid.value"
                :has-background-image="viewer.hasBackgroundImage.value"
                @update-background-image="viewer.handleBackgroundImageUpdate"
              />
            </div>
          </Panel>

          <Panel v-model:collapsed="panelStates.model" toggleable>
            <template #header>
              <div class="flex items-center gap-2">
                <i class="pi pi-box" />
                <span>{{ t('load3d.viewer.modelSettings') }}</span>
              </div>
            </template>
            <div class="p-4 space-y-4">
              <ModelControls
                v-model:up-direction="viewer.upDirection.value"
                v-model:material-mode="viewer.materialMode.value"
              />
            </div>
          </Panel>

          <Panel v-model:collapsed="panelStates.camera" toggleable>
            <template #header>
              <div class="flex items-center gap-2">
                <i class="pi pi-camera" />
                <span>{{ t('load3d.viewer.cameraSettings') }}</span>
              </div>
            </template>
            <div class="p-4 space-y-4">
              <CameraControls
                v-model:camera-type="viewer.cameraType.value"
                v-model:fov="viewer.fov.value"
              />
            </div>
          </Panel>

          <Panel v-model:collapsed="panelStates.light" toggleable>
            <template #header>
              <div class="flex items-center gap-2">
                <i class="pi pi-sun" />
                <span>{{ t('load3d.viewer.lightSettings') }}</span>
              </div>
            </template>
            <div class="p-4 space-y-4">
              <LightControls
                v-model:light-intensity="viewer.lightIntensity.value"
              />
            </div>
          </Panel>

          <Panel v-model:collapsed="panelStates.export" toggleable>
            <template #header>
              <div class="flex items-center gap-2">
                <i class="pi pi-download" />
                <span>{{ t('load3d.viewer.exportSettings') }}</span>
              </div>
            </template>
            <div class="p-4 space-y-4">
              <ExportControls @export-model="viewer.exportModel" />
            </div>
          </Panel>
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
          <Button
            icon="pi pi-check"
            severity="secondary"
            :label="t('g.apply')"
            @click="handleConfirm"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LGraphNode } from '@comfyorg/litegraph'
import Button from 'primevue/button'
import Panel from 'primevue/panel'
import { onBeforeUnmount, onMounted, ref, toRef } from 'vue'

import CameraControls from '@/components/load3d/controls/viewer/CameraControls.vue'
import ExportControls from '@/components/load3d/controls/viewer/ExportControls.vue'
import LightControls from '@/components/load3d/controls/viewer/LightControls.vue'
import ModelControls from '@/components/load3d/controls/viewer/ModelControls.vue'
import SceneControls from '@/components/load3d/controls/viewer/SceneControls.vue'
import { useLoad3dViewer } from '@/composables/useLoad3dViewer'
import { t } from '@/i18n'
import { useLoad3dService } from '@/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  node: LGraphNode
}>()

const viewerContentRef = ref<HTMLDivElement>()
const containerRef = ref<HTMLDivElement>()
const mainContentRef = ref<HTMLDivElement>()
const maximized = ref(false)
const mutationObserver = ref<MutationObserver | null>(null)

const panelStates = ref({
  scene: false,
  model: true,
  camera: true,
  light: true,
  export: true
})

const viewer = useLoad3dViewer(toRef(props, 'node'))

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

const handleConfirm = async () => {
  const success = await viewer.applyChanges()
  if (!success) {
    viewer.restoreInitialState()
  }

  useDialogStore().closeDialog()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', viewer.handleResize)

  if (mutationObserver.value) {
    mutationObserver.value.disconnect()
    mutationObserver.value = null
  }

  viewer.cleanup()
})
</script>

<style scoped>
:deep(.p-panel-content) {
  padding: 0;
}
</style>
