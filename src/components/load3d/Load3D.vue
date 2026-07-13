<template>
  <div
    class="relative size-full"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @pointerdown.stop
  >
    <Load3DScene
      v-if="node"
      :initialize-load3d="initializeLoad3d"
      :cleanup="cleanup"
      :loading="loading"
      :loading-message="loadingMessage"
      :on-model-drop="isPreview ? undefined : handleModelDrop"
      :is-preview="isPreview"
    />
    <div class="pointer-events-none absolute top-0 left-0 size-full">
      <Load3DMenuBar
        v-model:scene-config="sceneConfig"
        v-model:model-config="modelConfig"
        v-model:camera-config="cameraConfig"
        v-model:light-config="lightConfig"
        v-model:is-recording="isRecording"
        v-model:has-recording="hasRecording"
        v-model:recording-duration="recordingDuration"
        :can-use-gizmo="canUseGizmo"
        :can-use-lighting="canUseLighting"
        :can-export="canExport"
        :can-use-hdri="canUseHdri"
        :can-use-background-image="canUseBackgroundImage"
        :can-fit-to-viewer="canFitToViewer"
        :can-center-camera-on-model="canCenterCameraOnModel"
        :node="node as LGraphNode"
        :enable-viewer="enable3DViewer"
        :can-use-recording="canUseRecording && !isPreview"
        :material-modes="materialModes"
        :has-skeleton="hasSkeleton"
        :source-format="sourceFormat"
        @update-background-image="handleBackgroundImageUpdate"
        @update-hdri-file="handleHDRIFileUpdate"
        @export-model="handleExportModel"
        @fit-to-viewer="handleFitToViewer"
        @center-camera="handleCenterCameraOnModel"
        @toggle-gizmo="handleToggleGizmo"
        @set-gizmo-mode="handleSetGizmoMode"
        @reset-gizmo-transform="handleResetGizmoTransform"
        @start-recording="handleStartRecording"
        @stop-recording="handleStopRecording"
        @export-recording="handleExportRecording"
        @clear-recording="handleClearRecording"
      />
      <AnimationControls
        v-if="animations && animations.length > 0"
        v-model:animations="animations"
        v-model:playing="playing"
        v-model:selected-speed="selectedSpeed"
        v-model:selected-animation="selectedAnimation"
        v-model:animation-progress="animationProgress"
        v-model:animation-duration="animationDuration"
        @seek="handleSeek"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Ref } from 'vue'

import Load3DMenuBar from '@/components/load3d/Load3DMenuBar.vue'
import Load3DScene from '@/components/load3d/Load3DScene.vue'
import AnimationControls from '@/components/load3d/controls/AnimationControls.vue'
import { useLoad3d } from '@/composables/useLoad3d'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComponentWidget } from '@/scripts/domWidget'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { resolveNode } from '@/utils/litegraphUtil'

const {
  widget,
  nodeId,
  canUseRecording = true,
  canUseHdri = true,
  canUseBackgroundImage = true
} = defineProps<{
  widget: ComponentWidget<string[]> | SimplifiedWidget
  nodeId?: NodeId
  canUseRecording?: boolean
  canUseHdri?: boolean
  canUseBackgroundImage?: boolean
}>()

function isComponentWidget(
  widget: ComponentWidget<string[]> | SimplifiedWidget
): widget is ComponentWidget<string[]> {
  return 'node' in widget && widget.node !== undefined
}

const node = ref<LGraphNode | null>(null)

if (isComponentWidget(widget)) {
  node.value = widget.node
} else if (nodeId) {
  onMounted(() => {
    node.value = resolveNode(nodeId) ?? null
  })
}

const {
  // configs
  sceneConfig,
  modelConfig,
  cameraConfig,
  lightConfig,

  // other state
  isRecording,
  isPreview,
  canFitToViewer,
  canCenterCameraOnModel,
  canUseGizmo,
  canUseLighting,
  canExport,
  materialModes,
  hasSkeleton,
  sourceFormat,
  hasRecording,
  recordingDuration,
  animations,
  playing,
  selectedSpeed,
  selectedAnimation,
  animationProgress,
  animationDuration,
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
  handleSeek,
  handleBackgroundImageUpdate,
  handleHDRIFileUpdate,
  handleExportModel,
  handleModelDrop,
  handleFitToViewer,
  handleCenterCameraOnModel,
  handleToggleGizmo,
  handleSetGizmoMode,
  handleResetGizmoTransform,
  cleanup
} = useLoad3d(node as Ref<LGraphNode | null>)

const enable3DViewer = computed(() =>
  useSettingStore().get('Comfy.Load3D.3DViewerEnable')
)
</script>
