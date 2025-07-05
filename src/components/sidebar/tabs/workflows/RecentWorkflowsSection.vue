<template>
  <div v-if="hasRecentWorkflows" class="recent-workflows-section">
    <div
      v-show="
        recentItemsStore.recentlyAddedWorkflows.length > 0 &&
        showRecentlyAddedWorkflows
      "
      class="comfyui-workflows-recently-added"
    >
      <div
        class="flex items-center cursor-pointer p-2"
        @click="toggleRecentlyAdded"
      >
        <i
          :class="[
            'pi text-sm mr-2 transition-transform',
            isRecentlyAddedExpanded ? 'pi-chevron-down' : 'pi-chevron-right'
          ]"
        />
        <span class="text-sm font-medium">{{
          $t('sideToolbar.workflowTab.workflowTreeType.recentlyAddedWorkflows')
        }}</span>
      </div>
      <div v-show="isRecentlyAddedExpanded" class="ml-4">
        <TreeExplorer
          v-model:expandedKeys="dummyExpandedKeys"
          :root="recentlyAddedRoot"
          :selection-keys="selectionKeys"
        >
          <template #node="{ node }">
            <WorkflowTreeLeaf :node="node" />
          </template>
        </TreeExplorer>
      </div>
    </div>

    <div
      v-show="
        recentItemsStore.recentlyUsedWorkflows.length > 0 &&
        showRecentlyUsedWorkflows
      "
      class="comfyui-workflows-recently-used"
    >
      <div
        class="flex items-center cursor-pointer p-2"
        @click="toggleRecentlyUsed"
      >
        <i
          :class="[
            'pi text-sm mr-2 transition-transform',
            isRecentlyUsedExpanded ? 'pi-chevron-down' : 'pi-chevron-right'
          ]"
        />
        <span class="text-sm font-medium">{{
          $t('sideToolbar.workflowTab.workflowTreeType.recentlyUsedWorkflows')
        }}</span>
      </div>
      <div v-show="isRecentlyUsedExpanded" class="ml-4">
        <TreeExplorer
          v-model:expandedKeys="dummyExpandedKeys"
          :root="recentlyUsedRoot"
          :selection-keys="selectionKeys"
        >
          <template #node="{ node }">
            <WorkflowTreeLeaf :node="node" />
          </template>
        </TreeExplorer>
      </div>
    </div>
    <Divider />
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import { computed, defineProps, ref } from 'vue'

import TreeExplorer from '@/components/common/TreeExplorer.vue'
import WorkflowTreeLeaf from '@/components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue'
import { useRecentItemsStore } from '@/stores/recentItemsStore'
import { useSettingStore } from '@/stores/settingStore'
import { ComfyWorkflow, WorkflowTreeType } from '@/stores/workflowStore'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { buildTree } from '@/utils/treeUtil'

const props = defineProps<{
  selectionKeys: Record<string, boolean>
  renderTreeNode: (
    node: TreeNode,
    type: WorkflowTreeType
  ) => TreeExplorerNode<ComfyWorkflow>
}>()

const settingStore = useSettingStore()
const recentItemsStore = useRecentItemsStore()

const showRecentlyAddedWorkflows = computed(() =>
  settingStore.get('Comfy.Sidebar.RecentItems.ShowRecentlyAdded')
)
const showRecentlyUsedWorkflows = computed(() =>
  settingStore.get('Comfy.Sidebar.RecentItems.ShowRecentlyUsed')
)

const hasRecentWorkflows = computed(
  () =>
    (recentItemsStore.recentlyAddedWorkflows.length > 0 &&
      showRecentlyAddedWorkflows.value) ||
    (recentItemsStore.recentlyUsedWorkflows.length > 0 &&
      showRecentlyUsedWorkflows.value)
)

const isRecentlyAddedExpanded = ref(false)
const isRecentlyUsedExpanded = ref(false)
const dummyExpandedKeys = ref<Record<string, boolean>>({})

const recentlyAddedWorkflowsTree = computed(() =>
  buildTree(
    recentItemsStore.recentlyAddedWorkflows,
    (workflow: ComfyWorkflow) => [workflow.key]
  )
)

const recentlyUsedWorkflowsTree = computed(() =>
  buildTree(
    recentItemsStore.recentlyUsedWorkflows,
    (workflow: ComfyWorkflow) => [workflow.key]
  )
)

const recentlyAddedRoot = computed(() =>
  props.renderTreeNode(
    recentlyAddedWorkflowsTree.value,
    WorkflowTreeType.RecentlyAddedWorkflows
  )
)

const recentlyUsedRoot = computed(() =>
  props.renderTreeNode(
    recentlyUsedWorkflowsTree.value,
    WorkflowTreeType.RecentlyUsedWorkflows
  )
)

const toggleRecentlyAdded = () => {
  isRecentlyAddedExpanded.value = !isRecentlyAddedExpanded.value
}

const toggleRecentlyUsed = () => {
  isRecentlyUsedExpanded.value = !isRecentlyUsedExpanded.value
}
</script>

<style scoped>
.recent-workflows-section {
  border-bottom: 1px solid var(--p-tree-border);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}
</style>
