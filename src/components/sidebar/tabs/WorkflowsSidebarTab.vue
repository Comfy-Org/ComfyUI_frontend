<template>
  <SidebarTabTemplate
    :title="$t('sideToolbar.workflows')"
    class="bg-[var(--p-tree-background)]"
  >
    <template #tool-buttons>
      <Button
        class="browse-templates-button"
        icon="pi pi-th-large"
        v-tooltip.bottom="$t('sideToolbar.browseTemplates')"
        text
        @click="() => commandStore.execute('Comfy.BrowseTemplates')"
      />
      <Button
        class="open-workflow-button"
        icon="pi pi-folder-open"
        v-tooltip.bottom="$t('sideToolbar.openWorkflow')"
        text
        @click="() => commandStore.execute('Comfy.OpenWorkflow')"
      />
      <Button
        class="new-blank-workflow-button"
        icon="pi pi-plus"
        v-tooltip.bottom="$t('sideToolbar.newBlankWorkflow')"
        @click="() => commandStore.execute('Comfy.NewBlankWorkflow')"
        text
      />
    </template>
    <template #header>
      <SearchBox
        class="workflows-search-box p-4"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        :placeholder="$t('searchWorkflows') + '...'"
      />
    </template>
    <template #body>
      <div class="comfyui-workflows-panel" v-if="!isSearching">
        <div
          class="comfyui-workflows-open"
          v-if="workflowTabsPosition === 'Sidebar'"
        >
          <TextDivider text="Open" type="dashed" class="ml-2" />
          <TreeExplorer
            :roots="
              renderTreeNode(openWorkflowsTree, WorkflowTreeType.Open).children
            "
            :selectionKeys="selectionKeys"
          >
            <template #node="{ node }">
              <TreeExplorerTreeNode :node="node">
                <template #before-label="{ node }">
                  <span v-if="node.data.isModified">*</span>
                </template>
                <template #actions="{ node }">
                  <Button
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
          <TextDivider text="Bookmarks" type="dashed" class="ml-2" />
          <TreeExplorer
            :roots="
              renderTreeNode(
                bookmarkedWorkflowsTree,
                WorkflowTreeType.Bookmarks
              ).children
            "
          >
            <template #node="{ node }">
              <WorkflowTreeLeaf :node="node" />
            </template>
          </TreeExplorer>
        </div>
        <div class="comfyui-workflows-browse">
          <TextDivider text="Browse" type="dashed" class="ml-2" />
          <TreeExplorer
            :roots="
              renderTreeNode(workflowsTree, WorkflowTreeType.Browse).children
            "
            v-model:expandedKeys="expandedKeys"
          >
            <template #node="{ node }">
              <WorkflowTreeLeaf :node="node" />
            </template>
          </TreeExplorer>
        </div>
      </div>
      <div class="comfyui-workflows-search-panel" v-else>
        <TreeExplorer
          :roots="
            renderTreeNode(filteredRoot, WorkflowTreeType.Browse).children
          "
          v-model:expandedKeys="expandedKeys"
        >
          <template #node="{ node }">
            <WorkflowTreeLeaf :node="node" />
          </template>
        </TreeExplorer>
      </div>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import SearchBox from '@/components/common/SearchBox.vue'
import WorkflowTreeLeaf from '@/components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import Button from 'primevue/button'
import TextDivider from '@/components/common/TextDivider.vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import type { TreeNode } from 'primevue/treenode'
import { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { ComfyWorkflow } from '@/stores/workflowStore'
import { useI18n } from 'vue-i18n'
import { useTreeExpansion } from '@/hooks/treeHooks'
import { useSettingStore } from '@/stores/settingStore'
import { workflowService } from '@/services/workflowService'
import { useWorkspaceStore } from '@/stores/workspaceStore'
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

const commandStore = useCommandStore()
const workflowStore = useWorkflowStore()
const workspaceStore = useWorkspaceStore()
const { t } = useI18n()
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

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

  const handleClick = (
    node: TreeExplorerNode<ComfyWorkflow>,
    e: MouseEvent
  ) => {
    if (node.leaf) {
      workflowService.openWorkflow(workflow)
    } else {
      toggleNodeOnEvent(e, node)
    }
  }
  const actions = node.leaf
    ? {
        handleClick,
        handleRename: async (
          node: TreeExplorerNode<ComfyWorkflow>,
          newName: string
        ) => {
          const newPath =
            type === WorkflowTreeType.Browse
              ? workflow.directory + '/' + appendJsonExt(newName)
              : ComfyWorkflow.basePath + appendJsonExt(newName)

          await workflowService.renameWorkflow(workflow, newPath)
        },
        handleDelete: workflow.isTemporary
          ? undefined
          : () => {
              workflowService.deleteWorkflow(workflow)
            },
        contextMenuItems: (node: TreeExplorerNode<ComfyWorkflow>) => {
          return [
            {
              label: t('insert'),
              icon: 'pi pi-file-export',
              command: () => {
                const workflow = node.data
                workflowService.insertWorkflow(workflow)
              }
            }
          ]
        }
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
