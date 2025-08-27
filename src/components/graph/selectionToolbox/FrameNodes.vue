<template>
  <Button
    v-show="hasSelectedItems"
    v-tooltip.top="{
      value: $t('g.frameNodes'),
      showDelay: 1000
    }"
    class="frame-nodes-button"
    text
    severity="secondary"
    @click="frameNodes"
  >
    <i-lucide:frame :size="16" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import { useTitleEditorStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

const canvasStore = useCanvasStore()
const titleEditorStore = useTitleEditorStore()
const settingStore = useSettingStore()

const hasSelectedItems = computed(() => {
  return canvasStore.selectedItems.length > 0
})

const frameNodes = () => {
  const { canvas } = app
  if (!canvas.selectedItems?.size) {
    return
  }

  const group = new LGraphGroup()
  const padding = settingStore.get('Comfy.GroupSelectedNodes.Padding')
  group.resizeTo(canvas.selectedItems, padding)
  canvas.graph?.add(group)
  titleEditorStore.titleEditorTarget = group
}
</script>
