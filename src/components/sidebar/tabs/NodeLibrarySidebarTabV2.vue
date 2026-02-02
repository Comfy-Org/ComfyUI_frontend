<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div id="node-library-node-preview-container-v2" />
    <!-- Fixed header -->
    <div class="shrink-0 px-4 pt-2 pb-1">
      <h2 class="m-0 mb-1 text-sm font-bold leading-8">
        {{ $t('sideToolbar.nodes') }}
      </h2>
      <SearchBox
        ref="searchBoxRef"
        v-model="searchQuery"
        :placeholder="$t('g.search') + '...'"
        @search="handleSearch"
      />
    </div>

    <!-- Tabs container -->
    <TabsRoot
      v-model="selectedTab"
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <!-- Fixed tab list -->
      <TabsList
        class="shrink-0 flex gap-4 border-b border-comfy-input px-4 pb-2"
      >
        <TabsTrigger
          v-for="tab in tabs"
          :key="tab.value"
          :value="tab.value"
          :class="
            cn(
              'select-none border-none outline-none px-3 py-2 rounded-lg cursor-pointer',
              'text-sm text-foreground transition-colors',
              selectedTab === tab.value
                ? 'bg-comfy-input font-bold'
                : 'bg-transparent font-normal'
            )
          "
        >
          {{ tab.label }}
        </TabsTrigger>
      </TabsList>

      <!-- Scrollable tab content -->
      <EssentialNodesPanel
        v-model:expanded-keys="expandedKeys"
        :root="renderedEssentialRoot"
        @node-click="handleNodeClick"
      />
      <AllNodesPanel
        v-model:expanded-keys="expandedKeys"
        :sections="renderedSections"
        :fill-node-info="fillNodeInfo"
        @node-click="handleNodeClick"
      />
      <CustomNodesPanel
        v-model:expanded-keys="expandedKeys"
        :sections="renderedCustomSections"
        @node-click="handleNodeClick"
      />
    </TabsRoot>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useLocalStorage } from '@vueuse/core'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/common/SearchBoxV2.vue'
import { useLitegraphService } from '@/services/litegraphService'
import {
  DEFAULT_TAB_ID,
  nodeOrganizationService
} from '@/services/nodeOrganizationService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { TabId } from '@/types/nodeOrganizationTypes'
import type {
  RenderedTreeExplorerNode,
  TreeNode
} from '@/types/treeExplorerTypes'

import AllNodesPanel from './nodeLibrary/AllNodesPanel.vue'
import CustomNodesPanel from './nodeLibrary/CustomNodesPanel.vue'
import EssentialNodesPanel from './nodeLibrary/EssentialNodesPanel.vue'

const selectedTab = useLocalStorage<TabId>(
  'Comfy.NodeLibrary.Tab',
  DEFAULT_TAB_ID
)

const { t } = useI18n()

const searchBoxRef = ref()
const searchQuery = ref('')
const expandedKeys = ref<string[]>([])

const nodeDefStore = useNodeDefStore()

const filteredNodeDefs = computed(() => {
  if (searchQuery.value.length === 0) {
    return []
  }
  return nodeDefStore.nodeSearchService.searchNode(
    searchQuery.value,
    [],
    { limit: 64 },
    { matchWildcards: false }
  )
})

const sections = computed(() => {
  const nodes =
    filteredNodeDefs.value.length > 0
      ? filteredNodeDefs.value
      : nodeDefStore.visibleNodeDefs

  return nodeOrganizationService.organizeNodesByTab(nodes, 'all')
})

function fillNodeInfo(
  node: TreeNode
): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
  const children = node.children?.map(fillNodeInfo)
  const totalLeaves = node.leaf
    ? 1
    : (children?.reduce((acc, child) => acc + child.totalLeaves, 0) ?? 0)

  return {
    key: node.key,
    label: node.leaf ? node.data?.display_name : node.label,
    leaf: node.leaf,
    data: node.data,
    icon: node.leaf ? 'pi pi-circle-fill' : 'pi pi-folder',
    type: node.leaf ? 'node' : 'folder',
    totalLeaves,
    children
  }
}

const renderedSections = computed(() => {
  return sections.value.map((section) => ({
    title: section.title,
    root: fillNodeInfo(section.tree)
  }))
})

const essentialSections = computed(() => {
  const nodes =
    filteredNodeDefs.value.length > 0
      ? filteredNodeDefs.value
      : nodeDefStore.visibleNodeDefs

  return nodeOrganizationService.organizeNodesByTab(nodes, 'essential')
})

const renderedEssentialRoot = computed(() => {
  const section = essentialSections.value[0]
  return section
    ? fillNodeInfo(section.tree)
    : fillNodeInfo({ key: 'root', label: '', children: [] })
})

const customSections = computed(() => {
  const nodes =
    filteredNodeDefs.value.length > 0
      ? filteredNodeDefs.value
      : nodeDefStore.visibleNodeDefs

  return nodeOrganizationService.organizeNodesByTab(nodes, 'custom')
})

const renderedCustomSections = computed(() => {
  return customSections.value.map((section) => ({
    root: fillNodeInfo(section.tree)
  }))
})

function collectFolderKeys(node: TreeNode): string[] {
  if (node.leaf) return []
  const keys = [node.key]
  for (const child of node.children ?? []) {
    keys.push(...collectFolderKeys(child))
  }
  return keys
}

function expandAllResults() {
  if (filteredNodeDefs.value.length > 0) {
    const allKeys: string[] = []

    if (selectedTab.value === 'essential') {
      for (const section of essentialSections.value) {
        allKeys.push(...collectFolderKeys(section.tree))
      }
    } else if (selectedTab.value === 'custom') {
      for (const section of customSections.value) {
        allKeys.push(...collectFolderKeys(section.tree))
      }
    } else {
      for (const section of sections.value) {
        allKeys.push(...collectFolderKeys(section.tree))
      }
    }

    expandedKeys.value = allKeys
  } else {
    expandedKeys.value = []
  }
}

function handleNodeClick(node: RenderedTreeExplorerNode<ComfyNodeDefImpl>) {
  if (node.type === 'node' && node.data) {
    useLitegraphService().addNodeOnGraph(node.data)
  }
  if (node.type === 'folder') {
    const index = expandedKeys.value.indexOf(node.key)
    if (index === -1) {
      expandedKeys.value = [...expandedKeys.value, node.key]
    } else {
      expandedKeys.value = expandedKeys.value.filter((k) => k !== node.key)
    }
  }
}

const handleSearch = async (_query: string) => {
  await nextTick()
  expandAllResults()
}

const tabs = [
  { value: 'essential', label: t('sideToolbar.nodeLibraryTab.essential') },
  { value: 'all', label: t('sideToolbar.nodeLibraryTab.allNodes') },
  { value: 'custom', label: t('sideToolbar.nodeLibraryTab.custom') }
]

onMounted(() => {
  searchBoxRef.value?.focus()
})
</script>
