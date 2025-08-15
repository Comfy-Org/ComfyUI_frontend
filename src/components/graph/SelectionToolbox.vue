<template>
  <Panel
    class="selection-toolbox absolute left-1/2 rounded-lg"
    :class="{ 'animate-slide-up': shouldAnimate }"
    :pt="{
      header: 'hidden',
      content: 'p-0 flex flex-row'
    }"
    @wheel="canvasInteractions.handleWheel"
  >
    <ExecuteButton />
    <ColorPickerButton />
    <BypassButton />
    <PinButton />
    <EditModelButton />
    <Load3DViewerButton />
    <MaskEditorButton />
    <ConvertToSubgraphButton />
    <DeleteButton />
    <RefreshSelectionButton />
    <ExtensionCommandButton
      v-for="command in extensionToolboxCommands"
      :key="command.id"
      :command="command"
    />
    <HelpButton />
  </Panel>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel'
import { computed, inject } from 'vue'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import ConvertToSubgraphButton from '@/components/graph/selectionToolbox/ConvertToSubgraphButton.vue'
import DeleteButton from '@/components/graph/selectionToolbox/DeleteButton.vue'
import EditModelButton from '@/components/graph/selectionToolbox/EditModelButton.vue'
import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import ExtensionCommandButton from '@/components/graph/selectionToolbox/ExtensionCommandButton.vue'
import HelpButton from '@/components/graph/selectionToolbox/HelpButton.vue'
import Load3DViewerButton from '@/components/graph/selectionToolbox/Load3DViewerButton.vue'
import MaskEditorButton from '@/components/graph/selectionToolbox/MaskEditorButton.vue'
import PinButton from '@/components/graph/selectionToolbox/PinButton.vue'
import RefreshSelectionButton from '@/components/graph/selectionToolbox/RefreshSelectionButton.vue'
import { useRetriggerableAnimation } from '@/composables/element/useRetriggerableAnimation'
import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { useExtensionService } from '@/services/extensionService'
import { type ComfyCommandImpl, useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { SelectionOverlayInjectionKey } from '@/types/selectionOverlayTypes'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const extensionService = useExtensionService()
const canvasInteractions = useCanvasInteractions()

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
