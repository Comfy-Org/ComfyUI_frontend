<template>
  <SidebarTabTemplate
    :title="$t('sideToolbar.workflows')"
    class="workflows-sidebar-tab bg-[var(--p-tree-background)]"
  >
    <template #tool-buttons>
      <Button
        icon="pi pi-refresh"
        @click="workflowStore.syncWorkflows()"
        severity="secondary"
        text
        v-tooltip.bottom="$t('g.refresh')"
      />
    </template>
    <template #header>
      <SearchBox
        class="workflows-search-box p-2 2xl:p-4"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        :placeholder="$t('g.searchWorkflows') + '...'"
      />
    </template>
    <template #body>
      <div class="comfyui-workflows-panel" v-if="!isSearching">
        <div
          class="comfyui-workflows-open"
          v-if="workflowTabsPosition === 'Sidebar'"
        >
          <TextDivider
            :text="t('sideToolbar.workflowTab.workflowTreeType.open')"
            type="dashed"
            class="ml-2"
          />
          <TreeExplorer
            :root="renderTreeNode(openWorkflowsTree, WorkflowTreeType.Open)"
            :selectionKeys="selectionKeys"
            v-model:expandedKeys="dummyExpandedKeys"
          >
            <template #node="{ node }">
              <TreeExplorerTreeNode :node="node">
                <template #before-label="{ node }">
                  <span v-if="node.data.isModified || !node.data.isPersisted"
                    >*</span
                  >
                </template>
                <template #actions="{ node }">
                  <Button
                    class="close-workflow-button"
                    icon="pi pi-times"
                    text
                    :severity="
                      workspaceStore.shiftDown ? 'danger' : 'secondary'
                    "
                    size="small"
                    @click.stop="handleCloseWorkflow(node.data)"
                  />
                </template>
              </TreeExplorerTreeNode>
            </template>
          </TreeExplorer>
        </div>
        <div
          class="comfyui-workflows-bookmarks"
          v-show="workflowStore.bookmarkedWorkflows.length > 0"
        >
          <TextDivider
            :text="t('sideToolbar.workflowTab.workflowTreeType.bookmarks')"
            type="dashed"
            class="ml-2"
          />
          <TreeExplorer
            :root="
              renderTreeNode(
                bookmarkedWorkflowsTree,
                WorkflowTreeType.Bookmarks
              )
            "
            :selectionKeys="selectionKeys"
            v-model:expandedKeys="dummyExpandedKeys"
          >
            <template #node="{ node }">
              <WorkflowTreeLeaf :node="node" />
            </template>
          </TreeExplorer>
        </div>
        <div class="comfyui-workflows-browse">
          <TextDivider
            :text="t('sideToolbar.workflowTab.workflowTreeType.browse')"
            type="dashed"
            class="ml-2"
          />
          <TreeExplorer
            :root="renderTreeNode(workflowsTree, WorkflowTreeType.Browse)"
            v-model:expandedKeys="expandedKeys"
            :selectionKeys="selectionKeys"
            v-if="workflowStore.persistedWorkflows.length > 0"
          >
            <template #node="{ node }">
              <WorkflowTreeLeaf :node="node" />
            </template>
          </TreeExplorer>
          <NoResultsPlaceholder
            v-else
            icon="pi pi-folder"
            :title="$t('g.empty')"
            :message="$t('g.noWorkflowsFound')"
          />
        </div>
      </div>
      <div class="comfyui-workflows-search-panel" v-else>
        <TreeExplorer
          :root="renderTreeNode(filteredRoot, WorkflowTreeType.Browse)"
          v-model:expandedKeys="expandedKeys"
        >
          <template #node="{ node }">
            <WorkflowTreeLeaf :node="node" />
          </template>
        </TreeExplorer>
      </div>
    </template>
  </SidebarTabTemplate>
  <ConfirmDialog />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import type { TreeNode } from 'primevue/treenode'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import TextDivider from '@/components/common/TextDivider.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import WorkflowTreeLeaf from '@/components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue'
import { useTreeExpansion } from '@/composables/useTreeExpansion'
import { useWorkflowService } from '@/services/workflowService'
import { useSettingStore } from '@/stores/settingStore'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/stores/workflowStore'
import { ComfyWorkflow } from '@/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { appendJsonExt } from '@/utils/formatUtil'
import { buildTree, sortedTree } from '@/utils/treeUtil'

const settingStore = useSettingStore()
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)

const searchQuery = ref('')
const isSearching = computed(() => searchQuery.value.length > 0)
const filteredWorkflows = ref<ComfyWorkflow[]>([])
const filteredRoot = computed<TreeNode>(() => {
  return buildWorkflowTree(filteredWorkflows.value as ComfyWorkflow[])
})
const handleSearch = (query: string) => {
  if (query.length === 0) {
    filteredWorkflows.value = []
    expandedKeys.value = {}
    return
  }
  const lowerQuery = query.toLocaleLowerCase()
  filteredWorkflows.value = workflowStore.workflows.filter((workflow) => {
    return workflow.path.toLocaleLowerCase().includes(lowerQuery)
  })
  nextTick(() => {
    expandNode(filteredRoot.value)
  })
}

const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const workspaceStore = useWorkspaceStore()
const { t } = useI18n()
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)
const dummyExpandedKeys = ref<Record<string, boolean>>({})

const handleCloseWorkflow = (workflow?: ComfyWorkflow) => {
  if (workflow) {
    workflowService.closeWorkflow(workflow, {
      warnIfUnsaved: !workspaceStore.shiftDown
    })
  }
}

enum WorkflowTreeType {
  Open = 'Open',
  Bookmarks = 'Bookmarks',
  Browse = 'Browse'
}

const buildWorkflowTree = (workflows: ComfyWorkflow[]) => {
  return buildTree(workflows, (workflow: ComfyWorkflow) =>
    workflow.key.split('/')
  )
}

const workflowsTree = computed(() =>
  sortedTree(buildWorkflowTree(workflowStore.persistedWorkflows), {
    groupLeaf: true
  })
)
// Bookmarked workflows tree is flat.
const bookmarkedWorkflowsTree = computed(() =>
  buildTree(workflowStore.bookmarkedWorkflows, (workflow) => [workflow.key])
)
// Open workflows tree is flat.
const openWorkflowsTree = computed(() =>
  buildTree(workflowStore.openWorkflows, (workflow) => [workflow.key])
)

const renderTreeNode = (
  node: TreeNode,
  type: WorkflowTreeType
): TreeExplorerNode<ComfyWorkflow> => {
  const children = node.children?.map((child) => renderTreeNode(child, type))

  const workflow: ComfyWorkflow = node.data

  function handleClick(this: TreeExplorerNode<ComfyWorkflow>, e: MouseEvent) {
    if (this.leaf) {
      workflowService.openWorkflow(workflow)
    } else {
      toggleNodeOnEvent(e, this)
    }
  }

  const actions = node.leaf
    ? {
        handleClick,
        async handleRename(newName: string) {
          const newPath =
            type === WorkflowTreeType.Browse
              ? workflow.directory + '/' + appendJsonExt(newName)
              : ComfyWorkflow.basePath + appendJsonExt(newName)

          await workflowService.renameWorkflow(workflow, newPath)
        },
        handleDelete: workflow.isTemporary
          ? undefined
          : async function () {
              await workflowService.deleteWorkflow(workflow)
            },
        contextMenuItems() {
          return [
            {
              label: t('g.insert'),
              icon: 'pi pi-file-export',
              command: () => {
                const workflow = node.data
                workflowService.insertWorkflow(workflow)
              }
            }
          ]
        },
        draggable: true
      }
    : { handleClick }

  return {
    key: node.key,
    label: node.label,
    leaf: node.leaf,
    data: node.data,
    children,
    ...actions
  }
}

const selectionKeys = computed(() => ({
  [`root/${workflowStore.activeWorkflow?.key}`]: true
}))

const workflowBookmarkStore = useWorkflowBookmarkStore()
onMounted(async () => {
  await workflowBookmarkStore.loadBookmarks()
})
</script>
