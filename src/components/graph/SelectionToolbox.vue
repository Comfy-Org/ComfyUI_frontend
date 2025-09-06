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
