<template>
  <div
    class="relative w-full h-full"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <Load3DAnimationScene
      ref="load3DAnimationSceneRef"
      :node="node"
      :type="type"
      :backgroundColor="backgroundColor"
      :showGrid="showGrid"
      :lightIntensity="lightIntensity"
      :fov="fov"
      :cameraType="cameraType"
      :showPreview="showPreview"
      :showFOVButton="showFOVButton"
      :showLightIntensityButton="showLightIntensityButton"
      :playing="playing"
      :selectedSpeed="selectedSpeed"
      :selectedAnimation="selectedAnimation"
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
      @backgroundImageChange="listenBackgroundImageChange"
      @animationListChange="animationListChange"
      @upDirectionChange="listenUpDirectionChange"
    />
    <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
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
        :isAnimation="true"
        @updateBackgroundImage="handleBackgroundImageUpdate"
        @switchCamera="switchCamera"
        @toggleGrid="toggleGrid"
        @updateBackgroundColor="handleBackgroundColorChange"
        @updateLightIntensity="handleUpdateLightIntensity"
        @togglePreview="togglePreview"
        @updateFOV="handleUpdateFOV"
        @updateUpDirection="handleUpdateUpDirection"
        @updateMaterialMode="handleUpdateMaterialMode"
      />
      <Load3DAnimationControls
        :animations="animations"
        :playing="playing"
        @togglePlay="togglePlay"
        @speedChange="speedChange"
        @animationChange="animationChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Load3DAnimationControls from '@/components/load3d/Load3DAnimationControls.vue'
import Load3DAnimationScene from '@/components/load3d/Load3DAnimationScene.vue'
import Load3DControls from '@/components/load3d/Load3DControls.vue'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import {
  AnimationItem,
  CameraType,
  Load3DAnimationNodeType,
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
const type = inputSpec.type as Load3DAnimationNodeType

const backgroundColor = ref('#000000')
const showGrid = ref(true)
const showPreview = ref(false)
const lightIntensity = ref(5)
const showLightIntensityButton = ref(true)
const fov = ref(75)
const showFOVButton = ref(true)
const cameraType = ref<'perspective' | 'orthographic'>('perspective')
const hasBackgroundImage = ref(false)

const animations = ref<AnimationItem[]>([])
const playing = ref(false)
const selectedSpeed = ref(1)
const selectedAnimation = ref(0)
const backgroundImage = ref('')

const showPreviewButton = computed(() => {
  return !type.includes('Preview')
})

const load3DAnimationSceneRef = ref<InstanceType<
  typeof Load3DAnimationScene
> | null>(null)

const handleMouseEnter = () => {
  const sceneRef = load3DAnimationSceneRef.value?.load3DSceneRef
  if (sceneRef?.load3d) {
    sceneRef.load3d.updateStatusMouseOnScene(true)
  }
}

const handleMouseLeave = () => {
  const sceneRef = load3DAnimationSceneRef.value?.load3DSceneRef
  if (sceneRef?.load3d) {
    sceneRef.load3d.updateStatusMouseOnScene(false)
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

const materialMode = ref<MaterialMode>('original')
const upDirection = ref<UpDirection>('original')

const handleUpdateUpDirection = (value: UpDirection) => {
  upDirection.value = value

  node.properties['Up Direction'] = value
}

const handleUpdateMaterialMode = (value: MaterialMode) => {
  materialMode.value = value

  node.properties['Material Mode'] = value
}

const handleBackgroundColorChange = (value: string) => {
  backgroundColor.value = value

  node.properties['Background Color'] = value
}

const togglePlay = (value: boolean) => {
  playing.value = value
}

const speedChange = (value: number) => {
  selectedSpeed.value = value
}

const animationChange = (value: number) => {
  selectedAnimation.value = value
}

const animationListChange = (value: any) => {
  animations.value = value
}

const listenMaterialModeChange = (mode: MaterialMode) => {
  materialMode.value = mode

  showLightIntensityButton.value = mode === 'original'
}

const listenUpDirectionChange = (value: UpDirection) => {
  upDirection.value = value
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
