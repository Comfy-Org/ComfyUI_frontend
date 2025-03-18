<template>
  <div
    class="relative w-full h-full"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <Load3DScene
      ref="load3DSceneRef"
      :node="node"
      :type="type"
      :backgroundColor="backgroundColor"
      :showGrid="showGrid"
      :lightIntensity="lightIntensity"
      :fov="fov"
      :cameraType="cameraType"
      :showPreview="showPreview"
      :backgroundImage="backgroundImage"
      :upDirection="upDirection"
      :materialMode="materialMode"
      :edgeThreshold="edgeThreshold"
      @materialModeChange="listenMaterialModeChange"
      @backgroundColorChange="listenBackgroundColorChange"
      @lightIntensityChange="listenLightIntensityChange"
      @fovChange="listenFOVChange"
      @cameraTypeChange="listenCameraTypeChange"
      @showGridChange="listenShowGridChange"
      @showPreviewChange="listenShowPreviewChange"
      @backgroundImageChange="listenBackgroundImageChange"
      @upDirectionChange="listenUpDirectionChange"
      @edgeThresholdChange="listenEdgeThresholdChange"
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
      :hasBackgroundImage="hasBackgroundImage"
      :upDirection="upDirection"
      :materialMode="materialMode"
      :isAnimation="false"
      :edgeThreshold="edgeThreshold"
      @updateBackgroundImage="handleBackgroundImageUpdate"
      @switchCamera="switchCamera"
      @toggleGrid="toggleGrid"
      @updateBackgroundColor="handleBackgroundColorChange"
      @updateLightIntensity="handleUpdateLightIntensity"
      @togglePreview="togglePreview"
      @updateFOV="handleUpdateFOV"
      @updateUpDirection="handleUpdateUpDirection"
      @updateMaterialMode="handleUpdateMaterialMode"
      @updateEdgeThreshold="handleUpdateEdgeThreshold"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Load3DControls from '@/components/load3d/Load3DControls.vue'
import Load3DScene from '@/components/load3d/Load3DScene.vue'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import {
  CameraType,
  Load3DNodeType,
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComponentWidget } from '@/scripts/domWidget'

const { widget } = defineProps<{
  widget: ComponentWidget<string[]>
}>()

const inputSpec = widget.inputSpec as CustomInputSpec

const node = widget.node
const type = inputSpec.type as Load3DNodeType

const backgroundColor = ref('#000000')
const showGrid = ref(true)
const showPreview = ref(false)
const lightIntensity = ref(5)
const showLightIntensityButton = ref(true)
const fov = ref(75)
const showFOVButton = ref(true)
const cameraType = ref<CameraType>('perspective')
const hasBackgroundImage = ref(false)
const backgroundImage = ref('')
const upDirection = ref<UpDirection>('original')
const materialMode = ref<MaterialMode>('original')
const edgeThreshold = ref(85)
const load3DSceneRef = ref<InstanceType<typeof Load3DScene> | null>(null)

const showPreviewButton = computed(() => {
  return !type.includes('Preview')
})

const handleMouseEnter = () => {
  if (load3DSceneRef.value?.load3d) {
    load3DSceneRef.value.load3d.updateStatusMouseOnScene(true)
  }
}

const handleMouseLeave = () => {
  if (load3DSceneRef.value?.load3d) {
    load3DSceneRef.value.load3d.updateStatusMouseOnScene(false)
  }
}

const switchCamera = () => {
  cameraType.value =
    cameraType.value === 'perspective' ? 'orthographic' : 'perspective'

  showFOVButton.value = cameraType.value === 'perspective'

  node.properties['Camera Type'] = cameraType.value
}

const togglePreview = (value: boolean) => {
  showPreview.value = value

  node.properties['Show Preview'] = showPreview.value
}

const toggleGrid = (value: boolean) => {
  showGrid.value = value

  node.properties['Show Grid'] = showGrid.value
}

const handleUpdateLightIntensity = (value: number) => {
  lightIntensity.value = value

  node.properties['Light Intensity'] = lightIntensity.value
}

const handleBackgroundImageUpdate = async (file: File | null) => {
  if (!file) {
    hasBackgroundImage.value = false
    backgroundImage.value = ''
    node.properties['Background Image'] = ''
    return
  }

  backgroundImage.value = await Load3dUtils.uploadFile(file)

  node.properties['Background Image'] = backgroundImage.value
}

const handleUpdateFOV = (value: number) => {
  fov.value = value

  node.properties['FOV'] = fov.value
}

const handleUpdateEdgeThreshold = (value: number) => {
  edgeThreshold.value = value

  node.properties['Edge Threshold'] = edgeThreshold.value
}

const handleBackgroundColorChange = (value: string) => {
  backgroundColor.value = value

  node.properties['Background Color'] = value
}

const handleUpdateUpDirection = (value: UpDirection) => {
  upDirection.value = value

  node.properties['Up Direction'] = value
}

const handleUpdateMaterialMode = (value: MaterialMode) => {
  materialMode.value = value

  node.properties['Material Mode'] = value
}

const listenMaterialModeChange = (mode: MaterialMode) => {
  materialMode.value = mode

  showLightIntensityButton.value = mode === 'original'
}

const listenUpDirectionChange = (value: UpDirection) => {
  upDirection.value = value
}

const listenEdgeThresholdChange = (value: number) => {
  edgeThreshold.value = value
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

const listenBackgroundImageChange = (value: string) => {
  backgroundImage.value = value

  if (backgroundImage.value && backgroundImage.value !== '') {
    hasBackgroundImage.value = true
  }
}
</script>
