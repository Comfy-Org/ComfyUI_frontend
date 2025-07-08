<template>
  <SidebarTabTemplate
    :title="$t('sideToolbar.modelLibrary')"
    class="bg-[var(--p-tree-background)]"
  >
    <template #tool-buttons>
      <Button
        v-tooltip.bottom="$t('g.refresh')"
        icon="pi pi-refresh"
        severity="secondary"
        text
        @click="modelStore.loadModelFolders"
      />
      <Button
        v-tooltip.bottom="$t('g.loadAllFolders')"
        icon="pi pi-cloud-download"
        severity="secondary"
        text
        @click="modelStore.loadModels"
      />
    </template>
    <template #header>
      <SearchBox
        v-model:modelValue="searchQuery"
        class="model-lib-search-box p-2 2xl:p-4"
        :placeholder="$t('g.searchModels') + '...'"
        @search="handleSearch"
      />
    </template>
    <template #body>
      <ElectronDownloadItems v-if="isElectron()" />

      <div v-if="!searchQuery" class="model-library-content">
        <RecentItemsSection
          :recently-added-items="recentItemsStore.recentlyAddedModels"
          :recently-used-items="recentItemsStore.recentlyUsedModels"
          :show-recently-added="showRecentlyAddedModels"
          :show-recently-used="showRecentlyUsedModels"
          :recently-added-title="
            $t('sideToolbar.modelLibraryTab.recentlyAddedModels')
          "
          :recently-used-title="
            $t('sideToolbar.modelLibraryTab.recentlyUsedModels')
          "
          :get-item-icon="getModelIcon"
          :get-item-label="getModelLabel"
          :get-item-preview-url="getModelPreviewUrl"
          :on-item-click="handleModelClick"
          :enable-preview="true"
          preview-target-id="#model-library-model-preview-container"
        >
          <template #preview="{ modelDef, previewRef }">
            <ModelPreview :ref="previewRef" :model-def="modelDef" />
          </template>
        </RecentItemsSection>
      </div>

      <TreeExplorer
        v-model:expandedKeys="expandedKeys"
        class="model-lib-tree-explorer"
        :root="renderedRoot"
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
import { IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'
import Button from 'primevue/button'
import { computed, nextTick, ref, toRef, watch, watchEffect } from 'vue'

import SearchBox from '@/components/common/SearchBox.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import RecentItemsSection from '@/components/sidebar/tabs/RecentItemsSection.vue'
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
import { useRecentItemsStore } from '@/stores/recentItemsStore'
import { useSettingStore } from '@/stores/settingStore'
import type { TreeNode } from '@/types/treeExplorerTypes'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { isElectron } from '@/utils/envUtil'
import { buildTree } from '@/utils/treeUtil'

const modelStore = useModelStore()
const modelToNodeStore = useModelToNodeStore()
const recentItemsStore = useRecentItemsStore()
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

  await nextTick()
  expandNode(root.value)
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
        // Return undefined to apply default badge text
        // Return empty string to hide badge
        if (!folder) {
          return
        }
        return folder.state === ResourceState.Loaded ? undefined : ''
      },
      children,
      draggable: node.leaf,
      handleClick(e: MouseEvent) {
        if (this.leaf) {
          const provider = modelToNodeStore.getNodeProvider(model!.directory)
          if (provider) {
            const node = useLitegraphService().addNodeOnGraph(provider.nodeDef)
            const widget = node.widgets?.find(
              (widget: IBaseWidget) => widget.name === provider.key
            )
            if (widget) {
              widget.value = model!.file_name
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

const showRecentlyAddedModels = computed(() =>
  settingStore.get('Comfy.Sidebar.RecentItems.ShowRecentlyAdded')
)
const showRecentlyUsedModels = computed(() =>
  settingStore.get('Comfy.Sidebar.RecentItems.ShowRecentlyUsed')
)

const getModelIcon = (model: ComfyModelDef): string => {
  return model.image ? 'pi pi-image' : 'pi pi-file'
}

const getModelLabel = (model: ComfyModelDef): string => {
  const nameFormat = settingStore.get('Comfy.ModelLibrary.NameFormat')
  return nameFormat === 'title' ? model.title : model.simplified_file_name
}

const getModelPreviewUrl = (model: ComfyModelDef): string | null => {
  if (model.image) {
    return model.image
  }
  const folder = model.directory
  const path_index = model.path_index
  const extension = model.file_name.split('.').pop()
  const filename = model.file_name.replace(`.${extension}`, '.webp')
  const encodedFilename = encodeURIComponent(filename).replace(/%2F/g, '/')
  return `/api/experiment/models/preview/${folder}/${path_index}/${encodedFilename}`
}

const handleModelClick = (model: ComfyModelDef): void => {
  const provider = modelToNodeStore.getNodeProvider(model.directory)
  if (provider) {
    const node = useLitegraphService().addNodeOnGraph(provider.nodeDef)
    const widget = node.widgets?.find(
      (widget: IBaseWidget) => widget.name === provider.key
    )
    if (widget) {
      widget.value = model.file_name
    }
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
          void modelStore.getLoadedModelFolder(folderPath)
        }
      }
    })
  },
  { deep: true }
)

watchEffect(async () => {
  if (
    settingStore.get('Comfy.ModelLibrary.AutoLoadAll') ||
    // if we don't load all, we can't filter the recent items
    settingStore.get('Comfy.Sidebar.RecentItems.ShowRecentlyAdded') ||
    settingStore.get('Comfy.Sidebar.RecentItems.ShowRecentlyUsed')
  ) {
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
