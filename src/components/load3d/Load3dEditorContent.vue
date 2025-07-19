<template>
  <div
    ref="editorContentRef"
    class="flex w-full"
    :class="[maximized ? 'h-full' : 'h-[70vh]']"
    @mouseenter="editor.handleMouseEnter"
    @mouseleave="editor.handleMouseLeave"
  >
    <div class="w-16 flex-col py-4 space-y-4">
      <Button
        v-for="item in menuItems"
        :key="item.id"
        class="w-12 h-12 rounded-lg items-center justify-center"
        :class="activePanel === item.id ? 'text-white' : 'text-gray-300'"
        @click="activePanel = item.id"
      >
        <i
          v-tooltip.right="{ value: item.title, showDelay: 300 }"
          :class="[item.icon, 'text-lg']"
        />
      </Button>
    </div>

    <div ref="mainContentRef" class="flex-1 relative">
      <div
        ref="containerRef"
        class="absolute w-full h-full comfy-load-3d-editor"
        @resize="editor.handleResize"
      />
    </div>

    <div class="w-64 p-4 flex flex-col">
      <div class="mb-4">
        {{ activePanelTitle }}
      </div>

      <div class="flex-1 space-y-4">
        <div v-show="activePanel === 'scene'" class="space-y-4">
          <SceneControls
            v-model:background-color="editor.backgroundColor.value"
            v-model:show-grid="editor.showGrid.value"
            :has-background-image="editor.hasBackgroundImage.value"
            @update-background-image="editor.handleBackgroundImageUpdate"
          />
        </div>

        <div v-show="activePanel === 'model'" class="space-y-4">
          <ModelControls
            v-model:up-direction="editor.upDirection.value"
            v-model:material-mode="editor.materialMode.value"
          />
        </div>

        <div v-show="activePanel === 'camera'" class="space-y-4">
          <CameraControls
            v-model:camera-type="editor.cameraType.value"
            v-model:fov="editor.fov.value"
          />
        </div>

        <div v-show="activePanel === 'light'" class="space-y-4">
          <LightControls
            v-model:light-intensity="editor.lightIntensity.value"
          />
        </div>

        <div v-show="activePanel === 'export'" class="space-y-4">
          <ExportControls @export-model="editor.exportModel" />
        </div>
      </div>

      <div class="flex gap-2 mt-4">
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
</template>

<script setup lang="ts">
import { LGraphNode } from '@comfyorg/litegraph'
import { Tooltip } from 'primevue'
import Button from 'primevue/button'
import { computed, onBeforeUnmount, onMounted, ref, toRef } from 'vue'

import CameraControls from '@/components/load3d/controls/editor/CameraControls.vue'
import ExportControls from '@/components/load3d/controls/editor/ExportControls.vue'
import LightControls from '@/components/load3d/controls/editor/LightControls.vue'
import ModelControls from '@/components/load3d/controls/editor/ModelControls.vue'
import SceneControls from '@/components/load3d/controls/editor/SceneControls.vue'
import { useLoad3dEditor } from '@/composables/useLoad3dEditor'
import { t } from '@/i18n'
import { useLoad3dService } from '@/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'

const vTooltip = Tooltip

const props = defineProps<{
  node: LGraphNode
}>()

const activePanel = ref('scene')
const menuItems = [
  { id: 'scene', icon: 'pi pi-image', title: t('load3d.editor.sceneSettings') },
  { id: 'model', icon: 'pi pi-box', title: t('load3d.editor.modelSettings') },
  {
    id: 'camera',
    icon: 'pi pi-camera',
    title: t('load3d.editor.cameraSettings')
  },
  { id: 'light', icon: 'pi pi-sun', title: t('load3d.editor.lightSettings') },
  {
    id: 'export',
    icon: 'pi pi-download',
    title: t('load3d.editor.exportSettings')
  }
]

const editorContentRef = ref<HTMLDivElement>()
const containerRef = ref<HTMLDivElement>()
const mainContentRef = ref<HTMLDivElement>()
const maximized = ref(false)
const mutationObserver = ref<MutationObserver | null>(null)

const editor = useLoad3dEditor(toRef(props, 'node'))

const activePanelTitle = computed(() => {
  return menuItems.find((item) => item.id === activePanel.value)?.title || ''
})

onMounted(async () => {
  const source = useLoad3dService().getLoad3d(props.node)
  if (source && containerRef.value) {
    await editor.initializeEditor(containerRef.value, source)
  }

  if (editorContentRef.value) {
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
            editor.refreshViewport()
          }, 0)
        }
      })
    })

    mutationObserver.value.observe(editorContentRef.value, {
      attributes: true,
      attributeFilter: ['maximized']
    })
  }

  window.addEventListener('resize', editor.handleResize)
})

const handleCancel = () => {
  editor.restoreInitialState()
  useDialogStore().closeDialog()
}

const handleConfirm = async () => {
  const success = await editor.applyChanges()
  if (!success) {
    editor.restoreInitialState()
  }

  useDialogStore().closeDialog()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', editor.handleResize)

  if (mutationObserver.value) {
    mutationObserver.value.disconnect()
    mutationObserver.value = null
  }

  editor.cleanup()
})
</script>
