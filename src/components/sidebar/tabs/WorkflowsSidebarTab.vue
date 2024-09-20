<template>
  <SidebarTabTemplate :title="$t('sideToolbar.workflows')">
    <template #tool-buttons>
      <Button
        icon="pi pi-folder-open"
        v-tooltip="'Browse for an image or exported workflow'"
        text
        @click="browse"
      />
      <Button
        icon="pi pi-code"
        v-tooltip="'Load default workflow'"
        text
        @click="loadDefault"
      />
      <Button
        icon="pi pi-plus"
        v-tooltip="'Create a new blank workflow'"
        @click="createBlank"
        text
      />
    </template>
    <template #body>
      <div class="comfyui-workflows-panel">
        <div class="comfyui-workflows-open">
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
                    @click.stop="app.workflowManager.closeWorkflow(node.data)"
                  />
                </template>
              </TreeExplorerTreeNode>
            </template>
          </TreeExplorer>
        </div>
        <div class="comfyui-workflows-bookmarks">
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
          >
            <template #node="{ node }">
              <WorkflowTreeLeaf :node="node" />
            </template>
          </TreeExplorer>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import WorkflowTreeLeaf from '@/components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import Button from 'primevue/button'
import TextDivider from '@/components/common/TextDivider.vue'
import { app } from '@/scripts/app'
import { computed } from 'vue'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { TreeNode } from 'primevue/treenode'
import { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { ComfyWorkflow } from '@/scripts/workflows'
import { useI18n } from 'vue-i18n'

const loadDefault = () => {
  app.loadGraphData()
  app.resetView()
}

const browse = () => {
  app.ui.loadFile()
}

const createBlank = () => {
  app.workflowManager.setWorkflow(null)
  app.clean()
  app.graph.clear()
  app.workflowManager.activeWorkflow.track()
}

const workflowStore = useWorkflowStore()
const { t } = useI18n()
const renderTreeNode = (node: TreeNode): TreeExplorerNode<ComfyWorkflow> => {
  const children = node.children?.map(renderTreeNode)

  const workflow: ComfyWorkflow = node.data
  const actions = node.leaf
    ? {
        handleClick: (node: TreeExplorerNode<ComfyWorkflow>) => {
          const workflow = node.data
          workflow.load()
        },
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
    : {}

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

<style scoped>
:deep(.comfy-vue-side-bar-body) {
  background: var(--p-tree-background);
}
</style>
