<template>
  <div ref="container" class="node-lib-node-container">
    <TreeExplorerTreeNode :node="node"></TreeExplorerTreeNode>
  </div>
</template>

<script setup lang="ts">
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { BookmarkCustomization } from '@/types/apiTypes'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

const nodeBookmarkStore = useNodeBookmarkStore()
const customization = computed<BookmarkCustomization | undefined>(() => {
  return nodeBookmarkStore.bookmarksCustomization[props.node.data.nodePath]
})

const treeNodeElement = ref<HTMLElement | null>(null)
const iconElement = ref<HTMLElement | null>(null)

let stopWatchCustomization: (() => void) | null = null

const container = ref<HTMLElement | null>(null)
onMounted(() => {
  treeNodeElement.value = container.value?.closest(
    '.p-tree-node-content'
  ) as HTMLElement
  iconElement.value = treeNodeElement.value.querySelector(
    ':scope > .p-tree-node-icon'
  ) as HTMLElement
  updateIconColor()

  // Start watching after the component is mounted
  stopWatchCustomization = watch(customization, updateIconColor, { deep: true })
})

const updateIconColor = () => {
  if (iconElement.value && customization.value) {
    iconElement.value.style.color = customization.value.color
  }
}

onUnmounted(() => {
  if (stopWatchCustomization) {
    stopWatchCustomization()
  }
})
</script>
