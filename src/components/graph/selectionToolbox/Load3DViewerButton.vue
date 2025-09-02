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
    icon-class="w-4 h-4"
    @click="open3DViewer"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { t } from '@/i18n'
import { useCommandStore } from '@/stores/commandStore'
import { useSettingStore } from '@/stores/settingStore'
import { isLoad3dNode } from '@/utils/litegraphUtil'

const commandStore = useCommandStore()
const { selectedNodes } = useSelectionState()

const is3DNode = computed(() => {
  const enable3DViewer = useSettingStore().get('Comfy.Load3D.3DViewerEnable')
  return (
    selectedNodes.value.length === 1 &&
    selectedNodes.value.some(isLoad3dNode) &&
    enable3DViewer
  )
})

const open3DViewer = () => {
  void commandStore.execute('Comfy.3DViewer.Open3DViewer')
}
</script>
