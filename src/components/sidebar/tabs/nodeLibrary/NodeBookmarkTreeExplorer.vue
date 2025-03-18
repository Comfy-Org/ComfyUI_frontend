<template>
  <TreeExplorer
    class="node-lib-bookmark-tree-explorer"
    ref="treeExplorerRef"
    :root="renderedBookmarkedRoot"
    :expandedKeys="expandedKeys"
  >
    <template #folder="{ node }">
      <NodeTreeFolder :node="node" />
    </template>
    <template #node="{ node }">
      <NodeTreeLeaf :node="node" />
    </template>
  </TreeExplorer>

  <FolderCustomizationDialog
    v-model="showCustomizationDialog"
    @confirm="updateCustomization"
    :initialIcon="initialIcon"
    :initialColor="initialColor"
  />
</template>

<script setup lang="ts">
import type { TreeNode } from 'primevue/treenode'
import { computed, h, nextTick, ref, render, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FolderCustomizationDialog from '@/components/common/CustomizationDialog.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import NodePreview from '@/components/node/NodePreview.vue'
import NodeTreeFolder from '@/components/sidebar/tabs/nodeLibrary/NodeTreeFolder.vue'
import NodeTreeLeaf from '@/components/sidebar/tabs/nodeLibrary/NodeTreeLeaf.vue'
import { useTreeExpansion } from '@/composables/useTreeExpansion'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerDragAndDropData,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'

const props = defineProps<{
  filteredNodeDefs: ComfyNodeDefImpl[]
}>()

const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const nodeBookmarkStore = useNodeBookmarkStore()
const bookmarkedRoot = computed<TreeNode>(() => {
  const filterTree = (node: TreeNode): TreeNode | null => {
    if (node.leaf) {
      // Check if the node's display_name is in the filteredNodeDefs list
      return props.filteredNodeDefs.some((def) => def.name === node.data.name)
        ? node
        : null
    }

    const filteredChildren = node.children
      ?.map(filterTree)
      .filter((child): child is TreeNode => child !== null)

    if (filteredChildren && filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren
      }
    }

    return null // Remove empty folders
  }

  return props.filteredNodeDefs.length
    ? filterTree(nodeBookmarkStore.bookmarkedRoot) || {
        key: 'root',
        label: 'Root',
        children: []
      }
    : nodeBookmarkStore.bookmarkedRoot
})
watch(
  () => props.filteredNodeDefs,
  (newValue) => {
    if (newValue.length) {
      nextTick(() => expandNode(bookmarkedRoot.value))
    }
  }
)

const { t } = useI18n()
const extraMenuItems = (
  menuTargetNode: RenderedTreeExplorerNode<ComfyNodeDefImpl>
) => [
  {
    label: t('g.customize'),
    icon: 'pi pi-palette',
    command: () => {
      if (!menuTargetNode.data) return

      const customization =
        nodeBookmarkStore.bookmarksCustomization[menuTargetNode.data.nodePath]
      initialIcon.value =
        customization?.icon || nodeBookmarkStore.defaultBookmarkIcon
      initialColor.value =
        customization?.color || nodeBookmarkStore.defaultBookmarkColor

      showCustomizationDialog.value = true
      customizationTargetNodePath.value = menuTargetNode.data.nodePath
    },
    visible: !menuTargetNode?.leaf
  }
]

const renderedBookmarkedRoot = computed<TreeExplorerNode<ComfyNodeDefImpl>>(
  () => {
    const fillNodeInfo = (
      node: TreeNode
    ): TreeExplorerNode<ComfyNodeDefImpl> => {
      const children = node.children?.map(fillNodeInfo)

      // Sort children: non-leaf nodes first, then leaf nodes, both alphabetically
      const sortedChildren = children?.sort((a, b) => {
        if (a.leaf === b.leaf) {
          return a.label.localeCompare(b.label)
        }
        return a.leaf ? 1 : -1
      })

      return {
        key: node.key,
        label: node.leaf ? node.data.display_name : node.label,
        leaf: node.leaf,
        data: node.data,
        getIcon() {
          if (this.leaf) {
            return 'pi pi-circle-fill'
          }
          const customization =
            nodeBookmarkStore.bookmarksCustomization[node.data?.nodePath]
          return customization?.icon
            ? 'pi ' + customization.icon
            : 'pi pi-bookmark-fill'
        },
        children: sortedChildren,
        draggable: node.leaf,
        handleAddFolder(newName: string) {
          if (newName !== '') {
            nodeBookmarkStore.addNewBookmarkFolder(this.data, newName)
          }
        },
        renderDragPreview(container) {
          const vnode = h(NodePreview, { nodeDef: node.data })
          render(vnode, container)
          return () => {
            render(null, container)
          }
        },
        droppable: !node.leaf,
        handleDrop(data: TreeExplorerDragAndDropData<ComfyNodeDefImpl>) {
          const nodeDefToAdd = data.data.data
          // Remove bookmark if the source is the top level bookmarked node.
          if (nodeBookmarkStore.isBookmarked(nodeDefToAdd)) {
            nodeBookmarkStore.toggleBookmark(nodeDefToAdd)
          }
          const folderNodeDef = node.data as ComfyNodeDefImpl
          const nodePath = folderNodeDef.category + '/' + nodeDefToAdd.name
          nodeBookmarkStore.addBookmark(nodePath)
        },
        handleClick(e: MouseEvent) {
          if (this.leaf) {
            useLitegraphService().addNodeOnGraph(this.data)
          } else {
            toggleNodeOnEvent(e, node)
          }
        },
        contextMenuItems: extraMenuItems,
        ...(node.leaf
          ? {}
          : {
              handleRename(newName: string) {
                if (this.data && this.data.isDummyFolder) {
                  nodeBookmarkStore.renameBookmarkFolder(this.data, newName)
                }
              },
              handleDelete() {
                nodeBookmarkStore.deleteBookmarkFolder(this.data)
              }
            })
      }
    }
    return fillNodeInfo(bookmarkedRoot.value)
  }
)

const treeExplorerRef = ref<InstanceType<typeof TreeExplorer> | null>(null)
defineExpose({
  addNewBookmarkFolder: () => treeExplorerRef.value?.addFolderCommand('root')
})

const showCustomizationDialog = ref(false)
const initialIcon = ref(nodeBookmarkStore.defaultBookmarkIcon)
const initialColor = ref(nodeBookmarkStore.defaultBookmarkColor)
const customizationTargetNodePath = ref('')
const updateCustomization = (icon: string, color: string) => {
  if (customizationTargetNodePath.value) {
    nodeBookmarkStore.updateBookmarkCustomization(
      customizationTargetNodePath.value,
      { icon, color }
    )
  }
}
</script>
