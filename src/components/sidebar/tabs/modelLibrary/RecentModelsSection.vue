<template>
  <div v-if="hasRecentModels" class="recent-models-section">
    <div
      v-show="
        recentItemsStore.recentlyAddedModels.length > 0 &&
        showRecentlyAddedModels
      "
      class="recently-added-models"
    >
      <div
        class="flex items-center cursor-pointer p-2"
        @click="toggleRecentlyAdded"
      >
        <i
          :class="[
            'pi text-sm mr-2 transition-transform',
            isRecentlyAddedExpanded ? 'pi-chevron-down' : 'pi-chevron-right'
          ]"
        />
        <span class="text-sm font-medium">{{
          $t('sideToolbar.modelLibraryTab.recentlyAddedModels')
        }}</span>
      </div>
      <div v-show="isRecentlyAddedExpanded" class="ml-4">
        <TreeExplorer
          v-model:expandedKeys="dummyExpandedKeys"
          :root="recentlyAddedRoot"
        />
      </div>
    </div>

    <div
      v-show="
        recentItemsStore.recentlyUsedModels.length > 0 && showRecentlyUsedModels
      "
      class="recently-used-models"
    >
      <div
        class="flex items-center cursor-pointer p-2"
        @click="toggleRecentlyUsed"
      >
        <i
          :class="[
            'pi text-sm mr-2 transition-transform',
            isRecentlyUsedExpanded ? 'pi-chevron-down' : 'pi-chevron-right'
          ]"
        />
        <span class="text-sm font-medium">{{
          $t('sideToolbar.modelLibraryTab.recentlyUsedModels')
        }}</span>
      </div>
      <div v-show="isRecentlyUsedExpanded" class="ml-4">
        <TreeExplorer
          v-model:expandedKeys="dummyExpandedKeys"
          :root="recentlyUsedRoot"
        />
      </div>
    </div>
    <Divider />
  </div>
</template>

<script setup lang="ts">
import { IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'
import Divider from 'primevue/divider'
import { computed, ref } from 'vue'

import TreeExplorer from '@/components/common/TreeExplorer.vue'
import { useLitegraphService } from '@/services/litegraphService'
import { ComfyModelDef } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useRecentItemsStore } from '@/stores/recentItemsStore'
import { useSettingStore } from '@/stores/settingStore'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { buildTree } from '@/utils/treeUtil'

const settingStore = useSettingStore()
const recentItemsStore = useRecentItemsStore()

const showRecentlyAddedModels = computed(() =>
  settingStore.get('Comfy.Sidebar.RecentItems.ShowRecentlyAdded')
)
const showRecentlyUsedModels = computed(() =>
  settingStore.get('Comfy.Sidebar.RecentItems.ShowRecentlyUsed')
)

const hasRecentModels = computed(
  () =>
    (recentItemsStore.recentlyAddedModels.length > 0 &&
      showRecentlyAddedModels.value) ||
    (recentItemsStore.recentlyUsedModels.length > 0 &&
      showRecentlyUsedModels.value)
)
const modelToNodeStore = useModelToNodeStore()
const isRecentlyAddedExpanded = ref(false)
const isRecentlyUsedExpanded = ref(false)
const dummyExpandedKeys = ref<Record<string, boolean>>({})

// Reusable function to render model nodes
const renderModelNode = (
  model: ComfyModelDef
): TreeExplorerNode<ComfyModelDef> => {
  const nameFormat = settingStore.get('Comfy.ModelLibrary.NameFormat')

  return {
    key: model.key,
    label: nameFormat === 'title' ? model.title : model.simplified_file_name,
    leaf: true,
    data: model,
    getIcon() {
      return model.image ? 'pi pi-image' : 'pi pi-file'
    },
    getBadgeText() {
      return undefined
    },
    children: undefined,
    draggable: true,
    handleClick() {
      // Handle model click - implement model selection/loading logic here
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
  }
}

// Convert TreeNode to TreeExplorerNode
const convertToTreeExplorerNode = (
  node: TreeNode
): TreeExplorerNode<ComfyModelDef> => {
  const children = node.children?.map((child) =>
    convertToTreeExplorerNode(child)
  )

  // Handle model leaf nodes
  if (node.leaf && node.data) {
    const model: ComfyModelDef = node.data
    return renderModelNode(model)
  }

  // Handle folder nodes
  return {
    key: node.key,
    label: node.label,
    leaf: node.leaf,
    data: node.data,
    getIcon() {
      return 'pi pi-folder'
    },
    getBadgeText() {
      return undefined
    },
    children,
    draggable: false,
    handleClick() {}
  }
}

const recentlyAddedModelsTree = computed(() =>
  buildTree(recentItemsStore.recentlyAddedModels, (model: ComfyModelDef) => [
    model.key
  ])
)

const recentlyUsedModelsTree = computed(() =>
  buildTree(recentItemsStore.recentlyUsedModels, (model: ComfyModelDef) => [
    model.key
  ])
)

const recentlyAddedRoot = computed(() =>
  convertToTreeExplorerNode(recentlyAddedModelsTree.value)
)

const recentlyUsedRoot = computed(() =>
  convertToTreeExplorerNode(recentlyUsedModelsTree.value)
)

const toggleRecentlyAdded = () => {
  isRecentlyAddedExpanded.value = !isRecentlyAddedExpanded.value
}

const toggleRecentlyUsed = () => {
  isRecentlyUsedExpanded.value = !isRecentlyUsedExpanded.value
}
</script>

<style scoped>
.recent-models-section {
  border-bottom: 1px solid var(--p-tree-border);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}
</style>
