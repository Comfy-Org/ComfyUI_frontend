<template>
  <SidebarTabTemplate
    :title="$t('sideToolbar.modelLibrary')"
    class="bg-[var(--p-tree-background)]"
  >
    <template #tool-buttons>
      <Button
        icon="pi pi-refresh"
        @click="modelStore.loadModelFolders"
        severity="secondary"
        text
        v-tooltip="$t('refresh')"
      />
      <Button
        icon="pi pi-cloud-download"
        @click="modelStore.loadModels"
        severity="secondary"
        text
        v-tooltip="$t('loadAllFolders')"
      />
    </template>
    <template #header>
      <SearchBox
        class="model-lib-search-box p-4"
        v-model:modelValue="searchQuery"
        :placeholder="$t('searchModels') + '...'"
        @search="handleSearch"
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
import Button from 'primevue/button'
import SearchBox from '@/components/common/SearchBox.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ModelTreeLeaf from '@/components/sidebar/tabs/modelLibrary/ModelTreeLeaf.vue'
import {
  ComfyModelDef,
  ModelFolder,
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
import { computed, ref, watch, toRef, onMounted, nextTick } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import { app } from '@/scripts/app'
import { buildTree } from '@/utils/treeUtil'
const modelStore = useModelStore()
const modelToNodeStore = useModelToNodeStore()
const settingStore = useSettingStore()
const searchQuery = ref<string>('')
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const filteredModels = ref<ComfyModelDef[]>([])
const handleSearch = async (query: string) => {
  if (!query) {
    filteredModels.value = []
    expandedKeys.value = {}
    return
  }
  // Load all models to ensure we have the latest data
  await modelStore.loadModels()
  const search = query.toLocaleLowerCase()
  filteredModels.value = modelStore.models.filter((model: ComfyModelDef) => {
    return model.searchable.includes(search)
  })

  nextTick(() => {
    expandNode(root.value)
  })
}

type ModelOrFolder = ComfyModelDef | ModelFolder

const root = computed<TreeNode>(() => {
  const allNodes: ModelOrFolder[] = searchQuery.value
    ? filteredModels.value
    : [...modelStore.modelFolders, ...modelStore.models]
  return buildTree(allNodes, (modelOrFolder: ModelOrFolder) =>
    modelOrFolder.key.split('/')
  )
})

const renderedRoot = computed<TreeExplorerNode<ModelOrFolder>>(() => {
  const nameFormat = settingStore.get('Comfy.ModelLibrary.NameFormat')
  const fillNodeInfo = (node: TreeNode): TreeExplorerNode<ModelOrFolder> => {
    const children = node.children?.map(fillNodeInfo)
    const model: ComfyModelDef | null =
      node.leaf && node.data ? node.data : null
    const folder: ModelFolder | null =
      !node.leaf && node.data ? node.data : null

    return {
      key: node.key,
      label: model
        ? nameFormat === 'title'
          ? model.title
          : model.simplified_file_name
        : node.label,
      leaf: node.leaf,
      data: node.data,
      getIcon: () => {
        if (model) {
          return model.image ? 'pi pi-image' : 'pi pi-file'
        }
        if (folder) {
          return folder.state === ResourceState.Loading
            ? 'pi pi-spin pi-spinner'
            : 'pi pi-folder'
        }
        return 'pi pi-folder'
      },
      getBadgeText: () => {
        // Return null to apply default badge text
        // Return empty string to hide badge
        if (!folder) {
          return null
        }
        return folder.state === ResourceState.Loaded ? null : ''
      },
      children,
      draggable: node.leaf,
      handleClick: (
        node: RenderedTreeExplorerNode<ModelOrFolder>,
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

onMounted(async () => {
  if (settingStore.get('Comfy.ModelLibrary.AutoLoadAll')) {
    await modelStore.loadModels()
  }
})
</script>

<style scoped>
:deep(.pi-fake-spacer) {
  height: 1px;
  width: 16px;
}
</style>
