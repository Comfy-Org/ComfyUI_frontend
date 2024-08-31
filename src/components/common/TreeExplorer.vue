<template>
  <Tree
    class="tree-explorer"
    :class="props.class"
    v-model:expandedKeys="expandedKeys"
    :value="renderedRoots"
    :pt="{
      nodeLabel: 'tree-explorer-node-label',
      nodeContent: ({ props }) => ({
        onClick: (e: MouseEvent) => onNodeContentClick(e, props.node),
        onContextmenu: (e: MouseEvent) => handleContextMenu(props.node, e)
      }),
      nodeToggleButton: () => ({
        onClick: (e: MouseEvent) => {
          e.stopImmediatePropagation()
        }
      })
    }"
  >
    <template #folder="{ node }">
      <slot
        name="folder"
        v-bind="{
          ...nodeSlotProps,
          node
        }"
      >
        <TreeFolder :node="node" @itemDropped="handleItemDropped">
          <template #folder-label="{ node }">
            <EditableText
              :modelValue="node.label"
              :isEditing="renameEditingNode?.key === node.key"
              @edit="(newName: string) => handleRename(node, newName)"
            />
          </template>
        </TreeFolder>
      </slot>
    </template>
    <template #node="{ node }">
      <slot
        name="node"
        v-bind="{
          ...nodeSlotProps,
          node: node.data
        }"
      >
        <TreeNode :node="node.data" />
      </slot>
    </template>
  </Tree>
  <ContextMenu ref="menu" :model="menuItems" />
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
import Tree from 'primevue/tree'
import ContextMenu from 'primevue/contextmenu'
import EditableText from '@/components/common/EditableText.vue'
import TreeFolder from '@/components/common/treeExplorer/TreeFolder.vue'
import TreeNode from '@/components/common/treeExplorer/TreeNode.vue'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode,
  TreeExplorerNodeSlotProps
} from '@/types/treeExplorerTypes'
import type { MenuItem } from 'primevue/menuitem'
import { useTreeExpansion } from '@/hooks/treeHooks'
const props = defineProps<{
  roots: TreeExplorerNode[]
  class?: string
  extraMenuItems?: MenuItem[]
}>()
const emit = defineEmits<{
  (e: 'nodeClick', node: RenderedTreeExplorerNode): void
  (e: 'nodeRename', node: RenderedTreeExplorerNode, newName: string): void
  (e: 'contextMenu', node: RenderedTreeExplorerNode, event: MouseEvent): void
}>()
const { expandedKeys, toggleNodeOnEvent } = useTreeExpansion()
const renderedRoots = computed<RenderedTreeExplorerNode[]>(() => {
  return props.roots.map(fillNodeInfo)
})
const getTreeNodeIcon = (node: TreeExplorerNode) => {
  if (typeof node.icon === 'function') {
    return node.icon(node)
  } else if (typeof node.icon === 'string') {
    return node.icon
  }
  // node.icon is undefined
  if (node.leaf) {
    return 'pi pi-file'
  }
  const isExpanded = expandedKeys.value[node.key]
  return isExpanded ? 'pi pi-folder-open' : 'pi pi-folder'
}
const fillNodeInfo = (node: TreeExplorerNode): RenderedTreeExplorerNode => {
  const children = node.children?.map(fillNodeInfo)
  return {
    ...node,
    icon: getTreeNodeIcon(node),
    children,
    type: node.leaf ? 'node' : 'folder',
    totalLeaves: node.leaf
      ? 1
      : children.reduce((acc, child) => acc + child.totalLeaves, 0)
  }
}
const handleItemDropped = (node: TreeExplorerNode) => {
  expandedKeys.value[node.key] = true
}
const onNodeContentClick = (e: MouseEvent, node: RenderedTreeExplorerNode) => {
  if (!node.key) return
  if (node.type === 'folder') {
    toggleNodeOnEvent(e, node)
  }
  emit('nodeClick', node)
}
const menu = ref(null)
const menuTargetNode = ref<TreeExplorerNode | null>(null)
const renameEditingNode = ref<TreeExplorerNode | null>(null)
const menuItems = computed<MenuItem[]>(() => [
  {
    label: 'Rename',
    icon: 'pi pi-file-edit',
    command: () => {
      renameEditingNode.value = menuTargetNode.value
    }
  },
  ...(props.extraMenuItems || [])
])
const handleContextMenu = (node: RenderedTreeExplorerNode, e: MouseEvent) => {
  menuTargetNode.value = node
  emit('contextMenu', node, e)
  menu.value?.show(e)
}
const handleRename = (node: RenderedTreeExplorerNode, newName: string) => {
  emit('nodeRename', node, newName)
  renameEditingNode.value = null
}
const nodeSlotProps: TreeExplorerNodeSlotProps = {
  node: {} as TreeExplorerNode, // This will be overwritten by v-bind in the template
  handleItemDropped,
  renameEditingNode,
  handleRename
}
</script>
<style scoped>
.tree-explorer-node-label {
  display: flex;
  align-items: center;
  margin-left: var(--p-tree-node-gap);
  flex-grow: 1;
}
/*
 * The following styles are necessary to avoid layout shift when dragging nodes over folders.
 * By setting the position to relative on the parent and using an absolutely positioned pseudo-element,
 * we can create a visual indicator for the drop target without affecting the layout of other elements.
 */
:deep(.p-tree-node-content:has(.tree-folder)) {
  position: relative;
}
:deep(.p-tree-node-content:has(.tree-folder.can-drop))::after {
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
