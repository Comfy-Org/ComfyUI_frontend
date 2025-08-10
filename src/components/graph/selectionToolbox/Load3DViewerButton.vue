<template>
  <Button
    v-show="is3DNode"
    v-tooltip.top="{
      value: t('commands.Comfy_3DViewer_Open3DViewer.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    icon="pi pi-pencil"
    @click="open3DViewer"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { t } from '@/i18n'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'
import { isLGraphNode, isLoad3dNode } from '@/utils/litegraphUtil'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const is3DNode = computed(() => {
  const enable3DViewer = useSettingStore().get('Comfy.Load3D.3DViewerEnable')
  const nodes = canvasStore.selectedItems.filter(isLGraphNode)

  return nodes.length === 1 && nodes.some(isLoad3dNode) && enable3DViewer
})

const open3DViewer = () => {
  void commandStore.execute('Comfy.3DViewer.Open3DViewer')
}
</script>
