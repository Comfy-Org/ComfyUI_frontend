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
        v-tooltip.bottom="$t('g.refresh')"
      />
      <Button
        icon="pi pi-cloud-download"
        @click="modelStore.loadModels"
        severity="secondary"
        text
        v-tooltip.bottom="$t('g.loadAllFolders')"
      />
    </template>
    <template #header>
      <SearchBox
        class="model-lib-search-box p-2 2xl:p-4"
        v-model:modelValue="searchQuery"
        :placeholder="$t('g.searchModels') + '...'"
        @search="handleSearch"
      />
    </template>
    <template #body>
      <ElectronDownloadItems v-if="isElectron()" />

      <TreeExplorer
        class="model-lib-tree-explorer"
        :root="renderedRoot"
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
import type { TreeNode } from 'primevue/treenode'
import { computed, nextTick, onMounted, ref, toRef, watch } from 'vue'

import SearchBox from '@/components/common/SearchBox.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ElectronDownloadItems from '@/components/sidebar/tabs/modelLibrary/ElectronDownloadItems.vue'
import ModelTreeLeaf from '@/components/sidebar/tabs/modelLibrary/ModelTreeLeaf.vue'
import { useTreeExpansion } from '@/composables/useTreeExpansion'
import { useLitegraphService } from '@/services/litegraphService'
import {
  ComfyModelDef,
  ModelFolder,
  ResourceState,
  useModelStore
} from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useSettingStore } from '@/stores/settingStore'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { isElectron } from '@/utils/envUtil'
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
      getIcon() {
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
      getBadgeText() {
        // Return null to apply default badge text
        // Return empty string to hide badge
        if (!folder) {
          return null
        }
        return folder.state === ResourceState.Loaded ? null : ''
      },
      children,
      draggable: node.leaf,
      handleClick(e: MouseEvent) {
        if (this.leaf) {
          const provider = modelToNodeStore.getNodeProvider(model.directory)
          if (provider) {
            const node = useLitegraphService().addNodeOnGraph(provider.nodeDef)
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
