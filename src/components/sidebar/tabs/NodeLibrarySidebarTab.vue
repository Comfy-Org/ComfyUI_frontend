<template>
  <SidebarTabTemplate :title="$t('sideToolbar.nodeLibrary')">
    <template #tool-buttons>
      <ToggleButton
        v-model:model-value="alphabeticalSort"
        on-icon="pi pi-sort-alpha-down"
        off-icon="pi pi-sort-alt"
        aria-label="Sort"
        :pt="{
          label: { style: { display: 'none' } }
        }"
        v-tooltip="$t('sideToolbar.nodeLibraryTab.sortOrder')"
      >
      </ToggleButton>
    </template>
    <template #body>
      <SearchBox
        class="node-lib-search-box"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        :placeholder="$t('searchNodes') + '...'"
      />
      <TreePlus
        class="node-lib-tree"
        v-model:expandedKeys="expandedKeys"
        selectionMode="single"
        :value="renderedRoot.children"
        dragSelector=".p-tree-node-leaf"
        :pt="{
          nodeLabel: 'node-lib-tree-node-label',
          nodeContent: ({ props }) => ({
            onClick: (e: MouseEvent) => onNodeContentClick(e, props.node)
          }),
          nodeChildren: ({ props }) => ({
            'data-comfy-node-name': props.node?.data?.name,
            onMouseenter: (event: MouseEvent) =>
              handleNodeHover(event, props.node?.data?.name),
            onMouseleave: () => {
              hoveredComfyNodeName = null
            }
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
          <span class="folder-label">{{ node.label }}</span>
          <Badge
            :value="node.totalNodes"
            severity="secondary"
            :style="{ marginLeft: '0.5rem' }"
          ></Badge>
        </template>
        <template #node="{ node }">
          <NodeTreeLeaf
            :node="node.data"
            :isBookmarked="isBookmarked(node.data)"
            @toggleBookmark="toggleBookmark(node.data.display_name)"
          />
        </template>
      </TreePlus>
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
</template>

<script setup lang="ts">
import Badge from 'primevue/badge'
import ToggleButton from 'primevue/togglebutton'
import {
  buildNodeDefTree,
  ComfyNodeDefImpl,
  useNodeDefStore
} from '@/stores/nodeDefStore'
import { computed, ref, nextTick } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import NodeTreeLeaf from './nodeLibrary/NodeTreeLeaf.vue'
import TreePlus from '@/components/primevueOverride/TreePlus.vue'
import NodePreview from '@/components/node/NodePreview.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import { useSettingStore } from '@/stores/settingStore'
import { app } from '@/scripts/app'
import { sortedTree } from '@/utils/treeUtil'
import _ from 'lodash'

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

// Bookmarks are in format of category/display_name. e.g. "comfy/conditioning/CLIPTextEncode"
const bookmarks = computed(() =>
  settingStore.get('Comfy.NodeLibrary.Bookmarks')
)
const bookmarkedNodes = computed(
  () =>
    new Set(
      bookmarks.value.map((bookmark: string) => bookmark.split('/').pop())
    )
)
const isBookmarked = (node: ComfyNodeDefImpl) =>
  bookmarkedNodes.value.has(node.display_name)
const toggleBookmark = (bookmark: string) => {
  if (bookmarks.value.includes(bookmark)) {
    settingStore.set(
      'Comfy.NodeLibrary.Bookmarks',
      bookmarks.value.filter((b: string) => b !== bookmark)
    )
  } else {
    settingStore.set('Comfy.NodeLibrary.Bookmarks', [
      ...bookmarks.value,
      bookmark
    ])
  }
}
const bookmarkedRoot = computed<TreeNode>(() => {
  const bookmarkNodes = bookmarks.value
    .map((bookmark: string) => {
      const parts = bookmark.split('/')
      const displayName = parts.pop()
      const category = parts.join('/')
      const srcNodeDef = nodeDefStore.nodeDefsByDisplayName[displayName]
      if (!srcNodeDef) {
        return null
      }
      const nodeDef = _.clone(srcNodeDef)
      nodeDef.category = category
      return nodeDef
    })
    .filter((nodeDef) => nodeDef !== null)
  return buildNodeDefTree(bookmarkNodes)
})

const allNodesRoot = computed<TreeNode>(() => {
  return {
    key: 'all-nodes',
    label: 'All Nodes',
    children: [
      ...(bookmarkedRoot.value?.children ?? []),
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

const toggleNode = (node: TreeNode) => {
  if (node.key in expandedKeys.value) {
    delete expandedKeys.value[node.key]
  } else {
    expandedKeys.value[node.key] = true
  }
}

const toggleNodeRecursive = (node: TreeNode) => {
  if (node.key in expandedKeys.value) {
    collapseNode(node)
  } else {
    expandNode(node)
  }
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

const expandNode = (node: TreeNode) => {
  if (node.children && node.children.length) {
    expandedKeys.value[node.key] = true

    for (let child of node.children) {
      expandNode(child)
    }
  }
}

const collapseNode = (node: TreeNode) => {
  if (node.children && node.children.length) {
    delete expandedKeys.value[node.key]

    for (let child of node.children) {
      collapseNode(child)
    }
  }
}

const onNodeContentClick = (e: MouseEvent, node: TreeNode) => {
  if (!node.key) return
  if (node.type === 'folder') {
    if (e.ctrlKey) {
      toggleNodeRecursive(node)
    } else {
      toggleNode(node)
    }
  } else {
    insertNode(node.data)
  }
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
</style>
