<template>
  <SidebarTabTemplate :title="$t('sideToolbar.modelLibrary')">
    <template #tool-buttons> </template>
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
  <div id="model-library-model-preview-container" />
</template>

<script setup lang="ts">
import SearchBox from '@/components/common/SearchBox.vue'
import { useI18n } from 'vue-i18n'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ModelTreeLeaf from '@/components/sidebar/tabs/modelLibrary/ModelTreeLeaf.vue'
import { ComfyModelDef, useModelStore } from '@/stores/modelStore'
import { useTreeExpansion } from '@/hooks/treeHooks'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'
import { computed, ref, type ComputedRef, watch, toRef } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import { buildTree } from '@/utils/treeUtil'
const { t } = useI18n()
const modelStore = useModelStore()
const searchQuery = ref<string>('')
const expandedKeys = ref<Record<string, boolean>>({})
const { toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const root: ComputedRef<TreeNode> = computed(() => {
  let modelList: ComfyModelDef[] = []
  if (!modelStore.modelFolders.length) {
    modelStore.getModelFolders()
  }
  for (let folder of modelStore.modelFolders) {
    const models = modelStore.modelStoreMap[folder]
    if (models) {
      if (Object.values(models.models).length) {
        modelList.push(...Object.values(models.models))
      } else {
        const fakeModel = new ComfyModelDef('(No Content)', folder)
        fakeModel.is_fake_object = true
        modelList.push(fakeModel)
      }
    } else {
      const fakeModel = new ComfyModelDef('Loading', folder)
      fakeModel.is_fake_object = true
      modelList.push(fakeModel)
    }
  }
  if (searchQuery.value) {
    const search = searchQuery.value.toLocaleLowerCase()
    modelList = modelList.filter((model: ComfyModelDef) => {
      return model.name.toLocaleLowerCase().includes(search)
    })
  }
  const tree: TreeNode = buildTree(modelList, (model: ComfyModelDef) => {
    return [model.directory, ...model.name.replaceAll('\\', '/').split('/')]
  })
  return tree
})

const renderedRoot = computed<TreeExplorerNode<ComfyModelDef>>(() => {
  const fillNodeInfo = (node: TreeNode): TreeExplorerNode<ComfyModelDef> => {
    const children = node.children?.map(fillNodeInfo)
    const model: ComfyModelDef | null =
      node.leaf && node.data ? node.data : null
    if (model?.is_fake_object) {
      if (model.name === '(No Content)') {
        return {
          key: node.key,
          label: t('noContent'),
          leaf: true,
          data: node.data,
          getIcon: (node: TreeExplorerNode<ComfyModelDef>) => {
            return 'pi pi-file'
          },
          children: []
        }
      } else {
        return {
          key: node.key,
          label: t('loading') + '...',
          leaf: true,
          data: node.data,
          getIcon: (node: TreeExplorerNode<ComfyModelDef>) => {
            return 'pi pi-spin pi-spinner'
          },
          children: []
        }
      }
    }

    return {
      key: node.key,
      label: model ? model.title : node.label,
      leaf: node.leaf,
      data: node.data,
      getIcon: (node: TreeExplorerNode<ComfyModelDef>) => {
        if (node.leaf) {
          if (node.data && node.data.image) {
            return 'pi pi-fake-spacer'
          }
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

watch(
  toRef(expandedKeys, 'value'),
  (newExpandedKeys) => {
    Object.entries(newExpandedKeys).forEach(([key, isExpanded]) => {
      if (isExpanded) {
        const folderPath = key.split('/').slice(1).join('/')
        if (folderPath && !folderPath.includes('/')) {
          // Trigger (async) load of model data for this folder
          modelStore.getModelsInFolderCached(folderPath)
        }
      }
    })
  },
  { deep: true }
)
</script>

<style>
.pi-fake-spacer {
  height: 1px;
  width: 16px;
}
</style>

<style scoped>
:deep(.comfy-vue-side-bar-body) {
  background: var(--p-tree-background);
}
</style>
