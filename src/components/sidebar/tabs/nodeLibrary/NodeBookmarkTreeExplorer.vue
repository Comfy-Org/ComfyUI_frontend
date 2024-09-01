<template>
  <TreeExplorer
    :roots="renderedBookmarkedRoot.children"
    :expandedKeys="expandedKeys"
    :extraMenuItems="extraMenuItems"
    @nodeClick="handleNodeClick"
  >
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
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import NodeTreeLeaf from '@/components/sidebar/tabs/nodeLibrary/NodeTreeLeaf.vue'
import FolderCustomizationDialog from '@/components/common/CustomizationDialog.vue'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'
import type { TreeNode } from 'primevue/treenode'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTreeExpansion } from '@/hooks/treeHooks'
import { app } from '@/scripts/app'

const { expandedKeys, toggleNodeOnEvent } = useTreeExpansion()

const handleNodeClick = (
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>,
  e: MouseEvent
) => {
  if (node.leaf) {
    app.addNodeOnGraph(node.data, { pos: app.getCanvasCenter() })
  } else {
    toggleNodeOnEvent(e, node)
  }
}

const nodeBookmarkStore = useNodeBookmarkStore()
const renderedBookmarkedRoot = computed<TreeExplorerNode<ComfyNodeDefImpl>>(
  () => {
    const fillNodeInfo = (
      node: TreeNode
    ): TreeExplorerNode<ComfyNodeDefImpl> => {
      const children = node.children?.map(fillNodeInfo)

      return {
        key: node.key,
        label: node.label,
        leaf: node.leaf,
        data: node.data,
        getIcon: (node: TreeExplorerNode<ComfyNodeDefImpl>) => {
          if (node.leaf) {
            return 'pi pi-circle-fill'
          }
          const customization =
            nodeBookmarkStore.bookmarksCustomization[node.data.nodePath]
          return customization?.icon
            ? 'pi ' + customization.icon
            : 'pi pi-bookmark-fill'
        },
        children,
        draggable: node.leaf,
        droppable: !node.leaf,
        ...(node.leaf
          ? {}
          : {
              handleRename,
              handleDelete: (node: TreeExplorerNode<ComfyNodeDefImpl>) => {
                nodeBookmarkStore.deleteBookmarkFolder(node.data)
              }
            })
      }
    }
    return fillNodeInfo(nodeBookmarkStore.bookmarkedRoot)
  }
)

const addNewBookmarkFolder = (parent?: ComfyNodeDefImpl) => {
  const newFolderKey =
    'root/' + nodeBookmarkStore.addNewBookmarkFolder(parent).slice(0, -1)
  nextTick(() => {
    // renameEditingNode.value = findNodeByKey(renderedRoot.value, newFolderKey)
  })
}

const toast = useToast()
const { t } = useI18n()
const handleRename = (node: TreeNode, newName: string) => {
  if (node.data && node.data.isDummyFolder) {
    try {
      nodeBookmarkStore.renameBookmarkFolder(node.data, newName)
    } catch (e) {
      toast.add({
        severity: 'error',
        summary: t('error'),
        detail: e.message,
        life: 3000
      })
    }
  }
}

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

const extraMenuItems = computed(
  () => (menuTargetNode: RenderedTreeExplorerNode<ComfyNodeDefImpl>) => [
    {
      label: t('newFolder'),
      icon: 'pi pi-folder-plus',
      command: () => {
        if (menuTargetNode.data) {
          addNewBookmarkFolder(menuTargetNode.data)
        }
      }
    },
    {
      label: t('customize'),
      icon: 'pi pi-palette',
      command: () => {
        const customization =
          nodeBookmarkStore.bookmarksCustomization[menuTargetNode.data.nodePath]
        initialIcon.value =
          customization?.icon || nodeBookmarkStore.defaultBookmarkIcon
        initialColor.value =
          customization?.color || nodeBookmarkStore.defaultBookmarkColor

        showCustomizationDialog.value = true
        customizationTargetNodePath.value = menuTargetNode.data.nodePath
      }
    }
  ]
)
</script>
