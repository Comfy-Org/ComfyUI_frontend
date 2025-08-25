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
    <InfoButton />
    <VerticalDivider />
    <ColorPickerButton />
    <ConvertToSubgraphButton />
    <BookmarkButton />
    <BypassButton />
    <PinButton />
    <Load3DViewerButton />
    <MaskEditorButton />
    <FrameNodes />

    <DeleteButton />
    <RefreshSelectionButton />
    <ExecuteButton />
    <MoreOptions />

    <ExtensionCommandButton
      v-for="command in extensionToolboxCommands"
      :key="command.id"
      :command="command"
    />
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

// single subgraph toollist = [info,color,expand,bookmark,ban,refresh,play,options]
// single node toolist = [info,color,expand,ban,refresh,play,options]
// single image node toolist = [info, color, expand, mask,ban,refresh, play options]
//  multiple nodes toollist = [color, frame, expand,ban,play,options ]
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
