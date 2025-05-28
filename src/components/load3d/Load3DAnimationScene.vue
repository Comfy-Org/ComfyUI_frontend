<template>
  <Load3DScene
    ref="load3DSceneRef"
    :node="node"
    :input-spec="inputSpec"
    :background-color="backgroundColor"
    :show-grid="showGrid"
    :light-intensity="lightIntensity"
    :fov="fov"
    :camera-type="cameraType"
    :show-preview="showPreview"
    :extra-listeners="animationListeners"
    :background-image="backgroundImage"
    :up-direction="upDirection"
    :material-mode="materialMode"
    @material-mode-change="listenMaterialModeChange"
    @background-color-change="listenBackgroundColorChange"
    @light-intensity-change="listenLightIntensityChange"
    @fov-change="listenFOVChange"
    @camera-type-change="listenCameraTypeChange"
    @show-grid-change="listenShowGridChange"
    @show-preview-change="listenShowPreviewChange"
    @recording-status-change="listenRecordingStatusChange"
  />
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'

import Load3DScene from '@/components/load3d/Load3DScene.vue'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
import {
  CameraType,
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

const props = defineProps<{
  node: any
  inputSpec: CustomInputSpec
  backgroundColor: string
  showGrid: boolean
  lightIntensity: number
  fov: number
  cameraType: CameraType
  showPreview: boolean
  materialMode: MaterialMode
  upDirection: UpDirection
  showFOVButton: boolean
  showLightIntensityButton: boolean
  playing: boolean
  selectedSpeed: number
  selectedAnimation: number
  backgroundImage: string
}>()

const node = ref(props.node)
const backgroundColor = ref(props.backgroundColor)
const showPreview = ref(props.showPreview)
const fov = ref(props.fov)
const lightIntensity = ref(props.lightIntensity)
const cameraType = ref(props.cameraType)
const showGrid = ref(props.showGrid)
const upDirection = ref(props.upDirection)
const materialMode = ref(props.materialMode)
const showFOVButton = ref(props.showFOVButton)
const showLightIntensityButton = ref(props.showLightIntensityButton)
const load3DSceneRef = ref<InstanceType<typeof Load3DScene> | null>(null)

watch(
  () => props.cameraType,
  (newValue) => {
    cameraType.value = newValue
  }
)

watch(
  () => props.showGrid,
  (newValue) => {
    showGrid.value = newValue
  }
)

watch(
  () => props.backgroundColor,
  (newValue) => {
    backgroundColor.value = newValue
  }
)

watch(
  () => props.lightIntensity,
  (newValue) => {
    lightIntensity.value = newValue
  }
)

watch(
  () => props.fov,
  (newValue) => {
    fov.value = newValue
  }
)

watch(
  () => props.upDirection,
  (newValue) => {
    upDirection.value = newValue
  }
)

watch(
  () => props.materialMode,
  (newValue) => {
    materialMode.value = newValue
  }
)

watch(
  () => props.showPreview,
  (newValue) => {
    showPreview.value = newValue
  }
)

watch(
  () => props.playing,
  (newValue) => {
    const load3d = load3DSceneRef.value?.load3d as Load3dAnimation | null
    load3d?.toggleAnimation(newValue)
  }
)

watch(
  () => props.selectedSpeed,
  (newValue) => {
    const load3d = load3DSceneRef.value?.load3d as Load3dAnimation | null
    load3d?.setAnimationSpeed(newValue)
  }
)

watch(
  () => props.selectedAnimation,
  (newValue) => {
    const load3d = load3DSceneRef.value?.load3d as Load3dAnimation | null
    load3d?.updateSelectedAnimation(newValue)
  }
)

const emit = defineEmits<{
  (e: 'animationListChange', animationList: string): void
  (e: 'materialModeChange', materialMode: string): void
  (e: 'backgroundColorChange', color: string): void
  (e: 'lightIntensityChange', lightIntensity: number): void
  (e: 'fovChange', fov: number): void
  (e: 'cameraTypeChange', cameraType: string): void
  (e: 'showGridChange', showGrid: boolean): void
  (e: 'showPreviewChange', showPreview: boolean): void
  (e: 'upDirectionChange', direction: string): void
  (e: 'recording-status-change', status: boolean): void
}>()

const listenMaterialModeChange = (mode: MaterialMode) => {
  materialMode.value = mode

  showLightIntensityButton.value = mode === 'original'
}

const listenBackgroundColorChange = (value: string) => {
  backgroundColor.value = value
}

const listenLightIntensityChange = (value: number) => {
  lightIntensity.value = value
}

const listenFOVChange = (value: number) => {
  fov.value = value
}

const listenCameraTypeChange = (value: CameraType) => {
  cameraType.value = value

  showFOVButton.value = cameraType.value === 'perspective'
}

const listenShowGridChange = (value: boolean) => {
  showGrid.value = value
}

const listenShowPreviewChange = (value: boolean) => {
  showPreview.value = value
}

const listenRecordingStatusChange = (value: boolean) => {
  emit('recording-status-change', value)
}

const animationListeners = {
  animationListChange: (newValue: any) => {
    emit('animationListChange', newValue)
  }
}

defineExpose({
  load3DSceneRef
})
</script>
