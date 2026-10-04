<template>
  <TreeRoot
    :expanded="[...expandedKeys]"
    :items="root.children ?? []"
    :get-key="(item) => item.key"
    :get-children="
      (item) => (item.children?.length ? item.children : undefined)
    "
    class="m-0 min-w-0 p-0 px-2 pb-2"
    @contextmenu="handleContextMenu"
  >
    <TreeVirtualizer
      v-slot="{ item }"
      :estimate-size="36"
      :text-content="(item) => item.value.label ?? ''"
    >
      <TreeExplorerV2Node
        :item="
          item as FlattenedItem<RenderedTreeExplorerNode<ComfyNodeDefImpl>>
        "
        @node-click="
          (node: RenderedTreeExplorerNode<ComfyNodeDefImpl>, e: MouseEvent) =>
            emit('nodeClick', node, e)
        "
      >
        <template #folder="{ node }">
          <slot name="folder" :node="node" />
        </template>
        <template #node="{ node }">
          <slot name="node" :node="node" />
        </template>
      </TreeExplorerV2Node>
    </TreeVirtualizer>
  </TreeRoot>
  <ContextMenu ref="contextMenu" :model="menuItems" />
</template>

<script setup lang="ts">
import type { FlattenedItem } from 'reka-ui'
import { TreeRoot, TreeVirtualizer } from 'reka-ui'
import { computed, provide, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import ContextMenu from '@/components/ui/menu/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { InjectKeyContextMenuNode } from '@/types/treeExplorerTypes'

import TreeExplorerV2Node from './TreeExplorerV2Node.vue'

const { showContextMenu = false } = defineProps<{
  root: RenderedTreeExplorerNode<ComfyNodeDefImpl>
  showContextMenu?: boolean
}>()

const expandedKeys = defineModel<string[]>('expandedKeys', {
  default: () => []
})

const emit = defineEmits<{
  nodeClick: [
    node: RenderedTreeExplorerNode<ComfyNodeDefImpl>,
    event: MouseEvent
  ]
}>()

const contextMenuNode = ref<RenderedTreeExplorerNode<ComfyNodeDefImpl> | null>(
  null
)
provide(InjectKeyContextMenuNode, contextMenuNode)

const nodeBookmarkStore = useNodeBookmarkStore()
const subgraphStore = useSubgraphStore()
const contextMenu = useTemplateRef('contextMenu')
const { t } = useI18n()

const isCurrentNodeBookmarked = computed(() => {
  const node = contextMenuNode.value
  if (!node?.data) return false
  return nodeBookmarkStore.isBookmarked(node.data)
})

const isCurrentNodeUserBlueprint = computed(() =>
  subgraphStore.isUserBlueprint(contextMenuNode.value?.data?.name)
)

const menuItems = computed<MenuItem[]>(() => [
  {
    label: isCurrentNodeBookmarked.value
      ? t('sideToolbar.nodeLibraryTab.sections.unfavoriteNode')
      : t('sideToolbar.nodeLibraryTab.sections.favoriteNode'),
    icon: isCurrentNodeBookmarked.value
      ? 'icon-[ph--star-fill]'
      : 'icon-[lucide--star]',
    command: handleToggleBookmark
  },
  {
    label: t('g.delete'),
    icon: 'icon-[lucide--trash-2]',
    visible: isCurrentNodeUserBlueprint.value,
    class: 'text-destructive-background',
    command: handleDeleteBlueprint
  }
])

function handleContextMenu(event: MouseEvent) {
  if (showContextMenu && contextMenuNode.value?.data) {
    contextMenu.value?.show(event)
  } else {
    contextMenu.value?.hide()
  }
}

function handleToggleBookmark() {
  const node = contextMenuNode.value
  if (node?.data) {
    nodeBookmarkStore.toggleBookmark(node.data)
  }
}

function handleDeleteBlueprint() {
  const name = contextMenuNode.value?.data?.name
  if (name) {
    void subgraphStore.deleteBlueprint(name)
  }
}
</script>
