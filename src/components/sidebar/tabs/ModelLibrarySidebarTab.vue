<template>
  <SidebarTabTemplate
    :title="$t('sideToolbar.modelLibrary')"
    class="bg-[var(--p-tree-background)]"
  >
    <template #header>
      <SearchBox
        class="model-lib-search-box p-4"
        v-model:modelValue="searchQuery"
        :placeholder="$t('searchModels') + '...'"
      />
    </template>
    <template #body>
      <TreeExplorer
        class="model-lib-tree-explorer py-0"
        :roots="renderedRoot.children"
        v-model:expandedKeys="expandedKeys"
      >
        <template #node="{ node }">
          <ModelTreeLeaf :node="node" />
        </template>
      </TreeExplorer>
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
import {
  ComfyModelDef,
  ResourceState,
  useModelStore
} from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useSettingStore } from '@/stores/settingStore'
import { useTreeExpansion } from '@/hooks/treeHooks'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'
import { computed, ref, type ComputedRef, watch, toRef } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import { app } from '@/scripts/app'
import { buildTree } from '@/utils/treeUtil'
const { t } = useI18n()
const modelStore = useModelStore()
const modelToNodeStore = useModelToNodeStore()
const settingStore = useSettingStore()
const searchQuery = ref<string>('')
const expandedKeys = ref<Record<string, boolean>>({})
const { toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const root: ComputedRef<TreeNode> = computed(() => {
  let modelList: ComfyModelDef[] = []
  if (settingStore.get('Comfy.ModelLibrary.AutoLoadAll')) {
    for (let folder of modelStore.modelFolderNames) {
      modelStore.getLoadedModelFolder(folder)
    }
  }
  for (let folder of modelStore.modelFolderNames) {
    const models = modelStore.modelFolderByName[folder]
    if (models.state === ResourceState.Loaded) {
      if (Object.values(models.models).length) {
        modelList.push(...Object.values(models.models))
      } else {
        // ModelDef with key 'folder/a/b/c/' is treated as empty folder
        modelList.push(new ComfyModelDef('', folder))
      }
    }
  }
  if (searchQuery.value) {
    const search = searchQuery.value.toLocaleLowerCase()
    modelList = modelList.filter((model: ComfyModelDef) => {
      return model.searchable.includes(search)
    })
  }
  const tree: TreeNode = buildTree(modelList, (model: ComfyModelDef) =>
    model.key.split('/')
  )
  return tree
})

const renderedRoot = computed<TreeExplorerNode<ComfyModelDef>>(() => {
  const nameFormat = settingStore.get('Comfy.ModelLibrary.NameFormat')
  const fillNodeInfo = (node: TreeNode): TreeExplorerNode<ComfyModelDef> => {
    const children = node.children?.map(fillNodeInfo)
    const model: ComfyModelDef | null =
      node.leaf && node.data ? node.data : null

    return {
      key: node.key,
      label: model
        ? nameFormat === 'title'
          ? model.title
          : model.simplified_file_name
        : node.label,
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
      getBadgeText: (node: TreeExplorerNode<ComfyModelDef>) => {
        if (node.leaf) {
          return null
        }
        // TODO: Fix this
        function isUninitialized(model: ComfyModelDef | null) {
          return true
        }
        if (isUninitialized(node.data)) {
          return ''
        }
        return null
      },
      children,
      draggable: node.leaf,
      handleClick: (
        node: RenderedTreeExplorerNode<ComfyModelDef>,
        e: MouseEvent
      ) => {
        if (node.leaf) {
          const provider = modelToNodeStore.getNodeProvider(model.directory)
          if (provider) {
            const node = app.addNodeOnGraph(provider.nodeDef, {
              pos: app.getCanvasCenter()
            })
            const widget = node.widgets.find(
              (widget) => widget.name === provider.key
            )
            if (widget) {
              widget.value = model.file_name
            }
          }
        } else {
          toggleNodeOnEvent(e, node)
        }
      }
    }
  }
  return fillNodeInfo(root.value)
})

watch(
  toRef(expandedKeys, 'value'),
  (newExpandedKeys) => {
    Object.entries(newExpandedKeys).forEach(([key, isExpanded]) => {
      if (isExpanded) {
        const folderPath = key.split('/').slice(1).join('/')
        if (folderPath && !folderPath.includes('/')) {
          // Trigger (async) load of model data for this folder
          modelStore.getLoadedModelFolder(folderPath)
        }
      }
    })
  },
  { deep: true }
)
</script>

<style scoped>
:deep(.pi-fake-spacer) {
  height: 1px;
  width: 16px;
}
</style>
