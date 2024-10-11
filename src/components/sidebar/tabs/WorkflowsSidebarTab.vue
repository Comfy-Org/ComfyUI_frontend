<template>
  <SidebarTabTemplate
    :title="$t('sideToolbar.workflows')"
    class="bg-[var(--p-tree-background)]"
  >
    <template #tool-buttons>
      <Button
        class="browse-templates-button"
        icon="pi pi-th-large"
        v-tooltip="$t('sideToolbar.browseTemplates')"
        text
        @click="() => commandStore.execute('Comfy.BrowseTemplates')"
      />
      <Button
        class="open-workflow-button"
        icon="pi pi-folder-open"
        v-tooltip="$t('sideToolbar.openWorkflow')"
        text
        @click="() => commandStore.execute('Comfy.OpenWorkflow')"
      />
      <Button
        class="new-blank-workflow-button"
        icon="pi pi-plus"
        v-tooltip="$t('sideToolbar.newBlankWorkflow')"
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
            :roots="renderTreeNode(workflowStore.openWorkflowsTree).children"
            v-model:selectionKeys="selectionKeys"
          >
            <template #node="{ node }">
              <TreeExplorerTreeNode :node="node">
                <template #before-label="{ node }">
                  <span v-if="node.data.unsaved">*</span>
                </template>
                <template #actions="{ node }">
                  <Button
                    icon="pi pi-times"
                    text
                    severity="secondary"
                    size="small"
                    @click.stop="app.workflowManager.closeWorkflow(node.data)"
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
              renderTreeNode(workflowStore.bookmarkedWorkflowsTree).children
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
            :roots="renderTreeNode(workflowStore.workflowsTree).children"
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
          :roots="renderTreeNode(filteredRoot).children"
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
import { app } from '@/scripts/app'
import { computed, nextTick, ref } from 'vue'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import type { TreeNode } from 'primevue/treenode'
import { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { ComfyWorkflow } from '@/scripts/workflows'
import { useI18n } from 'vue-i18n'
import { useTreeExpansion } from '@/hooks/treeHooks'
import { useSettingStore } from '@/stores/settingStore'

const settingStore = useSettingStore()
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)

const searchQuery = ref('')
const isSearching = computed(() => searchQuery.value.length > 0)
const filteredWorkflows = ref<ComfyWorkflow[]>([])
const filteredRoot = computed<TreeNode>(() => {
  return workflowStore.buildWorkflowTree(
    filteredWorkflows.value as ComfyWorkflow[]
  )
})
const handleSearch = (query: string) => {
  if (query.length === 0) {
    filteredWorkflows.value = []
    expandedKeys.value = {}
    return
  }
  const lowerQuery = query.toLocaleLowerCase()
  filteredWorkflows.value = workflowStore.workflows.filter((workflow) => {
    return workflow.name.toLocaleLowerCase().includes(lowerQuery)
  })
  nextTick(() => {
    expandNode(filteredRoot.value)
  })
}

const commandStore = useCommandStore()

const workflowStore = useWorkflowStore()
const { t } = useI18n()
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const renderTreeNode = (node: TreeNode): TreeExplorerNode<ComfyWorkflow> => {
  const children = node.children?.map(renderTreeNode)

  const workflow: ComfyWorkflow = node.data

  const handleClick = (
    node: TreeExplorerNode<ComfyWorkflow>,
    e: MouseEvent
  ) => {
    if (node.leaf) {
      const workflow = node.data
      workflow.load()
    } else {
      toggleNodeOnEvent(e, node)
    }
  }
  const actions = node.leaf
    ? {
        handleClick,
        handleRename: (
          node: TreeExplorerNode<ComfyWorkflow>,
          newName: string
        ) => {
          const workflow = node.data
          workflow.rename(newName)
        },
        handleDelete: workflow.isTemporary
          ? undefined
          : (node: TreeExplorerNode<ComfyWorkflow>) => {
              const workflow = node.data
              workflow.delete()
            },
        contextMenuItems: (node: TreeExplorerNode<ComfyWorkflow>) => {
          return [
            {
              label: t('insert'),
              icon: 'pi pi-file-export',
              command: () => {
                const workflow = node.data
                workflow.insert()
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
  [`root/${workflowStore.activeWorkflow?.name}.json`]: true
}))
</script>
