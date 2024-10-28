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
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import ModelTreeLeaf from '@/components/sidebar/tabs/modelLibrary/ModelTreeLeaf.vue'
import { ComfyModelDef, ModelFolder, useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useSettingStore } from '@/stores/settingStore'
import { useTreeExpansion } from '@/hooks/treeHooks'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'
import { computed, ref, watch, toRef, onMounted } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import { app } from '@/scripts/app'
import { buildTree } from '@/utils/treeUtil'
const modelStore = useModelStore()
const modelToNodeStore = useModelToNodeStore()
const settingStore = useSettingStore()
const searchQuery = ref<string>('')
const expandedKeys = ref<Record<string, boolean>>({})
const { toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const filteredModels = computed<ComfyModelDef[]>(() => {
  if (searchQuery.value) {
    const search = searchQuery.value.toLocaleLowerCase()
    return modelStore.models.filter((model: ComfyModelDef) => {
      return model.searchable.includes(search)
    })
  }
  return modelStore.models
})

const root = computed<TreeNode>(() => {
  const allNodes: (ComfyModelDef | ModelFolder)[] = [
    ...filteredModels.value,
    ...modelStore.modelFolders
  ]
  return buildTree(allNodes, (modelOrFolder: ComfyModelDef | ModelFolder) =>
    modelOrFolder.key.split('/')
  )
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
