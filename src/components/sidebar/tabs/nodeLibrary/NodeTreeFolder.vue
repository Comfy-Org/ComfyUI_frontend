<template>
  <div
    :class="[
      'node-tree-folder',
      { bookmark: props.isBookmarkFolder, 'can-drop': canDrop }
    ]"
    ref="container"
  >
    <span class="folder-label">
      <slot name="folder-label" :node="props.node">
        {{ props.node.label }}
      </slot>
    </span>
    <Badge
      :value="props.node.totalNodes"
      severity="secondary"
      :style="{ marginLeft: '0.5rem' }"
    />
  </div>
</template>

<script setup lang="ts">
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { CanvasDragAndDropData } from '@/types/litegraphTypes'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import Badge from 'primevue/badge'
import type { TreeNode } from 'primevue/treenode'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { BookmarkCustomization } from '@/types/apiTypes'

const props = defineProps<{
  node: TreeNode
  isBookmarkFolder: boolean
}>()

const emit = defineEmits<{
  (e: 'itemDropped', node: TreeNode): void
}>()

const nodeBookmarkStore = useNodeBookmarkStore()

const customization = computed<BookmarkCustomization | undefined>(() => {
  return nodeBookmarkStore.bookmarksCustomization[props.node.data.nodePath]
})

const addNodeToBookmarkFolder = (node: ComfyNodeDefImpl) => {
  if (!props.node.data) {
    console.error('Bookmark folder does not have data!')
    return
  }
  if (nodeBookmarkStore.isBookmarked(node)) {
    nodeBookmarkStore.toggleBookmark(node)
  }

  const folderNodeDef = props.node.data as ComfyNodeDefImpl
  const nodePath = folderNodeDef.category + '/' + node.display_name
  nodeBookmarkStore.addBookmark(nodePath)
}

const container = ref<HTMLElement | null>(null)
const canDrop = ref(false)

let dropTargetCleanup = () => {}
onMounted(() => {
  if (!props.isBookmarkFolder) return

  const treeNodeElement = container.value?.closest(
    '.p-tree-node-content'
  ) as HTMLElement
  dropTargetCleanup = dropTargetForElements({
    element: treeNodeElement,
    onDrop: (event) => {
      const dndData = event.source.data as CanvasDragAndDropData
      if (dndData.type === 'add-node') {
        addNodeToBookmarkFolder(dndData.data)
        canDrop.value = false
        emit('itemDropped', props.node)
      }
    },
    onDragEnter: (event) => {
      const dndData = event.source.data as CanvasDragAndDropData
      if (dndData.type === 'add-node') {
        canDrop.value = true
      }
    },
    onDragLeave: (event) => {
      canDrop.value = false
    }
  })

  if (customization.value) {
    const iconElement = treeNodeElement.querySelector(
      ':scope > .p-tree-node-icon'
    ) as HTMLElement
    if (iconElement) {
      iconElement.style.color = customization.value.color
    }
  }
})
onUnmounted(() => {
  dropTargetCleanup()
})
</script>
