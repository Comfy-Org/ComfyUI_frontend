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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

const treeNodeElement = ref<HTMLElement | null>(null)
const iconElement = ref<HTMLElement | null>(null)

let dropTargetCleanup = () => {}
let stopWatchCustomization: (() => void) | null = null

onMounted(() => {
  if (!props.isBookmarkFolder) return

  treeNodeElement.value = container.value?.closest(
    '.p-tree-node-content'
  ) as HTMLElement
  dropTargetCleanup = dropTargetForElements({
    element: treeNodeElement.value,
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
  dropTargetCleanup()
  if (stopWatchCustomization) {
    stopWatchCustomization()
  }
})
</script>

<style scoped>
.node-tree-folder {
  display: flex;
  align-items: center;
}
</style>
