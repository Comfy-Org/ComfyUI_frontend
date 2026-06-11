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
      <Load3DControls
        v-model:scene-config="sceneConfig"
        v-model:model-config="modelConfig"
        v-model:camera-config="cameraConfig"
        v-model:light-config="lightConfig"
        :can-use-gizmo="canUseGizmo"
        :can-use-lighting="canUseLighting"
        :can-export="canExport"
        :can-use-hdri="canUseHdri"
        :can-use-background-image="canUseBackgroundImage"
        :material-modes="materialModes"
        :has-skeleton="hasSkeleton"
        @update-background-image="handleBackgroundImageUpdate"
        @export-model="handleExportModel"
        @update-hdri-file="handleHDRIFileUpdate"
        @toggle-gizmo="handleToggleGizmo"
        @set-gizmo-mode="handleSetGizmoMode"
        @reset-gizmo-transform="handleResetGizmoTransform"
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
    <div
      class="pointer-events-auto absolute top-12 right-2 z-20 flex flex-col gap-2"
    >
      <div
        v-if="canFitToViewer || canCenterCameraOnModel"
        class="flex flex-col rounded-lg bg-backdrop/30"
      >
        <Button
          v-if="canFitToViewer"
          v-tooltip.left="{
            value: $t('load3d.fitToViewer'),
            showDelay: 300
          }"
          size="icon"
          variant="textonly"
          class="rounded-full"
          :aria-label="$t('load3d.fitToViewer')"
          @click="handleFitToViewer"
        >
          <i class="pi pi-window-maximize text-lg text-base-foreground" />
        </Button>
        <Button
          v-if="canCenterCameraOnModel"
          v-tooltip.left="{
            value: $t('load3d.centerCameraOnModel'),
            showDelay: 300
          }"
          size="icon"
          variant="textonly"
          class="rounded-full"
          :aria-label="$t('load3d.centerCameraOnModel')"
          @click="handleCenterCameraOnModel"
        >
          <i class="pi pi-compass text-lg text-base-foreground" />
        </Button>
      </div>

      <ViewerControls
        v-if="enable3DViewer && node"
        :node="node as LGraphNode"
      />

      <RecordingControls
        v-if="canUseRecording && !isPreview"
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
import type { Ref } from 'vue'

import Load3DControls from '@/components/load3d/Load3DControls.vue'
import Load3DScene from '@/components/load3d/Load3DScene.vue'
import AnimationControls from '@/components/load3d/controls/AnimationControls.vue'
import RecordingControls from '@/components/load3d/controls/RecordingControls.vue'
import ViewerControls from '@/components/load3d/controls/ViewerControls.vue'
import Button from '@/components/ui/button/Button.vue'
import { useLoad3d } from '@/composables/useLoad3d'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { resolveNode } from '@/utils/litegraphUtil'
import type { ComponentWidget } from '@/scripts/domWidget'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

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
  handleToggleGizmo,
  handleSetGizmoMode,
  handleResetGizmoTransform,
  handleFitToViewer,
  handleCenterCameraOnModel,
  cleanup
} = useLoad3d(node as Ref<LGraphNode | null>)

const enable3DViewer = computed(() =>
  useSettingStore().get('Comfy.Load3D.3DViewerEnable')
)
</script>
