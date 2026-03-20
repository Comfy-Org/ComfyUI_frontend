<template>
  <SidebarTabTemplate
    :title="title"
    v-bind="$attrs"
    :data-testid="dataTestid"
    class="workflows-sidebar-tab"
  >
    <template #alt-title>
      <slot name="alt-title" />
    </template>
    <template #tool-buttons>
      <Button
        v-tooltip.bottom="$t('g.refresh')"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.refresh')"
        @click="workflowStore.syncWorkflows()"
      >
        <i class="icon-[lucide--refresh-cw] size-4" />
      </Button>
    </template>
    <template #header>
      <SidebarTopArea>
        <SearchInput
          ref="searchBoxRef"
          v-model:model-value="searchQuery"
          :placeholder="$t('g.searchPlaceholder', { subject: searchSubject })"
          @search="handleSearch"
        />
      </SidebarTopArea>
    </template>
    <template #body>
      <div v-if="!isSearching" class="comfyui-workflows-panel">
        <div
          v-if="workflowTabsPosition === 'Sidebar'"
          class="comfyui-workflows-open"
        >
          <TextDivider
            :text="t('sideToolbar.workflowTab.workflowTreeType.open')"
            type="dashed"
            class="ml-2"
          />
          <TreeExplorer
            v-model:expanded-keys="dummyExpandedKeys"
            :root="renderTreeNode(openWorkflowsTree, WorkflowTreeType.Open)"
            :selection-keys="selectionKeys"
          >
            <template #node="{ node }">
              <TreeExplorerTreeNode :node="node">
                <template #before-label="{ node: treeNode }">
                  <span
                    v-if="
                      (treeNode.data as ComfyWorkflow)?.isModified ||
                      !(treeNode.data as ComfyWorkflow)?.isPersisted
                    "
                    >*</span
                  >
                </template>
                <template #actions="{ node: treeNode }">
                  <Button
                    class="close-workflow-button"
                    :variant="
                      workspaceStore.shiftDown ? 'destructive' : 'textonly'
                    "
                    size="icon-sm"
                    :aria-label="$t('g.close')"
                    @click.stop="
                      handleCloseWorkflow(treeNode.data as ComfyWorkflow)
                    "
                  >
                    <i class="icon-[lucide--x] size-3" />
                  </Button>
                </template>
              </TreeExplorerTreeNode>
            </template>
          </TreeExplorer>
        </div>
        <div
          v-show="filteredBookmarkedWorkflows.length > 0"
          class="comfyui-workflows-bookmarks"
        >
          <TextDivider
            :text="t('sideToolbar.workflowTab.workflowTreeType.bookmarks')"
            type="dashed"
            class="ml-2"
          />
          <TreeExplorer
            v-model:expanded-keys="dummyExpandedKeys"
            :root="
              renderTreeNode(
                bookmarkedWorkflowsTree,
                WorkflowTreeType.Bookmarks
              )
            "
            :selection-keys="selectionKeys"
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
            v-if="filteredPersistedWorkflows.length > 0"
            v-model:expanded-keys="expandedKeys"
            :root="renderTreeNode(workflowsTree, WorkflowTreeType.Browse)"
            :selection-keys="selectionKeys"
          >
            <template #node="{ node }">
              <WorkflowTreeLeaf :node="node" />
            </template>
          </TreeExplorer>
          <slot v-else name="empty-state">
            <NoResultsPlaceholder
              icon="pi pi-folder"
              :title="$t('g.empty')"
              :message="$t('g.noWorkflowsFound')"
            />
          </slot>
        </div>
      </div>
      <div v-else class="comfyui-workflows-search-panel">
        <TreeExplorer
          v-model:expanded-keys="expandedKeys"
          :root="renderTreeNode(filteredRoot, WorkflowTreeType.Browse)"
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
import ConfirmDialog from 'primevue/confirmdialog'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import TextDivider from '@/components/common/TextDivider.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import WorkflowTreeLeaf from '@/components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue'
import Button from '@/components/ui/button/Button.vue'
import { useTreeExpansion } from '@/composables/useTreeExpansion'
import { useAppMode } from '@/composables/useAppMode'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { TreeExplorerNode, TreeNode } from '@/types/treeExplorerTypes'
import {
  ensureWorkflowSuffix,
  getFilenameDetails,
  getWorkflowSuffix
} from '@/utils/formatUtil'
import { buildTree, sortedTree } from '@/utils/treeUtil'

const { title, filter, searchSubject, dataTestid, hideLeafIcon } = defineProps<{
  title: string
  filter?: (workflow: ComfyWorkflow) => boolean
  searchSubject: string
  dataTestid: string
  hideLeafIcon?: boolean
}>()

const { t } = useI18n()
const { isAppMode } = useAppMode()

const applyFilter = (workflows: ComfyWorkflow[]) =>
  filter ? workflows.filter(filter) : workflows

const settingStore = useSettingStore()
const workflowTabsPosition = computed(() =>
  settingStore.get('Comfy.Workflow.WorkflowTabsPosition')
)

const searchBoxRef = ref()

const searchQuery = ref('')
const isSearching = computed(() => searchQuery.value.length > 0)
const filteredWorkflows = ref<ComfyWorkflow[]>([])
const filteredRoot = computed<TreeNode>(() => {
  return buildWorkflowTree(filteredWorkflows.value as ComfyWorkflow[])
})
const handleSearch = async (query: string) => {
  if (query.length === 0) {
    filteredWorkflows.value = []
    expandedKeys.value = {}
    return
  }
  const lowerQuery = query.toLocaleLowerCase()
  filteredWorkflows.value = applyFilter(workflowStore.workflows).filter(
    (workflow) => {
      return workflow.path.toLocaleLowerCase().includes(lowerQuery)
    }
  )
  await nextTick()
  expandNode(filteredRoot.value)
}

const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const workspaceStore = useWorkspaceStore()
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)
const dummyExpandedKeys = ref<Record<string, boolean>>({})

const handleCloseWorkflow = async (workflow?: ComfyWorkflow) => {
  if (workflow) {
    await workflowService.closeWorkflow(workflow, {
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

const filteredPersistedWorkflows = computed(() =>
  applyFilter(workflowStore.persistedWorkflows)
)
const filteredBookmarkedWorkflows = computed(() =>
  applyFilter(workflowStore.bookmarkedWorkflows)
)

const workflowsTree = computed(() =>
  sortedTree(buildWorkflowTree(filteredPersistedWorkflows.value), {
    groupLeaf: true
  })
)
// Bookmarked workflows tree is flat.
const bookmarkedWorkflowsTree = computed(() =>
  buildTree(filteredBookmarkedWorkflows.value, (workflow) => [workflow.key])
)
// Open workflows tree is flat.
const openWorkflowsTree = computed(() =>
  buildTree(applyFilter(workflowStore.openWorkflows), (workflow) => [
    workflow.key
  ])
)

const renderTreeNode = (
  node: TreeNode,
  type: WorkflowTreeType
): TreeExplorerNode<ComfyWorkflow> => {
  const children = node.children?.map((child) => renderTreeNode(child, type))

  const workflow: ComfyWorkflow = node.data

  async function handleClick(
    this: TreeExplorerNode<ComfyWorkflow>,
    e: MouseEvent
  ) {
    if (this.leaf) {
      await workflowService.openWorkflow(workflow)
    } else {
      toggleNodeOnEvent(e, this)
    }
  }

  const actions = node.leaf
    ? {
        handleClick,
        async handleRename(newName: string) {
          const suffix = getWorkflowSuffix(workflow.suffix)
          const newPath =
            type === WorkflowTreeType.Browse
              ? workflow.directory + '/' + ensureWorkflowSuffix(newName, suffix)
              : ComfyWorkflow.basePath + ensureWorkflowSuffix(newName, suffix)

          await workflowService.renameWorkflow(workflow, newPath)
        },
        handleDelete: workflow.isTemporary
          ? undefined
          : async function () {
              await workflowService.deleteWorkflow(workflow)
            },
        contextMenuItems() {
          return [
            ...(isAppMode.value
              ? []
              : [
                  {
                    label: t('g.insert'),
                    icon: 'pi pi-file-export',
                    command: async () => {
                      const workflow = node.data
                      await workflowService.insertWorkflow(workflow)
                    }
                  }
                ]),
            {
              label: t('g.duplicate'),
              icon: 'pi pi-file-export',
              command: async () => {
                const workflow = node.data
                await workflowService.duplicateWorkflow(workflow)
              }
            }
          ]
        },
        draggable: true
      }
    : { handleClick }

  const label = node.leaf ? getFilenameDetails(node.label).filename : node.label

  return {
    key: node.key,
    label,
    leaf: node.leaf,
    icon: node.leaf && hideLeafIcon ? 'hidden' : undefined,
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
  searchBoxRef.value?.focus()
  await workflowBookmarkStore.loadBookmarks()
})
</script>
