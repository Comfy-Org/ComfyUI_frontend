<template>
  <SidebarTabTemplate :title="$t('sideToolbar.modelLibrary')">
    <template #tool-buttons>
      <Button
        v-tooltip.bottom="$t('g.refresh')"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.refresh')"
        @click="withLoadFailureToast(() => modelStore.refresh())"
      >
        <i class="icon-[lucide--refresh-cw] size-4" />
      </Button>
      <Button
        v-if="!usesAssetAPI"
        v-tooltip.bottom="$t('g.loadAllFolders')"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.loadAllFolders')"
        @click="withLoadFailureToast(() => modelStore.loadModels())"
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
        <p v-if="searchResults.capped" class="mx-2 my-1 text-xs text-muted">
          {{
            $t('sideToolbar.searchResultsCapped', {
              limit: SEARCH_RESULT_LIMIT
            })
          }}
        </p>
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
import { useI18n } from 'vue-i18n'

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
import { useToastStore } from '@/platform/updates/common/toastStore'
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
const toastStore = useToastStore()
const { t } = useI18n()
const usesAssetAPI = computed(() =>
  settingStore.get('Comfy.Assets.UseAssetAPI')
)
const assetDownloadStore = useAssetDownloadStore()
const searchBoxRef = ref()
const searchQuery = ref<string>('')
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

// Search results render expanded and un-virtualized, and the tree's cost is
// O(n^2) in mounted rows, so an unbounded result set hangs the tab on large
// libraries (measured: seconds at 5k models). Cap what renders; refining the
// query is the path to the tail.
const SEARCH_RESULT_LIMIT = 500

const searchResults = computed<{ models: ComfyModelDef[]; capped: boolean }>(
  () => {
    const search = searchQuery.value.toLocaleLowerCase()
    if (!search) return { models: [], capped: false }
    const matches: ComfyModelDef[] = []
    for (const model of modelStore.models) {
      if (!model.searchable.includes(search)) continue
      if (matches.length === SEARCH_RESULT_LIMIT) {
        return { models: matches, capped: true }
      }
      matches.push(model)
    }
    return { models: matches, capped: false }
  }
)

const handleSearch = async (query: string) => {
  if (!query) {
    expandedKeys.value = {}
    return
  }
  // Load all models to ensure results cover folders not yet opened
  await modelStore.loadModels()
  await expandSearchResults()
}

type ModelOrFolder = ComfyModelDef | ModelFolder

const root = computed<TreeNode>(() => {
  const allNodes: ModelOrFolder[] = searchQuery.value
    ? searchResults.value.models
    : [...modelStore.visibleModelFolders, ...modelStore.models]
  return buildTree(allNodes, (modelOrFolder: ModelOrFolder) =>
    modelOrFolder.key.split('/')
  )
})

async function expandSearchResults() {
  if (!searchQuery.value) return
  await nextTick()
  expandNode(root.value)
}

// Expand results when the QUERY changes, not on every root recompute: a
// background reload during an active search must neither re-expand folders
// the user collapsed nor pay a full expand-and-mount pass per folder commit.
watch(searchQuery, expandSearchResults)

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

async function withLoadFailureToast(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (error) {
    console.error('Model library load failed', error)
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('sideToolbar.modelLibraryLoadFailed'),
      life: 5000
    })
  }
}

onMounted(async () => {
  searchBoxRef.value?.focus()
  // In asset mode the whole library resolves from one cached walk, so eager
  // loading is cheap and keeps search and folder badges complete from the
  // start; AutoLoadAll remains the opt-in for the request-per-folder legacy path.
  if (
    usesAssetAPI.value ||
    settingStore.get('Comfy.ModelLibrary.AutoLoadAll')
  ) {
    await withLoadFailureToast(() => modelStore.loadModels())
  }
})
</script>

<style scoped>
:deep(.pi-fake-spacer) {
  height: 1px;
  width: 16px;
}
</style>
