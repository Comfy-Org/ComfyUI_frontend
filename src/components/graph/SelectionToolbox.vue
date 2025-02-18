<template>
  <Panel
    class="selection-toolbox absolute left-1/2 rounded-lg"
    :pt="{
      header: 'hidden',
      content: 'p-0 flex flex-row'
    }"
  >
    <ColorPickerButton />
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
  </Panel>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Panel from 'primevue/panel'
import { computed } from 'vue'

import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import { useRefreshableSelection } from '@/composables/useRefreshableSelection'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()
const { isRefreshable, refreshSelected } = useRefreshableSelection()
const nodeSelected = computed(() =>
  canvasStore.selectedItems.some(isLGraphNode)
)
</script>

<style scoped>
.selection-toolbox {
  transform: translateX(-50%) translateY(-120%);
}
</style>
