<template>
  <Panel
    class="selection-toolbox absolute left-1/2 rounded-lg"
    :class="{ 'animate-slide-up': shouldAnimate }"
    :style="`backgroundColor: ${containerStyles.backgroundColor};`"
    :pt="{
      header: 'hidden',
      content: 'p-[4px] flex flex-row gap-[4px]'
    }"
    @wheel="canvasInteractions.handleWheel"
  >
    <!-- Info Group - single subgraph/node only -->
    <InfoButton v-if="showInfoButton" />
    <VerticalDivider v-if="showInfoButton && showAnyPrimaryActions" />

    <!-- Primary Actions Group -->
    <ColorPickerButton v-if="showColorPicker" />
    <ConvertToSubgraphButton v-if="showConvertToSubgraph" />
    <FrameNodes v-if="showFrameNodes" />
    <BookmarkButton v-if="showBookmark" />
    <VerticalDivider v-if="showAnyPrimaryActions && showAnyControlActions" />

    <!-- Control Group -->
    <BypassButton v-if="showBypass" />
    <PinButton v-if="showPin" />
    <VerticalDivider
      v-if="showAnyControlActions && showAnySpecializedActions"
    />

    <!-- Specialized Group -->
    <Load3DViewerButton v-if="showLoad3DViewer" />
    <MaskEditorButton v-if="showMaskEditor" />
    <VerticalDivider v-if="showLoad3DViewer && showMaskEditor" />

    <!-- Execution Group -->
    <DeleteButton v-if="showDelete" />
    <RefreshSelectionButton v-if="showRefresh" />
    <ExecuteButton v-if="showExecute" />
    <VerticalDivider v-if="showAnyExecutionActions && hasExtensionButtons" />

    <!-- Extension Commands -->
    <ExtensionCommandButton
      v-for="command in extensionToolboxCommands"
      :key="command.id"
      :command="command"
    />
    <VerticalDivider v-if="hasExtensionButtons" />

    <!-- Always show more options last -->
    <MoreOptions />
  </Panel>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel'
import { computed, inject } from 'vue'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import ConvertToSubgraphButton from '@/components/graph/selectionToolbox/ConvertToSubgraphButton.vue'
import DeleteButton from '@/components/graph/selectionToolbox/DeleteButton.vue'
import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import ExtensionCommandButton from '@/components/graph/selectionToolbox/ExtensionCommandButton.vue'
import InfoButton from '@/components/graph/selectionToolbox/InfoButton.vue'
import Load3DViewerButton from '@/components/graph/selectionToolbox/Load3DViewerButton.vue'
import MaskEditorButton from '@/components/graph/selectionToolbox/MaskEditorButton.vue'
import PinButton from '@/components/graph/selectionToolbox/PinButton.vue'
import RefreshSelectionButton from '@/components/graph/selectionToolbox/RefreshSelectionButton.vue'
import { useRetriggerableAnimation } from '@/composables/element/useRetriggerableAnimation'
import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useExtensionService } from '@/services/extensionService'
import { type ComfyCommandImpl, useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { SelectionOverlayInjectionKey } from '@/types/selectionOverlayTypes'
import { isImageNode, isLGraphNode } from '@/utils/litegraphUtil'

import BookmarkButton from './selectionToolbox/BookmarkButton.vue'
import FrameNodes from './selectionToolbox/FrameNodes.vue'
import MoreOptions from './selectionToolbox/MoreOptions.vue'
import VerticalDivider from './selectionToolbox/VerticalDivider.vue'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const extensionService = useExtensionService()
const canvasInteractions = useCanvasInteractions()
const minimap = useMinimap()
const containerStyles = minimap.containerStyles

const selectionOverlayState = inject(SelectionOverlayInjectionKey)
const { shouldAnimate } = useRetriggerableAnimation(
  selectionOverlayState?.updateCount,
  { animateOnMount: true }
)

const extensionToolboxCommands = computed<ComfyCommandImpl[]>(() => {
  const commandIds = new Set<string>(
    canvasStore.selectedItems
      .map(
        (item) =>
          extensionService
            .invokeExtensions('getSelectionToolboxCommands', item)
            .flat() as string[]
      )
      .flat()
  )
  return Array.from(commandIds)
    .map((commandId) => commandStore.getCommand(commandId))
    .filter((command): command is ComfyCommandImpl => command !== undefined)
})

// Selection type detection
const hasAnySelection = computed(() => canvasStore.selectedItems.length > 0)
const hasSingleSelection = computed(
  () => canvasStore.selectedItems.length === 1
)
const hasMultipleSelection = computed(
  () => canvasStore.selectedItems.length > 1
)

const isSingleNode = computed(() => {
  if (!hasSingleSelection.value) return false
  const item = canvasStore.selectedItems[0]
  return isLGraphNode(item)
})

const isSingleSubgraph = computed(() => {
  if (!hasSingleSelection.value) return false
  const item = canvasStore.selectedItems[0]
  return isLGraphNode(item) && item.isSubgraphNode?.()
})

const isSingleImageNode = computed(() => {
  if (!hasSingleSelection.value) return false
  const item = canvasStore.selectedItems[0]
  return isLGraphNode(item) && isImageNode(item)
})

// Individual button visibility based on selection types
// single subgraph toollist = [info,color,expand,bookmark,ban,refresh,play,options]
// single node toolist = [info,color,expand,ban,refresh,play,options]
// single image node toolist = [info, color, expand, mask,ban,refresh, play options]
// multiple nodes toollist = [color, frame, expand,ban,play,options]

// Info Group
const showInfoButton = computed(
  () => isSingleNode.value || isSingleSubgraph.value
)

// Primary Actions Group
const showColorPicker = computed(() => hasAnySelection.value) // All scenarios
const showConvertToSubgraph = computed(() => hasAnySelection.value) // All scenarios (expand/shrink)
const showFrameNodes = computed(() => hasMultipleSelection.value) // Only multiple nodes
const showBookmark = computed(() => isSingleSubgraph.value) // Single selections only

// Control Group
const showBypass = computed(
  () =>
    isSingleNode.value || isSingleSubgraph.value || hasMultipleSelection.value
) // All scenarios (ban)
const showPin = computed(() => hasAnySelection.value) // All scenarios

// Specialized Group
const showLoad3DViewer = computed(() => hasAnySelection.value) // Shows when relevant (has own logic)
const showMaskEditor = computed(() => isSingleImageNode.value) // Only single image nodes

// Execution Group
const showDelete = computed(() => hasAnySelection.value) // All scenarios
const showRefresh = computed(() => hasAnySelection.value) // All scenarios
const showExecute = computed(() => hasAnySelection.value) // All scenarios (play)

// Group visibility for intelligent divider logic
const showAnyPrimaryActions = computed(
  () =>
    showColorPicker.value ||
    showConvertToSubgraph.value ||
    showFrameNodes.value ||
    showBookmark.value
)

const showAnyControlActions = computed(() => showBypass.value || showPin.value)

const showAnySpecializedActions = computed(
  () => showLoad3DViewer.value || showMaskEditor.value
)

const showAnyExecutionActions = computed(
  () => showDelete.value || showRefresh.value || showExecute.value
)

const hasExtensionButtons = computed(
  () => extensionToolboxCommands.value.length > 0
)
</script>

<style scoped>
.selection-toolbox {
  transform: translateX(-50%) translateY(-120%);
}

/* Slide up animation using CSS animation */
@keyframes slideUp {
  from {
    transform: translateX(-50%) translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(-120%);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slideUp 0.3s ease-out;
}
</style>
