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

const props = defineProps<{
  node: any
  type: 'Load3DAnimation' | 'Preview3DAnimation'
  backgroundColor: string
  showGrid: boolean
  lightIntensity: number
  fov: number
  cameraType: 'perspective' | 'orthographic'
  showPreview: boolean
  materialMode: 'original' | 'normal' | 'wireframe' | 'depth'
  showFOVButton: boolean
  showLightIntensityButton: boolean
  playing: boolean
  selectedSpeed: number
  selectedAnimation: number
}>()

const node = ref(props.node)
const backgroundColor = ref(props.backgroundColor)
const showPreview = ref(props.showPreview)
const fov = ref(props.fov)
const lightIntensity = ref(props.lightIntensity)
const cameraType = ref(props.cameraType)
const showGrid = ref(props.showGrid)
const materialMode = ref(props.materialMode)
const showFOVButton = ref(props.showFOVButton)
const showLightIntensityButton = ref(props.showLightIntensityButton)
const load3DSceneRef = ref(null)

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
  () => props.showPreview,
  (newValue) => {
    showPreview.value = newValue
  }
)

watch(
  () => props.playing,
  (newValue) => {
    load3DSceneRef.value.load3d.toggleAnimation(newValue)
  }
)

watch(
  () => props.selectedSpeed,
  (newValue) => {
    load3DSceneRef.value.load3d.setAnimationSpeed(newValue)
  }
)

watch(
  () => props.selectedAnimation,
  (newValue) => {
    load3DSceneRef.value.load3d.updateSelectedAnimation(newValue)
  }
)

const emit = defineEmits<{
  (e: 'animationListChange', animationList: string): void
}>()

const listenMaterialModeChange = (
  mode: 'original' | 'normal' | 'wireframe' | 'depth'
) => {
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

const listenCameraTypeChange = (value: 'perspective' | 'orthographic') => {
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
</script>
