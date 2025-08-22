<template>
  <Transition name="slide-up">
    <Panel
      v-show="visible"
      class="selection-toolbox fixed left-0 top-0 rounded-lg z-40"
      :style="style"
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
  </Transition>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel'
import { computed } from 'vue'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import ConvertToSubgraphButton from '@/components/graph/selectionToolbox/ConvertToSubgraphButton.vue'
import DeleteButton from '@/components/graph/selectionToolbox/DeleteButton.vue'
import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import ExtensionCommandButton from '@/components/graph/selectionToolbox/ExtensionCommandButton.vue'
import HelpButton from '@/components/graph/selectionToolbox/HelpButton.vue'
import Load3DViewerButton from '@/components/graph/selectionToolbox/Load3DViewerButton.vue'
import MaskEditorButton from '@/components/graph/selectionToolbox/MaskEditorButton.vue'
import PinButton from '@/components/graph/selectionToolbox/PinButton.vue'
import RefreshSelectionButton from '@/components/graph/selectionToolbox/RefreshSelectionButton.vue'
import { useSelectionToolboxPosition } from '@/composables/canvas/useSelectionToolboxPosition'
import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { useExtensionService } from '@/services/extensionService'
import { type ComfyCommandImpl, useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const extensionService = useExtensionService()
const canvasInteractions = useCanvasInteractions()

const { style, visible } = useSelectionToolboxPosition()

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
  transform: translateY(-120%);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
