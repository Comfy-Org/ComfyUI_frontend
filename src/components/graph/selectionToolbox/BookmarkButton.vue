<template>
  <Button
    v-show="nodeDef"
    v-tooltip.top="{
      value: $t('g.bookmark'),
      showDelay: 1000
    }"
    class="help-button"
    text
    severity="secondary"
    @click="bookmarkNode"
  >
    <i-lucide:book-open :size="16" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { useCanvasStore } from '@/stores/graphStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

const canvasStore = useCanvasStore()
const nodeDefStore = useNodeDefStore()
const nodeBookmarkStore = useNodeBookmarkStore()

const nodeDef = computed<ComfyNodeDefImpl | null>(() => {
  if (canvasStore.selectedItems.length !== 1) return null
  const item = canvasStore.selectedItems[0]
  if (!isLGraphNode(item)) return null
  return nodeDefStore.fromLGraphNode(item)
})

const bookmarkNode = async () => {
  const def = nodeDef.value
  if (!def) return
  await nodeBookmarkStore.addBookmark(def.nodePath)
}
</script>
