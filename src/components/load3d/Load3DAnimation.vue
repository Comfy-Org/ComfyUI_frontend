<template>
  <div
    class="relative w-full h-full"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <Load3DAnimationScene
      ref="load3DAnimationSceneRef"
      :node="node"
      :input-spec="inputSpec"
      :background-color="backgroundColor"
      :show-grid="showGrid"
      :light-intensity="lightIntensity"
      :fov="fov"
      :camera-type="cameraType"
      :show-preview="showPreview"
      :show-f-o-v-button="showFOVButton"
      :show-light-intensity-button="showLightIntensityButton"
      :playing="playing"
      :selected-speed="selectedSpeed"
      :selected-animation="selectedAnimation"
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
      @background-image-change="listenBackgroundImageChange"
      @animation-list-change="animationListChange"
      @up-direction-change="listenUpDirectionChange"
      @recording-status-change="listenRecordingStatusChange"
    />
    <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
      <Load3DControls
        :input-spec="inputSpec"
        :background-color="backgroundColor"
        :show-grid="showGrid"
        :show-preview="showPreview"
        :light-intensity="lightIntensity"
        :show-light-intensity-button="showLightIntensityButton"
        :fov="fov"
        :show-f-o-v-button="showFOVButton"
        :show-preview-button="showPreviewButton"
        :camera-type="cameraType"
        :has-background-image="hasBackgroundImage"
        :up-direction="upDirection"
        :material-mode="materialMode"
        @update-background-image="handleBackgroundImageUpdate"
        @switch-camera="switchCamera"
        @toggle-grid="toggleGrid"
        @update-background-color="handleBackgroundColorChange"
        @update-light-intensity="handleUpdateLightIntensity"
        @toggle-preview="togglePreview"
        @update-f-o-v="handleUpdateFOV"
        @update-up-direction="handleUpdateUpDirection"
        @update-material-mode="handleUpdateMaterialMode"
      />
      <Load3DAnimationControls
        :animations="animations"
        :playing="playing"
        @toggle-play="togglePlay"
        @speed-change="speedChange"
        @animation-change="animationChange"
      />
    </div>
    <div
      v-if="showRecordingControls"
      class="absolute top-12 right-2 z-20 pointer-events-auto"
    >
      <RecordingControls
        :node="node"
        :is-recording="isRecording"
        :has-recording="hasRecording"
        :recording-duration="recordingDuration"
        @start-recording="handleStartRecording"
        @stop-recording="handleStopRecording"
        @export-recording="handleExportRecording"
        @clear-recording="handleClearRecording"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Load3DAnimationControls from '@/components/load3d/Load3DAnimationControls.vue'
import Load3DAnimationScene from '@/components/load3d/Load3DAnimationScene.vue'
import Load3DControls from '@/components/load3d/Load3DControls.vue'
import RecordingControls from '@/components/load3d/controls/RecordingControls.vue'
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

const isRecording = ref(false)
const hasRecording = ref(false)
const recordingDuration = ref(0)
const showRecordingControls = ref(!inputSpec.isPreview)

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

const handleStartRecording = async () => {
  const sceneRef = load3DAnimationSceneRef.value?.load3DSceneRef
  if (sceneRef?.load3d) {
    await sceneRef.load3d.startRecording()
    isRecording.value = true
  }
}

const handleStopRecording = () => {
  const sceneRef = load3DAnimationSceneRef.value?.load3DSceneRef
  if (sceneRef?.load3d) {
    sceneRef.load3d.stopRecording()
    isRecording.value = false
    recordingDuration.value = sceneRef.load3d.getRecordingDuration()
    hasRecording.value = recordingDuration.value > 0
  }
}

const handleExportRecording = () => {
  const sceneRef = load3DAnimationSceneRef.value?.load3DSceneRef
  if (sceneRef?.load3d) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${timestamp}-animation-recording.mp4`
    sceneRef.load3d.exportRecording(filename)
  }
}

const handleClearRecording = () => {
  const sceneRef = load3DAnimationSceneRef.value?.load3DSceneRef
  if (sceneRef?.load3d) {
    sceneRef.load3d.clearRecording()
    hasRecording.value = false
    recordingDuration.value = 0
  }
}

const listenRecordingStatusChange = (value: boolean) => {
  isRecording.value = value

  if (!value) {
    const sceneRef = load3DAnimationSceneRef.value?.load3DSceneRef
    if (sceneRef?.load3d) {
      recordingDuration.value = sceneRef.load3d.getRecordingDuration()
      hasRecording.value = recordingDuration.value > 0
    }
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
