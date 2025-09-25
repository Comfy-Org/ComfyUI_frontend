<template>
  <div
    class="relative w-full h-full"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <Load3DScene
      v-if="node"
      ref="load3DSceneRef"
      :initialize-load3d="initializeLoad3d"
      :cleanup="cleanup"
      :loading="loading"
      :loading-message="loadingMessage"
    />
    <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
      <Load3DControls
        v-model:scene-config="sceneConfig"
        v-model:model-config="modelConfig"
        v-model:camera-config="cameraConfig"
        v-model:light-config="lightConfig"
        @update-background-image="handleBackgroundImageUpdate"
        @export-model="handleExportModel"
      />
      <AnimationControls
        v-if="animations && animations.length > 0"
        v-model:animations="animations"
        v-model:playing="playing"
        v-model:selected-speed="selectedSpeed"
        v-model:selected-animation="selectedAnimation"
      />
    </div>
    <div
      v-if="enable3DViewer && node"
      class="absolute top-12 right-2 z-20 pointer-events-auto"
    >
      <ViewerControls :node="node" />
    </div>

    <div
      v-if="!isPreview"
      class="absolute right-2 z-20 pointer-events-auto"
      :class="{
        'top-12': !enable3DViewer,
        'top-24': enable3DViewer
      }"
    >
      <RecordingControls
        v-model:is-recording="isRecording"
        v-model:has-recording="hasRecording"
        v-model:recording-duration="recordingDuration"
        @start-recording="handleStartRecording"
        @stop-recording="handleStopRecording"
        @export-recording="handleExportRecording"
        @clear-recording="handleClearRecording"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import Load3DControls from '@/components/load3d/Load3DControls.vue'
import Load3DScene from '@/components/load3d/Load3DScene.vue'
import AnimationControls from '@/components/load3d/controls/AnimationControls.vue'
import RecordingControls from '@/components/load3d/controls/RecordingControls.vue'
import ViewerControls from '@/components/load3d/controls/ViewerControls.vue'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useLoad3d } from '@/composables/useLoad3d'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import type { ComponentWidget } from '@/scripts/domWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget, nodeData } = defineProps<{
  widget: ComponentWidget<string[]> | SimplifiedWidget
  nodeData?: VueNodeData
}>()

const isComponentWidget = 'node' in widget

const node = ref<any>(null)

if (isComponentWidget) {
  node.value = widget.node
}

onMounted(() => {
  if (!isComponentWidget && nodeData?.id && app.graph) {
    node.value = app.graph._nodes_by_id?.[nodeData.id] || null
  }
})
const load3DSceneRef = ref<InstanceType<typeof Load3DScene> | null>(null)

const {
  // configs
  sceneConfig,
  modelConfig,
  cameraConfig,
  lightConfig,

  // other state
  isRecording,
  isPreview,
  hasRecording,
  recordingDuration,
  animations,
  playing,
  selectedSpeed,
  selectedAnimation,
  loading,
  loadingMessage,

  // Methods
  initializeLoad3d,
  handleMouseEnter,
  handleMouseLeave,
  handleStartRecording,
  handleStopRecording,
  handleExportRecording,
  handleClearRecording,
  handleBackgroundImageUpdate,
  handleExportModel,
  cleanup
} = useLoad3d(node)

const enable3DViewer = computed(() =>
  useSettingStore().get('Comfy.Load3D.3DViewerEnable')
)
</script>
