<template>
  <Panel
    class="selection-toolbox absolute left-1/2 rounded-lg"
    :pt="{
      header: 'hidden',
      content: 'p-0 flex flex-row'
    }"
  >
    <ColorPickerButton v-if="nodeSelected || groupSelected" />
    <Button
      v-if="nodeSelected"
      severity="secondary"
      text
      @click="
        () => commandStore.execute('Comfy.Canvas.ToggleSelectedNodes.Bypass')
      "
      data-testid="bypass-button"
    >
      <template #icon>
        <i-game-icons:detour />
      </template>
    </Button>
    <Button
      v-if="nodeSelected || groupSelected"
      severity="secondary"
      text
      icon="pi pi-thumbtack"
      @click="() => commandStore.execute('Comfy.Canvas.ToggleSelected.Pin')"
    />
    <Button
      severity="danger"
      text
      icon="pi pi-trash"
      @click="() => commandStore.execute('Comfy.Canvas.DeleteSelectedItems')"
    />
    <Button
      v-if="isRefreshable"
      severity="info"
      text
      icon="pi pi-refresh"
      @click="refreshSelected"
    />
    <Button
      v-for="command in extensionToolboxCommands"
      :key="command.id"
      severity="secondary"
      text
      :icon="typeof command.icon === 'function' ? command.icon() : command.icon"
      @click="() => commandStore.execute(command.id)"
    />
  </Panel>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Panel from 'primevue/panel'
import { computed } from 'vue'

import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import { useRefreshableSelection } from '@/composables/useRefreshableSelection'
import { useExtensionService } from '@/services/extensionService'
import { ComfyCommand, useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphGroup, isLGraphNode } from '@/utils/litegraphUtil'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const extensionService = useExtensionService()
const { isRefreshable, refreshSelected } = useRefreshableSelection()
const nodeSelected = computed(() =>
  canvasStore.selectedItems.some(isLGraphNode)
)
const groupSelected = computed(() =>
  canvasStore.selectedItems.some(isLGraphGroup)
)

const extensionToolboxCommands = computed<ComfyCommand[]>(() => {
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
    .filter((command) => command !== undefined)
})
</script>

<style scoped>
.selection-toolbox {
  transform: translateX(-50%) translateY(-120%);
}
</style>
