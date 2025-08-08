<template>
  <Transition name="slide-up" appear>
    <Panel
      :key="animationKey"
      class="selection-toolbox absolute left-1/2 rounded-lg"
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
import { computed, inject } from 'vue'
import type { Ref } from 'vue'

import BypassButton from '@/components/graph/selectionToolbox/BypassButton.vue'
import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import ConvertToSubgraphButton from '@/components/graph/selectionToolbox/ConvertToSubgraphButton.vue'
import DeleteButton from '@/components/graph/selectionToolbox/DeleteButton.vue'
import EditModelButton from '@/components/graph/selectionToolbox/EditModelButton.vue'
import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import ExtensionCommandButton from '@/components/graph/selectionToolbox/ExtensionCommandButton.vue'
import HelpButton from '@/components/graph/selectionToolbox/HelpButton.vue'
import MaskEditorButton from '@/components/graph/selectionToolbox/MaskEditorButton.vue'
import PinButton from '@/components/graph/selectionToolbox/PinButton.vue'
import RefreshSelectionButton from '@/components/graph/selectionToolbox/RefreshSelectionButton.vue'
import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { useExtensionService } from '@/services/extensionService'
import { type ComfyCommandImpl, useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const extensionService = useExtensionService()
const canvasInteractions = useCanvasInteractions()

// Inject the selection overlay state
const selectionOverlayState = inject<{
  visible: Readonly<Ref<boolean>>
  updateCount: Readonly<Ref<number>>
}>('selectionOverlayState')

// Animation control
const animationKey = computed(
  () => selectionOverlayState?.updateCount.value ?? 0
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

/* Slide up animation */
.slide-up-enter-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  transform: translateX(-50%) translateY(-100%);
  opacity: 0;
}

.slide-up-enter-to {
  transform: translateX(-50%) translateY(-120%);
  opacity: 1;
}
</style>
