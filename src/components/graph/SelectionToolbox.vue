<template>
  <Panel
    class="selection-toolbox absolute left-1/2 rounded-lg"
    :pt="{
      header: 'hidden',
      content: 'p-0 flex flex-row'
    }"
  >
    <ExecuteButton />
    <ColorPickerButton />
    <BypassButton />
    <PinButton />
    <DeleteButton />
    <RefreshButton />
    <ExtensionCommandButton
      v-for="command in extensionToolboxCommands"
      :key="command.id"
      :command="command"
    />
  </Panel>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel'
import { computed } from 'vue'

import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import ExecuteButton from '@/components/graph/selectionToolbox/ExecuteButton.vue'
import { useExtensionService } from '@/services/extensionService'
import { type ComfyCommandImpl, useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

import BypassButton from './selectionToolbox/BypassButton.vue'
import DeleteButton from './selectionToolbox/DeleteButton.vue'
import ExtensionCommandButton from './selectionToolbox/ExtensionCommandButton.vue'
import PinButton from './selectionToolbox/PinButton.vue'
import RefreshButton from './selectionToolbox/RefreshButton.vue'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const extensionService = useExtensionService()

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
</style>
