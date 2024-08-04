<template>
  <SideBarTabTemplate :title="$t('sideToolBar.nodeLibrary')">
    <template #tool-buttons>
      <ToggleButton
        v-model:model-value="alphabeticalSort"
        on-icon="pi pi-sort-alpha-down"
        off-icon="pi pi-sort-alt"
        aria-label="Sort"
        :pt="{
          label: { style: { display: 'none' } }
        }"
        v-tooltip="$t('sideToolBar.nodeLibraryTab.sortOrder')"
      >
      </ToggleButton>
    </template>
    <template #body>
      <TreePlus
        class="node-lib-tree"
        v-model:expandedKeys="expandedKeys"
        selectionMode="single"
        :value="renderedRoot.children"
        :filter="true"
        filterMode="lenient"
        dragSelector=".p-tree-node-leaf"
        :pt="{
          nodeLabel: 'node-lib-tree-node-label',
          nodeChildren: ({ props }) => ({
            'data-comfy-node-name': props.node?.data?.name,
            onMouseenter: (event: MouseEvent) => {
              hoveredComfyNodeName = props.node?.data?.name

              const hoverTarget = event.target as HTMLElement
              const targetRect = hoverTarget.getBoundingClientRect()
              nodePreviewStyle.top = `${targetRect.top - 40}px`
              nodePreviewStyle.left = `${targetRect.right}px`
            },
            onMouseleave: () => {
              hoveredComfyNodeName = null
            }
          })
        }"
      >
        <template #folder="{ node }">
          <span class="folder-label">{{ node.label }}</span>
          <Badge
            :value="node.totalNodes"
            severity="secondary"
            :style="{ marginLeft: '0.5rem' }"
          ></Badge>
        </template>
        <template #node="{ node }">
          <span class="node-label">{{ node.label }}</span>
        </template>
      </TreePlus>
      <div
        v-if="hoveredComfyNode"
        class="node-lib-node-preview"
        :style="nodePreviewStyle"
      >
        <NodePreview
          :key="hoveredComfyNode.name"
          :nodeDef="hoveredComfyNode"
        ></NodePreview>
      </div>
    </template>
  </SideBarTabTemplate>
</template>

<script setup lang="ts">
import Badge from 'primevue/badge'
import ToggleButton from 'primevue/togglebutton'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { computed, ref } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import TreePlus from '@/components/primevueOverride/TreePlus.vue'
import NodePreview from '@/components/NodePreview.vue'
import SideBarTabTemplate from '@/components/sidebar/tabs/SideBarTabTemplate.vue'

const nodeDefStore = useNodeDefStore()
const alphabeticalSort = ref(false)
const expandedKeys = ref({})
const hoveredComfyNodeName = ref<string | null>(null)
const hoveredComfyNode = computed<ComfyNodeDefImpl | null>(() => {
  if (!hoveredComfyNodeName.value) {
    return null
  }
  return nodeDefStore.nodeDefsByName[hoveredComfyNodeName.value] || null
})
const nodePreviewStyle = ref<Record<string, string>>({
  position: 'absolute',
  top: '0px',
  left: '0px'
})

const root = computed(() =>
  alphabeticalSort.value ? nodeDefStore.sortedNodeTree : nodeDefStore.nodeTree
)
const renderedRoot = computed(() => {
  return fillNodeInfo(root.value)
})
const fillNodeInfo = (node: TreeNode): TreeNode => {
  const isExpanded = expandedKeys.value[node.key]
  const icon = node.leaf
    ? 'pi pi-circle-fill'
    : isExpanded
      ? 'pi pi-folder-open'
      : 'pi pi-folder'
  const children = node.children?.map(fillNodeInfo)

  return {
    ...node,
    icon,
    children,
    type: node.leaf ? 'node' : 'folder',
    totalNodes: node.leaf
      ? 1
      : children.reduce((acc, child) => acc + child.totalNodes, 0)
  }
}
</script>
