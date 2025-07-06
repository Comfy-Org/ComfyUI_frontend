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
import LightControls from '@/components/load3d/controls/editor/LightControls.vue'
import SceneControls from '@/components/load3d/controls/editor/SceneControls.vue'
import Load3d from '@/extensions/core/load3d/Load3d'
import { CameraType } from '@/extensions/core/load3d/interfaces'
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
  {
    id: 'camera',
    icon: 'pi pi-camera',
    title: t('load3d.editor.cameraSettings')
  },
  { id: 'light', icon: 'pi pi-sun', title: t('load3d.editor.lightSettings') }
]

const showFOVButton = ref(false)

const editorContentRef = ref<HTMLDivElement>()
const containerRef = ref<HTMLDivElement>()
const mainContentRef = ref<HTMLDivElement>()
const maximized = ref(false)

const backgroundColor = ref('#282828')
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
  load3d?.setBackgroundColor(color)
}

function toggleGrid(show: boolean) {
  showGrid.value = show

  load3d?.toggleGrid(showGrid.value)
}

function toggleCamera(camera: CameraType) {
  cameraType.value = camera
  load3d?.toggleCamera(cameraType.value)
}

function updateFOV(fovValue: number) {
  fov.value = fovValue
  load3d?.setFOV(Number(fov.value))
}

function updateLightIntensity(lightValue: number) {
  lightIntensity.value = lightValue

  load3d?.setLightIntensity(Number(lightIntensity.value))
}

function initializeEditor(source: Load3d) {
  if (!containerRef.value) return

  sourceLoad3d = source

  load3d = new Load3d(containerRef.value, {
    node: props.node
  })

  const sourceModel = source.modelManager.currentModel
  if (sourceModel) {
    const modelClone = sourceModel.clone()

    load3d.modelManager.currentModel = modelClone
    load3d.sceneManager.scene.add(modelClone)

    load3d.modelManager.materialMode = source.modelManager.materialMode
    load3d.modelManager.currentUpDirection =
      source.modelManager.currentUpDirection

    load3d.setMaterialMode(source.modelManager.materialMode)
    load3d.setUpDirection(source.modelManager.currentUpDirection)

    if (source.modelManager.appliedTexture) {
      load3d.modelManager.appliedTexture = source.modelManager.appliedTexture
    }
  }

  const sourceCameraType = source.getCurrentCameraType()
  const sourceCameraState = source.getCameraState()

  cameraType.value = sourceCameraType
  load3d.toggleCamera(sourceCameraType)
  load3d.setCameraState(sourceCameraState)

  backgroundColor.value = source.sceneManager.currentBackgroundColor

  load3d.setBackgroundColor(backgroundColor.value)

  showGrid.value = source.sceneManager.gridHelper.visible
  load3d.toggleGrid(showGrid.value)

  lightIntensity.value = source.lightingManager.lights[1]?.intensity || 1
  load3d.setLightIntensity(lightIntensity.value)

  if (sourceCameraType === 'perspective') {
    fov.value = source.cameraManager.perspectiveCamera.fov
    load3d.setFOV(fov.value)
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
}

function handleViewportRefresh() {
  if (!load3d || !mainContentRef.value) return

  load3d.handleResize()

  const currentType = load3d.getCurrentCameraType()

  load3d.toggleCamera(
    currentType === 'perspective' ? 'orthographic' : 'perspective'
  )
  load3d.toggleCamera(currentType)

  load3d.controlsManager.controls.update()
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
            handleViewportRefresh()
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
    load3d.handleResize()
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

  sourceLoad3d.setBackgroundColor(backgroundColor.value)

  sourceLoad3d.toggleGrid(showGrid.value)

  if (sourceLoad3d.getCurrentCameraType() !== cameraType.value) {
    sourceLoad3d.toggleCamera(cameraType.value)
  }

  if (cameraType.value === 'perspective') {
    sourceLoad3d.setFOV(fov.value)
  }

  sourceLoad3d.setLightIntensity(lightIntensity.value)

  const editorCameraState = load3d.getCameraState()
  sourceLoad3d.setCameraState(editorCameraState)

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
