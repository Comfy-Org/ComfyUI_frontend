<template>
  <div
    ref="editorContentRef"
    class="flex w-full"
    :class="[maximized ? 'h-full' : 'h-[70vh]']"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
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
        @resize="handleResize"
      />
    </div>

    <div class="w-64 p-4 flex flex-col">
      <div class="mb-4">
        {{ activePanelTitle }}
      </div>

      <div class="flex-1 space-y-4">
        <div v-show="activePanel === 'scene'" class="space-y-4">
          <SceneControls
            :background-color="backgroundColor"
            :show-grid="showGrid"
            @toggle-grid="toggleGrid"
            @update-background-color="updateBackgroundColor"
          />
        </div>

        <div v-show="activePanel === 'camera'" class="space-y-4">
          <CameraControls
            :camera-type="cameraType"
            :fov="fov"
            :show-f-o-v-button="showFOVButton"
            @switch-camera="toggleCamera"
            @update-f-o-v="updateFOV"
          />
        </div>

        <div v-show="activePanel === 'light'" class="space-y-4">
          <LightControls
            :light-intensity="lightIntensity"
            @update-light-intensity="updateLightIntensity"
          />
        </div>

        <div v-show="activePanel === 'export'" class="space-y-4">
          <ExportControls @export-model="exportModel" />
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import CameraControls from '@/components/load3d/controls/editor/CameraControls.vue'
import ExportControls from '@/components/load3d/controls/editor/ExportControls.vue'
import LightControls from '@/components/load3d/controls/editor/LightControls.vue'
import SceneControls from '@/components/load3d/controls/editor/SceneControls.vue'
import Load3d from '@/extensions/core/load3d/Load3d'
import { CameraType } from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'
import { useLoad3dService } from '@/services/load3dService'
import { useDialogStore } from '@/stores/dialogStore'
import { useToastStore } from '@/stores/toastStore'

const vTooltip = Tooltip

const props = defineProps<{
  node: LGraphNode
}>()

const activePanel = ref('scene')

const menuItems = [
  { id: 'scene', icon: 'pi pi-image', title: t('load3d.editor.sceneSettings') },
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

const showFOVButton = ref(false)

const editorContentRef = ref<HTMLDivElement>()
const containerRef = ref<HTMLDivElement>()
const mainContentRef = ref<HTMLDivElement>()
const maximized = ref(false)

const backgroundColor = ref('')
const showGrid = ref(true)
const cameraType = ref<CameraType>('perspective')
const fov = ref(75)
const lightIntensity = ref(1)

let load3d: Load3d | null = null
let sourceLoad3d: Load3d | null = null

const initialState = ref({
  backgroundColor: '#282828',
  showGrid: true,
  cameraType: 'perspective' as CameraType,
  fov: 75,
  lightIntensity: 1,
  cameraState: null as any
})

const activePanelTitle = computed(() => {
  return menuItems.find((item) => item.id === activePanel.value)?.title || ''
})

const updateBackgroundColor = (color: string) => {
  backgroundColor.value = color

  try {
    load3d?.setBackgroundColor(color)
  } catch (error) {
    console.error('Error updating background color:', error)
    useToastStore().addAlert(
      t('toastMessages.failedToUpdateBackgroundColor', {
        color: color
      })
    )
  }
}

function toggleGrid(show: boolean) {
  showGrid.value = show

  try {
    load3d?.toggleGrid(showGrid.value)
  } catch (error) {
    console.error('Error toggling grid:', error)
    useToastStore().addAlert(
      t('toastMessages.failedToToggleGrid', {
        show: show ? 'on' : 'off'
      })
    )
  }
}

function toggleCamera(camera: CameraType) {
  cameraType.value = camera

  try {
    load3d?.toggleCamera(cameraType.value)
  } catch (error) {
    console.error('Error toggling camera:', error)
    useToastStore().addAlert(
      t('toastMessages.failedToToggleCamera', {
        camera: cameraType.value
      })
    )
  }
}

const exportModel = async (format: string) => {
  try {
    await load3d?.exportModel(format)
  } catch (error) {
    console.error('Error exporting model:', error)
    useToastStore().addAlert(
      t('toastMessages.failedToExportModel', {
        format: format.toUpperCase()
      })
    )
  }
}

function updateFOV(fovValue: number) {
  fov.value = fovValue

  try {
    load3d?.setFOV(Number(fov.value))
  } catch (error) {
    console.error('Error updating FOV:', error)
    useToastStore().addAlert(
      t('toastMessages.failedToUpdateFOV', {
        fov: fov.value
      })
    )
  }
}

function updateLightIntensity(lightValue: number) {
  lightIntensity.value = lightValue

  try {
    load3d?.setLightIntensity(Number(lightIntensity.value))
  } catch (error) {
    console.error('Error updating light intensity:', error)
    useToastStore().addAlert(
      t('toastMessages.failedToUpdateLightIntensity', {
        intensity: lightIntensity.value
      })
    )
  }
}

function initializeEditor(source: Load3d) {
  if (!containerRef.value) return

  sourceLoad3d = source

  try {
    load3d = new Load3d(containerRef.value, {
      node: props.node
    })

    useLoad3dService().copyLoad3dState(source, load3d)

    const sourceCameraType = source.getCurrentCameraType()
    const sourceCameraState = source.getCameraState()

    cameraType.value = sourceCameraType

    backgroundColor.value = source.sceneManager.currentBackgroundColor

    showGrid.value = source.sceneManager.gridHelper.visible

    lightIntensity.value = source.lightingManager.lights[1]?.intensity || 1

    if (sourceCameraType === 'perspective') {
      fov.value = source.cameraManager.perspectiveCamera.fov
    }

    showFOVButton.value = cameraType.value === 'perspective'

    initialState.value = {
      backgroundColor: backgroundColor.value,
      showGrid: showGrid.value,
      cameraType: cameraType.value,
      fov: fov.value,
      lightIntensity: lightIntensity.value,
      cameraState: sourceCameraState
    }
  } catch (error) {
    console.error('Error initializing Load3d editor:', error)
    useToastStore().addAlert(t('toastMessages.failedToInitializeLoad3dEditor'))
  }
}

onMounted(async () => {
  const source = useLoad3dService().getLoad3d(props.node)
  if (source) {
    initializeEditor(source)
  }

  if (editorContentRef.value) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'maximized'
        ) {
          maximized.value =
            (mutation.target as HTMLElement).getAttribute('maximized') ===
            'true'

          setTimeout(() => {
            useLoad3dService().handleViewportRefresh(load3d)
          }, 0)
        }
      })
    })

    observer.observe(editorContentRef.value, {
      attributes: true,
      attributeFilter: ['maximized']
    })
  }

  window.addEventListener('resize', handleResize)
})

const handleMouseEnter = () => {
  if (load3d) {
    load3d.updateStatusMouseOnEditor(true)
  }
}

const handleMouseLeave = () => {
  if (load3d) {
    load3d.updateStatusMouseOnEditor(false)
  }
}

const handleResize = () => {
  if (load3d) {
    load3d?.handleResize()
  }
}

const handleCancel = () => {
  const node = props.node

  if (node.properties) {
    node.properties['Background Color'] = initialState.value.backgroundColor
    node.properties['Show Grid'] = initialState.value.showGrid
    node.properties['Camera Type'] = initialState.value.cameraType
    node.properties['FOV'] = initialState.value.fov
    node.properties['Light Intensity'] = initialState.value.lightIntensity
    node.properties['Camera Info'] = initialState.value.cameraState
  }

  useDialogStore().closeDialog()
}

const handleConfirm = () => {
  if (!sourceLoad3d || !load3d) {
    useDialogStore().closeDialog()
    return
  }

  useLoad3dService().copyLoad3dState(load3d, sourceLoad3d)

  const editorCameraState = load3d.getCameraState()

  const node = props.node
  if (node.properties) {
    node.properties['Background Color'] = backgroundColor.value
    node.properties['Show Grid'] = showGrid.value
    node.properties['Camera Type'] = cameraType.value
    node.properties['FOV'] = fov.value
    node.properties['Light Intensity'] = lightIntensity.value
    node.properties['Camera Info'] = editorCameraState
  }

  sourceLoad3d.forceRender()

  if (node.graph) {
    node.graph.setDirtyCanvas(true, true)
  }

  useDialogStore().closeDialog()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)

  load3d?.remove()
  load3d = null
  sourceLoad3d = null
})
</script>
