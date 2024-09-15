<template>
  <SidebarTabTemplate :title="$t('sideToolbar.modelLibrary')">
    <template #tool-buttons>
    </template>
    <template #body>
      <div class="flex flex-col h-full">
        <div class="flex-shrink-0">
          <SearchBox
            class="model-lib-search-box mx-4 mt-4"
            v-model:modelValue="searchQuery"
            @search="handleSearch"
            :placeholder="$t('searchModels') + '...'"
          />
        </div>
        <div class="flex-grow overflow-y-auto">
          <TreeExplorer
            class="model-lib-tree-explorer mt-1"
            :roots="renderedRoot.children"
            v-model:expandedKeys="expandedKeys"
            @nodeClick="handleNodeClick"
          >
            <template #node="{ node }">
              <ModelTreeLeaf :node="node" />
            </template>
          </TreeExplorer>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import SearchBox from '@/components/common/SearchBox.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ModelTreeLeaf from '@/components/sidebar/tabs/modelLibrary/ModelTreeLeaf.vue'
import { ComfyModelDef, useModelStore } from '@/stores/modelStore'
import { useTreeExpansion } from '@/hooks/treeHooks'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'
import { computed, nextTick, ref, Ref, type ComputedRef } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import { buildTree } from '@/utils/treeUtil'

const modelStore = useModelStore()
const searchQuery = ref<string>('')
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const rootFolders = ['checkpoints', 'loras', 'vae', 'controlnet']

const root: ComputedRef<TreeNode> = computed(() => {
  let modelList: ComfyModelDef[] = []
  for (let folder of rootFolders) {
    const models = modelStore.modelStoreMap[folder]
    if (models) {
      modelList.push(...Object.values(models.models))
    }
  }
  if (searchQuery.value) {
    const search = searchQuery.value.toLocaleLowerCase()
    modelList = modelList.filter((model: ComfyModelDef) => {
      return model.name.toLocaleLowerCase().includes(search)
    });
  }
  const tree: TreeNode = buildTree(modelList, (model: ComfyModelDef) => {
    return [model.directory, ...model.name.replaceAll('\\', '/').split('/')]
  })
  for (let folder of rootFolders) {
    if (!tree.children.some(c => c.label == folder)) {
      const node: TreeNode = {
        key: `root/${folder}`,
        label: folder,
        leaf: false,
        children: []
      }
    tree.children.push(node)
    }
  }
  return tree
})

// Trigger the async operation to fetch models
modelStore.getModelsInFolderCached('checkpoints')

const renderedRoot = computed<TreeExplorerNode<ComfyModelDef>>(() => {
  const fillNodeInfo = (node: TreeNode): TreeExplorerNode<ComfyModelDef> => {
    const children = node.children?.map(fillNodeInfo)
    const model: ComfyModelDef | null = node.leaf ? node.data : null
    if (model && model.name.endsWith('\0')) {
      return {
        key: node.key,
        label: '',
        leaf: false,
        data: null,
        children: []
      }
    }

    return {
      key: node.key,
      label: model ? model.title : node.label,
      leaf: node.leaf,
      data: node.data,
      getIcon: (node: TreeExplorerNode<ComfyModelDef>) => {
        if (node.leaf) {
          return 'pi pi-file'
        }
      },
      children,
      draggable: node.leaf
    }
  }
  return fillNodeInfo(root.value)
})

const handleSearch = (query: string) => {
  // TODO
}

const handleNodeClick = (
  node: RenderedTreeExplorerNode<ComfyModelDef>,
  e: MouseEvent
) => {
  if (node.leaf) {
    // TODO
  } else {
    toggleNodeOnEvent(e, node)
  }
}
</script>

<style>
/* TODO */
</style>

<style scoped>
:deep(.comfy-vue-side-bar-body) {
  background: var(--p-tree-background);
}
</style>
