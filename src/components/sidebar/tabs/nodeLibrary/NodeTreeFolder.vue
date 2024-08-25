<template>
  <div class="node-tree-folder" ref="container">
    <span class="folder-label">{{ props.node.label }}</span>
    <Badge
      :value="props.node.totalNodes"
      severity="secondary"
      :style="{ marginLeft: '0.5rem' }"
    />
  </div>
</template>

<script setup lang="ts">
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import type { CanvasDragAndDropData } from '@/types/litegraphTypes'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import Badge from 'primevue/badge'
import type { TreeNode } from 'primevue/treenode'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  node: TreeNode
  isBookmarkFolder: boolean
}>()

const settingStore = useSettingStore()
// Bookmarks are in format of category/display_name. e.g. "comfy/conditioning/CLIPTextEncode"
const bookmarks = computed(() =>
  settingStore.get('Comfy.NodeLibrary.Bookmarks')
)
const addNodeToBookmarkFolder = (node: ComfyNodeDefImpl) => {
  if (!props.node.data) {
    console.error('Bookmark folder does not have data!')
    return
  }
  const folderNodeDef = props.node.data as ComfyNodeDefImpl
  const nodePath = folderNodeDef.category + '/' + node.display_name
  if (bookmarks.value.includes(nodePath)) return
  settingStore.set('Comfy.NodeLibrary.Bookmarks', [
    ...bookmarks.value,
    nodePath
  ])
}

const container = ref<HTMLElement | null>(null)

let dropTargetCleanup = () => {}
onMounted(() => {
  if (!props.isBookmarkFolder) return

  const treeNodeElement = container.value?.closest(
    '.p-tree-node'
  ) as HTMLElement
  dropTargetCleanup = dropTargetForElements({
    element: treeNodeElement,
    onDrop: (event) => {
      const dndData = event.source.data as CanvasDragAndDropData
      if (dndData.type === 'add-node') {
        addNodeToBookmarkFolder(dndData.data)
      }
    }
  })
})
onUnmounted(() => {
  dropTargetCleanup()
})
</script>
