<template>
  <div
    ref="toolboxRef"
    style="transform: translate(var(--tb-x), var(--tb-y))"
    class="fixed left-0 top-0 z-40 pointer-events-none"
  >
    <Transition name="slide-up">
      <Panel
        v-if="visible"
        class="rounded-lg selection-toolbox pointer-events-auto"
        :style="`backgroundColor: ${containerStyles.backgroundColor};`"
        :pt="{
          header: 'hidden',
          content: 'p-1 h-10 flex flex-row gap-1'
        }"
        @wheel="canvasInteractions.forwardEventToCanvas"
      >
        <DeleteButton v-if="showDelete" />
        <VerticalDivider v-if="showInfoButton && showAnyPrimaryActions" />
        <InfoButton v-if="showInfoButton" />

        <ColorPickerButton v-if="showColorPicker" />
        <FrameNodes v-if="showFrameNodes" />
        <ConvertToSubgraphButton v-if="showConvertToSubgraph" />
        <PublishSubgraphButton v-if="showPublishSubgraph" />
        <MaskEditorButton v-if="showMaskEditor" />
        <VerticalDivider
          v-if="showAnyPrimaryActions && showAnyControlActions"
        />

        <BypassButton v-if="showBypass" />
        <RefreshSelectionButton v-if="showRefresh" />
        <Load3DViewerButton v-if="showLoad3DViewer" />

        <ExtensionCommandButton
          v-for="command in extensionToolboxCommands"
          :key="command.id"
          :command="command"
        />
        <ExecuteButton v-if="showExecute" />
        <MoreOptions />
      </Panel>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel'
import { computed, ref } from 'vue'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import ConvertToSubgraphButton from '@/components/graph/selectionToolbox/ConvertToSubgraphButton.vue'
import DeleteButton from '@/components/graph/selectionToolbox/DeleteButton.vue'
import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import ExtensionCommandButton from '@/components/graph/selectionToolbox/ExtensionCommandButton.vue'
import InfoButton from '@/components/graph/selectionToolbox/InfoButton.vue'
import Load3DViewerButton from '@/components/graph/selectionToolbox/Load3DViewerButton.vue'
import MaskEditorButton from '@/components/graph/selectionToolbox/MaskEditorButton.vue'
import RefreshSelectionButton from '@/components/graph/selectionToolbox/RefreshSelectionButton.vue'
import PublishSubgraphButton from '@/components/graph/selectionToolbox/SaveToSubgraphLibrary.vue'
import { useSelectionToolboxPosition } from '@/composables/canvas/useSelectionToolboxPosition'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'
import { useExtensionService } from '@/services/extensionService'
import { type ComfyCommandImpl, useCommandStore } from '@/stores/commandStore'

import FrameNodes from './selectionToolbox/FrameNodes.vue'
import MoreOptions from './selectionToolbox/MoreOptions.vue'
import VerticalDivider from './selectionToolbox/VerticalDivider.vue'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const extensionService = useExtensionService()
const canvasInteractions = useCanvasInteractions()
const minimap = useMinimap()
const containerStyles = minimap.containerStyles

const toolboxRef = ref<HTMLElement | undefined>()
const { visible } = useSelectionToolboxPosition(toolboxRef)

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

const {
  hasAnySelection,
  hasMultipleSelection,
  isSingleNode,
  isSingleSubgraph,
  isSingleImageNode,
  hasAny3DNodeSelected,
  hasOutputNodesSelected,
  nodeDef
} = useSelectionState()
const showInfoButton = computed(() => !!nodeDef.value)

const showColorPicker = computed(() => hasAnySelection.value)
const showConvertToSubgraph = computed(() => hasAnySelection.value)
const showFrameNodes = computed(() => hasMultipleSelection.value)
const showPublishSubgraph = computed(() => isSingleSubgraph.value)

const showBypass = computed(
  () =>
    isSingleNode.value || isSingleSubgraph.value || hasMultipleSelection.value
)
const showLoad3DViewer = computed(() => hasAny3DNodeSelected.value)
const showMaskEditor = computed(() => isSingleImageNode.value)

const showDelete = computed(() => hasAnySelection.value)
const showRefresh = computed(() => hasAnySelection.value)
const showExecute = computed(() => hasOutputNodesSelected.value)

const showAnyPrimaryActions = computed(
  () =>
    showColorPicker.value ||
    showConvertToSubgraph.value ||
    showFrameNodes.value ||
    showPublishSubgraph.value
)

const showAnyControlActions = computed(() => showBypass.value)
</script>

<style scoped>
.selection-toolbox {
  transform: translateX(-50%) translateY(-120%);
}

@keyframes slideUp {
  0% {
    transform: translateX(-50%) translateY(-100%);
    opacity: 0;
  }
  50% {
    transform: translateX(-50%) translateY(-125%);
    opacity: 0.5;
  }
  100% {
    transform: translateX(-50%) translateY(-120%);
    opacity: 1;
  }
}

.slide-up-enter-active {
  animation: slideUp 125ms ease-out;
}

.slide-up-leave-active {
  animation: slideUp 25ms ease-out reverse;
}
</style>
