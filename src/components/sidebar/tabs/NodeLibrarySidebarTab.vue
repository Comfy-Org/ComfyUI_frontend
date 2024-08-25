<template>
  <SidebarTabTemplate :title="$t('sideToolbar.nodeLibrary')">
    <template #tool-buttons>
      <Button
        icon="pi pi-folder-plus"
        text
        severity="secondary"
        @click="addNewBookmarkFolder"
        v-tooltip="$t('newFolder')"
      />
      <Button
        :icon="alphabeticalSort ? 'pi pi-sort-alpha-down' : 'pi pi-sort-alt'"
        text
        severity="secondary"
        @click="alphabeticalSort = !alphabeticalSort"
        v-tooltip="$t('sideToolbar.nodeLibraryTab.sortOrder')"
      />
    </template>
    <template #body>
      <SearchBox
        class="node-lib-search-box"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        :placeholder="$t('searchNodes') + '...'"
      />
      <Tree
        class="node-lib-tree"
        v-model:expandedKeys="expandedKeys"
        selectionMode="single"
        :value="renderedRoot.children"
        :pt="{
          nodeLabel: 'node-lib-tree-node-label',
          nodeContent: ({ props }) => ({
            onClick: (e: MouseEvent) => onNodeContentClick(e, props.node),
            onMouseenter: (event: MouseEvent) =>
              handleNodeHover(event, props.node?.data?.name),
            onMouseleave: () => {
              hoveredComfyNodeName = null
            },
            onContextmenu: (e: MouseEvent) => handleContextMenu(props.node, e)
          }),
          nodeToggleButton: () => ({
            onClick: (e: MouseEvent) => {
              // Prevent toggle action as the node controls it
              e.stopImmediatePropagation()
            }
          })
        }"
      >
        <template #folder="{ node }">
          <NodeTreeFolder
            :node="node"
            :isBookmarkFolder="!!node.data && isBookmarked(node.data)"
            @itemDropped="handleItemDropped"
          >
            <template #folder-label="{ node }">
              <EditableText
                :modelValue="node.label"
                :isEditing="renameEditingNode?.key === node.key"
                @edit="(newName: string) => handleRename(node, newName)"
              />
            </template>
          </NodeTreeFolder>
        </template>
        <template #node="{ node }">
          <NodeTreeLeaf
            :node="node.data"
            :isBookmarked="isBookmarked(node.data)"
            @toggleBookmark="toggleBookmark(node.data)"
          />
        </template>
      </Tree>
      <div
        v-if="hoveredComfyNode"
        class="node-lib-node-preview"
        :style="nodePreviewStyle"
      >
        <NodePreview
          ref="previewRef"
          :key="hoveredComfyNode.name"
          :nodeDef="hoveredComfyNode"
        ></NodePreview>
      </div>
    </template>
  </SidebarTabTemplate>
  <ContextMenu ref="menu" :model="menuItems" />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import {
  buildNodeDefTree,
  ComfyNodeDefImpl,
  useNodeDefStore
} from '@/stores/nodeDefStore'
import { computed, ref, nextTick } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import NodeTreeLeaf from './nodeLibrary/NodeTreeLeaf.vue'
import NodeTreeFolder from './nodeLibrary/NodeTreeFolder.vue'
import Tree from 'primevue/tree'
import ContextMenu from 'primevue/contextmenu'
import EditableText from '@/components/common/EditableText.vue'
import NodePreview from '@/components/node/NodePreview.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import { useSettingStore } from '@/stores/settingStore'
import { app } from '@/scripts/app'
import { sortedTree } from '@/utils/treeUtil'
import _ from 'lodash'
import { useTreeExpansion } from '@/hooks/treeHooks'
import type { MenuItem } from 'primevue/menuitem'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

const { t } = useI18n()
const toast = useToast()
const nodeDefStore = useNodeDefStore()
const { expandedKeys, expandNode, toggleNodeOnEvent } = useTreeExpansion()

const alphabeticalSort = ref(false)
const hoveredComfyNodeName = ref<string | null>(null)
const hoveredComfyNode = computed<ComfyNodeDefImpl | null>(() => {
  if (!hoveredComfyNodeName.value) {
    return null
  }
  return nodeDefStore.nodeDefsByName[hoveredComfyNodeName.value] || null
})
const previewRef = ref<InstanceType<typeof NodePreview> | null>(null)
const searchQuery = ref<string>('')

const settingStore = useSettingStore()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const nodePreviewStyle = ref<Record<string, string>>({
  position: 'absolute',
  top: '0px',
  left: '0px'
})

const nodeBookmarkStore = useNodeBookmarkStore()
const { isBookmarked, toggleBookmark, addNewBookmarkFolder } = nodeBookmarkStore

const allNodesRoot = computed<TreeNode>(() => {
  return {
    key: 'all-nodes',
    label: 'All Nodes',
    children: [
      ...(nodeBookmarkStore.bookmarkedRoot.children ?? []),
      ...nodeDefStore.nodeTree.children
    ]
  }
})

const root = computed(() => {
  const root = filteredRoot.value || allNodesRoot.value
  return alphabeticalSort.value ? sortedTree(root) : root
})

const renderedRoot = computed(() => {
  return fillNodeInfo(root.value)
})

const getTreeNodeIcon = (node: TreeNode) => {
  if (node.leaf) {
    return 'pi pi-circle-fill'
  }

  // If the node is a bookmark folder, show a bookmark icon
  if (node.data && isBookmarked(node.data)) {
    return 'pi pi-bookmark'
  }

  const isExpanded = expandedKeys.value[node.key]
  return isExpanded ? 'pi pi-folder' : 'pi pi-folder-open'
}

const fillNodeInfo = (node: TreeNode): TreeNode => {
  const children = node.children?.map(fillNodeInfo)

  return {
    ...node,
    icon: getTreeNodeIcon(node),
    children,
    type: node.leaf ? 'node' : 'folder',
    totalNodes: node.leaf
      ? 1
      : children.reduce((acc, child) => acc + child.totalNodes, 0)
  }
}

const handleNodeHover = async (
  event: MouseEvent,
  nodeName: string | undefined
) => {
  hoveredComfyNodeName.value = nodeName || null

  if (!nodeName) return

  const hoverTarget = event.target as HTMLElement
  const targetRect = hoverTarget.getBoundingClientRect()

  await nextTick()

  const previewHeight = previewRef.value?.$el.offsetHeight || 0
  const availableSpaceBelow = window.innerHeight - targetRect.bottom

  nodePreviewStyle.value.top =
    previewHeight > availableSpaceBelow
      ? `${Math.max(0, targetRect.top - (previewHeight - availableSpaceBelow) - 20)}px`
      : `${targetRect.top - 40}px`
  if (sidebarLocation.value === 'left') {
    nodePreviewStyle.value.left = `${targetRect.right}px`
  } else {
    nodePreviewStyle.value.left = `${targetRect.left - 400}px`
  }
}

const handleItemDropped = (node: TreeNode) => {
  expandedKeys.value[node.key] = true
}

const insertNode = (nodeDef: ComfyNodeDefImpl) => {
  app.addNodeOnGraph(nodeDef, { pos: app.getCanvasCenter() })
}

const filteredRoot = ref<TreeNode | null>(null)
const handleSearch = (query: string) => {
  if (query.length < 3) {
    filteredRoot.value = null
    expandedKeys.value = {}
    return
  }

  const matchedNodes = nodeDefStore.nodeSearchService.searchNode(query, [], {
    limit: 64
  })

  filteredRoot.value = buildNodeDefTree(matchedNodes)
  expandNode(filteredRoot.value)
}

const onNodeContentClick = (e: MouseEvent, node: TreeNode) => {
  if (!node.key) return
  if (node.type === 'folder') {
    toggleNodeOnEvent(e, node)
  } else {
    insertNode(node.data)
  }
}

const menu = ref(null)
const menuTargetNode = ref<TreeNode | null>(null)
const renameEditingNode = ref<TreeNode | null>(null)
const menuItems = computed<MenuItem[]>(() => [
  {
    label: t('delete'),
    icon: 'pi pi-trash',
    command: () => {
      if (menuTargetNode.value?.data) {
        nodeBookmarkStore.deleteBookmarkFolder(menuTargetNode.value.data)
      }
    }
  },
  {
    label: t('rename'),
    icon: 'pi pi-file-edit',
    command: () => {
      renameEditingNode.value = menuTargetNode.value
    }
  },
  {
    label: t('customize'),
    icon: 'pi pi-palette',
    command: () => console.log('customize')
  }
])

const handleContextMenu = (node: TreeNode, e: MouseEvent) => {
  const nodeDef = node.data as ComfyNodeDefImpl
  if (isBookmarked(nodeDef) && nodeDef?.isDummyFolder) {
    menuTargetNode.value = node
    menu.value?.show(e)
  }
}

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
  renameEditingNode.value = null
}
</script>

<style>
.node-lib-tree-node-label {
  display: flex;
  align-items: center;
  margin-left: var(--p-tree-node-gap);
  flex-grow: 1;
}
</style>

<style scoped>
:deep(.node-lib-search-box) {
  @apply mx-4 mt-4;
}

:deep(.comfy-vue-side-bar-body) {
  background: var(--p-tree-background);
}

/*
 * The following styles are necessary to avoid layout shift when dragging nodes over folders.
 * By setting the position to relative on the parent and using an absolutely positioned pseudo-element,
 * we can create a visual indicator for the drop target without affecting the layout of other elements.
 */
:deep(.p-tree-node:has(.node-tree-folder)) {
  position: relative;
}

:deep(.p-tree-node:has(.node-tree-folder.can-drop))::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 1px solid var(--p-content-color);
  pointer-events: none;
}
</style>
