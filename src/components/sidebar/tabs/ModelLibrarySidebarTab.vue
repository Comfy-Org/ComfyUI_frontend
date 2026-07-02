<template>
  <SidebarTabTemplate :title="$t('sideToolbar.modelLibrary')">
    <template #tool-buttons>
      <Button
        v-tooltip.bottom="$t('g.refresh')"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.refresh')"
        @click="modelStore.refresh"
      >
        <i class="icon-[lucide--refresh-cw] size-4" />
      </Button>
      <Button
        v-if="!usesAssetAPI"
        v-tooltip.bottom="$t('g.loadAllFolders')"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.loadAllFolders')"
        @click="modelStore.loadModels"
      >
        <i class="icon-[lucide--cloud-download] size-4" />
      </Button>
    </template>
    <template #header>
      <SidebarTopArea>
        <SearchInput
          ref="searchBoxRef"
          v-model:model-value="searchQuery"
          :placeholder="
            $t('g.searchPlaceholder', {
              subject: $t('sideToolbar.labels.models')
            })
          "
          @search="handleSearch"
        />
      </SidebarTopArea>
    </template>
    <template #body>
      <ElectronDownloadItems v-if="isDesktop" />

      <Divider type="dashed" class="m-2" />
      <TreeExplorer
        v-model:expanded-keys="expandedKeys"
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
import { Divider } from 'primevue'
import { computed, nextTick, onMounted, ref, toRef, watch } from 'vue'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ElectronDownloadItems from '@/components/sidebar/tabs/modelLibrary/ElectronDownloadItems.vue'
import ModelTreeLeaf from '@/components/sidebar/tabs/modelLibrary/ModelTreeLeaf.vue'
import Button from '@/components/ui/button/Button.vue'
import { startModelLoaderDrag } from '@/composables/node/startModelNodeDragFromAsset'
import { useTreeExpansion } from '@/composables/useTreeExpansion'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'
import type { ComfyModelDef, ModelFolder } from '@/stores/modelStore'
import { ResourceState, useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import type { TreeExplorerNode, TreeNode } from '@/types/treeExplorerTypes'
import { isDesktop } from '@/platform/distribution/types'
import { buildTree } from '@/utils/treeUtil'

const modelStore = useModelStore()
const modelToNodeStore = useModelToNodeStore()
const settingStore = useSettingStore()
const usesAssetAPI = computed(() =>
  settingStore.get('Comfy.Assets.UseAssetAPI')
)
const assetDownloadStore = useAssetDownloadStore()
const searchBoxRef = ref()
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
        if (this.leaf && model) {
          const provider = modelToNodeStore.getNodeProvider(model.directory)
          if (provider) {
            startModelLoaderDrag(provider, model.file_name)
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
          void modelStore.getLoadedModelFolder(folderPath)
        }
      }
    })
  },
  { deep: true }
)

watch(
  () => assetDownloadStore.lastCompletedDownload,
  (completed) => {
    if (!completed) return
    void modelStore.refreshModelFolder(completed.modelType)
  }
)

onMounted(async () => {
  searchBoxRef.value?.focus()
  // In asset mode the whole library resolves from one cached walk, so eager
  // loading is cheap and keeps search and folder badges complete from the
  // start; AutoLoadAll remains the opt-in for the request-per-folder legacy path.
  if (
    usesAssetAPI.value ||
    settingStore.get('Comfy.ModelLibrary.AutoLoadAll')
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
