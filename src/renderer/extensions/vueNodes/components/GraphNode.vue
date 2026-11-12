<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-destructive">
    {{ st('nodeErrors.render', 'Node Render Error') }}
  </div>
  <LGraphNode
    v-else
    tabindex="0"
    v-bind="{ ...nodeAttributes, ...pointerHandlers }"
    :class="rootClass"
    :style="nodeStyle"
    :inert="isGhostPlacing"
    :container-class="containerClass"
    :content-visibility="!isCollapsed"
    :container-style="{
      '--node': applyLightThemeColor(nodeData.bgcolor),
      '--component-node-background': 'var(--node)',
      backgroundColor: applyLightThemeColor(nodeData.color)
    }"
    @wheel="handleWheel"
    @contextmenu="handleContextMenu"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <template #before>
      <NodeBadges
        v-if="showBadges"
        v-bind="badges"
        :outline-offset="badgeOutlineOffset"
      />
      <AppOutput v-if="showAppOutput" :id="nodeId" />
      <div data-testid="node-state-outline-overlay" :class="outlineClass" />
    </template>

    <GraphNodeHeader
      :show-header="displayHeader"
      :node-data
      :collapsed="isCollapsed"
      :has-inputs
      :show-missing-warning="showMissingWarning"
      :progress="visibleProgress"
      :progress-classes
      @collapse="handleCollapse"
      @update:title="handleHeaderTitleUpdate"
    />

    <NodeSlots v-if="bodyKind === 'reroute'" :node-data />
    <GraphNodeBodyContent
      v-if="bodyKind === 'node'"
      :node-data
      :has-renderable-widgets
      :processed-widget-model
      :body-rounding-class
      :media="nodeMedia"
      :previews="promotedPreviews"
      :media-class
      :has-custom-content
      :preview-url="previewUrl"
      :progress="visibleProgress"
      :progress-classes="bodyProgressClass"
      :progress-style
    />

    <template #after>
      <NodeFooter
        v-if="!isRerouteNode"
        :subgraph-action
        :error-severity="errorSeverity"
        :show-errors-tab-enabled="showErrorsTabEnabled"
        :show-advanced-inputs-button="showAdvancedInputsButton"
        :show-advanced-state="!!nodeData.showAdvanced"
        :header-color="applyLightThemeColor(nodeData.color)"
        :shape="nodeData.shape"
        @navigate-subgraph="handleEnterSubgraph"
        @open-errors="handleOpenErrors"
        @toggle-advanced="handleToggleAdvanced"
      />
      <NodeResizeHandle
        v-for="handle in resizeHandles"
        :key="handle.corner"
        :handle
        @resize="handleResizePointerDown"
      />
    </template>
  </LGraphNode>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { st } from '@/i18n'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { applyLightThemeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { useGraphNodePresentation } from '@/renderer/extensions/vueNodes/composables/useGraphNodePresentation'
import AppOutput from '@/renderer/extensions/linearMode/AppOutput.vue'
import NodeBadges from './NodeBadges.vue'
import NodeResizeHandle from './NodeResizeHandle.vue'
import NodeFooter from './NodeFooter.vue'
import NodeSlots from './NodeSlots.vue'
import LGraphNode from './LGraphNode.vue'
import GraphNodeHeader from './GraphNodeHeader.vue'
import GraphNodeBodyContent from './GraphNodeBodyContent.vue'

const { nodeData } = defineProps<{ nodeData: NodeState }>()
const {
  handleWheel,
  nodeAttributes,
  pointerHandlers,
  rootClass,
  nodeStyle,
  isGhostPlacing,
  containerClass,
  showBadges,
  badges,
  badgeOutlineOffset,
  showAppOutput,
  nodeId,
  outlineClass,
  displayHeader,
  isCollapsed,
  hasInputs,
  showMissingWarning,
  visibleProgress,
  progressClasses,
  hasRenderableWidgets,
  processedWidgetModel,
  bodyRoundingClass,
  nodeMedia,
  promotedPreviews,
  mediaClass,
  bodyProgressClass,
  progressStyle,
  previewUrl,
  isRerouteNode,
  bodyKind,
  subgraphAction,
  errorSeverity,
  showErrorsTabEnabled,
  showAdvancedInputsButton,
  resizeHandles,
  hasCustomContent,
  handleResizePointerDown,
  handleContextMenu,
  handleCollapse,
  handleHeaderTitleUpdate,
  handleOpenErrors,
  handleToggleAdvanced,
  handleEnterSubgraph,
  handleDragOver,
  handleDragLeave,
  handleDrop
} = useGraphNodePresentation(() => nodeData)
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()
onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
