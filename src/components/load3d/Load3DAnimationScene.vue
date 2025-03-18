<template>
  <Load3DScene
    :node="node"
    :type="type"
    :backgroundColor="backgroundColor"
    :showGrid="showGrid"
    :lightIntensity="lightIntensity"
    :fov="fov"
    :cameraType="cameraType"
    :showPreview="showPreview"
    :extraListeners="animationListeners"
    :backgroundImage="backgroundImage"
    :upDirection="upDirection"
    :materialMode="materialMode"
    @materialModeChange="listenMaterialModeChange"
    @backgroundColorChange="listenBackgroundColorChange"
    @lightIntensityChange="listenLightIntensityChange"
    @fovChange="listenFOVChange"
    @cameraTypeChange="listenCameraTypeChange"
    @showGridChange="listenShowGridChange"
    @showPreviewChange="listenShowPreviewChange"
    ref="load3DSceneRef"
  />
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'

import Load3DScene from '@/components/load3d/Load3DScene.vue'
import Load3dAnimation from '@/extensions/core/load3d/Load3dAnimation'
import {
  CameraType,
  Load3DAnimationNodeType,
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'

const props = defineProps<{
  node: any
  type: Load3DAnimationNodeType
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

const animationListeners = {
  animationListChange: (newValue: any) => {
    emit('animationListChange', newValue)
  }
}

defineExpose({
  load3DSceneRef
})
</script>
