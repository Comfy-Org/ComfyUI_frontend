<template>
  <Button
    v-show="is3DNode"
    v-tooltip.top="{
      value: t('commands.Comfy_3DEditor_Open3DEditor.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon="pi pi-pencil"
    @click="open3DEditor"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { t } from '@/i18n'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphNode, isLoad3dNode } from '@/utils/litegraphUtil'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const is3DNode = computed(() => {
  const nodes = canvasStore.selectedItems.filter(isLGraphNode)
  return nodes.length === 1 && nodes.some(isLoad3dNode)
})

const open3DEditor = () => {
  void commandStore.execute('Comfy.3DEditor.Open3DEditor')
}
</script>
