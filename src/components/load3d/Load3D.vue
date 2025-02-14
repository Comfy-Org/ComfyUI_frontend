<template>
  <div class="relative w-full h-full">
    <Load3DScene
      :node="node"
      :type="type"
      :backgroundColor="backgroundColor"
      :showGrid="showGrid"
      :lightIntensity="lightIntensity"
      :fov="fov"
      :cameraType="cameraType"
      :showPreview="showPreview"
      @materialModeChange="listenMaterialModeChange"
      @backgroundColorChange="listenBackgroundColorChange"
      @lightIntensityChange="listenLightIntensityChange"
      @fovChange="listenFOVChange"
      @cameraTypeChange="listenCameraTypeChange"
      @showGridChange="listenShowGridChange"
      @showPreviewChange="listenShowPreviewChange"
    />
    <Load3DControls
      :backgroundColor="backgroundColor"
      :showGrid="showGrid"
      :showPreview="showPreview"
      :lightIntensity="lightIntensity"
      :showLightIntensityButton="showLightIntensityButton"
      :fov="fov"
      :showFOVButton="showFOVButton"
      :showPreviewButton="showPreviewButton"
      :cameraType="cameraType"
      @switchCamera="switchCamera"
      @toggleGrid="toggleGrid"
      @updateBackgroundColor="handleBackgroundColorChange"
      @updateLightIntensity="handleUpdateLightIntensity"
      @togglePreview="togglePreview"
      @updateFOV="handleUpdateFOV"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Load3DControls from '@/components/load3d/Load3DControls.vue'
import Load3DScene from '@/components/load3d/Load3DScene.vue'

const props = defineProps<{
  node: any
  type: 'Load3D' | 'Preview3D'
}>()

const node = ref(props.node)
const backgroundColor = ref('#000000')
const showGrid = ref(true)
const showPreview = ref(false)
const lightIntensity = ref(5)
const showLightIntensityButton = ref(true)
const fov = ref(75)
const showFOVButton = ref(true)
const cameraType = ref<'perspective' | 'orthographic'>('perspective')

const showPreviewButton = computed(() => {
  return !props.type.includes('Preview')
})

const switchCamera = () => {
  cameraType.value =
    cameraType.value === 'perspective' ? 'orthographic' : 'perspective'

  showFOVButton.value = cameraType.value === 'perspective'

  node.value.properties['Camera Type'] = cameraType.value
}

const togglePreview = (value: boolean) => {
  showPreview.value = value

  node.value.properties['Show Preview'] = showPreview.value
}

const toggleGrid = (value: boolean) => {
  showGrid.value = value

  node.value.properties['Show Grid'] = showGrid.value
}

const handleUpdateLightIntensity = (value: number) => {
  lightIntensity.value = value

  node.value.properties['Light Intensity'] = lightIntensity.value
}

const handleUpdateFOV = (value: number) => {
  fov.value = value

  node.value.properties['FOV'] = fov.value
}

const materialMode = ref<'original' | 'normal' | 'wireframe' | 'depth'>(
  'original'
)

const handleBackgroundColorChange = (value: string) => {
  backgroundColor.value = value

  node.value.properties['Background Color'] = value
}

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
</script>
