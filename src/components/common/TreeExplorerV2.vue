<template>
  <ContextMenuRoot v-if="showContextMenu">
    <TreeRoot
      :expanded="expandedKeys"
      :items="root.children ?? []"
      :get-key="(item) => item.key"
      :get-children="
        (item) => (item.children?.length ? item.children : undefined)
      "
      class="m-0 p-0"
      @update:expanded="expandedKeys = $event"
    >
      <TreeVirtualizer
        v-slot="{ item }"
        :estimate-size="36"
        :text-content="(item) => item.value.label ?? ''"
      >
        <TreeExplorerV2Node
          :item="item as FlattenedItem<RenderedTreeExplorerNode>"
          :show-context-menu="showContextMenu"
          @node-click="
            (node: RenderedTreeExplorerNode, e: MouseEvent) =>
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

    <ContextMenuPortal>
      <ContextMenuContent
        class="z-[9999] min-w-32 overflow-hidden rounded-md border border-border-default bg-comfy-menu-bg p-1 shadow-md"
      >
        <ContextMenuItem
          class="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-highlight focus:bg-highlight"
          @select="handleAddToFavorites"
        >
          <i
            :class="
              isCurrentNodeBookmarked
                ? 'icon-[ph--star-fill]'
                : 'icon-[lucide--star]'
            "
            class="size-4"
          />
          {{ $t('sideToolbar.nodeLibraryTab.sections.favorites') }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>

  <!-- Without context menu -->
  <TreeRoot
    v-else
    :expanded="[...expandedKeys]"
    :items="root.children ?? []"
    :get-key="(item) => item.key"
    :get-children="
      (item) => (item.children?.length ? item.children : undefined)
    "
    class="m-0 p-0"
  >
    <TreeVirtualizer
      v-slot="{ item }"
      :estimate-size="36"
      :text-content="(item) => item.value.label ?? ''"
    >
      <TreeExplorerV2Node
        :item="item as FlattenedItem<RenderedTreeExplorerNode>"
        :show-context-menu="false"
        @node-click="
          (node: RenderedTreeExplorerNode, e: MouseEvent) =>
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
</template>

<script setup lang="ts">
import type { FlattenedItem } from 'reka-ui'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  TreeRoot,
  TreeVirtualizer
} from 'reka-ui'
import { computed, provide, ref } from 'vue'

import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { InjectKeyContextMenuNode } from '@/types/treeExplorerTypes'

import TreeExplorerV2Node from './TreeExplorerV2Node.vue'

const { showContextMenu = false } = defineProps<{
  root: RenderedTreeExplorerNode
  showContextMenu?: boolean
}>()

const expandedKeys = defineModel<string[]>('expandedKeys', {
  default: () => []
})

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode, event: MouseEvent]
  addToFavorites: [node: RenderedTreeExplorerNode]
}>()

const contextMenuNode = ref<RenderedTreeExplorerNode | null>(null)
provide(InjectKeyContextMenuNode, contextMenuNode)

const nodeBookmarkStore = useNodeBookmarkStore()

const isCurrentNodeBookmarked = computed(() => {
  const node = contextMenuNode.value
  if (!node?.data) return false
  return nodeBookmarkStore.isBookmarked(node.data)
})

function handleAddToFavorites() {
  if (contextMenuNode.value) {
    emit('addToFavorites', contextMenuNode.value)
  }
}
</script>
